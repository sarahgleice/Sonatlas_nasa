import { describe, it, expect } from 'vitest';
import {
  formatPrecipitationRate,
  formatAreaFraction,
  getIntensityLabel
} from '../src/utils/formatters';

describe('formatters', () => {
  it('formata taxa de precipitação com unidade estrita mm/h', () => {
    expect(formatPrecipitationRate(5.24)).toBe('5.2 mm/h');
    expect(formatPrecipitationRate(0.001347697)).toBe('0,00135 mm/h');
    expect(formatPrecipitationRate(0)).toBe('0.0 mm/h');
    expect(formatPrecipitationRate(null)).toBe('Não disponível');
  });

  it('formata fração de área em percentual', () => {
    expect(formatAreaFraction(0.65)).toBe('65%');
    expect(formatAreaFraction(null)).toBe('Não disponível');
  });

  it('classifica rótulo de intensidade corretamente', () => {
    expect(getIntensityLabel(null)).toBe('Indisponível');
    expect(getIntensityLabel(0.0)).toBe('Taxa média registrada como zero');
    expect(getIntensityLabel(0.04)).toBe('Abaixo do limiar operacional do som');
    expect(getIntensityLabel(1.5)).toBe('Chuva fraca');
    expect(getIntensityLabel(5.0)).toBe('Chuva moderada');
    expect(getIntensityLabel(25.0)).toBe('Chuva forte / tempestade');
  });
});
