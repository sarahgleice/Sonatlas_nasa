import { describe, it, expect } from 'vitest';
import { buildAnnouncement } from '../src/utils/announcements';
import { TemporalObservation } from '../src/types/dataset';

function makeObs(
  index: number,
  rate: number | null,
  status: TemporalObservation['availability']['status'] = 'available'
): TemporalObservation {
  return {
    observation_id: `obs-${index}`,
    step_index: index,
    timestamp_utc: `2024-01-01T0${index}:00:00Z`,
    availability: {
      status,
      valid_cells_ratio: status === 'missing' ? 0 : status === 'partial' ? 0.5 : 1,
      missing_cells_count: 0,
      total_cells_count: 10
    },
    scientific_indicators: {
      mean_precipitation_rate: { value: rate, unit: 'mm/h', description: 'Taxa média' },
      rain_area_fraction: { value: rate === null ? null : 0.4, unit: 'fraction', description: 'Fração' }
    },
    visual_frame_reference: {
      frame_id: `frame-${index}`,
      image_path: '',
      source_system: 'NASA',
      synchronization_status: 'pending_official_validation',
      alt_text: ''
    },
    textual_summary: ''
  };
}

const rain = makeObs(1, 5.2);
const dry = makeObs(2, 0);
const missing = makeObs(3, null, 'missing');

describe('buildAnnouncement', () => {
  it('suprime anúncio quando a mudança vem do slider (o leitor já lê aria-valuetext)', () => {
    expect(buildAnnouncement({ source: 'slider_step', observation: rain, index: 1, total: 6 })).toBeNull();
  });

  it('retorna null sem observação ou sem passos', () => {
    expect(buildAnnouncement({ source: 'manual_step', observation: null, index: 0, total: 6 })).toBeNull();
    expect(buildAnnouncement({ source: 'manual_step', observation: rain, index: 0, total: 0 })).toBeNull();
  });

  it('manual_step: anúncio polite completo com passo, taxa, intensidade e cobertura', () => {
    const result = buildAnnouncement({ source: 'manual_step', observation: rain, index: 1, total: 6 });
    expect(result?.politeness).toBe('polite');
    expect(result?.text).toContain('Passo 2 de 6');
    expect(result?.text).toContain('5.2 mm/h');
    expect(result?.text).toContain('Chuva moderada');
    expect(result?.text).toContain('40%');
  });

  it('manual_step: zero exato é dito como zero e dado ausente nunca como 0 mm/h', () => {
    const dryText = buildAnnouncement({ source: 'manual_step', observation: dry, index: 2, total: 6 })?.text ?? '';
    expect(dryText).toContain('0.0 mm/h');

    const missingText = buildAnnouncement({ source: 'manual_step', observation: missing, index: 3, total: 6 })?.text ?? '';
    expect(missingText).toContain('Dados ausentes');
    expect(missingText).not.toContain('mm/h');
    expect(missingText).not.toContain('0.0');
  });

  it('manual_step: sinaliza disponibilidade parcial', () => {
    const partial = makeObs(4, 0.38, 'partial');
    const text = buildAnnouncement({ source: 'manual_step', observation: partial, index: 4, total: 6 })?.text ?? '';
    expect(text).toContain('Disponibilidade parcial');
  });

  it('play_start: anúncio curto, avisa dado ausente inicial e áudio silenciado', () => {
    expect(buildAnnouncement({ source: 'play_start', observation: rain, index: 0, total: 6 })?.text)
      .toBe('Reprodução iniciada no passo 1 de 6.');
    const text = buildAnnouncement({ source: 'play_start', observation: missing, index: 0, total: 6, isMuted: true })?.text ?? '';
    expect(text).toContain('Dados ausentes');
    expect(text).toContain('silenciado');
  });

  it('playback_auto: silencioso em passos com chuva ou secos', () => {
    expect(buildAnnouncement({ source: 'playback_auto', observation: rain, index: 1, total: 6, previousObservation: dry })).toBeNull();
    expect(buildAnnouncement({ source: 'playback_auto', observation: dry, index: 2, total: 6, previousObservation: rain })).toBeNull();
  });

  it('playback_auto: alerta assertive só na transição para dado ausente', () => {
    const entering = buildAnnouncement({ source: 'playback_auto', observation: missing, index: 3, total: 6, previousObservation: rain });
    expect(entering).toEqual({ text: 'Alerta: passo 4 sem dados disponíveis.', politeness: 'assertive' });

    const staying = buildAnnouncement({ source: 'playback_auto', observation: missing, index: 4, total: 6, previousObservation: missing });
    expect(staying).toBeNull();
  });

  it('playback_pause e playback_end anunciam o ponto de parada e a conclusão', () => {
    const pause = buildAnnouncement({ source: 'playback_pause', observation: rain, index: 2, total: 6 });
    expect(pause?.politeness).toBe('polite');
    expect(pause?.text).toContain('Reprodução pausada');
    expect(pause?.text).toContain('Passo 3 de 6');

    expect(buildAnnouncement({ source: 'playback_end', observation: rain, index: 5, total: 6 })?.text)
      .toBe('Sequência concluída no passo 6 de 6.');
  });
});
