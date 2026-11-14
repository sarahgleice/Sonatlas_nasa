import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ScientificSummary } from '../src/components/ScientificSummary';
import { TemporalObservation } from '../src/types/dataset';

function makeObs(
  index: number,
  rate: number | null,
  status: TemporalObservation['availability']['status'] = 'available',
  difference: number | null = null
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
      mean_precipitation_rate: { value: rate, unit: 'mm/h', description: '' },
      rain_area_fraction: { value: rate === null ? null : 0.4, unit: 'fraction', description: '' },
      temporal_difference: { value: difference, unit: 'mm/h', description: '' }
    },
    visual_frame_reference: {
      frame_id: `f-${index}`,
      image_path: '',
      source_system: 'NASA',
      synchronization_status: 'pending_official_validation',
      alt_text: ''
    },
    textual_summary: 'Resumo textual da observação.'
  };
}

function render(props: Parameters<typeof ScientificSummary>[0]): string {
  return renderToStaticMarkup(createElement(ScientificSummary, props));
}

describe('ScientificSummary', () => {
  it('rotula a disponibilidade em português, sem vazar o enum em inglês', () => {
    const available = render({ observation: makeObs(1, 5), regionName: 'Amazônia', index: 1, total: 6 });
    expect(available).toContain('Status de disponibilidade dos dados: Disponível');
    expect(available).not.toContain('available');

    const partial = render({ observation: makeObs(1, 0.4, 'partial'), regionName: 'Amazônia', index: 1, total: 6 });
    expect(partial).toContain('Disponibilidade parcial');

    const missing = render({ observation: makeObs(1, null, 'missing'), regionName: 'Amazônia', index: 1, total: 6 });
    expect(missing).toContain('Status de disponibilidade dos dados: Dados ausentes');
  });

  it('inclui o bloco "Entenda o que você ouviu" como seção rotulada', () => {
    const html = render({
      observation: makeObs(2, 12),
      previousObservation: makeObs(1, 2),
      regionName: 'Amazônia',
      index: 2,
      total: 6
    });
    expect(html).toContain('Entenda o que você ouviu');
    expect(html).toContain('aria-labelledby="listening-title"');
    expect(html).toContain('mais aguda');
  });

  it('diferença temporal nula após o primeiro passo é "Indisponível", e no primeiro passo é linha de base', () => {
    const afterGap = render({ observation: makeObs(4, 1.2), regionName: 'Amazônia', index: 4, total: 6 });
    expect(afterGap).toContain('Indisponível (passo anterior ausente)');

    const first = render({ observation: makeObs(0, 1.2), regionName: 'Amazônia', index: 0, total: 6 });
    expect(first).toContain('Linha base (primeiro passo)');
  });

  it('usa seção rotulada em vez de div com aria-label e hierarquia h3/h4', () => {
    const html = render({ observation: makeObs(1, 5), regionName: 'Amazônia', index: 1, total: 6 });
    expect(html).toContain('<section class="textual-summary-box" aria-labelledby="textual-summary-title">');
    expect(html).toContain('<h3 id="summary-title"');
    expect(html).not.toContain('<h2');
  });
});
