import { describe, expect, it } from 'vitest';
import { buildRegionGlobePolygons } from '../src/maps/globeRegions';

describe('Regiões no globo 3D', () => {
  it('usa somente os GeoJSON existentes das duas áreas de estudo', () => {
    const regions = buildRegionGlobePolygons();

    expect(regions.map((region) => region.regionId)).toEqual(['amazon_central', 'congo_basin_kisangani']);
    expect(regions.every(({ geometry }) => ['Polygon', 'MultiPolygon'].includes(geometry.type))).toBe(true);
    expect(regions[0].label).toContain('não representa toda a bacia amazônica');
    expect(regions[1].label).toContain('janela de amostragem candidata de Kisangani');
    expect(regions[1].label).toContain('não representa toda a bacia');
  });

  it('orients exterior rings for globe rendering', () => {
    const ring = buildRegionGlobePolygons()[0].geometry.coordinates[0] as GeoJSON.Position[];
    const signedArea = ring.slice(0, -1).reduce((area, point, index) => {
      const next = ring[index + 1];
      return area + point[0] * next[1] - next[0] * point[1];
    }, 0);

    expect(signedArea).toBeLessThan(0);
  });
});
