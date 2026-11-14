import { useEffect } from 'react';

export type ShortcutAction =
  | 'togglePlay'
  | 'nextStep'
  | 'prevStep'
  | 'firstStep'
  | 'lastStep'
  | 'toggleMute'
  | 'toggleLoop'
  | 'openShortcuts';

export interface ShortcutEventLike {
  code: string;
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  repeat: boolean;
  getModifierState?: (key: string) => boolean;
}

interface ClosestCapable {
  closest: (selector: string) => unknown;
}

export const EDITABLE_SELECTOR = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';
export const ACTIVATABLE_SELECTOR = 'button, a[href], summary, [role="button"], [role="link"]';
export const SLIDER_SELECTOR = '[role="slider"]';

const SLIDER_OWNED_CODES = new Set(['ArrowLeft', 'ArrowRight', 'Home', 'End']);

function hasClosest(target: EventTarget | null): target is EventTarget & ClosestCapable {
  return target !== null && typeof (target as Partial<ClosestCapable>).closest === 'function';
}

/**
 * Decide se um atalho global deve ser ignorado para o alvo do evento.
 * Evita sequestrar teclas de controles nativos (botões, campos, slider) e de combinações do sistema.
 */
export function shouldIgnoreShortcut(target: EventTarget | null, event: ShortcutEventLike): boolean {
  if (event.repeat || event.metaKey) return true;

  if (event.ctrlKey || event.altKey) {
    // Em teclados ABNT2/Windows, "?" via AltGr chega com ctrlKey e altKey verdadeiros.
    const isAltGrQuestionMark = event.key === '?' && event.getModifierState?.('AltGraph') === true;
    if (!isAltGrQuestionMark) return true;
  }

  if (!hasClosest(target)) return false;

  if (target.closest(EDITABLE_SELECTOR)) return true;
  if (event.code === 'Space' && target.closest(ACTIVATABLE_SELECTOR)) return true;
  if (SLIDER_OWNED_CODES.has(event.code) && target.closest(SLIDER_SELECTOR)) return true;

  return false;
}

export function resolveShortcutAction(event: Pick<ShortcutEventLike, 'code' | 'key'>): ShortcutAction | null {
  if (event.key === '?') return 'openShortcuts';
  switch (event.code) {
    case 'Space':
      return 'togglePlay';
    case 'ArrowRight':
      return 'nextStep';
    case 'ArrowLeft':
      return 'prevStep';
    case 'Home':
      return 'firstStep';
    case 'End':
      return 'lastStep';
    case 'KeyM':
      return 'toggleMute';
    case 'KeyL':
      return 'toggleLoop';
    default:
      return null;
  }
}

interface UseKeyboardShortcutsProps {
  onTogglePlay: () => void;
  onNextStep: () => void;
  onPrevStep: () => void;
  onToggleMute: () => void;
  onFirstStep?: () => void;
  onLastStep?: () => void;
  onToggleLoop?: () => void;
  onOpenShortcuts?: () => void;
  enabled?: boolean;
}

export function useKeyboardShortcuts({
  onTogglePlay,
  onNextStep,
  onPrevStep,
  onToggleMute,
  onFirstStep,
  onLastStep,
  onToggleLoop,
  onOpenShortcuts,
  enabled = true
}: UseKeyboardShortcutsProps) {
  useEffect(() => {
    if (!enabled) return;

    const handlers: Record<ShortcutAction, (() => void) | undefined> = {
      togglePlay: onTogglePlay,
      nextStep: onNextStep,
      prevStep: onPrevStep,
      firstStep: onFirstStep,
      lastStep: onLastStep,
      toggleMute: onToggleMute,
      toggleLoop: onToggleLoop,
      openShortcuts: onOpenShortcuts
    };

    function handleKeyDown(event: KeyboardEvent) {
      if (shouldIgnoreShortcut(event.target, event)) return;

      const action = resolveShortcutAction(event);
      const handler = action ? handlers[action] : undefined;
      if (!handler) return;

      event.preventDefault();
      handler();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    enabled,
    onTogglePlay,
    onNextStep,
    onPrevStep,
    onToggleMute,
    onFirstStep,
    onLastStep,
    onToggleLoop,
    onOpenShortcuts
  ]);
}
