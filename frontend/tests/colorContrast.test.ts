import { describe, expect, it } from 'vitest';
import { contrastRatio, relativeLuminance } from '../src/utils/colorContrast';

describe('contraste de cores (WCAG)', () => {
  it('preto sobre branco é 21:1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
  });

  it('a mesma cor tem contraste 1:1', () => {
    expect(contrastRatio('#336699', '#336699')).toBeCloseTo(1, 5);
  });

  it('#767676 é o cinza mais claro que passa de 4,5:1 sobre branco', () => {
    expect(contrastRatio('#767676', '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#777777', '#ffffff')).toBeLessThan(4.5);
  });

  it('rejeita cores inválidas', () => {
    expect(() => relativeLuminance('azul')).toThrow();
  });
});