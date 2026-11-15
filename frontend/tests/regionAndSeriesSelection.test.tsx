import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RegionSelector } from '../src/components/RegionSelector';
import { findRegionOption } from '../src/services/dataService';

describe('Seleção da Experiência Científica (Região e Série Temporal)', () => {
  it('oferece a Amazônia Central e a janela candidata de Kisangani', () => {
    const html = renderToStaticMarkup(
      <RegionSelector
        selectedRegionId="amazon_central"
        onSelectRegion={() => {}}
        selectedSeriesId="morning"
        onSelectSeries={() => {}}
      />
    );

    expect(html).toContain('Amazônia Central (Brasil)');
    expect(html).toContain('Bacia do Congo — janela de Kisangani');
    expect(html).toContain('candidata');
  });

  it('oferece séries matutina e vespertina para a Amazônia Central', () => {
    const html = renderToStaticMarkup(
      <RegionSelector
        selectedRegionId="amazon_central"
        onSelectRegion={() => {}}
        selectedSeriesId="morning"
        onSelectSeries={() => {}}
      />
    );

    expect(html).toContain('Madrugada · 00:00–02:30 UTC');
    expect(html).toContain('Tarde · 17:00–19:30 UTC');
  });

  it('seleciona a região e mostra o aviso de escopo candidato do Congo', () => {
    const html = renderToStaticMarkup(
      <RegionSelector
        selectedRegionId="congo_basin_kisangani"
        onSelectRegion={() => {}}
        selectedSeriesId="afternoon"
        onSelectSeries={() => {}}
      />
    );

    expect(html).toContain('Bacia do Congo — janela de Kisangani');
    expect(html).toContain('Região candidata sob validação');
    expect(html).toContain('não toda a bacia');
  });

  it('exibe metadados de proveniência NASA GPM IMERG para a região selecionada', () => {
    const html = renderToStaticMarkup(
      <RegionSelector
        selectedRegionId="amazon_central"
        onSelectRegion={() => {}}
        selectedSeriesId="morning"
        onSelectSeries={() => {}}
      />
    );

    expect(html).toContain('01/01/2024');
    expect(html).toContain('00:00 – 02:30 UTC');
    expect(html).toContain('NASA GPM IMERG Early V07B (Real)');
  });

  it('possui rótulos e descrições acessíveis para leitores de tela (WCAG)', () => {
    const html = renderToStaticMarkup(
      <RegionSelector
        selectedRegionId="amazon_central"
        onSelectRegion={() => {}}
        selectedSeriesId="morning"
        onSelectSeries={() => {}}
      />
    );

    expect(html).toContain('id="region-select"');
    expect(html).toContain('for="region-select"');
    expect(html).toContain('aria-describedby="region-helper-text"');
    expect(html).toContain('id="series-select"');
    expect(html).toContain('for="series-select"');
    expect(html).toContain('aria-describedby="series-helper-text"');
  });

  it('AVAILABLE_REGIONS estrutura corretamente as séries e arquivos de dados', () => {
    const amazon = findRegionOption('amazon_central');
    expect(amazon).toBeDefined();
    expect(amazon?.series).toHaveLength(3);
    expect(amazon?.series[0].filePath).toBe('/data/amazon/observations.json');
    expect(amazon?.series[1].filePath).toBe('/data/amazon/observations_afternoon.json');
    expect(amazon?.series[2].filePath).toBe('/data/amazon/observations_day_windows.json');

    const congo = findRegionOption('congo_basin_kisangani');
    expect(congo).toBeDefined();
    expect(congo?.status).toBe('candidate');
    expect(congo?.series).toHaveLength(1);
    expect(congo?.series[0].filePath).toBe('/data/congo/observations.json');
  });
});
