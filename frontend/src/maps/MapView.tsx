import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { AvailabilityIndicator, BoundingBox } from '../types/dataset';
import { bboxToLeafletPolygon, getBboxCenter } from '../utils/geoUtils';
import { MapPin } from 'lucide-react';
import { findRegionAtPoint, limitsToBounds, STUDY_REGIONS } from './regions';
import { amazonCentralGeoJson } from './amazonGeometry';
import { congoBasinKisanganiGeoJson } from './congoGeometry';
import { PrecipitationOverlay } from './PrecipitationOverlay';

function geometryMatchesDataset(layer: L.GeoJSON, boundingBox: BoundingBox): boolean {
  const bounds = layer.getBounds();
  if (!bounds.isValid()) return false;
  const southWest = bounds.getSouthWest();
  const northEast = bounds.getNorthEast();
  const epsilon = 1e-6;
  return Math.abs(southWest.lat - boundingBox.min_latitude) < epsilon &&
    Math.abs(northEast.lat - boundingBox.max_latitude) < epsilon &&
    Math.abs(southWest.lng - boundingBox.min_longitude) < epsilon &&
    Math.abs(northEast.lng - boundingBox.max_longitude) < epsilon;
}

interface MapViewProps {
  boundingBox?: BoundingBox | null;
  regionName: string;
  isPlaceholder?: boolean;
  regionId?: string;
  apiGeometry?: GeoJSON.GeoJsonObject | null;
  geoApiStatus?: 'unconfigured' | 'loading' | 'connected' | 'fallback';
  spatialDatasetPath?: string;
  selectedTimestamp?: string | null;
  selectedAvailability?: AvailabilityIndicator | null;
  onRegionSelect?: (regionId: string) => void;
  onMapPoint?: (lat: number, lon: number) => void;
}

