import { AiVoiceSettings } from '../types';
import { getActiveBrandMeta } from '../config/brandConfig';
import { TTS_PLAYBACK_WATCHDOG_MIN_MS } from '../config/runtimeConfig';
import {
  getAzureSpeechKey,
  getAzureSpeechRegion,
  getTtsEnabled,
  getVoiceProvider,
  loadUserPrefs
} from './storage';

let sharedAudioElement: HTMLAudioElement | null = null;
let speechSynthesisUnlocked = false;
let activeAudio: HTMLAudioElement | null = null;
let activeBlobUrl: string | null = null;
let activeAbortController: AbortController | null = null;
let activePlaybackWatchdogId: number | null = null;
let activeSpeechGeneration = 0;
let activeFinishCallback: ((completedNaturally: boolean) => void) | null = null;

const AZURE_TTS_TIMEOUT_MS = 4500;
const SILENT_AUDIO_DATA_URI =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

function getSharedAudioElement(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null;
  if (!sharedAudioElement) {
    sharedAudioElement = new Audio();
    sharedAudioElement.preload = 'auto';
    (sharedAudioElement as any).playsInline = true;
  }
  return sharedAudioElement;
}

function clearPlaybackWatchdog(): void {
  if (activePlaybackWatchdogId !== null && typeof window !== 'undefined') {
    window.clearTimeout(activePlaybackWatchdogId);
    activePlaybackWatchdogId = null;
  }
}

function computePlaybackWatchdogMs(text: string): number {
  return Math.max(TTS_PLAYBACK_WATCHDOG_MIN_MS, Math.min(45000, text.length * 140));
}

/**
 * Synchroner Mobile-Audio-Unlock für Android Chrome & iOS Safari:
 * Spielt im direkten User-Tap eine winzige stille Data-URI auf dem wiederverwendbaren
 * `sharedAudioElement` an und weckt bei Bedarf `window.speechSynthesis` still auf.
 */
export function unlockAudioPlayback(): void {
  const audio = getSharedAudioElement();
  const unlockGen = activeSpeechGeneration;

  if (audio && !activeFinishCallback) {
    try {
      audio.muted = true;
      audio.src = SILENT_AUDIO_DATA_URI;
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise
          .then(() => {
            if (activeSpeechGeneration === unlockGen && !activeFinishCallback) {
              try {
                audio.pause();
                audio.currentTime = 0;
              } catch {
                // ignore
              }
              audio.muted = false;
            }
          })
          .catch(() => {
            if (activeSpeechGeneration === unlockGen && !activeFinishCallback) {
              audio.muted = false;
            }
          });
      } else {
        try {
          audio.pause();
          audio.currentTime = 0;
        } catch {
          // ignore
        }
        audio.muted = false;
      }
    } catch {
      try {
        audio.muted = false;
      } catch {
        // ignore
      }
    }
  }

  if (!speechSynthesisUnlocked && typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
        const silentUtter = new SpeechSynthesisUtterance('');
        silentUtter.volume = 0;
        silentUtter.rate = 10;
        window.speechSynthesis.speak(silentUtter);
      }
      window.speechSynthesis.getVoices?.();
      speechSynthesisUnlocked = true;
    } catch {
      // ignore
    }
  }
}

