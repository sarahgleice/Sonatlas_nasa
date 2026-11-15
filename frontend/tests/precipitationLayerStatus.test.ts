import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(__dirname, '../src/maps/PrecipitationOverlay.tsx'), 'utf-8');

describe('status da camada de precipitação', () => {
  it('não é uma região aria-live: não fala a cada passo durante a reprodução', () => {
    const line = source.split('\n').find((text) => text.includes('precipitation-layer-status')) ?? '';
    expect(line).not.toContain('aria-live');
    expect(line).not.toContain("'status'");
  });

  it('só usa role="alert" para erro', () => {
    const line = source.split('\n').find((text) => text.includes('precipitation-layer-status')) ?? '';
    expect(line).toContain("state === 'error' ? 'alert' : undefined");
  });

  it('mostra o instante em formato legível, não como ISO cru', () => {
    expect(source).toContain('formatTimestamp(timestampUtc)');
    expect(source).not.toContain('${timestampUtc} UTC');
  });
});
