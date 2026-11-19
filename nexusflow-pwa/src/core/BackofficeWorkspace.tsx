import React, { useState } from 'react';
import {
  ArrowLeft,
  Brain,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Compass,
  Copy,
  Download,
  HeartHandshake,
  Key,
  Loader2,
  Plus,
  Puzzle,
  RefreshCw,
  Sliders,
  Smartphone,
  Trash2,
  Upload,
  Webhook
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
  BanditUserPreferences,
  getPreferredModelMode,
  loadUserPrefs,
  saveUserPrefs,
  setPreferredModelMode,
  testGeminiApiKey
} from '../services/aiRouter';
import { exportDayPlanIcs, exportSalesLogsCsv } from '../services/exportBridge';

interface BlueprintTemplate {
  id: string;
  name: string;
  tasks: string[];
  cart: string[];
}

const BLUEPRINT_STORAGE_KEY = 'banditos_blueprints_v3';

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
  onChangeTab: (tab: BackofficeTabId) => void;
  onCloseBackoffice: () => void;
  onJumpToAction: (act: AiExecutedAction) => void;
  onUndoAiAction: (logId: string, actionId: string) => void;
  onMoveAiAction: (logId: string, actionId: string, newProjectId: string) => void;
  onToggleArchiveProject: (projectId: string) => void;
  onAssignDayBlock: (projectId: string, taskId: string, block: DayBlockId | null) => void;
  onAutoStructureDay: () => void;
  onTogglePluginForProject: (projectId: string, pluginId: string) => void;
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
  onNotify: (msg: string) => void;
}

type AccordionSectionId =
  | 'adhd'
  | 'personalization'
  | 'blueprints'
  | 'apikey'
  | 'planner'
  | 'mobile_cover'
  | 'addons'
  | 'smarthome_backup';

