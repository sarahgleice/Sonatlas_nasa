import type {
  GridInfo,
  PointSelection,
  RegionLimits,
  SelectionPayload,
  StudyRegion,
} from './regionTypes';

/** Resolução da grade IMERG, em graus */
export const GRID_STEP_DEGREES = 0.1;

/**
 * Regiões de estudo. Os limites da Amazônia Central vêm de
 * processing/geometry/amazon/central_amazon_bbox.geojson e os do Congo de
 * processing/geometry/international/congo_basin_kisangani_bbox.geojson.
 * Se um mudar, atualize o outro.
 */
export const STUDY_REGIONS: StudyRegion[] = [
  {
    id: 'amazon_central',
    name: 'Amazônia Central',
    country: 'Brasil',
    referenceCity: 'Manaus',
    referencePoint: { lat: -3.119, lon: -60.0217 },
    status: 'preliminary_verified',
    description:
      'Área de estudo proposta no entorno de Manaus. Recorte específico, não representa toda a Amazônia.',
    limits: {
      min_latitude: -4.0,
      max_latitude: -1.5,
      min_longitude: -61.5,
      max_longitude: -58.5,
    },
    seriesFile: 'amazon_central_series.json',
  },
  {
    id: 'congo_basin_kisangani',
    aliases: ['international_candidate'],
    name: 'Bacia do Congo',
    country: 'República Democrática do Congo',
    referenceCity: 'Kisangani',
    referencePoint: { lat: 0.5153, lon: 25.191 },
    status: 'proposed_pending_validation',
    description:
      'Área de estudo proposta no entorno de Kisangani. Recorte específico, não representa toda a bacia. Aguarda validação científica.',
    limits: {
      min_latitude: -0.8,
      max_latitude: 1.7,
      min_longitude: 23.7,
      max_longitude: 26.7,
    },
    seriesFile: 'international_candidate_series.json',
  },
];

export function getRegionById(
  id: string,
  regions: StudyRegion[] = STUDY_REGIONS,
): StudyRegion | undefined {
  return regions.find((r) => r.id === id || (r.aliases ?? []).includes(id));
}

/** Id que o menu/dataset usa para esta região (o primeiro apelido, se existir) */
export function toDatasetRegionId(region: StudyRegion): string {
  return region.aliases?.[0] ?? region.id;
}

/** Formato [[sul, oeste], [norte, leste]] que o Leaflet entende */
export function limitsToBounds(l: RegionLimits): [[number, number], [number, number]] {
  return [
    [l.min_latitude, l.min_longitude],
    [l.max_latitude, l.max_longitude],
  ];
}

export function isPointInLimits(lat: number, lon: number, l: RegionLimits): boolean {
  return (
    lat >= l.min_latitude &&
    lat <= l.max_latitude &&
    lon >= l.min_longitude &&
    lon <= l.max_longitude
  );
}

export function findRegionAtPoint(
  lat: number,
  lon: number,
  regions: StudyRegion[] = STUDY_REGIONS,
): StudyRegion | undefined {
  return regions.find((r) => isPointInLimits(lat, lon, r.limits));
}

export function getGridInfo(limits: RegionLimits, step: number = GRID_STEP_DEGREES): GridInfo {
  const rows = Math.round((limits.max_latitude - limits.min_latitude) / step);
  const cols = Math.round((limits.max_longitude - limits.min_longitude) / step);
  return { step_degrees: step, rows, cols, total_cells: rows * cols };
}

/** Objeto pronto para a Hazel usar no processamento */
export function buildSelectionPayload(region: StudyRegion): SelectionPayload {
  return {
    region_id: region.id,
    region_name: region.name,
    status: region.status,
    series_file: region.seriesFile,
    bounding_box: { ...region.limits },
    grid: getGridInfo(region.limits),
  };
}

/** Converte a região em Feature GeoJSON (atenção: GeoJSON usa [longitude, latitude]) */
export function regionToFeature(region: StudyRegion) {
  const l = region.limits;
  return {
    type: 'Feature' as const,
    properties: {
      region_id: region.id,
      region_name: region.name,
      country: region.country,
      status: region.status,
    },
    geometry: {
      type: 'Polygon' as const,
      coordinates: [
        [
          [l.min_longitude, l.min_latitude],
          [l.max_longitude, l.min_latitude],
          [l.max_longitude, l.max_latitude],
          [l.min_longitude, l.max_latitude],
          [l.min_longitude, l.min_latitude],
        ],
      ],
    },
  };
}

export function regionsToFeatureCollection(regions: StudyRegion[] = STUDY_REGIONS) {
  return {
    type: 'FeatureCollection' as const,
    features: regions.map(regionToFeature),
  };
}

export function roundCoord(value: number, decimals = 5): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

export type { PointSelection };