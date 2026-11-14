import { describe, expect, it } from 'vitest';
import { TemporalObservation } from '../src/types/dataset';
import { buildPrecipitationChart, segmentPrecipitationChart } from '../src/components/PrecipitationChart';

function observation(index: number, timestamp: string, value: number | null, status: TemporalObservation['availability']['status'] = 'available'): TemporalObservation {
  return {
    observation_id: `obs-${index}`,
    step_index: index,
    timestamp_utc: timestamp,
    availability: { status, valid_cells_ratio: 1, missing_cells_count: 0, total_cells_count: 1 },
    scientific_indicators: {
      mean_precipitation_rate: { value, unit: 'mm/h', description: 'Taxa média' },
      rain_area_fraction: { value: null, unit: '%', description: 'Fração de área' }
    },
    visual_frame_reference: { frame_id: '', image_path: '', source_system: '', synchronization_status: 'pending_official_validation', alt_text: '' },
    textual_summary: ''
  };
}

describe('modelo do gráfico de precipitação', () => {
  it('posiciona pelo tempo UTC real e preserva índices originais', () => {
    const points = buildPrecipitationChart([
      observation(0, '2025-01-01T02:00:00Z', 3),
      observation(1, '2025-01-01T00:00:00Z', 1),
      observation(2, '2025-01-01T01:00:00Z', 2)
    ]);
    expect(points.map(({ index, x }) => [index, x])).toEqual([[1, 0], [2, 50], [0, 100]]);
  });

  it('não converte null ou availability missing em zero nem conecta os períodos', () => {
    const points = buildPrecipitationChart([
      observation(0, '2025-01-01T00:00:00Z', 2),
      observation(1, '2025-01-01T00:30:00Z', null),
      observation(2, '2025-01-01T01:00:00Z', 0, 'missing'),
      observation(3, '2025-01-01T01:30:00Z', 4)
    ]);
    expect(points.map((point) => point.value)).toEqual([2, null, null, 4]);
    expect(segmentPrecipitationChart(points).map((segment) => segment.map((point) => point.index))).toEqual([[0], [3]]);
  });

  it('retorna vazio quando não há observações', () => {
    expect(buildPrecipitationChart([])).toEqual([]);
    expect(segmentPrecipitationChart([])).toEqual([]);
  });
});
