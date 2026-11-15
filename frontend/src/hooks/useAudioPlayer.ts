import { useState, useEffect, useRef, useCallback } from 'react';
import { TemporalObservation } from '../types/dataset';
import { PlaybackSpeed, StepChangeSource } from '../types/player';
import { globalAudioEngine, MAX_GAIN } from '../audio/AudioEngine';
import { createObservationSonificationParams } from '../audio/sonificationMapping';

export interface StepTransition {
  index: number;
  previousIndex: number | null;
  source: StepChangeSource;
  observation: TemporalObservation | null;
}

export type PlayerBoundary = 'start' | 'end';

interface UseAudioPlayerProps {
  observations: TemporalObservation[];
  stepDurationMs?: number;
  onTransition?: (transition: StepTransition) => void;
  onBoundary?: (boundary: PlayerBoundary) => void;
}

export interface NextStepResult {
  nextIndex: number;
  ended: boolean;
}

export type PlaybackMode = 'paused' | 'continuous' | 'preview';

/**
 * Calcula o próximo passo da série. Sem repetição, o último passo é terminal
 * (`ended: true`) e o índice permanece nele; com repetição, volta ao início.
 */
export function computeNextStepIndex(
  currentIndex: number,
  totalSteps: number,
  isLooping: boolean
): NextStepResult {
  if (totalSteps <= 0) {
    return { nextIndex: 0, ended: true };
  }
  const lastIndex = totalSteps - 1;
  if (currentIndex < lastIndex) {
    return { nextIndex: Math.max(0, currentIndex + 1), ended: false };
  }
  if (isLooping && totalSteps > 1) {
    return { nextIndex: 0, ended: false };
  }
  return { nextIndex: lastIndex, ended: true };
}

/**
 * Calcula o passo anterior. Retorna `null` quando não há passo anterior
 * (início da série sem repetição).
 */
export function computePreviousStepIndex(
  currentIndex: number,
  totalSteps: number,
  isLooping: boolean
): number | null {
  if (totalSteps <= 0) return null;
  if (currentIndex > 0) return Math.min(currentIndex - 1, totalSteps - 1);
  if (isLooping && totalSteps > 1) return totalSteps - 1;
  return null;
}

/**
 * Duração real de cada passo. A velocidade altera somente a cadência temporal;
 * frequência e número de pulsos continuam vindo exclusivamente dos indicadores.
 */
export function computeStepDurationMs(baseDurationMs: number, speed: PlaybackSpeed): number {
  return Math.max(1, Math.round(baseDurationMs / speed));
}

