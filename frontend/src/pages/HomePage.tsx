import React, { useState, useEffect } from 'react';
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
          {/* Seletor de Região */}
          <RegionSelector
            selectedRegionId={selectedRegionId}
            onSelectRegion={setSelectedRegionId}
          />

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

          {!loading && !errorMessage && dataset && (
            <>
              {/* Controles do Player e Linha do Tempo */}
              <div className="grid grid-2">
                <div>
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
                </div>

                <div>
                  {/* Sumário Científico Textual */}
                  <ScientificSummary
                    observation={currentObservation}
                    regionName={dataset.region_name}
                  />
                </div>
              </div>

              {/* Mapa 2D e Legenda Sonora */}
              <div className="grid grid-2 mt-4">
                <MapView
                  boundingBox={dataset.bounding_box}
                  regionName={dataset.region_name}
                  isPlaceholder={dataset.is_placeholder}
                />

                <SoundLegend />
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
