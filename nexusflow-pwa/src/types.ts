export type DomainType = 'business' | 'private';
export type PriorityType = 'Hoch' | 'Mittel' | 'Niedrig';
export type DayBlockId = 'morning' | 'focus' | 'errands' | 'evening' | null;
export type ReminderRecurrence = 'none' | 'daily' | 'weekly';
export type ProjectTabId = 'tasks' | 'cart' | 'knowledge' | 'extras' | 'receipt' | 'research';
export type BackofficeTabId = 'analytics' | 'planner' | 'addons' | 'system';
export type AmbientLightMode = 'off' | 'static' | 'shimmer';
export type VoiceProvider = 'azure-gisela' | 'browser';
export type PreferredModelMode = 'SMART_PRO' | 'ALWAYS_PRO' | 'ALWAYS_FLASH' | string;
export type QuickAiMode = 'flash' | 'research';
export type VoiceInteractionMode = 'quick' | 'collect' | 'dialog';
export type UiDensityMode = 'compact' | 'standard' | 'large';
export type CartOpenMode = 'floating' | 'tab';
export type EnergyLevel = 'low' | 'medium' | 'high';
export type ShoulderTapTone = 'calm' | 'direct';

export interface BanditUserPreferences {
  // Schaltbare ADHS-Unterstützung
  adhdMasterEnabled: boolean;
  adhdFocusAnchor: boolean;
  adhdSingleTaskMode: boolean;
  adhdTwoMinuteStarter: boolean;
  adhdTimeBufferAndHaptics: boolean;
  // Welle 5: Antriebs-Würfel, Energie-Planer & 4-Stufen-Schultertipp
  driveDiceEnabled?: boolean;
  energyPlannerEnabled?: boolean;
  shoulderTapEnabled?: boolean;
  shoulderTapQuietStart?: string;
  shoulderTapQuietEnd?: string;
  shoulderTapTone?: ShoulderTapTone;
  // Personalisierung & Zentrale v2 Toggles
  uiDensity: UiDensityMode;
  aiTone: 'short' | 'partner' | 'coach';
  organicMotion: boolean;
  hapticsEnabled?: boolean;
  cartOpenMode?: CartOpenMode;
  flipCoverAutoDetect?: boolean;
  reminderSystemPushEnabled?: boolean;
  smartHomeEnabled?: boolean;
  appShortcutsEnabled?: boolean;
  shareTargetEnabled?: boolean;
  wakeLockEnabled?: boolean;
  receiptForemanEnabled?: boolean;
  silentThinkerEnabled?: boolean;
  murmurAutopilotEnabled?: boolean;
  generalVisionEnabled?: boolean;
  offlineAudioBufferEnabled?: boolean;
  gastroCartBridgeEnabled?: boolean;
  companionMessageToolsEnabled?: boolean;
  companionQuickChipsEnabled?: boolean;
  companionStartExpanded?: boolean;
  // Welle 6 / Ticket 6.1: Komfort-Politur
  taskExtendedMetaEnabled?: boolean;
  knowledgeStepReadAloudEnabled?: boolean;
  changeHistoryEnabled?: boolean;
  aiLogsViewerEnabled?: boolean;
  // Welle 6 / Ticket 6.1b: Opt-in A+C-Jetzt-Vorbühne
  nowStageEnabled?: boolean;
  // Welle 6 / Ticket 6.2: BYOK- & Open-Source-Starter-Basis
  starterProfile?: 'bandit' | 'neutral';
  onboardingCompleted?: boolean;
  byokStarterToolsEnabled?: boolean;
  quickCommands: string[];
  activeFocusTaskId: string | null;
  activeFocusTaskTitle: string | null;
  activeFocusProjectId: string | null;
}

export interface AiVoiceSettings {
  ttsEnabled: boolean;
  voiceProvider: VoiceProvider;
  azureSpeechKey: string;
  azureSpeechRegion: string;
  preferredModelMode: PreferredModelMode;
  activeAiMode: QuickAiMode;
  continuousListening: boolean;
  autoModeDetection: boolean;
}

