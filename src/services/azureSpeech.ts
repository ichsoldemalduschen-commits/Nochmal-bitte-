import { getAzureSpeechKey, getAzureSpeechRegion, getTtsEnabled } from './storage';

let activeAudio: HTMLAudioElement | null = null;
let activeBlobUrl: string | null = null;
let activeAbortController: AbortController | null = null;

/**
 * Bricht jegliche laufende Audio-Wiedergabe (Azure & Browser-Synthesis) sofort und sauber ab.
 * Stellt sicher, dass sich niemals zwei Stimmen überlagern.
 */
export function stopSpeaking(): void {
  if (activeAbortController) {
    try {
      activeAbortController.abort();
    } catch {
      // ignore
    }
    activeAbortController = null;
  }

  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.currentTime = 0;
      activeAudio.src = '';
    } catch {
      // ignore
    }
    activeAudio = null;
  }

  if (activeBlobUrl) {
    try {
      URL.revokeObjectURL(activeBlobUrl);
    } catch {
      // ignore
    }
    activeBlobUrl = null;
  }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function speakBrowserSynthesis(cleanText: string, onEnd?: () => void): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (onEnd) onEnd();
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(cleanText);
    utter.lang = 'de-DE';
    utter.rate = 1.05;
    utter.onend = () => {
      if (onEnd) onEnd();
    };
    utter.onerror = () => {
      if (onEnd) onEnd();
    };
    window.speechSynthesis.speak(utter);
  } catch {
    if (onEnd) onEnd();
  }
}

/**
 * Zentrale Sprachausgabe der App mit automatischer Priorisierung:
 * 1. Microsoft Azure Speech (de-DE-GiselaNeural)
 * 2. Geräuschloser Fallback auf window.speechSynthesis (offline, timeout > 3.5s oder Fehler)
 */
export async function speakText(
  text: string,
  onEnd?: () => void,
  onEngineUsed?: (engine: 'azure-gisela' | 'browser-fallback') => void
): Promise<void> {
  // 1. Zuerst alles stoppen
  stopSpeaking();

  if (!getTtsEnabled()) {
    if (onEnd) onEnd();
    return;
  }

  const clean = text.replace(/[*#_`~]/g, '').trim();
  if (!clean) {
    if (onEnd) onEnd();
    return;
  }

  const key = getAzureSpeechKey().trim();
  const region = (getAzureSpeechRegion().trim() || 'germanywestcentral').toLowerCase();
  const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;

  // Wenn kein Azure-Schlüssel oder offline -> sofort Browser-Fallback
  if (!key || isOffline) {
    if (onEngineUsed) onEngineUsed('browser-fallback');
    speakBrowserSynthesis(clean, onEnd);
    return;
  }

  const ssml = `<speak version='1.0' xml:lang='de-DE'><voice xml:lang='de-DE' name='de-DE-GiselaNeural'>${escapeXml(
    clean
  )}</voice></speak>`;

  const controller = new AbortController();
  activeAbortController = controller;
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, 3500);

  try {
    const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'BANDIT.OS'
      },
      body: ssml,
      signal: controller.signal
    });

    window.clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Azure TTS HTTP ${response.status}`);
    }

    const blob = await response.blob();
    // Prüfen, ob während des Ladens abgebrochen wurde
    if (activeAbortController !== controller) {
      return;
    }

    const blobUrl = URL.createObjectURL(blob);
    activeBlobUrl = blobUrl;
    const audio = new Audio(blobUrl);
    activeAudio = audio;

    audio.onended = () => {
      stopSpeaking();
      if (onEnd) onEnd();
    };

    audio.onerror = () => {
      stopSpeaking();
      if (onEngineUsed) onEngineUsed('browser-fallback');
      speakBrowserSynthesis(clean, onEnd);
    };

    if (onEngineUsed) onEngineUsed('azure-gisela');
    await audio.play();
  } catch {
    window.clearTimeout(timeoutId);
    stopSpeaking();
    // Geräuschloser Fallback auf Browser-Stimme
    if (onEngineUsed) onEngineUsed('browser-fallback');
    speakBrowserSynthesis(clean, onEnd);
  }
}

/**
 * Testfunktion für Backoffice-Einstellungen:
 * Versucht Azure Gisela gezielt mit den angegebenen Credentials und meldet das Ergebnis zurück.
 */
export async function testGiselaVoice(
  apiKey: string,
  region: string
): Promise<{ ok: boolean; engine: 'azure-gisela' | 'browser-fallback'; message: string }> {
  stopSpeaking();
  const testPhrase = 'Hallo! Ich bin Gisela. Dein System ist einsatzbereit.';
  const cleanKey = apiKey.trim();
  const cleanRegion = (region.trim() || 'germanywestcentral').toLowerCase();

  if (!cleanKey) {
    speakBrowserSynthesis(testPhrase);
    return {
      ok: false,
      engine: 'browser-fallback',
      message: 'Browser-Stimme gesprochen (Kein Azure-Key hinterlegt).'
    };
  }

  const ssml = `<speak version='1.0' xml:lang='de-DE'><voice xml:lang='de-DE' name='de-DE-GiselaNeural'>${escapeXml(
    testPhrase
  )}</voice></speak>`;

  const controller = new AbortController();
  activeAbortController = controller;
  const timeoutId = window.setTimeout(() => controller.abort(), 3500);

  try {
    const endpoint = `https://${cleanRegion}.tts.speech.microsoft.com/cognitiveservices/v1`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': cleanKey,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'BANDIT.OS'
      },
      body: ssml,
      signal: controller.signal
    });
    window.clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    activeBlobUrl = blobUrl;
    const audio = new Audio(blobUrl);
    activeAudio = audio;
    audio.onended = () => stopSpeaking();
    await audio.play();

    return {
      ok: true,
      engine: 'azure-gisela',
      message: 'Azure-Stimme „Gisela“ (de-DE-GiselaNeural) erfolgreich abgespielt.'
    };
  } catch (err: any) {
    window.clearTimeout(timeoutId);
    stopSpeaking();
    speakBrowserSynthesis(testPhrase);
    return {
      ok: false,
      engine: 'browser-fallback',
      message: `Browser-Fallback aktiv (${err?.message || 'Azure-Verbindungsfehler'}).`
    };
  }
}
