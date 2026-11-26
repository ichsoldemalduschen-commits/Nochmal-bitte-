import { AppStateSnapshot, Project, ReminderRecurrence, TaskItem } from '../types';
import { triggerHapticFeedback } from './aiRouter';
import { BRAND_CONFIG } from '../config/brandConfig';
import { STORAGE_KEYS, getIdbItemSync, saveIdbItem } from './storage';

export interface CloudSyncConfig {
  enabled: boolean;
  endpointUrl: string; // Supabase REST / Firebase Realtime DB (.json) / Eigener Webhook
  apiKeyOrToken: string;
  workspaceId: string;
  autoSyncOnChange: boolean;
  lastSyncedAt: string | null;
}

export const DEFAULT_CLOUD_CONFIG: CloudSyncConfig = {
  enabled: false,
  endpointUrl: '',
  apiKeyOrToken: '',
  workspaceId: BRAND_CONFIG.defaultWorkspaceId,
  autoSyncOnChange: true,
  lastSyncedAt: null
};

export function loadCloudConfig(): CloudSyncConfig {
  return getIdbItemSync<CloudSyncConfig>(STORAGE_KEYS.CLOUD_SYNC, DEFAULT_CLOUD_CONFIG);
}

export function saveCloudConfig(cfg: CloudSyncConfig): void {
  saveIdbItem(STORAGE_KEYS.CLOUD_SYNC, cfg);
}

/**
 * Update 1: Echtzeit-Cloud-Sync (Push & Pull zwischen Galaxy Z Flip 7 und PC)
 */
export async function pushStateToCloud(
  state: AppStateSnapshot
): Promise<{ ok: boolean; message: string; timestamp?: string }> {
  const cfg = loadCloudConfig();
  if (!cfg.endpointUrl.trim()) {
    return { ok: false, message: 'Keine Cloud-Endpunkt-URL hinterlegt.' };
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (cfg.apiKeyOrToken.trim()) {
      headers['apikey'] = cfg.apiKeyOrToken.trim();
      headers['Authorization'] = `Bearer ${cfg.apiKeyOrToken.trim()}`;
    }

    const payload = {
      workspaceId: cfg.workspaceId || BRAND_CONFIG.defaultWorkspaceId,
      updatedAt: new Date().toISOString(),
      snapshot: state
    };

    const res = await fetch(cfg.endpointUrl.trim(), {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      return { ok: false, message: `Cloud-Push fehlgeschlagen (HTTP ${res.status}).` };
    }

    const nowStr = new Date().toLocaleString('de-DE');
    saveCloudConfig({ ...cfg, lastSyncedAt: nowStr });
    return { ok: true, message: `Synchronisiert (${nowStr})`, timestamp: nowStr };
  } catch (err: any) {
    return {
      ok: false,
      message: `Netzwerkfehler beim Cloud-Sync: ${err?.message || 'Offline'}`
    };
  }
}

export async function pullStateFromCloud(): Promise<{
  ok: boolean;
  snapshot?: AppStateSnapshot;
  message: string;
}> {
  const cfg = loadCloudConfig();
  if (!cfg.endpointUrl.trim()) {
    return { ok: false, message: 'Keine Cloud-Endpunkt-URL hinterlegt.' };
  }

  try {
    const headers: Record<string, string> = {
      Accept: 'application/json'
    };
    if (cfg.apiKeyOrToken.trim()) {
      headers['apikey'] = cfg.apiKeyOrToken.trim();
      headers['Authorization'] = `Bearer ${cfg.apiKeyOrToken.trim()}`;
    }

    const res = await fetch(cfg.endpointUrl.trim(), {
      method: 'GET',
      headers
    });

    if (!res.ok) {
      return { ok: false, message: `Cloud-Abruf fehlgeschlagen (HTTP ${res.status}).` };
    }

    const data = await res.json();
    const incoming: AppStateSnapshot | undefined = Array.isArray(data?.projects)
      ? data
      : data?.snapshot;

    if (!incoming || !Array.isArray(incoming.projects)) {
      return { ok: false, message: 'Keine gültigen BANDIT.OS Projektdaten in der Cloud gefunden.' };
    }

    const nowStr = new Date().toLocaleString('de-DE');
    saveCloudConfig({ ...cfg, lastSyncedAt: nowStr });
    return {
      ok: true,
      snapshot: incoming,
      message: `Cloud-Stand erfolgreich geladen (${nowStr}).`
    };
  } catch (err: any) {
    return {
      ok: false,
      message: `Verbindungsfehler beim Cloud-Abruf: ${err?.message || 'Offline'}`
    };
  }
}

/**
 * Update 3: 2-Wege-Kalender-Link & Native Smartphone Push-Erinnerungen
 */
export async function requestPushNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  const perm = await Notification.requestPermission();
  return perm === 'granted';
}

