import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AriaLiveAnnouncer } from '../src/accessibility/AriaLiveAnnouncer';

describe('AriaLiveAnnouncer', () => {
  it('mantém sempre montados os canais polite (status) e assertive (alert), ocultos visualmente', () => {
    const html = renderToStaticMarkup(createElement(AriaLiveAnnouncer, { announcement: null }));
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-live="assertive"');
    expect(html.match(/sr-only/g)).toHaveLength(2);
  });

  it('não renderiza texto no primeiro quadro (o texto é aplicado depois para forçar nova leitura)', () => {
    const html = renderToStaticMarkup(
      createElement(AriaLiveAnnouncer, { announcement: { id: 1, text: 'Passo 2 de 6', politeness: 'polite' } })
    );
    expect(html).not.toContain('Passo 2 de 6');
  });
});
