import { get, set } from 'idb-keyval';
import {
  AiLogEntry,
  AiVoiceSettings,
  AmbientLightMode,
  AppStateSnapshot,
  Attachment,
  BanditUserPreferences,
  ChangeLogEntry,
  DomainType,
  KnowledgeItem,
  Project,
  PizzaCatalogItem,
  PosPizzaSlot,
  DoughCalcDefaults,
  FullBackupV2,
  BackupImportResult,
  ProjectImportResult,
  TaskItem,
  SubTaskItem,
  CartItem,
  PriorityType,
  DayBlockId,
  ReminderRecurrence,
  KnowledgeKind,
  VoiceProvider,
  ScannedReceipt,
  ScannedReceiptItem,
  ForemanProposal,
  ForemanProposalAction,
  VisionCaptureCategory,
  VisionCaptureItem,
  OfflineAudioMemo,
  EnergyLevel,
  HaccpLogEntry,
  SmartHomeSwitchItem
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
  VOICE_PROVIDER: 'banditos_voice_provider_v1',
  AZURE_SPEECH_KEY: 'banditos_azure_speech_key_v1',
  AZURE_SPEECH_REGION: 'banditos_azure_speech_region_v1',
  ACTIVE_AI_MODE: 'banditos_active_ai_mode_v1',
  CONTINUOUS_LISTENING: 'banditos_continuous_listening_v1',
  AUTO_MODE_DETECTION: 'banditos_auto_mode_detection_v1',
  FIRED_REMINDERS: 'banditos_fired_reminders_v4',
  THUMB_HUB_ENABLED: 'banditos_thumb_hub_enabled_v1',
  THUMB_HUB_POSITION: 'banditos_thumb_hub_position_v1',
  AMBIENT_LIGHT_MODE: 'banditos_ambient_light_mode_v1',
  SCANNED_RECEIPTS: 'banditos_scanned_receipts_v1',
  SAVED_DOSSIERS: 'banditos_saved_dossiers_v1',
  FOREMAN_PROPOSALS: 'banditos_foreman_proposals_v1',
  DISMISSED_THINKER_IDS: 'banditos_dismissed_thinker_ids_v1',
  VISION_CAPTURES: 'banditos_vision_captures_v1',
  OFFLINE_AUDIO_MEMOS: 'banditos_offline_audio_memos_v1',
  HACCP_LOGS: 'banditos_haccp_logs_v1',
  SMART_HOME_SWITCHES: 'banditos_smart_home_switches_v1'
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

function normalizeDomainValue(rawDomain: unknown): { domain: DomainType; changed: boolean } {
  if (rawDomain === 'business' || rawDomain === 'private') {
    return { domain: rawDomain, changed: false };
  }
  if (rawDomain === 'privat') {
    return { domain: 'private', changed: true };
  }
  return { domain: 'business', changed: true };
}

function normalizePriorityValue(rawPriority: unknown): { priority: PriorityType; changed: boolean } {
  if (rawPriority === 'Hoch' || rawPriority === 'Mittel' || rawPriority === 'Niedrig') {
    return { priority: rawPriority, changed: false };
  }
  const lower = String(rawPriority || '').trim().toLowerCase();
  if (lower === 'high' || lower === 'hoch') {
    return { priority: 'Hoch', changed: true };
  }
  if (lower === 'low' || lower === 'niedrig') {
    return { priority: 'Niedrig', changed: true };
  }
  return { priority: 'Mittel', changed: true };
}

function normalizeSubTasksList(rawSubTasks: unknown): { subTasks: SubTaskItem[] | undefined; changed: boolean } {
  if (!Array.isArray(rawSubTasks) || rawSubTasks.length === 0) {
    return { subTasks: undefined, changed: Array.isArray(rawSubTasks) };
  }
  let changed = false;
  const mapped: SubTaskItem[] = rawSubTasks.map((st: any, idx: number) => {
    const hasOrder = typeof st?.order === 'number' && Number.isFinite(st.order);
    if (!hasOrder || !st?.id) changed = true;
    return {
      id: String(st?.id || `st_${Date.now()}_${idx}`),
      title: String(st?.title || '').trim() || 'Arbeitsschritt',
      completed: Boolean(st?.completed),
      order: hasOrder ? st.order : idx,
      completedAt: st?.completedAt ? String(st.completedAt) : undefined
    };
  });
  const sorted = [...mapped].sort((a, b) => a.order - b.order);
  for (let i = 0; i < mapped.length; i++) {
    if (mapped[i].id !== sorted[i].id) {
      changed = true;
      break;
    }
  }
  return { subTasks: sorted, changed };
}

function cleanAttachmentList(rawList: unknown): { attachments: Attachment[]; changed: boolean } {
  if (!Array.isArray(rawList)) return { attachments: [], changed: false };
  let changed = false;
  const attachments: Attachment[] = rawList.map((att: any) => {
    if (att && typeof att === 'object' && 'summaryText' in att) {
      changed = true;
      const { summaryText: _drop, ...rest } = att;
      return rest as Attachment;
    }
    return att as Attachment;
  });
  return { attachments, changed };
}

export const MAX_CHANGE_LOG_ENTRIES = 10;

export function normalizeChangeLog(raw: unknown): ChangeLogEntry[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const cleaned = raw
    .filter((e) => e && typeof e === 'object')
    .map((e: any): ChangeLogEntry => ({
      at: typeof e.at === 'string' && e.at.trim() ? e.at.trim() : new Date().toISOString(),
      actor: e.actor === 'ai' ? 'ai' : 'user',
      summary: String(e.summary || '').trim() || 'Aktualisiert'
    }));
  if (cleaned.length === 0) return undefined;
  return cleaned.slice(-MAX_CHANGE_LOG_ENTRIES);
}

export function appendChangeLogEntry(
  existing: ChangeLogEntry[] | undefined,
  entry: ChangeLogEntry
): ChangeLogEntry[] {
  const base = normalizeChangeLog(existing) || [];
  return [...base, entry].slice(-MAX_CHANGE_LOG_ENTRIES);
}

/**
 * Migriert bestehende `explanations` und `infos` verlustfrei zu einheitlichen `KnowledgeItem`s.
 */
export function normalizeProjectKnowledge(project: any): KnowledgeItem[] {
  const existingKnowledge: KnowledgeItem[] = Array.isArray(project?.knowledge)
    ? project.knowledge.map((k: any) => {
      const changeLog = normalizeChangeLog(k?.changeLog);
      return {
        ...k,
        attachments: cleanAttachmentList(k?.attachments).attachments,
        ...(typeof k?.updatedAt === 'string' && k.updatedAt ? { updatedAt: k.updatedAt } : {}),
        ...(changeLog ? { changeLog } : { changeLog: undefined })
      };
    })
    : [];
  const knownIds = new Set(existingKnowledge.map((k) => k.id));

  // Migriere alte Explanations
  if (Array.isArray(project?.explanations)) {
    for (const exp of project.explanations) {
      if (!exp || !exp.id || knownIds.has(exp.id)) continue;
      knownIds.add(exp.id);
      existingKnowledge.push({
        id: exp.id,
        kind: 'explanation',
        title: exp.title || 'Ablauf',
        content: exp.stepsText || exp.content || '',
        stepsText: exp.stepsText || exp.content || undefined,
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
  if (Array.isArray(project?.infos)) {
    for (const inf of project.infos) {
      if (!inf || !inf.id || knownIds.has(inf.id)) continue;
      knownIds.add(inf.id);
      existingKnowledge.push({
        id: inf.id,
        kind: 'info',
        title: inf.title || 'Info / Notiz',
        content: inf.content || '',
        attachments: cleanAttachmentList(inf.attachments).attachments,
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

function migrateProjectInternal(rawProject: any): { project: Project; migrated: boolean } {
  const src = rawProject && typeof rawProject === 'object' ? rawProject : {};
  let migrated = false;

  const domainRes = normalizeDomainValue(src.domain);
  if (domainRes.changed) migrated = true;

  const busDomRaw = src.businessDomain;
  const businessDomain: DomainType =
    busDomRaw !== undefined ? normalizeDomainValue(busDomRaw).domain : domainRes.domain;
  if (busDomRaw !== undefined && busDomRaw !== 'business' && busDomRaw !== 'private') {
    migrated = true;
  }

  const hasLegacyKnowledgeArrays =
    Object.prototype.hasOwnProperty.call(src, 'explanations') ||
    Object.prototype.hasOwnProperty.call(src, 'infos');
  if (hasLegacyKnowledgeArrays || !Array.isArray(src.knowledge)) {
    migrated = true;
  }

  if (Array.isArray(src.knowledge)) {
    for (const k of src.knowledge) {
      if (cleanAttachmentList(k?.attachments).changed) migrated = true;
    }
  }
  const knowledge = normalizeProjectKnowledge(src);

  const rawTasks = Array.isArray(src.tasks) ? src.tasks : [];
  const tasks: TaskItem[] = rawTasks.map((t: any) => {
    const prioRes = normalizePriorityValue(t?.priority);
    if (prioRes.changed) migrated = true;

    const rawTitle = String(t?.title || '');
    const bracketMatch = rawTitle.match(/^\[([^\]]+)\]\s*(.+)$/);
    let cleanTitle = rawTitle;
    let assemblyGroup: string | undefined =
      typeof t?.assemblyGroup === 'string' && t.assemblyGroup.trim()
        ? t.assemblyGroup.trim()
        : undefined;

    if (bracketMatch) {
      migrated = true;
      cleanTitle = bracketMatch[2].trim();
      if (!assemblyGroup) {
        assemblyGroup = bracketMatch[1].trim();
      }
    }

    const subRes = normalizeSubTasksList(t?.subTasks);
    if (subRes.changed) migrated = true;

    const changeLog = normalizeChangeLog(t?.changeLog);
    const updatedAt =
      typeof t?.updatedAt === 'string' && t.updatedAt.trim() ? t.updatedAt.trim() : undefined;

    const rawEnergy = t?.energyLevel;
    const energyLevel: EnergyLevel | undefined =
      rawEnergy === 'low' || rawEnergy === 'medium' || rawEnergy === 'high'
        ? rawEnergy
        : undefined;
    const isHurdleTask: boolean | undefined =
      typeof t?.isHurdleTask === 'boolean' ? t.isHurdleTask : undefined;
    const lastShoulderTapStage: number | undefined =
      typeof t?.lastShoulderTapStage === 'number' && Number.isFinite(t.lastShoulderTapStage)
        ? Math.max(0, Math.min(4, Math.round(t.lastShoulderTapStage)))
        : undefined;

    return {
      ...t,
      id: String(t?.id || `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`),
      title: cleanTitle,
      completed: Boolean(t?.completed),
      priority: prioRes.priority,
      estimatedMinutes: Number(t?.estimatedMinutes) || 15,
      dayBlock: (t?.dayBlock as DayBlockId) || null,
      reminderAt: String(t?.reminderAt || ''),
      reminderRecurrence:
        t?.reminderRecurrence === 'daily' ||
          t?.reminderRecurrence === 'weekly' ||
          t?.reminderRecurrence === 'none'
          ? (t.reminderRecurrence as ReminderRecurrence)
          : undefined,
      lastReminderFiredAt: t?.lastReminderFiredAt ? String(t.lastReminderFiredAt) : undefined,
      ...(energyLevel !== undefined ? { energyLevel } : {}),
      ...(isHurdleTask !== undefined ? { isHurdleTask } : {}),
      ...(lastShoulderTapStage !== undefined ? { lastShoulderTapStage } : {}),
      aiTouched: Boolean(t?.aiTouched),
      lastModified: t?.lastModified || formatNow(),
      changeReason: t?.changeReason || '',
      source: t?.source || 'Manuell',
      assemblyGroup,
      ...(subRes.subTasks ? { subTasks: subRes.subTasks } : { subTasks: undefined }),
      ...(updatedAt ? { updatedAt } : {}),
      ...(changeLog ? { changeLog } : {}),
      customMeta: typeof t?.customMeta === 'object' && t.customMeta ? t.customMeta : {}
    };
  });

  const rawCart = Array.isArray(src.cart) ? src.cart : [];
  const cart: CartItem[] = rawCart.map((c: any) => ({
    ...c,
    id: String(c?.id || `cart_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`),
    title: String(c?.title || ''),
    quantity: String(c?.quantity || '1x'),
    price: String(c?.price || ''),
    completed: Boolean(c?.completed),
    boughtAt: c?.boughtAt || undefined,
    aiTouched: Boolean(c?.aiTouched),
    lastModified: c?.lastModified || formatNow(),
    changeReason: c?.changeReason || '',
    source: c?.source || 'Manuell',
    customMeta: typeof c?.customMeta === 'object' && c.customMeta ? c.customMeta : {}
  }));

  const enabledTabs =
    Array.isArray(src.enabledTabs) && src.enabledTabs.length > 0
      ? src.enabledTabs
      : (['tasks', 'cart', 'knowledge', 'extras'] as ('tasks' | 'cart' | 'knowledge' | 'extras')[]);

  const lifecycle = src.lifecycle ?? (src.id === 'proj-baeckerei' ? 'project' : 'permanent');
  const archived = typeof src.archived === 'boolean' ? src.archived : false;
  const legalWatchEnabled =
    typeof src.legalWatchEnabled === 'boolean'
      ? src.legalWatchEnabled
      : domainRes.domain === 'business';
  const overviewEnabled = typeof src.overviewEnabled === 'boolean' ? src.overviewEnabled : true;

  const { explanations: _dropExp, infos: _dropInfo, ...cleanRest } = src;

  const customMeta =
    typeof src.customMeta === 'object' && src.customMeta ? { ...src.customMeta } : {};
  let enabledPlugins: string[] = Array.isArray(src.enabledPlugins)
    ? [...src.enabledPlugins]
    : [];

  if (src.id === 'proj-foodtruck' && customMeta.haccpProtocolSeeded !== true) {
    if (!enabledPlugins.includes('haccp-protocol')) {
      enabledPlugins = [...enabledPlugins, 'haccp-protocol'];
    }
    customMeta.haccpProtocolSeeded = true;
    migrated = true;
  }

  const project: Project = {
    ...cleanRest,
    id: String(src.id || `proj_${Date.now()}`),
    domain: domainRes.domain,
    lifecycle,
    businessDomain,
    name: String(src.name || 'Unbenanntes Projekt'),
    subtitle: String(src.subtitle || ''),
    icon: String(src.icon || 'FolderKanban'),
    customLogoUrl: src.customLogoUrl ?? null,
    accentColor: String(src.accentColor || '#0D9488'),
    archived,
    legalWatchEnabled,
    overviewEnabled,
    customMeta,
    enabledPlugins,
    enabledTabs,
    tasks,
    knowledge,
    cart
  };

  return { project, migrated };
}

/**
 * Idempotente Einzelprojekt-Migration auf das Ziel-Datenmodell v2
 */
export function migrateProject(rawProject: any): Project {
  return migrateProjectInternal(rawProject).project;
}

/**
 * Normalisiert ein ganzes Projekt auf Zielschema v2 (Alias für migrateProject)
 */
export function normalizeProject(project: Project): Project {
  return migrateProject(project);
}

/**
 * Reine, idempotente Zustandsmigration auf schemaVersion: 2
 */
export function migrateAppState(raw: unknown): { state: AppStateSnapshot; migrated: boolean } {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
  let migrated = src.schemaVersion !== 2;

  const rawProjects = Array.isArray(src.projects) ? src.projects : [];
  const projects: Project[] = rawProjects.map((p: any) => {
    const res = migrateProjectInternal(p);
    if (res.migrated) migrated = true;
    return res.project;
  });

  const rawLogs = Array.isArray(src.aiLogs) ? src.aiLogs : [];
  const aiLogs: AiLogEntry[] = rawLogs.map((log: any) => {
    const actions = Array.isArray(log?.actions)
      ? log.actions.map((act: any) => {
        if (act?.targetSubTab === 'explanations' || act?.targetSubTab === 'infos') {
          migrated = true;
          return { ...act, targetSubTab: 'knowledge' };
        }
        return act;
      })
      : [];
    return { ...log, actions };
  });

  const state: AppStateSnapshot = {
    ...(src as AppStateSnapshot),
    schemaVersion: 2,
    projects,
    aiLogs,
    selfChecks: Array.isArray(src.selfChecks) ? src.selfChecks : [],
    eventSalesLogs: Array.isArray(src.eventSalesLogs) ? src.eventSalesLogs : [],
    userApiKey: typeof src.userApiKey === 'string' ? src.userApiKey : '',
    realityCheckEnabled:
      typeof src.realityCheckEnabled === 'boolean' ? src.realityCheckEnabled : true,
    remindersEnabled:
      typeof src.remindersEnabled === 'boolean' ? src.remindersEnabled : true,
    aiVoiceSettings:
      src.aiVoiceSettings && typeof src.aiVoiceSettings === 'object'
        ? {
          ...DEFAULT_AI_VOICE_SETTINGS,
          ...src.aiVoiceSettings,
          autoModeDetection:
            typeof src.aiVoiceSettings.autoModeDetection === 'boolean'
              ? src.aiVoiceSettings.autoModeDetection
              : true
        }
        : undefined,
    haWebhookUrl: typeof src.haWebhookUrl === 'string' ? src.haWebhookUrl : '',
    haEmbedUrl: typeof src.haEmbedUrl === 'string' ? src.haEmbedUrl : ''
  };

  return { state, migrated };
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
    STORAGE_KEYS.VOICE_PROVIDER,
    STORAGE_KEYS.AZURE_SPEECH_KEY,
    STORAGE_KEYS.AZURE_SPEECH_REGION,
    STORAGE_KEYS.ACTIVE_AI_MODE,
    STORAGE_KEYS.CONTINUOUS_LISTENING,
    STORAGE_KEYS.AUTO_MODE_DETECTION,
    STORAGE_KEYS.FIRED_REMINDERS,
    STORAGE_KEYS.THUMB_HUB_ENABLED,
    STORAGE_KEYS.THUMB_HUB_POSITION,
    STORAGE_KEYS.AMBIENT_LIGHT_MODE,
    STORAGE_KEYS.SCANNED_RECEIPTS,
    STORAGE_KEYS.SAVED_DOSSIERS,
    STORAGE_KEYS.FOREMAN_PROPOSALS,
    STORAGE_KEYS.DISMISSED_THINKER_IDS,
    STORAGE_KEYS.VISION_CAPTURES,
    STORAGE_KEYS.OFFLINE_AUDIO_MEMOS,
    STORAGE_KEYS.HACCP_LOGS,
    STORAGE_KEYS.SMART_HOME_SWITCHES
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
        set(key, parsed).catch(() => { });
        return parsed;
      } catch {
        memoryCache.set(key, raw);
        set(key, raw).catch(() => { });
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
 * Lädt den Haupt-Snapshot aus IDB und migriert alle Projekte automatisch auf schemaVersion 2
 */
export async function loadPersistedState(
  defaultSeed: AppStateSnapshot
): Promise<AppStateSnapshot> {
  try {
    const stored = await get<AppStateSnapshot>(IDB_STATE_KEY);
    if (stored && Array.isArray(stored.projects) && stored.projects.length > 0) {
      const { state: migratedStored, migrated } = migrateAppState(stored);
      const finalState: AppStateSnapshot = {
        ...defaultSeed,
        ...migratedStored,
        schemaVersion: 2,
        thumbHubEnabled: typeof (stored as any).thumbHubEnabled === 'boolean' ? (stored as any).thumbHubEnabled : true,
        thumbHubPosition: (stored as any).thumbHubPosition || 'center',
        remindersEnabled: typeof (stored as any).remindersEnabled === 'boolean' ? (stored as any).remindersEnabled : true
      };
      if (migrated || (stored as any).schemaVersion !== 2) {
        await savePersistedState(finalState);
      }
      return finalState;
    }
  } catch {
    try {
      const raw = localStorage.getItem(LS_FALLBACK_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AppStateSnapshot;
        if (parsed && Array.isArray(parsed.projects)) {
          const { state: migratedParsed, migrated } = migrateAppState(parsed);
          const finalState: AppStateSnapshot = {
            ...defaultSeed,
            ...migratedParsed,
            schemaVersion: 2,
            thumbHubEnabled: typeof (parsed as any).thumbHubEnabled === 'boolean' ? (parsed as any).thumbHubEnabled : true,
            thumbHubPosition: (parsed as any).thumbHubPosition || 'center',
            remindersEnabled: typeof (parsed as any).remindersEnabled === 'boolean' ? (parsed as any).remindersEnabled : true
          };
          if (migrated || (parsed as any).schemaVersion !== 2) {
            await savePersistedState(finalState);
          }
          return finalState;
        }
      }
    } catch {
      // Fallback auf Seed
    }
  }

  const { state: migratedSeed } = migrateAppState(defaultSeed);
  return {
    ...migratedSeed,
    schemaVersion: 2,
    thumbHubEnabled: true,
    thumbHubPosition: 'center',
    remindersEnabled: true
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
  void saveIdbItem(STORAGE_KEYS.TTS_ENABLED, enabled);
}

export function getVoiceProvider(): VoiceProvider {
  const val = getIdbItemSync<string>(STORAGE_KEYS.VOICE_PROVIDER, 'azure-gisela');
  return val === 'browser' ? 'browser' : 'azure-gisela';
}

export function saveVoiceProvider(provider: VoiceProvider): void {
  void saveIdbItem(STORAGE_KEYS.VOICE_PROVIDER, provider);
}

export function getAzureSpeechKey(): string {
  return getIdbItemSync<string>(STORAGE_KEYS.AZURE_SPEECH_KEY, '');
}

export function saveAzureSpeechKey(key: string): void {
  void saveIdbItem(STORAGE_KEYS.AZURE_SPEECH_KEY, key);
}

export function getAzureSpeechRegion(): string {
  return getIdbItemSync<string>(STORAGE_KEYS.AZURE_SPEECH_REGION, 'germanywestcentral');
}

export function saveAzureSpeechRegion(region: string): void {
  void saveIdbItem(STORAGE_KEYS.AZURE_SPEECH_REGION, region);
}

export function getActiveAiMode(): 'flash' | 'research' {
  const val = getIdbItemSync<string>(STORAGE_KEYS.ACTIVE_AI_MODE, 'flash');
  return val === 'research' ? 'research' : 'flash';
}

export function saveActiveAiMode(mode: 'flash' | 'research'): void {
  void saveIdbItem(STORAGE_KEYS.ACTIVE_AI_MODE, mode);
}

export function getContinuousListening(): boolean {
  return getIdbItemSync<boolean>(STORAGE_KEYS.CONTINUOUS_LISTENING, true);
}

export function saveContinuousListening(enabled: boolean): void {
  void saveIdbItem(STORAGE_KEYS.CONTINUOUS_LISTENING, enabled);
}

export function getAutoModeDetection(): boolean {
  return getIdbItemSync<boolean>(STORAGE_KEYS.AUTO_MODE_DETECTION, true);
}

export function saveAutoModeDetection(enabled: boolean): void {
  void saveIdbItem(STORAGE_KEYS.AUTO_MODE_DETECTION, enabled);
}

export const DEFAULT_AI_VOICE_SETTINGS: AiVoiceSettings = {
  ttsEnabled: true,
  voiceProvider: 'azure-gisela',
  azureSpeechKey: '',
  azureSpeechRegion: 'germanywestcentral',
  preferredModelMode: 'SMART_PRO',
  activeAiMode: 'flash',
  continuousListening: true,
  autoModeDetection: true
};

/**
 * Lädt alle KI- & Stimm-Einstellungen konsistent aus IndexedDB (inkl. Snapshot-Fallback)
 * und befüllt dabei den synchronen Memory-Cache.
 */
export async function loadAiVoiceSettings(
  snapshot?: AppStateSnapshot | null
): Promise<AiVoiceSettings> {
  const snapSettings = snapshot?.aiVoiceSettings;
  const [
    ttsEnabled,
    rawProvider,
    azureSpeechKey,
    azureSpeechRegion,
    preferredModelMode,
    rawActiveAiMode,
    continuousListening,
    autoModeDetection
  ] = await Promise.all([
    loadIdbItem<boolean>(
      STORAGE_KEYS.TTS_ENABLED,
      snapSettings?.ttsEnabled ?? DEFAULT_AI_VOICE_SETTINGS.ttsEnabled
    ),
    loadIdbItem<string>(
      STORAGE_KEYS.VOICE_PROVIDER,
      snapSettings?.voiceProvider ?? DEFAULT_AI_VOICE_SETTINGS.voiceProvider
    ),
    loadIdbItem<string>(
      STORAGE_KEYS.AZURE_SPEECH_KEY,
      snapSettings?.azureSpeechKey ?? DEFAULT_AI_VOICE_SETTINGS.azureSpeechKey
    ),
    loadIdbItem<string>(
      STORAGE_KEYS.AZURE_SPEECH_REGION,
      snapSettings?.azureSpeechRegion ?? DEFAULT_AI_VOICE_SETTINGS.azureSpeechRegion
    ),
    loadIdbItem<string>(
      STORAGE_KEYS.PREFERRED_MODEL,
      snapSettings?.preferredModelMode ?? DEFAULT_AI_VOICE_SETTINGS.preferredModelMode
    ),
    loadIdbItem<string>(
      STORAGE_KEYS.ACTIVE_AI_MODE,
      snapSettings?.activeAiMode ?? DEFAULT_AI_VOICE_SETTINGS.activeAiMode
    ),
    loadIdbItem<boolean>(
      STORAGE_KEYS.CONTINUOUS_LISTENING,
      snapSettings?.continuousListening ?? DEFAULT_AI_VOICE_SETTINGS.continuousListening
    ),
    loadIdbItem<boolean>(
      STORAGE_KEYS.AUTO_MODE_DETECTION,
      snapSettings?.autoModeDetection ?? DEFAULT_AI_VOICE_SETTINGS.autoModeDetection
    )
  ]);

  return {
    ttsEnabled: typeof ttsEnabled === 'boolean' ? ttsEnabled : true,
    voiceProvider: rawProvider === 'browser' ? 'browser' : 'azure-gisela',
    azureSpeechKey: typeof azureSpeechKey === 'string' ? azureSpeechKey : '',
    azureSpeechRegion:
      typeof azureSpeechRegion === 'string' && azureSpeechRegion.trim()
        ? azureSpeechRegion
        : 'germanywestcentral',
    preferredModelMode:
      typeof preferredModelMode === 'string' && preferredModelMode.trim()
        ? preferredModelMode
        : 'SMART_PRO',
    activeAiMode: rawActiveAiMode === 'research' ? 'research' : 'flash',
    continuousListening: typeof continuousListening === 'boolean' ? continuousListening : true,
    autoModeDetection: typeof autoModeDetection === 'boolean' ? autoModeDetection : true
  };
}

/**
 * Speichert alle KI- & Stimm-Einstellungen atomar in IndexedDB + Memory-Cache + LocalStorage-Backup.
 */
export async function saveAiVoiceSettings(settings: AiVoiceSettings): Promise<void> {
  const normalized: AiVoiceSettings = {
    ...DEFAULT_AI_VOICE_SETTINGS,
    ...settings,
    ttsEnabled: typeof settings.ttsEnabled === 'boolean' ? settings.ttsEnabled : true,
    voiceProvider: settings.voiceProvider === 'browser' ? 'browser' : 'azure-gisela',
    azureSpeechKey: typeof settings.azureSpeechKey === 'string' ? settings.azureSpeechKey : '',
    azureSpeechRegion:
      typeof settings.azureSpeechRegion === 'string' && settings.azureSpeechRegion.trim()
        ? settings.azureSpeechRegion
        : 'germanywestcentral',
    preferredModelMode:
      typeof settings.preferredModelMode === 'string' && settings.preferredModelMode.trim()
        ? settings.preferredModelMode
        : 'SMART_PRO',
    activeAiMode: settings.activeAiMode === 'research' ? 'research' : 'flash',
    continuousListening:
      typeof settings.continuousListening === 'boolean' ? settings.continuousListening : true,
    autoModeDetection:
      typeof settings.autoModeDetection === 'boolean' ? settings.autoModeDetection : true
  };

  await Promise.all([
    saveIdbItem(STORAGE_KEYS.TTS_ENABLED, normalized.ttsEnabled),
    saveIdbItem(STORAGE_KEYS.VOICE_PROVIDER, normalized.voiceProvider),
    saveIdbItem(STORAGE_KEYS.AZURE_SPEECH_KEY, normalized.azureSpeechKey),
    saveIdbItem(STORAGE_KEYS.AZURE_SPEECH_REGION, normalized.azureSpeechRegion),
    saveIdbItem(STORAGE_KEYS.PREFERRED_MODEL, normalized.preferredModelMode),
    saveIdbItem(STORAGE_KEYS.ACTIVE_AI_MODE, normalized.activeAiMode),
    saveIdbItem(STORAGE_KEYS.CONTINUOUS_LISTENING, normalized.continuousListening),
    saveIdbItem(STORAGE_KEYS.AUTO_MODE_DETECTION, normalized.autoModeDetection)
  ]);
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

export const DEFAULT_USER_PREFS: BanditUserPreferences = {
  adhdMasterEnabled: true,
  adhdFocusAnchor: true,
  adhdSingleTaskMode: true,
  adhdTwoMinuteStarter: true,
  adhdTimeBufferAndHaptics: true,
  driveDiceEnabled: true,
  energyPlannerEnabled: true,
  shoulderTapEnabled: false,
  shoulderTapQuietStart: '22:00',
  shoulderTapQuietEnd: '08:00',
  shoulderTapTone: 'calm',
  uiDensity: 'standard',
  aiTone: 'partner',
  organicMotion: true,
  hapticsEnabled: true,
  cartOpenMode: 'floating',
  flipCoverAutoDetect: true,
  reminderSystemPushEnabled: true,
  smartHomeEnabled: false,
  appShortcutsEnabled: true,
  shareTargetEnabled: true,
  wakeLockEnabled: true,
  receiptForemanEnabled: true,
  silentThinkerEnabled: true,
  murmurAutopilotEnabled: true,
  generalVisionEnabled: true,
  offlineAudioBufferEnabled: true,
  gastroCartBridgeEnabled: true,
  companionMessageToolsEnabled: true,
  companionQuickChipsEnabled: true,
  companionStartExpanded: false,
  taskExtendedMetaEnabled: true,
  knowledgeStepReadAloudEnabled: true,
  changeHistoryEnabled: true,
  aiLogsViewerEnabled: false,
  quickCommands: [
    'Gib mir ein kurzes 3-Punkte-Briefing für dieses Projekt',
    'Welche Materialien fehlen noch im Einkaufswagen?',
    'Brich mir die nächste große Aufgabe in 2-Minuten-Schritte herunter'
  ],
  activeFocusTaskId: null,
  activeFocusTaskTitle: null,
  activeFocusProjectId: null
};

export function normalizeUserPrefs(
  raw?: Partial<BanditUserPreferences> | null
): BanditUserPreferences {
  const src = raw && typeof raw === 'object' ? raw : {};
  const uiDensity: BanditUserPreferences['uiDensity'] =
    src.uiDensity === 'compact' || src.uiDensity === 'large' ? src.uiDensity : 'standard';
  const aiTone: BanditUserPreferences['aiTone'] =
    src.aiTone === 'short' || src.aiTone === 'coach' ? src.aiTone : 'partner';

  return {
    ...DEFAULT_USER_PREFS,
    ...src,
    adhdMasterEnabled:
      typeof src.adhdMasterEnabled === 'boolean'
        ? src.adhdMasterEnabled
        : DEFAULT_USER_PREFS.adhdMasterEnabled,
    adhdFocusAnchor:
      typeof src.adhdFocusAnchor === 'boolean'
        ? src.adhdFocusAnchor
        : DEFAULT_USER_PREFS.adhdFocusAnchor,
    adhdSingleTaskMode:
      typeof src.adhdSingleTaskMode === 'boolean'
        ? src.adhdSingleTaskMode
        : DEFAULT_USER_PREFS.adhdSingleTaskMode,
    adhdTwoMinuteStarter:
      typeof src.adhdTwoMinuteStarter === 'boolean'
        ? src.adhdTwoMinuteStarter
        : DEFAULT_USER_PREFS.adhdTwoMinuteStarter,
    adhdTimeBufferAndHaptics:
      typeof src.adhdTimeBufferAndHaptics === 'boolean'
        ? src.adhdTimeBufferAndHaptics
        : DEFAULT_USER_PREFS.adhdTimeBufferAndHaptics,
    driveDiceEnabled:
      typeof src.driveDiceEnabled === 'boolean'
        ? src.driveDiceEnabled
        : DEFAULT_USER_PREFS.driveDiceEnabled,
    energyPlannerEnabled:
      typeof src.energyPlannerEnabled === 'boolean'
        ? src.energyPlannerEnabled
        : DEFAULT_USER_PREFS.energyPlannerEnabled,
    shoulderTapEnabled:
      typeof src.shoulderTapEnabled === 'boolean'
        ? src.shoulderTapEnabled
        : DEFAULT_USER_PREFS.shoulderTapEnabled,
    shoulderTapQuietStart:
      typeof src.shoulderTapQuietStart === 'string' &&
      /^([01]\d|2[0-3]):[0-5]\d$/.test(src.shoulderTapQuietStart.trim())
        ? src.shoulderTapQuietStart.trim()
        : DEFAULT_USER_PREFS.shoulderTapQuietStart,
    shoulderTapQuietEnd:
      typeof src.shoulderTapQuietEnd === 'string' &&
      /^([01]\d|2[0-3]):[0-5]\d$/.test(src.shoulderTapQuietEnd.trim())
        ? src.shoulderTapQuietEnd.trim()
        : DEFAULT_USER_PREFS.shoulderTapQuietEnd,
    shoulderTapTone: src.shoulderTapTone === 'direct' ? 'direct' : 'calm',
    uiDensity,
    aiTone,
    organicMotion:
      typeof src.organicMotion === 'boolean' ? src.organicMotion : DEFAULT_USER_PREFS.organicMotion,
    hapticsEnabled:
      typeof src.hapticsEnabled === 'boolean'
        ? src.hapticsEnabled
        : DEFAULT_USER_PREFS.hapticsEnabled,
    cartOpenMode: src.cartOpenMode === 'tab' ? 'tab' : 'floating',
    flipCoverAutoDetect:
      typeof src.flipCoverAutoDetect === 'boolean'
        ? src.flipCoverAutoDetect
        : DEFAULT_USER_PREFS.flipCoverAutoDetect,
    reminderSystemPushEnabled:
      typeof src.reminderSystemPushEnabled === 'boolean'
        ? src.reminderSystemPushEnabled
        : DEFAULT_USER_PREFS.reminderSystemPushEnabled,
    smartHomeEnabled:
      typeof src.smartHomeEnabled === 'boolean'
        ? src.smartHomeEnabled
        : DEFAULT_USER_PREFS.smartHomeEnabled,
    appShortcutsEnabled:
      typeof src.appShortcutsEnabled === 'boolean'
        ? src.appShortcutsEnabled
        : DEFAULT_USER_PREFS.appShortcutsEnabled,
    shareTargetEnabled:
      typeof src.shareTargetEnabled === 'boolean'
        ? src.shareTargetEnabled
        : DEFAULT_USER_PREFS.shareTargetEnabled,
    wakeLockEnabled:
      typeof src.wakeLockEnabled === 'boolean'
        ? src.wakeLockEnabled
        : DEFAULT_USER_PREFS.wakeLockEnabled,
    receiptForemanEnabled:
      typeof src.receiptForemanEnabled === 'boolean'
        ? src.receiptForemanEnabled
        : DEFAULT_USER_PREFS.receiptForemanEnabled,
    silentThinkerEnabled:
      typeof src.silentThinkerEnabled === 'boolean'
        ? src.silentThinkerEnabled
        : DEFAULT_USER_PREFS.silentThinkerEnabled,
    murmurAutopilotEnabled:
      typeof src.murmurAutopilotEnabled === 'boolean'
        ? src.murmurAutopilotEnabled
        : DEFAULT_USER_PREFS.murmurAutopilotEnabled,
    generalVisionEnabled:
      typeof src.generalVisionEnabled === 'boolean'
        ? src.generalVisionEnabled
        : DEFAULT_USER_PREFS.generalVisionEnabled,
    offlineAudioBufferEnabled:
      typeof src.offlineAudioBufferEnabled === 'boolean'
        ? src.offlineAudioBufferEnabled
        : DEFAULT_USER_PREFS.offlineAudioBufferEnabled,
    gastroCartBridgeEnabled:
      typeof src.gastroCartBridgeEnabled === 'boolean'
        ? src.gastroCartBridgeEnabled
        : DEFAULT_USER_PREFS.gastroCartBridgeEnabled,
    companionMessageToolsEnabled:
      typeof src.companionMessageToolsEnabled === 'boolean'
        ? src.companionMessageToolsEnabled
        : DEFAULT_USER_PREFS.companionMessageToolsEnabled,
    companionQuickChipsEnabled:
      typeof src.companionQuickChipsEnabled === 'boolean'
        ? src.companionQuickChipsEnabled
        : DEFAULT_USER_PREFS.companionQuickChipsEnabled,
    companionStartExpanded:
      typeof src.companionStartExpanded === 'boolean'
        ? src.companionStartExpanded
        : DEFAULT_USER_PREFS.companionStartExpanded,
    taskExtendedMetaEnabled:
      typeof src.taskExtendedMetaEnabled === 'boolean'
        ? src.taskExtendedMetaEnabled
        : DEFAULT_USER_PREFS.taskExtendedMetaEnabled,
    knowledgeStepReadAloudEnabled:
      typeof src.knowledgeStepReadAloudEnabled === 'boolean'
        ? src.knowledgeStepReadAloudEnabled
        : DEFAULT_USER_PREFS.knowledgeStepReadAloudEnabled,
    changeHistoryEnabled:
      typeof src.changeHistoryEnabled === 'boolean'
        ? src.changeHistoryEnabled
        : DEFAULT_USER_PREFS.changeHistoryEnabled,
    aiLogsViewerEnabled:
      typeof src.aiLogsViewerEnabled === 'boolean'
        ? src.aiLogsViewerEnabled
        : DEFAULT_USER_PREFS.aiLogsViewerEnabled,
    quickCommands: Array.isArray(src.quickCommands)
      ? src.quickCommands
      : DEFAULT_USER_PREFS.quickCommands,
    activeFocusTaskId:
      typeof src.activeFocusTaskId === 'string' ? src.activeFocusTaskId : null,
    activeFocusTaskTitle:
      typeof src.activeFocusTaskTitle === 'string' ? src.activeFocusTaskTitle : null,
    activeFocusProjectId:
      typeof src.activeFocusProjectId === 'string' ? src.activeFocusProjectId : null
  };
}

export function loadUserPrefs(): BanditUserPreferences {
  const raw = getIdbItemSync<Partial<BanditUserPreferences>>(
    STORAGE_KEYS.USER_PREFS,
    DEFAULT_USER_PREFS
  );
  return normalizeUserPrefs(raw);
}

export async function loadUserPrefsAsync(): Promise<BanditUserPreferences> {
  const raw = await loadIdbItem<Partial<BanditUserPreferences>>(
    STORAGE_KEYS.USER_PREFS,
    DEFAULT_USER_PREFS
  );
  return normalizeUserPrefs(raw);
}

export async function saveUserPrefs(prefs: BanditUserPreferences): Promise<void> {
  const normalized = normalizeUserPrefs(prefs);
  await saveIdbItem(STORAGE_KEYS.USER_PREFS, normalized);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('banditos:prefs-updated', { detail: normalized }));
  }
}

export function triggerHapticFeedback(pattern: number | number[] = 14): void {
  const prefs = loadUserPrefs();
  if (prefs.hapticsEnabled === false) return;
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // ignore
  }
}

export interface SavedScannedReceipt extends ScannedReceipt {
  projectId: string;
  projectName: string;
  createdAt: string;
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

function normalizeScannedReceiptItem(raw: any): ScannedReceiptItem {
  return {
    title: String(raw?.title || '').trim() || 'Position',
    quantity: String(raw?.quantity || '1x'),
    price: String(raw?.price ?? '')
  };
}

export function normalizeScannedReceipts(raw: unknown): SavedScannedReceipt[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry) => entry && typeof entry === 'object')
    .map((r: any, idx: number) => ({
      id: String(r.id || `rcpt-${Date.now()}-${idx}`),
      projectId: typeof r.projectId === 'string' ? r.projectId : '',
      projectName: typeof r.projectName === 'string' ? r.projectName : '',
      storeName: typeof r.storeName === 'string' ? r.storeName : '',
      purchaseDate: typeof r.purchaseDate === 'string' ? r.purchaseDate : '',
      totalAmount: typeof r.totalAmount === 'number' ? String(r.totalAmount) : String(r.totalAmount ?? '0,00'),
      items: Array.isArray(r.items) ? r.items.map(normalizeScannedReceiptItem) : [],
      createdAt: typeof r.createdAt === 'string' && r.createdAt ? r.createdAt : formatNow(),
      reconciled: typeof r.reconciled === 'boolean' ? r.reconciled : Boolean(r.reconciledAt),
      ...(typeof r.netAmount === 'number' && Number.isFinite(r.netAmount) ? { netAmount: r.netAmount } : {}),
      ...(typeof r.vatAmount === 'number' && Number.isFinite(r.vatAmount) ? { vatAmount: r.vatAmount } : {}),
      ...(typeof r.vatRate === 'number' && Number.isFinite(r.vatRate) ? { vatRate: r.vatRate } : {}),
      ...(typeof r.category === 'string' && r.category.trim() ? { category: r.category.trim() } : {}),
      ...(typeof r.reconciledAt === 'string' && r.reconciledAt ? { reconciledAt: r.reconciledAt } : {}),
      ...(typeof r.reconciledCount === 'number' && Number.isFinite(r.reconciledCount)
        ? { reconciledCount: r.reconciledCount }
        : {})
    }));
}

export function loadScannedReceipts(): SavedScannedReceipt[] {
  const raw = getIdbItemSync<SavedScannedReceipt[]>(STORAGE_KEYS.SCANNED_RECEIPTS, []);
  return normalizeScannedReceipts(raw);
}

export async function loadScannedReceiptsAsync(): Promise<SavedScannedReceipt[]> {
  const raw = await loadIdbItem<SavedScannedReceipt[]>(STORAGE_KEYS.SCANNED_RECEIPTS, []);
  return normalizeScannedReceipts(raw);
}

export function saveScannedReceipts(receipts: SavedScannedReceipt[]): void {
  saveIdbItem(STORAGE_KEYS.SCANNED_RECEIPTS, normalizeScannedReceipts(receipts));
}

export function loadSavedDossiers(): SavedDossierItem[] {
  return getIdbItemSync<SavedDossierItem[]>(STORAGE_KEYS.SAVED_DOSSIERS, []);
}

export function saveSavedDossiers(dossiers: SavedDossierItem[]): void {
  saveIdbItem(STORAGE_KEYS.SAVED_DOSSIERS, dossiers);
}

// ── Vorarbeiter-Vorschläge & Stiller Mitdenker (Welle 4 / Ticket 4.2) ───────

function normalizeForemanProposalAction(raw: any): ForemanProposalAction | null {
  if (!raw || typeof raw !== 'object') return null;
  const validTypes: ForemanProposalAction['type'][] = [
    'add-cart',
    'add-task',
    'add-knowledge',
    'dedupe-cart',
    'mark-cart-bought'
  ];
  const type = validTypes.includes(raw.type) ? (raw.type as ForemanProposalAction['type']) : null;
  if (!type) return null;
  const rawPayload = raw.payload && typeof raw.payload === 'object' ? raw.payload : {};
  return {
    type,
    label: String(raw.label || 'Übernehmen'),
    projectId: String(raw.projectId || ''),
    payload: {
      ...(typeof rawPayload.title === 'string' ? { title: rawPayload.title } : {}),
      ...(typeof rawPayload.quantity === 'string' ? { quantity: rawPayload.quantity } : {}),
      ...(typeof rawPayload.notes === 'string' ? { notes: rawPayload.notes } : {}),
      ...(typeof rawPayload.content === 'string' ? { content: rawPayload.content } : {}),
      ...(Array.isArray(rawPayload.removeCartItemIds)
        ? { removeCartItemIds: rawPayload.removeCartItemIds.map((id: any) => String(id)) }
        : {}),
      ...(typeof rawPayload.cartItemId === 'string' ? { cartItemId: rawPayload.cartItemId } : {})
    }
  };
}

export function normalizeForemanProposals(raw: unknown): ForemanProposal[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry: any, idx: number): ForemanProposal => {
      const kind =
        entry.kind === 'thinker-contradiction' ? 'thinker-contradiction' : 'murmur-research';
      const status =
        entry.status === 'snoozed' || entry.status === 'accepted' || entry.status === 'dismissed'
          ? entry.status
          : 'pending';
      const actions = Array.isArray(entry.actions)
        ? entry.actions
            .map(normalizeForemanProposalAction)
            .filter((a: ForemanProposalAction | null): a is ForemanProposalAction => Boolean(a))
        : [];
      return {
        id: String(entry.id || `proposal-${Date.now()}-${idx}`),
        kind,
        projectId: String(entry.projectId || ''),
        title: String(entry.title || 'Vorarbeiter-Vorschlag'),
        summary: String(entry.summary || ''),
        ...(typeof entry.detail === 'string' && entry.detail ? { detail: entry.detail } : {}),
        status,
        createdAt: typeof entry.createdAt === 'string' && entry.createdAt ? entry.createdAt : formatNow(),
        ...(typeof entry.snoozedUntil === 'string' && entry.snoozedUntil
          ? { snoozedUntil: entry.snoozedUntil }
          : {}),
        actions
      };
    });
}

export function normalizeDismissedThinkerIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  for (const item of raw) {
    const clean = String(item || '').trim();
    if (clean) seen.add(clean);
  }
  return Array.from(seen);
}

export function loadForemanProposals(): ForemanProposal[] {
  const raw = getIdbItemSync<ForemanProposal[]>(STORAGE_KEYS.FOREMAN_PROPOSALS, []);
  return normalizeForemanProposals(raw);
}

export async function loadForemanProposalsAsync(): Promise<ForemanProposal[]> {
  const raw = await loadIdbItem<ForemanProposal[]>(STORAGE_KEYS.FOREMAN_PROPOSALS, []);
  return normalizeForemanProposals(raw);
}

export function saveForemanProposals(list: ForemanProposal[]): Promise<void> {
  const normalized = normalizeForemanProposals(list);
  const p = saveIdbItem(STORAGE_KEYS.FOREMAN_PROPOSALS, normalized);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('banditos:foreman-proposals-updated', { detail: normalized }));
  }
  return p;
}

export function loadDismissedThinkerIds(): string[] {
  const raw = getIdbItemSync<string[]>(STORAGE_KEYS.DISMISSED_THINKER_IDS, []);
  return normalizeDismissedThinkerIds(raw);
}

export async function loadDismissedThinkerIdsAsync(): Promise<string[]> {
  const raw = await loadIdbItem<string[]>(STORAGE_KEYS.DISMISSED_THINKER_IDS, []);
  return normalizeDismissedThinkerIds(raw);
}

export function saveDismissedThinkerIds(ids: string[]): Promise<void> {
  const normalized = normalizeDismissedThinkerIds(ids);
  const p = saveIdbItem(STORAGE_KEYS.DISMISSED_THINKER_IDS, normalized);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('banditos:dismissed-thinker-updated', { detail: normalized })
    );
  }
  return p;
}

// ── Allgemeine Bild-Vision & Offline-Audio-Puffer (Welle 4 / Ticket 4.3) ────

export const MAX_VISION_CAPTURES = 40;

export function normalizeVisionCaptures(raw: unknown): VisionCaptureItem[] {
  if (!Array.isArray(raw)) return [];
  const validCategories: VisionCaptureCategory[] = ['nameplate', 'sketch', 'site-photo'];
  return raw
    .filter((entry) => entry && typeof entry === 'object')
    .slice(0, MAX_VISION_CAPTURES)
    .map((entry: any, idx: number): VisionCaptureItem => {
      const category: VisionCaptureCategory = validCategories.includes(entry.category)
        ? entry.category
        : 'site-photo';
      const extractedSpecs = Array.isArray(entry.extractedSpecs)
        ? entry.extractedSpecs.map((s: any) => String(s || '').trim()).filter(Boolean)
        : [];
      const suggestedCartItems = Array.isArray(entry.suggestedCartItems)
        ? entry.suggestedCartItems.map((s: any) => String(s || '').trim()).filter(Boolean)
        : undefined;
      return {
        id: String(entry.id || `vis-${Date.now()}-${idx}`),
        projectId: String(entry.projectId || ''),
        category,
        title: String(entry.title || 'Foto-Aufnahme').trim() || 'Foto-Aufnahme',
        summary: String(entry.summary || '').trim(),
        extractedSpecs,
        ...(suggestedCartItems && suggestedCartItems.length > 0 ? { suggestedCartItems } : {}),
        ...(typeof entry.suggestedTaskTitle === 'string' && entry.suggestedTaskTitle.trim()
          ? { suggestedTaskTitle: entry.suggestedTaskTitle.trim() }
          : {}),
        ...(typeof entry.thumbnailDataUrl === 'string' && entry.thumbnailDataUrl
          ? { thumbnailDataUrl: entry.thumbnailDataUrl }
          : {}),
        createdAt: typeof entry.createdAt === 'string' && entry.createdAt ? entry.createdAt : formatNow()
      };
    });
}

export function loadVisionCaptures(): VisionCaptureItem[] {
  const raw = getIdbItemSync<VisionCaptureItem[]>(STORAGE_KEYS.VISION_CAPTURES, []);
  return normalizeVisionCaptures(raw);
}

export async function loadVisionCapturesAsync(): Promise<VisionCaptureItem[]> {
  const raw = await loadIdbItem<VisionCaptureItem[]>(STORAGE_KEYS.VISION_CAPTURES, []);
  return normalizeVisionCaptures(raw);
}

export function saveVisionCaptures(items: VisionCaptureItem[]): Promise<void> {
  const normalized = normalizeVisionCaptures(items);
  const p = saveIdbItem(STORAGE_KEYS.VISION_CAPTURES, normalized);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('banditos:vision-captures-updated', { detail: normalized }));
  }
  return p;
}

