export type PlaybackSpeed = 0.5 | 0.75 | 1 | 1.5 | 2;

export const PLAYBACK_SPEEDS: readonly PlaybackSpeed[] = [0.5, 0.75, 1, 1.5, 2];

export type StepChangeSource =
  | 'manual_step'
  | 'slider_step'
  | 'play_start'
  | 'playback_auto'
  | 'playback_pause'
  | 'playback_end';

export interface LiveAnnouncement {
  id: number;
  text: string;
  politeness: 'polite' | 'assertive';
}

export interface SonificationExplanation {
  headline: string;
  pitchComparison: string;
  pulseComparison: string;
  temporalChange: string;
  fullText: string;
}

export type ObservationDataState = 'missing' | 'dry' | 'rain';

export interface ShortcutItem {
  keys: string;
  description: string;
}

export const SHORTCUTS: readonly ShortcutItem[] = [
  { keys: 'Espaço', description: 'Reproduzir ou pausar a sonificação (fora de botões e campos de formulário)' },
  { keys: '→ / ←', description: 'Avançar ou retroceder um passo temporal' },
  { keys: 'Home / End', description: 'Ir para a primeira ou última observação da série' },
  { keys: 'M', description: 'Silenciar ou ativar o áudio' },
  { keys: 'L', description: 'Ativar ou desativar a repetição contínua (loop)' },
  { keys: '?', description: 'Abrir a ajuda com atalhos de teclado' },
  { keys: 'Linha do tempo', description: 'Com o controle em foco: setas movem um passo, Home/End vão ao início ou fim, PgUp/PgDn saltam cinco passos' },
  { keys: 'Esc', description: 'Fechar a janela ou guia aberto' },
  { keys: 'Tab / Shift + Tab', description: 'Navegar entre os controles interativos da página' }
];
