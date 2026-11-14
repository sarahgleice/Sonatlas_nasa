import React from 'react';
import { HelpCircle } from 'lucide-react';

interface HeaderProps {
  onOpenEducational: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenEducational }) => {
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
