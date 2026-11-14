import React from 'react';
import { CloudRain } from 'lucide-react';

export const VariableSelector: React.FC = () => (
  <section className="variable-section" aria-labelledby="variable-title">
    <div className="control-section-heading">
      <CloudRain size={16} aria-hidden="true" />
      <h3 id="variable-title">Variável científica</h3>
    </div>
    <label className="form-group" htmlFor="variable-select">
      <span className="form-label">Indicador</span>
      <select id="variable-select" className="form-select" value="mean_precipitation_rate" disabled>
        <option value="mean_precipitation_rate">Taxa média de precipitação · mm/h</option>
      </select>
    </label>
    <p className="form-helper">Única variável disponibilizada pelo dataset atual.</p>
  </section>
);
