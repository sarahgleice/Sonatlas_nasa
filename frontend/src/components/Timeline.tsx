import React, { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { TemporalObservation } from '../types/dataset';
import { StepChangeSource } from '../types/player';
import {
  formatPrecipitationRate,
  formatTimestamp,
  formatUtcTimeShort,
  getObservationDataState,
  hasMultipleUtcDays
} from '../utils/formatters';

interface TimelineProps {
  observations: TemporalObservation[];
  currentIndex: number;
  onSelectStep: (index: number, source?: StepChangeSource) => void;
}

/** Passo de PageUp/PageDown, em observações. */
export const TIMELINE_PAGE_STEP = 5;
const HALF_HOUR_MS = 30 * 60 * 1000;

function formatGapDuration(durationMs: number): string {
  const minutes = Math.round(durationMs / 60_000);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours ? `${hours}h ` : ''}${remainder ? `${remainder}min` : ''}`.trim();
}

/**
 * Texto de aria-valuetext do slider: passo, instante UTC e taxa ou estado de ausência.
 * Dado ausente nunca é descrito como zero.
 */
export function buildTimelineValueText(observation: TemporalObservation, index: number, total: number): string {
  const state = getObservationDataState(observation);
  const prefix = `Passo ${index + 1} de ${total}, ${formatTimestamp(observation.timestamp_utc)}`;
  if (state === 'missing') {
    return `${prefix}: dados ausentes, medição indisponível`;
  }
  const rate = formatPrecipitationRate(observation.scientific_indicators.mean_precipitation_rate.value);
  return state === 'dry' ? `${prefix}: ${rate}, sem chuva` : `${prefix}: ${rate}`;
}

/**
 * Teclado do slider (WAI-ARIA APG). Retorna o novo índice, ou `null` se a tecla não é do slider.
 * Os limites são respeitados sem dar a volta.
 */
export function resolveTimelineKey(key: string, currentIndex: number, total: number): number | null {
  if (total <= 0) return null;
  const last = total - 1;
  const clamp = (value: number) => Math.min(last, Math.max(0, value));
  switch (key) {
    case 'ArrowRight':
    case 'ArrowUp':
      return clamp(currentIndex + 1);
    case 'ArrowLeft':
    case 'ArrowDown':
      return clamp(currentIndex - 1);
    case 'PageUp':
      return clamp(currentIndex + TIMELINE_PAGE_STEP);
    case 'PageDown':
      return clamp(currentIndex - TIMELINE_PAGE_STEP);
    case 'Home':
      return 0;
    case 'End':
      return last;
    default:
      return null;
  }
}

export const Timeline: React.FC<TimelineProps> = ({
  observations,
  currentIndex,
  onSelectStep
}) => {
  const activeMarkerRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    const marker = activeMarkerRef.current;
    if (!marker || typeof marker.scrollIntoView !== 'function') return;
    const reduceMotion = typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    marker.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [currentIndex]);

  if (observations.length === 0) {
    return (
      <div className="card timeline-empty">
        <p>Nenhuma observação temporal carregada para a área selecionada.</p>
      </div>
    );
  }

  const total = observations.length;
  const safeIndex = Math.min(Math.max(currentIndex, 0), total - 1);
  const includeDate = hasMultipleUtcDays(observations);
  const temporalGaps = observations.slice(1).flatMap((observation, index) => {
    const previous = observations[index];
    const durationMs = Date.parse(observation.timestamp_utc) - Date.parse(previous.timestamp_utc);
    return durationMs > HALF_HOUR_MS ? [{ previous, observation, durationMs }] : [];
  });

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const nextIndex = resolveTimelineKey(event.key, safeIndex, total);
    if (nextIndex === null) return;
    event.preventDefault();
    event.stopPropagation();
    if (nextIndex !== safeIndex) {
      onSelectStep(nextIndex, 'slider_step');
    }
  };

  return (
    <div className="card timeline-card">
      <h3 id="timeline-title" className="timeline-title">Passos temporais da série</h3>
      <div
        className="timeline-slider"
        role="slider"
        tabIndex={0}
        aria-labelledby="timeline-title"
        aria-orientation="horizontal"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={safeIndex + 1}
        aria-valuetext={buildTimelineValueText(observations[safeIndex], safeIndex, total)}
        aria-keyshortcuts="ArrowLeft ArrowRight Home End PageUp PageDown"
        onKeyDown={handleKeyDown}
      >
        {/* Marcadores visuais: o slider acima é o equivalente por teclado e leitor de tela. */}
        <ol className="timeline-list" aria-hidden="true">
          {observations.map((observation, index) => {
            const isActive = index === safeIndex;
            const state = getObservationDataState(observation);
            const rate = observation.scientific_indicators.mean_precipitation_rate.value;

            return (
              <li
                key={observation.observation_id}
                className="timeline-item"
                ref={isActive ? activeMarkerRef : undefined}
              >
                <div
                  onClick={() => onSelectStep(index, 'slider_step')}
                  className={`timeline-step-btn timeline-step-${state} ${isActive ? 'active' : ''}`}
                >
                  <span className="step-number">{index + 1}</span>
                  <span className="step-time">{formatUtcTimeShort(observation.timestamp_utc, includeDate)}</span>
                  <span className="step-rate">
                    {state === 'missing' ? (
                      <><AlertTriangle size={12} aria-hidden="true" /> Ausente</>
                    ) : (
                      formatPrecipitationRate(rate)
                    )}
                  </span>
                  {state === 'dry' && <span className="step-tag">Sem chuva</span>}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
      {temporalGaps.map(({ previous, observation, durationMs }) => (
        <p className="timeline-gap-note" role="note" key={`${previous.observation_id}-${observation.observation_id}`}>
          Sem observações entre {formatUtcTimeShort(previous.timestamp_utc, includeDate)} e {formatUtcTimeShort(observation.timestamp_utc, includeDate)} UTC ({formatGapDuration(durationMs)} entre passos). A lacuna não representa precipitação zero.
        </p>
      ))}
    </div>
  );
};
