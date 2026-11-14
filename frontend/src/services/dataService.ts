import { RegionDataset, RegionOption } from '../types/dataset';

export const AVAILABLE_REGIONS: RegionOption[] = [
  {
    id: 'amazon_central',
    name: 'Amazônia Central',
    country: 'Brasil',
    filePath: '/data/amazon/observations.json',
    status: 'active'
  },
  {
    id: 'international_candidate',
    name: 'Região Internacional (Bacia do Congo)',
    country: 'África Central (Em validação)',
    filePath: '/data/international_candidate_series.json',
    status: 'candidate'
  }
];

const isRecord = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

function isMetric(metric: unknown, unit: string, min: number, max = Infinity): boolean {
  return isRecord(metric) && (metric.value === null || (isFiniteNumber(metric.value) && metric.value >= min && metric.value <= max)) &&
    metric.unit === unit && isText(metric.description) &&
    (metric.threshold_rate_mm_h === undefined || (isFiniteNumber(metric.threshold_rate_mm_h) && metric.threshold_rate_mm_h >= 0));
}

function isObservation(value: unknown, index: number): boolean {
  if (!isRecord(value) || !isText(value.observation_id) || value.step_index !== index ||
      typeof value.timestamp_utc !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value.timestamp_utc) ||
      !Number.isFinite(Date.parse(value.timestamp_utc)) || !isRecord(value.availability) ||
      !isRecord(value.scientific_indicators) || !isRecord(value.visual_frame_reference) || !isText(value.textual_summary)) return false;

  const availability = value.availability;
  const { status, valid_cells_ratio: ratio, missing_cells_count: missing, total_cells_count: total } = availability;
  // The Python pipeline rounds valid_cells_ratio to three decimal places.
  if (!['available', 'partial', 'missing'].includes(status) || !Number.isInteger(total) || total <= 0 ||
      !Number.isInteger(missing) || missing < 0 || missing > total || !isFiniteNumber(ratio) || ratio < 0 || ratio > 1 ||
      Math.abs(ratio - (total - missing) / total) > 0.0005 ||
      status !== (ratio >= 0.8 ? 'available' : ratio >= 0.1 ? 'partial' : 'missing')) return false;

  const indicators = value.scientific_indicators;
  const isRainFraction = isRecord(indicators.rain_area_fraction) &&
    (indicators.rain_area_fraction.value === null || (isFiniteNumber(indicators.rain_area_fraction.value) && indicators.rain_area_fraction.value >= 0 && indicators.rain_area_fraction.value <= 1)) &&
    ['percentage', 'fraction'].includes(indicators.rain_area_fraction.unit) && isText(indicators.rain_area_fraction.description) &&
    (indicators.rain_area_fraction.threshold_rate_mm_h === undefined || (isFiniteNumber(indicators.rain_area_fraction.threshold_rate_mm_h) && indicators.rain_area_fraction.threshold_rate_mm_h >= 0));
  const tempDiff = indicators.temporal_difference ?? indicators.temporal_variance;

  if (!isMetric(indicators.mean_precipitation_rate, 'mm/h', 0) ||
      !isRainFraction ||
      (indicators.max_precipitation_rate !== undefined && !isMetric(indicators.max_precipitation_rate, 'mm/h', 0)) ||
      (tempDiff !== undefined && !isMetric(tempDiff, 'mm/h', -Infinity))) return false;
  if (status === 'missing' && [indicators.mean_precipitation_rate, indicators.rain_area_fraction,
      indicators.max_precipitation_rate, indicators.temporal_variance].some((metric) => isRecord(metric) && metric.value !== null)) return false;

  const frame = value.visual_frame_reference;
  return isText(frame.frame_id) && typeof frame.image_path === 'string' && isText(frame.source_system) && isText(frame.alt_text) &&
    ['verified', 'pending_official_validation'].includes(frame.synchronization_status);
}

function isRegionDataset(value: unknown): value is RegionDataset {
  if (!isRecord(value) || !isText(value.dataset_version) || !isText(value.region_id) || !isText(value.region_name) ||
      !isText(value.country) || !isText(value.data_source) || !isText(value.product_name) || !isText(value.product_version) ||
      !isText(value.phenomenon) || !isText(value.temporal_resolution) || typeof value.is_sample !== 'boolean' ||
      (value.is_placeholder !== undefined && typeof value.is_placeholder !== 'boolean') ||
      !['preliminary_verified', 'candidate_under_review'].includes(value.validation_status) ||
      (value.metadata_url !== undefined && !isText(value.metadata_url)) || (value.note !== undefined && !isText(value.note)) ||
      !isRecord(value.bounding_box) || !Array.isArray(value.observations)) return false;

  const box = value.bounding_box;
  if (![box.min_latitude, box.max_latitude, box.min_longitude, box.max_longitude].every(isFiniteNumber) ||
      box.min_latitude < -90 || box.max_latitude > 90 || box.min_latitude >= box.max_latitude ||
      box.min_longitude < -180 || box.max_longitude > 180 || box.min_longitude >= box.max_longitude) return false;

  return value.observations.every(isObservation) && value.observations.every((observation: unknown, index: number, observations: unknown[]) => {
    const previous = observations[index - 1];
    return index === 0 || (isRecord(observation) && isRecord(previous) &&
      typeof observation.timestamp_utc === 'string' && typeof previous.timestamp_utc === 'string' &&
      Date.parse(observation.timestamp_utc) > Date.parse(previous.timestamp_utc));
  });
}

export class DataService {
  public static async loadRegionDataset(filePath: string): Promise<RegionDataset> {
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`Falha ao carregar dataset em '${filePath}': ${response.statusText}`);
    }
    const data: unknown = await response.json();
    if (!isRegionDataset(data)) {
      throw new Error(`Formato de dataset inválido em '${filePath}': contrato RegionDataset inválido.`);
    }
    return data;
  }
}
