import { useCallback, useEffect, useRef } from 'react';
import type { MouseEvent } from 'react';

/**
 * Controla um <dialog> nativo aberto com showModal():
 * - o navegador cuida do focus trap, da inertização do fundo e do fechamento por Esc;
 * - o foco volta explicitamente ao elemento que abriu o diálogo;
 * - clicar no ::backdrop (o próprio <dialog>, que deve ter padding 0) fecha o diálogo.
 */
export function useModalDialog(isOpen: boolean, onClose: () => void) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    onClose();
    const trigger = triggerRef.current;
    triggerRef.current = null;
    if (trigger && trigger.isConnected) {
      trigger.focus();
    }
  }, [onClose]);

  const handleBackdropClick = useCallback((event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === dialogRef.current) {
      dialogRef.current?.close();
    }
  }, []);

  const requestClose = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  return { dialogRef, handleClose, handleBackdropClick, requestClose };
}
