import { DESIGN_TOKENS } from '../config/designTokens';
import { AppStateSnapshot, Project } from '../types';

function formatNeutralTimestamp(): string {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const y = now.getFullYear();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${d}.${m}.${y}, ${hh}:${mm} Uhr`;
}

/**
 * Prüft browser-sicher, ob das neutrale Open-Source-/BYOK-Starter-Profil
 * per Build-Umgebung (`VITE_STARTER_PROFILE=neutral`) oder URL (`?starter=neutral`) angefordert wurde.
 */
export function isNeutralStarterRequested(search?: string): boolean {
  try {
    const envProfile =
      typeof import.meta !== 'undefined' &&
      (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_STARTER_PROFILE;
    if (typeof envProfile === 'string' && envProfile.trim().toLowerCase() === 'neutral') {
      return true;
    }
  } catch {
    // Env-Zugriff außerhalb von Vite ignorieren
  }

  const queryString =
    typeof search === 'string'
      ? search
      : typeof window !== 'undefined'
        ? window.location.search
        : '';
  if (!queryString) return false;

  try {
    const params = new URLSearchParams(queryString);
    return params.get('starter')?.trim().toLowerCase() === 'neutral';
  } catch {
    return false;
  }
}

/**
 * Erzeugt genau 2 ruhige, komplett personenfreie Starter-Projekte (Arbeit & Privat).
 */
export function createNeutralStarterProjects(): Project[] {
  const ts = formatNeutralTimestamp();

  return [
    {
      id: 'proj-work',
      domain: 'business',
      businessDomain: 'business',
      lifecycle: 'permanent',
      name: 'Arbeit',
      subtitle: 'Projekte, Aufgaben & Einkäufe',
      icon: 'Briefcase',
      customLogoUrl: null,
      accentColor: DESIGN_TOKENS.projectPresets.pizzaBandit,
      archived: false,
      legalWatchEnabled: false,
      overviewEnabled: true,
      customMeta: {},
      enabledPlugins: [],
      enabledTabs: ['tasks', 'cart', 'knowledge', 'extras'],
      tasks: [
        {
          id: 'neutral-work-t1',
          title: 'Erste Aufgabe per Sprache diktieren',
          completed: false,
          priority: 'Mittel',
          estimatedMinutes: 5,
          dayBlock: null,
          reminderAt: '',
          aiTouched: false,
          lastModified: ts,
          changeReason: 'Neutrales Starter-Profil',
          source: 'Starter',
          customMeta: {}
        },
        {
          id: 'neutral-work-t2',
          title: 'Erste Projekt-Notiz oder Einkauf ergänzen',
          completed: false,
          priority: 'Niedrig',
          estimatedMinutes: 10,
          dayBlock: null,
          reminderAt: '',
          aiTouched: false,
          lastModified: ts,
          changeReason: 'Neutrales Starter-Profil',
          source: 'Starter',
          customMeta: {}
        }
      ],
      cart: [
        {
          id: 'neutral-work-c1',
          title: 'Notizblock A5 & Stifte',
          quantity: '1x',
          price: '',
          completed: false,
          aiTouched: false,
          lastModified: ts,
          changeReason: 'Neutrales Starter-Profil',
          source: 'Starter',
          customMeta: {}
        }
      ],
      knowledge: [
        {
          id: 'neutral-work-k1',
          kind: 'info',
          title: 'Schnellstart: Sprache, Einkauf & Zentrale',
          content: [
            '1. Unten über das Sechseck oder Mikrofon direkt Aufgaben, Einkäufe und Notizen einsprechen.',
            '2. Im Seitenmenü zwischen Arbeit, Privat, Einkaufswagen und Beleg-Scan wechseln.',
            '3. In der Zentrale (Menü → Zentrale) eigene API-Keys, Fokus-Helfer und Backups verwalten – alles bleibt 100 % lokal auf deinem Gerät.'
          ].join('\n'),
          attachments: [],
          lastModified: ts,
          changeReason: 'Neutrales Starter-Profil',
          source: 'Starter',
          aiTouched: false,
          customMeta: {}
        }
      ]
    },
    {
      id: 'proj-private',
      domain: 'private',
      businessDomain: 'private',
      lifecycle: 'permanent',
      name: 'Privat',
      subtitle: 'Alltag, Haushalt & Besorgungen',
      icon: 'Home',
      customLogoUrl: null,
      accentColor: DESIGN_TOKENS.projectPresets.privat,
      archived: false,
      legalWatchEnabled: false,
      overviewEnabled: true,
      customMeta: {},
      enabledPlugins: [],
      enabledTabs: ['tasks', 'cart', 'knowledge', 'extras'],
      tasks: [
        {
          id: 'neutral-priv-t1',
          title: 'Kurze Wochenplanung für zu Hause notieren',
          completed: false,
          priority: 'Mittel',
          estimatedMinutes: 10,
          dayBlock: null,
          reminderAt: '',
          aiTouched: false,
          lastModified: ts,
          changeReason: 'Neutrales Starter-Profil',
          source: 'Starter',
          customMeta: {}
        }
      ],
      cart: [
        {
          id: 'neutral-priv-c1',
          title: 'Hafermilch & Kaffeebohnen',
          quantity: '2x',
          price: '',
          completed: false,
          aiTouched: false,
          lastModified: ts,
          changeReason: 'Neutrales Starter-Profil',
          source: 'Starter',
          customMeta: {}
        }
      ],
      knowledge: []
    }
  ];
}

/**
 * Liefert ein valides Schema-v2-AppStateSnapshot mit den 2 neutralen Starter-Projekten.
 */
export function createNeutralStarterSnapshot(): AppStateSnapshot {
  return {
    schemaVersion: 2,
    projects: createNeutralStarterProjects(),
    aiLogs: [],
    selfChecks: [],
    eventSalesLogs: [],
    userApiKey: '',
    realityCheckEnabled: true,
    haWebhookUrl: '',
    haEmbedUrl: '',
    thumbHubEnabled: true,
    thumbHubPosition: 'center',
    ambientLightMode: 'shimmer',
    remindersEnabled: true
  };
}
