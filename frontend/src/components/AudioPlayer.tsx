import React from 'react';
import { Play, Pause, Square, SkipForward, SkipBack, Volume2, VolumeX, AudioLines } from 'lucide-react';
import { WaveformVisualizer } from './WaveformVisualizer';

interface AudioPlayerProps {
  isPlaying: boolean;
  isPreviewing: boolean;
  isMuted: boolean;
  currentIndex: number;
  totalSteps: number;
  onTogglePlay: () => void;
  onPreview: () => void;
  onNextStep: () => void;
  onPrevStep: () => void;
  onToggleMute: () => void;
  disabled?: boolean;
  analyser: AnalyserNode | null;
  audioError: string | null;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  isPlaying,
  isPreviewing,
  isMuted,
  currentIndex,
  totalSteps,
  onTogglePlay,
  onPreview,
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
        <div className="player-badges">
          <span className="badge badge-info" aria-label={`Passo ${currentIndex + 1} de ${totalSteps}`}>
            Passo {totalSteps > 0 ? currentIndex + 1 : 0} de {totalSteps}
          </span>
          <span className={`badge ${isPlaying ? 'badge-playing' : isPreviewing ? 'badge-preview' : 'badge-paused'}`} role="status">
            {isPlaying ? 'Sequência' : isPreviewing ? 'Prévia' : 'Pausado'}
          </span>
        </div>
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
          aria-label={isPlaying ? 'Pausar sequência de sonificação (Barra de Espaço)' : isPreviewing ? 'Interromper prévia sonora (Barra de Espaço)' : 'Iniciar sequência de sonificação (Barra de Espaço)'}
          title={isPlaying ? 'Pausar sequência (Espaço)' : isPreviewing ? 'Interromper prévia (Espaço)' : 'Reproduzir sequência (Espaço)'}
        >
          {isPlaying ? (
            <>
              <Pause size={24} aria-hidden="true" />
              <span>Pausar</span>
            </>
          ) : isPreviewing ? (
            <>
              <Square size={22} aria-hidden="true" />
              <span>Interromper prévia</span>
            </>
          ) : (
            <>
              <Play size={24} aria-hidden="true" />
              <span>Reproduzir sequência</span>
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
          onClick={onPreview}
          disabled={disabled || totalSteps === 0}
          className="btn btn-secondary btn-icon"
          aria-label="Ouvir somente a observação selecionada"
          title="Prévia desta observação"
        >
          <AudioLines size={22} aria-hidden="true" />
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
      <WaveformVisualizer analyser={analyser} isPlaying={isPlaying || isPreviewing} error={audioError} />
    </section>
  );
};
