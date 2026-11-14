import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { DataService } from '../src/services/dataService';

const fixture = {
  dataset_version: '1.0.0', region_id: 'sample', region_name: 'Sample', country: 'BR',
  bounding_box: { min_latitude: -4, max_latitude: -1, min_longitude: -61, max_longitude: -58 },
  data_source: 'sample source', product_name: 'sample product', product_version: '1',
  phenomenon: 'precipitation', temporal_resolution: '30_minutes', is_sample: true,
  validation_status: 'preliminary_verified',
  observations: [{
    observation_id: 'obs-0', step_index: 0, timestamp_utc: '2026-10-12T12:00:00Z',
    availability: { status: 'available', valid_cells_ratio: 1, missing_cells_count: 0, total_cells_count: 10 },
    scientific_indicators: {
      mean_precipitation_rate: { value: 1.2, unit: 'mm/h', description: 'mean' },
      rain_area_fraction: { value: 0.2, unit: 'percentage', description: 'fraction' },
      temporal_variance: { value: null, unit: 'mm/h', description: 'difference' }
    },
    visual_frame_reference: { frame_id: 'frame-0', image_path: '/frame.png', source_system: 'sample', synchronization_status: 'pending_official_validation', alt_text: 'Sample frame' },
    textual_summary: 'Sample observation'
  }]
};

async function load(payload: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => payload }));
  return DataService.loadRegionDataset('/sample.json');
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('DataService.loadRegionDataset', () => {
  it.each([
    ['amazon/observations.json', 'amazon_central'],
    ['amazon/observations_afternoon.json', 'amazon_central'],
    ['congo/observations.json', 'congo_basin_kisangani']
  ])('accepts the official verified dataset %s with is_sample=false and 6 observations', async (relPath, expectedRegionId) => {
    const exported = JSON.parse(readFileSync(`public/data/${relPath}`, 'utf8'));
    const result = await load(exported);
    expect(result).toBe(exported);
    expect(result.is_sample).toBe(false);
    expect(result.region_id).toBe(expectedRegionId);
    expect(result.observations).toHaveLength(6);
    expect(result.validation_status).toBe('preliminary_verified');
  });

  it.each(['amazon_central_series.json', 'international_candidate_series.json'])(
    'accepts the current pipeline export %s without changing its sample status', async (filename) => {
      const exported = JSON.parse(readFileSync(`public/data/${filename}`, 'utf8'));
      const result = await load(exported);
      expect(result).toBe(exported);
      expect(result.is_sample).toBe(exported.is_sample);
    }
  );

  it('accepts a valid dataset and empty placeholder observations', async () => {
    await expect(load(fixture)).resolves.toMatchObject({ region_id: 'sample', is_sample: true });
    await expect(load({ ...fixture, is_placeholder: true, validation_status: 'candidate_under_review', observations: [] }))
      .resolves.toMatchObject({ observations: [] });
  });

  it('accepts valid-cell ratios rounded to three decimals by the Python pipeline', async () => {
    await expect(load({
      ...fixture,
      observations: [{
        ...fixture.observations[0],
        availability: { status: 'partial', valid_cells_ratio: 0.667, missing_cells_count: 1, total_cells_count: 3 }
      }]
    })).resolves.toMatchObject({ region_id: 'sample' });
  });

  it.each([
    ['invalid bounding box', { ...fixture, bounding_box: { ...fixture.bounding_box, max_latitude: 91 } }],
    ['invalid timestamp', { ...fixture, observations: [{ ...fixture.observations[0], timestamp_utc: 'yesterday' }] }],
    ['inconsistent availability', { ...fixture, observations: [{ ...fixture.observations[0], availability: { ...fixture.observations[0].availability, valid_cells_ratio: 0.8 } }] }],
    ['availability status inconsistent with ratio', { ...fixture, observations: [{ ...fixture.observations[0], availability: { ...fixture.observations[0].availability, status: 'available', valid_cells_ratio: 0.667, missing_cells_count: 1, total_cells_count: 3 } }] }],
    ['invalid physical unit', { ...fixture, observations: [{ ...fixture.observations[0], scientific_indicators: { ...fixture.observations[0].scientific_indicators, mean_precipitation_rate: { value: 2, unit: 'mm', description: 'rate' } } }] }],
    ['out of range fraction', { ...fixture, observations: [{ ...fixture.observations[0], scientific_indicators: { ...fixture.observations[0].scientific_indicators, rain_area_fraction: { value: 1.2, unit: 'percentage', description: 'fraction' } } }] }],
    ['missing treated as zero', { ...fixture, observations: [{ ...fixture.observations[0], availability: { status: 'missing', valid_cells_ratio: 0, missing_cells_count: 10, total_cells_count: 10 } }] }]
  ])('rejects %s', async (_case, payload) => {
    await expect(load(payload)).rejects.toThrow('contrato RegionDataset inválido');
  });

  it('reports HTTP failures without parsing them as datasets', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, statusText: 'Not Found' }));
    await expect(DataService.loadRegionDataset('/missing.json')).rejects.toThrow('Not Found');
  });
});
