import React from 'react';
import ReactDOM from 'react-dom/client';
import '../styles/global.css';
import { VisualPreferencesControls } from './VisualPreferencesControls';
import { useVisualPreferences } from './useVisualPreferences';

const ROLES = [
  ['map', 'Mapa'],
  ['sound', 'Som'],
  ['success', 'Sucesso'],
  ['warning', 'Aviso'],
  ['danger', 'Perigo'],
  ['focus', 'Foco'],
] as const;

const STEP_LABELS = ['< 0,5', '< 1', '< 2,5', '< 5', '≥ 5'];

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <li style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <span
        aria-hidden="true"
        style={{
          width: 28,
          height: 18,
          background: color,
          border: '1px solid var(--color-border)',
          display: 'inline-block',
        }}
      />
      <span>
        {label} <code>{color}</code>
      </span>
    </li>
  );
}

function Demo() {
  const { theme } = useVisualPreferences();
  const precipitation = theme.map.precipitation;

  return (
    <main
      style={{
        maxWidth: 560,
        margin: '32px auto',
        padding: 20,
        background: 'var(--color-panel)',
        color: 'var(--color-text)',
        borderRadius: 12,
      }}
    >
      <h1>Demo de cores e contraste</h1>
      <VisualPreferencesControls />

      <h2>Cores da interface</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {ROLES.map(([key, label]) => (
          <Swatch key={key} color={theme.colors[key]} label={label} />
        ))}
      </ul>

      <h2>Escala de chuva (mm/h)</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        <Swatch color={precipitation.missing} label="Dado ausente" />
        <Swatch color={precipitation.dry} label="Sem chuva" />
        {precipitation.steps.map((color, i) => (
          <Swatch key={STEP_LABELS[i]} color={color} label={STEP_LABELS[i]} />
        ))}
      </ul>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Demo />
  </React.StrictMode>,
);