import { TemporalObservation, SonificationParams } from '../types/dataset';
import { createObservationSonificationParams } from './sonificationMapping';

/**
 * Motor nativo de áudio para síntese em tempo real via Web Audio API.
 * Implementa agendamento preciso (Lookahead) para sequências temporais.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isMuted: boolean = false;

  // Estado de controle da sequência
  private isPlaying: boolean = false;
  private currentSequence: TemporalObservation[] = [];
  private currentIndex: number = 0;
  private nextSegmentTime: number = 0;
  private scheduleTimer: number | null = null;
  private speedMultiplier: number = 1.0;
  
  // Parâmetros de agendamento (A Tale of Two Clocks)
  private readonly LOOKAHEAD_MS = 25; // Frequência da checagem do loop
  private readonly SCHEDULE_AHEAD_SEC = 0.1; // Antecedência para agendar o nó de áudio

  private initContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
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
    if (!this.ctx) return;
    this.isPlaying = true;
    await this.ctx.resume();
    // Reprograma o próximo segmento para iniciar logo após o resume
    this.nextSegmentTime = this.ctx.currentTime + 0.1;
    this.scheduler();
  }

  /**
   * Inicia a reprodução de uma sequência de dados da NASA (IMERG).
   */
  public async playSequence(sequence: TemporalObservation[]): Promise<void> {
    if (this.isMuted) return;
    const ctx = this.initContext();
    
    this.currentSequence = sequence;
    this.currentIndex = 0;
    this.isPlaying = true;
    
    await ctx.resume();
    this.nextSegmentTime = ctx.currentTime + 0.1;
    this.scheduler();
  }

  /**
   * Loop de agendamento que mantém a UI livre e delega a precisão para o Web Audio API.
   * Pedro (Player) vai consumir o estado currentIndex para sincronizar a linha do tempo.
   */
  private scheduler = (): void => {
    if (!this.isPlaying || !this.ctx) return;

    while (this.nextSegmentTime < this.ctx.currentTime + this.SCHEDULE_AHEAD_SEC && this.currentIndex < this.currentSequence.length) {
      const obs = this.currentSequence[this.currentIndex];
      
      // Duração base de 1.5s ajustada pela velocidade atual
      const baseDurationMs = 1500; 
      const adjustedDurationMs = baseDurationMs / this.speedMultiplier;
      
      // Mapeamento extrai os parâmetros da observação atual
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
   * Executa a sonificação distribuindo os pulsos no tempo agendado.
   */
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

  /**
   * Sintetiza um pulso tonal individual com envoltória suave de ganho.
   */
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
    if (this.masterGain) {
      gain.connect(this.masterGain);
    }

    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  /**
   * Sinal acústico de advertência para dados faltantes.
   */
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
    if (this.masterGain) {
      gain.connect(this.masterGain);
    }

    osc.start(startTime);
    osc.stop(startTime + 0.4);
  }

  public dispose(): void {
    this.pause();
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close();
      this.ctx = null;
    }
  }
}

export const globalAudioEngine = new AudioEngine();