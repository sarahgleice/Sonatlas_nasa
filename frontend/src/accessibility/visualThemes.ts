export type Palette = 'default' | 'colorblind' | 'monochrome';
export type Contrast = 'normal' | 'high';

export interface VisualPreferences {
  palette: Palette;
  contrast: Contrast;
}

export const PALETTES: readonly Palette[] = ['default', 'colorblind', 'monochrome'];
export const CONTRASTS: readonly Contrast[] = ['normal', 'high'];

export const DEFAULT_VISUAL_PREFERENCES: VisualPreferences = {
  palette: 'default',
  contrast: 'normal',
};

export const PALETTE_LABELS: Record<Palette, string> = {
  default: 'Padrão',
  colorblind: 'Daltonismo (cores seguras)',
  monochrome: 'Monocromático',
};

export interface ThemeColors {
  background: string;
  panel: string;
  raised: string;
  border: string;
  map: string;
  sound: string;
  soundAction: string;
  success: string;
  text: string;
  muted: string;
  warning: string;
  danger: string;
  focus: string;
}

export interface RegionStyle {
  fill: string;
  stroke: string;
  /** Tracejado: separa as regiões também sem depender da cor */
  dashArray?: string;
}

/** Cores para o mapa (Leaflet não aceita var(--x)), pensadas para o mapa 2D de fundo claro. */
export interface MapTokens {
  regionA: RegionStyle;
  regionB: RegionStyle;
  candidate: RegionStyle;
  marker: string;
  strokeWeight: number;
  precipitation: {
    missing: string;
    dry: string;
    /** Faixas: < 0,5 · < 1 · < 2,5 · < 5 · ≥ 5 mm/h */
    steps: [string, string, string, string, string];
  };
}

export interface VisualTheme {
  colors: ThemeColors;
  /** Variáveis de CSS a sobrescrever. Vazio no tema padrão (vale o variables.css). */
  cssVars: Record<string, string>;
  map: MapTokens;
}

const CSS_VAR_BY_KEY: Record<keyof ThemeColors, string> = {
  background: '--color-background',
  panel: '--color-panel',
  raised: '--color-raised',
  border: '--color-border',
  map: '--color-map',
  sound: '--color-sound',
  soundAction: '--color-sound-action',
  success: '--color-success',
  text: '--color-text',
  muted: '--color-muted',
  warning: '--color-warning',
  danger: '--color-danger',
  focus: '--color-focus',
};

export const ALL_CSS_VARS: string[] = Object.values(CSS_VAR_BY_KEY);

// --- Cores (o tema padrão repete os valores atuais de styles/variables.css) ---

const DEFAULT_COLORS: ThemeColors = {
  background: '#080E1D',
  panel: '#101C30',
  raised: '#18283E',
  border: '#24364F',
  map: '#00D5F5',
  sound: '#8B5CF6',
  soundAction: '#7540D9',
  success: '#34D399',
  text: '#EAF4FF',
  muted: '#A2B5CF',
  warning: '#FBBF24',
  danger: '#FB7185',
  focus: '#67E8F9',
};

// Daltonismo: paleta Okabe-Ito (azul e laranja no lugar de verde e vermelho)
const COLORBLIND_COLORS: ThemeColors = {
  ...DEFAULT_COLORS,
  map: '#56B4E9',
  sound: '#E69F00',
  soundAction: '#005F9E',
  success: '#20C997',
  warning: '#F0E442',
  danger: '#FF8040',
};

const MONOCHROME_COLORS: ThemeColors = {
  background: '#0B0B0B',
  panel: '#151515',
  raised: '#202020',
  border: '#3A3A3A',
  map: '#F5F5F5',
  sound: '#CFCFCF',
  soundAction: '#5A5A5A',
  success: '#D0D0D0',
  text: '#F2F2F2',
  muted: '#BDBDBD',
  warning: '#E8E8E8',
  danger: '#FFFFFF',
  focus: '#FFFFFF',
};

const PALETTE_COLORS: Record<Palette, ThemeColors> = {
  default: DEFAULT_COLORS,
  colorblind: COLORBLIND_COLORS,
  monochrome: MONOCHROME_COLORS,
};

// Alto contraste: fundo preto, texto branco, bordas brancas
const HIGH_CONTRAST_NEUTRALS = {
  background: '#000000',
  panel: '#000000',
  raised: '#0D0D0D',
  border: '#FFFFFF',
  text: '#FFFFFF',
  muted: '#E6E6E6',
};

const HIGH_CONTRAST_ACCENTS: Record<
  Palette,
  Pick<ThemeColors, 'map' | 'sound' | 'soundAction' | 'success' | 'warning' | 'danger' | 'focus'>
