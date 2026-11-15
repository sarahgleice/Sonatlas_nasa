export function isSpeechNarrationSupported(): boolean {
  return typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined';
}

export function speakNarration(text: string): void {
  if (!isSpeechNarrationSupported() || !text.trim()) return;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'pt-BR';
  const voices = window.speechSynthesis.getVoices();
  const voice = voices.find((option) => option.lang.toLowerCase() === 'pt-br') ??
    voices.find((option) => option.lang.toLowerCase().startsWith('pt-'));
  if (voice) utterance.voice = voice;

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

export function stopNarration(): void {
  if (isSpeechNarrationSupported()) window.speechSynthesis.cancel();
}
