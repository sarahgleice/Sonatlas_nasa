import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ScientificSummary } from '../src/components/ScientificSummary';
import { TemporalObservation } from '../src/types/dataset';

const observation = (rate: number | null): TemporalObservation => ({
  observation_id: 'obs', step_index: 0, timestamp_utc: '2026-10-12T12:00:00Z',
  availability: rate === null
    ? { status: 'missing', valid_cells_ratio: 0, missing_cells_count: 1, total_cells_count: 1 }
    : { status: 'available', valid_cells_ratio: 1, missing_cells_count: 0, total_cells_count: 1 },
  scientific_indicators: {
    mean_precipitation_rate: { value: rate, unit: 'mm/h', description: 'Taxa média' },
    rain_area_fraction: { value: rate === null ? null : 0, unit: 'fraction', description: 'Fração' }
  },
  visual_frame_reference: { frame_id: 'frame', image_path: '/frame.png', source_system: 'sample', synchronization_status: 'pending_official_validation', alt_text: 'frame' },
  textual_summary: 'Resumo'
});

const markup = (rate: number | null) => renderToStaticMarkup(
  <ScientificSummary observation={observation(rate)} regionName="Amazônia Central" />
);

describe('ScientificSummary rate threshold communication', () => {
  it('preserves a positive subthreshold rate as distinct from zero', () => {
    const html = markup(0.04);
    expect(html).toContain('Taxa média registrada: 0,04 mm/h');
    expect(html).toContain('O valor é positivo e está abaixo do limiar operacional sonoro de 0,1 mm/h');
    expect(html).toContain('o áudio usa o tom de repouso');
    expect(html).not.toContain('representa taxa zero');
    expect(html).not.toContain('Resumo');
  });

  it('identifies an observed exact zero and the operational sound threshold', () => {
    expect(markup(0)).toContain('Taxa média registrada: 0.0 mm/h');
  });

  it('identifies a missing metric as unavailable, not zero', () => {
    expect(markup(null)).toContain('Taxa média indisponível; dado ausente não equivale a taxa zero.');
    expect(markup(null)).toContain('Dados Ausentes');
  });
});
