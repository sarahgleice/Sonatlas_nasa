import { amazonCentralGeoJson } from './amazonGeometry';
import { congoBasinKisanganiGeoJson } from './congoGeometry';
import { STUDY_REGIONS } from './regions';

export interface RegionGlobePolygon {
  regionId: string;
  label: string;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
}

function geometryForGlobe(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon): GeoJSON.Polygon | GeoJSON.MultiPolygon {
  // D3 (used by three-globe) interprets GeoJSON exterior rings with the opposite winding convention.
  const reverseRings = (rings: GeoJSON.Position[][]): GeoJSON.Position[][] => rings.map((ring) => [...ring].reverse());
  return geometry.type === 'Polygon'
    ? { ...geometry, coordinates: reverseRings(geometry.coordinates) }
    : {
      ...geometry,
      coordinates: geometry.coordinates.map(reverseRings)
    };
}

export function buildRegionGlobePolygons(): RegionGlobePolygon[] {
  return STUDY_REGIONS.flatMap((region) => {
    const source = region.id === 'amazon_central' ? amazonCentralGeoJson
      : region.id === 'congo_basin_kisangani' ? congoBasinKisanganiGeoJson
        : null;
    if (!source) return [];

    return source.features.flatMap((feature) => {
      const { geometry } = feature;
      if (!geometry || (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon')) return [];
      const scope = region.id === 'congo_basin_kisangani'
        ? 'janela de amostragem candidata de Kisangani; não representa toda a bacia'
        : 'área de estudo; não representa toda a bacia amazônica';
      return [{ regionId: region.id, label: `${region.name} — ${scope}`, geometry: geometryForGlobe(geometry) }];
    });
  });
}
