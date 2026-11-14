import { describe, expect, it } from 'vitest';
import amazonCentralGeometrySource from '../../processing/geometry/amazon/central_amazon_bbox.geojson?raw';
import dataset from '../public/data/amazon_central_series.json';
import { parseAmazonCentralGeoJson } from '../src/maps/amazonGeometry';

describe('geometria GeoJSON da Amazônia Central', () => {
  it('valida o Feature ativo e seus limites coincidem com o bounding box do dataset', () => {
    const geometry = parseAmazonCentralGeoJson(amazonCentralGeometrySource);
    expect(geometry?.type).toBe('FeatureCollection');

    const raw = JSON.parse(amazonCentralGeometrySource) as {
      features: Array<{ properties: { region_id: string }; geometry: { coordinates: number[][][] } }>;
    };
    const ring = raw.features.find((feature) => feature.properties.region_id === 'amazon_central')!.geometry.coordinates[0];
    const bounds = {
      min_latitude: Math.min(...ring.map((point) => point[1])),
      max_latitude: Math.max(...ring.map((point) => point[1])),
      min_longitude: Math.min(...ring.map((point) => point[0])),
      max_longitude: Math.max(...ring.map((point) => point[0]))
    };

    expect(bounds).toEqual(dataset.bounding_box);
  });

  it('rejeita um anel de polígono não fechado', () => {
    const malformed = JSON.parse(amazonCentralGeometrySource);
    malformed.features[0].geometry.coordinates[0].pop();

    expect(parseAmazonCentralGeoJson(JSON.stringify(malformed))).toBeNull();
  });
});
