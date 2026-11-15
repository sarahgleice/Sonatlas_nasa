import React, { useEffect, useState } from 'react';
import { LiveAnnouncement } from '../types/player';

interface AriaLiveAnnouncerProps {
  announcement: LiveAnnouncement | null;
  disabled?: boolean;
}

interface ChannelTexts {
  polite: string;
  assertive: string;
}

const EMPTY_CHANNELS: ChannelTexts = { polite: '', assertive: '' };

/**
 * Canal centralizado de comunicação de acessibilidade.
 * - `role="status"` (polite): progresso e resumos que não devem interromper a leitura.
 * - `role="alert"` (assertive): somente alertas críticos, como entrada em dado ausente.
 * Os dois nós permanecem montados; mensagens idênticas consecutivas são reaplicadas
 * (limpa e reescreve) para que o leitor de tela as leia de novo.
 */
export const AriaLiveAnnouncer: React.FC<AriaLiveAnnouncerProps> = ({ announcement, disabled = false }) => {
  const [texts, setTexts] = useState<ChannelTexts>(EMPTY_CHANNELS);

  useEffect(() => {
    if (disabled || !announcement) {
      setTexts(EMPTY_CHANNELS);
      return;
    }

    // Limpa os dois canais (evita texto de alerta obsoleto no modo de navegação) e reaplica no próximo quadro.
    setTexts(EMPTY_CHANNELS);

    const apply = () => {
      setTexts(
        announcement.politeness === 'assertive'
          ? { polite: '', assertive: announcement.text }
          : { polite: announcement.text, assertive: '' }
      );
    };

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      const frame = window.requestAnimationFrame(apply);
      return () => window.cancelAnimationFrame(frame);
    }

    const timeout = setTimeout(apply, 0);
    return () => clearTimeout(timeout);
  }, [announcement, disabled]);

  return (
    <>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {texts.polite}
      </div>
      <div role="alert" aria-live="assertive" aria-atomic="true" className="sr-only">
        {texts.assertive}
      </div>
    </>
  );
};
