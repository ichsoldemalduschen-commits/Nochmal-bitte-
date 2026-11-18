import { AppStateSnapshot, Project, TaskItem } from '../types';
import { triggerHapticFeedback } from './aiRouter';

const CLOUD_CONFIG_KEY = 'banditos_cloud_sync_config_v4';
const FIRED_REMINDERS_KEY = 'banditos_fired_reminders_v4';

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
  workspaceId: 'pizza-bandit-main',
  autoSyncOnChange: true,
  lastSyncedAt: null
};

export function loadCloudConfig(): CloudSyncConfig {
  try {
    const raw = localStorage.getItem(CLOUD_CONFIG_KEY);
    return raw ? { ...DEFAULT_CLOUD_CONFIG, ...JSON.parse(raw) } : DEFAULT_CLOUD_CONFIG;
  } catch {
    return DEFAULT_CLOUD_CONFIG;
  }
}

export function saveCloudConfig(cfg: CloudSyncConfig): void {
  try {
    localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(cfg));
  } catch {
    // ignore
  }
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
      workspaceId: cfg.workspaceId || 'pizza-bandit-main',
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

export function buildGoogleCalendarTemplateUrl(
  task: TaskItem,
  projectName: string
): string {
  const now = new Date();
  const [hours, minutes] = (task.reminderAt || '09:00')
    .split(':')
    .map((n) => parseInt(n, 10) || 0);

  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hours || 9,
    minutes || 0,
    0
  );
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

  let firedMap: Record<string, boolean> = {};
  try {
    firedMap = JSON.parse(localStorage.getItem(FIRED_REMINDERS_KEY) || '{}');
  } catch {
    firedMap = {};
  }

  for (const proj of projects) {
    if (proj.archived) continue;
    for (const task of proj.tasks) {
      if (task.completed || !task.reminderAt) continue;
      if (task.reminderAt.trim() === currentHHMM) {
        const uniqueKey = `${dateKey}_${proj.id}_${task.id}_${currentHHMM}`;
        if (firedMap[uniqueKey]) continue;

        firedMap[uniqueKey] = true;
        localStorage.setItem(FIRED_REMINDERS_KEY, JSON.stringify(firedMap));

        const text = `Erinnerung (${currentHHMM} Uhr) – ${proj.name}: ${task.title}`;
        triggerHapticFeedback([30, 60, 40]);
        onReminderTriggered(text);

        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification(`BANDIT.OS • ${proj.name}`, {
              body: task.title,
              icon: '/pwa-192x192.png'
            });
          } catch {
            // ignore
          }
        }
      }
    }
  }
}
