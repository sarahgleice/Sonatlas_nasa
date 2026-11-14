import React from 'react';
import { Volume2, HelpCircle } from 'lucide-react';

interface HeaderProps {
  onOpenShortcuts: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenShortcuts }) => {
  return (
    <header className="app-header" role="banner">
      <div className="header-container">
        <div className="logo-group">
          <div className="logo-icon" aria-hidden="true">
            <Volume2 size={28} />
          </div>
          <div>
            <h1 className="logo-title">SONATLAS</h1>
            <p className="logo-subtitle">Explore Earth Through Sound — NASA Space Apps Challenge 2026</p>
          </div>
        </div>

        <nav className="header-nav" aria-label="Navegação principal">
          <a href="#region">Região</a>
          <a href="#map">Mapa</a>
          <a href="#indicators">Indicadores</a>
          <a href="#playback">Sonificação</a>
          <button
            onClick={onOpenShortcuts}
            className="btn btn-secondary btn-sm"
            aria-label="Abrir guia de atalhos de teclado"
          >
            <HelpCircle size={18} aria-hidden="true" />
            <span>Atalhos de Teclado</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
