import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  Layers,
  Map,
  Volume2,
  Waves
} from 'lucide-react';
import { RegionDataset, TemporalObservation } from '../types/dataset';
import { LiveAnnouncement } from '../types/player';
import { DataService, AVAILABLE_REGIONS, findRegionOption } from '../services/dataService';
import { globalAudioEngine } from '../audio/AudioEngine';
import { useAudioPlayer, PlayerBoundary, StepTransition } from '../hooks/useAudioPlayer';
import { buildAnnouncement, formatObservationAnnouncementText } from '../utils/announcements';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { formatPrecipitationRate, formatTimestamp } from '../utils/formatters';
import { Header } from '../components/Header';
import { EducationalPanel } from '../components/EducationalPanel';
import { KeyboardShortcutsModal } from '../accessibility/KeyboardShortcutsModal';
import { Footer } from '../components/Footer';
import { RegionSelector } from '../components/RegionSelector';
import { VariableSelector } from '../components/VariableSelector';
import { AudioPlayer } from '../components/AudioPlayer';
import { Timeline } from '../components/Timeline';
import { ScientificSummary } from '../components/ScientificSummary';
import { VisualFrameViewer } from '../components/VisualFrameViewer';
import { PrecipitationChart } from '../components/PrecipitationChart';
import { SoundLegend, SonificationGuide } from '../components/SoundLegend';
import { MapView } from '../maps/MapView';
import { AriaLiveAnnouncer } from '../accessibility/AriaLiveAnnouncer';
import { AccessibilitySettingsDialog } from '../accessibility/AccessibilitySettingsDialog';
import { ObjectiveAudioDialog } from '../accessibility/ObjectiveAudioDialog';
import { isSpeechNarrationSupported, speakNarration, stopNarration } from '../accessibility/speechNarration';
import { geoApiService } from '../services/geoApiService';
import { parseAmazonCentralApiFeature } from '../maps/amazonGeometry';

type GeoApiState = 'unconfigured' | 'loading' | 'connected' | 'fallback';

const EMPTY_OBSERVATIONS: TemporalObservation[] = [];
const GlobeView = lazy(() => import('../maps/GlobeView').then(({ GlobeView: Component }) => ({ default: Component })));
const ACCESSIBILITY_PROMPT_KEY = 'sonatlas.accessibility-prompt-seen';
const OBJECTIVE_AUDIO_PROMPT_KEY = 'sonatlas.objective-audio-prompt-seen';
const VOICE_NARRATION_KEY = 'sonatlas.voice-narration-enabled';
const OBJECTIVE_AUDIO_TEXT = 'O Sonatlas ajuda você a explorar dados científicos da Terra por mapas, indicadores, texto e som. Na sonificação da chuva, a taxa média define a altura da nota e a fração da área com chuva define a quantidade de pulsos. Assim, o áudio complementa os dados visuais e textuais para revelar padrões ambientais.';

function readStoredBoolean(key: string, fallback: boolean): boolean {
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? fallback : value === 'true';
  } catch {
    return fallback;
  }
}

function writeStoredBoolean(key: string, value: boolean): void {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Preferência continua ativa nesta sessão quando o navegador bloqueia armazenamento.
  }
}

