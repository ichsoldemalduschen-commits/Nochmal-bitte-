import { OfflineAudioMemo } from '../types';

export const OFFLINE_AUDIO_MAX_BYTES = 1_500_000;
export const OFFLINE_AUDIO_MAX_DURATION_SEC = 60;

export interface OfflineRecordingResult {
  ok: boolean;
  audioDataUrl?: string;
  mimeType: string;
  durationSec: number;
  error?: string;
}

export interface ActiveAudioRecorderSession {
  stop: () => Promise<OfflineRecordingResult>;
}

export function isMediaRecorderSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof window.MediaRecorder !== 'undefined'
  );
}

function selectSupportedAudioMimeType(): string {
  if (typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined') {
    return 'audio/webm';
  }
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  for (const mime of candidates) {
    try {
      if (typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(mime)) {
        return mime;
      }
    } catch {
      // ignore
    }
  }
  return '';
}

export async function blobToBoundedDataUrl(
  blob: Blob,
  maxBytes = OFFLINE_AUDIO_MAX_BYTES
): Promise<{ ok: boolean; dataUrl?: string; error?: string }> {
  if (blob.size > maxBytes) {
    return {
      ok: false,
      error: `Aufnahme ist größer als ${Math.round(maxBytes / 1024)} KB – bitte kürzer fassen.`
    };
  }
  return new Promise((resolve) => {
    try {
      const reader = new FileReader();
      reader.onload = () => {
        const res = typeof reader.result === 'string' ? reader.result : '';
        if (!res) {
          resolve({ ok: false, error: 'Audio-Daten konnten nicht gelesen werden.' });
          return;
        }
        resolve({ ok: true, dataUrl: res });
      };
      reader.onerror = () => {
        resolve({ ok: false, error: 'Audio-Konvertierung fehlgeschlagen.' });
      };
      reader.readAsDataURL(blob);
    } catch {
      resolve({ ok: false, error: 'Audio-Speicherung im Browser nicht unterstützt.' });
    }
  });
}

