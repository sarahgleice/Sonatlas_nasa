import { useState } from 'react';
import RegionMap from './RegionMap';
import { STUDY_REGIONS, buildSelectionPayload, getRegionById } from './regions';
import type { PointSelection } from './regionTypes';

export default function RegionMapDemo() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [point, setPoint] = useState<PointSelection | null>(null);
  const region = selectedId ? getRegionById(selectedId) : undefined;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 340px',
        height: '100vh',
        background: '#0b1220',
        color: '#e2e8f0',
        fontFamily: 'sans-serif',
      }}
    >
      <RegionMap
        selectedRegionId={selectedId}
        onRegionSelect={(r) => setSelectedId(r.id)}
        onPointSelect={setPoint}
      />
      <aside style={{ padding: 16, overflow: 'auto' }}>
        <h2>Seleção</h2>
        <select value={selectedId ?? ''} onChange={(e) => setSelectedId(e.target.value || null)}>
          <option value="">(nenhuma)</option>
          {STUDY_REGIONS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <h3>Dados da região (para a Hazel)</h3>
        <pre style={{ fontSize: 12 }}>
          {region ? JSON.stringify(buildSelectionPayload(region), null, 2) : 'Clique numa região'}
        </pre>
        <h3>Último ponto clicado</h3>
        <pre style={{ fontSize: 12 }}>{point ? JSON.stringify(point, null, 2) : '(nenhum)'}</pre>
      </aside>
    </div>
  );
}