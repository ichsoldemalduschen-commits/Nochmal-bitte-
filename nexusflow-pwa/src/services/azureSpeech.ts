import { AiVoiceSettings } from '../types';
import {
  getAzureSpeechKey,
  getAzureSpeechRegion,
  getTtsEnabled,
  getVoiceProvider
} from './storage';

let activeAudio: HTMLAudioElement | null = null;
let activeBlobUrl: string | null = null;
let activeAbortController: AbortController | null = null;
let activeSpeechGeneration = 0;

const AZURE_TTS_TIMEOUT_MS = 4500;

/**
 * Zentrale Audio-Sperre:
 * Bricht sowohl laufende Azure-TTS-Requests, aktive Audio-Elemente inkl. ObjectURL
 * als auch window.speechSynthesis sofort und restlos ab.
 */
export function stopAllSpeech(): void {
  activeSpeechGeneration += 1;

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
      activeAudio.onended = null;
      activeAudio.onerror = null;
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

/** Abwärtskompatibler Alias für bestehende Module */
export const stopSpeaking = stopAllSpeech;

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function speakBrowserSynthesis(
  cleanText: string,
  generation: number,
  onEnd?: () => void
): void {
  if (generation !== activeSpeechGeneration) return;
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (onEnd) onEnd();
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(cleanText);
    utter.lang = 'de-DE';
    utter.rate = 1.05;

    const voices = window.speechSynthesis.getVoices?.() || [];
    const germanVoice =
      voices.find((v) => v.lang?.toLowerCase() === 'de-de') ||
      voices.find((v) => v.lang?.toLowerCase().startsWith('de'));
    if (germanVoice) {
      utter.voice = germanVoice;
    }

    utter.onend = () => {
      if (generation !== activeSpeechGeneration) return;
      if (onEnd) onEnd();
    };
    utter.onerror = () => {
      if (generation !== activeSpeechGeneration) return;
      if (onEnd) onEnd();
    };
    window.speechSynthesis.speak(utter);
  } catch {
    if (generation === activeSpeechGeneration && onEnd) onEnd();
  }
}

/**
 * Zentrale Sprachausgabe der App mit verbindlicher Stimmen-Auflösungskette:
 * 1. Bei gewähltem Provider 'azure-gisela' + hinterlegtem Key & Region → zwingend Azure de-DE-GiselaNeural.
 * 2. Nur bei fehlendem Key/Region, Offline-Status, HTTP-Fehler oder Azure-Timeout greift der lokale
 *    Browser-Fallback und meldet den Grund über onEngineUsed('browser-fallback', reason),
 *    OHNE die gespeicherte Benutzer-Auswahl zu überschreiben.
 */
export async function speakText(
  text: string,
  onEnd?: () => void,
  onEngineUsed?: (engine: 'azure-gisela' | 'browser-fallback', fallbackReason?: string) => void,
  settingsOverride?: Partial<AiVoiceSettings>
): Promise<void> {
  // 1. Zuerst jede laufende Sprachausgabe hart abbrechen
  stopAllSpeech();
  const myGeneration = activeSpeechGeneration;

  const ttsEnabled = settingsOverride?.ttsEnabled ?? getTtsEnabled();
  if (!ttsEnabled) {
    if (onEnd) onEnd();
    return;
  }

  const clean = text.replace(/[*#_`~]/g, '').trim();
  if (!clean) {
    if (onEnd) onEnd();
    return;
  }

  const voiceProvider = settingsOverride?.voiceProvider ?? getVoiceProvider();
  const key = (settingsOverride?.azureSpeechKey ?? getAzureSpeechKey()).trim();
  const region = (settingsOverride?.azureSpeechRegion ?? getAzureSpeechRegion()).trim().toLowerCase();
  const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;

  // Nutzer hat explizit Browser-Stimme gewählt
  if (voiceProvider === 'browser') {
    onEngineUsed?.('browser-fallback');
    speakBrowserSynthesis(clean, myGeneration, onEnd);
    return;
  }

  // Gisela (Azure Neural) ist gewählt, aber Credentials fehlen oder Gerät ist offline
  if (!key || !region) {
    onEngineUsed?.('browser-fallback', 'Azure-Key oder Region fehlt');
    speakBrowserSynthesis(clean, myGeneration, onEnd);
    return;
  }

  if (isOffline) {
    onEngineUsed?.('browser-fallback', 'Gerät ist offline');
    speakBrowserSynthesis(clean, myGeneration, onEnd);
    return;
  }

  const ssml = `<speak version='1.0' xml:lang='de-DE'><voice xml:lang='de-DE' name='de-DE-GiselaNeural'>${escapeXml(
    clean
  )}</voice></speak>`;

  const controller = new AbortController();
  activeAbortController = controller;
  let timedOut = false;
  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, AZURE_TTS_TIMEOUT_MS);

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

    if (myGeneration !== activeSpeechGeneration) {
      return;
    }

    if (!response.ok) {
      throw new Error(`Azure HTTP ${response.status}`);
    }

    const blob = await response.blob();
    if (myGeneration !== activeSpeechGeneration || activeAbortController !== controller) {
      return;
    }

    const blobUrl = URL.createObjectURL(blob);
    activeBlobUrl = blobUrl;
    const audio = new Audio(blobUrl);
    activeAudio = audio;

    audio.onended = () => {
      if (myGeneration !== activeSpeechGeneration) return;
      stopAllSpeech();
      if (onEnd) onEnd();
    };

    audio.onerror = () => {
      if (myGeneration !== activeSpeechGeneration) return;
      stopAllSpeech();
      const fallbackGen = activeSpeechGeneration;
      onEngineUsed?.('browser-fallback', 'Azure-Audio nicht abspielbar');
      speakBrowserSynthesis(clean, fallbackGen, onEnd);
    };

    onEngineUsed?.('azure-gisela');
    await audio.play();
  } catch (err: any) {
    window.clearTimeout(timeoutId);
    // Wenn durch stopAllSpeech() extern abgebrochen wurde (z.B. Modal geschlossen oder neuer Aufruf),
    // KEINEN Browser-Fallback mehr starten!
    if (myGeneration !== activeSpeechGeneration) {
      return;
    }

    stopAllSpeech();
    const fallbackGen = activeSpeechGeneration;
    const reason = timedOut
      ? 'Azure-Zeitüberschreitung'
      : err?.message || 'Azure-Verbindungsfehler';
    onEngineUsed?.('browser-fallback', reason);
    speakBrowserSynthesis(clean, fallbackGen, onEnd);
  }
}

