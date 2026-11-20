import { get, set } from 'idb-keyval';
import { AppStateSnapshot, KnowledgeItem, Project } from '../types';

export const IDB_STATE_KEY = 'nexusflow_pwa_v1_state';
export const LS_FALLBACK_KEY = 'nexusflow_pwa_v1_fallback';

export const STORAGE_KEYS = {
  STATE: IDB_STATE_KEY,
  USER_PREFS: 'banditos_user_prefs_v3',
  CLOUD_SYNC: 'banditos_cloud_sync_config_v4',
  PHOTO_PINS: 'banditos_photo_pins_v3',
  AI_CHAT: 'banditos_persistent_ai_chat_v3',
  BLUEPRINTS: 'banditos_blueprints_v3',
  AUDIT_WATCHLIST: 'banditos_auto_audit_watchlist_v4',
  AUDIT_SETTINGS: 'banditos_auto_audit_settings_v4',
  PREFERRED_MODEL: 'banditos_preferred_gemini_model',
  TTS_ENABLED: 'banditos_tts_enabled',
  AZURE_SPEECH_KEY: 'banditos_azure_speech_key_v1',
  AZURE_SPEECH_REGION: 'banditos_azure_speech_region_v1',
  ACTIVE_AI_MODE: 'banditos_active_ai_mode_v1',
  FIRED_REMINDERS: 'banditos_fired_reminders_v4'
} as const;

// In-Memory-Cache für verzögerungsfreie synchrone UI-Abfragen
const memoryCache = new Map<string, any>();

