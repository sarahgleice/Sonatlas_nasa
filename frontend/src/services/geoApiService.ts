export interface GeoApiHealth {
  status: string;
  regioes_carregadas: number;
}

export interface GeoApiRegionSummary {
  region_id: string;
  region_name: string | null;
  country: string | null;
  status: string | null;
  is_placeholder: boolean;
  has_geometry: boolean;
  bbox: { south: number; west: number; north: number; east: number } | null;
  center: { lat: number; lon: number } | null;
}

export type GeoJsonGeometry =
  | { type: 'Point' | 'MultiPoint' | 'LineString' | 'MultiLineString' | 'Polygon' | 'MultiPolygon'; coordinates: unknown }
  | { type: 'GeometryCollection'; geometries: GeoJsonGeometry[] };

export interface GeoJsonFeature {
  type: 'Feature';
  geometry: GeoJsonGeometry | null;
  properties: Record<string, unknown> | null;
  id?: string | number;
  bbox?: number[];
}

export interface GeoApiLocateResult {
  lat: number;
  lon: number;
  regioes: string[];
  dentro_de_alguma: boolean;
}

export type GeoApiResult<T> = { available: true; data: T } | { available: false };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const isNullableText = (value: unknown): value is string | null =>
  value === null || typeof value === 'string';
const isPosition = (value: unknown): value is number[] =>
  Array.isArray(value) && value.length >= 2 && value.every(isFiniteNumber);
const isLine = (value: unknown): boolean =>
  Array.isArray(value) && value.length >= 2 && value.every(isPosition);
const isRing = (value: unknown): boolean =>
  Array.isArray(value) && value.length >= 4 && value.every(isPosition) &&
  JSON.stringify(value[0]) === JSON.stringify(value[value.length - 1]);

function isGeometry(value: unknown): value is GeoJsonGeometry {
  if (!isRecord(value) || typeof value.type !== 'string') return false;
  if (value.type === 'GeometryCollection') {
    return Array.isArray(value.geometries) && value.geometries.every(isGeometry);
  }
  const coordinates = value.coordinates;
  switch (value.type) {
    case 'Point': return isPosition(coordinates);
    case 'MultiPoint': return Array.isArray(coordinates) && coordinates.every(isPosition);
    case 'LineString': return isLine(coordinates);
    case 'MultiLineString': return Array.isArray(coordinates) && coordinates.every(isLine);
    case 'Polygon': return Array.isArray(coordinates) && coordinates.length > 0 && coordinates.every(isRing);
    case 'MultiPolygon': return Array.isArray(coordinates) && coordinates.length > 0 && coordinates.every(
      (polygon) => Array.isArray(polygon) && polygon.length > 0 && polygon.every(isRing),
    );
    default: return false;
  }
}

function isFeature(value: unknown): value is GeoJsonFeature {
  return isRecord(value) && value.type === 'Feature' &&
    (value.geometry === null || isGeometry(value.geometry)) &&
    (value.properties === null || isRecord(value.properties)) &&
    (value.id === undefined || typeof value.id === 'string' || isFiniteNumber(value.id)) &&
    (value.bbox === undefined || (Array.isArray(value.bbox) && value.bbox.length >= 4 && value.bbox.every(isFiniteNumber)));
}

function isHealth(value: unknown): value is GeoApiHealth {
  return isRecord(value) && typeof value.status === 'string' && isFiniteNumber(value.regioes_carregadas) &&
    Number.isInteger(value.regioes_carregadas) && value.regioes_carregadas >= 0;
}

function isRegionSummary(value: unknown): value is GeoApiRegionSummary {
  if (!isRecord(value)) return false;
  const { bbox, center } = value;
  return typeof value.region_id === 'string' && value.region_id.length > 0 &&
    isNullableText(value.region_name) && isNullableText(value.country) && isNullableText(value.status) &&
    typeof value.is_placeholder === 'boolean' && typeof value.has_geometry === 'boolean' &&
    (bbox === null || (isRecord(bbox) && isFiniteNumber(bbox.south) && isFiniteNumber(bbox.west) &&
      isFiniteNumber(bbox.north) && isFiniteNumber(bbox.east))) &&
    (center === null || (isRecord(center) && isFiniteNumber(center.lat) && isFiniteNumber(center.lon)));
}

function isLocateResult(value: unknown): value is GeoApiLocateResult {
  return isRecord(value) && isFiniteNumber(value.lat) && value.lat >= -90 && value.lat <= 90 &&
    isFiniteNumber(value.lon) && value.lon >= -180 && value.lon <= 180 &&
    Array.isArray(value.regioes) && value.regioes.every((region) => typeof region === 'string') &&
    typeof value.dentro_de_alguma === 'boolean' && value.dentro_de_alguma === (value.regioes.length > 0);
}

function apiBase(configuredValue: string | undefined): string | undefined {
  const configured = configuredValue?.trim();
  if (!configured) return undefined;
  const url = new URL(configured);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('VITE_GEO_API_URL deve usar HTTP ou HTTPS.');
  return url.href.replace(/\/+$/, '');
}

export function createGeoApiService(configuredUrl: string | undefined) {
  const base = apiBase(configuredUrl);
  const request = async <T>(path: string, validate: (value: unknown) => value is T, init?: RequestInit): Promise<GeoApiResult<T>> => {
    if (!base) return { available: false };

    const response = await fetch(`${base}${path}`, init);
    if (!response.ok) throw new Error(`Geo API retornou HTTP ${response.status}.`);
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new Error('Geo API retornou JSON inválido.');
    }
    if (!validate(payload)) throw new Error('Geo API retornou payload incompatível com o contrato.');
    return { available: true, data: payload };
  };

  return {
    getHealth: () => request('/health', isHealth),
    getRegions: () => request('/regions', (value): value is GeoApiRegionSummary[] =>
      Array.isArray(value) && value.every(isRegionSummary)),
    getRegion: (regionId: string) => request(`/regions/${encodeURIComponent(regionId)}`, isFeature),
    locate: (lat: number, lon: number) => {
      if (!isFiniteNumber(lat) || lat < -90 || lat > 90 || !isFiniteNumber(lon) || lon < -180 || lon > 180) {
        return Promise.reject(new Error('Coordenadas fora do intervalo válido.'));
      }
      return request('/locate', (value): value is GeoApiLocateResult =>
        isLocateResult(value) && value.lat === lat && value.lon === lon,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lat, lon }) });
    },
  };
}

export const geoApiService = createGeoApiService(
  (import.meta as ImportMeta & { env: { VITE_GEO_API_URL?: string } }).env.VITE_GEO_API_URL,
);