/**
 * Testfunktion für Zentrale-Einstellungen:
 * Versucht Azure Gisela gezielt mit den angegebenen Credentials und meldet das Ergebnis zurück.
 */
export async function testGiselaVoice(
  apiKey: string,
  region: string
): Promise<{ ok: boolean; engine: 'azure-gisela' | 'browser-fallback'; message: string }> {
  stopAllSpeech();
  const myGeneration = activeSpeechGeneration;
  const testPhrase = 'Hallo! Ich bin Gisela. Dein System ist einsatzbereit.';
  const cleanKey = apiKey.trim();
  const cleanRegion = region.trim().toLowerCase();

  if (!cleanKey || !cleanRegion) {
    speakBrowserSynthesis(testPhrase, myGeneration);
    return {
      ok: false,
      engine: 'browser-fallback',
      message: 'Browser-Stimme gesprochen (Azure-Key oder Region fehlt).'
    };
  }

  const ssml = `<speak version='1.0' xml:lang='de-DE'><voice xml:lang='de-DE' name='de-DE-GiselaNeural'>${escapeXml(
    testPhrase
  )}</voice></speak>`;

  const controller = new AbortController();
  activeAbortController = controller;
  let timedOut = false;
  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, AZURE_TTS_TIMEOUT_MS);

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

    if (myGeneration !== activeSpeechGeneration) {
      return {
        ok: false,
        engine: 'browser-fallback',
        message: 'Test abgebrochen.'
      };
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const blob = await response.blob();
    if (myGeneration !== activeSpeechGeneration) {
      return {
        ok: false,
        engine: 'browser-fallback',
        message: 'Test abgebrochen.'
      };
    }

    const blobUrl = URL.createObjectURL(blob);
    activeBlobUrl = blobUrl;
    const audio = new Audio(blobUrl);
    activeAudio = audio;
    audio.onended = () => {
      if (myGeneration === activeSpeechGeneration) stopAllSpeech();
    };
    await audio.play();

    return {
      ok: true,
      engine: 'azure-gisela',
      message: 'Azure-Stimme „Gisela“ (de-DE-GiselaNeural) erfolgreich abgespielt.'
    };
  } catch (err: any) {
    window.clearTimeout(timeoutId);
    if (myGeneration !== activeSpeechGeneration) {
      return {
        ok: false,
        engine: 'browser-fallback',
        message: 'Test abgebrochen.'
      };
    }
    stopAllSpeech();
    const fallbackGen = activeSpeechGeneration;
    speakBrowserSynthesis(testPhrase, fallbackGen);
    const reason = timedOut ? 'Azure-Zeitüberschreitung' : err?.message || 'Azure-Verbindungsfehler';
    return {
      ok: false,
      engine: 'browser-fallback',
      message: `Browser-Fallback aktiv (${reason}).`
    };
  }
}
