import React, { useMemo } from 'react';
import { MapPin } from 'lucide-react';
import RegionMap from './RegionMap';
import { STUDY_REGIONS, getRegionById } from './regions';
import type { PointSelection, RegionLimits, StudyRegion } from './regionTypes';
import type { BoundingBox } from '../types/dataset';

interface SelectableMapViewProps {
  /** Mesmas props do MapView atual (compatível) */
  boundingBox?: BoundingBox | null;
  regionName: string;
  isPlaceholder?: boolean;
  /** Id da região atual: aceita 'amazon_central', 'congo_basin_kisangani' ou 'international_candidate' */
  regionId?: string | null;
  /** Disparado quando o usuário clica dentro de uma região do mapa */
  onRegionSelect?: (region: StudyRegion) => void;
  /** Disparado em todo clique, com as coordenadas */
  onPointSelect?: (point: PointSelection) => void;
}

const TOLERANCE = 1e-6;

function sameLimits(a: RegionLimits, b: RegionLimits): boolean {
  return (
    Math.abs(a.min_latitude - b.min_latitude) < TOLERANCE &&
    Math.abs(a.max_latitude - b.max_latitude) < TOLERANCE &&
    Math.abs(a.min_longitude - b.min_longitude) < TOLERANCE &&
    Math.abs(a.max_longitude - b.max_longitude) < TOLERANCE
  );
}

export const SelectableMapView: React.FC<SelectableMapViewProps> = ({
  boundingBox,
  regionName,
  isPlaceholder = false,
  regionId = null,
  onRegionSelect,
  onPointSelect,
}) => {
  const selected = useMemo(() => {
    if (regionId) {
      const byId = getRegionById(regionId);
      if (byId) return byId;
    }
    if (boundingBox && !isPlaceholder) {
      return STUDY_REGIONS.find((r) => sameLimits(r.limits, boundingBox));
    }
    return undefined;
  }, [regionId, boundingBox, isPlaceholder]);

  const showMap = Boolean(selected) || Boolean(boundingBox && !isPlaceholder);
  const limits: RegionLimits | null = selected
    ? selected.limits
    : boundingBox && !isPlaceholder
      ? boundingBox
      : null;
  const displayName = selected?.name ?? regionName;
  const proposed = selected?.status === 'proposed_pending_validation';

  return (
    <section className="card map-card" aria-labelledby="map-title">
      <div className="card-header">
        <MapPin size={20} className="card-icon" aria-hidden="true" />
        <h2 id="map-title" className="card-title">
          Mapa da região
        </h2>
      </div>

      {showMap ? (
        <>
          {(proposed || isPlaceholder) && (
            <p className="map-caption" role="note">
              <strong>Região em validação científica.</strong> O recorte tracejado é uma
              proposta e não representa o limite final aprovado pela equipe.
            </p>
          )}

          <RegionMap
            className="leaflet-map-container"
            selectedRegionId={selected?.id ?? null}
            onRegionSelect={onRegionSelect}
            onPointSelect={onPointSelect}
          />

          <div className="map-accessible-fallback">
            {limits && (
              <>
                <span className="sr-only">
                  Mapa exibindo a caixa delimitadora da {displayName}: latitude de{' '}
                  {limits.min_latitude}° a {limits.max_latitude}°, longitude de{' '}
                  {limits.min_longitude}° a {limits.max_longitude}°.
                  {onRegionSelect
                    ? ' A seleção de região também está disponível no menu de seleção.'
                    : ''}
                </span>
                <p className="map-caption">
                  Coordenadas de amostragem: Lat [{limits.min_latitude}°, {limits.max_latitude}°],
                  Lon [{limits.min_longitude}°, {limits.max_longitude}°].
                </p>
              </>
            )}
            {onRegionSelect && (
              <p className="map-caption">Clique em uma região do mapa para selecioná-la.</p>
            )}
          </div>
        </>
      ) : (
        <div className="map-placeholder-box">
          <p>
            <strong>Área Internacional Candidata sob Validação.</strong>
          </p>
          <p>
            Os limites cartográficos desta região serão disponibilizados após homologação formal
            da equipe científica.
          </p>
        </div>
      )}
    </section>
  );
};

export default SelectableMapView;