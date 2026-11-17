import React, { useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Compass,
  Download,
  FolderArchive,
  HeartHandshake,
  Key,
  Loader2,
  Puzzle,
  RefreshCw,
  Smartphone,
  Sparkles,
  Undo2,
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
  getPreferredModelMode,
  setPreferredModelMode,
  testGeminiApiKey
} from '../services/aiRouter';
import { exportDayPlanIcs, exportSalesLogsCsv } from '../services/exportBridge';

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
  | 'apikey'
  | 'planner'
  | 'ailog'
  | 'addons'
  | 'analytics'
  | 'mobile_cover'
  | 'smarthome_backup'
  | 'archive';

export const BackofficeWorkspace: React.FC<BackofficeWorkspaceProps> = ({
  projects,
  aiLogs,
  selfChecks,
  eventSalesLogs,
  userApiKey,
  realityCheckEnabled,
  haWebhookUrl,
  haEmbedUrl,
  onCloseBackoffice,
  onJumpToAction,
  onUndoAiAction,
  onMoveAiAction,
  onToggleArchiveProject,
  onAssignDayBlock,
  onAutoStructureDay,
  onTogglePluginForProject,
  onChangeApiKey,
  onToggleRealityCheck,
  onChangeHaWebhook,
  onOpenFlip7Cover,
  onOpenRealityModal,
  onOpenSelfCheckModal,
  onResetProjectStructure,
  onExportFullBackup,
  onImportFullBackup,
  onNotify
}) => {
  const [openSection, setOpenSection] = useState<AccordionSectionId | null>('apikey');
  const [modelMode, setModelMode] = useState<string>(getPreferredModelMode);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [apiTestStatus, setApiTestStatus] = useState<{
    loading: boolean;
    ok?: boolean;
    text?: string;
  }>({ loading: false });

  const toggleSection = (id: AccordionSectionId) => {
    setOpenSection((prev) => (prev === id ? null : id));
  };

  const handleTestKey = async () => {
    setApiTestStatus({ loading: true });
    const res = await testGeminiApiKey(userApiKey);
    if (res.availableModels) setAvailableModels(res.availableModels);
    setApiTestStatus({ loading: false, ok: res.ok, text: res.message });
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
  const archivedProjects = projects.filter((p) => p.archived);
  const allOpenTasks = activeProjects.flatMap((p) =>
    p.tasks.filter((t) => !t.completed).map((t) => ({ project: p, task: t }))
  );

  return (
    <div className="max-w-lg mx-auto space-y-2.5 pb-12">
      <div
        className="p-3.5 rounded-2xl border border-white/15 flex items-center justify-between"
        style={{ backgroundColor: THEME.bgCard }}
      >
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-white">
            System, Planer &amp; Einstellungen
          </h2>
          <p className="text-[11px] text-[#9CA3AF]">
            Zugeklappte Systembereiche
          </p>
        </div>
        <button
          onClick={onCloseBackoffice}
          className="px-3 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5"
          style={{ backgroundColor: THEME.accentPrimary }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Zurück</span>
        </button>
      </div>

      {/* 1. KI-SCHNITTSTELLE & MODELL-WAHL */}
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

            <div className="space-y-1">
              <label className="text-[11px] text-[#9CA3AF] block">
                Bevorzugtes KI-Modell:
              </label>
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
            </div>

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
              <span>Verbindung testen &amp; verfügbare Modelle laden</span>
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

      {/* 2. TAGESPLANER */}
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

      {/* 3. FRONTDISPLAY & CHECKS */}
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

      {/* 4. ADD-ONS & MODULE */}
      <div
        className="rounded-2xl border border-white/10 overflow-hidden"
        style={{ backgroundColor: THEME.bgCard }}
      >
        <button
          type="button"
          onClick={() => toggleSection('addons')}
          className="w-full p-3.5 flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-3">
            <Puzzle className="w-4 h-4 text-[#14B8A6]" />
            <div>
              <div className="text-xs font-bold text-white">Projekt-Werkzeuge (Add-ons)</div>
              <div className="text-[11px] text-[#9CA3AF]">
                POS-Clicker und Kalkulatoren pro Projekt aktivieren
              </div>
            </div>
          </div>
          {openSection === 'addons' ? (
            <ChevronUp className="w-4 h-4 text-[#9CA3AF]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#9CA3AF]" />
          )}
        </button>

        {openSection === 'addons' && (
          <div className="px-4 pb-4 pt-2 border-t border-white/10 space-y-2.5 bg-[#181A1B]/50">
            {PLUGIN_REGISTRY.map((plugin) => (
              <div
                key={plugin.id}
                className="p-3 rounded-xl bg-[#24292E] border border-white/10 space-y-2"
              >
                <div className="text-xs font-bold text-white">{plugin.name}</div>
                <div className="flex flex-wrap gap-1.5">
                  {activeProjects.map((proj) => {
                    const enabled = (proj.enabledPlugins || []).includes(plugin.id);
                    return (
                      <button
                        type="button"
                        key={proj.id}
                        onClick={() => onTogglePluginForProject(proj.id, plugin.id)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
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
          </div>
        )}
      </div>

      {/* 5. AUSWERTUNGEN & BACKUP */}
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
                Datensicherung, Smart Home &amp; Archiv
              </div>
              <div className="text-[11px] text-[#9CA3AF]">
                JSON-Backup, Projekt-Stammdaten &amp; Aktenschrank ({archivedProjects.length})
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
              <div className="text-[10px] font-bold uppercase text-[#9CA3AF]">
                Aktenschrank (Archiv-Steuerung)
              </div>
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
