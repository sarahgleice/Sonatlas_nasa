import React from 'react';
import {
  AlertTriangle,
  CloudRain,
  Headphones,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  SkipBack,
  SkipForward,
  Sun,
  Volume2,
  VolumeX
} from 'lucide-react';
import { TemporalObservation } from '../types/dataset';
import { PLAYBACK_SPEEDS, PlaybackSpeed } from '../types/player';
import { formatPrecipitationRate, getObservationDataState } from '../utils/formatters';
import { WaveformVisualizer } from './WaveformVisualizer';
import { MeteorVolumeSlider } from './MeteorVolumeSlider';

interface AudioPlayerProps {
  isPlaying: boolean;
  isMuted: boolean;
  isLooping?: boolean;
  speed?: PlaybackSpeed;
  currentIndex: number;
  totalSteps: number;
  currentObservation?: TemporalObservation | null;
  canGoPrevious?: boolean;
  canGoNext?: boolean;
  onTogglePlay: () => void;
  onPreview?: () => void;
  onNextStep: () => void;
  onPrevStep: () => void;
  onToggleMute: () => void;
  onToggleLoop?: () => void;
  onRestart?: () => void;
  onSpeedChange?: (speed: PlaybackSpeed) => void;
  volume?: number;
  onVolumeChange?: (volume: number) => void;
  disabled?: boolean;
  analyser: AnalyserNode | null;
  audioError: string | null;
}

