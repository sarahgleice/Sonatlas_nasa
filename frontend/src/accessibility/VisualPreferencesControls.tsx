import React from 'react';
import '../styles/visual-preferences.css';
import { useVisualPreferences } from './useVisualPreferences';
import { PALETTES, PALETTE_LABELS } from './visualThemes';

export const VisualPreferencesControls: React.FC = () => {
  const { palette, contrast, setPalette, setContrast } = useVisualPreferences();
  const high = contrast === 'high';

  return (
    <fieldset className="visual-prefs">
      <legend className="visual-prefs__legend">Cores e contraste</legend>

      <div className="visual-prefs__group" role="group" aria-label="Paleta de cores">
        {PALETTES.map((option) => (
          <button
            key={option}
            type="button"
            className={`btn btn-sm ${palette === option ? 'btn-toggle-on' : 'btn-secondary'}`}
            aria-pressed={palette === option}
            onClick={() => setPalette(option)}
          >
            {PALETTE_LABELS[option]}
          </button>
        ))}
      </div>

      <div className="visual-prefs__group">
        <button
          type="button"
          className={`btn btn-sm ${high ? 'btn-toggle-on' : 'btn-secondary'}`}
          aria-pressed={high}
          onClick={() => setContrast(high ? 'normal' : 'high')}
        >
          Alto contraste
        </button>
      </div>

      <p className="form-helper" role="status">
        Paleta: {PALETTE_LABELS[palette]}. Alto contraste: {high ? 'ligado' : 'desligado'}.
      </p>
    </fieldset>
  );
};

export default VisualPreferencesControls;
