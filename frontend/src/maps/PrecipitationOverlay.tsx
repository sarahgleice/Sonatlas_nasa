import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import type { AvailabilityIndicator, BoundingBox } from '../types/dataset';
import type { SpatialGrid } from '../types/spatialGrid';
import { SpatialDataService } from '../services/spatialDataService';
import { precipitationColor, spatialGridCellBounds } from './precipitationScale';
import { SpatialGridTable } from './SpatialGridTable';
import { formatTimestamp } from '../utils/formatters';

type LoadState = 'loading' | 'available' | 'unavailable' | 'error';
const PANE_NAME = 'sonatlas-precipitation';

function cellStyle(value: number | null, visible: boolean): L.PathOptions {
  return {
    pane: PANE_NAME,
    interactive: false,
    color: value === null ? '#cbd5e1' : '#0f172a',
    weight: value === null ? 0.7 : 0.25,
    dashArray: value === null ? '2 2' : undefined,
    opacity: visible ? 0.55 : 0,
    fillColor: precipitationColor(value),
    fillOpacity: visible ? value === null ? 0.34 : value === 0 ? 0.48 : 0.66 : 0
  };
}

export function PrecipitationOverlay({
  map,
  datasetPath,
  regionId,
  boundingBox,
  timestampUtc,
  availability
}: {
  map: L.Map | null;
  datasetPath: string;
  regionId: string;
  boundingBox: BoundingBox;
  timestampUtc: string | null;
  availability: AvailabilityIndicator | null;
}) {
  const [state, setState] = useState<LoadState>('loading');
  const [grid, setGrid] = useState<SpatialGrid | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const cellsRef = useRef<L.Rectangle[] | null>(null);
  const geometryKeyRef = useRef('');

  useEffect(() => {
    if (!timestampUtc) {
      setGrid(null);
      setState('unavailable');
      return;
    }
    let active = true;
    setGrid(null);
    setState('loading');
    SpatialDataService.loadGrid(datasetPath, regionId, boundingBox, timestampUtc, availability ?? undefined)
      .then((result) => {
        if (!active) return;
        setGrid(result);
        setState(result ? 'available' : 'unavailable');
      })
      .catch(() => {
        if (!active) return;
        setGrid(null);
        setState('error');
      });
    return () => { active = false; };
  }, [datasetPath, regionId, boundingBox, timestampUtc, availability]);

  useEffect(() => {
    if (!map) return;
    const pane = map.getPane(PANE_NAME) ?? map.createPane(PANE_NAME);
    pane.style.zIndex = '350';
    pane.style.pointerEvents = 'none';
    const layer = L.layerGroup().addTo(map);
    layerRef.current = layer;
    return () => {
      layer.remove();
      layerRef.current = null;
      cellsRef.current = null;
      geometryKeyRef.current = '';
    };
  }, [map]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    if (!grid) {
      cellsRef.current?.forEach((cell) => cell.setStyle(cellStyle(null, false)));
      return;
    }

    const key = JSON.stringify([regionId, grid.manifest.bounding_box, grid.manifest.latitude_centers, grid.manifest.longitude_centers]);
    if (geometryKeyRef.current !== key) {
      layer.clearLayers();
      const bounds = spatialGridCellBounds(grid);
      cellsRef.current = bounds.map((cellBoundsValue) => {
        return L.rectangle(cellBoundsValue, cellStyle(null, false)).addTo(layer);
      });
      geometryKeyRef.current = key;
    }

    cellsRef.current?.forEach((cell, index) => {
      const value = grid.values[Math.floor(index / grid.manifest.longitude_centers.length)]
        [index % grid.manifest.longitude_centers.length];
      cell.setStyle(cellStyle(value, true));
    });
  }, [grid, regionId]);

  const statusText = state === 'loading' ? 'Carregando grade de precipitação…'
    : state === 'available' ? `Grade de precipitação disponível para ${timestampUtc ? formatTimestamp(timestampUtc) : "o período selecionado"}.`
      : state === 'error' ? 'A grade de precipitação contém erro ou não corresponde à observação selecionada.'
        : 'Camada de precipitação indisponível para este período; a geometria do mapa continua disponível.';

  return (
    <div className="precipitation-layer-info">
      <p className="precipitation-layer-status" role={state === 'error' ? 'alert' : undefined}>{statusText}</p>
      {grid && <p className="precipitation-layer-source">{grid.manifest.data_source} · {grid.manifest.product_name} {grid.manifest.product_version} · {grid.manifest.validation_status === 'preliminary_verified' ? 'validação preliminar' : 'candidata em revisão'} · grade {grid.manifest.spatial_resolution_degrees}°</p>}
      <div className="precipitation-legend" role="group" aria-labelledby="precipitation-legend-title">
        <strong id="precipitation-legend-title">Taxa de precipitação (mm/h)</strong>
        <ul>
          <li><span className="precipitation-swatch swatch-zero" aria-hidden="true" /> Zero</li>
          <li><span className="precipitation-swatch" style={{ backgroundColor: precipitationColor(0.1) }} aria-hidden="true" /> &gt;0–&lt;0,5</li>
          <li><span className="precipitation-swatch" style={{ backgroundColor: precipitationColor(0.5) }} aria-hidden="true" /> 0,5–&lt;1</li>
          <li><span className="precipitation-swatch" style={{ backgroundColor: precipitationColor(1) }} aria-hidden="true" /> 1–&lt;2,5</li>
          <li><span className="precipitation-swatch" style={{ backgroundColor: precipitationColor(2.5) }} aria-hidden="true" /> 2,5–&lt;5</li>
          <li><span className="precipitation-swatch" style={{ backgroundColor: precipitationColor(5) }} aria-hidden="true" /> ≥5</li>
          <li><span className="precipitation-swatch swatch-missing" aria-hidden="true" /> Sem dado</li>
        </ul>
        <p>Faixas apenas visuais. Taxas positivas abaixo de 0,1 mm/h continuam sendo positivas; sem dado não significa zero.</p>
      </div>
      {grid && <SpatialGridTable grid={grid} />}
    </div>
  );
}
