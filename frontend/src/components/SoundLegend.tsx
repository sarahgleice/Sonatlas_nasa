import React from 'react';
import { globalAudioEngine } from '../audio/AudioEngine';
import { Headphones, Info } from 'lucide-react';

export const SoundLegend: React.FC = () => {
  const playSample = (freq: number, pulses: number, isMissing: boolean = false) => {
    globalAudioEngine.playParams({
      frequency: freq,
      pulseCount: pulses,
      durationMs: 1500,
      isMissing
    });
  };

  return (
    <section className="card sound-legend-card" aria-labelledby="sound-legend-title">
      <div className="card-header">
        <Headphones size={20} className="card-icon" aria-hidden="true" />
        <h2 id="sound-legend-title" className="card-title">
          Legenda Sonora & Calibração Auditiva
        </h2>
      </div>

      <p className="legend-intro">
        O SONATLAS utiliza a <strong>altura do som (frequência)</strong> para representar a intensidade da precipitação e a <strong>densidade de pulsos (ritmo)</strong> para representar a cobertura da área. Clique nos botões abaixo para calibrar sua audição:
      </p>

      <div className="legend-grid">
        <div className="legend-item">
          <button
            onClick={() => playSample(240, 1)}
            className="btn btn-outline"
            aria-label="Ouvir calibração para Chuva Fraca e Localizada: som grave com pulso único espaçado"
          >
            Chuva Leve / Localizada
          </button>
          <span className="legend-desc">Som grave (240 Hz) + 1 pulso lento (área restrita &lt; 20%)</span>
        </div>

        <div className="legend-item">
          <button
            onClick={() => playSample(440, 3)}
            className="btn btn-outline"
            aria-label="Ouvir calibração para Chuva Moderada: tom médio em lá 440 Hz com três pulsos rítmicos"
          >
            Chuva Moderada
          </button>
          <span className="legend-desc">Tom médio (440 Hz) + 3 pulsos rítmicos (área média ~ 50%)</span>
        </div>

        <div className="legend-item">
          <button
            onClick={() => playSample(750, 6)}
            className="btn btn-outline"
            aria-label="Ouvir calibração para Tempestade Severa: tom agudo com seis pulsos rápidos e densos"
          >
            Tempestade Severa
          </button>
          <span className="legend-desc">Tom agudo (750 Hz) + 6 pulsos rápidos (área ampla &gt; 80%)</span>
        </div>

        <div className="legend-item">
          <button
            onClick={() => playSample(240, 2, true)}
            className="btn btn-outline btn-outline-warning"
            aria-label="Ouvir calibração para Sinal de Dado Ausente: tom triangular de aviso não musical"
          >
            Aviso de Dado Ausente
          </button>
          <span className="legend-desc">Tom modulado de advertência (satélite sem medição válida)</span>
        </div>
      </div>

      <div className="legend-note">
        <Info size={16} aria-hidden="true" />
        <span>Frequências e ritmos sujeitos a calibração contínua com feedback de usuários de leitores de tela.</span>
      </div>
    </section>
  );
};
