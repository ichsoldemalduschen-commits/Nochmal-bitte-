import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Brain,
  CalendarClock,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Compass,
  Copy,
  Database,
  Download,
  FolderArchive,
  HeartHandshake,
  Key,
  Loader2,
  Palette,
  Plus,
  Puzzle,
  RefreshCw,
  Settings,
  Sliders,
  Smartphone,
  Trash2,
  Upload,
  Volume2,
  Webhook,
  X
} from 'lucide-react';
import {
  AiExecutedAction,
  AiLogEntry,
  AppStateSnapshot,
  BackofficeTabId,
  DayBlockId,
  EventSalesLog,
  Project,
  SelfCheckEntry,
  THEME
} from '../types';
import { PLUGIN_REGISTRY } from '../plugins/registry';
import {
  STORAGE_KEYS,
  downloadProjectJson,
  getAzureSpeechKey,
  getAzureSpeechRegion,
  getIdbItemSync,
  saveAzureSpeechKey,
  saveAzureSpeechRegion,
  saveIdbItem
} from '../services/storage';
import {
  BanditUserPreferences,
  getPreferredModelMode,
  loadUserPrefs,
  saveUserPrefs,
  setPreferredModelMode,
  testGeminiApiKey,
  testGiselaVoice
} from '../services/aiRouter';
import { exportDayPlanIcs, exportSalesLogsCsv } from '../services/exportBridge';

interface BlueprintTemplate {
  id: string;
  name: string;
  tasks: string[];
  cart: string[];
}

const BLUEPRINT_STORAGE_KEY = 'banditos_blueprints_v3';

export type ZentraleSectionId = 'projects' | 'focus' | 'ai' | 'system';

interface BackofficeWorkspaceProps {
  activeTab: BackofficeTabId;
  projects: Project[];
  aiLogs: AiLogEntry[];
  selfChecks: SelfCheckEntry[];
  eventSalesLogs: EventSalesLog[];
  userApiKey: string;
  realityCheckEnabled: boolean;
  haWebhookUrl: string;
  haEmbedUrl: string;
  initialSection?: ZentraleSectionId | null;
  onChangeTab: (tab: BackofficeTabId) => void;
  onCloseBackoffice: () => void;
  onJumpToAction: (act: AiExecutedAction) => void;
  onUndoAiAction: (logId: string, actionId: string) => void;
  onMoveAiAction: (logId: string, actionId: string, newProjectId: string) => void;
  onToggleArchiveProject: (projectId: string) => void;
  onUpdateProject?: (projectId: string, patch: Partial<Project>) => void;
  onAssignDayBlock: (projectId: string, taskId: string, block: DayBlockId | null) => void;
  onAutoStructureDay: () => void;
  onTogglePluginForProject: (projectId: string, pluginId: string) => void;
  onToggleTabForProject?: (projectId: string, tab: 'tasks' | 'cart' | 'knowledge' | 'extras') => void;
  onSaveScratchpadToProject: (projectId: string, title: string, content: string) => void;
  onChangeApiKey: (key: string) => void;
  onToggleRealityCheck: () => void;
  onChangeHaWebhook: (url: string) => void;
  onOpenFlip7Cover: () => void;
  onOpenRealityModal?: () => void;
  onOpenSelfCheckModal?: () => void;
  onResetProjectStructure?: () => void;
  onExportFullBackup: () => void;
  onImportFullBackup: (snapshot: AppStateSnapshot) => void;
  onUploadProjectLogo?: (projectId: string, file: File) => void;
  onResetProjectLogo?: (projectId: string) => void;
  thumbHubEnabled?: boolean;
  thumbHubPosition?: 'left' | 'center' | 'right';
  onToggleThumbHub?: (enabled: boolean) => void;
  onChangeThumbHubPosition?: (pos: 'left' | 'center' | 'right') => void;
  onNotify: (msg: string) => void;
}

// Keep old AccordionSectionId as internal alias for backward compat
type AccordionSectionId = ZentraleSectionId;

/* ─── Color Presets for project accent color ─── */
const COLOR_PRESETS = [
  { hex: '#0D9488', label: 'Petrol' },
  { hex: '#D96B43', label: 'Terrakotta' },
  { hex: '#8B7EC8', label: 'Rauch-Violett' },
  { hex: '#7C9062', label: 'Oliv-Moos' },
  { hex: '#C4B89B', label: 'Kalk-Sand' }
];