export const MapView: React.FC<MapViewProps> = ({
  boundingBox,
  regionName,
  isPlaceholder = false,
  regionId = 'amazon_central',
  apiGeometry = null,
  geoApiStatus = 'unconfigured',
  spatialDatasetPath = '',
  selectedTimestamp = null,
  selectedAvailability = null,
  onRegionSelect,
  onMapPoint
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polygonLayerRef = useRef<L.Layer | null>(null);
  const [geometryFallback, setGeometryFallback] = useState(false);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || isPlaceholder || !boundingBox) {
      return;
    }

    const center = getBboxCenter(boundingBox);

    if (!mapInstanceRef.current) {
      // Inicializar instância Leaflet
      const map = L.map(mapContainerRef.current, {
        center: center,
        zoom: 6,
        zoomControl: true,
        scrollWheelZoom: false // Evitar sequestro de scroll do teclado
      });

      // Base tiles are requested only for the map area currently in view.
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18
      }).addTo(map);

      mapInstanceRef.current = map;
      setMapInstance(map);
    } else {
      mapInstanceRef.current.setView(center, 6);
    }

    const map = mapInstanceRef.current;

    // Atualizar polígono
    if (polygonLayerRef.current) {
      map.removeLayer(polygonLayerRef.current);
    }

    let regionLayer: L.Layer | null = null;
    const geoJsonSources = [apiGeometry, amazonCentralGeoJson];
    if (regionId === 'amazon_central') {
      for (const geoJson of geoJsonSources) {
        if (!geoJson) continue;
        try {
          const geoJsonLayer = L.geoJSON(geoJson, {
            style: {
              color: '#0284c7',
              fillColor: '#38bdf8',
              fillOpacity: 0.25,
              weight: 3
            }
          });
          if (geometryMatchesDataset(geoJsonLayer, boundingBox)) {
            geoJsonLayer.bindPopup(`<strong>${regionName}</strong><br/>Área de Amostragem do SONATLAS`);
            regionLayer = geoJsonLayer.addTo(map);
            break;
          }
        } catch {
          regionLayer = null;
        }
      }
    } else if (regionId === 'congo_basin_kisangani' || regionId === 'international_candidate') {
      if (congoBasinKisanganiGeoJson) {
        try {
          const geoJsonLayer = L.geoJSON(congoBasinKisanganiGeoJson, {
            style: {
              color: '#059669',
              fillColor: '#34d399',
              fillOpacity: 0.25,
              weight: 3
            }
          });
          if (geometryMatchesDataset(geoJsonLayer, boundingBox)) {
            geoJsonLayer.bindPopup(`<strong>${regionName}</strong><br/>Janela de Amostragem de Kisangani (SONATLAS)`);
            regionLayer = geoJsonLayer.addTo(map);
          }
        } catch {
          regionLayer = null;
        }
      }
    }

    if (!regionLayer) {
      const fallbackPolygon = L.polygon(bboxToLeafletPolygon(boundingBox), {
        color: '#0284c7',
        fillColor: '#38bdf8',
        fillOpacity: 0.25,
        weight: 3
      }).addTo(map);
      fallbackPolygon.bindPopup(`<strong>${regionName}</strong><br/>Bounding box do dataset`);
      regionLayer = fallbackPolygon;
    }

    polygonLayerRef.current = regionLayer;
    setGeometryFallback(!(regionLayer instanceof L.GeoJSON));

    // Ajustar visão para os limites da bounding box
    map.fitBounds(limitsToBounds(boundingBox), { padding: [20, 20] });
  }, [apiGeometry, boundingBox, regionId, regionName, isPlaceholder]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !boundingBox || !onRegionSelect) return;

    const selectRegion = (event: L.LeafletMouseEvent) => {
      const { lat, lng } = event.latlng;
      const target = STUDY_REGIONS.find((r) => r.id === regionId || (r.aliases && r.aliases.includes(regionId)));
      if (!target) return;
      const datasetRegion = { ...target, limits: boundingBox };
      const region = findRegionAtPoint(lat, lng, [datasetRegion]);
      if (region) {
        if (onMapPoint) onMapPoint(lat, lng);
        else onRegionSelect(region.id);
      }
    };

    map.on('click', selectRegion);
    return () => {
      map.off('click', selectRegion);
    };
  }, [boundingBox, regionId, onRegionSelect, onMapPoint]);

  useEffect(() => {
    const layer = polygonLayerRef.current;
    if (!layer || !boundingBox || !onMapPoint) return;

    const locateRegion = (event: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(event.originalEvent);
      const target = STUDY_REGIONS.find((r) => r.id === regionId || (r.aliases && r.aliases.includes(regionId)));
      if (target && findRegionAtPoint(event.latlng.lat, event.latlng.lng, [{ ...target, limits: boundingBox }])) {
        onMapPoint(event.latlng.lat, event.latlng.lng);
      }
    };

    layer.on('click', locateRegion);
    return () => {
      layer.off('click', locateRegion);
    };
  }, [apiGeometry, boundingBox, onMapPoint, regionId]);

  // Limpeza
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <section className="card map-card" aria-labelledby="map-title">
      <div className="card-header">
        <MapPin size={20} className="card-icon" aria-hidden="true" />
        <h2 id="map-title" className="card-title">
          Visualização Geográfica 2D
        </h2>
      </div>

      {isPlaceholder || !boundingBox ? (
        <div className="map-placeholder-box">
          <p>
            <strong>Área Internacional Candidata sob Validação.</strong>
          </p>
          <p>
            Os limites cartográficos desta região serão disponibilizados após homologação formal da equipe científica.
          </p>
        </div>
      ) : (
        <>
          {/* Mapa puramente visual com aria-hidden para não poluir leitores de tela */}
          <div
            ref={mapContainerRef}
            className="leaflet-map-container"
            aria-hidden="true"
          />
          {/* Descrição equivalente não visual para acessibilidade */}
          <div className="map-accessible-fallback">
            <span className="sr-only">
              Mapa exibindo a caixa delimitadora da {regionName}: latitude de {boundingBox.min_latitude}° a {boundingBox.max_latitude}°, longitude de {boundingBox.min_longitude}° a {boundingBox.max_longitude}°.
            </span>
            <p className="map-caption">
              Coordenadas de amostragem: Lat [{boundingBox.min_latitude}°, {boundingBox.max_latitude}°], Lon [{boundingBox.min_longitude}°, {boundingBox.max_longitude}°].
            </p>
            {geometryFallback && (
              <p className="map-caption" role="note">
                A geometria GeoJSON não pôde ser usada; o contorno exibido usa o bounding box do dataset.
              </p>
            )}
            {geoApiStatus !== 'connected' && (
              <p className="map-caption" role="status">
                {geoApiStatus === 'loading'
                  ? 'Verificando serviço geoespacial; o mapa local continua disponível.'
                  : geoApiStatus === 'fallback'
                    ? 'Serviço geoespacial indisponível ou inconsistente; usando GeoJSON local.'
                    : 'Serviço geoespacial não configurado; usando GeoJSON local.'}
              </p>
            )}
            {onRegionSelect && (
              <p className="map-caption">Região ativa: {regionName}. O seletor de região oferece a alternativa por teclado.</p>
            )}
          </div>
          {spatialDatasetPath && (
            <PrecipitationOverlay
              map={mapInstance}
              datasetPath={spatialDatasetPath}
              regionId={regionId}
              boundingBox={boundingBox}
              timestampUtc={selectedTimestamp}
              availability={selectedAvailability}
            />
          )}
        </>
      )}
    </section>
  );
};
