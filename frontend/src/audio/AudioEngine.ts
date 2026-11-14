import { TemporalObservation, SonificationParams } from '../types/dataset';
import { createObservationSonificationParams } from './sonificationMapping';

/**
 * Motor nativo de áudio para síntese em tempo real via Web Audio API.
 * Implementa agendamento preciso (Lookahead) para sequências temporais.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  
  private activeOscillators = new Set<OscillatorNode>();
  private errorListeners = new Set<(message: string | null) => void>();
  private lastError: string | null = null;
  private isMuted: boolean = false;

  // Estado de controle da sequência
  private isPlaying: boolean = false;
  private currentSequence: TemporalObservation[] = [];
  private currentIndex: number = 0;
  private nextSegmentTime: number = 0;
  private scheduleTimer: number | null = null;
  private speedMultiplier: number = 1.0;
  
  // Parâmetros de agendamento (A Tale of Two Clocks)
  private readonly LOOKAHEAD_MS = 25; 
  private readonly SCHEDULE_AHEAD_SEC = 0.1; 

  private initContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      this.analyser = this.ctx.createAnalyser();
      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().then(() => this.notifyError(null)).catch((error: unknown) => {
        this.notifyError(error instanceof Error ? error.message : 'Não foi possível iniciar o áudio.');
      });
    }
    return this.ctx;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(muted ? 0.0 : 0.3, this.ctx.currentTime);
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  // --- MÉTODOS DO ANALISADOR E ERROS (MAIN) ---
  
  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  public subscribeError(listener: (message: string | null) => void): () => void {
    this.errorListeners.add(listener);
    listener(this.lastError);
    return () => this.errorListeners.delete(listener);
  }

  public reportError(error: unknown): void {
    this.notifyError(error instanceof Error ? error.message : 'Não foi possível iniciar o áudio.');
  }

  private notifyError(message: string | null): void {
    this.lastError = message;
    this.errorListeners.forEach((listener) => listener(message));
  }

  // --- CONTROLES DE REPRODUÇÃO (HAZEL) ---

  public setSpeed(multiplier: number): void {
    this.speedMultiplier = Math.max(0.1, multiplier);
  }

  public pause(): void {
    this.isPlaying = false;
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend();
    }
    if (this.scheduleTimer) {
      window.clearTimeout(this.scheduleTimer);
      this.scheduleTimer = null;
    }
  }

  public async resume(): Promise<void> {
    if (!this.ctx || this.currentSequence.length === 0) return;
    this.isPlaying = true;
    await this.ctx.resume();
    this.nextSegmentTime = this.ctx.currentTime + 0.1;
    this.scheduler();
  }

  public async playSequence(sequence: TemporalObservation[]): Promise<void> {
    this.currentSequence = sequence;
    this.currentIndex = 0;
    
    if (this.isMuted) return;
    const ctx = this.initContext();
    this.isPlaying = true;
    
    this.stopActiveSounds();
    await ctx.resume();
    this.nextSegmentTime = ctx.currentTime + 0.1;
    this.scheduler();
  }

  // --- CONTROLES DE NAVEGAÇÃO ---

  public next(): void {
    if (this.currentIndex < this.currentSequence.length - 1) {
      this.goToIndex(this.currentIndex + 1);
    }
  }

  public previous(): void {
    if (this.currentIndex > 0) {
      this.goToIndex(this.currentIndex - 1);
    }
  }

  public goToIndex(index: number): void {
    if (index >= 0 && index < this.currentSequence.length) {
      this.currentIndex = index;
      
      this.stopActiveSounds();
      
      if (this.ctx) {
        this.nextSegmentTime = this.ctx.currentTime; 
      }
      
      if (this.isPlaying) {
        if (this.scheduleTimer) window.clearTimeout(this.scheduleTimer);
        this.scheduler();
      }
    }
  }

  private stopActiveSounds(): void {
    for (const osc of this.activeOscillators) {
      try {
        osc.stop();
        osc.disconnect();
      } catch (e) {
        // Ignora erros caso o nó já tenha sido finalizado pelo tempo
      }
    }
    this.activeOscillators.clear();
  }

  // --- LOOP DE AGENDAMENTO ---

  private scheduler = (): void => {
    if (!this.isPlaying || !this.ctx) return;

    while (this.nextSegmentTime < this.ctx.currentTime + this.SCHEDULE_AHEAD_SEC && this.currentIndex < this.currentSequence.length) {
      const obs = this.currentSequence[this.currentIndex];
      
      const baseDurationMs = 1500; 
      const adjustedDurationMs = baseDurationMs / this.speedMultiplier;
      
      const params = createObservationSonificationParams(obs, adjustedDurationMs);
      this.scheduleParams(params, this.nextSegmentTime);
      
      this.nextSegmentTime += (adjustedDurationMs / 1000);
      this.currentIndex++;
    }

    if (this.currentIndex < this.currentSequence.length) {
      this.scheduleTimer = window.setTimeout(this.scheduler, this.LOOKAHEAD_MS);
    } else {
      this.isPlaying = false;
      this.scheduleTimer = null;
    }
  }

  // --- SÍNTESE DE ÁUDIO ---

  private scheduleParams(params: SonificationParams, startTime: number): void {
    if (!this.ctx) return;
    const totalDurationSec = params.durationMs / 1000;

    if (params.isMissing) {
      this.playAlertTone(this.ctx, startTime);
      return;
    }

    const pulseInterval = totalDurationSec / params.pulseCount;
    const pulseActiveDuration = Math.min(pulseInterval * 0.65, 0.25);

    for (let i = 0; i < params.pulseCount; i++) {
      const pulseStart = startTime + i * pulseInterval;
      this.synthesizePulse(this.ctx, params.frequency, pulseStart, pulseActiveDuration);
    }
  }

  private synthesizePulse(
    ctx: AudioContext,
    frequency: number,
    startTime: number,
    duration: number
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, startTime);

    const attackTime = 0.02;
    const releaseTime = duration * 0.4;
    const peakTime = startTime + attackTime;
    const decayStart = startTime + duration - releaseTime;

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(0.4, peakTime);
    gain.gain.setValueAtTime(0.4, Math.max(peakTime, decayStart));
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    if (this.masterGain) gain.connect(this.masterGain);

    osc.start(startTime);
    this.activeOscillators.add(osc);
    osc.addEventListener('ended', () => {
      this.activeOscillators.delete(osc);
      osc.disconnect();
      gain.disconnect();
    }, { once: true });
    osc.stop(startTime + duration + 0.05);
  }

  private playAlertTone(ctx: AudioContext, startTime: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240, startTime);
    osc.frequency.linearRampToValueAtTime(180, startTime + 0.3);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.exponentialRampToValueAtTime(0.2, startTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

    osc.connect(gain);
    if (this.masterGain) gain.connect(this.masterGain);

    osc.start(startTime);
    this.activeOscillators.add(osc);
    osc.addEventListener('ended', () => {
      this.activeOscillators.delete(osc);
      osc.disconnect();
      gain.disconnect();
    }, { once: true });
    osc.stop(startTime + 0.4);
  }

  public dispose(): void {
    this.pause();
    this.stopActiveSounds();
    if (this.ctx) {
      if (this.ctx.state !== 'closed') {
        this.masterGain?.disconnect();
        this.analyser?.disconnect();
        void this.ctx.close();
      }
      this.ctx = null;
      this.masterGain = null;
      this.analyser = null;
      this.activeOscillators.clear();
    }
    this.lastError = null;
  }
}

export const globalAudioEngine = new AudioEngine();