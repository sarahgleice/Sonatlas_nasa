import React from 'react';
import { HelpCircle, Keyboard, Volume2 } from 'lucide-react';

interface HeaderProps {
  onOpenEducational: () => void;
  onOpenShortcuts: () => void;
  onOpenAccessibility?: () => void;
  onListenObjective?: () => void;
  objectiveAudioDisabled?: boolean;
  voiceEnabled?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenEducational,
  onOpenShortcuts,
  onOpenAccessibility = () => undefined,
  onListenObjective = () => undefined,
  objectiveAudioDisabled = false,
  voiceEnabled = false
}) => {
  return (
    <header className="app-header" role="banner">
      <div className="header-container">
        <div className="brand-lockup">
          <a className="logo-title" href="#main-content" aria-label="Sonatlas, início do explorador">sonatlas<span>.</span></a>
          <span className="product-label">EARTH EXPLORER</span>
        </div>

        <nav className="header-nav" aria-label="Informações do projeto e ajuda">
          <a href="#about">Sobre o projeto</a>
          <button
            type="button"
            onClick={onOpenAccessibility}
            className="btn btn-secondary btn-sm"
            aria-haspopup="dialog"
            aria-label={voiceEnabled ? 'Preferências de acessibilidade. Narração por voz ativada.' : 'Abrir preferências de acessibilidade'}
          >
            <span>Acessibilidade</span>
            {voiceEnabled && <span className="accessibility-voice-active">Voz ativa</span>}
          </button>
          <button
            type="button"
            onClick={onListenObjective}
            className="btn btn-secondary btn-sm"
            disabled={objectiveAudioDisabled}
            aria-label="Ouvir o objetivo do Sonatlas"
            title={objectiveAudioDisabled ? 'Voz indisponível ou sonificação em reprodução' : 'Ouvir o objetivo do Sonatlas'}
          >
            <Volume2 size={16} aria-hidden="true" />
            <span>Ouvir objetivo</span>
          </button>
          <button
            type="button"
            onClick={onOpenShortcuts}
            className="btn btn-secondary btn-sm"
            aria-haspopup="dialog"
            aria-keyshortcuts="?"
            aria-label="Abrir atalhos de teclado (tecla ?)"
          >
            <Keyboard size={18} aria-hidden="true" />
            <span>Atalhos</span>
          </button>
          <button
            type="button"
            onClick={onOpenEducational}
            className="btn btn-secondary btn-sm"
            aria-haspopup="dialog"
            aria-label="Abrir ajuda e informações científicas"
          >
            <HelpCircle size={18} aria-hidden="true" />
            <span>Ajuda</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
