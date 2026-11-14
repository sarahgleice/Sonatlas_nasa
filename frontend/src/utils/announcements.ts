import { TemporalObservation } from '../types/dataset';
import { LiveAnnouncement, StepChangeSource } from '../types/player';
import {
  formatAreaFraction,
  formatAvailabilityStatus,
  formatPrecipitationRate,
  formatTimestamp,
  getIntensityLabel,
  getObservationDataState
} from './formatters';

export interface AnnouncementInput {
  source: StepChangeSource;
  observation: TemporalObservation | null;
  index: number;
  total: number;
  previousObservation?: TemporalObservation | null;
  isMuted?: boolean;
}

export type AnnouncementPayload = Omit<LiveAnnouncement, 'id'>;

/**
 * Gera texto descritivo completo para leitura manual de um passo da série.
 * Nunca expressa dado ausente como zero precipitação.
 */
export function formatObservationAnnouncementText(
  observation: TemporalObservation,
  index: number,
  total: number
): string {
  const stepPrefix = `Passo ${index + 1} de ${total}, ${formatTimestamp(observation.timestamp_utc)}`;
  const state = getObservationDataState(observation);

  if (state === 'missing') {
    return `${stepPrefix}: Dados ausentes, medição de satélite indisponível neste intervalo.`;
  }

  const meanRate = observation.scientific_indicators.mean_precipitation_rate.value;
  const areaFraction = observation.scientific_indicators.rain_area_fraction.value;
  const rateText = formatPrecipitationRate(meanRate);
  const intensityText = getIntensityLabel(meanRate);
  const areaText = areaFraction !== null && areaFraction !== undefined
    ? `cobertura de área com chuva ${formatAreaFraction(areaFraction)}`
    : 'cobertura de área não disponível';

  const partialSuffix = observation.availability.status === 'partial'
    ? ` (${formatAvailabilityStatus('partial')}, ${Math.round(observation.availability.valid_cells_ratio * 100)}% válido)`
    : '';

  return `${stepPrefix}: ${rateText}, ${intensityText}, ${areaText}${partialSuffix}.`;
}

/**
 * Política determinística anti-spam para anúncios de acessibilidade via aria-live.
 */
export function buildAnnouncement({
  source,
  observation,
  index,
  total,
  previousObservation = null,
  isMuted = false
}: AnnouncementInput): AnnouncementPayload | null {
  if (!observation || total <= 0) {
    return null;
  }

  const state = getObservationDataState(observation);

  switch (source) {
    case 'slider_step':
      // O controle role="slider" anuncia nativamente aria-valuetext quando focado.
      return null;

    case 'manual_step':
      return {
        text: formatObservationAnnouncementText(observation, index, total),
        politeness: 'polite'
      };

    case 'play_start': {
      const parts = [`Reprodução iniciada no passo ${index + 1} de ${total}.`];
      if (state === 'missing') {
        parts.push('Dados ausentes neste período.');
      }
      if (isMuted) {
        parts.push('Áudio silenciado; avanço visual ativo.');
      }
      return {
        text: parts.join(' '),
        politeness: 'polite'
      };
    }

    case 'playback_auto': {
      const prevState = previousObservation ? getObservationDataState(previousObservation) : null;
      if (state === 'missing' && prevState !== 'missing') {
        return {
          text: `Alerta: passo ${index + 1} sem dados disponíveis.`,
          politeness: 'assertive'
        };
      }
      return null;
    }

    case 'playback_pause':
      return {
        text: `Reprodução pausada. ${formatObservationAnnouncementText(observation, index, total)}`,
        politeness: 'polite'
      };

    case 'playback_end':
      return {
        text: `Sequência concluída no passo ${total} de ${total}.`,
        politeness: 'polite'
      };
  }
}
