import { describe, it, expect } from 'vitest';
import {
  computeNextStepIndex,
  computePreviousStepIndex,
  computeStepDurationMs
} from '../src/hooks/useAudioPlayer';
import { createObservationSonificationParams } from '../src/audio/sonificationMapping';
import { PLAYBACK_SPEEDS } from '../src/types/player';
import { TemporalObservation } from '../src/types/dataset';

function makeObs(rate: number | null, coverage: number | null): TemporalObservation {
  return {
    observation_id: 'obs',
    step_index: 0,
    timestamp_utc: '2024-01-01T00:00:00Z',
    availability: {
      status: rate === null ? 'missing' : 'available',
      valid_cells_ratio: rate === null ? 0 : 1,
      missing_cells_count: 0,
      total_cells_count: 10
    },
    scientific_indicators: {
      mean_precipitation_rate: { value: rate, unit: 'mm/h', description: '' },
      rain_area_fraction: { value: coverage, unit: 'fraction', description: '' }
    },
    visual_frame_reference: {
      frame_id: 'f',
      image_path: '',
      source_system: 'NASA',
      synchronization_status: 'pending_official_validation',
      alt_text: ''
    },
    textual_summary: ''
  };
}

describe('computeNextStepIndex', () => {
  it('avança um passo dentro da série', () => {
    expect(computeNextStepIndex(0, 6, false)).toEqual({ nextIndex: 1, ended: false });
    expect(computeNextStepIndex(4, 6, true)).toEqual({ nextIndex: 5, ended: false });
  });

  it('sem repetição, o último passo é terminal e o índice permanece nele', () => {
    expect(computeNextStepIndex(5, 6, false)).toEqual({ nextIndex: 5, ended: true });
  });

  it('com repetição, o último passo volta ao primeiro', () => {
    expect(computeNextStepIndex(5, 6, true)).toEqual({ nextIndex: 0, ended: false });
  });

  it('série vazia ou de um passo termina imediatamente, mesmo com repetição', () => {
    expect(computeNextStepIndex(0, 0, true)).toEqual({ nextIndex: 0, ended: true });
    expect(computeNextStepIndex(0, 1, true)).toEqual({ nextIndex: 0, ended: true });
  });
});

describe('computePreviousStepIndex', () => {
  it('retrocede e respeita o início da série', () => {
    expect(computePreviousStepIndex(3, 6, false)).toBe(2);
    expect(computePreviousStepIndex(0, 6, false)).toBeNull();
  });

  it('com repetição, do primeiro passo vai ao último', () => {
    expect(computePreviousStepIndex(0, 6, true)).toBe(5);
  });

  it('série vazia ou de um passo não tem passo anterior', () => {
    expect(computePreviousStepIndex(0, 0, true)).toBeNull();
    expect(computePreviousStepIndex(0, 1, true)).toBeNull();
  });
});

describe('velocidade de reprodução', () => {
  it('altera apenas a duração do passo', () => {
    expect(computeStepDurationMs(1500, 0.5)).toBe(3000);
    expect(computeStepDurationMs(1500, 1)).toBe(1500);
    expect(computeStepDurationMs(1500, 2)).toBe(750);
    expect(PLAYBACK_SPEEDS.map((speed) => computeStepDurationMs(1500, speed))).toEqual([3000, 2000, 1500, 1000, 750]);
  });

  it('mantém frequência e pulsos idênticos em qualquer velocidade (significado científico preservado)', () => {
    const observation = makeObs(5.2, 0.4);
    const baseline = createObservationSonificationParams(observation, computeStepDurationMs(1500, 1));
    for (const speed of PLAYBACK_SPEEDS) {
      const params = createObservationSonificationParams(observation, computeStepDurationMs(1500, speed));
      expect(params.frequency).toBe(baseline.frequency);
      expect(params.pulseCount).toBe(baseline.pulseCount);
      expect(params.isMissing).toBe(false);
    }
  });

  it('dado ausente permanece distinto de zero em qualquer velocidade', () => {
    const missing = createObservationSonificationParams(makeObs(null, null), computeStepDurationMs(1500, 2));
    const dry = createObservationSonificationParams(makeObs(0, 0), computeStepDurationMs(1500, 2));
    expect(missing.isMissing).toBe(true);
    expect(dry.isMissing).toBe(false);
    expect(missing.frequency).not.toBe(dry.frequency);
  });
});