export const THEME = {
  bgMain: '#111317',
  bgCard: '#191C22',
  bgSub: '#22262F',
  accentPrimary: '#0D9488',
  accentHighlight: '#14B8A6',
  textMain: '#F1F5F9',
  textMeta: '#94A3B8',
  aiGold: '#E5A93C',
  aiRedDot: '#E5A93C',
  banditRed: '#DC2626'
} as const;

export type CustomMeta = Record<string, unknown>;

export interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'pdf' | 'text';
  mimeType: string;
  size: string;
  dataUrl: string | null;
  textContent?: string | null;
}

export interface ProcurementCheckData {
  ideas: string;
  regionalVsOnline: string;
  searchTerm: string;
}

export interface ChangeLogEntry {
  at: string; // ISO timestamp
  actor: 'user' | 'ai';
  summary: string;
}

export interface SubTaskItem {
  id: string;
  title: string;
  completed: boolean;
  order: number;
  completedAt?: string;
}

export interface TaskItem {
  id: string;
  title: string;
  completed: boolean;
  priority: PriorityType;
  estimatedMinutes: number;
  dayBlock: DayBlockId;
  reminderAt: string;
  reminderRecurrence?: ReminderRecurrence;
  lastReminderFiredAt?: string;
  energyLevel?: EnergyLevel;
  isHurdleTask?: boolean;
  lastShoulderTapStage?: number;
  aiTouched: boolean;
  lastModified: string;
  changeReason: string;
  source: string;
  assemblyGroup?: string;
  subTasks?: SubTaskItem[];
  updatedAt?: string;
  changeLog?: ChangeLogEntry[];
  customMeta: CustomMeta;
}

export type KnowledgeKind = 'explanation' | 'info' | 'reference';

export interface KnowledgeItem {
  id: string;
  kind: KnowledgeKind;
  title: string;
  content: string;
  stepsText?: string;
  attachments?: Attachment[];
  lastModified: string;
  changeReason: string;
  source: string;
  aiTouched: boolean;
  updatedAt?: string;
  changeLog?: ChangeLogEntry[];
  customMeta: CustomMeta;
}

export interface CartItem {
  id: string;
  title: string;
  quantity: string;
  price: string;
  completed: boolean;
  boughtAt?: string;
  aiTouched: boolean;
  lastModified: string;
  changeReason: string;
  source: string;
  procurementCheck?: ProcurementCheckData;
  customMeta: CustomMeta;
}

export type LifecycleType = 'permanent' | 'project';
export type BusinessDomain = DomainType;

export interface Project {
  id: string;
  domain: DomainType;
  /** Dauer-Begleiter ('permanent') vs. zeitliches Projekt ('project'). Default: 'permanent' */
  lifecycle?: LifecycleType;
  /** Betrieblich ('business') vs. privat ('private') – für Exporte/Skripte. Default: entspricht DomainType */
  businessDomain?: BusinessDomain;
  name: string;
  subtitle: string;
  icon: string;
  customLogoUrl: string | null;
  accentColor: string;
  archived?: boolean;
  archivedAt?: string;
  /** Vorschriften-Wächter (⚖️) im Daumen-Fächer anzeigen */
  legalWatchEnabled?: boolean;
  /** Gesamt-Übersicht im Menü ein- oder ausblenden. Default: true */
  overviewEnabled?: boolean;
  customMeta: CustomMeta;
  enabledPlugins: string[];
  enabledTabs?: ('tasks' | 'cart' | 'knowledge' | 'extras')[];
  tasks: TaskItem[];
  knowledge: KnowledgeItem[];
  cart: CartItem[];
}

export type AiActionType =
  | 'ADD_TASK'
  | 'ADD_CART_ITEM'
  | 'ADD_KNOWLEDGE'
  | 'UPDATE_EXPLANATION'
  | 'ADD_INFO'
  | 'CHECK_OFF_TASK';

