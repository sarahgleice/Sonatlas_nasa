import congoGeometrySource from '../../../processing/geometry/international/congo_basin_kisangani_bbox.geojson?raw';
import type { BoundingBox } from '../types/dataset';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseCongoGeoJson(source: string): GeoJSON.FeatureCollection | null {
  try {
    const collection: unknown = JSON.parse(source);
    if (!isRecord(collection) || collection.type !== 'FeatureCollection' || !Array.isArray(collection.features)) {
      return null;
    }
    return collection as unknown as GeoJSON.FeatureCollection;
  } catch {
    return null;
  }
}

export function matchesCongoBoundingBox(collection: GeoJSON.FeatureCollection, box: BoundingBox): boolean {
  if (!collection.features || collection.features.length === 0) return false;
  const geom = collection.features[0].geometry;
  if (geom.type !== 'Polygon') return false;
  const coords = geom.coordinates[0];
  const lons = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);
  const epsilon = 1e-4;
  return Math.abs(Math.min(...lats) - box.min_latitude) < epsilon &&
    Math.abs(Math.max(...lats) - box.max_latitude) < epsilon &&
    Math.abs(Math.min(...lons) - box.min_longitude) < epsilon &&
    Math.abs(Math.max(...lons) - box.max_longitude) < epsilon;
}

export const congoBasinKisanganiGeoJson = parseCongoGeoJson(congoGeometrySource);
