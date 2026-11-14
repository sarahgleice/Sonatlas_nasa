import type { SpatialGrid } from '../types/spatialGrid';

export function SpatialGridTable({ grid }: { grid: SpatialGrid }) {
  return (
    <details className="precipitation-grid-details">
      <summary>Valores da grade por célula</summary>
      <div className="precipitation-grid-table-wrap">
        <table>
          <caption>Precipitação em {grid.timestamp_utc} UTC; linhas de latitude sul→norte, colunas de longitude oeste→leste. Unidade: mm/h.</caption>
          <thead>
            <tr><th scope="col">Latitude \ Longitude</th>{grid.manifest.longitude_centers.map((longitude) => <th scope="col" key={longitude}>{longitude}°</th>)}</tr>
          </thead>
          <tbody>
            {grid.manifest.latitude_centers.map((latitude, row) => (
              <tr key={latitude}>
                <th scope="row">{latitude}°</th>
                {grid.manifest.longitude_centers.map((longitude, column) => {
                  const value = grid.values[row][column];
                  return <td key={longitude}>{value === null ? 'Sem dado' : `${value} mm/h`}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
