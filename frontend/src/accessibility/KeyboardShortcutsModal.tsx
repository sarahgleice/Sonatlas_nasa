import React from 'react';
import { X } from 'lucide-react';
import { SHORTCUTS } from '../types/player';
import { useModalDialog } from './useModalDialog';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose
}) => {
  const { dialogRef, handleClose, handleBackdropClick, requestClose } = useModalDialog(isOpen, onClose);

  return (
    <dialog
      ref={dialogRef}
      className="shortcuts-dialog"
      aria-labelledby="shortcuts-modal-title"
      onClose={handleClose}
      onClick={handleBackdropClick}
    >
      <div className="dialog-surface">
        <div className="modal-header">
          <h2 id="shortcuts-modal-title" className="modal-title">
            Atalhos de teclado
          </h2>
          <button
            type="button"
            onClick={requestClose}
            className="btn-close"
            aria-label="Fechar janela de atalhos de teclado"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <ul className="shortcuts-list">
          {SHORTCUTS.map((shortcut) => (
            <li key={shortcut.keys}>
              <kbd>{shortcut.keys}</kbd>
              <span>{shortcut.description}</span>
            </li>
          ))}
        </ul>

        <p className="shortcuts-note">
          Usuários de NVDA ou JAWS: no modo de navegação, ative o modo de foco (NVDA + Espaço) para que
          os atalhos de reprodução cheguem à página; os botões também funcionam com Enter e Espaço.
        </p>

        <div className="modal-footer">
          <button type="button" onClick={requestClose} className="btn btn-primary">
            Entendido
          </button>
        </div>
      </div>
    </dialog>
  );
};
