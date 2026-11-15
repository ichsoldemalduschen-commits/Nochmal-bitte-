export type DomainType = 'arbeit' | 'privat';
export type PriorityType = 'Hoch' | 'Mittel' | 'Niedrig';
export type DayBlockId = 'morning' | 'focus' | 'errands' | 'evening' | null;
export type ProjectTabId = 'tasks' | 'explanations' | 'infos' | 'cart' | 'extras';
export type BackofficeTabId = 'analytics' | 'planner' | 'addons' | 'system';

export const THEME = {
  bgMain: '#181A1B',
  bgCard: '#24292E',
  bgSub: '#2F363D',
  accentPrimary: '#0A9396',
  accentHighlight: '#14B8A6',
  textMain: '#F8F9FA',
  textMeta: '#9CA3AF',
  aiRedDot: '#EF4444',
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

export interface Project {
  id: string;
  domain: DomainType;
  name: string;
  subtitle: string;
  icon: string;
  customLogoUrl: string | null;
  accentColor: string;
  archived: boolean;
  archivedAt?: string;
  customMeta: CustomMeta;
  enabledPlugins: string[];
  tasks: TaskItem[];
  explanations: ExplanationItem[];
  infos: InfoItem[];
  cart: CartItem[];
}

export type AiActionType =
  | 'ADD_TASK'
  | 'ADD_CART_ITEM'
  | 'UPDATE_EXPLANATION'
  | 'ADD_INFO'
  | 'CHECK_OFF_TASK';

export interface AiExecutedAction {
  actionId: string;
  actionType: AiActionType;
  targetProjectId: string;
  targetSubTab: 'tasks' | 'explanations' | 'infos' | 'cart';
  targetItemId: string;
  shortCheckableTitle: string;
  detailedExplanation: string;
  quantityOrMeasure?: string;
  estimatedPrice?: string;
  changeFooterNote: string;
  undone: boolean;
}

export interface AiLogEntry {
  id: string;
  timestamp: string;
  rawInput: string;
  summary: string;
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
  onAddInfoCard: (title: string, content: string) => void;
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