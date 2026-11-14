import { SonificationParams } from '../types/dataset';

/**
 * Motor nativo de áudio para síntese em tempo real via Web Audio API.
 * Não requer bibliotecas externas pesadas e funciona em qualquer navegador moderno.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isMuted: boolean = false;

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

  /**
   * Executa a sonificação de um conjunto de parâmetros (frequência + pulsos).
   */
  public playParams(params: SonificationParams): void {
    if (this.isMuted) return;
    const ctx = this.initContext();
    const now = ctx.currentTime;
    const totalDurationSec = params.durationMs / 1000;

    if (params.isMissing) {
      // Sinal de dado ausente: dois pulsos suaves em onda quadrada atenuada
      this.playAlertTone(ctx, now);
      return;
    }

    const pulseInterval = totalDurationSec / params.pulseCount;
    const pulseActiveDuration = Math.min(pulseInterval * 0.65, 0.25);

    for (let i = 0; i < params.pulseCount; i++) {
      const pulseStart = now + i * pulseInterval;
      this.synthesizePulse(ctx, params.frequency, pulseStart, pulseActiveDuration);
    }
  }

  /**
   * Sintetiza um pulso tonal individual com envoltória suave de ganho para evitar cliques.
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

    // Envoltória ADSR suave (Attack e Release)
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
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close();
      this.ctx = null;
    }
  }
}

// Instância singleton para uso em toda a aplicação
export const globalAudioEngine = new AudioEngine();
