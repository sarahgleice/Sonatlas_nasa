import { describe, expect, it, vi } from 'vitest';
import { applyVolumeLevel, isVolumeCapable, readVolumeLevel } from '../src/audio/volumeControl';

describe('adaptador de volume', () => {
  it('motor sem setVolume não é considerado capaz', () => {
    expect(isVolumeCapable({})).toBe(false);
    expect(isVolumeCapable(null)).toBe(false);
    expect(isVolumeCapable({ setVolume: 1, getVolume: 1 })).toBe(false);
  });

  it('sem suporte: lê o nível padrão e não aplica nada', () => {
    expect(readVolumeLevel({})).toBe(0.5);
    expect(applyVolumeLevel({}, 0.8)).toBe(false);
  });

  it('com suporte: lê o ganho do motor como nível do slider', () => {
    const engine = { setVolume: vi.fn(), getVolume: () => 0.3 };
    expect(isVolumeCapable(engine)).toBe(true);
    expect(readVolumeLevel(engine)).toBeCloseTo(0.5);
  });

  it('com suporte: converte o nível em ganho com o teto de segurança', () => {
    const setVolume = vi.fn();
    const engine = { setVolume, getVolume: () => 0.3 };
    expect(applyVolumeLevel(engine, 1)).toBe(true);
    expect(setVolume).toHaveBeenLastCalledWith(expect.closeTo(0.6));
    applyVolumeLevel(engine, 2);
    expect(setVolume).toHaveBeenLastCalledWith(expect.closeTo(0.6));
    applyVolumeLevel(engine, 0);
    expect(setVolume).toHaveBeenLastCalledWith(0);
  });

  it('funciona com métodos de uma classe (como o AudioEngine)', () => {
    class Fake {
      v = 0.3;
      setVolume(value: number) { this.v = value; }
      getVolume() { return this.v; }
    }
    const engine = new Fake();
    expect(isVolumeCapable(engine)).toBe(true);
    applyVolumeLevel(engine, 0.5);
    expect(engine.v).toBeCloseTo(0.3);
  });
});