import { TemporalObservation, SonificationParams } from '../types/dataset';
import { createObservationSonificationParams, FREQ_ALERT } from './sonificationMapping';

export const MAX_GAIN = 0.6;
const DEFAULT_GAIN = 0.3;

/**
 * Motor nativo de áudio para síntese em tempo real via Web Audio API.
 * Implementa agendamento preciso (Lookahead) para sequências temporais
 * e integração com nós de análise (waveform) e gestão de erros.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private isMuted: boolean = false;
  private volume = DEFAULT_GAIN;

  // Estado de controle da sequência (Hazel)
  private isPlaying: boolean = false;
  private currentSequence: TemporalObservation[] = [];
  private currentIndex: number = 0;
  private nextSegmentTime: number = 0;
  private scheduleTimer: number | null = null;
  private speedMultiplier: number = 1.0;

  // Rastreio de osciladores ativos
  private activeOscillators = new Set<OscillatorNode>();
  private errorListeners = new Set<(message: string | null) => void>();
  private lastError: string | null = null;

  // Parâmetros de agendamento (A Tale of Two Clocks)
  private readonly LOOKAHEAD_MS = 25;
  private readonly SCHEDULE_AHEAD_SEC = 0.1;

  private initContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
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
      this.masterGain.gain.setTargetAtTime(muted ? 0 : this.volume, this.ctx.currentTime, 0.015);
    }
  }

  public setVolume(volume: number): void {
    this.volume = Number.isFinite(volume) ? Math.min(MAX_GAIN, Math.max(0, volume)) : 0;
    if (this.masterGain && this.ctx && !this.isMuted) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.015);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

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

  public setSpeed(multiplier: number): void {
    this.speedMultiplier = Math.max(0.1, multiplier);
  }

  // --- CONTROLES DE REPRODUÇÃO ---

  public pause(): void {
    this.isPlaying = false;
    if (this.ctx && this.ctx.state === 'running' && typeof this.ctx.suspend === 'function') {
      void this.ctx.suspend();
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

    this.stopPlayback();
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

      this.stopPlayback();

      if (this.ctx) {
        this.nextSegmentTime = this.ctx.currentTime;
      }

      if (this.isPlaying) {
        if (this.scheduleTimer) window.clearTimeout(this.scheduleTimer);
        this.scheduler();
      }
    }
  }

  public stopPlayback(): void {
    if (!this.ctx) return;
    for (const oscillator of this.activeOscillators) {
      try {
        oscillator.stop(this.ctx.currentTime);
      } catch {
        // Oscillatoros que já terminaram
      }
      oscillator.disconnect();
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

  /**
   * Executa a sonificação de um conjunto de parâmetros imediatamente.
   */
  public playParams(params: SonificationParams): void {
    if (this.isMuted) return;
    const ctx = this.initContext();
    this.scheduleParams(params, ctx.currentTime);
  }

  // --- SÍNTESE DE ÁUDIO ---

  private scheduleParams(params: SonificationParams, startTime: number): void {
    if (!this.ctx) return;

    if (params.isMissing) {
      this.playAlertTone(this.ctx, startTime, params.durationMs / 1000);
      return;
    }

    const pulseInterval = (params.durationMs / 1000) / params.pulseCount;
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

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(0.3, peakTime);
    gain.gain.setValueAtTime(0.3, startTime + duration - releaseTime);
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

  /**
   * Sinal acústico de advertência para dados faltantes.
   */
  private playAlertTone(ctx: AudioContext, startTime: number, duration: number): void {
    const interval = duration / 3;
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = startTime + i * interval;
      const pulse = interval * 0.6;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(FREQ_ALERT, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.2, start + Math.min(0.02, pulse / 3));
      gain.gain.exponentialRampToValueAtTime(0.0001, start + pulse);
      osc.connect(gain);
      this.masterGain && gain.connect(this.masterGain);
      osc.start(start);
      this.activeOscillators.add(osc);
      osc.addEventListener('ended', () => {
        this.activeOscillators.delete(osc);
        osc.disconnect();
        gain.disconnect();
      }, { once: true });
      osc.stop(start + pulse);
    }
  }

  public dispose(): void {
    this.pause();
    this.stopPlayback();
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
