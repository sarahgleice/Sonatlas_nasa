import React from 'react';
import { AVAILABLE_REGIONS } from '../services/dataService';
import { Globe2 } from 'lucide-react';

interface RegionSelectorProps {
  selectedRegionId: string;
  onSelectRegion: (regionId: string) => void;
}

export const RegionSelector: React.FC<RegionSelectorProps> = ({
  selectedRegionId,
  onSelectRegion
}) => {
  return (
    <section className="card region-selector-card" aria-labelledby="region-selector-title">
      <div className="card-header">
        <Globe2 size={20} className="card-icon" aria-hidden="true" />
        <h2 id="region-selector-title" className="card-title">
          Seleção da Região de Estudo
        </h2>
      </div>

      <div className="form-group">
        <label htmlFor="region-select" className="form-label">
          Região
        </label>
        <select
          id="region-select"
          className="form-select"
          value={selectedRegionId}
          onChange={(e) => onSelectRegion(e.target.value)}
          aria-describedby="region-helper-text"
        >
          {AVAILABLE_REGIONS.filter((region) => region.id === 'amazon_central').map((region) => (
            <option key={region.id} value={region.id}>
              {region.name} ({region.country})
            </option>
          ))}
        </select>
        <p id="region-helper-text" className="form-helper">
          Atualmente, apenas a Amazônia Central está disponível.
        </p>
      </div>
    </section>
  );
};
