import type { SpatialGrid } from '../types/spatialGrid';

export type CellBounds = [[number, number], [number, number]];

export function axisCellEdges(centers: number[], min: number, max: number): number[] {
  return [min, ...centers.slice(1).map((center, index) => (centers[index] + center) / 2), max];
}

export function precipitationColor(value: number | null): string {
  if (value === null) return '#64748b';
  if (value === 0) return '#cbd5e1';
  if (value < 0.5) return '#a78bfa';
  if (value < 1) return '#818cf8';
  if (value < 2.5) return '#22d3ee';
  if (value < 5) return '#facc15';
  return '#f97316';
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
