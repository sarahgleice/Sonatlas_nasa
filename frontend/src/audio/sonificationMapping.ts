import { TemporalObservation, SonificationParams } from '../types/dataset';

/**
 * Mapeamento psicoacústico de grandezas científicas em parâmetros de áudio.
 * Baseado estritamente em docs/science/sonification-method.md.
 */

export const FREQ_REST = 130; // Hz - Tom de repouso (C3) para calmaria / sem chuva
export const FREQ_MIN = 220;  // Hz - Limiar de chuva fraca (A3)
export const FREQ_MAX = 880;  // Hz - Limiar de chuva extrema (A5)
export const FREQ_ALERT = 300; // Hz - Tom de advertência para dados faltantes

/**
 * Converte taxa média de precipitação (mm/h) em frequência fundamental (Hz).
 */
export function mapRateToFrequency(rate: number | null | undefined): number {
  if (rate === null || rate === undefined) {
    return FREQ_ALERT;
  }
  if (rate < 0.1) {
    return FREQ_REST;
  }
  // Mapeamento logarítmico: f(R) = f_min + (f_max - f_min) * (log10(1 + R) / log10(1 + R_max))
  const rMax = 50.0;
  const normalized = Math.log10(1 + Math.min(rate, rMax)) / Math.log10(1 + rMax);
  return Math.round(FREQ_MIN + normalized * (FREQ_MAX - FREQ_MIN));
}

/**
 * Converte fração de área chuvosa (0.0 a 1.0) em quantidade de pulsos sonoros por passo.
 */
export function mapCoverageToPulses(coverage: number | null | undefined): number {
  if (coverage === null || coverage === undefined) {
    return 1;
  }
  if (coverage < 0.05) {
    return 1;
  }
  // 1 a 7 pulsos rítmicos por observação
  return Math.max(1, Math.min(7, Math.round(1 + coverage * 6)));
}

/**
 * Gera os parâmetros consolidados de sonificação para uma observação.
 */
export function createObservationSonificationParams(
  observation: TemporalObservation,
  stepDurationMs: number = 1500
): SonificationParams {
  const isMissing = observation.availability.status === 'missing' ||
    observation.scientific_indicators.mean_precipitation_rate.value === null ||
    observation.scientific_indicators.rain_area_fraction.value === null;

  if (isMissing) {
    return {
      frequency: FREQ_ALERT,
      pulseCount: 2,
      durationMs: stepDurationMs,
      isMissing: true
    };
  }

  const rate = observation.scientific_indicators.mean_precipitation_rate.value;
  const coverage = observation.scientific_indicators.rain_area_fraction.value;

  return {
    frequency: mapRateToFrequency(rate),
    pulseCount: mapCoverageToPulses(coverage),
    durationMs: stepDurationMs,
    isMissing: false
  };
}
