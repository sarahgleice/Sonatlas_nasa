export function readWaveform(analyser: AnalyserNode, points = 48): string | null {
  const samples = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(samples);
  const energy = samples.reduce((sum, sample) => sum + (sample - 128) ** 2, 0) / samples.length;
  if (energy < 1) return null;
  const step = Math.max(1, Math.floor(samples.length / points));
  return Array.from({ length: points }, (_, index) => {
    const x = (index / (points - 1)) * 100;
    const y = 50 - ((samples[Math.min(index * step, samples.length - 1)] - 128) / 128) * 42;
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}