export function normalizeOfflineAudioMemos(raw: unknown): OfflineAudioMemo[] {
  if (!Array.isArray(raw)) return [];
  const validStatuses: OfflineAudioMemo['status'][] = ['queued', 'processing', 'transcribed', 'error'];
  return raw
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry: any, idx: number): OfflineAudioMemo => {
      const status: OfflineAudioMemo['status'] = validStatuses.includes(entry.status)
        ? entry.status
        : 'queued';
      return {
        id: String(entry.id || `memo-${Date.now()}-${idx}`),
        projectId: String(entry.projectId || ''),
        createdAt: typeof entry.createdAt === 'string' && entry.createdAt ? entry.createdAt : formatNow(),
        durationSec:
          typeof entry.durationSec === 'number' && Number.isFinite(entry.durationSec) && entry.durationSec >= 0
            ? Math.round(entry.durationSec)
            : 0,
        mimeType: typeof entry.mimeType === 'string' && entry.mimeType ? entry.mimeType : 'audio/webm',
        ...(typeof entry.audioDataUrl === 'string' && entry.audioDataUrl
          ? { audioDataUrl: entry.audioDataUrl }
          : {}),
        ...(typeof entry.noteText === 'string' && entry.noteText.trim()
          ? { noteText: entry.noteText.trim() }
          : {}),
        status,
        ...(typeof entry.transcript === 'string' && entry.transcript.trim()
          ? { transcript: entry.transcript.trim() }
          : {}),
        ...(typeof entry.errorMessage === 'string' && entry.errorMessage.trim()
          ? { errorMessage: entry.errorMessage.trim() }
          : {})
      };
    });
}

