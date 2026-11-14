/**
 * Utilitários de formatação textual e unidades para o SONATLAS.
 */

export function formatPrecipitationRate(rate: number | null | undefined): string {
  if (rate === null || rate === undefined) {
    return 'Não disponível';
  }
  return `${rate.toFixed(1)} mm/h`;
}

export function formatAreaFraction(fraction: number | null | undefined): string {
  if (fraction === null || fraction === undefined) {
    return 'Não disponível';
  }
  return `${(fraction * 100).toFixed(0)}%`;
}

export function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC'
    }).format(date) + ' (UTC)';
  } catch {
    return isoString;
  }
}

export function getIntensityLabel(rate: number | null | undefined): string {
  if (rate === null || rate === undefined) return 'Indisponível';
  if (rate < 0.1) return 'Sem precipitação mensurável';
  if (rate < 2.5) return 'Chuva fraca';
  if (rate < 10.0) return 'Chuva moderada';
  return 'Chuva forte / tempestade';
}