export async function startOfflineAudioRecording(
  onTick?: (elapsedSec: number) => void,
  onAutoLimitStop?: (result: OfflineRecordingResult) => void
): Promise<{ ok: boolean; session?: ActiveAudioRecorderSession; error?: string }> {
  if (!isMediaRecorderSupported()) {
    return {
      ok: false,
      error: 'Mikrofon-Aufnahme im Browser nicht verfügbar – nutze die Funkloch-Notiz.'
    };
  }

  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    return {
      ok: false,
      error: 'Mikrofonzugriff abgelehnt oder nicht vorhanden – nutze die Funkloch-Notiz.'
    };
  }

  const preferredMime = selectSupportedAudioMimeType();
  let recorder: MediaRecorder;
  try {
    recorder = preferredMime
      ? new MediaRecorder(stream, { mimeType: preferredMime })
      : new MediaRecorder(stream);
  } catch {
    stream.getTracks().forEach((t) => t.stop());
    return {
      ok: false,
      error: 'Audio-Rekorder konnte nicht gestartet werden – nutze die Funkloch-Notiz.'
    };
  }

  const chunks: BlobPart[] = [];
  const startedAt = Date.now();
  let stopped = false;
  let totalBytes = 0;

  const releaseTracks = () => {
    try {
      stream?.getTracks().forEach((t) => t.stop());
    } catch {
      // ignore
    }
  };

  let tickTimer: number | null = null;

  const finalizeRecording = (): Promise<OfflineRecordingResult> => {
    return new Promise((resolve) => {
      const finish = async () => {
        if (tickTimer !== null) {
          window.clearInterval(tickTimer);
          tickTimer = null;
        }
        releaseTracks();
        const durationSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
        const mimeType = recorder.mimeType || preferredMime || 'audio/webm';
        const blob = new Blob(chunks, { type: mimeType });
        if (blob.size === 0) {
          resolve({
            ok: false,
            mimeType,
            durationSec,
            error: 'Keine Audiodaten aufgezeichnet.'
          });
          return;
        }
        const converted = await blobToBoundedDataUrl(blob, OFFLINE_AUDIO_MAX_BYTES);
        if (!converted.ok || !converted.dataUrl) {
          resolve({
            ok: false,
            mimeType,
            durationSec,
            error: converted.error || 'Audio konnte nicht gespeichert werden.'
          });
          return;
        }
        resolve({
          ok: true,
          audioDataUrl: converted.dataUrl,
          mimeType,
          durationSec
        });
      };

      if (recorder.state === 'inactive') {
        void finish();
        return;
      }

      recorder.onstop = () => {
        void finish();
      };

      try {
        recorder.stop();
      } catch {
        void finish();
      }
    });
  };

  recorder.ondataavailable = (ev: BlobEvent) => {
    if (ev.data && ev.data.size > 0) {
      chunks.push(ev.data);
      totalBytes += ev.data.size;
      if (totalBytes >= OFFLINE_AUDIO_MAX_BYTES * 0.92 && !stopped) {
        stopped = true;
        void finalizeRecording().then((res) => onAutoLimitStop?.(res));
      }
    }
  };

  tickTimer = window.setInterval(() => {
    const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    onTick?.(elapsed);
    if (elapsed >= OFFLINE_AUDIO_MAX_DURATION_SEC && !stopped) {
      stopped = true;
      void finalizeRecording().then((res) => onAutoLimitStop?.(res));
    }
  }, 400);

  try {
    recorder.start(500);
  } catch {
    if (tickTimer !== null) window.clearInterval(tickTimer);
    releaseTracks();
    return {
      ok: false,
      error: 'Aufnahme konnte nicht gestartet werden.'
    };
  }

  return {
    ok: true,
    session: {
      stop: async () => {
        if (stopped) {
          return {
            ok: false,
            mimeType: recorder.mimeType || 'audio/webm',
            durationSec: Math.max(1, Math.round((Date.now() - startedAt) / 1000))
          };
        }
        stopped = true;
        return finalizeRecording();
      }
    }
  };
}

export async function processOfflineAudioMemo(
  memo: OfflineAudioMemo,
  apiKey: string
): Promise<{ ok: boolean; transcript?: string; error?: string }> {
  const fallbackNote = (memo.noteText || memo.transcript || '').trim();
  const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine !== false;

  if (!isOnline) {
    return {
      ok: false,
      error: 'Noch kein Netz – Memo bleibt sicher gepuffert.'
    };
  }

  const cleanKey = (apiKey || '').trim();
  if (cleanKey && memo.audioDataUrl) {
    const [meta = '', base64Data = ''] = memo.audioDataUrl.split(',');
    const mimeMatch = meta.match(/data:(.*?);base64/);
    const mimeType = mimeMatch?.[1] || memo.mimeType || 'audio/webm';

    try {
      const endpoint =
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' +
        encodeURIComponent(cleanKey);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: 'Transkribiere diese deutsche Sprachmemo präzise und wortgetreu ohne Erklärungen oder Formatierung. Gib nur den reinen gesprochenen Text zurück.'
                },
                {
                  inlineData: {
                    mimeType,
                    data: base64Data
                  }
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.1
          }
        })
      });

      if (res.ok) {
        const data = await res.json();
        const text = String(data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
        if (text) {
          return { ok: true, transcript: text };
        }
      }
    } catch {
      // fallback below
    }
  }

  if (fallbackNote) {
    return { ok: true, transcript: fallbackNote };
  }

  if (!cleanKey) {
    return {
      ok: false,
      error: 'Kein Gemini API-Key hinterlegt – bitte Key in der Zentrale (KI) ergänzen.'
    };
  }

  return {
    ok: false,
    error: 'Audio-Transkription derzeit nicht möglich – bitte später erneut versuchen.'
  };
}
