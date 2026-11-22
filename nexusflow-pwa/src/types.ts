export type DomainType = 'business' | 'private' | 'arbeit' | 'privat';
export type PriorityType = 'Hoch' | 'Mittel' | 'Niedrig';
export type DayBlockId = 'morning' | 'focus' | 'errands' | 'evening' | null;
export type ProjectTabId = 'tasks' | 'cart' | 'knowledge' | 'extras' | 'explanations' | 'infos';
export type BackofficeTabId = 'analytics' | 'planner' | 'addons' | 'system';

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
  summaryText?: string | null;
}

export interface ProcurementCheckData {
  ideas: string;
  regionalVsOnline: string;
  searchTerm: string;
}

export interface TaskItem {
  id: string;
  title: string;
  completed: boolean;
  priority: PriorityType;
  estimatedMinutes: number;
  dayBlock: DayBlockId;
  reminderAt: string;
  aiTouched: boolean;
  lastModified: string;
  changeReason: string;
  source: string;
  assemblyGroup?: string;
  customMeta: CustomMeta;
}

export interface ExplanationItem {
  id: string;
  title: string;
  stepsText: string;
  lastModified: string;
  changeReason: string;
  source: string;
  aiTouched: boolean;
  customMeta: CustomMeta;
}

export interface InfoItem {
  id: string;
  title: string;
  content: string;
  attachments: Attachment[];
  lastModified: string;
  changeReason: string;
  source: string;
  aiTouched: boolean;
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
  customMeta: CustomMeta;
}

export interface CartItem {
  id: string;
  title: string;
  quantity: string;
  price: string;
  completed: boolean;
  aiTouched: boolean;
  lastModified: string;
  changeReason: string;
  source: string;
  procurementCheck?: ProcurementCheckData;
  customMeta: CustomMeta;
}

export type LifecycleType = 'permanent' | 'project';
export type BusinessDomain = 'business' | 'private';

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
  customMeta: CustomMeta;
  enabledPlugins: string[];
  enabledTabs?: ('tasks' | 'cart' | 'knowledge' | 'extras')[];
  tasks: TaskItem[];
  knowledge?: KnowledgeItem[];
  explanations: ExplanationItem[];
  infos: InfoItem[];
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

export interface AppStateSnapshot {
  projects: Project[];
  aiLogs: AiLogEntry[];
  selfChecks: SelfCheckEntry[];
  eventSalesLogs: EventSalesLog[];
  userApiKey: string;
  realityCheckEnabled: boolean;
  haWebhookUrl: string;
  haEmbedUrl: string;
}

export interface PluginContextProps {
  project: Project;
  onUpdateProjectMeta: (patch: CustomMeta) => void;
  onAddCartItems: (items: Array<{ title: string; quantity: string; price?: string; reason?: string }>) => void;
  onAddInfoCard?: (title: string, content: string) => void;
  onRecordEventSale: (entry: EventSalesLog) => void;
  onNotify: (msg: string) => void;
}

export interface PluginDefinition {
  id: string;
  name: string;
  shortLabel: string;
  description: string;
  recommendedDomains: DomainType[];
  metaKeysUsed: string[];
  render: (ctx: PluginContextProps) => JSX.Element;
}