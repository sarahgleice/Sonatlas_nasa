import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AudioPlayer, describeDataState } from '../src/components/AudioPlayer';
import { TemporalObservation } from '../src/types/dataset';

function makeObs(rate: number | null, status: TemporalObservation['availability']['status'] = 'available'): TemporalObservation {
  return {
    observation_id: 'obs',
    step_index: 0,
    timestamp_utc: '2024-01-01T00:00:00Z',
    availability: { status, valid_cells_ratio: 1, missing_cells_count: 0, total_cells_count: 10 },
    scientific_indicators: {
      mean_precipitation_rate: { value: rate, unit: 'mm/h', description: '' },
      rain_area_fraction: { value: rate === null ? null : 0.4, unit: 'fraction', description: '' }
    },
    visual_frame_reference: { frame_id: 'f', image_path: '', source_system: 'NASA', synchronization_status: 'pending_official_validation', alt_text: '' },
    textual_summary: ''
  };
}

const noop = () => undefined;
const baseProps = {
  isPlaying: false,
  isMuted: false,
  isLooping: false,
  speed: 1 as const,
  currentIndex: 2,
  totalSteps: 6,
  currentObservation: makeObs(5),
  canGoPrevious: true,
  canGoNext: true,
  onTogglePlay: noop,
  onNextStep: noop,
  onPrevStep: noop,
  onToggleMute: noop,
  onToggleLoop: noop,
  onRestart: noop,
  onSpeedChange: noop,
  analyser: null,
  audioError: null
};

function render(overrides: Record<string, unknown> = {}): string {
  return renderToStaticMarkup(createElement(AudioPlayer, { ...baseProps, ...overrides }));
}

describe('AudioPlayer', () => {
  it('expõe velocidade com rótulo, microcopy e todas as opções', () => {
    const html = render();
    expect(html).toContain('<label for="playback-speed"');
    expect(html).toContain('aria-describedby="playback-speed-help"');
    expect(html).toContain('Altera o ritmo sem modificar as frequências científicas.');
    for (const label of ['0,5x', '0,75x', '1x', '1,5x', '2x']) expect(html).toContain(`>${label}</option>`);
  });

  it('repetir e silenciar são botões de alternância com aria-pressed', () => {
    expect(render({ isLooping: true })).toContain('aria-pressed="true"');
    const html = render({ isMuted: true, isLooping: false });
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html).toContain('aria-keyshortcuts="L"');
  });

  it('badge vazio informa "Nenhuma observação carregada" em vez de "Passo 1 de 0"', () => {
    const html = render({ totalSteps: 0, currentIndex: 0, currentObservation: null });
    expect(html).toContain('aria-label="Nenhuma observação carregada"');
    expect(html).not.toContain('Passo 1 de 0');
  });

  it('nos limites usa aria-disabled e mantém o botão focável', () => {
    const html = render({ currentIndex: 0, canGoPrevious: false });
    expect(html).toContain('aria-disabled="true"');
    const prevButton = html.slice(html.indexOf('<button'), html.indexOf('</button>'));
    expect(prevButton).not.toMatch(/\sdisabled(=|\s|>)/);
  });

  it('distingue zero chuva de dado ausente com texto e ícone', () => {
    expect(describeDataState(makeObs(0)).text).toBe('0.0 mm/h · Tempo seco (sem chuva)');
    expect(describeDataState(makeObs(null, 'missing'))).toEqual({
      state: 'missing',
      text: 'Dados ausentes (não significa zero chuva)'
    });
    expect(render({ currentObservation: makeObs(null, 'missing') })).toContain('data-state-missing');
    expect(render({ currentObservation: makeObs(0) })).toContain('data-state-dry');
  });
});
