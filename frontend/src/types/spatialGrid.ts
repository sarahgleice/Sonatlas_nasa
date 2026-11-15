import type { BoundingBox } from './dataset';
import type { AvailabilityIndicator } from './dataset';

/** Contract for a region's cell-center grid. Matrix rows are south→north, columns west→east. */
export interface SpatialGridManifest {
  schema_version: '1.0.0';
  region_id: string;
  units: 'mm/h';
  data_source: string;
  product_name: string;
  product_version: string;
  validation_status: 'preliminary_verified' | 'candidate_under_review';
  spatial_resolution_degrees: number;
  bounding_box: BoundingBox;
  latitude_centers: number[];
  longitude_centers: number[];
  timestamps: Array<{ timestamp_utc: string; matrix_path: string }>;
  processing_provenance?: {
    generator: string;
    generated_at_utc: string;
    method: string;
    source_granules: Array<{
      timestamp_utc: string;
      filename: string;
      variable_name: string;
    }>;
  };
}

export interface SpatialGrid {
  manifest: SpatialGridManifest;
  timestamp_utc: string;
  values: Array<Array<number | null>>;
  availability?: AvailabilityIndicator;
}
