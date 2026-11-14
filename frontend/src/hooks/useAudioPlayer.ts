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
  const [audioError, setAudioError] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const totalSteps = observations.length;

  const playStep = useCallback((index: number): boolean => {
    if (index >= 0 && index < observations.length) {
      const obs = observations[index];
      const params = createObservationSonificationParams(obs, stepDurationMs);
      try {
        globalAudioEngine.playParams(params);
        setAudioError(null);
      } catch (error) {
        globalAudioEngine.reportError(error);
        return false;
      }
      if (onStepChange) {
        onStepChange(index);
      }
      return true;
    }
    return false;
  }, [observations, stepDurationMs, onStepChange]);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      globalAudioEngine.stopPlayback();
      setIsPlaying(false);
    } else if (playStep(currentIndex)) {
      setIsPlaying(true);
    }
  }, [currentIndex, isPlaying, playStep]);

  useEffect(() => globalAudioEngine.subscribeError((error) => {
    setAudioError(error);
    if (error) {
      setIsPlaying(false);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      globalAudioEngine.stopPlayback();
    }
  }), []);
  useEffect(() => () => globalAudioEngine.dispose(), []);

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
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setIsPlaying(false);
    setCurrentIndex(0);
    globalAudioEngine.stopPlayback();
  }, [observations]);

  return {
    isPlaying,
    currentIndex,
    isMuted,
    audioError,
    analyser: globalAudioEngine.getAnalyser(),
    currentObservation: observations[currentIndex] || null,
    togglePlay,
    nextStep,
    prevStep,
    setStep,
    toggleMute
  };
}
