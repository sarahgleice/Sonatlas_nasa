import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildSonificationExplanation } from '../src/utils/scientificExplanation';
import { TemporalObservation } from '../src/types/dataset';

function makeObs(
  index: number,
  rate: number | null,
  coverage: number | null,
  status: TemporalObservation['availability']['status'] = 'available'
): TemporalObservation {
  return {
    observation_id: `obs-${index}`,
    step_index: index,
    timestamp_utc: `2024-01-01T0${index}:00:00Z`,
    availability: {
      status,
      valid_cells_ratio: status === 'missing' ? 0 : 1,
      missing_cells_count: 0,
      total_cells_count: 10
    },
    scientific_indicators: {
      mean_precipitation_rate: { value: rate, unit: 'mm/h', description: '' },
      rain_area_fraction: { value: coverage, unit: 'fraction', description: '' }
    },
    visual_frame_reference: {
      frame_id: `f-${index}`,
      image_path: '',
      source_system: 'NASA',
      synchronization_status: 'pending_official_validation',
      alt_text: ''
    },
    textual_summary: ''
  };
}

const missing = makeObs(3, null, null, 'missing');

describe('buildSonificationExplanation', () => {
  it('sem observação selecionada, orienta a escolher um passo', () => {
    const result = buildSonificationExplanation(null, null, 0, 6);
    expect(result.headline).toBe('Nenhuma observação selecionada');
  });

  it('dado ausente explica o tom de alerta e nunca infere chuva ou 0 mm/h', () => {
    const result = buildSonificationExplanation(missing, makeObs(2, 5, 0.5), 3, 6);
    expect(result.headline).toContain('dado ausente');
    expect(result.pitchComparison).toContain('onda quadrada');
    expect(result.temporalChange).toContain('Não é possível inferir chuva nem 0 mm/h');
    // Nenhuma taxa numérica (como "0.0 mm/h" ou "5.0 mm/h") pode ser atribuída ao passo ausente.
    expect(result.fullText).not.toMatch(/\d+\.\d+ mm\/h/);
  });

  it('primeiro passo descreve a linha de base com nota e pulsos', () => {
    const result = buildSonificationExplanation(makeObs(0, 5.2, 0.4), null, 0, 6);
    expect(result.headline).toContain('linha de base');
    expect(result.pitchComparison).toContain('5.2 mm/h');
    expect(result.pulseComparison).toContain('40% da área com chuva');
    expect(result.temporalChange).toContain('primeiro passo');
  });

  it('subida de intensidade com área maior: nota mais aguda e pulsos mais densos', () => {
    const result = buildSonificationExplanation(makeObs(2, 12, 0.8), makeObs(1, 2, 0.2), 2, 6);
    expect(result.headline).toContain('mais intensa');
    expect(result.pitchComparison).toContain('mais aguda');
    expect(result.pulseComparison).toContain('mais densos');
    expect(result.pulseComparison).toContain('espalhou');
    expect(result.temporalChange).toContain('+10.0 mm/h');
  });

  it('queda de intensidade com área menor: nota mais grave e pulsos mais espaçados', () => {
    const result = buildSonificationExplanation(makeObs(2, 2, 0.2), makeObs(1, 12, 0.8), 2, 6);
    expect(result.headline).toContain('mais fraca');
    expect(result.pitchComparison).toContain('mais grave');
    expect(result.pulseComparison).toContain('mais espaçados');
    expect(result.pulseComparison).toContain('concentrou');
    expect(result.temporalChange).toContain('−10.0 mm/h');
  });

  it('variação menor que o limiar é tratada como estável, com densidade de pulsos igual', () => {
    const result = buildSonificationExplanation(makeObs(2, 5.02, 0.5), makeObs(1, 5.0, 0.5), 2, 6);
    expect(result.headline).toContain('estável');
    expect(result.pulseComparison).toContain('igual');
  });

  it('zero exato é descrito como dado válido (tempo seco), distinto de ausente', () => {
    const result = buildSonificationExplanation(makeObs(2, 0, 0), makeObs(1, 3, 0.4), 2, 6);
    expect(result.pitchComparison).toContain('0.0 mm/h');
    expect(result.pitchComparison).toContain('zero exato e dado válido');
    expect(result.pitchComparison).toContain('130 Hz');
    expect(result.pitchComparison).not.toContain('onda quadrada');
  });

  it('dois passos abaixo do limiar mantêm o mesmo tom de repouso apesar de traços diferentes', () => {
    const result = buildSonificationExplanation(makeObs(3, 0.0013, 0.0027), makeObs(2, 0.0007, 0.0013), 3, 6);
    expect(result.headline).toContain('sem precipitação mensurável');
    expect(result.pitchComparison).toContain('mesmo tom de repouso');
  });

  it('passo após dado ausente informa variação indisponível em vez de linha de base', () => {
    const result = buildSonificationExplanation(makeObs(4, 1.2, 0.3), missing, 4, 6);
    expect(result.headline).toContain('retomada');
    expect(result.temporalChange).toContain('indisponível');
    expect(result.headline).not.toContain('linha de base');
  });

  it('é determinístico e produz texto completo a partir das partes', () => {
    const a = buildSonificationExplanation(makeObs(2, 12, 0.8), makeObs(1, 2, 0.2), 2, 6);
    const b = buildSonificationExplanation(makeObs(2, 12, 0.8), makeObs(1, 2, 0.2), 2, 6);
    expect(a).toEqual(b);
    expect(a.fullText).toContain(a.headline);
    expect(a.fullText).toContain(a.temporalChange);
  });

  it('cobre a série real da Amazônia Central sem texto vazio e com o último passo em 0.0 mm/h', () => {
    const file = resolve(__dirname, '../public/data/amazon/observations.json');
    const dataset = JSON.parse(readFileSync(file, 'utf-8')) as { observations: TemporalObservation[] };
    const observations = dataset.observations;
    const explanations = observations.map((obs, i) =>
      buildSonificationExplanation(obs, i > 0 ? observations[i - 1] : null, i, observations.length)
    );
    for (const explanation of explanations) {
      expect(explanation.fullText.length).toBeGreaterThan(20);
    }
    const last = explanations[explanations.length - 1];
    expect(last.pitchComparison).toContain('zero exato e dado válido');
  });
});
