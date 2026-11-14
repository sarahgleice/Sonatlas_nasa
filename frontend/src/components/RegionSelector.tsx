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
          Escolha uma área geográfica para carregar os dados de precipitação:
        </label>
        <select
          id="region-select"
          className="form-select"
          value={selectedRegionId}
          onChange={(e) => onSelectRegion(e.target.value)}
          aria-describedby="region-helper-text"
        >
          {AVAILABLE_REGIONS.map((region) => (
            <option key={region.id} value={region.id}>
              {region.name} ({region.country}) {region.status === 'candidate' ? '— [Candidata]' : ''}
            </option>
          ))}
        </select>
        <p id="region-helper-text" className="form-helper">
          * A Bacia do Congo é uma candidata preliminar para a região internacional e está sob validação científica pela equipe.
        </p>
      </div>
    </section>
  );
};
