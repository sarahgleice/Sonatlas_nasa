import type { AvailabilityIndicator, BoundingBox } from '../types/dataset';
import type { SpatialGrid, SpatialGridManifest } from '../types/spatialGrid';

const manifestCache = new Map<string, Promise<SpatialGridManifest | null>>();
const matrixCache = new Map<string, Promise<unknown | null>>();
const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const isText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const isTimestamp = (value: unknown): value is string =>
  typeof value === 'string' && timestampPattern.test(value) && Number.isFinite(Date.parse(value));

function validBox(value: unknown): value is BoundingBox {
  if (!isRecord(value)) return false;
  const { min_latitude, max_latitude, min_longitude, max_longitude } = value;
  if (!isFiniteNumber(min_latitude) || !isFiniteNumber(max_latitude) ||
      !isFiniteNumber(min_longitude) || !isFiniteNumber(max_longitude)) return false;
  return min_latitude >= -90 && max_latitude <= 90 && min_latitude < max_latitude &&
    min_longitude >= -180 && max_longitude <= 180 && min_longitude < max_longitude;
}

function boxesMatch(a: BoundingBox, b: BoundingBox): boolean {
  const tolerance = 1e-6;
  return Math.abs(a.min_latitude - b.min_latitude) <= tolerance &&
    Math.abs(a.max_latitude - b.max_latitude) <= tolerance &&
    Math.abs(a.min_longitude - b.min_longitude) <= tolerance &&
    Math.abs(a.max_longitude - b.max_longitude) <= tolerance;
}

function validAxis(value: unknown, min: number, max: number): value is number[] {
  return Array.isArray(value) && value.length >= 2 && value.every(isFiniteNumber) &&
    value.every((coordinate, index) => coordinate >= min && coordinate <= max &&
      (index === 0 || coordinate > value[index - 1]));
}

function parseManifest(value: unknown, regionId: string, boundingBox: BoundingBox): SpatialGridManifest {
  if (!isRecord(value) || value.schema_version !== '1.0.0' || value.region_id !== regionId ||
      value.units !== 'mm/h' || !isText(value.data_source) || !isText(value.product_name) ||
      !isText(value.product_version) || !['preliminary_verified', 'candidate_under_review'].includes(String(value.validation_status)) ||
      !isFiniteNumber(value.spatial_resolution_degrees) || value.spatial_resolution_degrees <= 0 || !validBox(value.bounding_box) ||
      !validAxis(value.latitude_centers, value.bounding_box.min_latitude, value.bounding_box.max_latitude) ||
      !validAxis(value.longitude_centers, value.bounding_box.min_longitude, value.bounding_box.max_longitude) ||
      !Array.isArray(value.timestamps) || value.timestamps.length === 0) {
    throw new Error('Manifesto da grade espacial inválido.');
  }
  const spacing = value.spatial_resolution_degrees as number;
  const latitudes = value.latitude_centers as number[];
  const longitudes = value.longitude_centers as number[];
  if (latitudes.slice(1).some((center, index) => Math.abs(center - latitudes[index] - spacing) > 1e-6) ||
      longitudes.slice(1).some((center, index) => Math.abs(center - longitudes[index] - spacing) > 1e-6)) {
    throw new Error('Os centros da grade não correspondem à resolução espacial declarada.');
  }

  if (!boxesMatch(value.bounding_box, boundingBox)) {
    throw new Error('O recorte da grade espacial não corresponde à região selecionada.');
  }

  const seen = new Set<string>();
  for (const entry of value.timestamps) {
    if (!isRecord(entry) || !isTimestamp(entry.timestamp_utc) || seen.has(entry.timestamp_utc) ||
        typeof entry.matrix_path !== 'string' || !entry.matrix_path || entry.matrix_path.startsWith('/') ||
        entry.matrix_path.includes('\\') || entry.matrix_path.split('/').some((part) => !part || part === '.' || part === '..')) {
      throw new Error('Manifesto da grade espacial contém timestamp ou caminho inválido.');
    }
    seen.add(entry.timestamp_utc);
  }
  return value as unknown as SpatialGridManifest;
}

function cached<T>(cache: Map<string, Promise<T>>, key: string, load: () => Promise<T>): Promise<T> {
  const existing = cache.get(key);
  if (existing) return existing;
  const promise = load().catch((error: unknown) => {
    cache.delete(key);
    throw error;
  });
  cache.set(key, promise);
  return promise;
}

async function fetchJson(path: string): Promise<unknown | null> {
  const response = await fetch(path);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Falha ao carregar grade espacial (${response.status}).`);
  return response.json();
}

export class SpatialDataService {
  public static async loadGrid(
    datasetPath: string,
    regionId: string,
    boundingBox: BoundingBox,
    timestampUtc: string,
    expectedAvailability?: AvailabilityIndicator
  ): Promise<SpatialGrid | null> {
    if (!datasetPath.startsWith('/data/') || !datasetPath.endsWith('.json') || !isTimestamp(timestampUtc)) {
      throw new Error('Referência inválida para carregar a grade espacial.');
    }
    const directory = datasetPath.slice(0, datasetPath.lastIndexOf('/'));
    const manifestPath = `${directory}/spatial/manifest.json`;
    const manifest = await cached(manifestCache, manifestPath, async () => {
      const json = await fetchJson(manifestPath);
      return json === null ? null : parseManifest(json, regionId, boundingBox);
    });
    if (!manifest) return null;
    if (manifest.region_id !== regionId || !boxesMatch(manifest.bounding_box, boundingBox)) {
      throw new Error('O manifesto espacial não corresponde à região selecionada.');
    }

    const entry = manifest.timestamps.find((item) => item.timestamp_utc === timestampUtc);
    if (!entry) throw new Error('A grade espacial não contém o timestamp selecionado.');
    const matrixPath = `${directory}/spatial/${entry.matrix_path}`;
    const matrix = await cached(matrixCache, matrixPath, () => fetchJson(matrixPath));
    if (matrix === null) return null;
    if (!isRecord(matrix) || matrix.timestamp_utc !== timestampUtc || !Array.isArray(matrix.values) ||
        matrix.values.length !== manifest.latitude_centers.length ||
        !matrix.values.every((row) => Array.isArray(row) && row.length === manifest.longitude_centers.length &&
          row.every((cell) => cell === null || (isFiniteNumber(cell) && cell >= 0)))) {
      throw new Error('Matriz espacial inválida ou incompatível com o timestamp selecionado.');
    }
    const values = matrix.values as Array<Array<number | null>>;
    if (expectedAvailability && (expectedAvailability.total_cells_count !== values.length * manifest.longitude_centers.length ||
        expectedAvailability.missing_cells_count !== values.flat().filter((value) => value === null).length)) {
      throw new Error('A contagem de células da grade não corresponde aos indicadores da observação.');
    }
    return { manifest, timestamp_utc: timestampUtc, values, ...(expectedAvailability ? { availability: expectedAvailability } : {}) };
  }
}
