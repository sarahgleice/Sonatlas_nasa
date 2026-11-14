import { useState, useEffect, useRef, useCallback } from 'react';
import { SonificationParams, TemporalObservation } from '../types/dataset';
import { globalAudioEngine } from '../audio/AudioEngine';
import { createObservationSonificationParams } from '../audio/sonificationMapping';

interface UseAudioPlayerProps {
  observations: TemporalObservation[];
  stepDurationMs?: number;
  onStepChange?: (index: number) => void;
}

type PlaybackMode = 'paused' | 'continuous' | 'preview';

export function useAudioPlayer({ observations, stepDurationMs = 1500, onStepChange }: UseAudioPlayerProps) {
  const [mode, setMode] = useState<PlaybackMode>('paused');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(() => globalAudioEngine.getIsMuted());
  const [audioError, setAudioError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const totalSteps = observations.length;

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    timerRef.current = null;
    previewTimerRef.current = null;
  }, []);

  const playParams = useCallback((params: SonificationParams): boolean => {
    try {
      globalAudioEngine.playParams(params);
      setAudioError(null);
      return true;
    } catch (error) {
      globalAudioEngine.reportError(error);
      return false;
    }
  }, []);

  const playStep = useCallback((index: number): boolean => {
    if (index < 0 || index >= observations.length) return false;
    const ok = playParams(createObservationSonificationParams(observations[index], stepDurationMs));
    if (ok) onStepChange?.(index);
    return ok;
  }, [observations, stepDurationMs, onStepChange, playParams]);

  const finish = useCallback(() => {
    clearTimers();
    globalAudioEngine.stopPlayback();
    modeRef.current = 'paused';
    setMode('paused');
  }, [clearTimers]);

  const togglePlay = useCallback(() => {
    if (modeRef.current !== 'paused') { finish(); return; }
    if (!totalSteps) return;
    clearTimers();
    globalAudioEngine.stopPlayback();
    if (playStep(currentIndex)) {
      modeRef.current = 'continuous';
      setMode('continuous');
    }
  }, [clearTimers, currentIndex, finish, playStep, totalSteps]);

  const pause = useCallback(() => finish(), [finish]);

  const previewParams = useCallback((params: SonificationParams) => {
    clearTimers();
    globalAudioEngine.stopPlayback();
    if (!playParams({ ...params, durationMs: stepDurationMs })) { finish(); return; }
    modeRef.current = 'preview';
    setMode('preview');
    previewTimerRef.current = setTimeout(finish, stepDurationMs);
  }, [clearTimers, finish, playParams, stepDurationMs]);

  const previewStep = useCallback((index: number) => {
    if (index < 0 || index >= observations.length) return;
    clearTimers();
    globalAudioEngine.stopPlayback();
    if (!playStep(index)) { finish(); return; }
    setCurrentIndex(index);
    modeRef.current = 'preview';
    setMode('preview');
    previewTimerRef.current = setTimeout(finish, stepDurationMs);
  }, [clearTimers, finish, observations.length, playStep, stepDurationMs]);

  const selectStep = useCallback((index: number, delta: number) => {
    if (!totalSteps) return;
    const next = (index + delta + totalSteps) % totalSteps;
    setCurrentIndex(next);
    if (modeRef.current === 'continuous') {
      globalAudioEngine.stopPlayback();
      if (!playStep(next)) finish();
    } else {
      if (modeRef.current === 'preview') {
        clearTimers();
        globalAudioEngine.stopPlayback();
        modeRef.current = 'paused';
        setMode('paused');
      }
      onStepChange?.(next);
    }
  }, [clearTimers, finish, onStepChange, playStep, totalSteps]);
  const nextStep = useCallback(() => selectStep(currentIndex, 1), [currentIndex, selectStep]);
  const prevStep = useCallback(() => selectStep(currentIndex, -1), [currentIndex, selectStep]);
  const setStep = useCallback((index: number) => {
    if (index < 0 || index >= totalSteps) return;
    setCurrentIndex(index);
    if (modeRef.current === 'continuous') {
      globalAudioEngine.stopPlayback();
      if (!playStep(index)) finish();
    } else {
      if (modeRef.current === 'preview') {
        clearTimers();
        globalAudioEngine.stopPlayback();
        modeRef.current = 'paused';
        setMode('paused');
      }
      onStepChange?.(index);
    }
  }, [clearTimers, finish, onStepChange, playStep, totalSteps]);

  const toggleMute = useCallback(() => {
    const next = !globalAudioEngine.getIsMuted();
    globalAudioEngine.setMuted(next);
    setIsMuted(next);
  }, []);

  useEffect(() => globalAudioEngine.subscribeError(error => {
    setAudioError(error);
    if (error) finish();
  }), [finish]);

  useEffect(() => {
    clearTimers();
    globalAudioEngine.stopPlayback();
    modeRef.current = 'paused';
    setMode('paused');
    setCurrentIndex(0);
    setIsMuted(globalAudioEngine.getIsMuted());
    return () => { clearTimers(); globalAudioEngine.stopPlayback(); };
  }, [observations, clearTimers]);

  useEffect(() => {
    if (mode !== 'continuous' || !totalSteps) return;
    timerRef.current = setInterval(() => {
      const next = (currentIndex + 1) % totalSteps;
      globalAudioEngine.stopPlayback();
      setCurrentIndex(next);
      if (!playStep(next)) finish();
    }, stepDurationMs);
    return () => { if (timerRef.current) clearInterval(timerRef.current); timerRef.current = null; };
  }, [mode, currentIndex, totalSteps, stepDurationMs, playStep, finish]);

  useEffect(() => () => { clearTimers(); globalAudioEngine.stopPlayback(); }, [clearTimers]);

  return {
    mode, isPlaying: mode === 'continuous', isPreviewing: mode === 'preview',
    currentIndex, isMuted, audioError, analyser: globalAudioEngine.getAnalyser(),
    currentObservation: observations[currentIndex] || null,
    togglePlay, pause, nextStep, prevStep, setStep, toggleMute, previewStep, previewParams
  };
}
