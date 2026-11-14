import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Timeline, buildTimelineValueText, resolveTimelineKey } from '../src/components/Timeline';
import { TemporalObservation } from '../src/types/dataset';

function makeObs(index: number, rate: number | null, timestamp = `2024-01-01T0${index}:00:00Z`): TemporalObservation {
  return {
    observation_id: `obs-${index}`,
    step_index: index,
    timestamp_utc: timestamp,
    availability: { status: rate === null ? 'missing' : 'available', valid_cells_ratio: 1, missing_cells_count: 0, total_cells_count: 10 },
    scientific_indicators: {
      mean_precipitation_rate: { value: rate, unit: 'mm/h', description: '' },
      rain_area_fraction: { value: rate === null ? null : 0.4, unit: 'fraction', description: '' }
    },
    visual_frame_reference: { frame_id: `f-${index}`, image_path: '', source_system: 'NASA', synchronization_status: 'pending_official_validation', alt_text: '' },
    textual_summary: ''
  };
}

const observations = [makeObs(0, 0.38), makeObs(1, 5.2), makeObs(2, 0), makeObs(3, null)];

describe('resolveTimelineKey', () => {
  it('move um passo com setas e respeita os limites sem dar a volta', () => {
    expect(resolveTimelineKey('ArrowRight', 1, 4)).toBe(2);
    expect(resolveTimelineKey('ArrowUp', 1, 4)).toBe(2);
    expect(resolveTimelineKey('ArrowLeft', 1, 4)).toBe(0);
    expect(resolveTimelineKey('ArrowDown', 1, 4)).toBe(0);
    expect(resolveTimelineKey('ArrowRight', 3, 4)).toBe(3);
    expect(resolveTimelineKey('ArrowLeft', 0, 4)).toBe(0);
  });

  it('Home, End, PageUp e PageDown', () => {
    expect(resolveTimelineKey('Home', 2, 10)).toBe(0);
    expect(resolveTimelineKey('End', 2, 10)).toBe(9);
    expect(resolveTimelineKey('PageUp', 2, 10)).toBe(7);
    expect(resolveTimelineKey('PageUp', 8, 10)).toBe(9);
    expect(resolveTimelineKey('PageDown', 2, 10)).toBe(0);
  });

  it('ignora outras teclas e séries vazias', () => {
    expect(resolveTimelineKey('Tab', 1, 4)).toBeNull();
    expect(resolveTimelineKey('Space', 1, 4)).toBeNull();
    expect(resolveTimelineKey('ArrowRight', 0, 0)).toBeNull();
  });
});

describe('buildTimelineValueText', () => {
  it('descreve passo, instante UTC e taxa', () => {
    const text = buildTimelineValueText(observations[1], 1, 4);
    expect(text).toContain('Passo 2 de 4');
    expect(text).toContain('(UTC)');
    expect(text).toContain('5.2 mm/h');
  });

  it('zero é dito "sem chuva" e ausente nunca vira 0 mm/h', () => {
    expect(buildTimelineValueText(observations[2], 2, 4)).toContain('0.0 mm/h, sem chuva');
    const missing = buildTimelineValueText(observations[3], 3, 4);
    expect(missing).toContain('dados ausentes');
    expect(missing).not.toContain('mm/h');
  });
});

describe('Timeline markup', () => {
  const html = renderToStaticMarkup(
    createElement(Timeline, { observations, currentIndex: 1, onSelectStep: () => undefined })
  );

  it('é um único slider focável com valores ARIA corretos', () => {
    expect(html.match(/role="slider"/g)).toHaveLength(1);
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-valuemin="1"');
    expect(html).toContain('aria-valuemax="4"');
    expect(html).toContain('aria-valuenow="2"');
    expect(html).toContain('aria-orientation="horizontal"');
    expect(html).toContain('aria-valuetext="Passo 2 de 4');
    expect(html).toContain('aria-labelledby="timeline-title"');
  });

  it('não cria botões nem paradas de Tab extras: marcadores são decorativos e ocultos', () => {
    expect(html).not.toContain('<button');
    expect(html).toContain('<ol class="timeline-list" aria-hidden="true">');
    expect(html.match(/tabindex=/g)).toHaveLength(1);
  });

  it('distingue ausente (ícone, hachura e texto) de zero (rótulo "Sem chuva")', () => {
    expect(html).toContain('timeline-step-missing');
    expect(html).toContain('Ausente');
    expect(html).toContain('timeline-step-dry');
    expect(html).toContain('Sem chuva');
  });

  it('séries multi-dia incluem a data no marcador', () => {
    const multiDay = renderToStaticMarkup(
      createElement(Timeline, {
        observations: [makeObs(0, 1, '2024-01-01T23:30:00Z'), makeObs(1, 1, '2024-01-02T00:00:00Z')],
        currentIndex: 0,
        onSelectStep: () => undefined
      })
    );
    expect(multiDay).toContain('01/01');
    expect(multiDay).toContain('02/01');
  });
});