function releasePlaybackResources(): void {
  clearPlaybackWatchdog();

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
      activeAudio.muted = false;
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

/**
 * Zentrale Audio-Sperre:
 * Bricht sowohl laufende Azure-TTS-Requests, aktive Audio-Elemente inkl. ObjectURL
 * als auch window.speechSynthesis sofort und restlos ab.
 * Löst eine eventuell noch wartende speakText()-Promise sauber mit `false` (abgebrochen) auf.
 */
export function stopAllSpeech(): void {
  activeSpeechGeneration += 1;
  const finish = activeFinishCallback;
  activeFinishCallback = null;
  releasePlaybackResources();
  if (finish) {
    finish(false);
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
  finish: (completedNaturally: boolean) => void
): void {
  if (generation !== activeSpeechGeneration) {
    finish(false);
    return;
  }
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    finish(false);
    return;
  }
  try {
    clearPlaybackWatchdog();
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

    const watchdogMs = computePlaybackWatchdogMs(cleanText);
    activePlaybackWatchdogId = window.setTimeout(() => {
      if (generation !== activeSpeechGeneration) return;
      activePlaybackWatchdogId = null;
      activeSpeechGeneration += 1;
      if (activeFinishCallback === finish) activeFinishCallback = null;
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
      finish(true);
    }, watchdogMs);

    utter.onend = () => {
      if (generation !== activeSpeechGeneration) return;
      clearPlaybackWatchdog();
      if (activeFinishCallback === finish) activeFinishCallback = null;
      activeSpeechGeneration += 1;
      finish(true);
    };
    utter.onerror = () => {
      if (generation !== activeSpeechGeneration) return;
      clearPlaybackWatchdog();
      if (activeFinishCallback === finish) activeFinishCallback = null;
      activeSpeechGeneration += 1;
      finish(false);
    };
    window.speechSynthesis.speak(utter);
  } catch {
    clearPlaybackWatchdog();
    if (generation === activeSpeechGeneration) {
      if (activeFinishCallback === finish) activeFinishCallback = null;
      finish(false);
    }
  }
}

/**
 * Zentrale Sprachausgabe der App mit verbindlicher Stimmen-Auflösungskette:
 * 1. Bei gewähltem Provider 'azure-gisela' + hinterlegtem Key & Region → zwingend Azure de-DE-GiselaNeural.
 * 2. Nur bei fehlendem Key/Region, Offline-Status, HTTP-Fehler oder Azure-Timeout greift der lokale
 *    Browser-Fallback und meldet den Grund über onEngineUsed('browser-fallback', reason),
 *    OHNE die gespeicherte Benutzer-Auswahl zu überschreiben.
 *
 * Das zurückgegebene Promise (und `onEnd`) löst erst exakt dann auf, wenn die Audio-Wiedergabe
 * bzw. Browser-Sprachausgabe wirklich beendet wurde:
 * - `true`: regulär bis zum Ende gesprochen
 * - `false`: vorzeitig abgebrochen (z. B. über `stopAllSpeech()`) oder nicht gestartet/gescheitert
 */
export function speakText(
  text: string,
  onEnd?: (completedNaturally: boolean) => void,
  onEngineUsed?: (engine: 'azure-gisela' | 'browser-fallback', fallbackReason?: string) => void,
  settingsOverride?: Partial<AiVoiceSettings>
): Promise<boolean> {
  // 1. Zuerst jede laufende Sprachausgabe hart abbrechen
  stopAllSpeech();
  const myGeneration = activeSpeechGeneration;

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (completedNaturally: boolean) => {
      if (settled) return;
      settled = true;
      if (activeFinishCallback === finish) {
        activeFinishCallback = null;
      }
      onEnd?.(completedNaturally);
      resolve(completedNaturally);
    };
    activeFinishCallback = finish;

    const ttsEnabled = settingsOverride?.ttsEnabled ?? getTtsEnabled();
    if (!ttsEnabled) {
      finish(false);
      return;
    }

    const clean = text.replace(/[*#_`~]/g, '').trim();
    if (!clean) {
      finish(false);
      return;
    }

    const voiceProvider = settingsOverride?.voiceProvider ?? getVoiceProvider();
    const key = (settingsOverride?.azureSpeechKey ?? getAzureSpeechKey()).trim();
    const region = (settingsOverride?.azureSpeechRegion ?? getAzureSpeechRegion()).trim().toLowerCase();
    const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;

    // Nutzer hat explizit Browser-Stimme gewählt
    if (voiceProvider === 'browser') {
      onEngineUsed?.('browser-fallback');
      speakBrowserSynthesis(clean, myGeneration, finish);
      return;
    }

    // Gisela (Azure Neural) ist gewählt, aber Credentials fehlen oder Gerät ist offline
    if (!key || !region) {
      onEngineUsed?.('browser-fallback', 'Azure-Key oder Region fehlt');
      speakBrowserSynthesis(clean, myGeneration, finish);
      return;
    }

    if (isOffline) {
      onEngineUsed?.('browser-fallback', 'Gerät ist offline');
      speakBrowserSynthesis(clean, myGeneration, finish);
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

    const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
    void fetch(endpoint, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': getActiveBrandMeta(loadUserPrefs().starterProfile).appName
      },
      body: ssml,
      signal: controller.signal
    })
      .then(async (response) => {
        window.clearTimeout(timeoutId);

        if (myGeneration !== activeSpeechGeneration) {
          finish(false);
          return;
        }

        if (!response.ok) {
          throw new Error(`Azure HTTP ${response.status}`);
        }

        const blob = await response.blob();
        if (myGeneration !== activeSpeechGeneration || activeAbortController !== controller) {
          finish(false);
          return;
        }

        const blobUrl = URL.createObjectURL(blob);
        activeBlobUrl = blobUrl;
        const audio = getSharedAudioElement();
        if (!audio) {
          throw new Error('Audio-Element nicht verfügbar');
        }
        audio.onended = null;
        audio.onerror = null;
        audio.pause();
        audio.muted = false;
        audio.src = blobUrl;
        audio.currentTime = 0;
        activeAudio = audio;

        audio.onended = () => {
          if (myGeneration !== activeSpeechGeneration) return;
          activeSpeechGeneration += 1;
          activeFinishCallback = null;
          releasePlaybackResources();
          finish(true);
        };

        audio.onerror = () => {
          if (myGeneration !== activeSpeechGeneration) return;
          activeSpeechGeneration += 1;
          releasePlaybackResources();
          const fallbackGen = activeSpeechGeneration;
          activeFinishCallback = finish;
          onEngineUsed?.('browser-fallback', 'Azure-Audio nicht abspielbar');
          speakBrowserSynthesis(clean, fallbackGen, finish);
        };

        await audio.play();
        if (myGeneration !== activeSpeechGeneration) {
          finish(false);
          return;
        }
        onEngineUsed?.('azure-gisela');

        clearPlaybackWatchdog();
        const watchdogMs = computePlaybackWatchdogMs(clean);
        activePlaybackWatchdogId = window.setTimeout(() => {
          if (myGeneration !== activeSpeechGeneration) return;
          activePlaybackWatchdogId = null;
          activeSpeechGeneration += 1;
          activeFinishCallback = null;
          releasePlaybackResources();
          finish(true);
        }, watchdogMs);
      })
      .catch((err: any) => {
        window.clearTimeout(timeoutId);
        // Wenn durch stopAllSpeech() extern abgebrochen wurde (z.B. Modal geschlossen oder neuer Aufruf),
        // KEINEN Browser-Fallback mehr starten!
        if (myGeneration !== activeSpeechGeneration) {
          finish(false);
          return;
        }

        activeSpeechGeneration += 1;
        releasePlaybackResources();
        const fallbackGen = activeSpeechGeneration;
        activeFinishCallback = finish;
        const reason = timedOut
          ? 'Azure-Zeitüberschreitung'
          : err?.message || 'Azure-Verbindungsfehler';
        onEngineUsed?.('browser-fallback', reason);
        speakBrowserSynthesis(clean, fallbackGen, finish);
      });
  });
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
  unlockAudioPlayback();
  const myGeneration = activeSpeechGeneration;
  const testPhrase = 'Hallo! Ich bin Gisela. Dein System ist einsatzbereit.';
  const cleanKey = apiKey.trim();
  const cleanRegion = region.trim().toLowerCase();

  if (!cleanKey || !cleanRegion) {
    speakBrowserSynthesis(testPhrase, myGeneration, () => {});
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
        'User-Agent': getActiveBrandMeta(loadUserPrefs().starterProfile).appName
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
    const audio = getSharedAudioElement();
    if (!audio) {
      throw new Error('Audio-Element nicht verfügbar');
    }
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    audio.muted = false;
    audio.src = blobUrl;
    audio.currentTime = 0;
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
    speakBrowserSynthesis(testPhrase, fallbackGen, () => {});
    const reason = timedOut ? 'Azure-Zeitüberschreitung' : err?.message || 'Azure-Verbindungsfehler';
    return {
      ok: false,
      engine: 'browser-fallback',
      message: `Browser-Fallback aktiv (${reason}).`
    };
  }
}