export const formatNow = (): string => {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const y = now.getFullYear();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${d}.${m}.${y}, ${hh}:${mm} Uhr`;
};

/**
 * Fordert beim App-Start persistente Speicherung an (Browser löscht PWA-Daten nicht bei Speicherknappheit)
 */
export async function requestStoragePersistence(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persist();
      return isPersisted;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Migriert bestehende `explanations` und `infos` verlustfrei zu einheitlichen `KnowledgeItem`s.
 */
export function normalizeProjectKnowledge(project: any): KnowledgeItem[] {
  const existingKnowledge: KnowledgeItem[] = Array.isArray(project.knowledge) ? [...project.knowledge] : [];
  const knownIds = new Set(existingKnowledge.map((k) => k.id));

  // Migriere alte Explanations
  if (Array.isArray(project.explanations)) {
    for (const exp of project.explanations) {
      if (!exp || !exp.id || knownIds.has(exp.id)) continue;
      knownIds.add(exp.id);
      existingKnowledge.push({
        id: exp.id,
        kind: 'explanation',
        title: exp.title || 'Ablauf',
        content: exp.stepsText || exp.content || '',
        attachments: [],
        lastModified: exp.lastModified || formatNow(),
        changeReason: exp.changeReason || 'Aus Abläufen migriert',
        source: exp.source || 'Ablauf',
        aiTouched: !!exp.aiTouched,
        customMeta: exp.customMeta || {}
      });
    }
  }

  // Migriere alte Infos
  if (Array.isArray(project.infos)) {
    for (const inf of project.infos) {
      if (!inf || !inf.id || knownIds.has(inf.id)) continue;
      knownIds.add(inf.id);
      existingKnowledge.push({
        id: inf.id,
        kind: 'info',
        title: inf.title || 'Info / Notiz',
        content: inf.content || '',
        attachments: Array.isArray(inf.attachments) ? inf.attachments : [],
        lastModified: inf.lastModified || formatNow(),
        changeReason: inf.changeReason || 'Aus Infos migriert',
        source: inf.source || 'Info',
        aiTouched: !!inf.aiTouched,
        customMeta: inf.customMeta || {}
      });
    }
  }

  return existingKnowledge;
}

/**
 * Normalisiert ein ganzes Projekt (inkl. knowledge & enabledTabs)
 */
export function normalizeProject(project: Project): Project {
  const knowledge = normalizeProjectKnowledge(project);
  const enabledTabs = Array.isArray(project.enabledTabs) && project.enabledTabs.length > 0
    ? project.enabledTabs
    : (['tasks', 'cart', 'knowledge', 'extras'] as ('tasks' | 'cart' | 'knowledge' | 'extras')[]);

  return {
    ...project,
    enabledTabs,
    knowledge,
    // Alte Arrays für eventuelle Abwärtskompatibilität als gespiegelte Kopien beibehalten
    explanations: knowledge
      .filter((k) => k.kind === 'explanation')
      .map((k) => ({
        id: k.id,
        title: k.title,
        stepsText: k.content,
        lastModified: k.lastModified,
        changeReason: k.changeReason,
        source: k.source,
        aiTouched: k.aiTouched,
        customMeta: k.customMeta
      })),
    infos: knowledge
      .filter((k) => k.kind !== 'explanation')
      .map((k) => ({
        id: k.id,
        title: k.title,
        content: k.content,
        attachments: k.attachments || [],
        lastModified: k.lastModified,
        changeReason: k.changeReason,
        source: k.source,
        aiTouched: k.aiTouched,
        customMeta: k.customMeta
      }))
  };
}

/**
 * Einmalige, stille Migration aller verstreuten localStorage-Schlüssel nach IndexedDB
 */
export async function migrateLocalStorageToIndexedDB(): Promise<void> {
  if (typeof window === 'undefined' || !window.localStorage) return;

  const keysToMigrate = [
    STORAGE_KEYS.USER_PREFS,
    STORAGE_KEYS.CLOUD_SYNC,
    STORAGE_KEYS.PHOTO_PINS,
    STORAGE_KEYS.AI_CHAT,
    STORAGE_KEYS.BLUEPRINTS,
    STORAGE_KEYS.AUDIT_WATCHLIST,
    STORAGE_KEYS.AUDIT_SETTINGS,
    STORAGE_KEYS.PREFERRED_MODEL,
    STORAGE_KEYS.TTS_ENABLED,
    STORAGE_KEYS.AZURE_SPEECH_KEY,
    STORAGE_KEYS.AZURE_SPEECH_REGION,
    STORAGE_KEYS.ACTIVE_AI_MODE,
    STORAGE_KEYS.FIRED_REMINDERS
  ];

  for (const key of keysToMigrate) {
    try {
      const existingIdb = await get(key);
      const rawLs = localStorage.getItem(key);

      if (rawLs !== null) {
        let parsed: any = rawLs;
        try {
          parsed = JSON.parse(rawLs);
        } catch {
          // Plain string
        }

        // Falls in IDB noch nichts liegt, übernimm den Wert aus localStorage
        if (existingIdb === undefined) {
          await set(key, parsed);
          memoryCache.set(key, parsed);
        } else {
          memoryCache.set(key, existingIdb);
        }
      } else if (existingIdb !== undefined) {
        memoryCache.set(key, existingIdb);
      }
    } catch {
      // Stille Migration – Fehler fangen und weiterfahren
    }
  }
}

/**
 * Universeller IDB-Getter mit Cache und Fallback
 */
export async function loadIdbItem<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const val = await get<T>(key);
    if (val !== undefined && val !== null) {
      memoryCache.set(key, val);
      return val;
    }
  } catch {
    // IDB get error
  }

  // Fallback auf Memory-Cache
  if (memoryCache.has(key)) {
    return memoryCache.get(key) as T;
  }

  // Fallback auf localStorage
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      try {
        const parsed = JSON.parse(raw) as T;
        memoryCache.set(key, parsed);
        // Hintergrund-Sync in IDB
        set(key, parsed).catch(() => {});
        return parsed;
      } catch {
        memoryCache.set(key, raw);
        set(key, raw).catch(() => {});
        return raw as unknown as T;
      }
    }
  } catch {
    // LS read error
  }

  memoryCache.set(key, defaultValue);
  return defaultValue;
}

/**
 * Universeller IDB-Setter mit Cache und localStorage-Backup
 */
export async function saveIdbItem<T>(key: string, value: T): Promise<void> {
  memoryCache.set(key, value);
  try {
    await set(key, value);
  } catch {
    // IDB write error
  }

  // Sekundäres Backup im localStorage für Offline/Fallback
  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    localStorage.setItem(key, serialized);
  } catch {
    // Quota reached
  }
}

/**
 * Synchrone Lese-Hilfe (greift auf Memory-Cache oder LocalStorage zu)
 */
export function getIdbItemSync<T>(key: string, defaultValue: T): T {
  if (memoryCache.has(key)) {
    return memoryCache.get(key) as T;
  }
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      try {
        const parsed = JSON.parse(raw) as T;
        memoryCache.set(key, parsed);
        return parsed;
      } catch {
        memoryCache.set(key, raw);
        return raw as unknown as T;
      }
    }
  } catch {
    // ignore
  }
  return defaultValue;
}

/**
 * Lädt den Haupt-Snapshot aus IDB und migriert alle Projekte automatisch
 */
export async function loadPersistedState(
  defaultSeed: AppStateSnapshot
): Promise<AppStateSnapshot> {
  try {
    const stored = await get<AppStateSnapshot>(IDB_STATE_KEY);
    if (stored && Array.isArray(stored.projects) && stored.projects.length > 0) {
      const normalizedProjects = stored.projects.map(normalizeProject);
      return {
        ...defaultSeed,
        ...stored,
        projects: normalizedProjects
      };
    }
  } catch {
    try {
      const raw = localStorage.getItem(LS_FALLBACK_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AppStateSnapshot;
        if (parsed && Array.isArray(parsed.projects)) {
          const normalizedProjects = parsed.projects.map(normalizeProject);
          return { ...defaultSeed, ...parsed, projects: normalizedProjects };
        }
      }
    } catch {
      // Fallback auf Seed
    }
  }

  const normalizedSeedProjects = defaultSeed.projects.map(normalizeProject);
  return { ...defaultSeed, projects: normalizedSeedProjects };
}

export async function savePersistedState(snapshot: AppStateSnapshot): Promise<void> {
  try {
    await set(IDB_STATE_KEY, snapshot);
  } catch {
    try {
      localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(snapshot));
    } catch {
      // Speicherlimit erreicht
    }
  }
}

export function downloadStateBackupJson(snapshot: AppStateSnapshot): void {
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
    type: 'application/json;charset=utf-8'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nexusflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export const migrateLocalStorageToIDB = migrateLocalStorageToIndexedDB;

export function getTtsEnabled(): boolean {
  return getIdbItemSync<boolean>(STORAGE_KEYS.TTS_ENABLED, true);
}

export function saveTtsEnabled(enabled: boolean): void {
  saveIdbItem(STORAGE_KEYS.TTS_ENABLED, enabled);
}

export function getAzureSpeechKey(): string {
  return getIdbItemSync<string>(STORAGE_KEYS.AZURE_SPEECH_KEY, '');
}

export function saveAzureSpeechKey(key: string): void {
  saveIdbItem(STORAGE_KEYS.AZURE_SPEECH_KEY, key);
}

export function getAzureSpeechRegion(): string {
  return getIdbItemSync<string>(STORAGE_KEYS.AZURE_SPEECH_REGION, 'germanywestcentral');
}

export function saveAzureSpeechRegion(region: string): void {
  saveIdbItem(STORAGE_KEYS.AZURE_SPEECH_REGION, region);
}

export function getActiveAiMode(): 'flash' | 'research' {
  return getIdbItemSync<'flash' | 'research'>(STORAGE_KEYS.ACTIVE_AI_MODE, 'flash');
}

export function saveActiveAiMode(mode: 'flash' | 'research'): void {
  saveIdbItem(STORAGE_KEYS.ACTIVE_AI_MODE, mode);
}
