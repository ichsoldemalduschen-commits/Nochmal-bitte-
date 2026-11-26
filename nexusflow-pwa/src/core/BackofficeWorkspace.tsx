import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  Brain,
  CalendarClock,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cloud,
  Compass,
  Copy,
  Database,
  Download,
  FileUp,
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
  AiVoiceSettings,
  AmbientLightMode,
  AppStateSnapshot,
  DayBlockId,
  EventSalesLog,
  Project,
  SelfCheckEntry,
  THEME,
  VoiceProvider
} from '../types';
import { PLUGIN_REGISTRY } from '../plugins/registry';
import {
  STORAGE_KEYS,
  downloadProjectJson,
  downloadFullBackupV2,
  importFullBackupV2,
  importProjectJsonToTarget,
  getActiveAiMode,
  getAzureSpeechKey,
  getAzureSpeechRegion,
  getContinuousListening,
  getIdbItemSync,
  getTtsEnabled,
  getVoiceProvider,
  loadAmbientLightMode,
  saveActiveAiMode,
  saveAmbientLightMode,
  saveAzureSpeechKey,
  saveAzureSpeechRegion,
  saveContinuousListening,
  saveIdbItem,
  saveTtsEnabled,
  saveVoiceProvider
} from '../services/storage';
import {
  CloudSyncConfig,
  loadCloudConfig,
  saveCloudConfig,
  pushStateToCloud,
  pullStateFromCloud,
  requestPushNotificationPermission
} from '../services/cloudSyncAndPush';
import {
  BanditUserPreferences,
  getPreferredModelMode,
  loadUserPrefs,
  saveUserPrefs,
  setPreferredModelMode,
  stopAllSpeech,
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
  projects: Project[];
  selfChecks: SelfCheckEntry[];
  eventSalesLogs: EventSalesLog[];
  userApiKey: string;
  realityCheckEnabled: boolean;
  haWebhookUrl: string;
  haEmbedUrl: string;
  initialSection?: ZentraleSectionId | null;
  onCloseBackoffice: () => void;
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
  ambientLightMode?: AmbientLightMode;
  onChangeAmbientLightMode?: (mode: AmbientLightMode) => void;
  fullState?: AppStateSnapshot;
  onReplaceFullStateFromCloud?: (snapshot: AppStateSnapshot) => void;
  aiVoiceSettings?: AiVoiceSettings;
  onUpdateAiVoiceSettings?: (patch: Partial<AiVoiceSettings>) => void;
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
  ambientLightMode: ambientLightModeProp = 'shimmer',
  onChangeAmbientLightMode,
  fullState,
  onReplaceFullStateFromCloud,
  aiVoiceSettings,
  onUpdateAiVoiceSettings,
  onNotify
}) => {
  const [openSection, setOpenSection] = useState<AccordionSectionId | null>(initialSection || null);
  const [prefs, setPrefs] = useState<BanditUserPreferences>(loadUserPrefs);
  const [ambientLightMode, setAmbientLightMode] = useState<AmbientLightMode>(() =>
    ambientLightModeProp || loadAmbientLightMode()
  );

  const handleAmbientModeChange = (mode: AmbientLightMode) => {
    setAmbientLightMode(mode);
    saveAmbientLightMode(mode);
    onChangeAmbientLightMode?.(mode);
    onNotify(
      `Hintergrundbeleuchtung: ${
        mode === 'off' ? 'Aus' : mode === 'static' ? 'Statisch' : 'Sanftes Schimmern'
      }`
    );
  };

  const [cloudCfg, setCloudCfg] = useState<CloudSyncConfig>(loadCloudConfig);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [pushGranted, setPushGranted] = useState<boolean>(
    typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
  );

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

  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [apiTestStatus, setApiTestStatus] = useState<{
    loading: boolean;
    ok?: boolean;
    text?: string;
  }>({ loading: false });

  const [giselaTesting, setGiselaTesting] = useState(false);
  const [giselaTestStatus, setGiselaTestStatus] = useState<{
    ok: boolean;
    engine: 'azure-gisela' | 'browser-fallback';
    message: string;
  } | null>(null);

  const currentAiSettings: AiVoiceSettings = aiVoiceSettings || {
    ttsEnabled: getTtsEnabled(),
    voiceProvider: getVoiceProvider(),
    azureSpeechKey: getAzureSpeechKey(),
    azureSpeechRegion: getAzureSpeechRegion(),
    preferredModelMode: getPreferredModelMode(),
    activeAiMode: getActiveAiMode(),
    continuousListening: getContinuousListening()
  };

  const handleUpdateAiSettings = (patch: Partial<AiVoiceSettings>) => {
    if (patch.ttsEnabled === false) {
      stopAllSpeech();
    }
    if (onUpdateAiVoiceSettings) {
      onUpdateAiVoiceSettings(patch);
      return;
    }
    if (patch.ttsEnabled !== undefined) saveTtsEnabled(patch.ttsEnabled);
    if (patch.voiceProvider !== undefined) saveVoiceProvider(patch.voiceProvider);
    if (patch.azureSpeechKey !== undefined) saveAzureSpeechKey(patch.azureSpeechKey);
    if (patch.azureSpeechRegion !== undefined) saveAzureSpeechRegion(patch.azureSpeechRegion);
    if (patch.preferredModelMode !== undefined) setPreferredModelMode(patch.preferredModelMode);
    if (patch.activeAiMode !== undefined) saveActiveAiMode(patch.activeAiMode);
    if (patch.continuousListening !== undefined) saveContinuousListening(patch.continuousListening);
  };

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
      const res = await testGiselaVoice(
        currentAiSettings.azureSpeechKey,
        currentAiSettings.azureSpeechRegion
      );
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

  const [backupReceipt, setBackupReceipt] = React.useState<{
    type: 'export' | 'import';
    projectCount: number;
    taskCount: number;
    cartCount: number;
    knowledgeCount: number;
    pizzaVarietyCount?: number;
    warnings?: string[];
    timestamp: string;
  } | null>(null);

  const handleBackupUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const raw = JSON.parse(text);
      if (!raw || (typeof raw !== 'object')) {
        onNotify('Ungültige JSON-Backup-Datei.');
        return;
      }
      const { snapshot, result } = await importFullBackupV2(raw, fullState || {} as AppStateSnapshot);
      onImportFullBackup(snapshot);
      setBackupReceipt({
        type: 'import',
        projectCount: result.projectCount,
        taskCount: result.taskCount,
        cartCount: result.cartCount,
        knowledgeCount: result.knowledgeCount,
        pizzaVarietyCount: result.pizzaVarietyCount,
        warnings: result.warnings,
        timestamp: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
      });
      onNotify(`Backup wiederhergestellt: ${result.projectCount} Projekte, ${result.taskCount} Aufgaben.`);
    } catch (err) {
      onNotify(`Backup-Fehler: ${(err as any)?.message || 'Ungültiges Format'}`);
    }
    e.target.value = '';
  };

  const handleProjectJsonUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const raw = JSON.parse(text);
      const targetProj = activeProjects[0] || projects[0];
      if (!targetProj) {
        onNotify('Kein Zielprojekt vorhanden.');
        return;
      }
      const { updatedProject, result } = importProjectJsonToTarget(raw, targetProj);
      onUpdateProject?.(targetProj.id, {
        tasks: updatedProject.tasks,
        cart: updatedProject.cart,
        knowledge: updatedProject.knowledge
      });
      onNotify(
        `Projekt-Import: ${result.addedTasks} Aufgaben, ${result.addedCart} Einkäufe, ${result.addedKnowledge} Wissens-Einträge an "${targetProj.name}" angehängt.`
      );
    } catch (err) {
      onNotify(`Projekt-Import-Fehler: ${(err as any)?.message || 'Ungültiges JSON-Format'}`);
    }
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

                        {/* Gesamt-Übersicht Schalter pro Projekt */}
                        <div className="p-3 rounded-2xl bg-[#181A1B] border border-white/5 flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-white flex items-center gap-1.5">
                              <span>Gesamt-Übersicht</span>
                            </div>
                            <div className="text-xs text-[#94A3B8]">
                              {proj.overviewEnabled !== false
                                ? 'Im Menü aktiv (alle Bereiche gemeinsam)'
                                : 'Ausgeblendet (nur gezielte Einzelbereiche)'}
                            </div>
                          </div>
                          <button
                            type="button"
                            aria-label="Gesamt-Übersicht für dieses Projekt umschalten"
                            onClick={() =>
                              onUpdateProject?.(proj.id, {
                                overviewEnabled: !(proj.overviewEnabled !== false)
                              })
                            }
                            className={`min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs font-bold border transition shrink-0 active:scale-95 cursor-pointer ${
                              proj.overviewEnabled !== false
                                ? 'bg-[#0A9396] text-white border-[#14B8A6]'
                                : 'bg-[#242930] text-[#94A3B8] border-white/10 hover:text-white'
                            }`}
                          >
                            {proj.overviewEnabled !== false ? 'Aktiviert' : 'Deaktiviert'}
                          </button>
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

              <div className="p-3.5 rounded-2xl bg-[#242930] border border-white/5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-white font-bold">
                    Organische Hintergrundbeleuchtung
                  </div>
                  <span className="text-xs text-[#94A3B8] font-mono">
                    {ambientLightMode === 'off' ? 'Aus' : ambientLightMode === 'static' ? 'Statisch' : 'Schimmern'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'off' as const, label: 'Aus', ariaLabel: 'Hintergrundbeleuchtung Aus' },
                    { id: 'static' as const, label: 'Statisch', ariaLabel: 'Hintergrundbeleuchtung Statisch' },
                    { id: 'shimmer' as const, label: 'Schimmern', ariaLabel: 'Hintergrundbeleuchtung Sanftes Schimmern' }
                  ].map((m) => (
                    <button
                      type="button"
                      key={m.id}
                      aria-label={m.ariaLabel}
                      onClick={() => handleAmbientModeChange(m.id)}
                      className={`min-h-[44px] py-2 rounded-xl text-xs font-bold border transition active:scale-95 cursor-pointer ${
                        ambientLightMode === m.id
                          ? 'bg-[#0A9396] text-white border-[#14B8A6]'
                          : 'bg-[#181A1B] text-[#94A3B8] border-white/10 hover:text-white'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <div className="text-[11px] text-[#94A3B8]">
                  {ambientLightMode === 'off' && 'Komplett ruhiger #111317-Hintergrund ohne Beleuchtung.'}
                  {ambientLightMode === 'static' && 'Sehr dezenter Grundschimmer (~8–10 % Deckkraft) ohne Bewegung.'}
                  {ambientLightMode === 'shimmer' && 'Sanft weichgezeichnete Farbflächen im ruhigen GPU-Schimmern (18–22s Zyklus).'}
                </div>
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
              value={currentAiSettings.preferredModelMode}
              onChange={(e) => {
                const nextMode = e.target.value;
                const patch: Partial<AiVoiceSettings> = { preferredModelMode: nextMode };
                if (nextMode === 'ALWAYS_PRO') patch.activeAiMode = 'research';
                else if (nextMode === 'ALWAYS_FLASH') patch.activeAiMode = 'flash';
                handleUpdateAiSettings(patch);
              }}
              aria-label="Intelligenz-Modus wählen"
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
                    : 'bg-[#E5A93C]/10 border-[#E5A93C]/30 text-[#E5A93C]'
                }`}
              >
                {apiTestStatus.text}
              </div>
            )}

            {/* STIMME GISELA (AZURE NEURAL TTS) */}
            <div className="p-3.5 rounded-2xl bg-[#242930] border border-white/5 space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-xs font-bold text-white flex items-center gap-2 min-w-0">
                  <Volume2 className="w-4 h-4 text-[#14B8A6] shrink-0" />
                  <span>Stimme „Gisela" (Microsoft Azure Neural TTS)</span>
                </div>
                <button
                  type="button"
                  aria-label="Sprachausgabe umschalten"
                  onClick={() => {
                    const nextTts = !currentAiSettings.ttsEnabled;
                    handleUpdateAiSettings({ ttsEnabled: nextTts });
                    onNotify(nextTts ? 'Sprachausgabe aktiviert.' : 'Sprachausgabe stummgeschaltet.');
                  }}
                  className={`min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs font-bold border transition shrink-0 active:scale-95 ${
                    currentAiSettings.ttsEnabled
                      ? 'bg-[#0A9396] text-white border-[#14B8A6]'
                      : 'bg-[#181A1B] text-[#94A3B8] border-white/10'
                  }`}
                >
                  {currentAiSettings.ttsEnabled ? 'Stimme An' : 'Stumm'}
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-[#94A3B8] block font-medium">
                  Aktive Stimme / TTS-Provider:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: 'azure-gisela', label: 'Gisela (Azure Neural)' },
                      { id: 'browser', label: 'Browser-Stimme' }
                    ] as Array<{ id: VoiceProvider; label: string }>
                  ).map((opt) => (
                    <button
                      type="button"
                      key={opt.id}
                      onClick={() => {
                        handleUpdateAiSettings({ voiceProvider: opt.id });
                        onNotify(
                          opt.id === 'azure-gisela'
                            ? 'Stimme auf Gisela (Azure Neural) gesetzt.'
                            : 'Stimme auf Browser-Sprachausgabe gesetzt.'
                        );
                      }}
                      className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border transition active:scale-95 ${
                        currentAiSettings.voiceProvider === opt.id
                          ? 'bg-[#0A9396] text-white border-[#14B8A6]'
                          : 'bg-[#181A1B] text-[#94A3B8] border-white/10 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <input
                  type="password"
                  value={currentAiSettings.azureSpeechKey}
                  onChange={(e) => handleUpdateAiSettings({ azureSpeechKey: e.target.value })}
                  placeholder="Azure Speech API-Key (optional)..."
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-mono bg-[#181A1B] text-white border border-white/10"
                />
                <input
                  type="text"
                  value={currentAiSettings.azureSpeechRegion}
                  onChange={(e) => handleUpdateAiSettings({ azureSpeechRegion: e.target.value })}
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
                        : 'bg-[#E5A93C]/10 border-[#E5A93C]/30 text-[#E5A93C]'
                    }`}
                  >
                    {giselaTestStatus.message}
                  </div>
                )}
              </div>

              {/* Durchgehendes Gespräch (Auto-Re-Listen nach Giselas Antwort) */}
              <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-white">
                    Durchgehendes Gespräch (Auto-Re-Listen)
                  </div>
                  <div className="text-xs text-[#94A3B8]">
                    Hört nach Giselas Antwort automatisch wieder zu (Stopp per „Danke, reicht“)
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Durchgehendes Gespräch umschalten"
                  onClick={() => {
                    const next = !currentAiSettings.continuousListening;
                    handleUpdateAiSettings({ continuousListening: next });
                    onNotify(
                      next
                        ? 'Durchgehendes Gespräch (Auto-Re-Listen) aktiviert.'
                        : 'Durchgehendes Gespräch deaktiviert.'
                    );
                  }}
                  className={`min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs font-bold border transition shrink-0 active:scale-95 ${
                    currentAiSettings.continuousListening
                      ? 'bg-[#0A9396] text-white border-[#14B8A6]'
                      : 'bg-[#181A1B] text-[#94A3B8] border-white/10'
                  }`}
                >
                  {currentAiSettings.continuousListening ? 'Aktiv' : 'Aus'}
                </button>
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
                  onClick={async () => {
                    if (!fullState) { onNotify('Kein Status vorhanden.'); return; }
                    const backup = await downloadFullBackupV2(fullState);
                    setBackupReceipt({
                      type: 'export',
                      projectCount: backup.appState.projects.length,
                      taskCount: backup.appState.projects.reduce((n, p) => n + (p.tasks?.length || 0), 0),
                      cartCount: backup.appState.projects.reduce((n, p) => n + (p.cart?.length || 0), 0),
                      knowledgeCount: backup.appState.projects.reduce((n, p) => n + (p.knowledge?.length || 0), 0),
                      pizzaVarietyCount: Array.isArray(backup.pizzaCatalog) ? backup.pizzaCatalog.length : 0,
                      timestamp: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
                    });
                    onNotify('Vollständiges Backup gespeichert (v2).');
                  }}
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

              <label className="w-full min-h-[44px] cursor-pointer py-2 px-3 rounded-xl text-xs font-semibold bg-[#242930] text-[#E5A93C] border border-[#E5A93C]/40 flex items-center justify-center gap-2 active:scale-95 transition">
                <FileUp className="w-4 h-4" />
                <span>Projekt importieren</span>
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleProjectJsonUpload}
                />
              </label>

              {eventSalesLogs.length > 0 && (
                <button
                  type="button"
                  onClick={() => exportSalesLogsCsv(eventSalesLogs)}
                  className="w-full min-h-[44px] py-2 rounded-xl text-xs font-semibold bg-[#242930] text-[#14B8A6] border border-white/10 active:scale-95 transition"
                >
                  POS-Abrechnungen als CSV exportieren ({eventSalesLogs.length})
                </button>
              )}

              {backupReceipt && (
                <div className="p-3.5 rounded-2xl bg-[#242930] border border-[#E5A93C]/30 space-y-2 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-[#E5A93C]">
                      {backupReceipt.type === 'export' ? '✓ Backup gespeichert' : '✓ Backup wiederhergestellt'} · {backupReceipt.timestamp}
                    </div>
                    <button
                      type="button"
                      onClick={() => setBackupReceipt(null)}
                      className="min-h-[44px] min-w-[44px] rounded-xl bg-transparent text-[#94A3B8] hover:text-white flex items-center justify-center transition"
                      aria-label="Quittung schließen"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    <div className="bg-[#111317] rounded-xl p-2 text-center">
                      <div className="text-[#F1F5F9] font-mono font-bold text-base">{backupReceipt.projectCount}</div>
                      <div className="text-[#94A3B8]">Projekte</div>
                    </div>
                    <div className="bg-[#111317] rounded-xl p-2 text-center">
                      <div className="text-[#F1F5F9] font-mono font-bold text-base">{backupReceipt.taskCount}</div>
                      <div className="text-[#94A3B8]">Aufgaben</div>
                    </div>
                    <div className="bg-[#111317] rounded-xl p-2 text-center">
                      <div className="text-[#F1F5F9] font-mono font-bold text-base">{backupReceipt.cartCount}</div>
                      <div className="text-[#94A3B8]">Einkäufe</div>
                    </div>
                    <div className="bg-[#111317] rounded-xl p-2 text-center">
                      <div className="text-[#F1F5F9] font-mono font-bold text-base">{backupReceipt.knowledgeCount}</div>
                      <div className="text-[#94A3B8]">Wissen</div>
                    </div>
                    {(backupReceipt.pizzaVarietyCount ?? 0) > 0 && (
                      <div className="col-span-2 bg-[#111317] rounded-xl p-2 text-center">
                        <div className="text-[#F1F5F9] font-mono font-bold text-base">{backupReceipt.pizzaVarietyCount}</div>
                        <div className="text-[#94A3B8]">Pizza-Sorten (Katalog)</div>
                      </div>
                    )}
                  </div>
                  {backupReceipt.warnings && backupReceipt.warnings.length > 0 && (
                    <div className="text-xs text-[#E5A93C]/80 space-y-0.5">
                      {backupReceipt.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Unterabschnitt: Cloud-Sync & Push ── */}
            <div className="space-y-3">
              <div className="text-xs font-extrabold uppercase tracking-wider text-[#94A3B8] px-1 pt-1">
                Cloud-Synchronisation &amp; Push-Zentrale
              </div>

              <div className="p-3.5 rounded-2xl bg-[#242930] border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-[#14B8A6]" />
                    <span>Echtzeit-Cloud-Sync (Galaxy Z Flip 7 &lt;-&gt; PC)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = {
                        ...cloudCfg,
                        enabled: !cloudCfg.enabled,
                        autoSyncOnChange: !cloudCfg.enabled
                      };
                      setCloudCfg(next);
                      saveCloudConfig(next);
                      onNotify(next.enabled ? 'Cloud-Sync aktiviert.' : 'Cloud-Sync deaktiviert.');
                    }}
                    className="min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs font-bold text-white active:scale-95 transition cursor-pointer"
                    style={{
                      backgroundColor: cloudCfg.enabled ? THEME.accentPrimary : '#374151'
                    }}
                  >
                    {cloudCfg.enabled ? 'Aktiv' : 'Aus'}
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="space-y-1">
                    <label className="text-[11px] text-[#94A3B8] block">Cloud-Endpunkt REST-URL:</label>
                    <input
                      type="text"
                      value={cloudCfg.endpointUrl}
                      onChange={(e) => {
                        const next = { ...cloudCfg, endpointUrl: e.target.value };
                        setCloudCfg(next);
                        saveCloudConfig(next);
                      }}
                      placeholder="https://sync.example.com/api/v1/sync oder Firebase .json"
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-mono bg-[#181A1B] text-white border border-white/10 focus:outline-none focus:border-[#14B8A6]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-[#94A3B8] block">Cloud API-Key / Auth-Token (optional):</label>
                    <input
                      type="password"
                      value={cloudCfg.apiKeyOrToken}
                      onChange={(e) => {
                        const next = { ...cloudCfg, apiKeyOrToken: e.target.value };
                        setCloudCfg(next);
                        saveCloudConfig(next);
                      }}
                      placeholder="ws_bandit_geheim oder Bearer-Token..."
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-mono bg-[#181A1B] text-white border border-white/10 focus:outline-none focus:border-[#14B8A6]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isSyncingCloud}
                    onClick={async () => {
                      if (!fullState) {
                        onNotify('Kein Status zum Senden vorhanden.');
                        return;
                      }
                      setIsSyncingCloud(true);
                      const res = await pushStateToCloud(fullState);
                      setIsSyncingCloud(false);
                      setCloudCfg(loadCloudConfig());
                      onNotify(res.message);
                    }}
                    className="min-h-[44px] py-2.5 px-3 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
                    style={{ backgroundColor: THEME.accentPrimary }}
                  >
                    {isSyncingCloud ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    <span>Jetzt hochladen</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSyncingCloud}
                    onClick={async () => {
                      setIsSyncingCloud(true);
                      const res = await pullStateFromCloud();
                      setIsSyncingCloud(false);
                      setCloudCfg(loadCloudConfig());
                      if (res.ok && res.snapshot && onReplaceFullStateFromCloud) {
                        onReplaceFullStateFromCloud(res.snapshot);
                      }
                      onNotify(res.message);
                    }}
                    className="min-h-[44px] py-2.5 px-3 rounded-xl text-xs font-bold bg-[#181A1B] text-[#14B8A6] border border-[#14B8A6]/40 flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
                  >
                    {isSyncingCloud ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    <span>Jetzt herunterladen</span>
                  </button>
                </div>

                {cloudCfg.lastSyncedAt && (
                  <div className="text-xs text-[#94A3B8] text-center font-mono pt-1">
                    Zuletzt synchronisiert: {cloudCfg.lastSyncedAt}
                  </div>
                )}
              </div>

              {/* Native Push-Erinnerungen */}
              <div className="p-3.5 rounded-2xl bg-[#242930] border border-white/5 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <Bell className="w-4 h-4 text-[#14B8A6]" />
                    <span>Native Smartphone Push-Erinnerungen</span>
                  </div>
                  <div className="text-xs text-[#94A3B8]">
                    Meldet fällige Aufgaben-Zeiten direkt auf dem Sperrbildschirm
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await requestPushNotificationPermission();
                    setPushGranted(ok);
                    onNotify(
                      ok
                        ? 'Push-Benachrichtigungen sind aktiviert!'
                        : 'Bitte Benachrichtigungen in den Browser-Einstellungen erlauben.'
                    );
                  }}
                  className="min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs font-bold text-white shrink-0 active:scale-95 transition cursor-pointer"
                  style={{
                    backgroundColor: pushGranted ? THEME.accentPrimary : '#374151'
                  }}
                >
                  {pushGranted ? 'Aktiv' : 'Freigeben'}
                </button>
              </div>
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
