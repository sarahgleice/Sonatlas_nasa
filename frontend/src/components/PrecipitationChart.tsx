import React from 'react';
import { TemporalObservation } from '../types/dataset';
import { formatPrecipitationRate } from '../utils/formatters';

export interface ChartPoint {
  index: number;
  timestamp: string;
  value: number | null;
  x: number;
  y: number;
}

function formatChartTick(timestamp: string): string {
  return `${new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'UTC'
  }).format(new Date(timestamp))} UTC`;
}

export function buildPrecipitationChart(observations: TemporalObservation[]): ChartPoint[] {
  if (!observations.length) return [];
  const dated = observations.map((observation, index) => ({
    index,
    timestamp: observation.timestamp_utc,
    time: Date.parse(observation.timestamp_utc),
    value: observation.availability.status === 'missing'
      ? null
      : observation.scientific_indicators.mean_precipitation_rate.value
  })).sort((a, b) => a.time - b.time);
  const times = dated.map((point) => point.time);
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const maxValue = Math.max(0, ...dated.map((point) => point.value ?? 0));
  const points: ChartPoint[] = dated.map((point) => ({
    index: point.index,
    timestamp: point.timestamp,
    value: point.value,
    x: minTime === maxTime ? 50 : ((point.time - minTime) / (maxTime - minTime)) * 100,
    y: point.value === null ? 100 : 100 - (maxValue === 0 ? 0 : (point.value / maxValue) * 100)
  }));
  return points;
}

export function segmentPrecipitationChart(points: ChartPoint[]): ChartPoint[][] {
  const segments: ChartPoint[][] = [];
  for (const [index, point] of points.entries()) {
    if (point.value === null) continue;
    if (!segments.length || points[index - 1]?.value === null) segments.push([]);
    segments[segments.length - 1].push(point);
  }
  return segments;
}

interface PrecipitationChartProps {
  observations: TemporalObservation[];
  currentIndex: number;
  onSelectStep: (index: number) => void;
  isSample: boolean;
  loading: boolean;
  error: string | null;
}

export const PrecipitationChart: React.FC<PrecipitationChartProps> = ({
  observations, currentIndex, onSelectStep, isSample, loading, error
}) => {
  if (loading || error || observations.length === 0) {
    return <section className="precipitation-chart card" aria-labelledby="chart-title">
      <h3 id="chart-title">Série temporal · taxa média</h3>
      <p role={error ? 'alert' : 'status'}>{loading ? 'Carregando gráfico…' : error ? `Gráfico indisponível: ${error}` : 'Sem observações disponíveis para o gráfico.'}</p>
    </section>;
  }

  const plotted = buildPrecipitationChart(observations);
  const segments = segmentPrecipitationChart(plotted);
  const maxValue = Math.max(0, ...plotted.map((point) => point.value ?? 0));
  return <section className="precipitation-chart card" aria-labelledby="chart-title">
    <div className="chart-heading"><h3 id="chart-title">Série temporal · taxa média</h3>{isSample && <span className="badge badge-warning">Amostra técnica</span>}</div>
    <p className="chart-unit">Precipitação média (mm/h)</p>
    <p className="chart-scale">Escala vertical: 0–{maxValue.toFixed(1)} mm/h</p>
    <svg viewBox="-4 -4 108 130" role="group" aria-label="Gráfico interativo da taxa média de precipitação. Selecione um ponto para sincronizar o período e a sonificação.">
      <line x1="0" y1="100" x2="100" y2="100" className="chart-axis" />
      {segments.map((segment, idx) => segment.length > 1 && <polyline key={idx} points={segment.map((point) => `${point.x},${point.y}`).join(' ')} className="chart-line" />)}
      {plotted.map((point) => <g key={point.index} className={`chart-point ${point.index === currentIndex ? 'is-active' : ''}`} role="button" tabIndex={0} aria-pressed={point.index === currentIndex} aria-label={`Passo ${point.index + 1}, timestamp UTC ${point.timestamp}: ${point.value === null ? 'dado ausente, sem valor numérico' : formatPrecipitationRate(point.value)}`} onClick={() => onSelectStep(point.index)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelectStep(point.index); } }}>
        <circle cx={point.x} cy={point.value === null ? 108 : point.y} r="11" className="chart-hit-target" />
        {point.value === null ? <path d={`M ${point.x - 1.4} 106.6 l 2.8 2.8 m 0 -2.8 l -2.8 2.8`} className="chart-missing" /> : <circle cx={point.x} cy={point.y} r={point.index === currentIndex ? 2.4 : 1.7} className="chart-marker" />}
        {point.index === currentIndex && <circle cx={point.x} cy={point.value === null ? 108 : point.y} r="4" className="chart-active-ring" />}
      </g>)}
    </svg>
    <div className="chart-time-range"><time dateTime={plotted[0].timestamp}>{formatChartTick(plotted[0].timestamp)}</time><span aria-hidden="true">·</span><time dateTime={plotted[plotted.length - 1].timestamp}>{formatChartTick(plotted[plotted.length - 1].timestamp)}</time></div>
    <p className="chart-missing-key">× Ausente · fora da escala numérica</p>
    <p className="sr-only">Cada ponto é focável e anuncia o timestamp UTC ISO completo e o valor em mm/h. Os marcadores de ausência ficam fora da escala e períodos ausentes não são ligados. Início: {plotted[0].timestamp}. Fim: {plotted[plotted.length - 1].timestamp}.</p>
  </section>;
};
