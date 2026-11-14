import React from 'react';
import { TemporalObservation } from '../types/dataset';
import {
  formatPrecipitationRate,
  formatAreaFraction,
  formatAvailabilityStatus,
  formatTimestamp,
  getIntensityLabel,
  getObservationDataState,
  getRatePresentationNote
} from '../utils/formatters';
import { buildSonificationExplanation } from '../utils/scientificExplanation';
import { Activity, AlertTriangle, CheckCircle, Headphones } from 'lucide-react';

interface ScientificSummaryProps {
  observation: TemporalObservation | null;
  regionName: string;
  previousObservation?: TemporalObservation | null;
  index?: number;
  total?: number;
}

export const ScientificSummary: React.FC<ScientificSummaryProps> = ({
  observation,
  regionName,
  previousObservation = null,
  index = 0,
  total = 1
}) => {
  if (!observation) {
    return (
      <section className="card" aria-labelledby="summary-title">
        <h3 id="summary-title" className="card-title">Indicadores Científicos</h3>
        <p>Aguardando carregamento de observações científicas...</p>
      </section>
    );
  }

  const { availability, scientific_indicators, timestamp_utc, textual_summary } = observation;
  const dataState = getObservationDataState(observation);
  const isMissing = dataState === 'missing';
  const isPartial = availability.status === 'partial';
  const meanRate = scientific_indicators.mean_precipitation_rate.value;
  const ratePresentationNote = getRatePresentationNote(meanRate);
  const areaFraction = scientific_indicators.rain_area_fraction.value;
  const explanation = buildSonificationExplanation(observation, previousObservation, index, total);

  const temporalDifference = scientific_indicators.temporal_difference
    ?? scientific_indicators.temporal_change
    ?? scientific_indicators.temporal_variance;
  const differenceValue = temporalDifference?.value;
  let differenceText: string;
  if (differenceValue !== null && differenceValue !== undefined) {
    differenceText = `${differenceValue > 0 ? '+' : ''}${differenceValue.toFixed(2)} mm/h`;
  } else if (index > 0) {
    differenceText = 'Indisponível (passo anterior ausente)';
  } else {
    differenceText = 'Linha base (primeiro passo)';
  }

  const availabilityLabel = formatAvailabilityStatus(availability.status);
  const validPercent = Math.round(availability.valid_cells_ratio * 100);

  return (
    <section className="card scientific-summary-card" aria-labelledby="summary-title">
      <div className="card-header">
        <Activity size={20} className="card-icon" aria-hidden="true" />
        <h3 id="summary-title" className="card-title">
          Indicadores Científicos — {regionName}
        </h3>
        <span
          className={`badge ${isMissing ? 'badge-warning' : isPartial ? 'badge-info' : 'badge-success'}`}
          aria-label={`Status de disponibilidade dos dados: ${availabilityLabel}`}
        >
          {isMissing ? (
            <>
              <AlertTriangle size={14} aria-hidden="true" />
              <span>{availabilityLabel}</span>
            </>
          ) : (
            <>
              <CheckCircle size={14} aria-hidden="true" />
              <span>{availabilityLabel} ({validPercent}% válido)</span>
            </>
          )}
        </span>
      </div>

      <div className="timestamp-badge">
        <strong>Instante da Coleta:</strong> {formatTimestamp(timestamp_utc)}
      </div>

      <section className="listening-explanation" aria-labelledby="listening-title">
        <h4 id="listening-title"><Headphones size={16} aria-hidden="true" /> Entenda o que você ouviu</h4>
        <p className="listening-headline">{explanation.headline}</p>
        <ul>
          <li>{explanation.pitchComparison}</li>
          {explanation.pulseComparison && <li>{explanation.pulseComparison}</li>}
          {explanation.temporalChange && <li>{explanation.temporalChange}</li>}
        </ul>
      </section>

      <div className="metrics-grid">
        <div className="metric-box">
          <span className="metric-label">Taxa Média de Precipitação</span>
          <span className="metric-value">{formatPrecipitationRate(meanRate)}</span>
          <span className="metric-caption">{getIntensityLabel(meanRate)}</span>
          {ratePresentationNote && <p className="availability-status">{ratePresentationNote}</p>}
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
          <span className="metric-value">{differenceText}</span>
          <span className="metric-caption">Em relação ao passo anterior (Rt - Rt-1)</span>
        </div>
      </div>

      <section className="textual-summary-box" aria-labelledby="textual-summary-title">
        <h4 id="textual-summary-title">Descrição Textual Acessível</h4>
        <p>{textual_summary}</p>
      </section>
    </section>
  );
};
