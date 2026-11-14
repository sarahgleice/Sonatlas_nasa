import React from 'react';
import { TemporalObservation } from '../types/dataset';
import {
  formatPrecipitationRate,
  formatAreaFraction,
  formatTimestamp,
  getIntensityLabel,
  getRatePresentationNote
} from '../utils/formatters';
import { Activity, AlertTriangle, CheckCircle } from 'lucide-react';

interface ScientificSummaryProps {
  observation: TemporalObservation | null;
  regionName: string;
}

export const ScientificSummary: React.FC<ScientificSummaryProps> = ({
  observation,
  regionName
}) => {
  if (!observation) {
    return (
      <section className="card" aria-labelledby="summary-title">
        <h2 id="summary-title" className="card-title">Sumário Científico</h2>
        <p>Aguardando carregamento de observações científicas...</p>
      </section>
    );
  }

  const { availability, scientific_indicators, timestamp_utc, textual_summary } = observation;
  const isMissing = availability.status === 'missing';
  const meanRate = scientific_indicators.mean_precipitation_rate.value;
  const areaFraction = scientific_indicators.rain_area_fraction.value;
  const rateNote = getRatePresentationNote(meanRate);

  return (
    <section className="card scientific-summary-card" aria-labelledby="summary-title">
      <div className="card-header">
        <Activity size={20} className="card-icon" aria-hidden="true" />
        <h2 id="summary-title" className="card-title">
          Indicadores Científicos — {regionName}
        </h2>
        <span
          className={`badge ${isMissing ? 'badge-warning' : 'badge-success'}`}
          aria-label={`Status de disponibilidade dos dados: ${availability.status}`}
        >
          {isMissing ? (
            <>
              <AlertTriangle size={14} aria-hidden="true" />
              <span>Dados Ausentes</span>
            </>
          ) : (
            <>
              <CheckCircle size={14} aria-hidden="true" />
              <span>Disponível ({Math.round(availability.valid_cells_ratio * 100)}% válido)</span>
            </>
          )}
        </span>
      </div>

      <div className="timestamp-badge">
        <strong>Instante da Coleta:</strong> {formatTimestamp(timestamp_utc)}
      </div>

      <div className="metrics-grid">
        <div className="metric-box">
          <span className="metric-label">Taxa Média de Precipitação</span>
          <span className="metric-value">{formatPrecipitationRate(meanRate)}</span>
          <span className="metric-caption">{getIntensityLabel(meanRate)}</span>
        </div>

        <div className="metric-box">
          <span className="metric-label">Cobertura de Área com Chuva</span>
          <span className="metric-value">{formatAreaFraction(areaFraction)}</span>
          <span className="metric-caption">Limiar &ge; 0.1 mm/h</span>
        </div>

        <div className="metric-box">
          <span className="metric-label">Pico Máximo Registrado</span>
          <span className="metric-value">
            {formatPrecipitationRate(scientific_indicators.max_precipitation_rate?.value)}
          </span>
          <span className="metric-caption">Célula de maior intensidade</span>
        </div>

        <div className="metric-box">
          <span className="metric-label">Diferença Temporal (&Delta;R)</span>
          <span className="metric-value">
            {(() => {
              const tempDiff = scientific_indicators.temporal_difference ?? scientific_indicators.temporal_change ?? scientific_indicators.temporal_variance;
              return tempDiff?.value !== null && tempDiff?.value !== undefined
                ? `${tempDiff.value > 0 ? '+' : ''}${tempDiff.value.toFixed(2)} mm/h`
                : 'Linha base';
            })()}
          </span>
          <span className="metric-caption">Em relação ao passo anterior (Rt - Rt-1)</span>
        </div>
      </div>

      <div className="textual-summary-box" aria-label="Audiodescrição resumida da observação">
        <h3>Descrição Textual Acessível</h3>
        <p>{rateNote ?? textual_summary}</p>
      </div>
    </section>
  );
};
