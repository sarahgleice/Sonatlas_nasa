import { TemporalObservation } from '../types/dataset';
import { SonificationExplanation } from '../types/player';
import { mapCoverageToPulses, mapRateToFrequency } from '../audio/sonificationMapping';
import { formatAreaFraction, formatPrecipitationRate, getObservationDataState } from './formatters';

/** Diferenças de taxa abaixo deste valor (mm/h) são tratadas como "estável". */
export const RATE_STABILITY_THRESHOLD_MM_H = 0.05;

/** Descrição do sinal sonoro usado quando não há medição (AudioEngine.playAlertTone). */
export const MISSING_DATA_TONE_DESCRIPTION = 'tom de alerta grave e áspero (onda quadrada em cerca de 150 Hz)';

function sentence(text: string): string {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function pulsesLabel(count: number): string {
  return count === 1 ? '1 pulso' : `${count} pulsos`;
}

function signedRate(delta: number): string {
  if (delta === 0) return formatPrecipitationRate(0);
  return `${delta > 0 ? '+' : '−'}${formatPrecipitationRate(Math.abs(delta))}`;
}

function buildFullText(parts: Array<string>): string {
  return parts.map(sentence).join(' ');
}

/**
 * Explicação determinística do que foi ouvido, calculada somente a partir dos indicadores reais
 * (taxa média, fração de área com chuva) e do mapeamento de sonificação. Mesma entrada, mesmo texto.
 */
export function buildSonificationExplanation(
  current: TemporalObservation | null,
  previous: TemporalObservation | null,
  index: number,
  total: number
): SonificationExplanation {
  const stepLabel = `Passo ${index + 1} de ${total}`;

  if (!current) {
    const headline = 'Nenhuma observação selecionada';
    const text = 'Selecione um passo da linha do tempo para entender o que foi ouvido.';
    return {
      headline,
      pitchComparison: text,
      pulseComparison: '',
      temporalChange: '',
      fullText: buildFullText([headline, text])
    };
  }

  const currentState = getObservationDataState(current);

  if (currentState === 'missing') {
    const headline = `${stepLabel}: dado ausente`;
    const pitchComparison = `Você ouviu um ${MISSING_DATA_TONE_DESCRIPTION}, que sinaliza ausência de medição e não é uma nota de chuva`;
    const pulseComparison = 'A quantidade de pulsos deste sinal não representa cobertura de chuva';
    const temporalChange = 'Não é possível inferir chuva nem 0 mm/h, nem comparar com o passo anterior';
    return {
      headline,
      pitchComparison,
      pulseComparison,
      temporalChange,
      fullText: buildFullText([headline, pitchComparison, pulseComparison, temporalChange])
    };
  }

  const rate = current.scientific_indicators.mean_precipitation_rate.value as number;
  const coverage = current.scientific_indicators.rain_area_fraction.value;
  const frequency = mapRateToFrequency(rate);
  const pulses = mapCoverageToPulses(coverage);
  const coverageText = coverage === null ? 'cobertura de área indisponível' : `${formatAreaFraction(coverage)} da área com chuva`;
  const isDry = currentState === 'dry';

  const currentPitch = isDry
    ? `Tom de repouso grave (${frequency} Hz) para ${formatPrecipitationRate(rate)}${rate === 0 ? ', zero exato e dado válido' : ', abaixo do limiar de detecção de 0.1 mm/h'}`
    : `Nota de ${frequency} Hz para ${formatPrecipitationRate(rate)}`;
  const currentPulses = `${pulsesLabel(pulses)} neste passo (${coverageText})`;

  // Primeiro passo da série: linha de base.
  if (index === 0) {
    const headline = `${stepLabel}: linha de base`;
    const temporalChange = 'É o primeiro passo da série, então não há passo anterior para comparar';
    return {
      headline,
      pitchComparison: currentPitch,
      pulseComparison: currentPulses,
      temporalChange,
      fullText: buildFullText([headline, currentPitch, currentPulses, temporalChange])
    };
  }

  if (!previous) {
    const headline = `${stepLabel}: comparação temporal indisponível`;
    const temporalChange = 'Não há observação consecutiva para comparar através desta lacuna temporal';
    return {
      headline,
      pitchComparison: currentPitch,
      pulseComparison: currentPulses,
      temporalChange,
      fullText: buildFullText([headline, currentPitch, currentPulses, temporalChange])
    };
  }

  // Passo anterior sem dado: retomada da série, variação indisponível.
  if (getObservationDataState(previous) === 'missing') {
    const headline = `${stepLabel}: retomada após dado ausente`;
    const temporalChange = 'O passo anterior não tem dados, então a variação (ΔR) está indisponível; não há comparação válida';
    return {
      headline,
      pitchComparison: currentPitch,
      pulseComparison: currentPulses,
      temporalChange,
      fullText: buildFullText([headline, currentPitch, currentPulses, temporalChange])
    };
  }

  const previousRate = previous.scientific_indicators.mean_precipitation_rate.value as number;
  const previousCoverage = previous.scientific_indicators.rain_area_fraction.value;
  const previousPulses = mapCoverageToPulses(previousCoverage);
  const previousIsDry = getObservationDataState(previous) === 'dry';
  const delta = rate - previousRate;

  let headline: string;
  let pitchComparison: string;

  if (isDry && previousIsDry) {
    headline = `${stepLabel}: sem precipitação mensurável`;
    pitchComparison = `${currentPitch}. O tom é o mesmo tom de repouso do passo anterior, pois ambos estão abaixo do limiar de detecção`;
  } else if (Math.abs(delta) < RATE_STABILITY_THRESHOLD_MM_H) {
    headline = `${stepLabel}: intensidade estável`;
    pitchComparison = `${currentPitch}. A nota é praticamente a mesma do passo anterior`;
  } else if (delta > 0) {
    headline = `${stepLabel}: precipitação mais intensa que a anterior`;
    pitchComparison = `${currentPitch}. A nota ficou mais aguda que no passo anterior, representando o aumento da intensidade`;
  } else {
    headline = `${stepLabel}: precipitação mais fraca que a anterior`;
    pitchComparison = `${currentPitch}. A nota ficou mais grave que no passo anterior, representando a redução da intensidade`;
  }

  let pulseComparison: string;
  if (pulses === previousPulses) {
    pulseComparison = `${currentPulses}. A densidade de pulsos é igual à do passo anterior`;
  } else if (pulses > previousPulses) {
    pulseComparison = `${currentPulses}. Os pulsos ficaram mais densos, indicando que a chuva se espalhou por uma proporção maior da área`;
  } else {
    pulseComparison = `${currentPulses}. Os pulsos ficaram mais espaçados, indicando que a chuva se concentrou em uma proporção menor da área`;
  }

  const temporalChange = `Variação de intensidade em relação ao passo anterior (ΔR): ${signedRate(delta)}`;

  return {
    headline,
    pitchComparison,
    pulseComparison,
    temporalChange,
    fullText: buildFullText([headline, pitchComparison, pulseComparison, temporalChange])
  };
}