export function loadOfflineAudioMemos(): OfflineAudioMemo[] {
  const raw = getIdbItemSync<OfflineAudioMemo[]>(STORAGE_KEYS.OFFLINE_AUDIO_MEMOS, []);
  return normalizeOfflineAudioMemos(raw);
}

export async function loadOfflineAudioMemosAsync(): Promise<OfflineAudioMemo[]> {
  const raw = await loadIdbItem<OfflineAudioMemo[]>(STORAGE_KEYS.OFFLINE_AUDIO_MEMOS, []);
  return normalizeOfflineAudioMemos(raw);
}

export function saveOfflineAudioMemos(memos: OfflineAudioMemo[]): Promise<void> {
  const normalized = normalizeOfflineAudioMemos(memos);
  const p = saveIdbItem(STORAGE_KEYS.OFFLINE_AUDIO_MEMOS, normalized);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('banditos:offline-audio-memos-updated', { detail: normalized })
    );
  }
  return p;
}

// ── HACCP-Protokolle & Smart-Home-Schnellschalter (Welle 5 / Ticket 5.2) ────

export function normalizeHaccpLogs(raw: unknown): HaccpLogEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry: any, idx: number): HaccpLogEntry => {
      const checksRaw = entry.checks && typeof entry.checks === 'object' ? entry.checks : {};
      const parseTemp = (val: unknown): number | null => {
        if (val === null || val === undefined || val === '') return null;
        const num = Number(String(val).replace(',', '.'));
        return Number.isFinite(num) ? num : null;
      };
      const dateISO =
        typeof entry.dateISO === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(entry.dateISO)
          ? entry.dateISO
          : new Date().toISOString().slice(0, 10);
      return {
        id: String(entry.id || `haccp-${Date.now()}-${idx}`),
        projectId: String(entry.projectId || ''),
        dateISO,
        timestamp: typeof entry.timestamp === 'string' && entry.timestamp ? entry.timestamp : formatNow(),
        eventLabel: String(entry.eventLabel || dateISO).trim() || dateISO,
        fridgeTempC: parseTemp(entry.fridgeTempC),
        saladetteTempC: parseTemp(entry.saladetteTempC),
        hotWaterOk: Boolean(entry.hotWaterOk),
        checks: {
          surfacesSanitized: Boolean(checksRaw.surfacesSanitized),
          handwashReady: Boolean(checksRaw.handwashReady),
          coolingChainOk: Boolean(checksRaw.coolingChainOk),
          endCleaningDone: Boolean(checksRaw.endCleaningDone)
        },
        ...(typeof entry.notes === 'string' && entry.notes.trim()
          ? { notes: entry.notes.trim() }
          : {})
      };
    });
}