> = {
  default: {
    map: '#00E5FF',
    sound: '#C4B5FD',
    soundAction: '#5B21B6',
    success: '#4ADE80',
    warning: '#FFE066',
    danger: '#FF8A8A',
    focus: '#FFFF00',
  },
  colorblind: {
    map: '#7FD4FF',
    sound: '#FFB84D',
    soundAction: '#004C80',
    success: '#5FE0B5',
    warning: '#FFF176',
    danger: '#FF9966',
    focus: '#FFFF00',
  },
  monochrome: {
    map: '#FFFFFF',
    sound: '#D9D9D9',
    soundAction: '#4D4D4D',
    success: '#E0E0E0',
    warning: '#F0F0F0',
    danger: '#FFFFFF',
    focus: '#FFFFFF',
  },
};

// --- Mapa (o padrão repete as cores atuais do MapView e do precipitationScale) ---

const DEFAULT_MAP: MapTokens = {
  regionA: { fill: '#38bdf8', stroke: '#0284c7' },
  regionB: { fill: '#34d399', stroke: '#059669' },
  candidate: { fill: '#f59e0b', stroke: '#f59e0b', dashArray: '8 6' },
  marker: '#ffffff',
  strokeWeight: 2,
  precipitation: {
    missing: '#64748b',
    dry: '#cbd5e1',
    steps: ['#a78bfa', '#818cf8', '#22d3ee', '#facc15', '#f97316'],
  },
};

const COLORBLIND_MAP: MapTokens = {
  regionA: { fill: '#56B4E9', stroke: '#0072B2' },
  regionB: { fill: '#E69F00', stroke: '#B36B00', dashArray: '10 6' },
  candidate: { fill: '#CC79A7', stroke: '#8E4B72', dashArray: '2 6' },
  marker: '#ffffff',
  strokeWeight: 3,
  precipitation: {
    missing: '#6B7280',
    dry: '#E5E7EB',
    // viridis: do claro (pouca chuva) ao escuro (muita chuva)
    steps: ['#FDE725', '#5EC962', '#21918C', '#3B528B', '#440154'],
  },
};

const MONOCHROME_MAP: MapTokens = {
  regionA: { fill: '#E0E0E0', stroke: '#1A1A1A' },
  regionB: { fill: '#8A8A8A', stroke: '#1A1A1A', dashArray: '10 6' },
  candidate: { fill: '#5C5C5C', stroke: '#1A1A1A', dashArray: '2 6' },
  marker: '#ffffff',
  strokeWeight: 3,
  precipitation: {
    missing: '#7A7A7A',
    dry: '#F5F5F5',
    steps: ['#D6D6D6', '#ADADAD', '#858585', '#575757', '#2B2B2B'],
  },
};

const PALETTE_MAP: Record<Palette, MapTokens> = {
  default: DEFAULT_MAP,
  colorblind: COLORBLIND_MAP,
  monochrome: MONOCHROME_MAP,
};

function toCssVars(colors: ThemeColors): Record<string, string> {
  const vars: Record<string, string> = {};
  (Object.keys(CSS_VAR_BY_KEY) as Array<keyof ThemeColors>).forEach((key) => {
    vars[CSS_VAR_BY_KEY[key]] = colors[key];
  });
  return vars;
}

export function resolveTheme(prefs: VisualPreferences): VisualTheme {
  const { palette, contrast } = prefs;
  let colors: ThemeColors = { ...PALETTE_COLORS[palette] };
  let map: MapTokens = PALETTE_MAP[palette];

  if (contrast === 'high') {
    colors = { ...colors, ...HIGH_CONTRAST_NEUTRALS, ...HIGH_CONTRAST_ACCENTS[palette] };
    // Borda preta e grossa: o mapa 2D tem fundo claro
    map = {
      ...map,
      strokeWeight: 4,
      regionA: { ...map.regionA, stroke: '#000000' },
      regionB: { ...map.regionB, stroke: '#000000' },
      candidate: { ...map.candidate, stroke: '#000000' },
    };
  }

  const isBase = palette === 'default' && contrast === 'normal';
  return { colors, cssVars: isBase ? {} : toCssVars(colors), map };
}

/** Lê o texto salvo no navegador. Qualquer valor inválido volta ao padrão. */
export function parseVisualPreferences(
  raw: string | null | undefined,
  systemPrefersMoreContrast = false,
): VisualPreferences {
  const fallback: VisualPreferences = {
    palette: 'default',
    contrast: systemPrefersMoreContrast ? 'high' : 'normal',
  };
  if (!raw) return fallback;
  try {
    const data = JSON.parse(raw) as { palette?: unknown; contrast?: unknown };
    const palette = PALETTES.find((p) => p === data.palette);
    const contrast = CONTRASTS.find((c) => c === data.contrast);
    if (!palette || !contrast) return fallback;
    return { palette, contrast };
  } catch {
    return fallback;
  }
}