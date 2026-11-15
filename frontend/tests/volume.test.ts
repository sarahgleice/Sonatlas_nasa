import { describe, expect, it } from 'vitest';
import {
  DEFAULT_VOLUME_LEVEL,
  MAX_GAIN,
  clampLevel,
  levelToGain,
  levelToPercent,
} from '../src/utils/volume';

describe('volume', () => {
  it('o nível padrão equivale ao ganho atual do motor (0,3)', () => {
    expect(levelToGain(DEFAULT_VOLUME_LEVEL)).toBeCloseTo(0.3);
  });

  it('0 é silêncio e 1 é o ganho máximo', () => {
    expect(levelToGain(0)).toBe(0);
    expect(levelToGain(1)).toBeCloseTo(MAX_GAIN);
  });

  it('limita valores fora de 0 a 1', () => {
    expect(clampLevel(-0.5)).toBe(0);
    expect(clampLevel(3)).toBe(1);
  });

  it('valores inválidos viram 0', () => {
    expect(clampLevel(Number.NaN)).toBe(0);
    expect(clampLevel(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('converte nível em porcentagem inteira', () => {
    expect(levelToPercent(0.5)).toBe(50);
    expect(levelToPercent(0.333)).toBe(33);
  });
});