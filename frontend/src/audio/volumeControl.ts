import { DEFAULT_VOLUME_LEVEL, clampLevel, gainToLevel, levelToGain } from '../utils/volume';

/** Parte do AudioEngine da Hazel que o slider usa (setVolume/getVolume). */
export interface VolumeCapableEngine {
  setVolume(gain: number): void;
  getVolume(): number;
}

/**
 * Diz se o motor de áudio já tem controle de volume. Enquanto a função da Hazel
 * não estiver na main, devolve false e o slider fica escondido.
 */
export function isVolumeCapable(engine: unknown): engine is VolumeCapableEngine {
  if (typeof engine !== 'object' || engine === null) return false;
  const candidate = engine as Record<string, unknown>;
  return typeof candidate.setVolume === 'function' && typeof candidate.getVolume === 'function';
}

/** Nível do slider (0 a 1) correspondente ao ganho atual do motor. */
export function readVolumeLevel(engine: unknown): number {
  if (!isVolumeCapable(engine)) return DEFAULT_VOLUME_LEVEL;
  return gainToLevel(engine.getVolume());
}

/** Aplica o nível do slider ao motor. Devolve false se o motor não suporta volume. */
export function applyVolumeLevel(engine: unknown, level: number): boolean {
  if (!isVolumeCapable(engine)) return false;
  engine.setVolume(levelToGain(clampLevel(level)));
  return true;
}