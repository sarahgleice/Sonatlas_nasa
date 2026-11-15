import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AccessibilitySettingsDialog } from '../src/accessibility/AccessibilitySettingsDialog';

describe('janela de acessibilidade', () => {
  it('inclui os controles de cores e contraste', () => {
    const html = renderToStaticMarkup(
      React.createElement(AccessibilitySettingsDialog, {
        isOpen: false,
        voiceEnabled: false,
        voiceSupported: true,
        onSave: () => undefined,
        onClose: () => undefined,
      }),
    );
    expect(html).toContain('Cores e contraste');
    expect(html).toContain('Daltonismo');
    expect(html).toContain('Monocromático');
    expect(html).toContain('Alto contraste');
  });
});