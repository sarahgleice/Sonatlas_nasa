import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { createObservationSonificationParams, FREQ_REST } from '../src/audio/sonificationMapping';
import { RegionDataset } from '../src/types/dataset';

describe('Integração Real de Dados da Amazônia e Motor de Sonificação da Hazel', () => {
  const jsonPath = path.resolve(__dirname, '../public/data/amazon/observations.json');

  it('carrega com sucesso o observations.json da Amazônia Central', () => {
    expect(fs.existsSync(jsonPath)).toBe(true);
    const rawData = fs.readFileSync(jsonPath, 'utf-8');
    const dataset: RegionDataset = JSON.parse(rawData);

    expect(dataset.region_id).toBe('amazon_central');
    expect(dataset.product_name).toBe('GPM_3IMERGHHE');
    expect(dataset.product_version).toBe('07B');
    expect(dataset.observations).toHaveLength(6);
  });

  it('valida sequência cronológica estrita de 30 minutos em UTC', () => {
    const rawData = fs.readFileSync(jsonPath, 'utf-8');
    const dataset: RegionDataset = JSON.parse(rawData);

    const expectedTimestamps = [
      '2024-01-01T00:00:00Z',
      '2024-01-01T00:30:00Z',
      '2024-01-01T01:00:00Z',
      '2024-01-01T01:30:00Z',
      '2024-01-01T02:00:00Z',
      '2024-01-01T02:30:00Z',
    ];

    const actualTimestamps = dataset.observations.map(o => o.timestamp_utc);
    expect(actualTimestamps).toEqual(expectedTimestamps);
  });

  it('gera parâmetros acústicos precisos para os seis passos no motor da Hazel', () => {
    const rawData = fs.readFileSync(jsonPath, 'utf-8');
    const dataset: RegionDataset = JSON.parse(rawData);

    // Passo 0: 00:00 UTC - Chuva moderada ativa (taxa ~0.3817 mm/h, cobertura ~35.2%)
    const params0 = createObservationSonificationParams(dataset.observations[0]);
    expect(params0.isMissing).toBe(false);
    expect(params0.frequency).toBe(274); // Freq calculada: 274 Hz
    expect(params0.pulseCount).toBe(3); // 3 pulsos ritmados

    // Passo 1: 00:30 UTC - Dissipação inicial (taxa ~0.2668 mm/h, cobertura ~26.5%)
    const params1 = createObservationSonificationParams(dataset.observations[1]);
    expect(params1.isMissing).toBe(false);
    expect(params1.frequency).toBe(260); // Freq calculada: 260 Hz
    expect(params1.pulseCount).toBe(3); // 3 pulsos

    // Passo 2: 01:00 UTC - Traço residual (< 0.1 mm/h) -> Tom de repouso canônico C3
    const params2 = createObservationSonificationParams(dataset.observations[2]);
    expect(params2.isMissing).toBe(false);
    expect(params2.frequency).toBe(FREQ_REST); // 130 Hz
    expect(params2.pulseCount).toBe(1); // 1 pulso calmo

    // Passo 3: 01:30 UTC - Traço residual (< 0.1 mm/h) -> Tom de repouso
    const params3 = createObservationSonificationParams(dataset.observations[3]);
    expect(params3.isMissing).toBe(false);
    expect(params3.frequency).toBe(FREQ_REST); // 130 Hz
    expect(params3.pulseCount).toBe(1);

    // Passo 4: 02:00 UTC - Traço residual isolado -> Tom de repouso
    const params4 = createObservationSonificationParams(dataset.observations[4]);
    expect(params4.isMissing).toBe(false);
    expect(params4.frequency).toBe(FREQ_REST); // 130 Hz
    expect(params4.pulseCount).toBe(1);

    // Passo 5: 02:30 UTC - Calmaria total (0.00 mm/h) -> Tom de repouso
    const params5 = createObservationSonificationParams(dataset.observations[5]);
    expect(params5.isMissing).toBe(false);
    expect(params5.frequency).toBe(FREQ_REST); // 130 Hz
    expect(params5.pulseCount).toBe(1);
  });
});
