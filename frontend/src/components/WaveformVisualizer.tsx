import React, { useEffect, useState } from 'react';
import { readWaveform } from '../audio/readWaveform';

interface WaveformVisualizerProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
  error: string | null;
}

export const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({ analyser, isPlaying, error }) => {
  const [path, setPath] = useState('');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [visualizationError, setVisualizationError] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!isPlaying || !analyser || error) {
      setPath('');
      setVisualizationError(false);
      return;
    }

    let requestId = 0;
    let timeoutId = 0;
    setVisualizationError(false);
    const draw = () => {
      try {
        setPath(readWaveform(analyser) ?? '');
        if (reducedMotion) timeoutId = window.setTimeout(draw, 250);
        else requestId = window.requestAnimationFrame(draw);
      } catch {
        setPath('');
        setVisualizationError(true);
      }
    };
    requestId = window.requestAnimationFrame(draw);
    return () => {
      window.cancelAnimationFrame(requestId);
      window.clearTimeout(timeoutId);
    };
  }, [analyser, error, isPlaying, reducedMotion]);

  const waiting = !isPlaying || !analyser || !!error || visualizationError || !path;
  const announceState = !isPlaying || !analyser || !!error || visualizationError;
  return (
    <div className={`waveform-visualizer${waiting ? ' waveform-waiting' : ''}`}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden={waiting} role={waiting ? undefined : 'img'} aria-label={waiting ? undefined : 'Forma de onda do áudio sintetizado pelo Sonatlas'}>
        {!waiting && <path d={path} />}
      </svg>
      <span className="waveform-status" role={announceState ? 'status' : undefined}>
        {error ? `Áudio indisponível: ${error}` : visualizationError ? 'Falha ao ler o sinal de áudio' : !isPlaying ? 'Aguardando reprodução' : !analyser ? 'Visualização de sinal indisponível' : !path ? 'Aguardando sinal de áudio' : reducedMotion ? 'Sinal ativo · forma de onda atualizada em intervalos maiores' : 'Sinal de áudio ativo'}
      </span>
    </div>
  );
};
