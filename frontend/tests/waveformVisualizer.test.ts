import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WaveformVisualizer } from '../src/components/WaveformVisualizer';
import { readWaveform } from '../src/audio/readWaveform';
import { AudioEngine } from '../src/audio/AudioEngine';

afterEach(() => { vi.unstubAllGlobals(); });

describe('readWaveform', () => {
  it('does not draw a waveform when the analyser contains silence', () => {
    const analyser = {
      fftSize: 32,
      getByteTimeDomainData: (samples: Uint8Array) => samples.fill(128)
    } as unknown as AnalyserNode;

    expect(readWaveform(analyser)).toBeNull();
  });

  it('builds the path from real analyser samples', () => {
    const analyser = {
      fftSize: 32,
      getByteTimeDomainData: vi.fn((samples: Uint8Array) => {
        samples.forEach((_, index) => { samples[index] = index % 2 ? 160 : 96; });
      })
    } as unknown as AnalyserNode;

    expect(readWaveform(analyser)).toContain('M0.0,');
    expect(readWaveform(analyser)).toContain('L100.0,');
    expect(analyser.getByteTimeDomainData).toHaveBeenCalled();
  });

  it('renders explicit waiting, unavailable, and error states', () => {
    const render = (props: { analyser: AnalyserNode | null; isPlaying: boolean; error: string | null }) =>
      renderToStaticMarkup(createElement(WaveformVisualizer, props));

    expect(render({ analyser: null, isPlaying: false, error: null })).toContain('Aguardando reprodução');
    expect(render({ analyser: null, isPlaying: true, error: null })).toContain('Visualização de sinal indisponível');
    expect(render({ analyser: null, isPlaying: true, error: 'bloqueado' })).toContain('Áudio indisponível: bloqueado');
  });
});

describe('integração do AudioEngine com o visualizador', () => {
  it('expõe o AnalyserNode real, interrompe fontes e libera os nós ao encerrar', () => {
    const parameter = () => ({
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn()
    });
    const gain = { gain: parameter(), connect: vi.fn(), disconnect: vi.fn() };
    const analyser = { connect: vi.fn(), disconnect: vi.fn(), fftSize: 32 };
    const oscillator = {
      type: 'sine', frequency: parameter(), connect: vi.fn(), disconnect: vi.fn(),
      start: vi.fn(), stop: vi.fn(), addEventListener: vi.fn()
    };
    const context = {
      state: 'running', currentTime: 1, destination: {},
      createGain: vi.fn(() => gain), createAnalyser: vi.fn(() => analyser),
      createOscillator: vi.fn(() => oscillator), close: vi.fn().mockResolvedValue(undefined)
    };
    vi.stubGlobal('window', { AudioContext: vi.fn(() => context) });
    const engine = new AudioEngine();

    engine.playParams({ frequency: 440, pulseCount: 1, durationMs: 1000, isMissing: false });
    expect(engine.getAnalyser()).toBe(analyser);
    expect(gain.connect).toHaveBeenCalledWith(analyser);
    expect(analyser.connect).toHaveBeenCalledWith(context.destination);
    
    // Verifica se stopPlayback interrompe as fontes ativas corretamente
    engine.stopPlayback();
    expect(oscillator.stop).toHaveBeenCalledWith(context.currentTime);

    engine.dispose();
    expect(context.close).toHaveBeenCalledOnce();
    expect(analyser.disconnect).toHaveBeenCalledOnce();
    expect(engine.getAnalyser()).toBeNull();
  });

  it('reports AudioContext construction errors to subscribers', () => {
    vi.stubGlobal('window', { AudioContext: vi.fn(() => { throw new Error('sem suporte'); }) });
    const engine = new AudioEngine();
    const onError = vi.fn();
    engine.subscribeError(onError);

    expect(() => engine.playParams({ frequency: 440, pulseCount: 1, durationMs: 1000, isMissing: false })).toThrow('sem suporte');
    engine.reportError(new Error('sem suporte'));
    expect(onError).toHaveBeenLastCalledWith('sem suporte');
    engine.dispose();
  });

  it('reports asynchronous AudioContext resume failures for playParams', async () => {
    const parameter = () => ({ setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() });
    const gain = { gain: parameter(), connect: vi.fn(), disconnect: vi.fn() };
    const analyser = { connect: vi.fn(), disconnect: vi.fn(), fftSize: 32 };
    const oscillator = { type: 'sine', frequency: parameter(), connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), addEventListener: vi.fn() };
    const context = {
      state: 'suspended', currentTime: 1, destination: {},
      createGain: vi.fn(() => gain), createAnalyser: vi.fn(() => analyser),
      createOscillator: vi.fn(() => oscillator), resume: vi.fn().mockRejectedValue(new Error('retomada bloqueada')),
      close: vi.fn().mockResolvedValue(undefined)
    };
    vi.stubGlobal('window', { AudioContext: vi.fn(() => context) });
    const engine = new AudioEngine();
    const onError = vi.fn();
    engine.subscribeError(onError);

    engine.playParams({ frequency: 440, pulseCount: 1, durationMs: 1000, isMissing: false });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onError).toHaveBeenLastCalledWith('retomada bloqueada');
    engine.dispose();
  });

  it('reports asynchronous AudioContext resume failures for sequence controls', async () => {
    const parameter = () => ({ setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() });
    const gain = { gain: parameter(), connect: vi.fn(), disconnect: vi.fn() };
    const analyser = { connect: vi.fn(), disconnect: vi.fn(), fftSize: 32 };
    const context = {
      state: 'suspended', currentTime: 1, destination: {},
      createGain: vi.fn(() => gain), createAnalyser: vi.fn(() => analyser),
      resume: vi.fn().mockRejectedValue(new Error('sequência bloqueada')),
      close: vi.fn().mockResolvedValue(undefined)
    };
    vi.stubGlobal('window', { AudioContext: vi.fn(() => context) });
    const engine = new AudioEngine();
    const onError = vi.fn();
    engine.subscribeError(onError);

    // Adiciona sequência fictícia para passar na checagem inicial do resume()
    engine['currentSequence'] = [{}] as any; 
    
    // Testa falha no resume()
    await engine.resume();
    expect(onError).toHaveBeenLastCalledWith('sequência bloqueada');

    // Testa falha no playSequence()
    await engine.playSequence([{} as any]);
    expect(onError).toHaveBeenLastCalledWith('sequência bloqueada');
    
    engine.dispose();
  });
});