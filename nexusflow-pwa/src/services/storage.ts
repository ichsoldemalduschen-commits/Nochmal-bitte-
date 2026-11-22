import { get, set } from 'idb-keyval';
import {
  AmbientLightMode,
  AppStateSnapshot,
  KnowledgeItem,
  Project,
  PizzaCatalogItem,
  PosPizzaSlot,
  DoughCalcDefaults,
  FullBackupV2,
  BackupImportResult,
  ProjectImportResult,
  TaskItem,
  CartItem,
  PriorityType,
  DayBlockId,
  KnowledgeKind
} from '../types';

export type { FullBackupV2, BackupImportResult, ProjectImportResult };

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
  FIRED_REMINDERS: 'banditos_fired_reminders_v4',
  THUMB_HUB_ENABLED: 'banditos_thumb_hub_enabled_v1',
  THUMB_HUB_POSITION: 'banditos_thumb_hub_position_v1',
  AMBIENT_LIGHT_MODE: 'banditos_ambient_light_mode_v1',
  SCANNED_RECEIPTS: 'banditos_scanned_receipts_v1',
  SAVED_DOSSIERS: 'banditos_saved_dossiers_v1'
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
 * Normalisiert ein ganzes Projekt (inkl. knowledge & enabledTabs & neue lifecycle/businessDomain-Felder)
 */
export function normalizeProject(project: Project): Project {
  const knowledge = normalizeProjectKnowledge(project);
  const enabledTabs = Array.isArray(project.enabledTabs) && project.enabledTabs.length > 0
    ? project.enabledTabs
    : (['tasks', 'cart', 'knowledge', 'extras'] as ('tasks' | 'cart' | 'knowledge' | 'extras')[]);

  // Abwärtskompatible Defaults für neue Felder
  const rawDomain = (project as any).domain;
  const domain = (rawDomain === 'privat' || rawDomain === 'private') ? 'private' : 'business';
  const lifecycle = (project as any).lifecycle ?? (project.id === 'proj-baeckerei' ? 'project' : 'permanent');
  const businessDomain = (project as any).businessDomain ?? (domain === 'private' ? 'private' : 'business');
  const archived = typeof project.archived === 'boolean' ? project.archived : false;
  const legalWatchEnabled = typeof (project as any).legalWatchEnabled === 'boolean'
    ? (project as any).legalWatchEnabled
    : (domain === 'business');
  const overviewEnabled = typeof (project as any).overviewEnabled === 'boolean'
    ? (project as any).overviewEnabled
    : true;

  return {
    ...project,
    domain,
    lifecycle,
    businessDomain,
    archived,
    legalWatchEnabled,
    overviewEnabled,
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
    STORAGE_KEYS.FIRED_REMINDERS,
    STORAGE_KEYS.THUMB_HUB_ENABLED,
    STORAGE_KEYS.THUMB_HUB_POSITION,
    STORAGE_KEYS.AMBIENT_LIGHT_MODE,
    STORAGE_KEYS.SCANNED_RECEIPTS,
    STORAGE_KEYS.SAVED_DOSSIERS
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
        thumbHubEnabled: typeof (stored as any).thumbHubEnabled === 'boolean' ? (stored as any).thumbHubEnabled : true,
        thumbHubPosition: (stored as any).thumbHubPosition || 'center',
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
          return {
            ...defaultSeed,
            ...parsed,
            thumbHubEnabled: typeof (parsed as any).thumbHubEnabled === 'boolean' ? (parsed as any).thumbHubEnabled : true,
            thumbHubPosition: (parsed as any).thumbHubPosition || 'center',
            projects: normalizedProjects
          };
        }
      }
    } catch {
      // Fallback auf Seed
    }
  }

  const normalizedSeedProjects = defaultSeed.projects.map(normalizeProject);
  return {
    ...defaultSeed,
    thumbHubEnabled: true,
    thumbHubPosition: 'center',
    projects: normalizedSeedProjects
  };
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

/**
 * Exportiert ein einzelnes Projekt als JSON-Download
 */