export const BackofficeWorkspace: React.FC<BackofficeWorkspaceProps> = ({
  projects,
  eventSalesLogs,
  userApiKey,
  onCloseBackoffice,
  onToggleArchiveProject,
  onAssignDayBlock,
  onAutoStructureDay,
  onTogglePluginForProject,
  onSaveScratchpadToProject,
  onChangeApiKey,
  onOpenFlip7Cover,
  onOpenRealityModal,
  onOpenSelfCheckModal,
  onResetProjectStructure,
  onExportFullBackup,
  onImportFullBackup,
  onNotify
}) => {
  const [openSection, setOpenSection] = useState<AccordionSectionId | null>('adhd');
  const [prefs, setPrefs] = useState<BanditUserPreferences>(loadUserPrefs);
  const [newQuickCmd, setNewQuickCmd] = useState('');

  // Update 6 (Erweiterung): Vorlagen-Tresor (Blueprints)
  const [blueprints, setBlueprints] = useState<BlueprintTemplate[]>(() => {
    try {
      const saved = localStorage.getItem(BLUEPRINT_STORAGE_KEY);
      return saved
        ? JSON.parse(saved)
        : [
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
          ];
    } catch {
      return [];
    }
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
    localStorage.setItem(BLUEPRINT_STORAGE_KEY, JSON.stringify(next));
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

  const activeProjects = projects.filter((p) => !p.archived);
  const allOpenTasks = activeProjects.flatMap((p) =>
    p.tasks.filter((t) => !t.completed).map((t) => ({ project: p, task: t }))
  );

  return (
    <div className="max-w-lg mx-auto space-y-3.5 pb-24">
      <div
        className="p-4 rounded-3xl border border-white/5 flex items-center justify-between shadow-lg"
        style={{ backgroundColor: '#1C2026' }}
      >
        <div>
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-white">
            BANDIT.OS System &amp; Einstellungen
          </h2>
          <p className="text-xs text-[#9CA3AF]">
            ADHS-Fokus, Personalisierung, Vorlagen &amp; KI
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

      {/* AKKORDEON 1: ADHS- & FOKUS-UNTERSTÜTZUNG (EIN-/AUSSCHALTBAR) */}
      <div
        className="rounded-3xl border border-white/5 overflow-hidden shadow-md"
        style={{ backgroundColor: '#1C2026' }}
      >
        <button
          type="button"
          onClick={() => toggleSection('adhd')}
          className="w-full min-h-[56px] p-4 flex items-center justify-between text-left active:bg-white/5 transition"
        >
          <div className="flex items-center gap-3">
            <Brain className="w-5 h-5 text-[#14B8A6]" />
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <span>ADHS- &amp; Fokus-Unterstützung</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full ${
                    prefs.adhdMasterEnabled
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-white/10 text-[#9CA3AF]'
                  }`}
                >
                  {prefs.adhdMasterEnabled ? 'Aktiv' : 'Aus'}
                </span>
              </div>
              <div className="text-xs text-[#9CA3AF]">
                Roter-Faden-Anker, 1-Fokus-Blende, 2-Minuten-Starthilfe &amp; Zeitpuffer
              </div>
            </div>
          </div>
          {openSection === 'adhd' ? (
            <ChevronUp className="w-4 h-4 text-[#9CA3AF]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#9CA3AF]" />
          )}
        </button>

        {openSection === 'adhd' && (
          <div className="px-4 pb-4 pt-2 border-t border-white/5 space-y-3 bg-[#1C2026]/70">
            {/* Hauptschalter */}
            <div className="p-3.5 rounded-2xl bg-[#242930] border border-white/5 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-white">
                  ADHS-Unterstützung insgesamt
                </div>
                <div className="text-xs text-[#9CA3AF]">
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
                    title: '1. „Wo war ich gerade?“-Anker (Roter Faden)',
                    desc: 'Pinnt die aktuell bearbeitete Aufgabe dauerhaft oben an'
                  },
                  {
                    key: 'adhdSingleTaskMode' as const,
                    title: '2. „1-Fokus-Blende“ gegen Aufgaben-Paralyse',
                    desc: 'Schalter in den Tasks, der nur den nächsten einzelnen Punkt zeigt'
                  },
                  {
                    key: 'adhdTwoMinuteStarter' as const,
                    title: '3. Automatischer „2-Minuten-Einstieg“ durch KI',
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
                      <div className="text-[11px] text-[#9CA3AF]">{item.desc}</div>
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
        )}
      </div>

      {/* AKKORDEON 2 (UPDATE 5): PERSONALISIERUNG & DARSTELLUNG */}
      <div
        className="rounded-2xl border border-white/10 overflow-hidden"
        style={{ backgroundColor: THEME.bgCard }}
      >
        <button
          type="button"
          onClick={() => toggleSection('personalization')}
          className="w-full p-3.5 flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-3">
            <Sliders className="w-4 h-4 text-[#14B8A6]" />
            <div>
              <div className="text-xs font-bold text-white">
                Personalisierung, Handschuh-Modus &amp; KI-Stil
              </div>
              <div className="text-[11px] text-[#9CA3AF]">
                UI-Dichte, organische Animationen, KI-Tonfall &amp; Schnell-Befehle
              </div>
            </div>
          </div>
          {openSection === 'personalization' ? (
            <ChevronUp className="w-4 h-4 text-[#9CA3AF]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#9CA3AF]" />
          )}
        </button>

        {openSection === 'personalization' && (
          <div className="px-4 pb-4 pt-2 border-t border-white/10 space-y-3 bg-[#181A1B]/50">
            <div className="space-y-1">
              <label className="text-[11px] text-[#9CA3AF] block">
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
                    className={`py-2 rounded-xl text-xs font-bold border ${
                      prefs.uiDensity === d.id
                        ? 'text-white border-white/30'
                        : 'bg-[#24292E] text-[#9CA3AF] border-white/10'
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
              <label className="text-[11px] text-[#9CA3AF] block">
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
                    className={`py-2 rounded-xl text-xs font-bold border ${
                      prefs.aiTone === t.id
                        ? 'text-white border-white/30'
                        : 'bg-[#24292E] text-[#9CA3AF] border-white/10'
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

            <div className="p-2.5 rounded-xl bg-[#24292E] border border-white/10 flex items-center justify-between">
              <span className="text-xs text-white">
                Organische Hintergrund-Aura &amp; Wellen-Animation
              </span>
              <button
                type="button"
                onClick={() => updatePrefs({ organicMotion: !prefs.organicMotion })}
                className="px-3 py-1 rounded-lg text-xs font-bold text-white"
                style={{
                  backgroundColor: prefs.organicMotion ? THEME.accentPrimary : '#374151'
                }}
              >
                {prefs.organicMotion ? 'An' : 'Aus'}
              </button>
            </div>

            {/* Eigene Quick-Command-Chips verwalten */}
            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] text-[#9CA3AF] block">
                Eigene 1-Tipp-Schnellbefehle im KI-Fenster:
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newQuickCmd}
                  onChange={(e) => setNewQuickCmd(e.target.value)}
                  placeholder="Neuer Schnellbefehl..."
                  className="flex-1 px-2.5 py-1.5 rounded-lg text-xs bg-[#181A1B] text-white border border-white/15"
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
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                  style={{ backgroundColor: THEME.accentPrimary }}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-1">
                {prefs.quickCommands.map((cmd, idx) => (
                  <div
                    key={idx}
                    className="px-2.5 py-1.5 rounded-lg bg-[#24292E] flex items-center justify-between text-xs text-white"
                  >
                    <span className="truncate">{cmd}</span>
                    <button
                      type="button"
                      onClick={() =>
                        updatePrefs({
                          quickCommands: prefs.quickCommands.filter((_, i) => i !== idx)
                        })
                      }
                      className="text-[#9CA3AF] hover:text-red-400 ml-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AKKORDEON 3 (UPDATE 6): ERWEITERUNGS- & VORLAGEN-TRESOR (BLUEPRINTS) */}
      <div
        className="rounded-2xl border border-white/10 overflow-hidden"
        style={{ backgroundColor: THEME.bgCard }}
      >
        <button
          type="button"
          onClick={() => toggleSection('blueprints')}
          className="w-full p-3.5 flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-3">
            <Copy className="w-4 h-4 text-[#14B8A6]" />
            <div>
              <div className="text-xs font-bold text-white">
                Erweiterungs- &amp; Vorlagen-Baukasten (Blueprints)
              </div>
              <div className="text-[11px] text-[#9CA3AF]">
                Checklisten-Vorlagen speichern und für neue Events/Projekte einspielen
              </div>
            </div>
          </div>
          {openSection === 'blueprints' ? (
            <ChevronUp className="w-4 h-4 text-[#9CA3AF]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#9CA3AF]" />
          )}
        </button>

        {openSection === 'blueprints' && (
          <div className="px-4 pb-4 pt-2 border-t border-white/10 space-y-3 bg-[#181A1B]/50">
            <div className="p-2.5 rounded-xl bg-[#24292E] border border-white/10 space-y-2">
              <div className="text-xs font-bold text-white">
                Aktuelles Projekt als wiederverwendbare Vorlage sichern
              </div>
              <select
                value={selectedBlueprintProjectId}
                onChange={(e) => setSelectedBlueprintProjectId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-[#181A1B] text-white border border-white/10"
              >
                {activeProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newBlueprintName}
                  onChange={(e) => setNewBlueprintName(e.target.value)}
                  placeholder="Name der Vorlage (z. B. Sommer-Event Packliste)..."
                  className="flex-1 px-2.5 py-1.5 rounded-lg text-xs bg-[#181A1B] text-white border border-white/10"
                />
                <button
                  type="button"
                  onClick={handleSaveCurrentProjectAsBlueprint}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-white"
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
                  className="p-2.5 rounded-xl bg-[#24292E] border border-white/10 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">{bp.name}</div>
                    <div className="text-[10px] text-[#9CA3AF]">
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
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-white shrink-0"
                    style={{ backgroundColor: THEME.accentPrimary }}
                  >
                    Einspielen
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* AKKORDEON 4: KI-SCHNITTSTELLE & MODELL-WAHL */}
      <div
        className="rounded-2xl border border-white/10 overflow-hidden"
        style={{ backgroundColor: THEME.bgCard }}
      >
        <button
          type="button"
          onClick={() => toggleSection('apikey')}
          className="w-full p-3.5 flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-3">
            <Key className="w-4 h-4 text-[#14B8A6]" />
            <div>
              <div className="text-xs font-bold text-white">
                KI-Schnittstelle &amp; Modell-Auswahl
              </div>
              <div className="text-[11px] text-[#9CA3AF]">
                Google AI Studio API-Key &amp; Pro/Flash Modellsteuerung
              </div>
            </div>
          </div>
          {openSection === 'apikey' ? (
            <ChevronUp className="w-4 h-4 text-[#9CA3AF]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#9CA3AF]" />
          )}
        </button>

        {openSection === 'apikey' && (
          <div className="px-4 pb-4 pt-2 border-t border-white/10 space-y-3 bg-[#181A1B]/50">
            <input
              type="password"
              value={userApiKey}
              onChange={(e) => onChangeApiKey(e.target.value)}
              placeholder="Gemini API-Key eintragen (AIzaSy...)"
              className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-[#181A1B] text-white border border-white/15"
            />

            <select
              value={modelMode}
              onChange={(e) => {
                setModelMode(e.target.value);
                setPreferredModelMode(e.target.value);
              }}
              className="w-full px-3 py-2 rounded-xl text-xs bg-[#181A1B] text-white border border-white/15"
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
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5"
              style={{ backgroundColor: THEME.accentPrimary }}
            >
              {apiTestStatus.loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              <span>Verbindung testen &amp; Modelle laden</span>
            </button>

            {apiTestStatus.text && (
              <div
                className={`p-2.5 rounded-xl text-xs border ${
                  apiTestStatus.ok
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-red-500/10 border-red-500/30 text-red-300'
                }`}
              >
                {apiTestStatus.text}
              </div>
            )}
          </div>
        )}
      </div>

      {/* AKKORDEON 5: TAGESPLANER */}
      <div
        className="rounded-2xl border border-white/10 overflow-hidden"
        style={{ backgroundColor: THEME.bgCard }}
      >
        <button
          type="button"
          onClick={() => toggleSection('planner')}
          className="w-full p-3.5 flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-3">
            <CalendarClock className="w-4 h-4 text-[#14B8A6]" />
            <div>
              <div className="text-xs font-bold text-white">
                Tagesplaner &amp; Kalender-Export ({allOpenTasks.length} offen)
              </div>
              <div className="text-[11px] text-[#9CA3AF]">
                Zeitblöcke zuweisen und .ics Datei exportieren
              </div>
            </div>
          </div>
          {openSection === 'planner' ? (
            <ChevronUp className="w-4 h-4 text-[#9CA3AF]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#9CA3AF]" />
          )}
        </button>

        {openSection === 'planner' && (
          <div className="px-4 pb-4 pt-2 border-t border-white/10 space-y-3 bg-[#181A1B]/50">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onAutoStructureDay}
                className="flex-1 py-2 px-3 rounded-xl text-xs font-bold text-white"
                style={{ backgroundColor: THEME.accentPrimary }}
              >
                Tag automatisch strukturieren
              </button>
              <button
                type="button"
                onClick={() => exportDayPlanIcs(projects)}
                className="py-2 px-3 rounded-xl text-xs font-semibold bg-[#24292E] text-white border border-white/10"
              >
                .ics Export
              </button>
            </div>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {allOpenTasks.map(({ project, task }) => (
                <div
                  key={task.id}
                  className="p-2 rounded-xl bg-[#24292E] border border-white/10 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-[10px] text-[#14B8A6] font-bold">{project.name}</div>
                    <div className="text-xs text-white truncate">{task.title}</div>
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
                    className="px-2 py-1 rounded text-[10px] bg-[#181A1B] text-white border border-white/10"
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
        )}
      </div>

      {/* AKKORDEON 6: FRONTDISPLAY & CHECKS */}
      <div
        className="rounded-2xl border border-white/10 overflow-hidden"
        style={{ backgroundColor: THEME.bgCard }}
      >
        <button
          type="button"
          onClick={() => toggleSection('mobile_cover')}
          className="w-full p-3.5 flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-3">
            <Smartphone className="w-4 h-4 text-[#14B8A6]" />
            <div>
              <div className="text-xs font-bold text-white">
                Frontdisplay-Ansicht &amp; Selbst-Checks
              </div>
              <div className="text-[11px] text-[#9CA3AF]">
                Kompakt-Kachel für Galaxy Z Flip 7, Reality- &amp; Selbst-Check
              </div>
            </div>
          </div>
          {openSection === 'mobile_cover' ? (
            <ChevronUp className="w-4 h-4 text-[#9CA3AF]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#9CA3AF]" />
          )}
        </button>

        {openSection === 'mobile_cover' && (
          <div className="px-4 pb-4 pt-2 border-t border-white/10 space-y-2.5 bg-[#181A1B]/50">
            <button
              type="button"
              onClick={onOpenFlip7Cover}
              className="w-full py-2.5 rounded-xl text-xs font-bold text-white"
              style={{ backgroundColor: THEME.accentPrimary }}
            >
              Frontdisplay-Kompaktansicht öffnen
            </button>
            <div className="grid grid-cols-2 gap-2">
              {onOpenRealityModal && (
                <button
                  type="button"
                  onClick={onOpenRealityModal}
                  className="p-2.5 rounded-xl bg-[#24292E] border border-white/10 text-xs font-bold text-white flex items-center justify-center gap-1.5"
                >
                  <Compass className="w-3.5 h-3.5 text-[#14B8A6]" />
                  <span>Reality-Check</span>
                </button>
              )}
              {onOpenSelfCheckModal && (
                <button
                  type="button"
                  onClick={onOpenSelfCheckModal}
                  className="p-2.5 rounded-xl bg-[#24292E] border border-white/10 text-xs font-bold text-white flex items-center justify-center gap-1.5"
                >
                  <HeartHandshake className="w-3.5 h-3.5 text-[#14B8A6]" />
                  <span>Selbst-Check</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* AKKORDEON 7: ADD-ONS & BACKUP */}
      <div
        className="rounded-2xl border border-white/10 overflow-hidden"
        style={{ backgroundColor: THEME.bgCard }}
      >
        <button
          type="button"
          onClick={() => toggleSection('smarthome_backup')}
          className="w-full p-3.5 flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-3">
            <Webhook className="w-4 h-4 text-[#14B8A6]" />
            <div>
              <div className="text-xs font-bold text-white">
                Werkzeuge, Backup &amp; Aktenschrank
              </div>
              <div className="text-[11px] text-[#9CA3AF]">
                POS-Clicker, JSON-Sicherung &amp; Projekt-Archiv
              </div>
            </div>
          </div>
          {openSection === 'smarthome_backup' ? (
            <ChevronUp className="w-4 h-4 text-[#9CA3AF]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#9CA3AF]" />
          )}
        </button>

        {openSection === 'smarthome_backup' && (
          <div className="px-4 pb-4 pt-2 border-t border-white/10 space-y-3 bg-[#181A1B]/50">
            {PLUGIN_REGISTRY.map((plugin) => (
              <div
                key={plugin.id}
                className="p-2.5 rounded-xl bg-[#24292E] border border-white/10 space-y-1.5"
              >
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Puzzle className="w-3.5 h-3.5 text-[#14B8A6]" />
                  <span>{plugin.name}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {activeProjects.map((proj) => {
                    const enabled = (proj.enabledPlugins || []).includes(plugin.id);
                    return (
                      <button
                        type="button"
                        key={proj.id}
                        onClick={() => onTogglePluginForProject(proj.id, plugin.id)}
                        className={`px-2 py-1 rounded text-[10px] font-bold border ${
                          enabled
                            ? 'bg-[#0A9396] text-white border-[#14B8A6]'
                            : 'bg-[#181A1B] text-[#9CA3AF] border-white/10'
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
                className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-amber-500 text-black flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Projekt-Stammdaten aktualisieren</span>
              </button>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onExportFullBackup}
                className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold bg-[#24292E] text-white border border-white/10 flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-[#14B8A6]" />
                <span>Backup speichern</span>
              </button>
              <label className="flex-1 cursor-pointer py-2 px-3 rounded-xl text-xs font-semibold bg-[#24292E] text-[#14B8A6] border border-[#14B8A6]/40 flex items-center justify-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
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
                className="w-full py-2 rounded-xl text-xs font-semibold bg-[#24292E] text-[#14B8A6] border border-white/10"
              >
                POS-Abrechnungen als CSV exportieren ({eventSalesLogs.length})
              </button>
            )}

            <div className="space-y-1.5 pt-2 border-t border-white/10">
              {projects.map((p) => (
                <div
                  key={p.id}
                  className="p-2 rounded-xl bg-[#24292E] border border-white/10 flex items-center justify-between"
                >
                  <span className="text-xs text-white">{p.name}</span>
                  <button
                    type="button"
                    onClick={() => onToggleArchiveProject(p.id)}
                    className="px-2.5 py-1 rounded text-[10px] bg-[#181A1B] text-[#14B8A6] border border-white/10"
                  >
                    {p.archived ? 'Wiederherstellen' : 'Archivieren'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};