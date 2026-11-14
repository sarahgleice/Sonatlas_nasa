import React, { useState, useEffect } from 'react';
import { AlertTriangle, CloudRain, Map, Waves } from 'lucide-react';
import { RegionDataset } from '../types/dataset';
import { DataService, AVAILABLE_REGIONS } from '../services/dataService';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { RegionSelector } from '../components/RegionSelector';
import { AudioPlayer } from '../components/AudioPlayer';
import { Timeline } from '../components/Timeline';
import { ScientificSummary } from '../components/ScientificSummary';
import { SoundLegend } from '../components/SoundLegend';
import { MapView } from '../maps/MapView';
import { AriaLiveAnnouncer } from '../accessibility/AriaLiveAnnouncer';
import { KeyboardShortcutsModal } from '../accessibility/KeyboardShortcutsModal';

export const HomePage: React.FC = () => {
  const [selectedRegionId, setSelectedRegionId] = useState<string>('amazon_central');
  const [dataset, setDataset] = useState<RegionDataset | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>('');
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);

  // Carregar dataset quando a região for alterada
  useEffect(() => {
    let isMounted = true;
    const regionOpt = AVAILABLE_REGIONS.find((r) => r.id === selectedRegionId);
    if (!regionOpt) return;

    setLoading(true);
    setErrorMessage(null);
    setDataset(null);

    DataService.loadRegionDataset(regionOpt.filePath)
      .then((data) => {
        if (!isMounted) return;
        setDataset(data);
        setLoading(false);
        const obsCount = data.observations.length;
        setLiveAnnouncement(
          `Região alterada para ${data.region_name}. ${obsCount > 0 ? `${obsCount} observações temporais carregadas.` : 'Esta é uma área candidata sob validação científica.'}`
        );
      })
      .catch((err) => {
        if (!isMounted) return;
        setErrorMessage(err.message || 'Erro ao carregar dados científicos.');
        setLoading(false);
        setLiveAnnouncement('Erro ao carregar dados científicos.');
      });

    return () => {
      isMounted = false;
    };
  }, [selectedRegionId]);

  const observations = dataset?.observations || [];

  const handleStepChange = (index: number) => {
    if (observations[index]) {
      const obs = observations[index];
      const rate = obs.scientific_indicators.mean_precipitation_rate.value;
      const rateStr = rate !== null ? `${rate} milímetros por hora` : 'dados não disponíveis';
      setLiveAnnouncement(
        `Passo ${index + 1} de ${observations.length}. ${rateStr}.`
      );
    }
  };

  const {
    isPlaying,
    currentIndex,
    isMuted,
    currentObservation,
    togglePlay,
    nextStep,
    prevStep,
    setStep,
    toggleMute
  } = useAudioPlayer({
    observations,
    stepDurationMs: 1500,
    onStepChange: handleStepChange
  });

  // Atalhos de teclado globais
  useKeyboardShortcuts({
    onTogglePlay: togglePlay,
    onNextStep: nextStep,
    onPrevStep: prevStep,
    onToggleMute: toggleMute
  });

  return (
    <div className="app-layout">
      <AriaLiveAnnouncer message={liveAnnouncement} />
      <Header onOpenShortcuts={() => setIsShortcutsOpen(true)} />

      <main id="main-content" className="main-content" tabIndex={-1}>
        <div className="container">
          <section className="explorer-intro" aria-labelledby="explorer-title">
            <p className="eyebrow">Observação da Terra · Exploração sonora</p>
            <h2 id="explorer-title">Ouça o ritmo da chuva na Terra.</h2>
            <p>Explore as mudanças da precipitação ao longo do tempo, com contexto científico apresentado de forma acessível.</p>
          </section>

          <div id="region" className="workspace-region">
            <RegionSelector
              selectedRegionId={selectedRegionId}
              onSelectRegion={setSelectedRegionId}
            />
            {dataset && (
              <div className="region-context" aria-live="polite">
                <span className="region-context-icon" aria-hidden="true"><Map size={18} /></span>
                <div>
                  <span className="eyebrow">REGIÃO EM EXPLORAÇÃO</span>
                  <h3>{dataset.region_name}</h3>
                  <p>{dataset.country} <span aria-hidden="true">·</span> Precipitação <span aria-hidden="true">·</span> Resolução {dataset.temporal_resolution.replace('_', ' ')}</p>
                </div>
              </div>
            )}
          </div>

          {loading && (
            <div className="card loading-card" role="status">
              <p>Carregando dados científicos de satélite...</p>
            </div>
          )}

          {errorMessage && (
            <div className="card error-card" role="alert">
              <p><strong>Aviso:</strong> {errorMessage}</p>
            </div>
          )}

          {!loading && !errorMessage && dataset?.is_sample && (
            <aside className="sample-notice" aria-label="Aviso sobre dados demonstrativos">
              <AlertTriangle size={19} aria-hidden="true" />
              <p><strong>Amostra técnica demonstrativa.</strong> Estes valores servem para validar a interface e não representam observações reais verificadas da NASA.</p>
            </aside>
          )}

          {!loading && !errorMessage && dataset && (
            <>
              {observations.length === 0 && (
                <aside className="empty-notice" role="status">
                  <CloudRain size={20} aria-hidden="true" />
                  <p><strong>Observações indisponíveis.</strong> Ainda não há uma série temporal publicada para esta região.</p>
                </aside>
              )}

              <div className="exploration-grid">
                <div id="map">
                  <MapView
                    boundingBox={dataset.bounding_box}
                    regionName={dataset.region_name}
                    isPlaceholder={dataset.is_placeholder}
                  />
                </div>
                <div id="indicators">
                  {currentObservation ? (
                    <ScientificSummary
                      observation={currentObservation}
                      regionName={dataset.region_name}
                    />
                  ) : (
                    <section className="card" aria-labelledby="summary-title">
                      <h2 id="summary-title" className="card-title">Indicadores Científicos</h2>
                      <p>Indicadores indisponíveis até que uma observação temporal seja publicada para esta região.</p>
                    </section>
                  )}
                </div>
                <section id="playback" className="playback-panel" aria-labelledby="playback-heading">
                  <div className="section-heading">
                    <Waves size={19} aria-hidden="true" />
                    <h2 id="playback-heading">Exploração temporal e sonora</h2>
                  </div>
                  <AudioPlayer
                    isPlaying={isPlaying}
                    isMuted={isMuted}
                    currentIndex={currentIndex}
                    totalSteps={observations.length}
                    onTogglePlay={togglePlay}
                    onNextStep={nextStep}
                    onPrevStep={prevStep}
                    onToggleMute={toggleMute}
                    disabled={observations.length === 0}
                  />

                  <Timeline
                    observations={observations}
                    currentIndex={currentIndex}
                    onSelectStep={setStep}
                  />
                </section>
                <div className="exploration-legend">
                  <SoundLegend />
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />

      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  );
};
