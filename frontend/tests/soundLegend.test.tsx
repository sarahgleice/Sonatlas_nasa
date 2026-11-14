import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SoundLegend, buildLegendSamples } from '../src/components/SoundLegend';
import { FREQ_REST, mapCoverageToPulses, mapRateToFrequency } from '../src/audio/sonificationMapping';

describe('SoundLegend', () => {
  const samples = buildLegendSamples();

  it('inclui calibração de tempo seco (0.0 mm/h) no tom de repouso, distinta do dado ausente', () => {
    const dry = samples.find((sample) => sample.id === 'dry');
    const missing = samples.find((sample) => sample.id === 'missing');
    expect(dry?.frequency).toBe(FREQ_REST);
    expect(dry?.isMissing).toBe(false);
    expect(dry?.description).toContain('dado válido');
    expect(missing?.isMissing).toBe(true);
    expect(missing?.description).toContain('diferente de zero chuva');
  });

  it('deriva frequência e pulsos do mapeamento de sonificação, sem números soltos', () => {
    for (const sample of samples.filter((item) => !item.isMissing)) {
      expect(sample.frequency).toBe(mapRateToFrequency(sample.rate));
      expect(sample.pulseCount).toBe(mapCoverageToPulses(sample.coverage));
    }
  });

  it('a altura cresce e os pulsos aumentam de chuva leve para tempestade', () => {
    const light = samples.find((sample) => sample.id === 'light');
    const storm = samples.find((sample) => sample.id === 'storm');
    expect(storm!.frequency).toBeGreaterThan(light!.frequency);
    expect(storm!.pulseCount).toBeGreaterThan(light!.pulseCount);
  });

  it('renderiza um botão por amostra com aria-pressed e região de status para avisos', () => {
    const html = renderToStaticMarkup(createElement(SoundLegend));
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(samples.length);
    expect(html).toContain('Tempo seco (0.0 mm/h)');
    expect(html).toContain('role="status"');
    expect(html).toContain('onda quadrada');
    expect(html).toContain('<h3 id="sound-legend-title"');
  });
});
