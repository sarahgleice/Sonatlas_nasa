import { describe, expect, it } from 'vitest';
import {
  STUDY_REGIONS,
  buildSelectionPayload,
  findRegionAtPoint,
  getGridInfo,
  getRegionById,
  regionToFeature,
  toDatasetRegionId,
} from '../src/maps/regions';

describe('regiões de estudo', () => {
  it('Manaus cai na Amazônia Central', () => {
    expect(findRegionAtPoint(-3.119, -60.0217)?.id).toBe('amazon_central');
  });

  it('Kisangani cai na Bacia do Congo', () => {
    expect(findRegionAtPoint(0.5153, 25.191)?.id).toBe('congo_basin_kisangani');
  });

  it('ponto fora das regiões não retorna nada', () => {
    expect(findRegionAtPoint(0, 0)).toBeUndefined();
  });

  it('latitude e longitude invertidas não caem em nenhuma região', () => {
    expect(findRegionAtPoint(-60.0217, -3.119)).toBeUndefined();
  });

  it('a grade da Amazônia Central tem 25 x 30 = 750 células', () => {
    const grid = getGridInfo(STUDY_REGIONS[0].limits);
    expect(grid.rows).toBe(25);
    expect(grid.cols).toBe(30);
    expect(grid.total_cells).toBe(750);
  });

  it('o polígono GeoJSON é fechado e usa [lon, lat]', () => {
    const ring = regionToFeature(STUDY_REGIONS[0]).geometry.coordinates[0];
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    expect(ring[0]).toEqual([-61.5, -4.0]);
  });

  it('o payload da Hazel traz bounding_box com as chaves do pipeline', () => {
    const payload = buildSelectionPayload(STUDY_REGIONS[0]);
    expect(payload.bounding_box).toEqual({
      min_latitude: -4.0,
      max_latitude: -1.5,
      min_longitude: -61.5,
      max_longitude: -58.5,
    });
  });
    it('o id do dataset do pipeline resolve para a região do Congo', () => {
    expect(getRegionById('international_candidate')?.id).toBe('congo_basin_kisangani');
  });

  it('toDatasetRegionId devolve o id que o menu usa', () => {
    expect(toDatasetRegionId(STUDY_REGIONS[0])).toBe('amazon_central');
    expect(toDatasetRegionId(STUDY_REGIONS[1])).toBe('international_candidate');
  });
});