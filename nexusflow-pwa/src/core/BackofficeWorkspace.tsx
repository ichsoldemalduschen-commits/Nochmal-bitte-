import React, { useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  CalendarClock,
  Calculator,
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
import { testGeminiApiKey } from '../services/aiRouter';
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
  | 'ailog'
  | 'apikey'
  | 'mobile_cover'
  | 'planner'
  | 'addons'
  | 'analytics'
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
  onSaveScratchpadToProject,
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
  const [openSection, setOpenSection] = useState<AccordionSectionId | null>(
    userApiKey ? 'ailog' : 'apikey'
  );
  const [apiTestStatus, setApiTestStatus] = useState<{
    loading: boolean;
    ok?: boolean;
    text?: string;
  }>({ loading: false });

  const [scratchTitle, setScratchTitle] = useState('');
  const [scratchContent, setScratchContent] = useState('');
  const [scratchTargetProject, setScratchTargetProject] = useState(
    projects[0]?.id || 'proj-foodtruck'
  );

  const toggleSection = (id: AccordionSectionId) => {
    setOpenSection((prev) => (prev === id ? null : id));
  };

  const handleTestKey = async () => {
    setApiTestStatus({ loading: true });
    const res = await testGeminiApiKey(userApiKey);
    setApiTestStatus({ loading: false, ok: res.ok, text: res.message });
  };

  const handleBackupUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result)) as AppStateSnapshot;
        if (parsed && Array.isArray(parsed.projects)) {
          onImportFullBackup(parsed);
        }
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
    <div className="max-w-lg mx-auto space-y-3 pb-10">
      <div
        className="p-3.5 rounded-2xl border border-white/15 flex items-center justify-between shadow-lg"
        style={{ backgroundColor: THEME.bgCard }}
      >
        <div>
          <h2 className="text-sm font-bold text-white">Einstellungen &amp; Backoffice</h2>
          <p className="text-[11px] text-[#9CA3AF]">
            Tippe auf einen Bereich, um ihn aufzuklappen
          </p>
        </div>
        <button
          onClick={onCloseBackoffice}
          className="px-3 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 shadow"
          style={{ backgroundColor: THEME.accentPrimary }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Zurück
        </button>
      </div>

      <div
        className="rounded-2xl border border-white/10 overflow-hidden"
        style={{ backgroundColor: THEME.bgCard }}
      >
        <button
          type="button"
          onClick={() => toggleSection('ailog')}
          className="w-full p-4 flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-[#14B8A6]" />
            <div>
              <div className="text-xs font-bold text-white">
                KI-Sortier-Protokoll &amp; Korrektur ({aiLogs.length})
              </div>
              <div className="text-[11px] text-[#9CA3AF]">
                Nachsehen, wohin die Spracheingabe sortiert hat, verschieben oder rückgängig machen
              </div>
            </div>
          </div>
          {openSection === 'ailog' ? (
            <ChevronUp className="w-4 h-4 text-[#9CA3AF]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#9CA3AF]" />
          )}
        </button>

        {openSection === 'ailog' && (
          <div className="px-4 pb-4 pt-2 border-t border-white/10 space-y-3 bg-[#181A1B]/50">
            {aiLogs.length === 0 ? (
              <p className="text-xs text-[#9CA3AF] py-2">
                Noch keine Sprachbefehle aufgenommen. Tippe unten rechts auf „Sprechen“!
              </p>
            ) : (
              aiLogs.slice(0, 15).map((log: any) => (
                <div
                  key={log.id}
                  className="p-3 rounded-xl bg-[#24292E] border border-white/10 space-y-2"
                >
                  <div className="flex items-center justify-between text-[10px] text-[#9CA3AF]">
                    <span>{log.timestamp}</span>
                    <span className="text-[#14B8A6] font-mono">
                      {log.engineUsed || log.engine}
                    </span>
                  </div>
                  <p className="text-xs text-white italic">
                    „{log.rawTranscript || log.rawInput}“
                  </p>
                  <div className="space-y-1.5 pt-1">
                    {log.actions.map((act: any) => (
                      <div
                        key={act.actionId}
                        className={`p-2 rounded-lg bg-[#181A1B] border border-white/10 flex flex-col gap-1.5 ${
                          act.undone ? 'opacity-40' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => onJumpToAction(act)}
                            className="text-xs font-bold text-[#14B8A6] hover:underline text-left truncate"
                          >
                            → {act.shortCheckableTitle}
                          </button>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-[#9CA3AF] shrink-0">
                            {act.targetSubTab}
                          </span>
                        </div>
                        {!act.undone && (
                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
                            <select
                              value={act.targetProjectId}
                              onChange={(e) =>
                                onMoveAiAction(log.id, act.actionId, e.target.value)
                              }
                              className="px-2 py-1 rounded text-[10px] bg-[#24292E] text-white border border-white/10 flex-1"
                            >
                              {activeProjects.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => onUndoAiAction(log.id, act.actionId)}
                              className="px-2 py-1 rounded text-[10px] bg-red-500/15 text-red-300 border border-red-500/30 flex items-center gap-1"
                            >
                              <Undo2 className="w-3 h-3" />
                              Rückgängig
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div
        className="rounded-2xl border border-white/10 overflow-hidden"
        style={{ backgroundColor: THEME.bgCard }}
      >
        <button
          type="button"
          onClick={() => toggleSection('apikey')}
          className="w-full p-4 flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-3">
            <Key className="w-5 h-5 text-[#14B8A6]" />
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <span>KI-Schnittstelle (Gemini API-Key)</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full ${
                    userApiKey.trim()
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-amber-500/20 text-amber-300'
                  }`}
                >
                  {userApiKey.trim() ? 'Key hinterlegt' : 'Kein Key'}
                </span>
              </div>
              <div className="text-[11px] text-[#9CA3AF]">
                API-Schlüssel eintragen &amp; Live-Verbindung prüfen
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
              placeholder="AIzaSy... (Deinen Google Gemini API-Key hier einfügen)"
              className="w-full px-3 py-2.5 rounded-xl text-xs font-mono bg-[#181A1B] text-white border border-white/15 focus:outline-none focus:border-[#14B8A6]"
            />
            <div className="flex items-center gap-2">
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
                API-Verbindung jetzt testen
              </button>
              {userApiKey && (
                <button
                  type="button"
                  onClick={() => {
                    onChangeApiKey('');
                    setApiTestStatus({ loading: false });
                  }}
                  className="px-3 py-2 rounded-xl text-xs text-[#9CA3AF] bg-white/5"
                >
                  Leeren
                </button>
              )}
            </div>
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

      <div
        className="rounded-2xl border border-white/10 overflow-hidden"
        style={{ backgroundColor: THEME.bgCard }}
      >
        <button
          type="button"
          onClick={() => toggleSection('mobile_cover')}
          className="w-full p-4 flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-3">
            <Smartphone className="w-5 h-5 text-[#14B8A6]" />
            <div>
              <div className="text-xs font-bold text-white">
                Galaxy Z Flip 7 Frontdisplay &amp; Fokus-Checks
              </div>
              <div className="text-[11px] text-[#9CA3AF]">
                Kompakt-Kachel für zugeklapptes Handy, Reality-Check &amp; Selbst-Check
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
          <div className="px-4 pb-4 pt-2 border-t border-white/10 space-y-3 bg-[#181A1B]/50">
            <div className="p-3 rounded-xl bg-[#24292E] border border-white/10 space-y-2">
              <div className="text-xs font-bold text-white">
                So nutzt du die App auf dem Flip 7 Frontdisplay:
              </div>
              <ol className="text-[11px] text-[#9CA3AF] space-y-1 list-decimal list-inside">
                <li>
                  Im Handy-Browser oben rechts im Menü auf <b>„App installieren“</b> tippen.
                </li>
                <li>
                  In Samsung <b>Good Lock → MultiStar → Launcher Widget</b> die App{' '}
                  <b>NexusFlow</b> anhaken.
                </li>
                <li>
                  Wenn du sie zugeklappt öffnest, schaltet sie automatisch in den großen
                  1-Klick-Sprachmodus!
                </li>
              </ol>
              <button
                type="button"
                onClick={onOpenFlip7Cover}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-white mt-1"
                style={{ backgroundColor: THEME.accentPrimary }}
              >
                📱 Flip 7 Frontdisplay-Ansicht jetzt öffnen
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {onOpenRealityModal && (
                <button
                  type="button"
                  onClick={onOpenRealityModal}
                  className="p-3 rounded-xl bg-[#24292E] border border-white/10 text-xs font-bold text-white flex items-center justify-center gap-2"
                >
                  <Compass className="w-4 h-4 text-[#14B8A6]" />
                  Reality-Impuls
                </button>
              )}
              {onOpenSelfCheckModal && (
                <button
                  type="button"
                  onClick={onOpenSelfCheckModal}
                  className="p-3 rounded-xl bg-[#24292E] border border-white/10 text-xs font-bold text-white flex items-center justify-center gap-2"
                >
                  <HeartHandshake className="w-4 h-4 text-[#14B8A6]" />
                  Selbst-Check
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div
        className="rounded-2xl border border-white/10 overflow-hidden"
        style={{ backgroundColor: THEME.bgCard }}
      >
        <button
          type="button"
          onClick={() => toggleSection('planner')}
          className="w-full p-4 flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-3">
            <CalendarClock className="w-5 h-5 text-[#14B8A6]" />
            <div>
              <div className="text-xs font-bold text-white">
                Tagesplaner &amp; Kalender-Export ({allOpenTasks.length} offen)
              </div>
              <div className="text-[11px] text-[#9CA3AF]">
                Aufgaben automatisch auf Morgen, Fokus, Besorgungen &amp; Abend verteilen
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
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onAutoStructureDay}
                className="flex-1 py-2 px-3 rounded-xl text-xs font-bold text-white"
                style={{ backgroundColor: THEME.accentPrimary }}
              >
                ✨ Tag automatisch strukturieren
              </button>
              <button
                type="button"
                onClick={() => exportDayPlanIcs(projects)}
                className="py-2 px-3 rounded-xl text-xs font-semibold bg-[#24292E] text-white border border-white/10"
              >
                📅 .ics Kalender
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {allOpenTasks.map(({ project, task }) => (
                <div
                  key={task.id}
                  className="p-2.5 rounded-xl bg-[#24292E] border border-white/10 flex items-center justify-between gap-2"
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
                    className="px-2 py-1 rounded text-[10px] bg-[#181A1B] text-white border border-white/10 shrink-0"
                  >
                    <option value="">Kein Block</option>
                    <option value="morning">🌅 Morgen</option>
                    <option value="focus">🔥 Fokus</option>
                    <option value="errands">🛒 Besorgung</option>
                    <option value="evening">🌙 Abend</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div
        className="rounded-2xl border border-white/10 overflow-hidden"
        style={{ backgroundColor: THEME.bgCard }}
      >
        <button
          type="button"
          onClick={() => toggleSection('addons')}
          className="w-full p-4 flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-3">
            <Puzzle className="w-5 h-5 text-[#14B8A6]" />
            <div>
              <div className="text-xs font-bold text-white">
                Add-ons &amp; Arbeitshilfen (POS-Clicker, Teigrechner)
              </div>
              <div className="text-[11px] text-[#9CA3AF]">
                Zusatz-Module je Projekt ein-/ausschalten &amp; Schnell-Notizrechner
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
          <div className="px-4 pb-4 pt-2 border-t border-white/10 space-y-3 bg-[#181A1B]/50">
            {PLUGIN_REGISTRY.map((plugin) => (
              <div
                key={plugin.id}
                className="p-3 rounded-xl bg-[#24292E] border border-white/10 space-y-2"
              >
                <div className="text-xs font-bold text-white">{plugin.name}</div>
                <p className="text-[11px] text-[#9CA3AF]">{plugin.description}</p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {activeProjects.map((proj) => {
                    const enabled = (proj.enabledPlugins || []).includes(plugin.id);
                    return (
                      <button
                        type="button"
                        key={proj.id}
                        onClick={() => onTogglePluginForProject(proj.id, plugin.id)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition ${
                          enabled
                            ? 'bg-[#0A9396] text-white border-[#14B8A6]'
                            : 'bg-[#181A1B] text-[#9CA3AF] border-white/10'
                        }`}
                      >
                        {enabled ? '✓ ' : '+ '}
                        {proj.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="p-3 rounded-xl bg-[#24292E] border border-white/10 space-y-2">
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5 text-[#14B8A6]" />
                Schnell-Notiz direkt in Projekt-Infos ablegen
              </div>
              <input
                type="text"
                value={scratchTitle}
                onChange={(e) => setScratchTitle(e.target.value)}
                placeholder="Titel (z. B. Rohr-Maße Backstube)..."
                className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-[#181A1B] text-white border border-white/10"
              />
              <textarea
                rows={2}
                value={scratchContent}
                onChange={(e) => setScratchContent(e.target.value)}
                placeholder="Maße, Rechnung oder Notiz..."
                className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-[#181A1B] text-white border border-white/10"
              />
              <div className="flex gap-2">
                <select
                  value={scratchTargetProject}
                  onChange={(e) => setScratchTargetProject(e.target.value)}
                  className="px-2 py-1.5 rounded-lg text-xs bg-[#181A1B] text-white border border-white/10 flex-1"
                >
                  {activeProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    if (!scratchTitle.trim() || !scratchContent.trim()) return;
                    onSaveScratchpadToProject(
                      scratchTargetProject,
                      scratchTitle.trim(),
                      scratchContent.trim()
                    );
                    setScratchTitle('');
                    setScratchContent('');
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                  style={{ backgroundColor: THEME.accentPrimary }}
                >
                  Speichern
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div
        className="rounded-2xl border border-white/10 overflow-hidden"
        style={{ backgroundColor: THEME.bgCard }}
      >
        <button
          type="button"
          onClick={() => toggleSection('analytics')}
          className="w-full p-4 flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-3">
            <BarChart3 className="w-5 h-5 text-[#14B8A6]" />
            <div>
              <div className="text-xs font-bold text-white">
                Auswertungen (POS-Events: {eventSalesLogs.length} • Selbst-Checks: {selfChecks.length})
              </div>
              <div className="text-[11px] text-[#9CA3AF]">
                Pizza Bandit Event-Abrechnungen (CSV-Export) &amp; Selbst-Check-Verlauf
              </div>
            </div>
          </div>
          {openSection === 'analytics' ? (
            <ChevronUp className="w-4 h-4 text-[#9CA3AF]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#9CA3AF]" />
          )}
        </button>

        {openSection === 'analytics' && (
          <div className="px-4 pb-4 pt-2 border-t border-white/10 space-y-3 bg-[#181A1B]/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">POS Event-Abrechnungen</span>
              {eventSalesLogs.length > 0 && (
                <button
                  type="button"
                  onClick={() => exportSalesLogsCsv(eventSalesLogs)}
                  className="px-2.5 py-1 rounded-lg text-[11px] bg-[#24292E] text-[#14B8A6] border border-white/10"
                >
                  CSV Export
                </button>
              )}
            </div>
            {eventSalesLogs.length === 0 ? (
              <p className="text-xs text-[#9CA3AF]">Noch keine POS-Events abgeschlossen.</p>
            ) : (
              eventSalesLogs.slice(0, 5).map((ev: any) => (
                <div
                  key={ev.id}
                  className="p-2.5 rounded-xl bg-[#24292E] border border-white/10 text-xs flex justify-between"
                >
                  <span className="text-white font-semibold">{ev.eventName}</span>
                  <span className="text-[#14B8A6] font-mono">
                    {ev.totalPizzas} Pizzen • {(ev.grossRevenue ?? ev.totalRevenue ?? 0).toFixed(2)} €
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div
        className="rounded-2xl border border-white/10 overflow-hidden"
        style={{ backgroundColor: THEME.bgCard }}
      >
        <button
          type="button"
          onClick={() => toggleSection('smarthome_backup')}
          className="w-full p-4 flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-3">
            <Webhook className="w-5 h-5 text-[#14B8A6]" />
            <div>
              <div className="text-xs font-bold text-white">
                Smart Home, Voll-Backup &amp; Projekt-Reset
              </div>
              <div className="text-[11px] text-[#9CA3AF]">
                Home Assistant Webhook, JSON-Sicherung &amp; neue Projekt-Farben laden
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
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                <div className="text-xs font-bold text-amber-300">
                  Neue Projekttrennung („Baustelle Bäckerei“ vs. „Pizza Bandit“) aktivieren:
                </div>
                <p className="text-[11px] text-[#9CA3AF]">
                  Aktualisiert die Projektnamen und Bereichsfarben im Handyspeicher (dein API-Key
                  bleibt erhalten).
                </p>
                <button
                  type="button"
                  onClick={onResetProjectStructure}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-500 text-black flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Projektnamen &amp; Farben jetzt aktualisieren
                </button>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[11px] text-[#9CA3AF] block">
                Home Assistant Webhook-URL ({haEmbedUrl}):
              </label>
              <input
                type="text"
                value={haWebhookUrl}
                onChange={(e) => onChangeHaWebhook(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-[#181A1B] text-[#14B8A6] border border-white/10"
              />
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#24292E] border border-white/10">
              <span className="text-xs text-white">Reality-Check Button aktiv</span>
              <button
                type="button"
                onClick={onToggleRealityCheck}
                className="px-3 py-1 rounded-lg text-xs font-bold text-white"
                style={{
                  backgroundColor: realityCheckEnabled ? THEME.accentPrimary : '#4B5563'
                }}
              >
                {realityCheckEnabled ? 'An' : 'Aus'}
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={onExportFullBackup}
                className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold bg-[#24292E] text-white border border-white/10 flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-[#14B8A6]" />
                Backup speichern
              </button>
              <label className="flex-1 cursor-pointer py-2 px-3 rounded-xl text-xs font-semibold bg-[#24292E] text-[#14B8A6] border border-[#14B8A6]/40 flex items-center justify-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                Backup laden
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleBackupUpload}
                />
              </label>
            </div>
          </div>
        )}
      </div>

      <div
        className="rounded-2xl border border-white/10 overflow-hidden"
        style={{ backgroundColor: THEME.bgCard }}
      >
        <button
          type="button"
          onClick={() => toggleSection('archive')}
          className="w-full p-4 flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-3">
            <FolderArchive className="w-5 h-5 text-[#14B8A6]" />
            <div>
              <div className="text-xs font-bold text-white">
                Aktenschrank &amp; Projekt-Archiv ({archivedProjects.length} archiviert)
              </div>
              <div className="text-[11px] text-[#9CA3AF]">
                Abgeschlossene Projekte wegsortieren oder wiederherstellen
              </div>
            </div>
          </div>
          {openSection === 'archive' ? (
            <ChevronUp className="w-4 h-4 text-[#9CA3AF]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#9CA3AF]" />
          )}
        </button>

        {openSection === 'archive' && (
          <div className="px-4 pb-4 pt-2 border-t border-white/10 space-y-2 bg-[#181A1B]/50">
            {projects.map((p) => (
              <div
                key={p.id}
                className="p-2.5 rounded-xl bg-[#24292E] border border-white/10 flex items-center justify-between"
              >
                <span className="text-xs text-white font-medium">{p.name}</span>
                <button
                  type="button"
                  onClick={() => onToggleArchiveProject(p.id)}
                  className="px-2.5 py-1 rounded-lg text-[11px] bg-[#181A1B] text-[#14B8A6] border border-white/10"
                >
                  {p.archived ? 'Wiederherstellen' : 'In Aktenschrank legen'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
