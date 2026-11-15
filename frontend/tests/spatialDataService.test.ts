import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SpatialDataService } from '../src/services/spatialDataService';
import { axisCellEdges, precipitationColor, spatialGridCellBounds } from '../src/maps/precipitationScale';
import { SpatialGridTable } from '../src/maps/SpatialGridTable';
import type { SpatialGridManifest } from '../src/types/spatialGrid';

const box = { min_latitude: -2, max_latitude: 0, min_longitude: 10, max_longitude: 12 };
const manifest: SpatialGridManifest = {
  schema_version: '1.0.0', region_id: 'test-region', units: 'mm/h', data_source: 'NASA GES DISC',
  product_name: 'GPM_3IMERGHHE', product_version: '07B', validation_status: 'preliminary_verified',
  spatial_resolution_degrees: 1, bounding_box: box,
  latitude_centers: [-1.5, -0.5], longitude_centers: [10.5, 11.5],
  timestamps: [
    { timestamp_utc: '2024-01-01T00:00:00Z', matrix_path: 'matrices/00.json' },
    { timestamp_utc: '2024-01-01T00:30:00Z', matrix_path: 'matrices/30.json' }
  ]
};
const datasetPath = '/data/spatial-service-test/observations.json';

function stubFiles(files: Record<string, unknown | null>) {
  const fetchMock = vi.fn(async (path: string) => {
    const value = files[path];
    return value === undefined || value === null
      ? { ok: false, status: 404, json: async () => null }
      : { ok: true, status: 200, json: async () => value };
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('SpatialDataService', () => {
  it('maps exact UTC timestamps to row-major cells and preserves zero and missing values', async () => {
    stubFiles({
      '/data/spatial-service-test/spatial/manifest.json': manifest,
      '/data/spatial-service-test/spatial/matrices/00.json': {
        timestamp_utc: '2024-01-01T00:00:00Z', values: [[0, 0.1], [null, 5.2]]
      }
    });

    const availability = { status: 'partial' as const, valid_cells_ratio: 0.75, missing_cells_count: 1, total_cells_count: 4 };
    const grid = await SpatialDataService.loadGrid(datasetPath, 'test-region', box, '2024-01-01T00:00:00Z', availability);
    expect(grid?.values).toEqual([[0, 0.1], [null, 5.2]]);
    expect(grid?.timestamp_utc).toBe('2024-01-01T00:00:00Z');
    expect(grid?.availability).toEqual(availability);
  });

  it('returns unavailable when the manifest or selected timestamp is absent', async () => {
    stubFiles({});
    await expect(SpatialDataService.loadGrid('/data/spatial-service-no-manifest/observations.json', 'test-region', box, '2024-01-01T00:00:00Z')).resolves.toBeNull();

    const missingTimestampPath = '/data/spatial-service-missing-timestamp/observations.json';
    const fetchMock = stubFiles({ '/data/spatial-service-missing-timestamp/spatial/manifest.json': manifest });
    await expect(SpatialDataService.loadGrid(missingTimestampPath, 'test-region', box, '2024-01-01T01:00:00Z')).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports a missing matrix referenced by the manifest as an error', async () => {
    const missingMatrixPath = '/data/spatial-service-missing-matrix/observations.json';
    stubFiles({ '/data/spatial-service-missing-matrix/spatial/manifest.json': manifest });
    await expect(SpatialDataService.loadGrid(missingMatrixPath, 'test-region', box, '2024-01-01T00:00:00Z'))
      .rejects.toThrow('matriz espacial referenciada no manifesto não está disponível');
  });

  it('returns unavailable for a timestamp outside the exported spatial window', async () => {
    const fetchMock = stubFiles({ '/data/spatial-service-time-mismatch/spatial/manifest.json': manifest });
    await expect(SpatialDataService.loadGrid('/data/spatial-service-time-mismatch/observations.json', 'test-region', box, '2024-01-01T01:00:00Z'))
      .resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the two region grids separate for the same UTC timestamp', async () => {
    const congoBox = { min_latitude: -2, max_latitude: 0, min_longitude: 20, max_longitude: 22 };
    const amazonManifest: SpatialGridManifest = { ...manifest, region_id: 'amazon_central' };
    const congoManifest: SpatialGridManifest = {
      ...manifest,
      region_id: 'congo_basin_kisangani',
      validation_status: 'candidate_under_review',
      bounding_box: congoBox,
      longitude_centers: [20.5, 21.5]
    };
    stubFiles({
      '/data/amazon/spatial/manifest.json': amazonManifest,
      '/data/amazon/spatial/matrices/00.json': {
        timestamp_utc: '2024-01-01T00:00:00Z', values: [[0, 0.1], [null, 5.2]]
      },
      '/data/congo/spatial/manifest.json': congoManifest,
      '/data/congo/spatial/matrices/00.json': {
        timestamp_utc: '2024-01-01T00:00:00Z', values: [[2, 3], [4, 5]]
      }
    });

    const [amazon, congo] = await Promise.all([
      SpatialDataService.loadGrid('/data/amazon/observations_afternoon.json', 'amazon_central', box, '2024-01-01T00:00:00Z'),
      SpatialDataService.loadGrid('/data/congo/observations.json', 'congo_basin_kisangani', congoBox, '2024-01-01T00:00:00Z')
    ]);

    expect(amazon?.values).toEqual([[0, 0.1], [null, 5.2]]);
    expect(congo?.values).toEqual([[2, 3], [4, 5]]);
    expect(congo?.manifest.validation_status).toBe('candidate_under_review');
  });

  it('supports a combined regional manifest without filling the gap between time windows', async () => {
    const dayManifest: SpatialGridManifest = {
      ...manifest,
      timestamps: [
        { timestamp_utc: '2024-01-01T00:00:00Z', matrix_path: 'matrices/morning.json' },
        { timestamp_utc: '2024-01-01T02:30:00Z', matrix_path: 'matrices/morning-last.json' },
        { timestamp_utc: '2024-01-01T17:00:00Z', matrix_path: 'matrices/afternoon.json' },
        { timestamp_utc: '2024-01-01T19:30:00Z', matrix_path: 'matrices/afternoon-last.json' }
      ]
    };
    stubFiles({ '/data/amazon-day/spatial/manifest.json': dayManifest });

    await expect(SpatialDataService.loadGrid(
      '/data/amazon-day/observations_day_windows.json', 'test-region', box, '2024-01-01T14:30:00Z'
    )).resolves.toBeNull();
  });

  it('loads each selected timestamp from the shared morning and afternoon series manifest', async () => {
    const dayManifest: SpatialGridManifest = {
      ...manifest,
      timestamps: [
        { timestamp_utc: '2024-01-01T00:00:00Z', matrix_path: 'matrices/morning.json' },
        { timestamp_utc: '2024-01-01T02:30:00Z', matrix_path: 'matrices/morning-last.json' },
        { timestamp_utc: '2024-01-01T17:00:00Z', matrix_path: 'matrices/afternoon.json' },
        { timestamp_utc: '2024-01-01T19:30:00Z', matrix_path: 'matrices/afternoon-last.json' }
      ]
    };
    stubFiles({
      '/data/amazon-series/spatial/manifest.json': dayManifest,
      '/data/amazon-series/spatial/matrices/morning.json': {
        timestamp_utc: '2024-01-01T00:00:00Z', values: [[0, 0], [0, 0]]
      },
      '/data/amazon-series/spatial/matrices/afternoon.json': {
        timestamp_utc: '2024-01-01T17:00:00Z', values: [[0, 0.25], [1, 3]]
      }
    });

    const [morning, afternoon] = await Promise.all([
      SpatialDataService.loadGrid('/data/amazon-series/observations.json', 'test-region', box, '2024-01-01T00:00:00Z'),
      SpatialDataService.loadGrid('/data/amazon-series/observations_afternoon.json', 'test-region', box, '2024-01-01T17:00:00Z')
    ]);

    expect(morning?.values).toEqual([[0, 0], [0, 0]]);
    expect(afternoon?.values).toEqual([[0, 0.25], [1, 3]]);
    expect(morning?.timestamp_utc).not.toBe(afternoon?.timestamp_utc);
  });

  it('rejects a matrix whose missing-cell count disagrees with the selected observation', async () => {
    stubFiles({
      '/data/spatial-service-count-mismatch/spatial/manifest.json': manifest,
      '/data/spatial-service-count-mismatch/spatial/matrices/00.json': {
        timestamp_utc: '2024-01-01T00:00:00Z', values: [[0, 0.1], [2, 5.2]]
      }
    });
    await expect(SpatialDataService.loadGrid(
      '/data/spatial-service-count-mismatch/observations.json', 'test-region', box,
      '2024-01-01T00:00:00Z', { status: 'partial', valid_cells_ratio: 0.75, missing_cells_count: 1, total_cells_count: 4 }
    )).rejects.toThrow('contagem de células da grade');
  });

  it('rejects mismatched matrix timestamps, shape, negative values and sentinel values', async () => {
    const invalidMatrices = [
      { timestamp_utc: '2024-01-01T00:30:00Z', values: [[1, 2], [3, 4]] },
      { timestamp_utc: '2024-01-01T00:00:00Z', values: [[1], [2]] },
      { timestamp_utc: '2024-01-01T00:00:00Z', values: [[1, -1], [2, 3]] },
      { timestamp_utc: '2024-01-01T00:00:00Z', values: [[1, -9999], [2, 3]] }
    ];
    for (const [index, matrix] of invalidMatrices.entries()) {
      const path = `/data/spatial-service-invalid-matrix-${index}/observations.json`;
      stubFiles({
        [`/data/spatial-service-invalid-matrix-${index}/spatial/manifest.json`]: manifest,
        [`/data/spatial-service-invalid-matrix-${index}/spatial/matrices/00.json`]: matrix
      });
      await expect(SpatialDataService.loadGrid(path, 'test-region', box, '2024-01-01T00:00:00Z'))
        .rejects.toThrow('Matriz espacial inválida');
    }
  });

  it('rejects inconsistent region, bounding box, units, and axis orientation', async () => {
    for (const [index, invalid] of [
      { ...manifest, region_id: 'other-region' },
      { ...manifest, units: 'mm' },
      { ...manifest, latitude_centers: [-0.5, -1.5] }
    ].entries()) {
      const path = `/data/spatial-service-invalid-manifest-${index}/observations.json`;
      stubFiles({ [`/data/spatial-service-invalid-manifest-${index}/spatial/manifest.json`]: invalid });
      await expect(SpatialDataService.loadGrid(path, 'test-region', box, '2024-01-01T00:00:00Z'))
        .rejects.toThrow('Manifesto da grade espacial inválido');
    }

    stubFiles({ '/data/spatial-service-box-mismatch/spatial/manifest.json': { ...manifest, bounding_box: { ...box, max_latitude: 1 } } });
    await expect(SpatialDataService.loadGrid('/data/spatial-service-box-mismatch/observations.json', 'test-region', box, '2024-01-01T00:00:00Z'))
      .rejects.toThrow('recorte da grade espacial não corresponde');
  });

  it('maps south-to-north rows and west-to-east columns to the expected cell bounds', () => {
    const cells = spatialGridCellBounds({
      manifest,
      timestamp_utc: '2024-01-01T00:00:00Z',
      values: [[0, 0.1], [null, 5.2]]
    });
    expect(cells).toEqual([
      [[-2, 10], [-1, 11]], [[-2, 11], [-1, 12]],
      [[-1, 10], [0, 11]], [[-1, 11], [0, 12]]
    ]);
  });

  it('exposes coordinates, units, zero, positive values, and missing cells in the accessible table', () => {
    const html = renderToStaticMarkup(createElement(SpatialGridTable, { grid: {
      manifest, timestamp_utc: '2024-01-01T00:00:00Z', values: [[0, 0.1], [null, 5.2]]
    } }));
    expect(html).toContain('Precipitação em 2024-01-01T00:00:00Z UTC');
    expect(html).toContain('Latitude');
    expect(html).toContain('-1.5°');
    expect(html).toContain('0 mm/h');
    expect(html).toContain('0.1 mm/h');
    expect(html).toContain('Sem dado');
  });

  it('uses cell-center midpoints and a distinct fixed color for zero, positive, and missing cells', () => {
    expect(axisCellEdges([-1.5, -0.5], -2, 0)).toEqual([-2, -1, 0]);
    expect(axisCellEdges([-1.5, -0.5, 0.5], -2, 1)).toEqual([-2, -1, 0, 1]);
    expect(precipitationColor(0)).not.toBe(precipitationColor(null));
    expect(precipitationColor(0.01)).not.toBe(precipitationColor(0));
    expect(precipitationColor(0.1)).toBe(precipitationColor(0.49));
    expect(precipitationColor(0.5)).not.toBe(precipitationColor(0.1));
  });
});