export interface AiExecutedAction {
  actionId: string;
  actionType: AiActionType;
  targetProjectId: string;
  targetProjectName?: string;
  targetSubTab: 'tasks' | 'cart' | 'knowledge' | 'explanations' | 'infos';
  targetItemId: string;
  shortCheckableTitle: string;
  detailedExplanation: string;
  quantityOrMeasure?: string;
  estimatedPrice?: string;
  changeFooterNote: string;
  undone: boolean;
  assemblyGroup?: string;
}

export interface AiLogEntry {
  id: string;
  timestamp: string;
  rawTranscript?: string;
  rawInput: string;
  summary: string;
  engineUsed?: string;
  engine: string;
  undone: boolean;
  actions: AiExecutedAction[];
}

export interface SelfCheckEntry {
  id: string;
  timestamp: string;
  energy: string;
  focus: string;
  moodTags: string[];
  note: string;
  customMeta: CustomMeta;
}

export interface PosSoldVariety {
  id: string;
  name: string;
  unitPrice: number;
  unitCost: number;
  count: number;
}

export interface EventSalesLog {
  id: string;
  timestamp: string;
  eventName: string;
  projectId: string;
  totalPizzas: number;
  grossRevenue: number;
  totalRevenue?: number;
  cogsTotal: number;
  grossProfit: number;
  firetruckTipFund: number;
  items: PosSoldVariety[];
}

// ── Pizza-Katalog & POS-Slot-Datenmodell (Paket 3) ──────────────────────────

/** Stammdaten-Eintrag für eine Pizza-Sorte im IndexedDB-Katalog */
export interface PizzaCatalogItem {
  id: string;
  title: string;
  price: number;
  portionScope: string;
  doughWeightGrams?: number;
  unitCost?: number;
}

/** Aktiver Zähler-Slot im POS-Clicker – kann lokal überschrieben sein */
export interface PosPizzaSlot {
  slotId: string;
  catalogId: string | null;
  title: string;
  price: number;
  portionScope: string;
  unitCost: number;
  count: number;
  isLocallyOverridden: boolean;
}

/** Persistente Vorgaben für den Teigballen-Kalkulator */
export interface DoughCalcDefaults {
  defaultBallWeightGrams: number;
  defaultHydrationPercent: number;
  defaultBallsPerBox: number;
}

export interface AppStateSnapshot {
  schemaVersion?: number;
  projects: Project[];
  aiLogs: AiLogEntry[];
  selfChecks: SelfCheckEntry[];
  eventSalesLogs: EventSalesLog[];
  userApiKey: string;
  realityCheckEnabled: boolean;
  haWebhookUrl: string;
  haEmbedUrl: string;
  thumbHubEnabled?: boolean;
  thumbHubPosition?: 'left' | 'center' | 'right';
  ambientLightMode?: AmbientLightMode;
  remindersEnabled?: boolean;
  aiVoiceSettings?: AiVoiceSettings;
}

export interface PluginContextProps {
  project: Project;
  onUpdateProjectMeta: (patch: CustomMeta) => void;
  onAddCartItems: (items: Array<{ title: string; quantity: string; price?: string; reason?: string }>) => void;
  onAddInfoCard?: (title: string, content: string) => void;
  onRecordEventSale: (entry: EventSalesLog) => void;
  onNotify: (msg: string) => void;
  gastroCartBridgeEnabled?: boolean;
  openCartTitles?: string[];
  onAddRestockItemsToCart?: (
    items: Array<{ title: string; quantity: string; price?: string; reason?: string }>
  ) => void;
}

export interface PluginDefinition {
  id: string;
  name: string;
  shortLabel: string;
  description: string;
  recommendedDomains: Array<DomainType | 'arbeit' | 'privat'>;
  metaKeysUsed: string[];
  render: (ctx: PluginContextProps) => JSX.Element;
}

