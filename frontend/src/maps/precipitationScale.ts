import type { SpatialGrid } from '../types/spatialGrid';

export type CellBounds = [[number, number], [number, number]];
export interface PrecipitationPalette {
  missing: string;
  dry: string;
  steps: readonly string[];
}

const DEFAULT_PALETTE: PrecipitationPalette = {
  missing: '#64748b',
  dry: '#cbd5e1',
  steps: ['#a78bfa', '#818cf8', '#22d3ee', '#facc15', '#f97316']
};

export function axisCellEdges(centers: number[], min: number, max: number): number[] {
  return [min, ...centers.slice(1).map((center, index) => (centers[index] + center) / 2), max];
}

export function precipitationColor(value: number | null, palette: PrecipitationPalette = DEFAULT_PALETTE): string {
  if (value === null) return palette.missing;
  if (value === 0) return palette.dry;
  if (value < 0.5) return palette.steps[0];
  if (value < 1) return palette.steps[1];
  if (value < 2.5) return palette.steps[2];
  if (value < 5) return palette.steps[3];
  return palette.steps[4];
}

export function spatialGridCellBounds(grid: SpatialGrid): CellBounds[] {
  const { bounding_box: box, latitude_centers: lats, longitude_centers: lons } = grid.manifest;
  const latEdges = axisCellEdges(lats, box.min_latitude, box.max_latitude);
  const lonEdges = axisCellEdges(lons, box.min_longitude, box.max_longitude);
  return lats.flatMap((_, row) => lons.map((__, column) => [
    [latEdges[row], lonEdges[column]],
    [latEdges[row + 1], lonEdges[column + 1]]
  ] as CellBounds));
}
