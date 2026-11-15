import React, { useId } from 'react';
import '../styles/meteor-volume.css';
import { clampLevel, levelToPercent } from '../utils/volume';

export interface MeteorVolumeSliderProps {
  /** Volume de 0 a 1 */
  value: number;
  onChange: (value: number) => void;
  /** Com o som mudo, o fogo do meteoro se apaga (o volume escolhido é lembrado) */
  muted?: boolean;
  disabled?: boolean;
}

const STEP_PERCENT = 5;
const ARROW_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];

export const MeteorVolumeSlider: React.FC<MeteorVolumeSliderProps> = ({
  value,
  onChange,
  muted = false,
  disabled = false,
}) => {
  const id = useId();
  const level = clampLevel(value);
  const percent = levelToPercent(level);

  return (
    <div
      className="meteor-volume"
      data-muted={muted}
      style={{ '--level': level } as React.CSSProperties}
    >
      <label htmlFor={id} className="meteor-volume__label">
        <span>Volume</span>
        <span className="meteor-volume__value" aria-hidden="true">
          {muted ? 'Mudo' : `${percent}%`}
        </span>
      </label>

      <div className="meteor-volume__track">
        <div className="meteor-volume__sky" aria-hidden="true">
          <div className="meteor-volume__tail">
            <span className="meteor-volume__flame meteor-volume__flame--outer" />
            <span className="meteor-volume__flame meteor-volume__flame--mid" />
            <span className="meteor-volume__flame meteor-volume__flame--core" />
          </div>
        </div>

        <input
          id={id}
          className="meteor-volume__input"
          type="range"
          min={0}
          max={100}
          step={STEP_PERCENT}
          value={percent}
          disabled={disabled}
          aria-valuetext={muted ? `${percent}%, áudio silenciado` : `${percent}%`}
          onChange={(event) => onChange(Number(event.target.value) / 100)}
          // As setas ajustam o volume e não devem acionar os atalhos globais (← → trocam o passo)
          onKeyDown={(event) => {
            if (ARROW_KEYS.includes(event.key)) event.stopPropagation();
          }}
        />
      </div>
    </div>
  );
};

export default MeteorVolumeSlider;