export function downloadProjectJson(project: Project): void {
  const blob = new Blob([JSON.stringify(project, null, 2)], {
    type: 'application/json;charset=utf-8'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = project.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  a.download = `projekt-${safeName}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

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

export function getThumbHubEnabled(): boolean {
  return getIdbItemSync<boolean>(STORAGE_KEYS.THUMB_HUB_ENABLED, true);
}

export function saveThumbHubEnabled(enabled: boolean): void {
  saveIdbItem(STORAGE_KEYS.THUMB_HUB_ENABLED, enabled);
}

export function getThumbHubPosition(): 'left' | 'center' | 'right' {
  return getIdbItemSync<'left' | 'center' | 'right'>(STORAGE_KEYS.THUMB_HUB_POSITION, 'center');
}

export function saveThumbHubPosition(pos: 'left' | 'center' | 'right'): void {
  saveIdbItem(STORAGE_KEYS.THUMB_HUB_POSITION, pos);
}

export function loadAmbientLightMode(): AmbientLightMode {
  return getIdbItemSync<AmbientLightMode>(STORAGE_KEYS.AMBIENT_LIGHT_MODE, 'shimmer');
}

export function saveAmbientLightMode(mode: AmbientLightMode): void {
  saveIdbItem(STORAGE_KEYS.AMBIENT_LIGHT_MODE, mode);
}

export interface SavedScannedReceipt {
  id: string;
  projectId: string;
  projectName: string;
  storeName: string;
  purchaseDate: string;
  totalAmount: string;
  items: Array<{ title: string; quantity: string; price: string }>;
  createdAt: string;
  reconciled?: boolean;
}

export interface SavedDossierItem {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  markdownContent: string;
  sources: Array<{ title: string; url: string }>;
  followUpTasks: string[];
  createdAt: string;
  modelUsed?: string;
}

export function loadScannedReceipts(): SavedScannedReceipt[] {
  return getIdbItemSync<SavedScannedReceipt[]>(STORAGE_KEYS.SCANNED_RECEIPTS, []);
}

export function saveScannedReceipts(receipts: SavedScannedReceipt[]): void {
  saveIdbItem(STORAGE_KEYS.SCANNED_RECEIPTS, receipts);
}

export function loadSavedDossiers(): SavedDossierItem[] {
  return getIdbItemSync<SavedDossierItem[]>(STORAGE_KEYS.SAVED_DOSSIERS, []);
}

export function saveSavedDossiers(dossiers: SavedDossierItem[]): void {
  saveIdbItem(STORAGE_KEYS.SAVED_DOSSIERS, dossiers);
}

// ── Pizza-Katalog & POS-Slots (Paket 3) ─────────────────────────────────────

export const PIZZA_CATALOG_KEY = 'banditos_pizza_catalog_v1';
export const POS_SLOTS_KEY = 'banditos_pos_slots_v1';
export const DOUGH_CALC_DEFAULTS_KEY = 'banditos_dough_calc_defaults_v1';

/** Standard-Stammdaten für den Erststart */
export const DEFAULT_PIZZA_CATALOG: PizzaCatalogItem[] = [
  {
    id: 'cat-marg',
    title: 'Margherita Klassik',
    price: 11.5,
    portionScope: 'Ø 30 cm · 250g Teig',
    doughWeightGrams: 250,
    unitCost: 2.65
  },
  {
    id: 'cat-salami',
    title: 'Salami Bandit',
    price: 13.0,
    portionScope: 'Ø 30 cm · 265g Teig',
    doughWeightGrams: 265,
    unitCost: 3.1
  },
  {
    id: 'cat-truffel',
    title: 'Spezial / Trüffel',
    price: 16.5,
    portionScope: 'Ø 32 cm · 280g Teig',
    doughWeightGrams: 280,
    unitCost: 4.2
  },
  {
    id: 'cat-mini',
    title: 'Mini / Kids',
    price: 7.5,
    portionScope: 'Ø 24 cm · 180g Teig',
    doughWeightGrams: 180,
    unitCost: 1.9
  },
  {
    id: 'cat-diav',
    title: 'Diavola Piccante',
    price: 13.5,
    portionScope: 'Ø 30 cm · 265g Teig',
    doughWeightGrams: 265,
    unitCost: 3.35
  }
];

/** Standard-Slots für den POS-Clicker (3 Slots) */
export function buildDefaultPosSlots(catalog: PizzaCatalogItem[]): PosPizzaSlot[] {
  const sources = [catalog[0], catalog[1], catalog[2]].filter(Boolean);
  return sources.map((item, idx) => ({
    slotId: `slot-${idx + 1}`,
    catalogId: item.id,
    title: item.title,
    price: item.price,
    portionScope: item.portionScope,
    unitCost: item.unitCost ?? 2.5,
    count: 0,
    isLocallyOverridden: false
  }));
}

export async function loadPizzaCatalog(): Promise<PizzaCatalogItem[]> {
  return loadIdbItem<PizzaCatalogItem[]>(PIZZA_CATALOG_KEY, DEFAULT_PIZZA_CATALOG);
}

export async function savePizzaCatalog(catalog: PizzaCatalogItem[]): Promise<void> {
  return saveIdbItem(PIZZA_CATALOG_KEY, catalog);
}

export async function loadPosSlots(catalog: PizzaCatalogItem[]): Promise<PosPizzaSlot[]> {
  const stored = await loadIdbItem<PosPizzaSlot[] | null>(POS_SLOTS_KEY, null);
  if (stored && Array.isArray(stored) && stored.length > 0) {
    // Fehlende Felder mit Defaults auffüllen
    return stored.map((s) => ({
      ...s,
      count: s.count ?? 0,
      unitCost: s.unitCost ?? 2.5,
      isLocallyOverridden: s.isLocallyOverridden ?? false
    }));
  }
  return buildDefaultPosSlots(catalog);
}

export async function savePosSlots(slots: PosPizzaSlot[]): Promise<void> {
  // Zählerstände NICHT persistieren (Reset auf 0 beim nächsten Start ist gewollt)
  const toSave = slots.map((s) => ({ ...s, count: 0 }));
  return saveIdbItem(POS_SLOTS_KEY, toSave);
}

export const DEFAULT_DOUGH_CALC_DEFAULTS: DoughCalcDefaults = {
  defaultBallWeightGrams: 265,
  defaultHydrationPercent: 68,
  defaultBallsPerBox: 12
};

export async function loadDoughCalcDefaults(): Promise<DoughCalcDefaults> {
  return loadIdbItem<DoughCalcDefaults>(DOUGH_CALC_DEFAULTS_KEY, DEFAULT_DOUGH_CALC_DEFAULTS);
}

export async function saveDoughCalcDefaults(defaults: DoughCalcDefaults): Promise<void> {
  return saveIdbItem(DOUGH_CALC_DEFAULTS_KEY, defaults);
}

// ── Vollständiges Backup v2 ──────────────────────────────────────────────────

export async function downloadFullBackupV2(snapshot: AppStateSnapshot): Promise<FullBackupV2> {
  const [
    userPrefs,
    blueprints,
    photoPins,
    aiChat,
    scannedReceipts,
    savedDossiers,
    pizzaCatalog,
    posSlots,
    doughCalcDefaults
  ] = await Promise.all([
    loadIdbItem<any>(STORAGE_KEYS.USER_PREFS, {}),
    loadIdbItem<any>(STORAGE_KEYS.BLUEPRINTS, []),
    loadIdbItem<any>(STORAGE_KEYS.PHOTO_PINS, {}),
    loadIdbItem<any>(STORAGE_KEYS.AI_CHAT, []),
    loadIdbItem<SavedScannedReceipt[]>(STORAGE_KEYS.SCANNED_RECEIPTS, []),
    loadIdbItem<SavedDossierItem[]>(STORAGE_KEYS.SAVED_DOSSIERS, []),
    loadIdbItem<PizzaCatalogItem[]>(PIZZA_CATALOG_KEY, DEFAULT_PIZZA_CATALOG),
    loadIdbItem<PosPizzaSlot[]>(POS_SLOTS_KEY, []),
    loadIdbItem<DoughCalcDefaults>(DOUGH_CALC_DEFAULTS_KEY, DEFAULT_DOUGH_CALC_DEFAULTS),
  ]);

  const backup: FullBackupV2 = {
    backupVersion: 2,
    exportedAt: new Date().toISOString(),
    appState: snapshot,
    userPrefs,
    blueprints,
    photoPins,
    aiChat,
    scannedReceipts,
    savedDossiers,
    pizzaCatalog,
    posSlots,
    doughCalcDefaults,
  };

  const dateStr = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bandit-os-vollbackup-${dateStr}.json`;
  a.click();
  URL.revokeObjectURL(url);

  return backup;
}

export async function importFullBackupV2(
  raw: any,
  currentSnapshot: AppStateSnapshot
): Promise<{ snapshot: AppStateSnapshot; result: BackupImportResult }> {
  const warnings: string[] = [];

  // Detect backup version
  const isV2 = raw?.backupVersion === 2;

  // Extract appState
  const appState: AppStateSnapshot = isV2 ? raw.appState : raw;

  if (!appState || !Array.isArray(appState.projects)) {
    throw new Error('Ungültiges Backup-Format: keine Projekte gefunden.');
  }

  // Merge with current state (do not overwrite userApiKey if not present in backup)
  const mergedState: AppStateSnapshot = {
    ...currentSnapshot,
    ...appState,
    projects: appState.projects,
    aiLogs: Array.isArray(appState.aiLogs) ? appState.aiLogs : currentSnapshot.aiLogs,
    selfChecks: Array.isArray(appState.selfChecks) ? appState.selfChecks : currentSnapshot.selfChecks,
    eventSalesLogs: Array.isArray(appState.eventSalesLogs) ? appState.eventSalesLogs : currentSnapshot.eventSalesLogs,
    userApiKey: appState.userApiKey || currentSnapshot.userApiKey,
    thumbHubEnabled: typeof appState.thumbHubEnabled === 'boolean' ? appState.thumbHubEnabled : currentSnapshot.thumbHubEnabled,
    thumbHubPosition: appState.thumbHubPosition || currentSnapshot.thumbHubPosition,
    ambientLightMode: appState.ambientLightMode || currentSnapshot.ambientLightMode,
  };

  // Restore v2-only stores to IDB
  if (isV2) {
    const saves: Promise<void>[] = [];
    if (raw.userPrefs) saves.push(saveIdbItem(STORAGE_KEYS.USER_PREFS, raw.userPrefs));
    if (raw.blueprints) saves.push(saveIdbItem(STORAGE_KEYS.BLUEPRINTS, raw.blueprints));
    if (raw.photoPins) saves.push(saveIdbItem(STORAGE_KEYS.PHOTO_PINS, raw.photoPins));
    if (raw.aiChat) saves.push(saveIdbItem(STORAGE_KEYS.AI_CHAT, raw.aiChat));
    if (Array.isArray(raw.scannedReceipts)) saves.push(saveIdbItem(STORAGE_KEYS.SCANNED_RECEIPTS, raw.scannedReceipts));
    if (Array.isArray(raw.savedDossiers)) saves.push(saveIdbItem(STORAGE_KEYS.SAVED_DOSSIERS, raw.savedDossiers));
    if (Array.isArray(raw.pizzaCatalog) && raw.pizzaCatalog.length > 0) {
      saves.push(saveIdbItem(PIZZA_CATALOG_KEY, raw.pizzaCatalog));
    } else {
      warnings.push('Kein Pizza-Katalog im Backup – Stammdaten bleiben unverändert.');
    }
    if (Array.isArray(raw.posSlots)) saves.push(saveIdbItem(POS_SLOTS_KEY, raw.posSlots));
    if (raw.doughCalcDefaults) saves.push(saveIdbItem(DOUGH_CALC_DEFAULTS_KEY, raw.doughCalcDefaults));
    await Promise.all(saves);
  } else {
    warnings.push('Altes v1-Backup: Nur App-Status wiederhergestellt. Pizza-Katalog und Prefs bleiben unverändert.');
  }

  const taskCount = mergedState.projects.reduce((n, p) => n + (p.tasks?.length || 0), 0);
  const cartCount = mergedState.projects.reduce((n, p) => n + (p.cart?.length || 0), 0);
  const knowledgeCount = mergedState.projects.reduce((n, p) => n + (p.knowledge?.length || 0), 0);
  const pizzaVarietyCount = isV2 && Array.isArray(raw.pizzaCatalog) ? raw.pizzaCatalog.length : 0;

  return {
    snapshot: mergedState,
    result: {
      projectCount: mergedState.projects.length,
      taskCount,
      cartCount,
      knowledgeCount,
      pizzaVarietyCount,
      warnings,
    }
  };
}

// ── 1-Klick-Projekt-JSON-Import (an Zielprojekt anhängen) ────────────────────

export function importProjectJsonToTarget(
  raw: any,
  targetProject: Project
): { updatedProject: Project; result: ProjectImportResult } {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Ungültiges Projekt-JSON: Kein Objekt.');
  }

  const rawTasks = Array.isArray(raw.tasks) ? raw.tasks : [];
  const rawCart = Array.isArray(raw.cart) ? raw.cart : [];
  const rawKnowledge = Array.isArray(raw.knowledge) ? raw.knowledge : [];

  const existingTaskIds = new Set((targetProject.tasks || []).map((t) => t.id));
  const existingCartIds = new Set((targetProject.cart || []).map((c) => c.id));
  const existingKnowledgeIds = new Set((targetProject.knowledge || []).map((k) => k.id));

  const newTasks: TaskItem[] = rawTasks.map((t: any) => ({
    id: t.id && !existingTaskIds.has(t.id) ? t.id : `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: String(t.title || 'Importierte Aufgabe'),
    completed: Boolean(t.completed),
    priority: (t.priority as PriorityType) || 'Mittel',
    estimatedMinutes: Number(t.estimatedMinutes) || 15,
    dayBlock: (t.dayBlock as DayBlockId) || null,
    reminderAt: String(t.reminderAt || ''),
    aiTouched: Boolean(t.aiTouched),
    lastModified: t.lastModified || new Date().toISOString(),
    changeReason: t.changeReason || 'Projekt-JSON-Import',
    source: t.source || 'Import',
    customMeta: typeof t.customMeta === 'object' && t.customMeta ? t.customMeta : {}
  }));

  const newCart: CartItem[] = rawCart.map((c: any) => ({
    id: c.id && !existingCartIds.has(c.id) ? c.id : `cart_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: String(c.title || 'Importierter Artikel'),
    quantity: String(c.quantity || '1 Stk'),
    price: String(c.price || ''),
    completed: Boolean(c.completed),
    boughtAt: c.boughtAt || undefined,
    aiTouched: Boolean(c.aiTouched),
    lastModified: c.lastModified || new Date().toISOString(),
    changeReason: c.changeReason || 'Projekt-JSON-Import',
    source: c.source || 'Import',
    customMeta: typeof c.customMeta === 'object' && c.customMeta ? c.customMeta : {}
  }));

  const newKnowledge: KnowledgeItem[] = rawKnowledge.map((k: any) => ({
    id: k.id && !existingKnowledgeIds.has(k.id) ? k.id : `know_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    kind: (k.kind as KnowledgeKind) || 'info',
    title: String(k.title || 'Importierter Wissens-Eintrag'),
    content: String(k.content || ''),
    stepsText: k.stepsText || undefined,
    attachments: Array.isArray(k.attachments) ? k.attachments : [],
    lastModified: k.lastModified || new Date().toISOString(),
    changeReason: k.changeReason || 'Projekt-JSON-Import',
    source: k.source || 'Import',
    aiTouched: Boolean(k.aiTouched),
    customMeta: typeof k.customMeta === 'object' && k.customMeta ? k.customMeta : {}
  }));

  const updatedProject: Project = {
    ...targetProject,
    tasks: [...(targetProject.tasks || []), ...newTasks],
    cart: [...(targetProject.cart || []), ...newCart],
    knowledge: [...(targetProject.knowledge || []), ...newKnowledge],
  };

  return {
    updatedProject,
    result: {
      addedTasks: newTasks.length,
      addedCart: newCart.length,
      addedKnowledge: newKnowledge.length
    }
  };
}