export function loadHaccpLogs(): HaccpLogEntry[] {
  const raw = getIdbItemSync<HaccpLogEntry[]>(STORAGE_KEYS.HACCP_LOGS, []);
  return normalizeHaccpLogs(raw);
}

export async function loadHaccpLogsAsync(): Promise<HaccpLogEntry[]> {
  const raw = await loadIdbItem<HaccpLogEntry[]>(STORAGE_KEYS.HACCP_LOGS, []);
  return normalizeHaccpLogs(raw);
}

export function saveHaccpLogs(entries: HaccpLogEntry[]): Promise<void> {
  const normalized = normalizeHaccpLogs(entries);
  const p = saveIdbItem(STORAGE_KEYS.HACCP_LOGS, normalized);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('banditos:haccp-logs-updated', { detail: normalized }));
  }
  return p;
}

export function normalizeSmartHomeSwitches(raw: unknown): SmartHomeSwitchItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry: any, idx: number): SmartHomeSwitchItem => ({
      id: String(entry.id || `sw-${Date.now()}-${idx}`),
      label: String(entry.label || 'Schalter').trim() || 'Schalter',
      endpointUrl: String(entry.endpointUrl || '').trim(),
      method: entry.method === 'GET' ? 'GET' : 'POST',
      ...(typeof entry.lastTriggeredAt === 'string' && entry.lastTriggeredAt
        ? { lastTriggeredAt: entry.lastTriggeredAt }
        : {})
    }));
}

