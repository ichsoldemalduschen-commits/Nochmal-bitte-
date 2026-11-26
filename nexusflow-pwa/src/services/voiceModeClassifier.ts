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

const TRAILING_INCOMPLETE_WORD_REGEX =
  /(?:^|\s)(?:für|auf|im|in|an|bei|mit|von|zu|wegen|dass|weil|und|oder|aber|mal|noch|der|die|das|ein|eine|äh|ähm)[,.…\s]*$/i;

const DIALOG_SIGNAL_REGEX =
  /\b(was\s+meinst\s+du|ich\s+überlege|wie\s+sollen\s+wir|wie\s+würdest\s+du|kannst\s+du\s+mir|warum|wieso|soll\s+ich|lass\s+uns|erzähl\s+mal)\b/i;

const STANDALONE_QUICK_REGEX =
  /^(?:erledigt|abgehakt|stopp|fertig|pause|danke(?:,?\s*reicht)?)[.!]*$/i;

const PREFIX_QUICK_TRIGGER_REGEX =
  /\b(?:erinnere\s+mich(?:\s+an)?|notiere(?:\s+mir)?(?:\s+mal)?(?:\s+aufgabe)?|aufgabe|lösche|zeig\s+mir|hake\s+ab)\b/i;

const CART_TARGET_QUICK_REGEX =
  /\b(?:auf|in)\s+(?:den\s+)?einkauf(?:swagen)?\b/i;

function isCompleteQuickCommand(trimmed: string, words: string[]): boolean {
  if (words.length === 0 || words.length > 8) return false;
  if (TRAILING_INCOMPLETE_WORD_REGEX.test(trimmed)) return false;

  if (STANDALONE_QUICK_REGEX.test(trimmed)) return true;

  const prefixMatch = trimmed.match(PREFIX_QUICK_TRIGGER_REGEX);
  if (prefixMatch && prefixMatch.index !== undefined) {
    const afterTrigger = trimmed
      .slice(prefixMatch.index + prefixMatch[0].length)
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (afterTrigger.length >= 2) return true;
  }

  const cartMatch = trimmed.match(CART_TARGET_QUICK_REGEX);
  if (cartMatch && cartMatch.index !== undefined) {
    const beforeTrigger = trimmed.slice(0, cartMatch.index).trim().split(/\s+/).filter(Boolean);
    const afterTrigger = trimmed
      .slice(cartMatch.index + cartMatch[0].length)
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (beforeTrigger.length >= 2 || afterTrigger.length >= 2) return true;
  }

  return false;
}

/**
 * Klassifiziert laufende Spracheingaben heuristisch in Quick (2800 ms),
 * Dialog (3800 ms) oder Sammel-Modus (5500 ms), ohne sichtbare Modus-Buttons.
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

  // 2) Offener Satzanfang (z. B. "Notiere mal Aufgabe für"): niemals Quick abwürgen
  if (TRAILING_INCOMPLETE_WORD_REGEX.test(trimmed)) {
    return {
      mode: 'dialog',
      silenceTimeoutMs: SILENCE_DIALOG_MS
    };
  }

  // 3) Sabbel-/Dialog-Modus (3800 ms): offene Fragen / lautes Nachdenken
  if (trimmed.includes('?') || DIALOG_SIGNAL_REGEX.test(trimmed)) {
    return {
      mode: 'dialog',
      silenceTimeoutMs: SILENCE_DIALOG_MS
    };
  }

  const isHardQuickCommand = isCompleteQuickCommand(trimmed, words);

  // Laufenden Dialog nur bei hartem Quick-Befehl unterbrechen
  if (previousMode === 'dialog' && !isHardQuickCommand) {
    return {
      mode: 'dialog',
      silenceTimeoutMs: SILENCE_DIALOG_MS
    };
  }

  // 4) Quick-Befehl (2800 ms): kurzes, abgeschlossenes Aktionskommando mit Ziel/Objekt
  if (isHardQuickCommand) {
    return {
      mode: 'quick',
      silenceTimeoutMs: SILENCE_QUICK_MS
    };
  }

  // 5) Sicherer Fallback: lieber 3800 ms als zu frühes Abschneiden
  return {
    mode: 'dialog',
    silenceTimeoutMs: SILENCE_DIALOG_MS
  };
}
