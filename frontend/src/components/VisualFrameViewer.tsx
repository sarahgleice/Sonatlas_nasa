import React, { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { TemporalObservation, VisualFrameReference } from '../types/dataset';
import { formatTimestamp } from '../utils/formatters';

interface VisualFrameViewerProps {
  observation: TemporalObservation | null;
}

export function formatFrameSyncStatus(status: VisualFrameReference['synchronization_status']): string {
  return status === 'verified' ? 'Sincronização verificada' : 'Sincronização pendente de validação oficial';
}

/** Só há imagem quando o caminho é preenchido; a descrição textual sempre acompanha o passo atual. */
export function hasFrameImage(frame: VisualFrameReference): boolean {
  return frame.image_path.trim().length > 0;
}

/**
 * Quadro visual associado à observação atual (mesmo passo, data e valores do player).
 * Enquanto o quadro oficial não existe, mostra um estado vazio honesto com a descrição textual,
 * sem simular uma imagem da NASA.
 */
export const VisualFrameViewer: React.FC<VisualFrameViewerProps> = ({ observation }) => {
  const frame = observation?.visual_frame_reference ?? null;
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [frame?.image_path]);

  if (!observation || !frame) return null;

  const showImage = hasFrameImage(frame) && !imageFailed;

  return (
    <figure className="visual-frame" aria-labelledby="visual-frame-title">
      <h3 id="visual-frame-title" className="visual-frame-title">Quadro visual da observação</h3>
      {showImage ? (
        <img
          src={frame.image_path}
          alt={frame.alt_text}
          className="visual-frame-image"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="visual-frame-empty">
          <ImageOff size={20} aria-hidden="true" />
          <p>
            {imageFailed
              ? 'Não foi possível carregar o quadro visual deste passo.'
              : 'O quadro visual oficial deste passo ainda não está disponível.'}
          </p>
        </div>
      )}
      <figcaption className="visual-frame-caption">
        <p className="visual-frame-alt">{frame.alt_text}</p>
        <dl>
          <div><dt>Instante</dt><dd>{formatTimestamp(observation.timestamp_utc)}</dd></div>
          <div><dt>Fonte</dt><dd>{frame.source_system}</dd></div>
          <div><dt>Situação</dt><dd>{formatFrameSyncStatus(frame.synchronization_status)}</dd></div>
        </dl>
      </figcaption>
    </figure>
  );
};
