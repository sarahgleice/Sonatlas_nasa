import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(__dirname, '../src/pages/HomePage.tsx'), 'utf-8');

describe('fluxo de onboarding de acessibilidade', () => {
  it('o guia em áudio não abre sozinho no primeiro acesso', () => {
    expect(source).toMatch(/useState\(false\);\s*\n?\s*const \[dataset/);
    const initial = source.split('\n').find((line) => line.includes('const [isObjectiveAudioPromptOpen')) ?? '';
    expect(initial).toContain('useState(false)');
  });

  it('fechar o primeiro diálogo ("Agora não") não encadeia o segundo', () => {
    const start = source.indexOf('const closeAccessibilitySettings');
    const end = source.indexOf('const saveAccessibilitySettings');
    expect(source.slice(start, end)).not.toContain('setIsObjectiveAudioPromptOpen');
  });

  it('o convite do guia só aparece para quem ativou a narração', () => {
    const start = source.indexOf('const saveAccessibilitySettings');
    const end = source.indexOf('const closeObjectiveAudioPrompt');
    const body = source.slice(start, end);
    expect(body).toContain('else if (!readStoredBoolean(OBJECTIVE_AUDIO_PROMPT_KEY, false)) setIsObjectiveAudioPromptOpen(true)');
  });
});
