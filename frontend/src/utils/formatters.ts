import { AvailabilityIndicator, TemporalObservation } from '../types/dataset';
import { ObservationDataState } from '../types/player';

/**
 * Utilitários de formatação textual e unidades para o SONATLAS.
 */

export const RAIN_DETECTION_THRESHOLD_MM_H = 0.1;

export function formatPrecipitationRate(rate: number | null | undefined): string {
  if (rate === null || rate === undefined) {
    return 'Não disponível';
  }
  const formatted = rate > 0 && rate < 0.1
    ? new Intl.NumberFormat('pt-BR', { maximumSignificantDigits: 3 }).format(rate)
    : rate.toFixed(1);
  return `${formatted} mm/h`;
}

export function formatAreaFraction(fraction: number | null | undefined): string {
  if (fraction === null || fraction === undefined) {
    return 'Não disponível';
  }
  return `${(fraction * 100).toFixed(0)}%`;
}

export function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) {
      return isoString;
    }
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC'
    }).format(date) + ' (UTC)';
  } catch {
    return isoString;
  }
}

export function formatUtcTimeShort(isoString: string, includeDate = false): string {
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) {
      return isoString;
    }
    const formatted = new Intl.DateTimeFormat('pt-BR', {
      ...(includeDate ? { day: '2-digit', month: '2-digit' } : {}),
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC'
    }).format(date);
    return `${formatted} UTC`;
  } catch {
    return isoString;
  }
}

export function hasMultipleUtcDays(observations: readonly TemporalObservation[]): boolean {
  if (observations.length < 2) return false;
  const days = new Set(
    observations.map((obs) => {
      const date = new Date(obs.timestamp_utc);
      return Number.isNaN(date.getTime()) ? obs.timestamp_utc.slice(0, 10) : date.toISOString().slice(0, 10);
    })
  );
  return days.size > 1;
}

export function formatAvailabilityStatus(status: AvailabilityIndicator['status']): string {
  switch (status) {
    case 'available':
      return 'Disponível';
    case 'partial':
      return 'Disponibilidade parcial';
    case 'missing':
      return 'Dados ausentes';
  }
}

export function getObservationDataState(observation: TemporalObservation): ObservationDataState {
  const rate = observation.scientific_indicators.mean_precipitation_rate.value;
  if (observation.availability.status === 'missing' || rate === null || rate === undefined) {
    return 'missing';
  }
  if (rate < RAIN_DETECTION_THRESHOLD_MM_H) {
    return 'dry';
  }
  return 'rain';
}

export function getIntensityLabel(rate: number | null | undefined): string {
  if (rate === null || rate === undefined) return 'Indisponível';
  if (rate === 0) return 'Taxa média registrada como zero';
  if (rate < RAIN_DETECTION_THRESHOLD_MM_H) return 'Abaixo do limiar operacional do som';
  if (rate < 2.5) return 'Chuva fraca';
  if (rate < 10.0) return 'Chuva moderada';
  return 'Chuva forte / tempestade';
}

export function getRatePresentationNote(rate: number | null | undefined): string | null {
  if (rate === null || rate === undefined) return 'Taxa média indisponível; dado ausente não equivale a taxa zero.';
  if (rate === 0) return `Taxa média registrada: ${formatPrecipitationRate(rate)}. O áudio usa o tom de repouso pela regra operacional de 0,1 mm/h.`;
  if (rate > 0 && rate < 0.1) return `Taxa média registrada: ${formatPrecipitationRate(rate)}. O valor é positivo e está abaixo do limiar operacional sonoro de 0,1 mm/h; por isso, o áudio usa o tom de repouso. O som não altera a medição.`;
  return null;
}
