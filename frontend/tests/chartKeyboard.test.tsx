import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PrecipitationChart, resolveChartKey } from '../src/components/PrecipitationChart';
import { TemporalObservation } from '../src/types/dataset';

function makeObs(index: number, rate: number | null): TemporalObservation {
  return {
    observation_id: `obs-${index}`,
    step_index: index,
    timestamp_utc: `2024-01-01T0${index}:30:00Z`,
    availability: { status: rate === null ? 'missing' : 'available', valid_cells_ratio: 1, missing_cells_count: 0, total_cells_count: 10 },
    scientific_indicators: {
      mean_precipitation_rate: { value: rate, unit: 'mm/h', description: '' },
      rain_area_fraction: { value: rate === null ? null : 0.4, unit: 'fraction', description: '' }
    },
    visual_frame_reference: { frame_id: `f-${index}`, image_path: '', source_system: 'NASA', synchronization_status: 'pending_official_validation', alt_text: '' },
    textual_summary: ''
  };
}

const observations = [makeObs(0, 1), makeObs(1, 3), makeObs(2, null), makeObs(3, 0.5)];

function render(currentIndex: number): string {
  return renderToStaticMarkup(
    createElement(PrecipitationChart, { observations, currentIndex, onSelectStep: () => undefined, isSample: false, loading: false, error: null })
  );
}

describe('resolveChartKey', () => {
  it('setas, Home e End respeitam os limites', () => {
    expect(resolveChartKey('ArrowRight', 1, 4)).toBe(2);
    expect(resolveChartKey('ArrowLeft', 1, 4)).toBe(0);
    expect(resolveChartKey('ArrowRight', 3, 4)).toBe(3);
    expect(resolveChartKey('ArrowLeft', 0, 4)).toBe(0);
    expect(resolveChartKey('Home', 2, 4)).toBe(0);
    expect(resolveChartKey('End', 1, 4)).toBe(3);
  });

  it('ignora outras teclas e séries vazias', () => {
    expect(resolveChartKey('Tab', 1, 4)).toBeNull();
    expect(resolveChartKey('ArrowRight', 0, 0)).toBeNull();
  });
});

describe('PrecipitationChart acessibilidade', () => {
  it('tem uma única parada de Tab (tabindex móvel) no ponto ativo', () => {
    const html = render(1);
    expect(html.match(/tabindex="0"/g)).toHaveLength(1);
    expect(html.match(/tabindex="-1"/g)).toHaveLength(3);
    const active = html.slice(html.indexOf('data-step-index="1"'), html.indexOf('data-step-index="2"'));
    expect(active).toContain('tabindex="0"');
  });

  it('rotula os pontos com instante legível, não ISO cru, e ausente nunca como valor', () => {
    const html = render(0);
    expect(html).not.toContain('2024-01-01T00:30:00Z:');
    expect(html).toContain('(UTC)');
    expect(html).toContain('dado ausente, sem valor numérico');
  });
});
