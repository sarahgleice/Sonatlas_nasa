import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { VisualFrameViewer, formatFrameSyncStatus, hasFrameImage } from '../src/components/VisualFrameViewer';
import { TemporalObservation } from '../src/types/dataset';

function makeObs(imagePath: string, status: 'verified' | 'pending_official_validation' = 'pending_official_validation'): TemporalObservation {
  return {
    observation_id: 'obs-1',
    step_index: 1,
    timestamp_utc: '2024-01-01T00:30:00Z',
    availability: { status: 'available', valid_cells_ratio: 1, missing_cells_count: 0, total_cells_count: 10 },
    scientific_indicators: {
      mean_precipitation_rate: { value: 0.3, unit: 'mm/h', description: '' },
      rain_area_fraction: { value: 0.2, unit: 'fraction', description: '' }
    },
    visual_frame_reference: {
      frame_id: 'frame_1',
      image_path: imagePath,
      source_system: 'NASA SVS 4285',
      synchronization_status: status,
      alt_text: 'Precipitação leve cobrindo 20% da área.'
    },
    textual_summary: ''
  };
}

const render = (observation: TemporalObservation | null) =>
  renderToStaticMarkup(createElement(VisualFrameViewer, { observation }));

describe('VisualFrameViewer', () => {
  it('não renderiza nada sem observação', () => {
    expect(render(null)).toBe('');
  });

  it('sem imagem, mostra estado vazio honesto com a descrição textual, fonte, instante e situação', () => {
    const html = render(makeObs(''));
    expect(html).not.toContain('<img');
    expect(html).toContain('ainda não está disponível');
    expect(html).toContain('Precipitação leve cobrindo 20% da área.');
    expect(html).toContain('NASA SVS 4285');
    expect(html).toContain('(UTC)');
    expect(html).toContain('pendente de validação oficial');
  });

  it('com imagem, usa o texto alternativo da referência do quadro', () => {
    const html = render(makeObs('/visualizations/frame_1.png', 'verified'));
    expect(html).toContain('<img');
    expect(html).toContain('alt="Precipitação leve cobrindo 20% da área."');
    expect(html).toContain('Sincronização verificada');
  });

  it('usa figure rotulada e ícone decorativo', () => {
    const html = render(makeObs(''));
    expect(html).toContain('<figure');
    expect(html).toContain('aria-labelledby="visual-frame-title"');
    expect(html).toContain('aria-hidden="true"');
  });

  it('helpers distinguem situação e presença de imagem', () => {
    expect(formatFrameSyncStatus('verified')).toBe('Sincronização verificada');
    expect(hasFrameImage(makeObs('   ').visual_frame_reference)).toBe(false);
    expect(hasFrameImage(makeObs('/a.png').visual_frame_reference)).toBe(true);
  });
});
