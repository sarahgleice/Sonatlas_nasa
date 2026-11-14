export interface RegionLimits {
  min_latitude: number;
  max_latitude: number;
  min_longitude: number;
  max_longitude: number;
}

export type RegionStatus = 'preliminary_verified' | 'proposed_pending_validation';

export interface StudyRegion {
  id: string;
    /** Outros ids desta região (ex.: o id usado no dataset do pipeline) */
  aliases?: string[];
  name: string;
  country: string;
  referenceCity: string;
  referencePoint: { lat: number; lon: number };
  status: RegionStatus;
  description: string;
  limits: RegionLimits;
  /** Nome do JSON de série temporal exportado pelo pipeline para esta região */
  seriesFile: string;
}

export interface PointSelection {
  lat: number;
  lon: number;
  /** id da região em que o ponto caiu, ou null se caiu fora de todas */
  regionId: string | null;
}

export interface GridInfo {
  step_degrees: number;
  rows: number;
  cols: number;
  total_cells: number;
}

/** Formato entregue à Hazel: bounding_box usa as mesmas chaves do dataset do pipeline */
export interface SelectionPayload {
  region_id: string;
  region_name: string;
  status: RegionStatus;
  series_file: string;
  bounding_box: RegionLimits;
  grid: GridInfo;
}