export const HomePage: React.FC = () => {
  const [selectedRegionId, setSelectedRegionId] = useState('amazon_central');
  const [selectedSeriesId, setSelectedSeriesId] = useState('day_windows');
  const [mapViewMode, setMapViewMode] = useState<'2d' | '3d'>('2d');
  const [voiceEnabled, setVoiceEnabled] = useState(() => readStoredBoolean(VOICE_NARRATION_KEY, false));
  const [isAccessibilitySettingsOpen, setIsAccessibilitySettingsOpen] = useState(() => !readStoredBoolean(ACCESSIBILITY_PROMPT_KEY, false));
  // O guia em áudio do objetivo é opcional (botão "Ouvir objetivo"); não abre sozinho para não empilhar diálogos.
  const [isObjectiveAudioPromptOpen, setIsObjectiveAudioPromptOpen] = useState(false);
  const [dataset, setDataset] = useState<RegionDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState<LiveAnnouncement | null>(null);
  const announcementIdRef = useRef(0);
  const voiceNarrationActive = voiceEnabled && isSpeechNarrationSupported();
  const announce = useCallback((text: string, politeness: LiveAnnouncement['politeness'] = 'polite') => {
    announcementIdRef.current += 1;
    setLiveAnnouncement({ id: announcementIdRef.current, text, politeness });
    if (voiceNarrationActive && !isAccessibilitySettingsOpen && !isObjectiveAudioPromptOpen) speakNarration(text);
  }, [voiceNarrationActive, isAccessibilitySettingsOpen, isObjectiveAudioPromptOpen]);
  const [isEducationalOpen, setIsEducationalOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [geoApiState, setGeoApiState] = useState<GeoApiState>('unconfigured');
  const [apiGeometry, setApiGeometry] = useState<GeoJSON.GeoJsonObject | null>(null);

  const closeAccessibilitySettings = useCallback(() => {
    writeStoredBoolean(ACCESSIBILITY_PROMPT_KEY, true);
    setIsAccessibilitySettingsOpen(false);
  }, []);

  const saveAccessibilitySettings = useCallback((enabled: boolean) => {
    writeStoredBoolean(ACCESSIBILITY_PROMPT_KEY, true);
    writeStoredBoolean(VOICE_NARRATION_KEY, enabled);
    setVoiceEnabled(enabled);
    setIsAccessibilitySettingsOpen(false);
    if (!enabled) stopNarration();
    // Só quem ativou a narração recebe o convite do guia em áudio, evitando empilhar diálogos para os demais.
    else if (!readStoredBoolean(OBJECTIVE_AUDIO_PROMPT_KEY, false)) setIsObjectiveAudioPromptOpen(true);
  }, []);

  const closeObjectiveAudioPrompt = useCallback(() => {
    writeStoredBoolean(OBJECTIVE_AUDIO_PROMPT_KEY, true);
    setIsObjectiveAudioPromptOpen(false);
  }, []);

  useEffect(() => () => stopNarration(), []);
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
        announce(`Região: ${data.region_name}, série: ${activeSeries?.name}. ${data.observations.length} observações temporais carregadas.`);
      })
      .catch((error: unknown) => {
        if (!isMounted) return;
        setErrorMessage(error instanceof Error ? error.message : 'Erro ao carregar dados científicos.');
        setLoading(false);
        announce('Erro ao carregar dados científicos.', 'assertive');
      });

    return () => {
      isMounted = false;
    };
  }, [selectedRegionId, selectedSeriesId]);

  useEffect(() => {
    if (!dataset || dataset.region_id !== 'amazon_central') {
      setApiGeometry(null);
      setGeoApiState('unconfigured');
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

  const observations = useMemo(() => dataset?.observations ?? EMPTY_OBSERVATIONS, [dataset]);

  const handleTransition = useCallback((transition: StepTransition) => {
    const announcement = buildAnnouncement({
      source: transition.source,
      observation: transition.observation,
      index: transition.index,
      total: observations.length,
      previousObservation: transition.previousIndex !== null && transition.previousIndex !== transition.index
        ? observations[transition.previousIndex] ?? null
        : null
    });
    if (announcement) {
      announce(announcement.text, announcement.politeness);
    } else if (voiceNarrationActive && transition.source === 'slider_step' && transition.observation) {
      speakNarration(formatObservationAnnouncementText(transition.observation, transition.index, observations.length));
    }
  }, [observations, announce, voiceNarrationActive]);

  const handleBoundary = useCallback((boundary: PlayerBoundary) => {
    announce(boundary === 'end' ? 'Você está no último passo da série.' : 'Você está no primeiro passo da série.');
  }, [announce]);

  const selectRegion = (regionId: string) => {
    const region = findRegionOption(regionId);
    if (!region) return;
    setSelectedRegionId(region.id);
    announce(region.status === 'candidate'
      ? `${region.name}, ${region.country}, selecionada. Janela amostral candidata sob validação; não representa toda a bacia.`
      : `${region.name}, ${region.country}, selecionada.`);
  };

  const handleMapPoint = async (lat: number, lon: number) => {
    try {
      const result = await geoApiService.locate(lat, lon);
      if (result.available) {
        const regionId = result.data.regioes.find((id) => findRegionOption(id));
        if (regionId) selectRegion(regionId);
        return;
      }
    } catch {
      setApiGeometry(null);
      setGeoApiState('fallback');
    }
  };

  const {
    isPlaying,
    currentIndex,
    isMuted,
    volume,
    audioError,
    analyser,
    currentObservation,
    previousObservation,
    speed,
    isLooping,
    canGoPrevious,
    canGoNext,
    restart,
    setSpeed,
    togglePlay,
    previewStep,
    nextStep,
    prevStep,
    setStep,
    firstStep,
    lastStep,
    toggleLoop,
    toggleMute,
    setVolume
  } = useAudioPlayer({
    observations,
    stepDurationMs: 1500,
    onTransition: handleTransition,
    onBoundary: handleBoundary
  });

  const comparisonObservation = previousObservation && currentObservation &&
    Date.parse(currentObservation.timestamp_utc) - Date.parse(previousObservation.timestamp_utc) <= 30 * 60 * 1000
    ? previousObservation
    : null;

  const openShortcuts = useCallback(() => setIsShortcutsOpen(true), []);
  const openAccessibilitySettings = useCallback(() => setIsAccessibilitySettingsOpen(true), []);

  useKeyboardShortcuts({
    onTogglePlay: togglePlay,
    onNextStep: nextStep,
    onPrevStep: prevStep,
    onToggleMute: toggleMute,
    onFirstStep: firstStep,
    onLastStep: lastStep,
    onToggleLoop: toggleLoop,
    onOpenShortcuts: openShortcuts,
    enabled: !isEducationalOpen && !isShortcutsOpen && !isAccessibilitySettingsOpen && !isObjectiveAudioPromptOpen
  });

  return (
    <div className="app-layout">
      <AriaLiveAnnouncer announcement={liveAnnouncement} disabled={voiceNarrationActive || isAccessibilitySettingsOpen || isObjectiveAudioPromptOpen} />
      <Header
        onOpenEducational={() => setIsEducationalOpen(true)}
        onOpenShortcuts={openShortcuts}
        onOpenAccessibility={openAccessibilitySettings}
        onListenObjective={() => speakNarration(OBJECTIVE_AUDIO_TEXT)}
        objectiveAudioDisabled={!isSpeechNarrationSupported() || isPlaying}
        voiceEnabled={voiceNarrationActive}
      />

      <main id="main-content" className="main-content" tabIndex={-1}>
        <h1 className="sr-only">Sonatlas Earth Explorer</h1>
        <div className="explorer-layout">
          <section className="side-panel left-panel" aria-labelledby="exploration-title">
            <div className="panel-content">
              <div className="panel-heading"><h2 id="exploration-title">Exploração</h2></div>
              <RegionSelector selectedRegionId={selectedRegionId} onSelectRegion={selectRegion} selectedSeriesId={selectedSeriesId} onSelectSeries={setSelectedSeriesId} />
              <VariableSelector />
              <section className="layer-section" aria-labelledby="layers-title">
                <div className="control-section-heading"><Layers size={16} aria-hidden="true" /><h3 id="layers-title">Camadas geográficas</h3></div>
                <p className="layer-name">Contorno da área selecionada</p>
              </section>
              {loading && <p className="inline-status" role="status">Carregando dataset da região…</p>}
              {errorMessage && <p className="inline-error" role="alert">{errorMessage}</p>}
            </div>
          </section>

          <section id="map" className="map-panel" aria-label="Área do mapa">
            <div className="map-view-header">
              <h2 className="map-heading"><Map size={17} aria-hidden="true" />Explorar a Terra</h2>
              <div className="map-view-toggle" role="group" aria-label="Modo de visualização geográfica">
                <button type="button" className="btn btn-secondary btn-sm" aria-pressed={mapViewMode === '2d'} onClick={() => setMapViewMode('2d')}>Mapa 2D</button>
                <button type="button" className="btn btn-secondary btn-sm" aria-pressed={mapViewMode === '3d'} onClick={() => setMapViewMode('3d')}>Globo 3D</button>
              </div>
            </div>
            {dataset ? (
              <>
                <MapView
                  boundingBox={dataset.bounding_box}
                  regionName={dataset.region_name}
                  isPlaceholder={dataset.is_placeholder}
                  regionId={selectedRegionId}
                  apiGeometry={apiGeometry}
                  geoApiStatus={geoApiState}
                  spatialDatasetPath={findRegionOption(selectedRegionId)?.series.find((series) => series.id === selectedSeriesId)?.filePath ?? ''}
                  selectedTimestamp={currentObservation?.timestamp_utc ?? null}
                  selectedAvailability={currentObservation?.availability ?? null}
                  onMapPoint={handleMapPoint}
                  onRegionSelect={selectRegion}
                  isVisible={mapViewMode === '2d'}
                />
                {mapViewMode === '3d' && (
                  <Suspense fallback={<div className="globe-fallback" role="status">Carregando o globo 3D…</div>}>
                    <GlobeView
                      selectedRegionId={selectedRegionId}
                      onRegionSelect={selectRegion}
                      onReturnToMap={() => setMapViewMode('2d')}
                    />
                  </Suspense>
                )}
              </>
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

          <section id="playback" className="sonification-section" aria-label="Controles de sonificação">
            <AudioPlayer
              isPlaying={isPlaying} isMuted={isMuted} isLooping={isLooping} speed={speed}
              volume={volume} onVolumeChange={setVolume}
              currentIndex={currentIndex} totalSteps={observations.length} currentObservation={currentObservation}
              canGoPrevious={canGoPrevious} canGoNext={canGoNext} onToggleLoop={toggleLoop} onRestart={restart}
              onSpeedChange={setSpeed} onTogglePlay={togglePlay} onPreview={() => previewStep(currentIndex)}
              onNextStep={nextStep} onPrevStep={prevStep} onToggleMute={toggleMute} analyser={analyser}
              audioError={audioError} disabled={observations.length === 0}
            />
            <SonificationGuide />
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
                    <VisualFrameViewer observation={currentObservation} />
                    <ScientificSummary observation={currentObservation} regionName={dataset.region_name} previousObservation={comparisonObservation} index={currentIndex} total={observations.length} />
                    {voiceNarrationActive && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm voice-read-button"
                        onClick={() => speakNarration(formatObservationAnnouncementText(currentObservation, currentIndex, observations.length))}
                      >
                        <Volume2 size={16} aria-hidden="true" />
                        <span>Ouvir descrição deste período</span>
                      </button>
                    )}
                    <details className="details-disclosure">
                      <summary>Fonte e metadados técnicos</summary>
                      <dl className="source-metadata">
                        <div><dt>Fonte</dt><dd>{dataset.data_source}</dd></div>
                        <div><dt>Produto</dt><dd>{dataset.product_name} · {dataset.product_version}</dd></div>
                        <div><dt>Resolução temporal</dt><dd>{dataset.temporal_resolution.replace(/_/g, ' ')}</dd></div>
                      </dl>
                    </details>
                  </>
                ) : (
                  <p className="data-empty" role="status">{loading ? 'Carregando observações…' : 'Sem observações disponíveis para este período.'}</p>
                )}
              </section>

              <details className="details-disclosure sound-disclosure">
                <summary><Waves size={15} aria-hidden="true" /> Calibração sonora</summary>
                <SoundLegend />
              </details>
            </div>
          </section>

          <section className="timeline-panel" aria-labelledby="timeline-panel-title">
            <div className="timeline-panel-heading">
              <div>
                <h2 id="timeline-panel-title">Linha temporal</h2>
              </div>
              <div className="selected-period">
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
      <KeyboardShortcutsModal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />
      <AccessibilitySettingsDialog
        isOpen={isAccessibilitySettingsOpen}
        voiceEnabled={voiceEnabled}
        voiceSupported={isSpeechNarrationSupported()}
        onSave={saveAccessibilitySettings}
        onClose={closeAccessibilitySettings}
      />
      <ObjectiveAudioDialog
        isOpen={isObjectiveAudioPromptOpen}
        voiceSupported={isSpeechNarrationSupported()}
        onListen={() => speakNarration(OBJECTIVE_AUDIO_TEXT)}
        onClose={closeObjectiveAudioPrompt}
      />
      <EducationalPanel isOpen={isEducationalOpen} dataset={dataset} loading={loading} error={errorMessage} onClose={() => setIsEducationalOpen(false)} />
    </div>
  );
};
