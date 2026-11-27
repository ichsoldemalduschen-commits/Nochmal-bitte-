/**
 * smartHomeBridge.ts – Gemeinsame, fehlerresistente Auslöse-Logik für Shelly & Home Assistant Schnellschalter.
 */
import { SmartHomeSwitchItem } from '../types';
import { formatNow } from './storage';

const SMART_HOME_TIMEOUT_MS = 4000;

/**
 * Löst eine volle URL oder einen relativen Webhook-Pfad (mit haWebhookUrl-Basis) sauber auf.
 */
export function resolveSmartHomeSwitchUrl(endpointUrl: string, haWebhookUrl?: string): string {
  const raw = String(endpointUrl || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;

  const base = String(haWebhookUrl || '').trim();
  if (!base || !/^https?:\/\//i.test(base)) return '';

  try {
    const parsedBase = new URL(base);
    if (raw.startsWith('/')) {
      return `${parsedBase.origin}${raw}`;
    }
    const cleanBase = base.endsWith('/') ? base : `${base}/`;
    return `${cleanBase}${raw}`;
  } catch {
    return '';
  }
}

export interface SmartHomeTriggerResult {
  ok: boolean;
  statusText: string;
  triggeredAt: string;
}

/**
 * Sendet einen Schaltimpuls mit 4s-Timeout und ruhigem no-cors-Fallback (ohne ungefangene Fehler).
 */
export async function triggerSmartHomeSwitch(
  item: SmartHomeSwitchItem,
  haWebhookUrl?: string
): Promise<SmartHomeTriggerResult> {
  const triggeredAt = formatNow();
  const targetUrl = resolveSmartHomeSwitchUrl(item.endpointUrl, haWebhookUrl);
  if (!targetUrl) {
    return {
      ok: false,
      statusText: 'Offline / Ziel nicht erreichbar',
      triggeredAt
    };
  }

  const method = item.method === 'GET' ? 'GET' : 'POST';

  const runFetch = async (mode?: RequestMode): Promise<boolean> => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), SMART_HOME_TIMEOUT_MS);
    try {
      const response = await fetch(targetUrl, {
        method,
        ...(mode ? { mode } : {}),
        signal: controller.signal
      });
      return response.ok || response.type === 'opaque';
    } finally {
      window.clearTimeout(timer);
    }
  };

  try {
    const ok = await runFetch();
    if (ok) {
      return { ok: true, statusText: 'Impuls gesendet', triggeredAt };
    }
  } catch {
    // Fallback auf no-cors für lokale Shelly-/HA-Endpunkte ohne CORS-Header
    try {
      const fallbackOk = await runFetch('no-cors');
      if (fallbackOk) {
        return { ok: true, statusText: 'Impuls gesendet', triggeredAt };
      }
    } catch {
      // Ruhig abfangen
    }
  }

  return {
    ok: false,
    statusText: 'Offline / Ziel nicht erreichbar',
    triggeredAt
  };
}

/**
 * Erzeugt neutrale TSA-Standardvorlagen ohne Dubletten gegenüber bestehenden Schaltern.
 */
export function buildTsaDefaultSwitches(
  existing: SmartHomeSwitchItem[]
): SmartHomeSwitchItem[] {
  const templates: SmartHomeSwitchItem[] = [
    {
      id: 'sw-tsa-arbeitslicht',
      label: 'TSA Arbeitslicht',
      endpointUrl: 'http://192.168.30.88/relay/0?turn=toggle',
      method: 'GET'
    },
    {
      id: 'sw-tsa-saladette',
      label: 'Saladette / Kühlung',
      endpointUrl: '/api/webhook/tsa_saladette_kuehlung',
      method: 'POST'
    }
  ];

  const existingLabels = new Set(existing.map((s) => s.label.trim().toLowerCase()));
  const additions = templates.filter((t) => !existingLabels.has(t.label.trim().toLowerCase()));
  return [...existing, ...additions];
}
