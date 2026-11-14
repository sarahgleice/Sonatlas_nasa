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
  if (rate > 0 && rate < 0.001) {
    return `${rate.toFixed(4)} mm/h`;
  }
  if (rate > 0 && rate < 0.05) {
    return `${rate.toFixed(3)} mm/h`;
  }
  return `${rate.toFixed(1)} mm/h`;
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
  if (rate === 0) return 'Sem precipitação (tempo seco)';
  if (rate < RAIN_DETECTION_THRESHOLD_MM_H) return 'Sem precipitação mensurável';
  if (rate < 2.5) return 'Chuva fraca';
  if (rate < 10.0) return 'Chuva moderada';
  return 'Chuva forte / tempestade';
}
