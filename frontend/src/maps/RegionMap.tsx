import { useEffect, useRef } from 'react';
import L from 'leaflet';
// @ts-ignore Leaflet CSS is loaded by the bundler; TypeScript has no declaration for it.
import 'leaflet/dist/leaflet.css';
import { STUDY_REGIONS, findRegionAtPoint, limitsToBounds, roundCoord } from './regions';
import type { PointSelection, StudyRegion } from './regionTypes';

export interface RegionMapProps {
  /** Regiões desenhadas no mapa (padrão: as duas regiões do projeto) */
  regions?: StudyRegion[];
  /** Região selecionada (componente controlado pelo pai) */
  selectedRegionId?: string | null;
  /** Disparado quando o usuário clica dentro de uma região */
  onRegionSelect?: (region: StudyRegion) => void;
  /** Disparado em todo clique no mapa, com as coordenadas */
  onPointSelect?: (point: PointSelection) => void;
  height?: number | string;
  /** Classe CSS do contêiner; se informada, a altura vem do CSS */
  className?: string;
}

// Mapa de fundo sem chave de API (o Carto antigo exibia "API KEY REQUIRED")
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const FIT_OPTIONS: L.FitBoundsOptions = { padding: [40, 40] };

function styleFor(region: StudyRegion, selected: boolean, hovered: boolean): L.PathOptions {
  const proposed = region.status === 'proposed_pending_validation';
  const color = proposed ? '#f59e0b' : '#22d3ee';
  return {
    color,
    fillColor: color,
    weight: selected ? 4 : 2,
    dashArray: proposed ? '8 6' : undefined,
    fillOpacity: selected ? 0.35 : hovered ? 0.25 : 0.12,
  };
}

export default function RegionMap({
  regions = STUDY_REGIONS,
  selectedRegionId = null,
  onRegionSelect,
  onPointSelect,
  height = '100%',
  className,}: RegionMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<Map<string, L.Rectangle>>(new Map());
  const markerRef = useRef<L.CircleMarker | null>(null);

  // Guardamos as props mais recentes em refs para o mapa não ser recriado a cada render
  const regionsRef = useRef(regions);
  const selectedRef = useRef(selectedRegionId);
  const onRegionSelectRef = useRef(onRegionSelect);
  const onPointSelectRef = useRef(onPointSelect);
  regionsRef.current = regions;
  selectedRef.current = selectedRegionId;
  onRegionSelectRef.current = onRegionSelect;
  onPointSelectRef.current = onPointSelect;

  // 1) Cria o mapa uma única vez
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = L.map(container, { minZoom: 2, scrollWheelZoom: false });    mapRef.current = map;

    L.tileLayer(TILE_URL, {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    const layers = layersRef.current;
    layers.clear();

    regionsRef.current.forEach((region) => {
      const rect = L.rectangle(
        limitsToBounds(region.limits),
        styleFor(region, region.id === selectedRef.current, false),
      );
      const suffix = region.status === 'proposed_pending_validation' ? ' (em validação)' : '';
      rect.bindTooltip(`${region.name}${suffix}`, { sticky: true });
      rect.on('mouseover', () =>
        rect.setStyle(styleFor(region, selectedRef.current === region.id, true)),
      );
      rect.on('mouseout', () =>
        rect.setStyle(styleFor(region, selectedRef.current === region.id, false)),
      );
      rect.addTo(map);
      layers.set(region.id, rect);

      L.circleMarker([region.referencePoint.lat, region.referencePoint.lon], {
        radius: 4,
        color: '#ffffff',
        weight: 1,
        fillColor: '#0b1220',
        fillOpacity: 1,
      })
        .bindTooltip(region.referenceCity)
        .addTo(map);
    });

    // Enquadramento inicial
    const initial = regionsRef.current.find((r) => r.id === selectedRef.current);
    if (initial) {
      map.fitBounds(limitsToBounds(initial.limits), FIT_OPTIONS);
    } else if (layers.size > 0) {
      map.fitBounds(L.featureGroup(Array.from(layers.values())).getBounds(), FIT_OPTIONS);
    } else {
      map.setView([0, 0], 2);
    }

    // Clique: descobre a região e devolve as coordenadas
    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng.wrap();
      const region = findRegionAtPoint(lat, lng, regionsRef.current);

      markerRef.current?.remove();
      markerRef.current = L.circleMarker(e.latlng, {
        radius: 6,
        color: '#ffffff',
        weight: 2,
        fillColor: region ? '#22d3ee' : '#94a3b8',
        fillOpacity: 0.9,
      }).addTo(map);

      if (region) onRegionSelectRef.current?.(region);
      onPointSelectRef.current?.({
        lat: roundCoord(lat),
        lon: roundCoord(lng),
        regionId: region ? region.id : null,
      });
    });

    // Corrige o tamanho quando o layout da página muda
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      layers.clear();
    };
  }, []);

  // 2) Atualiza o estilo quando a seleção muda
  useEffect(() => {
    regions.forEach((region) => {
      layersRef.current
        .get(region.id)
        ?.setStyle(styleFor(region, region.id === selectedRegionId, false));
    });
  }, [selectedRegionId, regions]);

  // 3) Enquadra a região selecionada (só quando a seleção muda)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedRegionId) return;
    const region = regionsRef.current.find((r) => r.id === selectedRegionId);
    if (!region) return;
    map.fitBounds(limitsToBounds(region.limits), FIT_OPTIONS);
    layersRef.current.get(region.id)?.bringToFront();
  }, [selectedRegionId]);

  return (
      <div
      ref={containerRef}
      className={className}
      aria-hidden="true"
      style={className ? undefined : { width: '100%', height, minHeight: 320 }}
    />
  );
}