// ── Voll-Backup v2 & Projekt-Import Datenmodell ─────────────────────────────

export interface ScannedReceiptItem {
  title: string;
  quantity: string;
  price: string;
}

export interface ScannedReceipt {
  id: string;
  projectId?: string;
  projectName?: string;
  storeName: string;
  purchaseDate: string;
  totalAmount: string;
  items: ScannedReceiptItem[];
  createdAt?: string;
  reconciled?: boolean;
  netAmount?: number;
  vatAmount?: number;
  vatRate?: number;
  category?: string;
  reconciledAt?: string;
  reconciledCount?: number;
}

export interface FullBackupV2 {
  backupVersion: 2;
  exportedAt: string;
  appState: AppStateSnapshot;
  userPrefs: any;
  blueprints: any;
  photoPins: any;
  aiChat: any;
  scannedReceipts: ScannedReceipt[];
  savedDossiers: any[];
  foremanProposals?: ForemanProposal[];
  dismissedThinkerIds?: string[];
  visionCaptures?: VisionCaptureItem[];
  offlineAudioMemos?: OfflineAudioMemo[];
  haccpLogs?: HaccpLogEntry[];
  smartHomeSwitches?: SmartHomeSwitchItem[];
  pizzaCatalog: PizzaCatalogItem[];
  posSlots: PosPizzaSlot[];
  doughCalcDefaults: DoughCalcDefaults;
}

export interface HaccpLogEntry {
  id: string;
  projectId: string;
  dateISO: string; // YYYY-MM-DD
  timestamp: string;
  eventLabel: string;
  fridgeTempC?: number | null;
  saladetteTempC?: number | null;
  hotWaterOk: boolean;
  checks: {
    surfacesSanitized: boolean;
    handwashReady: boolean;
    coolingChainOk: boolean;
    endCleaningDone: boolean;
  };
  notes?: string;
}

export interface SmartHomeSwitchItem {
  id: string;
  label: string;
  endpointUrl: string;
  method: 'POST' | 'GET';
  lastTriggeredAt?: string;
}

export type ForemanProposalKind = 'murmur-research' | 'thinker-contradiction';
export type ForemanProposalStatus = 'pending' | 'snoozed' | 'accepted' | 'dismissed';

export interface ForemanProposalAction {
  type: 'add-cart' | 'add-task' | 'add-knowledge' | 'dedupe-cart' | 'mark-cart-bought';
  label: string;
  projectId: string;
  payload: {
    title?: string;
    quantity?: string;
    notes?: string;
    content?: string;
    removeCartItemIds?: string[];
    cartItemId?: string;
  };
}

export interface ForemanProposal {
  id: string;
  kind: ForemanProposalKind;
  projectId: string;
  title: string;
  summary: string;
  detail?: string;
  status: ForemanProposalStatus;
  createdAt: string;
  snoozedUntil?: string;
  actions: ForemanProposalAction[];
}

export type VisionCaptureCategory = 'nameplate' | 'sketch' | 'site-photo';

export interface VisionCaptureItem {
  id: string;
  projectId: string;
  category: VisionCaptureCategory;
  title: string;
  summary: string;
  extractedSpecs: string[];
  suggestedCartItems?: string[];
  suggestedTaskTitle?: string;
  thumbnailDataUrl?: string;
  createdAt: string;
}

export interface OfflineAudioMemo {
  id: string;
  projectId: string;
  createdAt: string;
  durationSec: number;
  mimeType: string;
  audioDataUrl?: string;
  noteText?: string;
  status: 'queued' | 'processing' | 'transcribed' | 'error';
  transcript?: string;
  errorMessage?: string;
}

export interface BackupImportResult {
  projectCount: number;
  taskCount: number;
  cartCount: number;
  knowledgeCount: number;
  pizzaVarietyCount: number;
  warnings: string[];
}

export interface ProjectImportResult {
  addedTasks: number;
  addedCart: number;
  addedKnowledge: number;
}