/** Estado do dado do passo atual em texto e ícone (nunca só por cor). */
export function describeDataState(observation: TemporalObservation | null | undefined): {
  state: 'missing' | 'dry' | 'rain' | 'none';
  text: string;
} {
  if (!observation) return { state: 'none', text: 'Nenhuma observação selecionada' };
  const state = getObservationDataState(observation);
  const rate = observation.scientific_indicators.mean_precipitation_rate.value;
  if (state === 'missing') return { state, text: 'Dados ausentes (não significa zero chuva)' };
  if (state === 'dry') return { state, text: `${formatPrecipitationRate(rate)} · Tempo seco (sem chuva)` };
  return { state, text: `${formatPrecipitationRate(rate)} · Com chuva` };
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  isPlaying,
  isMuted,
  isLooping = false,
  speed = 1,
  currentIndex,
  totalSteps,
  currentObservation = null,
  canGoPrevious = true,
  canGoNext = true,
  onTogglePlay,
  onPreview,
  onNextStep,
  onPrevStep,
  onToggleMute,
  onToggleLoop,
  onRestart,
  onSpeedChange,
  volume = 0.5,
  onVolumeChange,
  disabled = false,
  analyser,
  audioError
}) => {
  const hasSteps = totalSteps > 0;
  const stepLabel = hasSteps ? `Passo ${currentIndex + 1} de ${totalSteps}` : 'Nenhuma observação carregada';
  const dataState = describeDataState(currentObservation);

  return (
    <section className="card player-card" aria-labelledby="player-title">
      <div className="card-header">
        <h2 id="player-title" className="card-title">
          Controles do Jukebox Sonoro
        </h2>
        <span className="badge badge-info" aria-label={stepLabel}>
          Passo {hasSteps ? currentIndex + 1 : 0} de {totalSteps}
        </span>
      </div>

      <div className="player-controls">
        <button
          type="button"
          onClick={onPrevStep}
          disabled={disabled || !hasSteps}
          aria-disabled={hasSteps && !canGoPrevious ? true : undefined}
          className="btn btn-secondary btn-icon"
          aria-label="Voltar para a observação temporal anterior (Seta para a esquerda)"
          title="Observação anterior (←)"
        >
          <SkipBack size={22} aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={onTogglePlay}
          disabled={disabled || !hasSteps}
          className="btn btn-primary btn-play"
          aria-label={isPlaying ? 'Pausar sonificação da série temporal (Barra de Espaço)' : 'Iniciar sonificação da série temporal (Barra de Espaço)'}
          title={isPlaying ? 'Pausar (Espaço)' : 'Reproduzir (Espaço)'}
        >
          {isPlaying ? (
            <>
              <Pause size={24} aria-hidden="true" />
              <span>Pausar</span>
            </>
          ) : (
            <>
              <Play size={24} aria-hidden="true" />
              <span>Reproduzir</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onNextStep}
          disabled={disabled || !hasSteps}
          aria-disabled={hasSteps && !canGoNext ? true : undefined}
          className="btn btn-secondary btn-icon"
          aria-label="Avançar para a próxima observação temporal (Seta para a direita)"
          title="Próxima observação (→)"
        >
          <SkipForward size={22} aria-hidden="true" />
        </button>

        {onPreview && (
          <button type="button" onClick={onPreview} disabled={disabled || !hasSteps} className="btn btn-secondary btn-icon" aria-label="Ouvir prévia desta observação" title="Ouvir prévia">
            <Headphones size={20} aria-hidden="true" />
          </button>
        )}

        <button
          type="button"
          onClick={onToggleMute}
          disabled={disabled}
          aria-pressed={isMuted}
          className={`btn btn-icon ${isMuted ? 'btn-danger' : 'btn-secondary'}`}
          aria-label="Silenciar áudio (Tecla M)"
          title={isMuted ? 'Áudio silenciado (M)' : 'Silenciar (M)'}
        >
          {isMuted ? <VolumeX size={22} aria-hidden="true" /> : <Volume2 size={22} aria-hidden="true" />}
        </button>
      </div>

            {onVolumeChange && (
        <div className="player-volume">
          <MeteorVolumeSlider
            value={volume}
            onChange={onVolumeChange}
            muted={isMuted}
            disabled={disabled}
          />
        </div>
      )}

      <div className="player-options">
        {onRestart && (
          <button
            type="button"
            onClick={onRestart}
            disabled={disabled || !hasSteps}
            className="btn btn-secondary btn-sm"
            aria-label="Reiniciar do primeiro passo e reproduzir"
          >
            <RotateCcw size={16} aria-hidden="true" />
            <span>Reiniciar</span>
          </button>
        )}

        {onToggleLoop && (
          <button
            type="button"
            onClick={onToggleLoop}
            disabled={disabled}
            aria-pressed={isLooping}
            aria-keyshortcuts="L"
            className={`btn btn-sm ${isLooping ? 'btn-toggle-on' : 'btn-secondary'}`}
            title="Repetir sequência (L)"
          >
            <Repeat size={16} aria-hidden="true" />
            <span>Repetir sequência</span>
          </button>
        )}

        {onSpeedChange && (
          <div className="speed-control">
            <label htmlFor="playback-speed" className="form-label">Velocidade</label>
            <select
              id="playback-speed"
              className="form-select"
              value={speed}
              onChange={(event) => onSpeedChange(Number(event.target.value) as PlaybackSpeed)}
              disabled={disabled}
              aria-describedby="playback-speed-help"
            >
              {PLAYBACK_SPEEDS.map((option) => (
                <option key={option} value={option}>{`${option.toString().replace('.', ',')}x`}</option>
              ))}
            </select>
            <p id="playback-speed-help" className="form-helper">
              Altera o ritmo sem modificar as frequências científicas.
            </p>
          </div>
        )}
      </div>

      <p className={`data-state data-state-${dataState.state}`}>
        {dataState.state === 'missing'
          ? <AlertTriangle size={16} aria-hidden="true" />
          : dataState.state === 'dry'
            ? <Sun size={16} aria-hidden="true" />
            : <CloudRain size={16} aria-hidden="true" />}
        <span>{dataState.text}</span>
      </p>

      <WaveformVisualizer analyser={analyser} isPlaying={isPlaying} error={audioError} />
    </section>
  );
};
