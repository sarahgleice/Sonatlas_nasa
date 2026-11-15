import { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  ALL_CSS_VARS,
  parseVisualPreferences,
  resolveTheme,
  type Contrast,
  type Palette,
  type VisualPreferences,
} from './visualThemes';

export const VISUAL_PREFERENCES_STORAGE_KEY = 'sonatlas.visualPreferences.v1';

function systemPrefersMoreContrast(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-contrast: more)').matches
    );
  } catch {
    return false;
  }
}

function readStored(): string | null {
  try {
    return typeof window !== 'undefined'
      ? window.localStorage.getItem(VISUAL_PREFERENCES_STORAGE_KEY)
      : null;
  } catch {
    return null;
  }
}

function writeStored(prefs: VisualPreferences): void {
  try {
    window.localStorage.setItem(VISUAL_PREFERENCES_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Navegação anônima ou armazenamento bloqueado: a preferência vale só nesta visita.
  }
}

/** Aplica a preferência no <html>: atributos data-* e variáveis de CSS. */
export function applyVisualPreferences(prefs: VisualPreferences, root?: HTMLElement): void {
  const target = root ?? (typeof document !== 'undefined' ? document.documentElement : null);
  if (!target) return;
  target.dataset.palette = prefs.palette;
  target.dataset.contrast = prefs.contrast;
  const { cssVars } = resolveTheme(prefs);
  ALL_CSS_VARS.forEach((name) => {
    const value = cssVars[name];
    if (value) target.style.setProperty(name, value);
    else target.style.removeProperty(name);
  });
}

let current: VisualPreferences = parseVisualPreferences(readStored(), systemPrefersMoreContrast());
const listeners = new Set<() => void>();

// Roda uma vez, quando o módulo é carregado (antes da primeira tela aparecer).
applyVisualPreferences(current);

export function getVisualPreferences(): VisualPreferences {
  return current;
}

export function setVisualPreferences(change: Partial<VisualPreferences>): void {
  const next: VisualPreferences = { ...current, ...change };
  if (next.palette === current.palette && next.contrast === current.contrast) return;
  current = next;
  writeStored(next);
  applyVisualPreferences(next);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useVisualPreferences() {
  const prefs = useSyncExternalStore(subscribe, getVisualPreferences, getVisualPreferences);
  const theme = useMemo(() => resolveTheme(prefs), [prefs]);
  const setPalette = useCallback((palette: Palette) => setVisualPreferences({ palette }), []);
  const setContrast = useCallback((contrast: Contrast) => setVisualPreferences({ contrast }), []);
  return {
    palette: prefs.palette,
    contrast: prefs.contrast,
    theme,
    /** Cores prontas para o mapa (o Leaflet não aceita var(--x)) */
    map: theme.map,
    setPalette,
    setContrast,
  };
}
