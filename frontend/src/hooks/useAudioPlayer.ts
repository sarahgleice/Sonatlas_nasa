import { useState, useEffect, useRef, useCallback } from 'react';
import { TemporalObservation } from '../types/dataset';
import { globalAudioEngine } from '../audio/AudioEngine';
import { createObservationSonificationParams } from '../audio/sonificationMapping';

interface UseAudioPlayerProps {
  observations: TemporalObservation[];
  stepDurationMs?: number;
  onStepChange?: (index: number) => void;
}

export function useAudioPlayer({
  observations,
  stepDurationMs = 1500,
  onStepChange
}: UseAudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const totalSteps = observations.length;

  const playStep = useCallback((index: number) => {
    if (index >= 0 && index < observations.length) {
      const obs = observations[index];
      const params = createObservationSonificationParams(obs, stepDurationMs);
      globalAudioEngine.playParams(params);
      if (onStepChange) {
        onStepChange(index);
      }
    }
  }, [observations, stepDurationMs, onStepChange]);

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => {
      const nextState = !prev;
      if (nextState) {
        // Tocar imediatamente o passo atual
        playStep(currentIndex);
      }
      return nextState;
    });
  }, [currentIndex, playStep]);

  const nextStep = useCallback(() => {
    setCurrentIndex((prev) => {
      if (totalSteps === 0) return 0;
      const next = (prev + 1) % totalSteps;
      playStep(next);
      return next;
    });
  }, [totalSteps, playStep]);

  const prevStep = useCallback(() => {
    setCurrentIndex((prev) => {
      if (totalSteps === 0) return 0;
      const next = (prev - 1 + totalSteps) % totalSteps;
      playStep(next);
      return next;
    });
  }, [totalSteps, playStep]);

  const setStep = useCallback((index: number) => {
    if (index >= 0 && index < totalSteps) {
      setCurrentIndex(index);
      playStep(index);
    }
  }, [totalSteps, playStep]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      globalAudioEngine.setMuted(next);
      return next;
    });
  }, []);

  // Loop contínuo quando isPlaying = true
  useEffect(() => {
    if (isPlaying && totalSteps > 0) {
      timerRef.current = setInterval(() => {
        setCurrentIndex((prev) => {
          const next = (prev + 1) % totalSteps;
          playStep(next);
          return next;
        });
      }, stepDurationMs);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isPlaying, totalSteps, stepDurationMs, playStep]);

  // Resetar quando a lista de observações mudar (ex: troca de região)
  useEffect(() => {
    setIsPlaying(false);
    setCurrentIndex(0);
  }, [observations]);

  return {
    isPlaying,
    currentIndex,
    isMuted,
    currentObservation: observations[currentIndex] || null,
    togglePlay,
    nextStep,
    prevStep,
    setStep,
    toggleMute
  };
}
