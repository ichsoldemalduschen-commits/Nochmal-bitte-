/**
 * Zentrale Timing- & Schwellenwert-Konstanten für Sprach-KI, UI-Feedback und Hintergrund-Polling.
 */
export const VOICE_START_DEBOUNCE_MS = 280;
export const TTS_ECHO_COOLDOWN_MS = 300;
export const TTS_PLAYBACK_WATCHDOG_MIN_MS = 12000;
export const STT_ABORT_RETRY_DELAY_MS = 350;
export const STT_MAX_CONSECUTIVE_ABORTS = 3;
export const API_TIMEOUT_FLASH_MS = 12000;
export const API_TIMEOUT_PRO_MS = 25000;
export const API_TIMEOUT_MS = API_TIMEOUT_FLASH_MS;
export const SILENCE_QUICK_MS = 2800;
export const SILENCE_COLLECT_MS = 5500;
export const SILENCE_DIALOG_MS = 3800;
export const REMINDER_POLL_INTERVAL_MS = 30000;
export const CHECK_GLOW_MS = 450;
export const UNDO_TOAST_MS = 4000;
