import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="app-footer" role="contentinfo">
      <div className="footer-container">
        <p>
          <strong>SONATLAS</strong> — Desenvolvido para o <em>NASA Space Apps Challenge 2026</em> no desafio <em>The Earth Information Jukebox</em>.
        </p>
        <p className="footer-meta">
          Fonte de Dados Candidata: <strong>NASA GPM / IMERG V07</strong> via GES DISC.
          Os dados demonstrativos são etiquetados explicitamente como amostras técnicas de validação.
        </p>
        <p className="footer-copy">
          Licença MIT. Foco prioritário em acessibilidade e inclusão digital de pessoas cegas ou com baixa visão.
        </p>
      </div>
    </footer>
  );
};
