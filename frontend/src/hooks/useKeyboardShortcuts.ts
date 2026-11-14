import { useEffect } from 'react';

interface UseKeyboardShortcutsProps {
  onTogglePlay: () => void;
  onNextStep: () => void;
  onPrevStep: () => void;
  onToggleMute: () => void;
}

export function useKeyboardShortcuts({
  onTogglePlay,
  onNextStep,
  onPrevStep,
  onToggleMute
}: UseKeyboardShortcutsProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Ignorar se o usuário estiver digitando em campos de texto
      const target = event.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        return;
      }

      switch (event.code) {
        case 'Space':
          event.preventDefault();
          onTogglePlay();
          break;
        case 'ArrowRight':
          event.preventDefault();
          onNextStep();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          onPrevStep();
          break;
        case 'KeyM':
          event.preventDefault();
          onToggleMute();
          break;
        default:
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onTogglePlay, onNextStep, onPrevStep, onToggleMute]);
}
