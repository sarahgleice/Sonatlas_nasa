import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  Layers,
  Map,
  Waves
} from 'lucide-react';
import { RegionDataset } from '../types/dataset';
import { DataService, AVAILABLE_REGIONS, findRegionOption } from '../services/dataService';
import { globalAudioEngine } from '../audio/AudioEngine';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { formatAreaFraction, formatPrecipitationRate, formatTimestamp, getRatePresentationNote } from '../utils/formatters';
import { Header } from '../components/Header';
import { EducationalPanel } from '../components/EducationalPanel';
import { Footer } from '../components/Footer';
import { RegionSelector } from '../components/RegionSelector';
import { VariableSelector } from '../components/VariableSelector';
import { AudioPlayer } from '../components/AudioPlayer';
import { Timeline } from '../components/Timeline';
import { ScientificSummary } from '../components/ScientificSummary';
import { PrecipitationChart } from '../components/PrecipitationChart';
import { SoundLegend } from '../components/SoundLegend';
import { MapView } from '../maps/MapView';
import { AriaLiveAnnouncer } from '../accessibility/AriaLiveAnnouncer';
import { geoApiService } from '../services/geoApiService';
import { parseAmazonCentralApiFeature } from '../maps/amazonGeometry';

type GeoApiState = 'unconfigured' | 'loading' | 'connected' | 'fallback';

