import React from 'react';
import { TemporalObservation } from '../types/dataset';
import { formatTimestamp, formatPrecipitationRate } from '../utils/formatters';

interface TimelineProps {
  observations: TemporalObservation[];
  currentIndex: number;
  onSelectStep: (index: number) => void;
}

export const Timeline: React.FC<TimelineProps> = ({
  observations,
  currentIndex,
  onSelectStep
}) => {
  if (observations.length === 0) {
    return (
      <div className="card timeline-empty">
        <p>Nenhuma observação temporal carregada para a área selecionada.</p>
      </div>
    );
  }

  return (
    <nav className="card timeline-card" aria-label="Linha do tempo das observações">
      <h3 className="timeline-title">Passos Temporais da Série</h3>
      <ol className="timeline-list">
        {observations.map((obs, idx) => {
          const isActive = idx === currentIndex;
          const rate = obs.scientific_indicators.mean_precipitation_rate.value;
          const label = `Passo ${idx + 1}: ${formatTimestamp(obs.timestamp_utc)} - Taxa: ${formatPrecipitationRate(rate)}`;

          return (
            <li key={obs.observation_id} className="timeline-item">
              <button
                onClick={() => onSelectStep(idx)}
                className={`timeline-step-btn ${isActive ? 'active' : ''}`}
                aria-current={isActive ? 'step' : undefined}
                aria-label={label}
              >
                <span className="step-number">{idx + 1}</span>
                <span className="step-time">
                  {obs.timestamp_utc.substring(11, 16)} UTC
                </span>
                <span className="step-rate">
                  {rate !== null ? `${rate.toFixed(1)} mm/h` : 'Dado ausente'}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
