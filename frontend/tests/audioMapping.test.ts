import { describe, it, expect } from 'vitest';
import {
  mapRateToFrequency,
  mapCoverageToPulses,
  createObservationSonificationParams,
  FREQ_ALERT,
  FREQ_REST
} from '../src/audio/sonificationMapping';
import { TemporalObservation } from '../src/types/dataset';

describe('sonificationMapping', () => {
  it('mapeia valores ausentes (null) para frequência de alerta', () => {
    expect(mapRateToFrequency(null)).toBe(FREQ_ALERT);
    expect(mapRateToFrequency(undefined)).toBe(FREQ_ALERT);
  });

  it('mapeia taxa abaixo do limiar (< 0.1 mm/h) para frequência de repouso', () => {
    expect(mapRateToFrequency(0.0)).toBe(FREQ_REST);
    expect(mapRateToFrequency(0.05)).toBe(FREQ_REST);
  });

  it('mapeia taxas positivas em frequências crescentes', () => {
    const fLight = mapRateToFrequency(2.0);
    const fModerate = mapRateToFrequency(10.0);
    const fHeavy = mapRateToFrequency(40.0);

    expect(fLight).toBeGreaterThanOrEqual(220);
    expect(fModerate).toBeGreaterThan(fLight);
    expect(fHeavy).toBeGreaterThan(fModerate);
    expect(fHeavy).toBeLessThanOrEqual(880);
  });

  it('mapeia cobertura de área para densidade de pulsos', () => {
    expect(mapCoverageToPulses(0.0)).toBe(1);
    expect(mapCoverageToPulses(0.5)).toBeGreaterThanOrEqual(3);
    expect(mapCoverageToPulses(1.0)).toBe(7);
  });

  it('cria parâmetros sonoros de alerta quando observação é missing', () => {
    const missingObs: TemporalObservation = {
      observation_id: 'test_missing',
      step_index: 0,
      timestamp_utc: '2026-10-12T12:00:00Z',
      availability: {
        status: 'missing',
        valid_cells_ratio: 0.0,
        missing_cells_count: 100,
        total_cells_count: 100
      },
      scientific_indicators: {
        mean_precipitation_rate: {
          value: null,
          unit: 'mm/h',
          description: ''
        },
        rain_area_fraction: {
          value: null,
          unit: 'percentage',
          description: ''
        }
      },
      visual_frame_reference: {
        frame_id: 'f1',
        image_path: '',
        source_system: '',
        synchronization_status: 'pending_official_validation',
        alt_text: ''
      },
      textual_summary: ''
    };

    const params = createObservationSonificationParams(missingObs);
    expect(params.isMissing).toBe(true);
    expect(params.frequency).toBe(FREQ_ALERT);
  });
});
