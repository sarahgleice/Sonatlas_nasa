import React from 'react';
import { X } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-modal-title"
      className="modal-backdrop"
      onClick={onClose}
    >
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="shortcuts-modal-title" className="modal-title">
            Ajuda e atalhos de teclado
          </h2>
          <button
            onClick={onClose}
            className="btn-close"
            aria-label="Fechar janela de atalhos de teclado"
          >
            <X size={20} />
          </button>
        </div>

        <ul className="shortcuts-list">
          <li>
            <kbd>Espaço</kbd>
            <span>Alternar Reproduzir / Pausar a sonificação</span>
          </li>
          <li>
            <kbd>→</kbd>
            <span>Avançar um passo temporal</span>
          </li>
          <li>
            <kbd>←</kbd>
            <span>Retroceder um passo temporal</span>
          </li>
          <li>
            <kbd>M</kbd>
            <span>Silenciar / Ativar áudio</span>
          </li>
          <li>
            <kbd>Tab</kbd>
            <span>Navegar para o próximo elemento interativo</span>
          </li>
          <li>
            <kbd>Shift + Tab</kbd>
            <span>Retornar ao elemento anterior</span>
          </li>
        </ul>

        <div className="modal-footer">
          <button
            onClick={onClose}
            className="btn btn-primary"
            autoFocus
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