export function loadSmartHomeSwitches(): SmartHomeSwitchItem[] {
  const raw = getIdbItemSync<SmartHomeSwitchItem[]>(STORAGE_KEYS.SMART_HOME_SWITCHES, []);
  return normalizeSmartHomeSwitches(raw);
}

export async function loadSmartHomeSwitchesAsync(): Promise<SmartHomeSwitchItem[]> {
  const raw = await loadIdbItem<SmartHomeSwitchItem[]>(STORAGE_KEYS.SMART_HOME_SWITCHES, []);
  return normalizeSmartHomeSwitches(raw);
}

export function saveSmartHomeSwitches(items: SmartHomeSwitchItem[]): Promise<void> {
  const normalized = normalizeSmartHomeSwitches(items);
  const p = saveIdbItem(STORAGE_KEYS.SMART_HOME_SWITCHES, normalized);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('banditos:smart-home-switches-updated', { detail: normalized })
    );
  }
  return p;
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
    rawUserPrefs,
    blueprints,
    photoPins,
    aiChat,
    scannedReceipts,
    savedDossiers,
    foremanProposals,
    dismissedThinkerIds,
    visionCaptures,
    offlineAudioMemos,
    haccpLogs,
    smartHomeSwitches,
    pizzaCatalog,
    posSlots,
    doughCalcDefaults
  ] = await Promise.all([
    loadIdbItem<Partial<BanditUserPreferences>>(STORAGE_KEYS.USER_PREFS, DEFAULT_USER_PREFS),
    loadIdbItem<any>(STORAGE_KEYS.BLUEPRINTS, []),
    loadIdbItem<any>(STORAGE_KEYS.PHOTO_PINS, {}),
    loadIdbItem<any>(STORAGE_KEYS.AI_CHAT, []),
    loadIdbItem<SavedScannedReceipt[]>(STORAGE_KEYS.SCANNED_RECEIPTS, []),
    loadIdbItem<SavedDossierItem[]>(STORAGE_KEYS.SAVED_DOSSIERS, []),
    loadIdbItem<ForemanProposal[]>(STORAGE_KEYS.FOREMAN_PROPOSALS, []),
    loadIdbItem<string[]>(STORAGE_KEYS.DISMISSED_THINKER_IDS, []),
    loadIdbItem<VisionCaptureItem[]>(STORAGE_KEYS.VISION_CAPTURES, []),
    loadIdbItem<OfflineAudioMemo[]>(STORAGE_KEYS.OFFLINE_AUDIO_MEMOS, []),
    loadIdbItem<HaccpLogEntry[]>(STORAGE_KEYS.HACCP_LOGS, []),
    loadIdbItem<SmartHomeSwitchItem[]>(STORAGE_KEYS.SMART_HOME_SWITCHES, []),
    loadIdbItem<PizzaCatalogItem[]>(PIZZA_CATALOG_KEY, DEFAULT_PIZZA_CATALOG),
    loadIdbItem<PosPizzaSlot[]>(POS_SLOTS_KEY, []),
    loadIdbItem<DoughCalcDefaults>(DOUGH_CALC_DEFAULTS_KEY, DEFAULT_DOUGH_CALC_DEFAULTS),
  ]);

  const userPrefs = normalizeUserPrefs(rawUserPrefs);

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
    foremanProposals: normalizeForemanProposals(foremanProposals),
    dismissedThinkerIds: normalizeDismissedThinkerIds(dismissedThinkerIds),
    visionCaptures: normalizeVisionCaptures(visionCaptures),
    offlineAudioMemos: normalizeOfflineAudioMemos(offlineAudioMemos),
    haccpLogs: normalizeHaccpLogs(haccpLogs),
    smartHomeSwitches: normalizeSmartHomeSwitches(smartHomeSwitches),
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
  const rawAppState: AppStateSnapshot = isV2 ? raw.appState : raw;

  if (!rawAppState || !Array.isArray(rawAppState.projects)) {
    throw new Error('Ungültiges Backup-Format: keine Projekte gefunden.');
  }

  const { state: migratedAppState } = migrateAppState(rawAppState);

  const importedTopLevelVoice =
    isV2 && raw?.aiVoiceSettings && typeof raw.aiVoiceSettings === 'object'
      ? { ...DEFAULT_AI_VOICE_SETTINGS, ...raw.aiVoiceSettings }
      : undefined;
  const resolvedVoiceSettings =
    migratedAppState.aiVoiceSettings || importedTopLevelVoice || currentSnapshot.aiVoiceSettings;

  // Merge with current state (do not overwrite userApiKey if not present in backup)
  const mergedState: AppStateSnapshot = {
    ...currentSnapshot,
    ...migratedAppState,
    schemaVersion: 2,
    projects: migratedAppState.projects,
    aiLogs: Array.isArray(migratedAppState.aiLogs) ? migratedAppState.aiLogs : currentSnapshot.aiLogs,
    selfChecks: Array.isArray(migratedAppState.selfChecks) ? migratedAppState.selfChecks : currentSnapshot.selfChecks,
    eventSalesLogs: Array.isArray(migratedAppState.eventSalesLogs) ? migratedAppState.eventSalesLogs : currentSnapshot.eventSalesLogs,
    userApiKey: migratedAppState.userApiKey || currentSnapshot.userApiKey,
    thumbHubEnabled: typeof migratedAppState.thumbHubEnabled === 'boolean' ? migratedAppState.thumbHubEnabled : currentSnapshot.thumbHubEnabled,
    thumbHubPosition: migratedAppState.thumbHubPosition || currentSnapshot.thumbHubPosition,
    ambientLightMode: migratedAppState.ambientLightMode || currentSnapshot.ambientLightMode,
    remindersEnabled: typeof migratedAppState.remindersEnabled === 'boolean' ? migratedAppState.remindersEnabled : currentSnapshot.remindersEnabled,
    aiVoiceSettings: resolvedVoiceSettings,
  };

  // Restore v2-only stores to IDB
  if (isV2) {
    const saves: Promise<void>[] = [];
    if (resolvedVoiceSettings) saves.push(saveAiVoiceSettings(resolvedVoiceSettings));
    if (raw.userPrefs && typeof raw.userPrefs === 'object') {
      saves.push(saveUserPrefs(normalizeUserPrefs(raw.userPrefs)));
    }
    if (raw.blueprints) saves.push(saveIdbItem(STORAGE_KEYS.BLUEPRINTS, raw.blueprints));
    if (raw.photoPins) saves.push(saveIdbItem(STORAGE_KEYS.PHOTO_PINS, raw.photoPins));
    if (raw.aiChat) saves.push(saveIdbItem(STORAGE_KEYS.AI_CHAT, raw.aiChat));
    if (Array.isArray(raw.scannedReceipts)) saves.push(saveIdbItem(STORAGE_KEYS.SCANNED_RECEIPTS, raw.scannedReceipts));
    if (Array.isArray(raw.savedDossiers)) saves.push(saveIdbItem(STORAGE_KEYS.SAVED_DOSSIERS, raw.savedDossiers));
    if (Array.isArray(raw.foremanProposals)) {
      saves.push(saveForemanProposals(raw.foremanProposals));
    }
    if (Array.isArray(raw.dismissedThinkerIds)) {
      saves.push(saveDismissedThinkerIds(raw.dismissedThinkerIds));
    }
    if (Array.isArray(raw.visionCaptures)) {
      saves.push(saveVisionCaptures(raw.visionCaptures));
    }
    if (Array.isArray(raw.offlineAudioMemos)) {
      saves.push(saveOfflineAudioMemos(raw.offlineAudioMemos));
    }
    if (Array.isArray(raw.haccpLogs)) {
      saves.push(saveHaccpLogs(raw.haccpLogs));
    }
    if (Array.isArray(raw.smartHomeSwitches)) {
      saves.push(saveSmartHomeSwitches(raw.smartHomeSwitches));
    }
    if (Array.isArray(raw.pizzaCatalog) && raw.pizzaCatalog.length > 0) {
      saves.push(saveIdbItem(PIZZA_CATALOG_KEY, raw.pizzaCatalog));
    } else {
      warnings.push('Kein Pizza-Katalog im Backup – Stammdaten bleiben unverändert.');
    }
    if (Array.isArray(raw.posSlots)) saves.push(saveIdbItem(POS_SLOTS_KEY, raw.posSlots));
    if (raw.doughCalcDefaults) saves.push(saveIdbItem(DOUGH_CALC_DEFAULTS_KEY, raw.doughCalcDefaults));
    await Promise.all(saves);
  } else {
    if (resolvedVoiceSettings) {
      await saveAiVoiceSettings(resolvedVoiceSettings);
    }
    warnings.push('Altes v1-Backup: Nur App-Status wiederhergestellt. Pizza-Katalog und Prefs bleiben unverändert.');
  }

  await savePersistedState(mergedState);

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

