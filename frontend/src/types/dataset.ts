/**
 * Definições formais de tipos TypeScript para o SONATLAS.
 * Alinhado estritamente com docs/architecture/data-dictionary.md.
 */

export interface BoundingBox {
  min_latitude: number;
  max_latitude: number;
  min_longitude: number;
  max_longitude: number;
}

export interface AvailabilityIndicator {
  status: 'available' | 'partial' | 'missing';
  valid_cells_ratio: number;
  missing_cells_count: number;
  total_cells_count: number;
}

export interface MetricValue<T> {
  value: T | null;
  unit: string;
  metric_type?: string;
  description: string;
  threshold_rate_mm_h?: number;
}

export interface ScientificIndicators {
  mean_precipitation_rate: MetricValue<number>;
  rain_area_fraction: MetricValue<number>;
  max_precipitation_rate?: MetricValue<number>;
  temporal_difference?: MetricValue<number>;
  temporal_change?: MetricValue<number>;
  temporal_variance?: MetricValue<number>;
}

export interface VisualFrameReference {
  frame_id: string;
  image_path: string;
  source_system: string;
  synchronization_status: 'verified' | 'pending_official_validation';
  alt_text: string;
}

export interface TemporalObservation {
  observation_id: string;
  step_index: number;
  timestamp_utc: string;
  availability: AvailabilityIndicator;
  scientific_indicators: ScientificIndicators;
  visual_frame_reference: VisualFrameReference;
  textual_summary: string;
}

export interface RegionDataset {
  dataset_version: string;
  region_id: string;
  region_name: string;
  country: string;
  bounding_box: BoundingBox;
  data_source: string;
  product_name: string;
  product_version: string;
  phenomenon: string;
  temporal_resolution: string;
  is_sample: boolean;
  is_placeholder?: boolean;
  validation_status: 'preliminary_verified' | 'candidate_under_review';
  metadata_url?: string;
  note?: string;
  observations: TemporalObservation[];
}

export interface RegionOption {
  id: string;
  name: string;
  country: string;
  filePath: string;
  status: 'active' | 'candidate';
}

export interface SonificationParams {
  frequency: number; // Hz (pitch)
  pulseCount: number; // Density
  durationMs: number;
  isMissing: boolean;
}
