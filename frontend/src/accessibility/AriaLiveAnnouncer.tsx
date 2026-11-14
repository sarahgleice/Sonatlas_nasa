import React from 'react';

interface AriaLiveAnnouncerProps {
  message: string;
}

/**
 * Canal centralizado de comunicação de acessibilidade via aria-live.
 * Anuncia discretamente atualizações de linha do tempo e estados para tecnologias assistivas.
 */
export const AriaLiveAnnouncer: React.FC<AriaLiveAnnouncerProps> = ({ message }) => {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
};
