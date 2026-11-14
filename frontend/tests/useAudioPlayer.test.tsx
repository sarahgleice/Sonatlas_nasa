import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { useAudioPlayer } from '../src/hooks/useAudioPlayer';
import { globalAudioEngine } from '../src/audio/AudioEngine';

describe('useAudioPlayer', () => {
  it('starts paused and reflects the singleton mute setting on mount', () => {
    const wasMuted = globalAudioEngine.getIsMuted();
    globalAudioEngine.setMuted(true);
    function Probe() {
      const player = useAudioPlayer({ observations: [] });
      return createElement('output', {
        'data-mode': player.mode,
        'data-playing': player.isPlaying,
        'data-previewing': player.isPreviewing,
        'data-muted': player.isMuted
      });
    }
    const html = renderToStaticMarkup(createElement(Probe));
    expect(html).toContain('data-mode="paused"');
    expect(html).toContain('data-playing="false"');
    expect(html).toContain('data-previewing="false"');
    expect(html).toContain('data-muted="true"');
    globalAudioEngine.setMuted(wasMuted);
  });
});