export function useAudioPlayer({
  observations,
  stepDurationMs = 1500,
  onTransition,
  onBoundary
}: UseAudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPreviewing, setIsPreviewing] = useState<boolean>(false);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(() => globalAudioEngine.getIsMuted());
  const [volume, setVolumeState] = useState<number>(() => globalAudioEngine.getVolume() / MAX_GAIN);
  const [speed, setSpeedState] = useState<PlaybackSpeed>(1);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  const timerRef = useRef<number | null>(null);
  const previewTimerRef = useRef<number | null>(null);
  const expectedTickRef = useRef<number>(0);
  const currentIndexRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);
  const isMutedRef = useRef<boolean>(false);
  const speedRef = useRef<PlaybackSpeed>(1);
  const loopRef = useRef<boolean>(false);
  const observationsRef = useRef<TemporalObservation[]>(observations);
  const stepDurationRef = useRef<number>(stepDurationMs);
  const onTransitionRef = useRef<typeof onTransition>(onTransition);
  const onBoundaryRef = useRef<typeof onBoundary>(onBoundary);

  // Refs espelham props/estado para que callbacks estáveis nunca reiniciem o agendador.
  observationsRef.current = observations;
  stepDurationRef.current = stepDurationMs;
  onTransitionRef.current = onTransition;
  onBoundaryRef.current = onBoundary;

  const totalSteps = observations.length;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clearPreviewTimer = useCallback(() => {
    if (previewTimerRef.current !== null) {
      window.clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
  }, []);

  const stepDuration = useCallback(
    () => computeStepDurationMs(stepDurationRef.current, speedRef.current),
    []
  );

  const soundStep = useCallback((index: number): boolean => {
    const observation = observationsRef.current[index];
    if (!observation) return false;
    const params = createObservationSonificationParams(observation, stepDuration());
    try {
      globalAudioEngine.stopPlayback();
      globalAudioEngine.playParams(params);
      setAudioError(null);
      return true;
    } catch (error) {
      globalAudioEngine.reportError(error);
      return false;
    }
  }, [stepDuration]);

  const moveTo = useCallback((index: number, source: StepChangeSource) => {
    const previousIndex = currentIndexRef.current;
    currentIndexRef.current = index;
    setCurrentIndex(index);
    onTransitionRef.current?.({
      index,
      previousIndex,
      source,
      observation: observationsRef.current[index] ?? null
    });
  }, []);

  const stopInternal = useCallback(() => {
    clearTimer();
    clearPreviewTimer();
    isPlayingRef.current = false;
    setIsPlaying(false);
    setIsPreviewing(false);
    globalAudioEngine.stopPlayback();
  }, [clearPreviewTimer, clearTimer]);

  const tickRef = useRef<() => void>(() => undefined);

  const scheduleNext = useCallback((delayMs: number) => {
    clearTimer();
    timerRef.current = window.setTimeout(() => tickRef.current(), Math.max(0, delayMs));
  }, [clearTimer]);

  // Reagenda a partir de agora (após navegação manual ou troca de velocidade durante a reprodução).
  const resync = useCallback(() => {
    if (!isPlayingRef.current) return;
    const duration = stepDuration();
    expectedTickRef.current = performance.now() + duration;
    scheduleNext(duration);
  }, [scheduleNext, stepDuration]);

  tickRef.current = () => {
    timerRef.current = null;
    if (!isPlayingRef.current) return;

    const { nextIndex, ended } = computeNextStepIndex(
      currentIndexRef.current,
      observationsRef.current.length,
      loopRef.current
    );

    if (ended) {
      const lastIndex = currentIndexRef.current;
      stopInternal();
      onTransitionRef.current?.({
        index: lastIndex,
        previousIndex: lastIndex,
        source: 'playback_end',
        observation: observationsRef.current[lastIndex] ?? null
      });
      return;
    }

    moveTo(nextIndex, 'playback_auto');
    if (!soundStep(nextIndex)) {
      stopInternal();
      return;
    }

    // Compensação de deriva: o próximo disparo é relativo ao instante esperado, não ao atual.
    expectedTickRef.current += stepDuration();
    scheduleNext(expectedTickRef.current - performance.now());
  };

  const startPlayback = useCallback((startIndex: number) => {
    if (observationsRef.current.length === 0) return;
    clearPreviewTimer();
    setIsPreviewing(false);
    // AudioContext só é criado/retomado aqui, dentro de um gesto explícito do usuário.
    if (!soundStep(startIndex)) return;

    const previousIndex = currentIndexRef.current;
    currentIndexRef.current = startIndex;
    setCurrentIndex(startIndex);
    isPlayingRef.current = true;
    setIsPlaying(true);

    const duration = stepDuration();
    expectedTickRef.current = performance.now() + duration;
    scheduleNext(duration);

    onTransitionRef.current?.({
      index: startIndex,
      previousIndex,
      source: 'play_start',
      observation: observationsRef.current[startIndex] ?? null
    });
  }, [clearPreviewTimer, scheduleNext, soundStep, stepDuration]);

  const play = useCallback(() => {
    if (isPlayingRef.current) return;
    const total = observationsRef.current.length;
    if (total === 0) return;
    const atTerminalStep = !loopRef.current && total > 1 && currentIndexRef.current >= total - 1;
    startPlayback(atTerminalStep ? 0 : currentIndexRef.current);
  }, [startPlayback]);

  const pause = useCallback(() => {
    if (!isPlayingRef.current) return;
    stopInternal();
    onTransitionRef.current?.({
      index: currentIndexRef.current,
      previousIndex: currentIndexRef.current,
      source: 'playback_pause',
      observation: observationsRef.current[currentIndexRef.current] ?? null
    });
  }, [stopInternal]);

  const togglePlay = useCallback(() => {
    if (isPlayingRef.current) {
      pause();
    } else {
      play();
    }
  }, [pause, play]);

  const goToStep = useCallback((index: number, source: StepChangeSource) => {
    const total = observationsRef.current.length;
    if (index < 0 || index >= total) return;
    clearPreviewTimer();
    if (!isPlayingRef.current) {
      globalAudioEngine.stopPlayback();
      setIsPreviewing(false);
    }
    moveTo(index, source);
    if (isPlayingRef.current) {
      soundStep(index);
      resync();
    }
  }, [clearPreviewTimer, moveTo, resync, soundStep]);

  const previewStep = useCallback((index: number) => {
    if (index < 0 || index >= observationsRef.current.length) return;
    stopInternal();
    moveTo(index, 'manual_step');
    if (!soundStep(index)) return;
    setIsPreviewing(true);
    previewTimerRef.current = window.setTimeout(() => {
      previewTimerRef.current = null;
      globalAudioEngine.stopPlayback();
      setIsPreviewing(false);
    }, stepDuration());
  }, [moveTo, soundStep, stepDuration, stopInternal]);

  const setStep = useCallback((index: number, source: StepChangeSource = 'manual_step') => {
    goToStep(index, source);
  }, [goToStep]);

  const nextStep = useCallback(() => {
    const { nextIndex, ended } = computeNextStepIndex(
      currentIndexRef.current,
      observationsRef.current.length,
      loopRef.current
    );
    if (ended) {
      if (observationsRef.current.length > 0) onBoundaryRef.current?.('end');
      return;
    }
    goToStep(nextIndex, 'manual_step');
  }, [goToStep]);

  const prevStep = useCallback(() => {
    const previous = computePreviousStepIndex(
      currentIndexRef.current,
      observationsRef.current.length,
      loopRef.current
    );
    if (previous === null) {
      if (observationsRef.current.length > 0) onBoundaryRef.current?.('start');
      return;
    }
    goToStep(previous, 'manual_step');
  }, [goToStep]);

  const firstStep = useCallback(() => goToStep(0, 'manual_step'), [goToStep]);

  const lastStep = useCallback(
    () => goToStep(observationsRef.current.length - 1, 'manual_step'),
    [goToStep]
  );

  const restart = useCallback(() => {
    if (observationsRef.current.length === 0) return;
    clearTimer();
    isPlayingRef.current = false;
    startPlayback(0);
  }, [clearTimer, startPlayback]);

  const setSpeed = useCallback((nextSpeed: PlaybackSpeed) => {
    speedRef.current = nextSpeed;
    setSpeedState(nextSpeed);
    resync();
  }, [resync]);

  const toggleLoop = useCallback(() => {
    loopRef.current = !loopRef.current;
    setIsLooping(loopRef.current);
  }, []);

  const toggleMute = useCallback(() => {
    isMutedRef.current = !isMutedRef.current;
    globalAudioEngine.setMuted(isMutedRef.current);
    setIsMuted(isMutedRef.current);
  }, []);

  const setVolume = useCallback((nextVolume: number) => {
    const next = Number.isFinite(nextVolume) ? Math.min(1, Math.max(0, nextVolume)) : 0;
    globalAudioEngine.setVolume(next * MAX_GAIN);
    setVolumeState(next);
    if (isMutedRef.current && next > 0) {
      isMutedRef.current = false;
      globalAudioEngine.setMuted(false);
      setIsMuted(false);
    }
  }, []);

  useEffect(() => globalAudioEngine.subscribeError((error) => {
    setAudioError(error);
    if (error) {
      stopInternal();
    }
  }), [stopInternal]);

  // Desmontagem: para som e timer, sem destruir o singleton (StrictMode monta duas vezes).
  useEffect(() => () => {
    clearTimer();
    clearPreviewTimer();
    isPlayingRef.current = false;
    globalAudioEngine.stopPlayback();
  }, [clearPreviewTimer, clearTimer]);

  // Troca de região/lista: reinicia silenciosamente, sem emitir transição
  // (o anúncio de "Região alterada" pertence à página).
  useEffect(() => {
    clearTimer();
    clearPreviewTimer();
    isPlayingRef.current = false;
    currentIndexRef.current = 0;
    setIsPlaying(false);
    setIsPreviewing(false);
    setCurrentIndex(0);
    globalAudioEngine.stopPlayback();
  }, [observations, clearPreviewTimer, clearTimer]);

  const lastIndex = totalSteps - 1;
  const mode: PlaybackMode = isPlaying ? 'continuous' : isPreviewing ? 'preview' : 'paused';

  return {
    isPlaying,
    isPreviewing,
    mode,
    currentIndex,
    totalSteps,
    isMuted,
    volume,
    speed,
    isLooping,
    audioError,
    analyser: globalAudioEngine.getAnalyser(),
    currentObservation: observations[currentIndex] || null,
    previousObservation: currentIndex > 0 ? observations[currentIndex - 1] || null : null,
    canGoPrevious: totalSteps > 0 && (currentIndex > 0 || (isLooping && totalSteps > 1)),
    canGoNext: totalSteps > 0 && (currentIndex < lastIndex || (isLooping && totalSteps > 1)),
    play,
    pause,
    togglePlay,
    nextStep,
    prevStep,
    firstStep,
    lastStep,
    restart,
    setStep,
    setSpeed,
    toggleLoop,
    toggleMute,
    setVolume,
    previewStep
  };
}
