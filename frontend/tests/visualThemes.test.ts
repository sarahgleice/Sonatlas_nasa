import { describe, expect, it } from 'vitest';
import { contrastRatio } from '../src/utils/colorContrast';
import {
  ALL_CSS_VARS,
  CONTRASTS,
  PALETTES,
  parseVisualPreferences,
  resolveTheme,
} from '../src/accessibility/visualThemes';

const SURFACES = ['background', 'panel', 'raised'] as const;
const TEXT_ROLES = ['text', 'muted', 'focus', 'map', 'success', 'warning', 'danger'] as const;

const CASES = PALETTES.flatMap((palette) => CONTRASTS.map((contrast) => ({ palette, contrast })));

describe.each(CASES)('tema $palette com contraste $contrast', ({ palette, contrast }) => {
  const { colors } = resolveTheme({ palette, contrast });
  const minimum = contrast === 'high' ? 7 : 4.5;

  it.each([...TEXT_ROLES])('%s tem contraste suficiente sobre todas as superfícies', (role) => {
    SURFACES.forEach((surface) => {
      expect(contrastRatio(colors[role], colors[surface]), `${role} sobre ${surface}`).toBeGreaterThanOrEqual(
        minimum,
      );
    });
  });

  it('o texto tem contraste suficiente sobre o botão de som', () => {
    expect(contrastRatio(colors.text, colors.soundAction)).toBeGreaterThanOrEqual(minimum);
  });

  it('a borda é visível no alto contraste', () => {
    if (contrast === 'high') {
      expect(contrastRatio(colors.border, colors.background)).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('estrutura dos temas', () => {
  it('o tema padrão não sobrescreve nenhuma variável', () => {
    expect(resolveTheme({ palette: 'default', contrast: 'normal' }).cssVars).toEqual({});
  });

  it('os demais temas definem todas as variáveis de cor', () => {
    CASES.filter((c) => !(c.palette === 'default' && c.contrast === 'normal')).forEach((c) => {
      expect(Object.keys(resolveTheme(c).cssVars).sort()).toEqual([...ALL_CSS_VARS].sort());
    });
  });

  it('a paleta monocromática usa somente tons de cinza', () => {
    CONTRASTS.forEach((contrast) => {
      const { colors } = resolveTheme({ palette: 'monochrome', contrast });
      Object.values(colors).forEach((value) => {
        const r = value.slice(1, 3).toLowerCase();
        const g = value.slice(3, 5).toLowerCase();
        const b = value.slice(5, 7).toLowerCase();
        expect(r === g && g === b, value).toBe(true);
      });
    });
  });

  it('nos modos de daltonismo e monocromático as regiões se distinguem pelo traço, não só pela cor', () => {
    (['colorblind', 'monochrome'] as const).forEach((palette) => {
      const { map } = resolveTheme({ palette, contrast: 'normal' });
      const tracos = new Set([
        map.regionA.dashArray ?? 'cheio',
        map.regionB.dashArray ?? 'cheio',
        map.candidate.dashArray ?? 'cheio',
      ]);
      expect(tracos.size).toBe(3);
    });
  });
});

describe('leitura da preferência salva', () => {
  const padrao = { palette: 'default', contrast: 'normal' };

  it('sem valor salvo usa o padrão', () => {
    expect(parseVisualPreferences(null)).toEqual(padrao);
  });

  it('sem valor salvo, o sistema pedindo mais contraste liga o alto contraste', () => {
    expect(parseVisualPreferences(null, true)).toEqual({ palette: 'default', contrast: 'high' });
  });

  it('a escolha salva vale mais que a preferência do sistema', () => {
    expect(parseVisualPreferences('{"palette":"default","contrast":"normal"}', true)).toEqual(padrao);
  });

  it('lê uma preferência válida', () => {
    expect(parseVisualPreferences('{"palette":"colorblind","contrast":"high"}')).toEqual({
      palette: 'colorblind',
      contrast: 'high',
    });
  });

  it('valores inválidos voltam ao padrão', () => {
    expect(parseVisualPreferences('lixo')).toEqual(padrao);
    expect(parseVisualPreferences('null')).toEqual(padrao);
    expect(parseVisualPreferences('{"palette":"neon","contrast":"normal"}')).toEqual(padrao);
  });
});