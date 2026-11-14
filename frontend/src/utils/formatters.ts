/**
 * Utilitários de formatação textual e unidades para o SONATLAS.
 */

export function formatPrecipitationRate(rate: number | null | undefined): string {
  if (rate === null || rate === undefined) {
    return 'Não disponível';
  }
  const formatted = rate > 0 && rate < 0.1
    ? new Intl.NumberFormat('pt-BR', { maximumSignificantDigits: 3 }).format(rate)
    : rate.toFixed(1);
  return `${formatted} mm/h`;
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
  if (rate === 0) return 'Taxa média registrada como zero';
  if (rate < 0.1) return 'Abaixo do limiar operacional do som';
  if (rate < 2.5) return 'Chuva fraca';
  if (rate < 10.0) return 'Chuva moderada';
  return 'Chuva forte / tempestade';
}

export function getRatePresentationNote(rate: number | null | undefined): string | null {
  if (rate === null || rate === undefined) return 'Taxa média indisponível; dado ausente não equivale a taxa zero.';
  if (rate === 0) return `Taxa média registrada: ${formatPrecipitationRate(rate)}. O áudio usa o tom de repouso pela regra operacional de 0,1 mm/h.`;
  if (rate > 0 && rate < 0.1) return `Taxa média registrada: ${formatPrecipitationRate(rate)}. O valor é positivo e está abaixo do limiar operacional sonoro de 0,1 mm/h; por isso, o áudio usa o tom de repouso. O som não altera a medição.`;
  return null;
}
