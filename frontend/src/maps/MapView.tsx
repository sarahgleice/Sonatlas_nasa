import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { BoundingBox } from '../types/dataset';
import { bboxToLeafletPolygon, getBboxCenter } from '../utils/geoUtils';
import { MapPin } from 'lucide-react';

interface MapViewProps {
  boundingBox?: BoundingBox | null;
  regionName: string;
  isPlaceholder?: boolean;
}

export const MapView: React.FC<MapViewProps> = ({
  boundingBox,
  regionName,
  isPlaceholder = false
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polygonLayerRef = useRef<L.Polygon | null>(null);

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

      // Camada base CartoDB Dark Matter / OpenStreetMap acessível
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        maxZoom: 18
      }).addTo(map);

      mapInstanceRef.current = map;
    } else {
      mapInstanceRef.current.setView(center, 6);
    }

    const map = mapInstanceRef.current;

    // Atualizar polígono
    if (polygonLayerRef.current) {
      map.removeLayer(polygonLayerRef.current);
    }

    const coordinates = bboxToLeafletPolygon(boundingBox);
    const polygon = L.polygon(coordinates, {
      color: '#0284c7',
      fillColor: '#38bdf8',
      fillOpacity: 0.25,
      weight: 3
    }).addTo(map);

    polygon.bindPopup(`<strong>${regionName}</strong><br/>Área de Amostragem do SONATLAS`);
    polygonLayerRef.current = polygon;

    // Ajustar visão para os limites da bounding box
    map.fitBounds(polygon.getBounds(), { padding: [20, 20] });
  }, [boundingBox, regionName, isPlaceholder]);

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
          </div>
        </>
      )}
    </section>
  );
};
