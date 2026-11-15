import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import '../styles/global.css';
import { MeteorVolumeSlider } from './MeteorVolumeSlider';
import { DEFAULT_VOLUME_LEVEL, levelToGain } from '../utils/volume';

function Demo() {
  const [level, setLevel] = useState(DEFAULT_VOLUME_LEVEL);
  const [muted, setMuted] = useState(false);

  return (
    <div
      style={{
        maxWidth: 360,
        margin: '40px auto',
        padding: 20,
        borderRadius: 12,
        background: '#0b1220',
        color: '#e2e8f0',
        fontFamily: 'sans-serif',
      }}
    >
      <MeteorVolumeSlider value={level} onChange={setLevel} muted={muted} />
      <button type="button" style={{ marginTop: 16 }} onClick={() => setMuted((m) => !m)}>
        {muted ? 'Ativar som' : 'Silenciar'}
      </button>
      <p style={{ fontSize: 13 }}>
        Nível: {Math.round(level * 100)}% · ganho para o motor: {levelToGain(level).toFixed(2)}
      </p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Demo />
  </React.StrictMode>,
);