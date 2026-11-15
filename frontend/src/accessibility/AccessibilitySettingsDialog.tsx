import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useModalDialog } from './useModalDialog';
import { VisualPreferencesControls } from './VisualPreferencesControls';

interface AccessibilitySettingsDialogProps {
  isOpen: boolean;
  voiceEnabled: boolean;
  voiceSupported: boolean;
  onSave: (voiceEnabled: boolean) => void;
  onClose: () => void;
}

export const AccessibilitySettingsDialog: React.FC<AccessibilitySettingsDialogProps> = ({
  isOpen,
  voiceEnabled,
  voiceSupported,
  onSave,
  onClose
}) => {
  const [draftVoiceEnabled, setDraftVoiceEnabled] = useState(voiceEnabled);
  const { dialogRef, handleClose, handleBackdropClick, requestClose } = useModalDialog(isOpen, onClose);

  useEffect(() => {
    if (isOpen) setDraftVoiceEnabled(voiceEnabled);
  }, [isOpen, voiceEnabled]);

  return (
    <dialog
      ref={dialogRef}
      className="shortcuts-dialog"
      aria-labelledby="accessibility-dialog-title"
      aria-describedby="accessibility-dialog-description"
      onClose={handleClose}
      onClick={handleBackdropClick}
    >
      <div className="dialog-surface">
        <div className="modal-header">
          <h2 id="accessibility-dialog-title" className="modal-title">Precisa de recursos de acessibilidade?</h2>
          <button type="button" onClick={requestClose} className="btn-close" aria-label="Fechar preferências de acessibilidade">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <p id="accessibility-dialog-description">
          O Sonatlas funciona com teclado e leitores de tela. Você também pode ativar a narração falada dos dados selecionados e ajustar as cores e o contraste da interface.        </p>

        <label className="accessibility-voice-option" htmlFor="voice-narration-enabled">
          <input
            id="voice-narration-enabled"
            type="checkbox"
            autoFocus
            checked={draftVoiceEnabled}
            disabled={!voiceSupported}
            onChange={(event) => setDraftVoiceEnabled(event.target.checked)}
          />
          <span>
            <strong>Narrar dados e mensagens em voz alta</strong>
            <span className="form-helper">A voz acompanha mudanças manuais de período. Durante a reprodução contínua, pause para ouvir a descrição da etapa sem sobrepor a sonificação.</span>
          </span>
        </label>

        {!voiceSupported && (
          <p className="accessibility-voice-status" role="status">
            A síntese de fala não está disponível neste navegador. Os controles de teclado e leitores de tela continuam disponíveis.
          </p>
        )}

        <VisualPreferencesControls />

        <div className="modal-footer accessibility-dialog-actions">
          <button type="button" onClick={requestClose} className="btn btn-secondary">Agora não</button>
          <button type="button" onClick={() => onSave(draftVoiceEnabled)} className="btn btn-primary">Salvar preferência</button>
        </div>
      </div>
    </dialog>
  );
};
