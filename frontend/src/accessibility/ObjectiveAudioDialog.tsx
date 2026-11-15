import React from 'react';
import { Volume2 } from 'lucide-react';
import { useModalDialog } from './useModalDialog';

interface ObjectiveAudioDialogProps {
  isOpen: boolean;
  voiceSupported: boolean;
  onListen: () => void;
  onClose: () => void;
}

export const ObjectiveAudioDialog: React.FC<ObjectiveAudioDialogProps> = ({
  isOpen,
  voiceSupported,
  onListen,
  onClose
}) => {
  const { dialogRef, handleClose, handleBackdropClick, requestClose } = useModalDialog(isOpen, onClose);

  return (
    <dialog
      ref={dialogRef}
      className="shortcuts-dialog"
      aria-labelledby="objective-audio-title"
      aria-describedby="objective-audio-description"
      onClose={handleClose}
      onClick={handleBackdropClick}
    >
      <div className="dialog-surface">
        <div className="modal-header">
          <h2 id="objective-audio-title" className="modal-title">Quer ouvir o objetivo do Sonatlas?</h2>
        </div>
        <p id="objective-audio-description">
          Uma explicação breve apresenta o projeto e como os dados de precipitação são representados pelo som.
        </p>
        {!voiceSupported && (
          <p className="accessibility-voice-status" role="status">
            A narração por voz não está disponível neste navegador. Você pode continuar usando o app normalmente.
          </p>
        )}
        <div className="modal-footer accessibility-dialog-actions">
          <button type="button" onClick={requestClose} className="btn btn-secondary">Não, continuar</button>
          <button
            type="button"
            onClick={() => {
              onListen();
              requestClose();
            }}
            className="btn btn-primary"
            disabled={!voiceSupported}
          >
            <Volume2 size={16} aria-hidden="true" />
            <span>Sim, ouvir agora</span>
          </button>
        </div>
      </div>
    </dialog>
  );
};
