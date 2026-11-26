import {
  SILENCE_COLLECT_MS,
  SILENCE_DIALOG_MS,
  SILENCE_QUICK_MS
} from '../config/runtimeConfig';
import { VoiceInteractionMode } from '../types';

export interface LiveSpeechClassification {
  mode: VoiceInteractionMode;
  silenceTimeoutMs: number;
}

const COLLECT_SIGNAL_REGEX =
  /\b(und\s+dann|außerdem|noch|erstens|zweitens|ähm|äh|ach\s+ja|eins\s+noch|plus|sowie)\b/i;

const TRAILING_OPEN_WORD_REGEX = /(?:^|\s)(?:und|oder|aber|äh|ähm)[,.…\s]*$/i;

const DIALOG_SIGNAL_REGEX =
  /\b(was\s+meinst\s+du|ich\s+überlege|wie\s+sollen\s+wir|wie\s+würdest\s+du|kannst\s+du\s+mir|warum|wieso|soll\s+ich|lass\s+uns|erzähl\s+mal)\b/i;

const QUICK_COMMAND_REGEX =
  /\b(auf\s+(?:den\s+)?einkauf|in\s+(?:den\s+)?einkauf|hake\s+ab|erledigt|erinnere\s+mich|notiere|aufgabe|lösche|zeig\s+mir)\b/i;

/**
 * Klassifiziert laufende Spracheingaben heuristisch in Quick (2000 ms),
 * Dialog (3500 ms) oder Sammel-Modus (5500 ms), ohne sichtbare Modus-Buttons.
 */
export function classifyLiveSpeechIntent(
  transcript: string,
  previousMode?: VoiceInteractionMode | null,
  autoModeDetection = true
): LiveSpeechClassification {
  if (!autoModeDetection) {
    return {
      mode: 'collect',
      silenceTimeoutMs: SILENCE_COLLECT_MS
    };
  }

  const trimmed = String(transcript || '').trim();
  if (!trimmed) {
    return {
      mode: previousMode === 'quick' ? 'dialog' : previousMode || 'dialog',
      silenceTimeoutMs: SILENCE_DIALOG_MS
    };
  }

  const words = trimmed.split(/\s+/).filter(Boolean);

  // 1) Sammel-Modus (5500 ms): > 12 Wörter, Aufzählungs-/Nachdenk-Signale oder offenes Satzende
  if (
    words.length > 12 ||
    COLLECT_SIGNAL_REGEX.test(trimmed) ||
    TRAILING_OPEN_WORD_REGEX.test(trimmed)
  ) {
    return {
      mode: 'collect',
      silenceTimeoutMs: SILENCE_COLLECT_MS
    };
  }

  // 2) Sabbel-/Dialog-Modus (3500 ms): offene Fragen / lautes Nachdenken
  if (trimmed.includes('?') || DIALOG_SIGNAL_REGEX.test(trimmed)) {
    return {
      mode: 'dialog',
      silenceTimeoutMs: SILENCE_DIALOG_MS
    };
  }

  const isHardQuickCommand = words.length <= 8 && QUICK_COMMAND_REGEX.test(trimmed);

  // Laufenden Dialog nur bei hartem Quick-Befehl unterbrechen
  if (previousMode === 'dialog' && !isHardQuickCommand) {
    return {
      mode: 'dialog',
      silenceTimeoutMs: SILENCE_DIALOG_MS
    };
  }

  // 3) Quick-Befehl (2000 ms): kurzes, abgeschlossenes Aktionskommando
  if (isHardQuickCommand) {
    return {
      mode: 'quick',
      silenceTimeoutMs: SILENCE_QUICK_MS
    };
  }

  // 4) Sicherer Fallback: lieber 3500 ms als zu frühes Abschneiden
  return {
    mode: 'dialog',
    silenceTimeoutMs: SILENCE_DIALOG_MS
  };
}
