import React, { useEffect, useRef, useState } from 'react';
import { globalAudioEngine } from '../audio/AudioEngine';
import { mapCoverageToPulses, mapRateToFrequency, RAIN_DETECTION_THRESHOLD_MM_H } from '../audio/sonificationMapping';
import { MISSING_DATA_TONE_DESCRIPTION } from '../utils/scientificExplanation';
import { formatAreaFraction, formatPrecipitationRate } from '../utils/formatters';
import { Headphones, Info } from 'lucide-react';

const SAMPLE_DURATION_MS = 1500;

export interface LegendSample {
  id: string;
  label: string;
  rate: number | null;
  coverage: number | null;
  frequency: number;
  pulseCount: number;
  isMissing: boolean;
  description: string;
  ariaLabel: string;
}

function pulsesLabel(count: number): string {
  return count === 1 ? '1 pulso' : `${count} pulsos`;
}

function buildRainSample(id: string, label: string, rate: number, coverage: number, character: string): LegendSample {
  const frequency = mapRateToFrequency(rate);
  const pulseCount = mapCoverageToPulses(coverage);
  const rateText = formatPrecipitationRate(rate);
  const areaText = `${formatAreaFraction(coverage)} da área`;
  return {
    id,
    label,
    rate,
    coverage,
    frequency,
    pulseCount,
    isMissing: false,
    description: `${character} (${frequency} Hz) + ${pulsesLabel(pulseCount)} · exemplo: ${rateText}, ${areaText}`,
    ariaLabel: `Ouvir calibração: ${label}. ${character}, ${frequency} hertz, ${pulsesLabel(pulseCount)}. Exemplo de ${rateText} em ${areaText}.`
  };
}

/** Amostras de calibração derivadas diretamente do mapeamento de sonificação (sem números soltos). */
export function buildLegendSamples(): LegendSample[] {
  const dry = buildRainSample('dry', 'Tempo seco (0.0 mm/h)', 0, 0, 'Tom de repouso grave, dado válido sem chuva');
  dry.description = `Tom de repouso grave (${dry.frequency} Hz) + ${pulsesLabel(dry.pulseCount)} · dado válido: abaixo de ${RAIN_DETECTION_THRESHOLD_MM_H} mm/h`;
  dry.ariaLabel = `Ouvir calibração: tempo seco, zero milímetros por hora. Tom de repouso grave de ${dry.frequency} hertz. Isto é um dado válido, diferente de dado ausente.`;

  return [
    dry,
    buildRainSample('light', 'Chuva leve / localizada', 0.3, 0.05, 'Nota grave'),
    buildRainSample('moderate', 'Chuva moderada', 5, 0.5, 'Nota média'),
    buildRainSample('storm', 'Tempestade', 25, 0.85, 'Nota aguda'),
    {
      id: 'missing',
      label: 'Aviso de dado ausente',
      rate: null,
      coverage: null,
      frequency: 0,
      pulseCount: 2,
      isMissing: true,
      description: `${MISSING_DATA_TONE_DESCRIPTION}: satélite sem medição válida, diferente de zero chuva`,
      ariaLabel: `Ouvir calibração: aviso de dado ausente. ${MISSING_DATA_TONE_DESCRIPTION}. Não significa zero chuva.`
    }
  ];
}

const LEGEND_SAMPLES = buildLegendSamples();

export const SoundLegend: React.FC = () => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string>('');
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
  }, []);

  const playSample = (sample: LegendSample) => {
    if (globalAudioEngine.getIsMuted()) {
      setNotice('O áudio está silenciado. Ative o som (tecla M) para ouvir a calibração.');
      return;
    }
    try {
      // Interrompe a amostra anterior para evitar sobreposição ao clicar rápido.
      globalAudioEngine.stopPlayback();
      globalAudioEngine.playParams({
        frequency: sample.frequency,
        pulseCount: sample.pulseCount,
        durationMs: SAMPLE_DURATION_MS,
        isMissing: sample.isMissing
      });
      setNotice('');
      setActiveId(sample.id);
      if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = window.setTimeout(() => setActiveId(null), SAMPLE_DURATION_MS);
    } catch (error) {
      globalAudioEngine.reportError(error);
      setActiveId(null);
      setNotice('Não foi possível reproduzir o som. Verifique o áudio do navegador e tente novamente.');
    }
  };

  return (
    <section className="card sound-legend-card" aria-labelledby="sound-legend-title">
      <div className="card-header">
        <Headphones size={20} className="card-icon" aria-hidden="true" />
        <h3 id="sound-legend-title" className="card-title">
          Legenda Sonora & Calibração Auditiva
        </h3>
      </div>

      <p className="legend-intro">
        O SONATLAS usa a <strong>altura do som (frequência)</strong> para representar a intensidade da precipitação em mm/h
        e a <strong>densidade de pulsos (ritmo)</strong> para representar a cobertura da área com chuva. Taxas abaixo de{' '}
        {RAIN_DETECTION_THRESHOLD_MM_H} mm/h soam como o tom de repouso. A velocidade de reprodução muda só o ritmo entre
        os passos, nunca a altura do som. Clique nos botões abaixo para calibrar sua audição:
      </p>

      <div className="legend-grid">
        {LEGEND_SAMPLES.map((sample) => (
          <div className="legend-item" key={sample.id}>
            <button
              type="button"
              onClick={() => playSample(sample)}
              className={`btn btn-outline ${sample.isMissing ? 'btn-outline-warning' : ''}`}
              aria-label={sample.ariaLabel}
              aria-pressed={activeId === sample.id}
            >
              {sample.label}
            </button>
            <span className="legend-desc">{sample.description}</span>
          </div>
        ))}
      </div>

      <p className="legend-notice" role="status">{notice}</p>

      <div className="legend-note">
        <Info size={16} aria-hidden="true" />
        <span>Frequências e ritmos sujeitos a calibração contínua com feedback de usuários de leitores de tela.</span>
      </div>
    </section>
  );
};
