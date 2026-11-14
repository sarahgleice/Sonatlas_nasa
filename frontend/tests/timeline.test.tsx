import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Timeline } from '../src/components/Timeline';
import { TemporalObservation } from '../src/types/dataset';

const makeObservation = (
  status: TemporalObservation['availability']['status'],
  rate: number | null,
  validCellsRatio: number
): TemporalObservation => ({
  observation_id: `${status}-${rate}`,
  step_index: 0,
  timestamp_utc: '2026-10-12T12:00:00Z',
  availability: {
    status,
    valid_cells_ratio: validCellsRatio,
    missing_cells_count: 100 * (1 - validCellsRatio),
    total_cells_count: 100
  },
  scientific_indicators: {
    mean_precipitation_rate: { value: rate, unit: 'mm/h', description: '' },
    rain_area_fraction: { value: rate === null ? null : 0, unit: 'percentage', description: '' }
  },
  visual_frame_reference: {
    frame_id: 'frame',
    image_path: '',
    source_system: '',
    synchronization_status: 'pending_official_validation',
    alt_text: ''
  },
  textual_summary: ''
});

describe('Timeline availability labels', () => {
  const renderObservation = (observation: TemporalObservation) => renderToStaticMarkup(createElement(Timeline, {
    observations: [observation],
    currentIndex: 0,
    onSelectStep: () => undefined
  }));

  it('announces missing observations as missing, not as a numeric value', () => {
    const markup = renderObservation(makeObservation('missing', null, 0));
    expect(markup).toContain('Dados ausentes. Taxa: Não disponível');
    expect(markup).toContain('Dado ausente');
  });

  it('does not expose a numeric rate when availability marks the observation missing', () => {
    const markup = renderObservation(makeObservation('missing', 0, 0));
    expect(markup).toContain('Dado ausente');
    expect(markup).toContain('Dados ausentes. Taxa: Não disponível');
    expect(markup).not.toContain('Taxa: 0.0 mm/h');
  });

  it('announces partial quality and preserves a measured zero rate', () => {
    const markup = renderObservation(makeObservation('partial', 0, 0.5));
    expect(markup).toContain('Observação parcial, 50% de células válidas. Taxa: 0.0 mm/h');
    expect(markup).toContain('0.0 mm/h');
  });
});
