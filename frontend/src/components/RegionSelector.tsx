import React from 'react';
import { AVAILABLE_REGIONS, findRegionOption } from '../services/dataService';
import { Globe2, CalendarClock } from 'lucide-react';

interface RegionSelectorProps {
  selectedRegionId: string;
  onSelectRegion: (regionId: string) => void;
  selectedSeriesId?: string;
  onSelectSeries?: (seriesId: string) => void;
}

export const RegionSelector: React.FC<RegionSelectorProps> = ({
  selectedRegionId,
  onSelectRegion,
  selectedSeriesId = 'morning',
  onSelectSeries
}) => {
  const selectableRegions = AVAILABLE_REGIONS.filter((region) => region.id === 'amazon_central');
  const currentRegion = selectableRegions.find((region) => region.id === selectedRegionId) ?? selectableRegions[0];
  const availableSeries = currentRegion.series;
  const currentSeries = availableSeries.find((s) => s.id === selectedSeriesId) ?? availableSeries[0];

  const handleRegionChange = (newRegionId: string) => {
    if (newRegionId !== 'amazon_central') return;
    onSelectRegion(newRegionId);
    if (onSelectSeries) {
      const nextRegion = findRegionOption(newRegionId);
      if (nextRegion && nextRegion.series.length > 0) {
        // Se a série atual não existe na nova região, seleciona a primeira da nova região
        const exists = nextRegion.series.some((s) => s.id === selectedSeriesId);
        if (!exists) {
          onSelectSeries(nextRegion.series[0].id);
        }
      }
    }
  };

  return (
    <section className="card region-selector-card" aria-labelledby="region-selector-title">
      <div className="card-header">
        <Globe2 size={20} className="card-icon" aria-hidden="true" />
        <h2 id="region-selector-title" className="card-title">
          Seleção da Experiência
        </h2>
      </div>

      <div className="form-group">
        <label htmlFor="region-select" className="form-label">
          Região de Estudo
        </label>
        <select
          id="region-select"
          className="form-select"
          value={currentRegion.id}
          onChange={(e) => handleRegionChange(e.target.value)}
          aria-describedby="region-helper-text"
        >
          {selectableRegions.map((region) => (
            <option key={region.id} value={region.id}>
              {region.name} ({region.country})
            </option>
          ))}
        </select>
        <p id="region-helper-text" className="form-helper">
          {currentRegion.description ?? 'Recorte espacial homologado com 750 células regulares (0,1°).'}
        </p>
      </div>

      <div className="form-group" style={{ marginTop: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <CalendarClock size={14} className="card-icon" aria-hidden="true" />
          <label htmlFor="series-select" className="form-label" style={{ margin: 0 }}>
            Série Temporal (Período)
          </label>
        </div>
        <select
          id="series-select"
          className="form-select"
          value={currentSeries.id}
          onChange={(e) => onSelectSeries && onSelectSeries(e.target.value)}
          aria-describedby="series-helper-text"
        >
          {availableSeries.map((series) => (
            <option key={series.id} value={series.id}>
              {series.name}
            </option>
          ))}
        </select>
        <p id="series-helper-text" className="form-helper">
          {currentSeries.description}
        </p>
      </div>

      <div
        className="series-metadata-box"
        style={{
          marginTop: '0.75rem',
          padding: '0.6rem 0.65rem',
          border: '1px solid var(--color-border)',
          borderRadius: '4px',
          background: 'var(--color-background)',
          fontSize: '0.68rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
          <span style={{ color: 'var(--color-muted)' }}>Data:</span>
          <strong style={{ color: 'var(--color-text)' }}>01/01/2024</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
          <span style={{ color: 'var(--color-muted)' }}>Janela UTC:</span>
          <strong style={{ color: 'var(--color-map)' }}>{currentSeries.timeRangeUtc}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
          <span style={{ color: 'var(--color-muted)' }}>Horário local:</span>
          <span style={{ color: 'var(--color-text)' }}>{currentSeries.localTimeRange}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
          <span style={{ color: 'var(--color-muted)' }}>Origem dos dados:</span>
          <span style={{ color: 'var(--color-text)' }}>NASA GPM IMERG Early V07B (Real)</span>
        </div>
      </div>
    </section>
  );
};
