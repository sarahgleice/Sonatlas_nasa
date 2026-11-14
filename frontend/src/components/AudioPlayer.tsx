import React from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX } from 'lucide-react';
import { WaveformVisualizer } from './WaveformVisualizer';

interface AudioPlayerProps {
  isPlaying: boolean;
  isMuted: boolean;
  currentIndex: number;
  totalSteps: number;
  onTogglePlay: () => void;
  onNextStep: () => void;
  onPrevStep: () => void;
  onToggleMute: () => void;
  disabled?: boolean;
  analyser: AnalyserNode | null;
  audioError: string | null;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  isPlaying,
  isMuted,
  currentIndex,
  totalSteps,
  onTogglePlay,
  onNextStep,
  onPrevStep,
  onToggleMute,
  disabled = false,
  analyser,
  audioError
}) => {
  return (
    <section className="card player-card" aria-labelledby="player-title">
      <div className="card-header">
        <h2 id="player-title" className="card-title">
          Controles do Jukebox Sonoro
        </h2>
        <span className="badge badge-info" aria-label={`Passo ${currentIndex + 1} de ${totalSteps}`}>
          Passo {totalSteps > 0 ? currentIndex + 1 : 0} de {totalSteps}
        </span>
      </div>

      <div className="player-controls">
        <button
          onClick={onPrevStep}
          disabled={disabled || totalSteps === 0}
          className="btn btn-secondary btn-icon"
          aria-label="Voltar para a observação temporal anterior (Seta para a esquerda)"
          title="Observação anterior (←)"
        >
          <SkipBack size={22} aria-hidden="true" />
        </button>

        <button
          onClick={onTogglePlay}
          disabled={disabled || totalSteps === 0}
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
          onClick={onNextStep}
          disabled={disabled || totalSteps === 0}
          className="btn btn-secondary btn-icon"
          aria-label="Avançar para a próxima observação temporal (Seta para a direita)"
          title="Próxima observação (→)"
        >
          <SkipForward size={22} aria-hidden="true" />
        </button>

        <button
          onClick={onToggleMute}
          disabled={disabled}
          className={`btn btn-icon ${isMuted ? 'btn-danger' : 'btn-secondary'}`}
          aria-label={isMuted ? 'Ativar som (Tecla M)' : 'Silenciar áudio (Tecla M)'}
          title={isMuted ? 'Ativar som (M)' : 'Silenciar (M)'}
        >
          {isMuted ? <VolumeX size={22} aria-hidden="true" /> : <Volume2 size={22} aria-hidden="true" />}
        </button>
      </div>
      <WaveformVisualizer analyser={analyser} isPlaying={isPlaying} error={audioError} />
    </section>
  );
};
