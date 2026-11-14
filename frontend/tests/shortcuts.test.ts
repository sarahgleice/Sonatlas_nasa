import { describe, it, expect } from 'vitest';
import {
  shouldIgnoreShortcut,
  resolveShortcutAction,
  ShortcutEventLike
} from '../src/hooks/useKeyboardShortcuts';

function makeEvent(overrides: Partial<ShortcutEventLike> = {}): ShortcutEventLike {
  return {
    code: 'Space',
    key: ' ',
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    repeat: false,
    ...overrides
  };
}

/** Alvo simulado: `closest` responde verdadeiro quando o seletor menciona alguma das etiquetas informadas. */
function makeTarget(...matches: string[]): EventTarget {
  const target = new EventTarget();
  Object.defineProperty(target, 'closest', {
    value: (selector: string) => (matches.some((match) => selector.includes(match)) ? {} : null)
  });
  return target;
}

describe('shouldIgnoreShortcut', () => {
  it('não ignora Espaço quando o foco está no corpo da página', () => {
    expect(shouldIgnoreShortcut(makeTarget(), makeEvent())).toBe(false);
    expect(shouldIgnoreShortcut(null, makeEvent())).toBe(false);
  });

  it('ignora Espaço sobre botão, link, summary e role=button para preservar a ativação nativa', () => {
    expect(shouldIgnoreShortcut(makeTarget('button'), makeEvent())).toBe(true);
    expect(shouldIgnoreShortcut(makeTarget('a[href]'), makeEvent())).toBe(true);
    expect(shouldIgnoreShortcut(makeTarget('summary'), makeEvent())).toBe(true);
    expect(shouldIgnoreShortcut(makeTarget('[role="button"]'), makeEvent())).toBe(true);
  });

  it('ignora qualquer tecla em campos editáveis e selects', () => {
    expect(shouldIgnoreShortcut(makeTarget('input'), makeEvent({ code: 'KeyM', key: 'm' }))).toBe(true);
    expect(shouldIgnoreShortcut(makeTarget('select'), makeEvent({ code: 'ArrowRight', key: 'ArrowRight' }))).toBe(true);
  });

  it('ignora setas, Home e End no slider, mas não o Espaço', () => {
    const slider = makeTarget('[role="slider"]');
    for (const code of ['ArrowLeft', 'ArrowRight', 'Home', 'End']) {
      expect(shouldIgnoreShortcut(slider, makeEvent({ code, key: code }))).toBe(true);
    }
    expect(shouldIgnoreShortcut(slider, makeEvent({ code: 'Space', key: ' ' }))).toBe(false);
  });

  it('ignora combinações com Ctrl, Alt ou Meta e teclas repetidas', () => {
    expect(shouldIgnoreShortcut(makeTarget(), makeEvent({ ctrlKey: true }))).toBe(true);
    expect(shouldIgnoreShortcut(makeTarget(), makeEvent({ altKey: true }))).toBe(true);
    expect(shouldIgnoreShortcut(makeTarget(), makeEvent({ metaKey: true }))).toBe(true);
    expect(shouldIgnoreShortcut(makeTarget(), makeEvent({ repeat: true }))).toBe(true);
  });

  it('aceita "?" digitado via AltGr (ABNT2/Windows envia ctrl+alt)', () => {
    const altGr = makeEvent({
      code: 'KeyW',
      key: '?',
      ctrlKey: true,
      altKey: true,
      getModifierState: (key) => key === 'AltGraph'
    });
    expect(shouldIgnoreShortcut(makeTarget(), altGr)).toBe(false);

    const ctrlAlt = makeEvent({ code: 'KeyW', key: '?', ctrlKey: true, altKey: true });
    expect(shouldIgnoreShortcut(makeTarget(), ctrlAlt)).toBe(true);
  });
});

describe('resolveShortcutAction', () => {
  it('mapeia as teclas documentadas', () => {
    expect(resolveShortcutAction({ code: 'Space', key: ' ' })).toBe('togglePlay');
    expect(resolveShortcutAction({ code: 'ArrowRight', key: 'ArrowRight' })).toBe('nextStep');
    expect(resolveShortcutAction({ code: 'ArrowLeft', key: 'ArrowLeft' })).toBe('prevStep');
    expect(resolveShortcutAction({ code: 'Home', key: 'Home' })).toBe('firstStep');
    expect(resolveShortcutAction({ code: 'End', key: 'End' })).toBe('lastStep');
    expect(resolveShortcutAction({ code: 'KeyM', key: 'm' })).toBe('toggleMute');
    expect(resolveShortcutAction({ code: 'KeyL', key: 'l' })).toBe('toggleLoop');
    expect(resolveShortcutAction({ code: 'Slash', key: '?' })).toBe('openShortcuts');
  });

  it('não mapeia teclas fora da especificação', () => {
    expect(resolveShortcutAction({ code: 'KeyK', key: 'k' })).toBeNull();
    expect(resolveShortcutAction({ code: 'Escape', key: 'Escape' })).toBeNull();
  });
});
