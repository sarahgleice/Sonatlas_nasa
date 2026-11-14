import amazonCentralGeometrySource from '../../../processing/geometry/amazon/central_amazon_bbox.geojson?raw';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPosition(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length >= 2 &&
    Number.isFinite(value[0]) && Number.isFinite(value[1]) &&
    value[0] >= -180 && value[0] <= 180 && value[1] >= -90 && value[1] <= 90;
}

function isLinearRing(value: unknown): boolean {
  if (!Array.isArray(value) || value.length < 4 || !value.every(isPosition)) return false;
  const first = value[0];
  const last = value[value.length - 1];
  return first[0] === last[0] && first[1] === last[1];
}

function isPolygonCoordinates(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0 && value.every(isLinearRing);
}

export function parseAmazonCentralGeoJson(source: string): GeoJSON.GeoJsonObject | null {
  try {
    const collection: unknown = JSON.parse(source);
    if (!isRecord(collection) || collection.type !== 'FeatureCollection' || !Array.isArray(collection.features)) return null;

    const features = collection.features.filter((feature) =>
      isRecord(feature) && feature.type === 'Feature' && isRecord(feature.properties) &&
      feature.properties.region_id === 'amazon_central' &&
      feature.properties.status === 'preliminary_verified' && isRecord(feature.geometry) &&
      (feature.geometry.type === 'Polygon'
        ? isPolygonCoordinates(feature.geometry.coordinates)
        : feature.geometry.type === 'MultiPolygon' && Array.isArray(feature.geometry.coordinates) &&
          feature.geometry.coordinates.length > 0 && feature.geometry.coordinates.every(isPolygonCoordinates))
    );

    return features.length === 1
      ? { ...collection, features } as unknown as GeoJSON.GeoJsonObject
      : null;
  } catch {
    return null;
  }
}

export const amazonCentralGeoJson = parseAmazonCentralGeoJson(amazonCentralGeometrySource);
