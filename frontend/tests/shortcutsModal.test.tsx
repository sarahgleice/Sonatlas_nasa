import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { KeyboardShortcutsModal } from '../src/accessibility/KeyboardShortcutsModal';
import { Header } from '../src/components/Header';
import { SHORTCUTS } from '../src/types/player';

describe('KeyboardShortcutsModal', () => {
  const html = renderToStaticMarkup(createElement(KeyboardShortcutsModal, { isOpen: false, onClose: () => undefined }));

  it('usa <dialog> nativo rotulado, fechado por padrão', () => {
    expect(html).toContain('<dialog');
    expect(html).toContain('aria-labelledby="shortcuts-modal-title"');
    expect(html).not.toContain(' open');
    expect(html).not.toContain('aria-modal');
  });

  it('lista todos os atalhos da fonte única SHORTCUTS', () => {
    for (const shortcut of SHORTCUTS) {
      expect(html).toContain(shortcut.description.replace(/&/g, '&amp;'));
    }
  });

  it('orienta usuários de NVDA/JAWS sobre o modo de foco', () => {
    expect(html).toContain('NVDA + Espaço');
  });

  it('o botão de fechar tem nome acessível e o ícone é decorativo', () => {
    expect(html).toContain('aria-label="Fechar janela de atalhos de teclado"');
    expect(html).toContain('aria-hidden="true"');
  });
});

describe('Header', () => {
  it('expõe o botão "Atalhos" com rótulo visível e tecla de atalho declarada', () => {
    const header = renderToStaticMarkup(
      createElement(Header, { onOpenEducational: () => undefined, onOpenShortcuts: () => undefined })
    );
    expect(header).toContain('<span>Atalhos</span>');
    expect(header).toContain('aria-haspopup="dialog"');
    expect(header).toContain('aria-keyshortcuts="?"');
  });
});
