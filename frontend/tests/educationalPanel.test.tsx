import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { EducationalPanel } from '../src/components/EducationalPanel';
import { RegionDataset } from '../src/types/dataset';

const dataset: RegionDataset = {
  dataset_version: '1', region_id: 'amazon_central', region_name: 'Amazônia Central', country: 'Brasil',
  bounding_box: { min_latitude: -5, max_latitude: 5, min_longitude: -65, max_longitude: -55 },
  data_source: 'Fonte de teste', product_name: 'Produto de teste', product_version: 'v1', phenomenon: 'Precipitação',
  temporal_resolution: '30_minutes', is_sample: true, validation_status: 'candidate_under_review',
  note: 'Nota existente', observations: [
    { observation_id: 'obs-0', step_index: 0, timestamp_utc: '2026-10-12T12:00:00Z', availability: { status: 'available', valid_cells_ratio: 1, missing_cells_count: 0, total_cells_count: 1 }, scientific_indicators: { mean_precipitation_rate: { value: 0, unit: 'mm/h', description: 'Taxa média de precipitação' }, rain_area_fraction: { value: 0, unit: 'percentage', description: 'Fração de área com chuva' } }, visual_frame_reference: { frame_id: 'frame-0', image_path: '/frame.png', source_system: 'sample', synchronization_status: 'pending_official_validation', alt_text: 'frame' }, textual_summary: 'sem precipitação' },
    { observation_id: 'obs-1', step_index: 1, timestamp_utc: '2026-10-12T12:30:00Z', availability: { status: 'missing', valid_cells_ratio: 0, missing_cells_count: 1, total_cells_count: 1 }, scientific_indicators: { mean_precipitation_rate: { value: null, unit: 'mm/h', description: 'Taxa média de precipitação' }, rain_area_fraction: { value: null, unit: 'percentage', description: 'Fração de área com chuva' } }, visual_frame_reference: { frame_id: 'frame-1', image_path: '/frame.png', source_system: 'sample', synchronization_status: 'pending_official_validation', alt_text: 'frame' }, textual_summary: 'dado ausente' }
  ]
};

const markup = (props: Partial<React.ComponentProps<typeof EducationalPanel>> = {}) => renderToStaticMarkup(
  <EducationalPanel isOpen={false} dataset={dataset} loading={false} error={null} onClose={() => {}} {...props} />
);

describe('EducationalPanel', () => {
  it('exibe apenas metadados fornecidos e identifica amostra e validação pendente', () => {
    const html = markup();
    expect(html).toContain('Fonte de teste');
    expect(html).toContain('Produto de teste · v1');
    expect(html).toContain('30 minutes');
    expect(html).toContain('Candidato em avaliação');
    expect(html).toContain('não são observações NASA verificadas');
    expect(html).toContain('Nota existente');
  });

  it('apresenta estados de carregamento, falha e metadados indisponíveis', () => {
    expect(markup({ loading: true })).toContain('Carregando metadados da região');
    expect(markup({ dataset: null, loading: false, error: 'Falha ao carregar' })).toContain('role="alert"');
    expect(markup({ dataset: null, loading: false, error: null })).toContain('Os metadados estarão disponíveis');
  });

  it('explica mm/h, zero e ausência, e usa período real do dataset', () => {
    const html = markup();
    expect(html).toContain('Taxa média de precipitação');
    expect(html).toContain('mm/h');
    expect(html).toContain('não pode ser interpretado como zero');
    expect(html).toContain('2026');
    expect(html).toContain('UTC');
  });
});
