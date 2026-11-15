import React, { Component, useCallback, useEffect, useRef, useState } from 'react';
import Globe, { type GlobeMethods } from 'react-globe.gl';
import { buildRegionGlobePolygons, type RegionGlobePolygon } from './globeRegions';
import { getRegionById } from './regions';

const REGION_POLYGONS = buildRegionGlobePolygons();

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!context) return false;
    context.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return reduced;
}

interface GlobeFallbackProps {
  onReturnToMap: () => void;
  message: string;
}

const GlobeFallback: React.FC<GlobeFallbackProps> = ({ onReturnToMap, message }) => (
  <div className="globe-fallback" role="status">
    <p>{message} O mapa 2D e os controles de região continuam disponíveis.</p>
    <button type="button" className="btn btn-secondary btn-sm" onClick={onReturnToMap}>Voltar ao mapa 2D</button>
  </div>
);

interface GlobeErrorBoundaryProps extends GlobeFallbackProps {
  children: React.ReactNode;
}

interface GlobeErrorBoundaryState {
  failed: boolean;
}

class GlobeErrorBoundary extends Component<GlobeErrorBoundaryProps, GlobeErrorBoundaryState> {
  state: GlobeErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): GlobeErrorBoundaryState {
    return { failed: true };
  }

  render() {
    return this.state.failed
      ? <GlobeFallback onReturnToMap={this.props.onReturnToMap} message={this.props.message} />
      : this.props.children;
  }
}

interface GlobeViewProps {
  selectedRegionId: string;
  onRegionSelect: (regionId: string) => void;
  onReturnToMap: () => void;
}

export const GlobeView: React.FC<GlobeViewProps> = ({ selectedRegionId, onRegionSelect, onReturnToMap }) => {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const sceneRef = useRef<HTMLDivElement>(null);
  const [webGLAvailable, setWebGLAvailable] = useState<boolean | null>(null);
  const [size, setSize] = useState({ width: 640, height: 360 });
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => setWebGLAvailable(supportsWebGL()), []);

  const updateSize = useCallback(() => {
    const bounds = sceneRef.current?.getBoundingClientRect();
    if (bounds && bounds.width > 0 && bounds.height > 0) {
      setSize({ width: Math.round(bounds.width), height: Math.round(bounds.height) });
    }
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    updateSize();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateSize);
      return () => window.removeEventListener('resize', updateSize);
    }
    const observer = new ResizeObserver(updateSize);
    observer.observe(scene);
    return () => observer.disconnect();
  }, [updateSize, webGLAvailable]);

  const focusSelectedRegion = useCallback(() => {
    const region = getRegionById(selectedRegionId);
    if (!region || !globeRef.current) return;
    globeRef.current.controls().autoRotate = false;
    globeRef.current.pointOfView({
      lat: region.referencePoint.lat,
      lng: region.referencePoint.lon,
      altitude: 1.8
    }, prefersReducedMotion ? 0 : 900);
  }, [selectedRegionId, prefersReducedMotion]);

  useEffect(() => focusSelectedRegion(), [focusSelectedRegion]);

  if (webGLAvailable === null) {
    return <div className="globe-fallback" role="status">Verificando suporte a WebGL…</div>;
  }
  if (!webGLAvailable) {
    return <GlobeFallback onReturnToMap={onReturnToMap} message="WebGL não está disponível neste navegador ou dispositivo." />;
  }

  return (
    <GlobeErrorBoundary onReturnToMap={onReturnToMap} message="Não foi possível iniciar a visualização 3D.">
      <section className="card globe-map-card" aria-labelledby="globe-title">
        <h3 id="globe-title" className="sr-only">Globo terrestre interativo</h3>
        <p id="globe-instructions" className="globe-instructions">
          Arraste para girar e use os controles de zoom. Clique em uma área destacada para selecioná-la; o seletor de região ao lado também funciona por teclado.
        </p>
        <div ref={sceneRef} className="globe-scene" role="group" aria-label="Globo 3D com áreas de estudo destacadas" aria-describedby="globe-instructions">
          <Globe
            ref={globeRef}
            width={size.width}
            height={size.height}
            backgroundColor="#070b17"
            globeImageUrl="/images/earth-blue-marble.jpg"
            showAtmosphere
            atmosphereColor="#42c7ff"
            atmosphereAltitude={0.12}
            showGraticules
            animateIn={!prefersReducedMotion}
            polygonsData={REGION_POLYGONS}
            polygonGeoJsonGeometry={(polygon) => (polygon as RegionGlobePolygon).geometry as unknown as { type: string; coordinates: number[] }}
            polygonCapColor={(polygon) => (polygon as RegionGlobePolygon).regionId === 'amazon_central' ? '#00b9d6' : '#8b5cf6'}
            polygonSideColor={(polygon) => (polygon as RegionGlobePolygon).regionId === 'amazon_central' ? '#087b99' : '#6841bd'}
            polygonStrokeColor={(polygon) => (polygon as RegionGlobePolygon).regionId === 'amazon_central' ? '#67e8f9' : '#c4b5fd'}
            polygonAltitude={(polygon) => (polygon as RegionGlobePolygon).regionId === selectedRegionId ? 0.015 : 0.008}
            polygonLabel={(polygon) => (polygon as RegionGlobePolygon).label}
            polygonsTransitionDuration={prefersReducedMotion ? 0 : 350}
            onPolygonClick={(polygon) => onRegionSelect((polygon as RegionGlobePolygon).regionId)}
            onGlobeReady={focusSelectedRegion}
          />
        </div>
        <ul className="globe-legend" aria-label="Legenda das áreas destacadas">
          <li><span className="globe-legend-amazon" aria-hidden="true" />Amazônia Central — área de estudo</li>
          <li><span className="globe-legend-congo" aria-hidden="true" />Kisangani — janela candidata, não toda a Bacia do Congo</li>
        </ul>
        <p className="globe-attribution">Textura terrestre Blue Marble, NASA. Os polígonos mostram os recortes GeoJSON do estudo.</p>
      </section>
    </GlobeErrorBoundary>
  );
};