export const importFullBackup = importFullBackupV2;

// ── 1-Klick-Projekt-JSON-Import (an Zielprojekt anhängen) ────────────────────

export function importProjectJsonToTarget(
  raw: any,
  targetProject: Project
): { updatedProject: Project; result: ProjectImportResult } {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Ungültiges Projekt-JSON: Kein Objekt.');
  }

  const migratedIncoming = migrateProject({
    ...raw,
    id: raw.id || targetProject.id,
    name: raw.name || targetProject.name,
    subtitle: raw.subtitle || targetProject.subtitle,
    icon: raw.icon || targetProject.icon,
    accentColor: raw.accentColor || targetProject.accentColor,
    tasks: Array.isArray(raw.tasks)
      ? raw.tasks.map((t: any) => ({
        ...t,
        title: String(t?.title || 'Importierte Aufgabe'),
        lastModified: t?.lastModified || new Date().toISOString(),
        changeReason: t?.changeReason || 'Projekt-JSON-Import',
        source: t?.source || 'Import'
      }))
      : [],
    cart: Array.isArray(raw.cart)
      ? raw.cart.map((c: any) => ({
        ...c,
        title: String(c?.title || 'Importierter Artikel'),
        quantity: String(c?.quantity || '1 Stk'),
        lastModified: c?.lastModified || new Date().toISOString(),
        changeReason: c?.changeReason || 'Projekt-JSON-Import',
        source: c?.source || 'Import'
      }))
      : [],
    knowledge: Array.isArray(raw.knowledge)
      ? raw.knowledge.map((k: any) => ({
        ...k,
        title: String(k?.title || 'Importierter Wissens-Eintrag'),
        lastModified: k?.lastModified || new Date().toISOString(),
        changeReason: k?.changeReason || 'Projekt-JSON-Import',
        source: k?.source || 'Import'
      }))
      : []
  });

  const existingTaskIds = new Set((targetProject.tasks || []).map((t) => t.id));
  const existingCartIds = new Set((targetProject.cart || []).map((c) => c.id));
  const existingKnowledgeIds = new Set((targetProject.knowledge || []).map((k) => k.id));

  const newTasks: TaskItem[] = migratedIncoming.tasks.map((t) => ({
    ...t,
    id: t.id && !existingTaskIds.has(t.id) ? t.id : `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  }));

  const newCart: CartItem[] = migratedIncoming.cart.map((c) => ({
    ...c,
    id: c.id && !existingCartIds.has(c.id) ? c.id : `cart_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  }));

  const newKnowledge: KnowledgeItem[] = migratedIncoming.knowledge.map((k) => ({
    ...k,
    id: k.id && !existingKnowledgeIds.has(k.id) ? k.id : `know_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  }));

  const updatedProject = migrateProject({
    ...targetProject,
    tasks: [...(targetProject.tasks || []), ...newTasks],
    cart: [...(targetProject.cart || []), ...newCart],
    knowledge: [...(targetProject.knowledge || []), ...newKnowledge]
  });

  return {
    updatedProject,
    result: {
      addedTasks: newTasks.length,
      addedCart: newCart.length,
      addedKnowledge: newKnowledge.length
    }
  };
}

