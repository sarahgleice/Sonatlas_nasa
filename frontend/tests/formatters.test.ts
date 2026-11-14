import { describe, it, expect } from 'vitest';
import {
  formatPrecipitationRate,
  formatAreaFraction,
  formatUtcTimeShort,
  formatAvailabilityStatus,
  getObservationDataState,
  getIntensityLabel,
  hasMultipleUtcDays
} from '../src/utils/formatters';
import { TemporalObservation } from '../src/types/dataset';

function makeObs(
  index: number,
  timestamp: string,
  rate: number | null,
  status: TemporalObservation['availability']['status'] = 'available'
): TemporalObservation {
  return {
    observation_id: `obs-${index}`,
    step_index: index,
    timestamp_utc: timestamp,
    availability: {
      status,
      valid_cells_ratio: status === 'missing' ? 0 : status === 'partial' ? 0.5 : 1,
      missing_cells_count: status === 'missing' ? 10 : status === 'partial' ? 5 : 0,
      total_cells_count: 10
    },
    scientific_indicators: {
      mean_precipitation_rate: { value: rate, unit: 'mm/h', description: 'Taxa média' },
      rain_area_fraction: { value: rate === null ? null : 0.2, unit: 'fraction', description: 'Fração' }
    },
    visual_frame_reference: {
      frame_id: `frame-${index}`,
      image_path: '',
      source_system: 'NASA',
      synchronization_status: 'pending_official_validation',
      alt_text: ''
    },
    textual_summary: ''
  };
}

describe('formatters', () => {
  it('formata taxa de precipitação com unidade estrita mm/h e preserva traços residuais', () => {
    expect(formatPrecipitationRate(5.24)).toBe('5.2 mm/h');
    expect(formatPrecipitationRate(0.0)).toBe('0.0 mm/h');
    expect(formatPrecipitationRate(0.00134)).toBe('0.001 mm/h');
    expect(formatPrecipitationRate(0.00067)).toBe('0.0007 mm/h');
    expect(formatPrecipitationRate(null)).toBe('Não disponível');
  });

  it('formata fração de área em percentual', () => {
    expect(formatAreaFraction(0.65)).toBe('65%');
    expect(formatAreaFraction(null)).toBe('Não disponível');
  });

  it('classifica rótulo de intensidade distinguindo zero exato, traço e indisponível', () => {
    expect(getIntensityLabel(null)).toBe('Indisponível');
    expect(getIntensityLabel(0.0)).toBe('Sem precipitação (tempo seco)');
    expect(getIntensityLabel(0.05)).toBe('Sem precipitação mensurável');
    expect(getIntensityLabel(1.5)).toBe('Chuva fraca');
    expect(getIntensityLabel(5.0)).toBe('Chuva moderada');
    expect(getIntensityLabel(25.0)).toBe('Chuva forte / tempestade');
  });

  it('formata hora UTC curta e detecta séries multi-dia', () => {
    expect(formatUtcTimeShort('2024-01-01T02:30:00Z')).toBe('02:30 UTC');
    expect(formatUtcTimeShort('2024-01-02T02:30:00Z', true)).toContain('02/01');
    expect(formatUtcTimeShort('2024-01-02T02:30:00Z', true)).toContain('02:30 UTC');

    expect(hasMultipleUtcDays([
      makeObs(0, '2024-01-01T00:00:00Z', 0.2),
      makeObs(1, '2024-01-01T23:30:00Z', 0.1)
    ])).toBe(false);

    expect(hasMultipleUtcDays([
      makeObs(0, '2024-01-01T23:30:00Z', 0.2),
      makeObs(1, '2024-01-02T00:00:00Z', 0.1)
    ])).toBe(true);
  });

  it('traduz status de disponibilidade e diferencia estado missing, dry e rain', () => {
    expect(formatAvailabilityStatus('available')).toBe('Disponível');
    expect(formatAvailabilityStatus('partial')).toBe('Disponibilidade parcial');
    expect(formatAvailabilityStatus('missing')).toBe('Dados ausentes');

    expect(getObservationDataState(makeObs(0, '2024-01-01T00:00:00Z', null, 'missing'))).toBe('missing');
    expect(getObservationDataState(makeObs(1, '2024-01-01T00:30:00Z', 0, 'missing'))).toBe('missing');
    expect(getObservationDataState(makeObs(2, '2024-01-01T01:00:00Z', 0, 'available'))).toBe('dry');
    expect(getObservationDataState(makeObs(3, '2024-01-01T01:30:00Z', 0.0013, 'partial'))).toBe('dry');
    expect(getObservationDataState(makeObs(4, '2024-01-01T02:00:00Z', 0.38, 'partial'))).toBe('rain');
  });
});