export const BackofficeWorkspace: React.FC<BackofficeWorkspaceProps> = ({
  projects,
  eventSalesLogs,
  userApiKey,
  initialSection,
  onCloseBackoffice,
  onToggleArchiveProject,
  onUpdateProject,
  onAssignDayBlock,
  onAutoStructureDay,
  onTogglePluginForProject,
  onToggleTabForProject,
  onSaveScratchpadToProject,
  onChangeApiKey,
  onOpenFlip7Cover,
  onOpenRealityModal,
  onOpenSelfCheckModal,
  onResetProjectStructure,
  onExportFullBackup,
  onImportFullBackup,
  onUploadProjectLogo,
  onResetProjectLogo,
  thumbHubEnabled = true,
  thumbHubPosition = 'center',
  onToggleThumbHub,
  onChangeThumbHubPosition,
  onNotify
}) => {
  const [openSection, setOpenSection] = useState<AccordionSectionId | null>(initialSection || null);
  const [prefs, setPrefs] = useState<BanditUserPreferences>(loadUserPrefs);
  const [newQuickCmd, setNewQuickCmd] = useState('');
  const [expandedProjectIds, setExpandedProjectIds] = useState<Record<string, boolean>>({});

  // Auto-open section when initialSection changes (deep-link)
  useEffect(() => {
    if (initialSection) {
      setOpenSection(initialSection);
    }
  }, [initialSection]);

  const toggleProjectExpand = (id: string) => {
    setExpandedProjectIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Update 6 (Erweiterung): Vorlagen-Tresor (Blueprints)
  const [blueprints, setBlueprints] = useState<BlueprintTemplate[]>(() => {
    return getIdbItemSync<BlueprintTemplate[]>(STORAGE_KEYS.BLUEPRINTS, [
      {
        id: 'bp-event',
        name: 'Standard-Event Vor-Ort-Checkliste (Pizza Bandit)',
        tasks: [
          '[Vorbereitung] Gasflaschen (2x 11kg) + 50 mbar Regler prüfen',
          '[Vorbereitung] Frischwasser- & Abwasserkanister einsetzen',
          '[Vorbereitung] Euroboxen mit Teigballen verladen',
          '[Vor Ort] Saladette-Lift auf 92 cm Arbeitshöhe arretieren'
        ],
        cart: ['Einweghandschuhe Nitril', 'Pizzakartons / Servietten']
      }
    ]);
  });
  const [selectedBlueprintProjectId, setSelectedBlueprintProjectId] = useState(
    projects[0]?.id || 'proj-foodtruck'
  );
  const [newBlueprintName, setNewBlueprintName] = useState('');

  const [modelMode, setModelMode] = useState<string>(getPreferredModelMode);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [apiTestStatus, setApiTestStatus] = useState<{
    loading: boolean;
    ok?: boolean;
    text?: string;
  }>({ loading: false });

  const [azureSpeechKey, setAzureSpeechKey] = useState<string>(getAzureSpeechKey);
  const [azureSpeechRegion, setAzureSpeechRegion] = useState<string>(getAzureSpeechRegion);
  const [giselaTesting, setGiselaTesting] = useState(false);
  const [giselaTestStatus, setGiselaTestStatus] = useState<{
    ok: boolean;
    engine: 'azure-gisela' | 'browser-fallback';
    message: string;
  } | null>(null);

  const updatePrefs = (patch: Partial<BanditUserPreferences>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    saveUserPrefs(next);
  };

  const toggleSection = (id: AccordionSectionId) => {
    setOpenSection((prev) => (prev === id ? null : id));
  };

  const handleTestKey = async () => {
    setApiTestStatus({ loading: true });
    const res = await testGeminiApiKey(userApiKey);
    if (res.availableModels) setAvailableModels(res.availableModels);
    setApiTestStatus({ loading: false, ok: res.ok, text: res.message });
  };

  const handleTestGiselaVoice = async () => {
    setGiselaTesting(true);
    setGiselaTestStatus(null);
    try {
      const res = await testGiselaVoice(azureSpeechKey, azureSpeechRegion);
      setGiselaTestStatus(res);
    } catch (e: any) {
      setGiselaTestStatus({
        ok: false,
        engine: 'browser-fallback',
        message: `Fehler beim Test: ${e?.message || 'Unbekannt'}`
      });
    } finally {
      setGiselaTesting(false);
    }
  };

  const handleSaveCurrentProjectAsBlueprint = () => {
    const proj = projects.find((p) => p.id === selectedBlueprintProjectId);
    if (!proj) return;
    const bp: BlueprintTemplate = {
      id: `bp-${Date.now()}`,
      name: newBlueprintName.trim() || `Vorlage: ${proj.name}`,
      tasks: proj.tasks.map((t) => t.title),
      cart: proj.cart.map((c) => c.title)
    };
    const next = [bp, ...blueprints];
    setBlueprints(next);
    saveIdbItem(STORAGE_KEYS.BLUEPRINTS, next);
    setNewBlueprintName('');
    onNotify(`Vorlage "${bp.name}" im Tresor gespeichert.`);
  };

  const handleBackupUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result)) as AppStateSnapshot;
        if (parsed && Array.isArray(parsed.projects)) onImportFullBackup(parsed);
      } catch {
        onNotify('Ungültige JSON-Backup-Datei.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleProjectLogoUpload = (projectId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target?.files?.[0];
      if (file && onUploadProjectLogo) {
        onUploadProjectLogo(projectId, file);
      }
    };
    input.click();
  };

  const activeProjects = projects.filter((p) => !p.archived);
  const allOpenTasks = activeProjects.flatMap((p) =>
    p.tasks.filter((t) => !t.completed).map((t) => ({ project: p, task: t }))
  );

  /* ─── Reusable Accordion Header ─── */
  const SectionHeader: React.FC<{
    sectionId: AccordionSectionId;
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    badge?: React.ReactNode;
  }> = ({ sectionId, icon, title, subtitle, badge }) => (
    <button
      type="button"
      onClick={() => toggleSection(sectionId)}
      className="w-full min-h-[56px] p-4 flex items-center justify-between text-left active:bg-white/5 transition"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {icon}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-white flex items-center gap-2 flex-wrap">
            <span>{title}</span>
            {badge}
          </div>
          <div className="text-xs text-[#94A3B8]">{subtitle}</div>
        </div>
      </div>
      {openSection === sectionId ? (
        <ChevronUp className="w-4 h-4 text-[#94A3B8] shrink-0 ml-2" />
      ) : (
        <ChevronDown className="w-4 h-4 text-[#94A3B8] shrink-0 ml-2" />
      )}
    </button>
  );

  return (
    <div className="max-w-lg mx-auto space-y-3.5 pb-24">
      {/* ════════ KOPFZEILE: ZENTRALE ════════ */}
      <div
        className="p-4 rounded-3xl border border-white/5 flex items-center justify-between shadow-lg"
        style={{ backgroundColor: '#191C22' }}
      >
        <div>
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-white">
            BANDIT.OS Zentrale
          </h2>
          <p className="text-xs text-[#94A3B8]">
            Projekte, Fokus, KI &amp; System
          </p>
        </div>
        <button
          onClick={onCloseBackoffice}
          className="min-h-[44px] px-4 py-2 rounded-2xl text-xs font-bold text-white flex items-center gap-2 active:scale-95 transition shadow-sm"
          style={{ backgroundColor: THEME.accentPrimary }}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Zurück</span>
        </button>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
           BEREICH 1: PROJEKTE & WERKZEUGE
         ════════════════════════════════════════════════════════════════════ */}
      <div
        className="rounded-3xl border border-white/5 overflow-hidden shadow-md"
        style={{ backgroundColor: '#191C22' }}
      >
        <SectionHeader
          sectionId="projects"
          icon={<Settings className="w-5 h-5 text-[#14B8A6]" />}
          title="Projekte & Werkzeuge"
          subtitle={`${projects.length} Projekte · Module, Farben & Export`}
        />

        {openSection === 'projects' && (
          <div className="px-4 pb-4 pt-2 border-t border-white/5 space-y-3 bg-[#191C22]/70">
            {/* ── Projekt-Liste ── */}
            <div className="space-y-3">
              {projects.map((proj) => {
                const currentTabs = proj.enabledTabs || ['tasks', 'cart', 'knowledge', 'extras'];
                const isExpanded = !!expandedProjectIds[proj.id];
                const isPrivate = proj.domain === 'privat' || proj.domain === 'private';
                const isPermanent = proj.lifecycle !== 'project';
                const modules: Array<{ id: 'tasks' | 'cart' | 'knowledge' | 'extras'; label: string }> = [
                  { id: 'tasks', label: 'Tasks' },
                  { id: 'cart', label: 'Einkauf' },
                  { id: 'knowledge', label: 'Wissen' },
                  { id: 'extras', label: 'Extras' }
                ];

                return (
                  <div
                    key={proj.id}
                    className={`rounded-2xl border transition-all overflow-hidden ${
                      proj.archived ? 'bg-[#181A1B]/70 border-white/5 opacity-85' : 'bg-[#111317] border-white/10'
                    }`}
                  >
                    {/* ── Projekt Kopfzeile (NUR Farbpunkt + voller Name + Pfeil, 390px-Fix) ── */}
                    <button
                      type="button"
                      onClick={() => toggleProjectExpand(proj.id)}
                      className="w-full min-h-[52px] p-3.5 flex items-center justify-between gap-3 text-left active:bg-white/5 transition"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/20"
                          style={{ backgroundColor: proj.accentColor || '#14B8A6' }}
                        />
                        <span className="text-sm font-bold text-white break-words min-w-0">
                          {proj.name}
                          {proj.archived && (
                            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                              Archiviert
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="shrink-0">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-[#94A3B8]" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-[#94A3B8]" />
                        )}
                      </div>
                    </button>

                    {/* ── Aufgeklappter Bearbeitungsbereich ── */}
                    {isExpanded && (
                      <div className="px-3.5 pb-4 pt-3 border-t border-white/5 space-y-3 text-xs animate-fadeIn">
                        {/* Status-Badges (ehemals in Kopfzeile) */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded font-semibold ${
                              isPermanent
                                ? 'bg-emerald-500/15 text-emerald-300'
                                : 'bg-amber-500/15 text-amber-300'
                            }`}
                          >
                            {isPermanent ? 'Dauer-Begleiter' : 'Projekt'}
                          </span>
                          <span className="text-[#94A3B8]">•</span>
                          <span
                            className={`px-2 py-0.5 rounded font-semibold ${
                              isPrivate
                                ? 'bg-purple-500/15 text-purple-300'
                                : 'bg-teal-500/15 text-teal-300'
                            }`}
                          >
                            {isPrivate ? 'Privat' : 'Business'}
                          </span>
                        </div>

                        {/* Projekt-Bild tauschen (umgezogen aus Header) */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleProjectLogoUpload(proj.id)}
                            className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-2 active:scale-95 transition border border-white/10 bg-[#242930] hover:bg-[#2A3038]"
                          >
                            <Camera className="w-4 h-4 text-[#14B8A6]" />
                            <span>Bild ändern</span>
                          </button>
                          {onResetProjectLogo && (
                            <button
                              type="button"
                              onClick={() => onResetProjectLogo(proj.id)}
                              className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold text-[#94A3B8] hover:text-white bg-[#242930] border border-white/5 active:scale-95 transition"
                            >
                              Standard-Logo
                            </button>
                          )}
                        </div>

                        {/* Name bearbeiten */}
                        <div className="space-y-1">
                          <label className="text-[#94A3B8] font-medium block">Projekt-Name:</label>
                          <input
                            type="text"
                            value={proj.name}
                            onChange={(e) => onUpdateProject?.(proj.id, { name: e.target.value })}
                            className="w-full min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#181A1B] text-white border border-white/10 focus:outline-none focus:border-[#14B8A6]"
                          />
                        </div>

                        {/* Farbe bearbeiten – neue Presets */}
                        <div className="space-y-1">
                          <label className="text-[#94A3B8] font-medium block">Akzentfarbe:</label>
                          <div className="flex items-center gap-2 flex-wrap">
                            <input
                              type="text"
                              value={proj.accentColor || '#14B8A6'}
                              onChange={(e) =>
                                onUpdateProject?.(proj.id, { accentColor: e.target.value })
                              }
                              className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-mono bg-[#181A1B] text-white border border-white/10 focus:outline-none focus:border-[#14B8A6] min-w-0"
                            />
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap pt-1">
                            {COLOR_PRESETS.map((c) => (
                              <button
                                type="button"
                                key={c.hex}
                                onClick={() => onUpdateProject?.(proj.id, { accentColor: c.hex })}
                                className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center bg-[#181A1B] border border-white/10 active:scale-95 transition"
                                title={`${c.label} ${c.hex}`}
                                aria-label={`${c.label} ${c.hex}`}
                              >
                                <span
                                  className="w-5 h-5 rounded-full border border-white/30"
                                  style={{ backgroundColor: c.hex }}
                                />
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Lifecycle-Wahl: Dauer-Begleiter vs. Austausch-Projekt */}
                        <div className="space-y-1">
                          <label className="text-[#94A3B8] font-medium block">
                            Lebenszyklus (Dauer-Begleiter vs. Projekt):
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateProject?.(proj.id, { lifecycle: 'permanent' })
                              }
                              className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border transition active:scale-95 ${
                                isPermanent
                                  ? 'bg-[#0A9396] text-white border-[#14B8A6]'
                                  : 'bg-[#181A1B] text-[#94A3B8] border-white/10 hover:text-white'
                              }`}
                            >
                              Dauer-Begleiter (permanent)
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateProject?.(proj.id, { lifecycle: 'project' })
                              }
                              className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border transition active:scale-95 ${
                                !isPermanent
                                  ? 'bg-[#D97706] text-white border-[#F59E0B]'
                                  : 'bg-[#181A1B] text-[#94A3B8] border-white/10 hover:text-white'
                              }`}
                            >
                              Austausch-Projekt (project)
                            </button>
                          </div>
                        </div>

                        {/* Domain-Wahl: Business vs. Private */}
                        <div className="space-y-1">
                          <label className="text-[#94A3B8] font-medium block">
                            Bereich (Geschäftlich vs. Privat):
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateProject?.(proj.id, {
                                  domain: 'business',
                                  businessDomain: 'business'
                                })
                              }
                              className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border transition active:scale-95 ${
                                !isPrivate
                                  ? 'bg-[#0A9396] text-white border-[#14B8A6]'
                                  : 'bg-[#181A1B] text-[#94A3B8] border-white/10 hover:text-white'
                              }`}
                            >
                              Business (Gewerblich)
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateProject?.(proj.id, {
                                  domain: 'private',
                                  businessDomain: 'private'
                                })
                              }
                              className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border transition active:scale-95 ${
                                isPrivate
                                  ? 'bg-[#4F46E5] text-white border-[#818CF8]'
                                  : 'bg-[#181A1B] text-[#94A3B8] border-white/10 hover:text-white'
                              }`}
                            >
                              Privat (Persönlich)
                            </button>
                          </div>
                        </div>

                        {/* Aktive Module (enabledTabs) */}
                        <div className="space-y-1">
                          <label className="text-[#94A3B8] font-medium block">
                            Aktive Modul-Bereiche ({currentTabs.length} / 4 aktiv):
                          </label>
                          <div className="grid grid-cols-4 gap-1.5">
                            {modules.map((m) => {
                              const isEnabled = currentTabs.includes(m.id);
                              return (
                                <button
                                  type="button"
                                  key={m.id}
                                  onClick={() => onToggleTabForProject?.(proj.id, m.id)}
                                  className={`min-h-[44px] px-2 py-1.5 rounded-xl text-xs font-bold border flex items-center justify-center transition active:scale-95 ${
                                    isEnabled
                                      ? 'bg-[#0A9396] text-white border-[#14B8A6]'
                                      : 'bg-[#181A1B] text-[#94A3B8] border-white/10 hover:text-white'
                                  }`}
                                >
                                  {m.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Vorschriften-Wächter (⚖️) Schalter pro Projekt */}
                        <div className="p-3 rounded-2xl bg-[#181A1B] border border-white/5 flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-white flex items-center gap-1.5">
                              <span>Vorschriften-Wächter (⚖️) im Fächer anzeigen</span>
                            </div>
                            <div className="text-xs text-[#94A3B8]">
                              {proj.legalWatchEnabled !== false
                                ? 'Im Daumen-Fächer aktiv'
                                : 'Ausgeblendet (geschlossene Schublade)'}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateProject?.(proj.id, {
                                legalWatchEnabled: !(proj.legalWatchEnabled !== false)
                              })
                            }
                            className={`min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs font-bold border transition shrink-0 active:scale-95 ${
                              proj.legalWatchEnabled !== false
                                ? 'bg-[#0A9396] text-white border-[#14B8A6]'
                                : 'bg-[#242930] text-[#94A3B8] border-white/10 hover:text-white'
                            }`}
                          >
                            {proj.legalWatchEnabled !== false ? 'An' : 'Aus'}
                          </button>
                        </div>

                        {/* Einzel-JSON-Export & Archivieren */}
                        <div className="flex gap-2 flex-wrap pt-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadProjectJson(proj);
                              onNotify(`Projekt "${proj.name}" als JSON heruntergeladen.`);
                            }}
                            className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#242930] hover:bg-[#2A3038] text-white border border-white/10 flex items-center gap-1.5 active:scale-95 transition"
                            title="Einzelnes Projekt als JSON sichern"
                          >
                            <Download className="w-3.5 h-3.5 text-[#14B8A6]" />
                            <span>JSON</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleArchiveProject(proj.id);
                            }}
                            className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold border active:scale-95 transition ${
                              proj.archived
                                ? 'bg-[#0A9396] text-white border-[#14B8A6]'
                                : 'bg-[#242930] text-[#94A3B8] hover:text-white border-white/10'
                            }`}
                          >
                            {proj.archived ? 'Reaktivieren' : 'Archivieren'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ── Plugins pro Projekt ── */}
            {PLUGIN_REGISTRY.map((plugin) => (
              <div
                key={plugin.id}
                className="p-3 rounded-2xl bg-[#242930] border border-white/5 space-y-2"
              >
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Puzzle className="w-4 h-4 text-[#14B8A6]" />
                  <span>{plugin.name}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {activeProjects.map((proj) => {
                    const enabled = (proj.enabledPlugins || []).includes(plugin.id);
                    return (
                      <button
                        type="button"
                        key={proj.id}
                        onClick={() => onTogglePluginForProject(proj.id, plugin.id)}
                        className={`min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-bold border transition active:scale-95 ${
                          enabled
                            ? 'bg-[#0A9396] text-white border-[#14B8A6]'
                            : 'bg-[#181A1B] text-[#94A3B8] border-white/10 hover:text-white'
                        }`}
                      >
                        {proj.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {onResetProjectStructure && (
              <button
                type="button"
                onClick={onResetProjectStructure}
                className="w-full min-h-[44px] py-2 px-3 rounded-xl text-xs font-bold bg-amber-500 text-black flex items-center justify-center gap-2 active:scale-95 transition"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Projekt-Stammdaten aktualisieren</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════
           BEREICH 2: FOKUS, BEDIENUNG & OPTIK
         ════════════════════════════════════════════════════════════════════ */}
      <div
        className="rounded-3xl border border-white/5 overflow-hidden shadow-md"
        style={{ backgroundColor: '#191C22' }}
      >
        <SectionHeader
          sectionId="focus"
          icon={<Brain className="w-5 h-5 text-[#14B8A6]" />}
          title="Fokus, Bedienung & Optik"
          subtitle="ADHS, Personalisierung, Tagesplaner & Cover-Display"
          badge={
            prefs.adhdMasterEnabled ? (
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" title="ADHS-Helfer aktiv" />
            ) : undefined
          }
        />

        {openSection === 'focus' && (
          <div className="px-4 pb-4 pt-2 border-t border-white/5 space-y-4 bg-[#191C22]/70">
            {/* ── Unterabschnitt: ADHS & FOKUS ── */}
            <div className="space-y-3">
              <div className="text-xs font-extrabold uppercase tracking-wider text-[#94A3B8] px-1 pt-1">
                ADHS- & Fokus-Unterstützung
              </div>
              {/* Hauptschalter */}
              <div className="p-3.5 rounded-2xl bg-[#242930] border border-white/5 flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-white">
                    ADHS-Unterstützung insgesamt
                  </div>
                  <div className="text-xs text-[#94A3B8]">
                    Hauptschalter für alle 4 Hintergrund-Helfer
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => updatePrefs({ adhdMasterEnabled: !prefs.adhdMasterEnabled })}
                  className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold text-white active:scale-95 transition"
                  style={{
                    backgroundColor: prefs.adhdMasterEnabled ? THEME.accentPrimary : '#374151'
                  }}
                >
                  {prefs.adhdMasterEnabled ? 'Eingeschaltet' : 'Ausgeschaltet'}
                </button>
              </div>

              {prefs.adhdMasterEnabled && (
                <div className="space-y-2 pt-1">
                  {[
                    {
                      key: 'adhdFocusAnchor' as const,
                      title: '1. „Wo war ich gerade?"-Anker (Roter Faden)',
                      desc: 'Pinnt die aktuell bearbeitete Aufgabe dauerhaft oben an'
                    },
                    {
                      key: 'adhdSingleTaskMode' as const,
                      title: '2. „1-Fokus-Blende" gegen Aufgaben-Paralyse',
                      desc: 'Schalter in den Tasks, der nur den nächsten einzelnen Punkt zeigt'
                    },
                    {
                      key: 'adhdTwoMinuteStarter' as const,
                      title: '3. Automatischer „2-Minuten-Einstieg" durch KI',
                      desc: 'KI ergänzt bei neuen Aufgaben sofort den ersten kleinen Handgriff'
                    },
                    {
                      key: 'adhdTimeBufferAndHaptics' as const,
                      title: '4. Zeitblindheits-Puffer (+25 %) & Haptik-Impuls',
                      desc: 'Rechnet 25 % Pufferzeit für Rüstwege ein und vibriert beim Abhaken'
                    }
                  ].map((item) => (
                    <div
                      key={item.key}
                      className="p-3 rounded-2xl bg-[#242930] border border-white/5 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="text-xs font-semibold text-white">{item.title}</div>
                        <div className="text-xs text-[#94A3B8]">{item.desc}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => updatePrefs({ [item.key]: !prefs[item.key] })}
                        className="min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs font-bold text-white shrink-0 active:scale-95 transition"
                        style={{
                          backgroundColor: prefs[item.key] ? THEME.accentPrimary : '#374151'
                        }}
                      >
                        {prefs[item.key] ? 'An' : 'Aus'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Unterabschnitt: PERSONALISIERUNG ── */}
            <div className="space-y-3">
              <div className="text-xs font-extrabold uppercase tracking-wider text-[#94A3B8] px-1 pt-1">
                Personalisierung & KI-Stil
              </div>
              <div className="space-y-1">
                <label className="text-xs text-[#94A3B8] block font-medium">
                  Darstellungs-Dichte (Touch- &amp; Textgröße):
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'compact', label: 'Kompakt' },
                    { id: 'standard', label: 'Standard' },
                    { id: 'large', label: 'Groß (Baustelle)' }
                  ].map((d) => (
                    <button
                      type="button"
                      key={d.id}
                      onClick={() => updatePrefs({ uiDensity: d.id as any })}
                      className={`min-h-[44px] py-2 rounded-xl text-xs font-bold border transition active:scale-95 ${
                        prefs.uiDensity === d.id
                          ? 'text-white border-white/30'
                          : 'bg-[#242930] text-[#94A3B8] border-white/5'
                      }`}
                      style={
                        prefs.uiDensity === d.id
                          ? { backgroundColor: THEME.accentPrimary }
                          : {}
                      }
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-[#94A3B8] block font-medium">
                  Persönlicher KI-Antwortstil:
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'short', label: 'Kommando-Kurz' },
                    { id: 'partner', label: 'Fach-Partner' },
                    { id: 'coach', label: 'Fokus-Coach' }
                  ].map((t) => (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => updatePrefs({ aiTone: t.id as any })}
                      className={`min-h-[44px] py-2 rounded-xl text-xs font-bold border transition active:scale-95 ${
                        prefs.aiTone === t.id
                          ? 'text-white border-white/30'
                          : 'bg-[#242930] text-[#94A3B8] border-white/5'
                      }`}
                      style={
                        prefs.aiTone === t.id
                          ? { backgroundColor: THEME.accentPrimary }
                          : {}
                      }
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-[#242930] border border-white/5 flex items-center justify-between">
                <span className="text-xs text-white font-medium">
                  Organische Hintergrund-Aura &amp; Wellen-Animation
                </span>
                <button
                  type="button"
                  onClick={() => updatePrefs({ organicMotion: !prefs.organicMotion })}
                  className="min-h-[44px] px-4 py-1.5 rounded-xl text-xs font-bold text-white transition active:scale-95"
                  style={{
                    backgroundColor: prefs.organicMotion ? THEME.accentPrimary : '#374151'
                  }}
                >
                  {prefs.organicMotion ? 'An' : 'Aus'}
                </button>
              </div>

              {/* Eigene Quick-Command-Chips verwalten */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs text-[#94A3B8] block font-medium">
                  Eigene 1-Tipp-Schnellbefehle im KI-Fenster:
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={newQuickCmd}
                    onChange={(e) => setNewQuickCmd(e.target.value)}
                    placeholder="Neuer Schnellbefehl..."
                    className="flex-1 min-h-[44px] px-3 py-2 rounded-xl text-xs bg-[#181A1B] text-white border border-white/10"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newQuickCmd.trim()) return;
                      updatePrefs({
                        quickCommands: [...prefs.quickCommands, newQuickCmd.trim()]
                      });
                      setNewQuickCmd('');
                    }}
                    className="min-h-[44px] min-w-[44px] px-3.5 py-1.5 rounded-xl text-xs font-bold text-white flex items-center justify-center active:scale-95 transition"
                    style={{ backgroundColor: THEME.accentPrimary }}
                    aria-label="Schnellbefehl hinzufügen"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-1">
                  {prefs.quickCommands.map((cmd, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-[#242930] border border-white/5 flex items-center justify-between text-xs text-white"
                    >
                      <span className="truncate">{cmd}</span>
                      <button
                        type="button"
                        onClick={() =>
                          updatePrefs({
                            quickCommands: prefs.quickCommands.filter((_, i) => i !== idx)
                          })
                        }
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#94A3B8] hover:text-red-400 ml-2"
                        aria-label="Löschen"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Unterabschnitt: EINHAND-BEDIENUNG & DAUMEN-STEUERUNG ── */}
            <div className="space-y-3">
              <div className="text-xs font-extrabold uppercase tracking-wider text-[#94A3B8] px-1 pt-1">
                Einhand-Bedienung &amp; Daumen-Steuerung
              </div>
              <div className="p-3.5 rounded-2xl bg-[#242930] border border-white/5 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-white">
                    Sechskant-Daumenmodul (Einhand-Steuerung)
                  </div>
                  <div className="text-xs text-[#94A3B8]">
                    Ergonomischer Sechskant mit Daumen-Fächer statt klassischer unterer Leiste
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Sechskant-Daumenmodul umschalten"
                  onClick={() => onToggleThumbHub?.(!thumbHubEnabled)}
                  className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold text-white shrink-0 active:scale-95 transition"
                  style={{
                    backgroundColor: thumbHubEnabled ? THEME.accentPrimary : '#374151'
                  }}
                >
                  {thumbHubEnabled ? 'Eingeschaltet' : 'Ausgeschaltet'}
                </button>
              </div>

              {thumbHubEnabled && (
                <div className="space-y-1.5 p-3.5 rounded-2xl bg-[#242930] border border-white/5">
                  <label className="text-xs text-[#94A3B8] block font-medium">
                    Parkplatz für Einhand-Bedienung:
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'left', label: 'Links' },
                      { id: 'center', label: 'Mitte' },
                      { id: 'right', label: 'Rechts' }
                    ].map((pos) => (
                      <button
                        type="button"
                        key={pos.id}
                        onClick={() => onChangeThumbHubPosition?.(pos.id as 'left' | 'center' | 'right')}
                        className={`min-h-[44px] py-2 rounded-xl text-xs font-bold border transition active:scale-95 ${
                          thumbHubPosition === pos.id
                            ? 'text-white border-white/30'
                            : 'bg-[#181A1B] text-[#94A3B8] border-white/5 hover:text-white'
                        }`}
                        style={
                          thumbHubPosition === pos.id
                            ? { backgroundColor: THEME.accentPrimary }
                            : {}
                        }
                      >
                        {pos.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Unterabschnitt: TAGESPLANER ── */}
            <div className="space-y-3">
              <div className="text-xs font-extrabold uppercase tracking-wider text-[#94A3B8] px-1 pt-1">
                Tagesplaner & Kalender-Export ({allOpenTasks.length} offen)
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onAutoStructureDay}
                  className="flex-1 min-h-[44px] py-2 px-3.5 rounded-xl text-xs font-bold text-white active:scale-95 transition"
                  style={{ backgroundColor: THEME.accentPrimary }}
                >
                  Tag automatisch strukturieren
                </button>
                <button
                  type="button"
                  onClick={() => exportDayPlanIcs(projects)}
                  className="min-h-[44px] py-2 px-4 rounded-xl text-xs font-semibold bg-[#242930] text-white border border-white/10 active:scale-95 transition"
                >
                  .ics Export
                </button>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {allOpenTasks.map(({ project, task }) => (
                  <div
                    key={task.id}
                    className="p-3 rounded-2xl bg-[#242930] border border-white/5 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs text-[#14B8A6] font-bold">{project.name}</div>
                      <div className="text-xs text-white truncate font-medium">{task.title}</div>
                    </div>
                    <select
                      value={task.dayBlock || ''}
                      onChange={(e) =>
                        onAssignDayBlock(
                          project.id,
                          task.id,
                          (e.target.value || null) as DayBlockId | null
                        )
                      }
                      className="min-h-[44px] px-3 py-1.5 rounded-xl text-xs bg-[#181A1B] text-white border border-white/10"
                    >
                      <option value="">Kein Block</option>
                      <option value="morning">Morgen</option>
                      <option value="focus">Fokus</option>
                      <option value="errands">Besorgung</option>
                      <option value="evening">Abend</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Unterabschnitt: FRONTDISPLAY & CHECKS ── */}
            <div className="space-y-3">
              <div className="text-xs font-extrabold uppercase tracking-wider text-[#94A3B8] px-1 pt-1">
                Flip-7-Cover-Display & Selbst-Checks
              </div>
              <button
                type="button"
                onClick={onOpenFlip7Cover}
                className="w-full min-h-[44px] py-2.5 rounded-xl text-xs font-bold text-white active:scale-95 transition"
                style={{ backgroundColor: THEME.accentPrimary }}
              >
                Frontdisplay-Kompaktansicht öffnen
              </button>
              <div className="grid grid-cols-2 gap-2">
                {onOpenRealityModal && (
                  <button
                    type="button"
                    onClick={onOpenRealityModal}
                    className="min-h-[44px] p-2.5 rounded-xl bg-[#242930] border border-white/5 text-xs font-bold text-white flex items-center justify-center gap-2 active:scale-95 transition"
                  >
                    <Compass className="w-4 h-4 text-[#14B8A6]" />
                    <span>Reality-Check</span>
                  </button>
                )}
                {onOpenSelfCheckModal && (
                  <button
                    type="button"
                    onClick={onOpenSelfCheckModal}
                    className="min-h-[44px] p-2.5 rounded-xl bg-[#242930] border border-white/5 text-xs font-bold text-white flex items-center justify-center gap-2 active:scale-95 transition"
                  >
                    <HeartHandshake className="w-4 h-4 text-[#14B8A6]" />
                    <span>Selbst-Check</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════
           BEREICH 3: KI & STIMME „GISELA"
         ════════════════════════════════════════════════════════════════════ */}
      <div
        className="rounded-3xl border border-white/5 overflow-hidden shadow-md"
        style={{ backgroundColor: '#191C22' }}
      >
        <SectionHeader
          sectionId="ai"
          icon={<Key className="w-5 h-5 text-[#14B8A6]" />}
          title={'KI & Stimme „Gisela"'}
          subtitle="Gemini API-Key, Modellwahl & Azure Neural TTS"
        />

        {openSection === 'ai' && (
          <div className="px-4 pb-4 pt-2 border-t border-white/5 space-y-3 bg-[#191C22]/70">
            <input
              type="password"
              value={userApiKey}
              onChange={(e) => onChangeApiKey(e.target.value)}
              placeholder="Gemini API-Key eintragen (AIzaSy...)"
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-mono bg-[#181A1B] text-white border border-white/10"
            />

            <select
              value={modelMode}
              onChange={(e) => {
                setModelMode(e.target.value);
                setPreferredModelMode(e.target.value);
              }}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl text-xs bg-[#181A1B] text-white border border-white/10"
            >
              <option value="SMART_PRO">
                Smart-Mix (Flash für Sortierung + Höchstes Pro-Modell für Fragen/Fotos)
              </option>
              <option value="ALWAYS_PRO">
                Immer höchstes Pro-Modell nutzen (Maximale Intelligenz)
              </option>
              <option value="ALWAYS_FLASH">
                Immer Flash nutzen (Maximale Geschwindigkeit)
              </option>
              {availableModels.map((m) => (
                <option key={m} value={m}>
                  Direktwahl: {m}
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={apiTestStatus.loading}
              onClick={handleTestKey}
              className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 active:scale-95 transition"
              style={{ backgroundColor: THEME.accentPrimary }}
            >
              {apiTestStatus.loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>Verbindung testen &amp; Modelle laden</span>
            </button>

            {apiTestStatus.text && (
              <div
                className={`p-3 rounded-2xl text-xs border ${
                  apiTestStatus.ok
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-red-500/10 border-red-500/30 text-red-300'
                }`}
              >
                {apiTestStatus.text}
              </div>
            )}

            {/* STIMME GISELA (AZURE NEURAL TTS) */}
            <div className="p-3.5 rounded-2xl bg-[#242930] border border-white/5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-[#14B8A6]" />
                  <span>Stimme „Gisela" (Microsoft Azure Neural TTS)</span>
                </div>
                <span className="text-xs text-[#94A3B8]">Optional · Offline-Fallback aktiv</span>
              </div>
              <div className="space-y-2">
                <input
                  type="password"
                  value={azureSpeechKey}
                  onChange={(e) => {
                    setAzureSpeechKey(e.target.value);
                    saveAzureSpeechKey(e.target.value);
                  }}
                  placeholder="Azure Speech API-Key (optional)..."
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-mono bg-[#181A1B] text-white border border-white/10"
                />
                <input
                  type="text"
                  value={azureSpeechRegion}
                  onChange={(e) => {
                    setAzureSpeechRegion(e.target.value);
                    saveAzureSpeechRegion(e.target.value);
                  }}
                  placeholder="Azure Region (z. B. germanywestcentral oder westeurope)"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl text-xs bg-[#181A1B] text-white border border-white/10"
                />
                <button
                  type="button"
                  disabled={giselaTesting}
                  onClick={handleTestGiselaVoice}
                  className="w-full min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 active:scale-95 transition"
                  style={{ backgroundColor: THEME.accentPrimary }}
                >
                  {giselaTesting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                  <span>Stimme Gisela testen</span>
                </button>
                {giselaTestStatus && (
                  <div
                    className={`p-3 rounded-2xl text-xs border ${
                      giselaTestStatus.engine === 'azure-gisela'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    }`}
                  >
                    {giselaTestStatus.message}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════
           BEREICH 4: DATEN, BACKUP & SYSTEM
         ════════════════════════════════════════════════════════════════════ */}
      <div
        className="rounded-3xl border border-white/5 overflow-hidden shadow-md"
        style={{ backgroundColor: '#191C22' }}
      >
        <SectionHeader
          sectionId="system"
          icon={<Database className="w-5 h-5 text-[#14B8A6]" />}
          title="Daten, Backup & System"
          subtitle="Import/Export, Vorlagen-Tresor, Cloud-Sync & Smart Home"
        />

        {openSection === 'system' && (
          <div className="px-4 pb-4 pt-2 border-t border-white/5 space-y-4 bg-[#191C22]/70">
            {/* ── Unterabschnitt: Backup, Export & Import ── */}
            <div className="space-y-3">
              <div className="text-xs font-extrabold uppercase tracking-wider text-[#94A3B8] px-1 pt-1">
                Backup, Export & Import
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onExportFullBackup}
                  className="flex-1 min-h-[44px] py-2 px-3 rounded-xl text-xs font-semibold bg-[#242930] text-white border border-white/10 flex items-center justify-center gap-2 active:scale-95 transition"
                >
                  <Download className="w-4 h-4 text-[#14B8A6]" />
                  <span>Backup speichern</span>
                </button>
                <label className="flex-1 min-h-[44px] cursor-pointer py-2 px-3 rounded-xl text-xs font-semibold bg-[#242930] text-[#14B8A6] border border-[#14B8A6]/40 flex items-center justify-center gap-2 active:scale-95 transition">
                  <Upload className="w-4 h-4" />
                  <span>Backup laden</span>
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleBackupUpload}
                  />
                </label>
              </div>

              {eventSalesLogs.length > 0 && (
                <button
                  type="button"
                  onClick={() => exportSalesLogsCsv(eventSalesLogs)}
                  className="w-full min-h-[44px] py-2 rounded-xl text-xs font-semibold bg-[#242930] text-[#14B8A6] border border-white/10 active:scale-95 transition"
                >
                  POS-Abrechnungen als CSV exportieren ({eventSalesLogs.length})
                </button>
              )}
            </div>

            {/* ── Unterabschnitt: Vorlagen-Tresor (Blueprints) ── */}
            <div className="space-y-3">
              <div className="text-xs font-extrabold uppercase tracking-wider text-[#94A3B8] px-1 pt-1">
                Vorlagen-Tresor (Blueprints)
              </div>
              <div className="p-3.5 rounded-2xl bg-[#242930] border border-white/5 space-y-2.5">
                <div className="text-xs font-bold text-white">
                  Aktuelles Projekt als wiederverwendbare Vorlage sichern
                </div>
                <select
                  value={selectedBlueprintProjectId}
                  onChange={(e) => setSelectedBlueprintProjectId(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl text-xs bg-[#181A1B] text-white border border-white/10"
                >
                  {activeProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newBlueprintName}
                    onChange={(e) => setNewBlueprintName(e.target.value)}
                    placeholder="Name der Vorlage (z. B. Sommer-Event Packliste)..."
                    className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl text-xs bg-[#181A1B] text-white border border-white/10"
                  />
                  <button
                    type="button"
                    onClick={handleSaveCurrentProjectAsBlueprint}
                    className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold text-white transition active:scale-95"
                    style={{ backgroundColor: THEME.accentPrimary }}
                  >
                    Sichern
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                {blueprints.map((bp) => (
                  <div
                    key={bp.id}
                    className="p-3 rounded-2xl bg-[#242930] border border-white/5 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">{bp.name}</div>
                      <div className="text-xs text-[#94A3B8]">
                        {bp.tasks.length} Tasks • {bp.cart.length} Einkaufs-Artikel
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onSaveScratchpadToProject(
                          selectedBlueprintProjectId,
                          bp.name,
                          `Checklisten-Vorlage:\n${bp.tasks.map((t) => `- ${t}`).join('\n')}`
                        );
                        onNotify(`Vorlage "${bp.name}" in Projekt-Infos hinterlegt.`);
                      }}
                      className="min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs font-bold text-white shrink-0 active:scale-95 transition"
                      style={{ backgroundColor: THEME.accentPrimary }}
                    >
                      Einspielen
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Unterabschnitt: Archiv (kompakt) ── */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <div className="text-xs font-extrabold uppercase tracking-wider text-[#94A3B8] px-1">
                Aktenschrank
              </div>
              {projects.map((p) => (
                <div
                  key={p.id}
                  className="p-3 rounded-2xl bg-[#242930] border border-white/5 flex items-center justify-between"
                >
                  <span className="text-xs text-white font-medium">{p.name}</span>
                  <button
                    type="button"
                    onClick={() => onToggleArchiveProject(p.id)}
                    className="min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#181A1B] text-[#14B8A6] border border-white/10 active:scale-95 transition"
                  >
                    {p.archived ? 'Wiederherstellen' : 'Archivieren'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ════════ FUSSZEILE: BUILD-STEMPEL (immer sichtbar) ════════ */}
      <div className="mt-6 px-4 pb-4 flex items-center justify-between gap-3">
        <span className="text-xs text-[#94A3B8]/60 font-mono truncate">
          Build {typeof __BUILD_TIMESTAMP__ !== 'undefined' ? __BUILD_TIMESTAMP__ : 'dev'} · {typeof __BUILD_COMMIT__ !== 'undefined' ? __BUILD_COMMIT__ : 'local'}
        </span>
        <button
          type="button"
          onClick={() => {
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.getRegistration().then((reg) => {
                if (reg) {
                  reg.update().then(() => {
                    window.location.reload();
                  }).catch(() => {
                    window.location.reload();
                  });
                } else {
                  window.location.reload();
                }
              }).catch(() => {
                window.location.reload();
              });
            } else {
              window.location.reload();
            }
          }}
          className="min-h-[44px] px-3.5 rounded-xl text-xs font-semibold text-[#94A3B8]/80 hover:text-white bg-[#242930] hover:bg-[#2A3038] border border-white/5 active:scale-95 transition shrink-0"
        >
          Neu laden
        </button>
      </div>
    </div>
  );
};