export function parseReminderDate(
  reminderAt?: string,
  referenceNow: Date = new Date()
): Date | null {
  const raw = (reminderAt || '').trim();
  if (!raw) return null;

  // Format 1: "HH:mm" (Seed-Daten ohne Datum -> heute)
  const hhmmMatch = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (hhmmMatch) {
    const h = parseInt(hhmmMatch[1], 10);
    const m = parseInt(hhmmMatch[2], 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return new Date(
        referenceNow.getFullYear(),
        referenceNow.getMonth(),
        referenceNow.getDate(),
        h,
        m,
        0,
        0
      );
    }
    return null;
  }

  // Format 2: "YYYY-MM-DDTHH:mm" (lokaler datetime-local Wert)
  const localMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (localMatch) {
    const y = parseInt(localMatch[1], 10);
    const mo = parseInt(localMatch[2], 10) - 1;
    const d = parseInt(localMatch[3], 10);
    const h = parseInt(localMatch[4], 10);
    const mi = parseInt(localMatch[5], 10);
    const s = localMatch[6] ? parseInt(localMatch[6], 10) : 0;
    const dt = new Date(y, mo, d, h, mi, s, 0);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  // Format 3: Vollständiger ISO-Timestamp mit Zeitzone
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function toLocalDateTimeInputValue(date: Date): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${mo}-${d}T${h}:${mi}`;
}

export function formatReminderBadge(reminderAt?: string): string {
  const dt = parseReminderDate(reminderAt);
  if (!dt) return '';
  const now = new Date();
  const isToday =
    dt.getFullYear() === now.getFullYear() &&
    dt.getMonth() === now.getMonth() &&
    dt.getDate() === now.getDate();
  const timePart = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
  if (isToday) return timePart;
  const datePart = `${String(dt.getDate()).padStart(2, '0')}.${String(dt.getMonth() + 1).padStart(2, '0')}.`;
  return `${datePart} ${timePart}`;
}

export function computeNextRecurrenceReminder(
  reminderAt: string,
  recurrence: ReminderRecurrence = 'none',
  now: Date = new Date()
): string {
  if (recurrence !== 'daily' && recurrence !== 'weekly') return reminderAt;
  const stepDays = recurrence === 'weekly' ? 7 : 1;
  const next = parseReminderDate(reminderAt, now) || new Date(now.getTime());
  do {
    next.setDate(next.getDate() + stepDays);
  } while (next.getTime() <= now.getTime());
  return toLocalDateTimeInputValue(next);
}

export function isReminderDueForWindow(task: TaskItem, now: Date = new Date()): boolean {
  if (task.completed || !task.reminderAt || !task.reminderAt.trim()) return false;
  const raw = task.reminderAt.trim();
  const isTimeOnly = /^\d{1,2}:\d{2}$/.test(raw);
  const dueDate = parseReminderDate(raw, now);
  if (!dueDate) return false;

  if (isTimeOnly) {
    // Seed-Zeiten ("HH:mm") nur im passenden 60-Sekunden-Fenster und max. 1x pro Tag auslösen
    const diffMs = now.getTime() - dueDate.getTime();
    if (diffMs < 0 || diffMs >= 60_000) return false;
    const todayPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (task.lastReminderFiredAt && task.lastReminderFiredAt.slice(0, 10) === todayPrefix) {
      return false;
    }
    return true;
  }

  // Expliziter YYYY-MM-DDTHH:mm oder ISO-Zeitstempel
  if (dueDate.getTime() > now.getTime()) return false;
  if (task.lastReminderFiredAt) {
    const firedDt = new Date(task.lastReminderFiredAt);
    if (!Number.isNaN(firedDt.getTime()) && firedDt.getTime() >= dueDate.getTime()) {
      return false;
    }
  }
  return true;
}

export async function triggerDesktopReminderNotification(
  projectName: string,
  taskTitle: string
): Promise<void> {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate([100, 50, 100]);
    } catch {
      // ignore
    }
  }

  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const title = `BANDIT.OS • ${projectName}`;
  const options: NotificationOptions = {
    body: taskTitle,
    icon: './pwa-192x192.png'
  };

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(title, options);
        return;
      }
    }
  } catch {
    // fallback to Notification API
  }

  try {
    new Notification(title, options);
  } catch {
    // ignore
  }
}

export function buildGoogleCalendarTemplateUrl(
  task: TaskItem,
  projectName: string
): string {
  const now = new Date();
  const parsed = parseReminderDate(task.reminderAt, now);
  const start =
    parsed ||
    new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0);
  const durationMs = (task.estimatedMinutes || 30) * 60 * 1000;
  const end = new Date(start.getTime() + durationMs);

  const fmt = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `[${projectName}] ${task.title}`,
    details: `BANDIT.OS Projekt: ${projectName}\nPriorität: ${task.priority}\nGeplante Dauer: ${
      task.estimatedMinutes || 30
    } Min.`,
    dates: `${fmt(start)}/${fmt(end)}`
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function checkAndFireDueReminders(
  projects: Project[],
  onReminderTriggered: (msg: string) => void
): void {
  if (typeof window === 'undefined') return;

  const now = new Date();
  const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes()
  ).padStart(2, '0')}`;
  const dateKey = now.toISOString().slice(0, 10);

  const firedMap = getIdbItemSync<Record<string, boolean>>(STORAGE_KEYS.FIRED_REMINDERS, {});

  for (const proj of projects) {
    if (proj.archived) continue;
    for (const task of proj.tasks) {
      if (!isReminderDueForWindow(task, now)) continue;
      const uniqueKey = `${dateKey}_${proj.id}_${task.id}_${task.reminderAt.trim()}`;
      if (firedMap[uniqueKey]) continue;

      firedMap[uniqueKey] = true;
      saveIdbItem(STORAGE_KEYS.FIRED_REMINDERS, firedMap);

      const badge = formatReminderBadge(task.reminderAt) || currentHHMM;
      const text = `Erinnerung (${badge} Uhr) – ${proj.name}: ${task.title}`;
      triggerHapticFeedback([30, 60, 40]);
      onReminderTriggered(text);
      void triggerDesktopReminderNotification(proj.name, task.title);
    }
  }
}
