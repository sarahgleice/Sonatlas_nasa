/**
 * Volume do jukebox sonoro.
 * O slider trabalha em "nível" de 0 a 1. O ganho enviado ao motor de áudio é
 * proporcional ao nível, com um teto de segurança (MAX_GAIN), porque os tons
 * de alerta da sonificação são agudos e podem incomodar em volume alto.
 */
export const MAX_GAIN = 0.6;

/** Nível padrão: equivale ao ganho fixo de 0,3 que o motor usa hoje. */
export const DEFAULT_VOLUME_LEVEL = 0.5;

export function clampLevel(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function levelToGain(level: number): number {
  return clampLevel(level) * MAX_GAIN;
}

/** Inverso de levelToGain: converte o ganho atual do motor em nível do slider. */
export function gainToLevel(gain: number): number {
  return clampLevel(gain / MAX_GAIN);
}

export function levelToPercent(level: number): number {
  return Math.round(clampLevel(level) * 100);
}