export const HomePage: React.FC = () => {
  const [selectedRegionId, setSelectedRegionId] = useState('amazon_central');
  const [selectedSeriesId, setSelectedSeriesId] = useState('morning');
  const [dataset, setDataset] = useState<RegionDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');
  const [isEducationalOpen, setIsEducationalOpen] = useState(false);
  const [geoApiState, setGeoApiState] = useState<GeoApiState>('unconfigured');
  const [apiGeometry, setApiGeometry] = useState<GeoJSON.GeoJsonObject | null>(null);

  useEffect(() => {
    let isMounted = true;
    const regionOpt = findRegionOption(selectedRegionId) ?? AVAILABLE_REGIONS[0];
    const availableSeries = regionOpt.series;
    
    // Se a série atual não existe na região selecionada, ajusta para a primeira válida
    let activeSeries = availableSeries.find((s) => s.id === selectedSeriesId);
    if (!activeSeries) {
      activeSeries = availableSeries[0];
      setSelectedSeriesId(activeSeries.id);
    }

    // Interrompe imediatamente qualquer reprodução sonora prévia ao trocar região ou série
    globalAudioEngine.stopPlayback();

    setLoading(true);
    setErrorMessage(null);
    setDataset(null);

    DataService.loadRegionDataset(activeSeries.filePath)
      .then((data) => {
        if (!isMounted) return;
        setDataset(data);
        setLoading(false);
        setLiveAnnouncement(
          `Região: ${data.region_name}, série: ${activeSeries?.name}. ${data.observations.length} observações temporais carregadas.`
        );
      })
      .catch((error: unknown) => {
        if (!isMounted) return;
        setErrorMessage(error instanceof Error ? error.message : 'Erro ao carregar dados científicos.');
        setLoading(false);
        setLiveAnnouncement('Erro ao carregar dados científicos.');
      });

    return () => {
      isMounted = false;
    };
  }, [selectedRegionId, selectedSeriesId]);

  useEffect(() => {
    if (!dataset || dataset.region_id !== 'amazon_central') {
      setApiGeometry(null);
      return;
    }

    let isMounted = true;
    setApiGeometry(null);
    setGeoApiState('loading');

    Promise.all([
      geoApiService.getHealth(),
      geoApiService.getRegions(),
      geoApiService.getRegion('amazon_central')
    ]).then(([health, regions, feature]) => {
      if (!isMounted) return;
      if (!health.available || !regions.available || !feature.available) {
        setGeoApiState('unconfigured');
        return;
      }

      const summary = regions.data.find((region) => region.region_id === 'amazon_central');
      const apiBox = summary?.bbox;
      const box = dataset.bounding_box;
      const epsilon = 1e-6;
      const matches = health.data.status === 'ok' && summary?.has_geometry && !summary.is_placeholder &&
        summary.status === 'preliminary_verified' && apiBox !== null && apiBox !== undefined &&
        Math.abs(apiBox.south - box.min_latitude) < epsilon &&
        Math.abs(apiBox.north - box.max_latitude) < epsilon &&
        Math.abs(apiBox.west - box.min_longitude) < epsilon &&
        Math.abs(apiBox.east - box.max_longitude) < epsilon;
      const geometry = matches ? parseAmazonCentralApiFeature(feature.data, dataset.bounding_box) : null;

      if (geometry) {
        setApiGeometry(geometry);
        setGeoApiState('connected');
      } else {
        setGeoApiState('fallback');
      }
    }).catch(() => {
      if (!isMounted) return;
      setApiGeometry(null);
      setGeoApiState('fallback');
    });

    return () => {
      isMounted = false;
    };
  }, [dataset]);

  const observations = dataset?.observations ?? [];
  const handleStepChange = (index: number) => {
    const observation = observations[index];
    if (!observation) return;
    const rate = observation.scientific_indicators.mean_precipitation_rate.value;
    const availability = observation.availability;
    const quality = availability.status === 'missing'
      ? 'Observação ausente; ausência não significa precipitação zero.'
      : availability.status === 'partial'
        ? `Observação parcial, ${Math.round(availability.valid_cells_ratio * 100)}% de células válidas.`
        : `Observação disponível, ${Math.round(availability.valid_cells_ratio * 100)}% de células válidas.`;
    const sample = dataset?.is_sample ? ' Dataset demonstrativo (is_sample: true), não é observação NASA verificada.' : '';
    setLiveAnnouncement(
      `Passo ${index + 1} de ${observations.length}. ${formatTimestamp(observation.timestamp_utc)}. ` +
      `Precipitação média: ${formatPrecipitationRate(rate)}. ` +
      `${getRatePresentationNote(rate) ?? ''} ` +
      `Área com chuva: ${formatAreaFraction(observation.scientific_indicators.rain_area_fraction.value)}. ${quality}${sample}`
    );
  };

  const selectRegion = (regionId: string) => {
    const region = findRegionOption(regionId);
    if (!region) return;
    setSelectedRegionId(region.id);
    setLiveAnnouncement(`${region.name} selecionada pelo mapa.`);
  };

  const handleMapPoint = async (lat: number, lon: number) => {
    try {
      const result = await geoApiService.locate(lat, lon);
      if (result.available) {
        if (result.data.regioes.includes('amazon_central')) selectRegion('amazon_central');
        else if (result.data.regioes.includes('congo_basin_kisangani')) selectRegion('congo_basin_kisangani');
        return;
      }
    } catch {
      setApiGeometry(null);
      setGeoApiState('fallback');
    }
  };

  const {
    isPlaying,
    isPreviewing,
    currentIndex,
    isMuted,
    audioError,
    analyser,
    currentObservation,
    togglePlay,
    previewStep,
    previewParams,
    nextStep,
    prevStep,
    setStep,
    toggleMute
  } = useAudioPlayer({ observations, stepDurationMs: 1500, onStepChange: handleStepChange });

  useKeyboardShortcuts({
    onTogglePlay: togglePlay,
    onNextStep: nextStep,
    onPrevStep: prevStep,
    onToggleMute: toggleMute,
    enabled: !isEducationalOpen
  });

  const currentRateNote = currentObservation
    ? getRatePresentationNote(currentObservation.scientific_indicators.mean_precipitation_rate.value)
    : null;

  return (
    <div className="app-layout">
      <AriaLiveAnnouncer message={liveAnnouncement} />
      <Header onOpenEducational={() => setIsEducationalOpen(true)} />

      <main id="main-content" className="main-content">
        <h1 className="sr-only">Sonatlas Earth Explorer</h1>
        <div className="explorer-layout">
          <section id="map" className="map-panel" aria-label="Área do mapa">
            <h2 className="map-heading"><Map size={17} aria-hidden="true" /> Mapa da região</h2>
            {dataset ? (
              <MapView
                boundingBox={dataset.bounding_box}
                regionName={dataset.region_name}
                isPlaceholder={dataset.is_placeholder}
                regionId={selectedRegionId}
                apiGeometry={apiGeometry}
                geoApiStatus={geoApiState}
                onMapPoint={handleMapPoint}
                onRegionSelect={(regionId) => {
                  const region = findRegionOption(regionId);
                  if (!region) return;
                  setSelectedRegionId(region.id);
                  setLiveAnnouncement(`${region.name} selecionada pelo mapa.`);
                }}
              />
            ) : (
              <div className="map-loading-state" role={errorMessage ? 'alert' : 'status'}>
                {errorMessage ? <AlertTriangle aria-hidden="true" /> : <Map aria-hidden="true" />}
                <strong>{errorMessage ? 'Mapa indisponível' : 'Preparando a área de exploração'}</strong>
                <span>{errorMessage ?? 'Aguardando os dados da região selecionada.'}</span>
              </div>
            )}
            {dataset?.is_sample && (
              <p className="sample-strip"><AlertTriangle size={14} aria-hidden="true" /> Amostra técnica — valores demonstrativos, não são observações NASA verificadas.</p>
            )}
          </section>

          <section className="side-panel left-panel" aria-labelledby="exploration-title">
            <div className="panel-content">
              <div className="panel-heading">
                <h2 id="exploration-title">Exploração</h2>
              </div>
              <RegionSelector
                selectedRegionId={selectedRegionId}
                onSelectRegion={setSelectedRegionId}
                selectedSeriesId={selectedSeriesId}
                onSelectSeries={setSelectedSeriesId}
              />
              <VariableSelector />
              <section className="layer-section" aria-labelledby="layers-title">
                <div className="control-section-heading">
                  <Layers size={16} aria-hidden="true" />
                  <h3 id="layers-title">Camadas geográficas</h3>
                </div>
                <p className="layer-name">Contorno da área selecionada</p>
              </section>
              {loading && <p className="inline-status" role="status">Carregando dataset da região…</p>}
              {errorMessage && <p className="inline-error" role="alert">{errorMessage}</p>}
            </div>
          </section>

          <section className="side-panel right-panel" aria-labelledby="signal-title">
            <div className="panel-content">
              <div className="panel-heading">
                <h2 id="signal-title">Dados e som</h2>
              </div>
              <section id="indicators" className="data-section" aria-label="Indicadores científicos">
                <PrecipitationChart
                  observations={observations}
                  currentIndex={currentIndex}
                  onSelectStep={setStep}
                  isSample={dataset?.is_sample ?? false}
                  loading={loading}
                  error={errorMessage}
                />
                {dataset?.is_sample && (
                  <p className="sample-status">Amostra técnica — não é observação NASA verificada.</p>
                )}
                {currentObservation && dataset ? (
                  <>
                    <div className="current-value">
                      <span>Precipitação média</span>
                      <strong>{formatPrecipitationRate(currentObservation.scientific_indicators.mean_precipitation_rate.value)}</strong>
                      <time dateTime={currentObservation.timestamp_utc}>{formatTimestamp(currentObservation.timestamp_utc)}</time>
                    </div>
                    <p className={`availability-status availability-${currentObservation.availability.status}`}>
                      {currentObservation.availability.status === 'missing'
                        ? 'Dados ausentes neste período'
                        : `${currentObservation.availability.status === 'partial' ? 'Disponibilidade parcial' : 'Dados disponíveis'} · ${Math.round(currentObservation.availability.valid_cells_ratio * 100)}% de células válidas`}
                    </p>
                    {currentRateNote && <p className="availability-status">{currentRateNote}</p>}
                    <details className="details-disclosure">
                      <summary>Detalhes da observação e fonte</summary>
                      <ScientificSummary observation={currentObservation} regionName={dataset.region_name} />
                      <dl className="source-metadata">
                        <div><dt>Fonte</dt><dd>{dataset.data_source}</dd></div>
                        <div><dt>Produto</dt><dd>{dataset.product_name} · {dataset.product_version}</dd></div>
                        <div><dt>Resolução temporal</dt><dd>{dataset.temporal_resolution.replace('_', ' ')}</dd></div>
                      </dl>
                    </details>
                  </>
                ) : (
                  <p className="data-empty" role="status">{loading ? 'Carregando observações…' : 'Sem observações disponíveis para este período.'}</p>
                )}
              </section>

              <section id="playback" className="sonification-section" aria-label="Controles de sonificação">
                <AudioPlayer
                  isPlaying={isPlaying}
                  isPreviewing={isPreviewing}
                  isMuted={isMuted}
                  currentIndex={currentIndex}
                  totalSteps={observations.length}
                  onTogglePlay={togglePlay}
                  onPreview={() => previewStep(currentIndex)}
                  onNextStep={nextStep}
                  onPrevStep={prevStep}
                  onToggleMute={toggleMute}
                  analyser={analyser}
                  audioError={audioError}
                  disabled={observations.length === 0}
                />
              </section>

              <details className="details-disclosure sound-disclosure">
                <summary><Waves size={15} aria-hidden="true" /> Calibração sonora</summary>
                <SoundLegend onPreviewParams={(params) => {
                  previewParams(params);
                  setLiveAnnouncement('Prévia de calibração sonora. Não representa uma observação científica selecionada.');
                }} />
              </details>
            </div>
          </section>

          <section className="timeline-panel" aria-labelledby="timeline-panel-title">
            <div className="timeline-panel-heading">
              <div>
                <h2 id="timeline-panel-title">Linha temporal</h2>
              </div>
              <div className="selected-period" aria-live="polite">
                <CalendarClock size={16} aria-hidden="true" />
                <span>{currentObservation ? formatTimestamp(currentObservation.timestamp_utc) : 'Nenhum período selecionado'}</span>
              </div>
            </div>
            <Timeline
              observations={observations}
              currentIndex={currentIndex}
              onSelectStep={setStep}
            />
          </section>
        </div>
      </main>

      <Footer />
      <EducationalPanel isOpen={isEducationalOpen} dataset={dataset} loading={loading} error={errorMessage} onClose={() => setIsEducationalOpen(false)} />
    </div>
  );
};
