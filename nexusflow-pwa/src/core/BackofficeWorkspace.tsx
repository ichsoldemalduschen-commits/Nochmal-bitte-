import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  CalendarClock,
  Calculator,
  Copy,
  Cpu,
  Download,
  FolderArchive,
  Key,
  Puzzle,
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
import { SelfCheckHistoryPanel } from '../plugins/mindfulChecks';
import {
  copyEventSalesAsTsvForSheets,
  exportEventSalesToCsv,
  exportScheduledTasksToIcs
} from '../services/exportBridge';
import { AI_ROUTER_RESPONSE_SCHEMA } from '../services/aiRouter';

interface BackofficeProps {
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
  onMoveAiAction: (logId: string, actionId: string, newProjId: string) => void;
  onToggleArchiveProject: (projectId: string) => void;
  onAssignDayBlock: (projectId: string, taskId: string, block: DayBlockId) => void;
  onAutoStructureDay: () => void;
  onTogglePluginForProject: (projectId: string, pluginId: string) => void;
  onSaveScratchpadToProject: (projectId: string, title: string, content: string) => void;
  onChangeApiKey: (key: string) => void;
  onToggleRealityCheck: () => void;
  onChangeHaWebhook: (url: string) => void;
  onOpenFlip7Cover: () => void;
  onExportFullBackup: () => void;
  onImportFullBackup: (snapshot: AppStateSnapshot) => void;
  onNotify: (msg: string) => void;
}

const DAY_BLOCKS: Array<{
  id: Exclude<DayBlockId, null>;
  title: string;
  slot: string;
  subtitle: string;
}> = [
  {
    id: 'morning',
    title: '1. Morgen & Vorbereitung',
    slot: '05:30 – 09:30 Uhr',
    subtitle: 'Backstuben-Start, TSA-Rüstzeit & Morgenroutine'
  },
  {
    id: 'focus',
    title: '2. Fokus-Block & Ausbau',
    slot: '09:30 – 14:30 Uhr',
    subtitle: 'TSA-Baugruppen, Technik-Wartung & Kernproduktion'
  },
  {
    id: 'errands',
    title: '3. Besorgungen & Einkauf',
    slot: '14:30 – 17:30 Uhr',
    subtitle: 'Gebündelte Baumarkt- & Großhandels-Wege'
  },
  {
    id: 'evening',
    title: '4. Abend & Abschluss',
    slot: '17:30 – 21:00 Uhr',
    subtitle: 'Smart-Home-Setup, Abrechnung & ruhiger Abend-Reset'
  }
];

export const BackofficeWorkspace: React.FC<BackofficeProps> = ({
  activeTab,
  projects,
  aiLogs,
  selfChecks,
  eventSalesLogs,
  userApiKey,
  realityCheckEnabled,
  haWebhookUrl,
  haEmbedUrl,
  onChangeTab,
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
  onExportFullBackup,
  onImportFullBackup,
  onNotify
}) => {
  const [analyticsSubView, setAnalyticsSubView] = useState<
    'sales' | 'ailog' | 'selfchecks' | 'archive'
  >('sales');
  const [scratchpad, setScratchpad] = useState(
    'Schwerlastauszüge 1200mm: 2 * 84.00\nGewerbe-Gasregler Set: 54.90\nShelly Plus 2PM + Gehäuse: 49.50\nEuroboxen 10er Set: 119.00'
  );
  const [scratchTargetId, setScratchTargetId] = useState('proj-foodtruck');

  // Großprojekt-Etappenrechner
  const [breakdownProjId, setBreakdownProjId] = useState('proj-foodtruck');
  const [dailyBudgetMin, setDailyBudgetMin] = useState(90);
  const [generatedStages, setGeneratedStages] = useState<
    Array<{ step: number; title: string; minutes: number }>
  >([]);

  const scratchTotal = useMemo(() => {
    return scratchpad.split('\n').reduce((sum, line) => {
      const part = line.includes(':') ? line.split(':').slice(1).join(':') : line;
      const mult = part.match(/(-?\d+(?:[.,]\d+)?)\s*\*\s*(-?\d+(?:[.,]\d+)?)/);
      if (mult) {
        return sum + parseFloat(mult[1].replace(',', '.')) * parseFloat(mult[2].replace(',', '.'));
      }
      const single = part.match(/(-?\d+(?:[.,]\d+)?)/);
      return single ? sum + parseFloat(single[1].replace(',', '.')) : sum;
    }, 0);
  }, [scratchpad]);

  const handleBackupImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  return (
    <div className="space-y-6">
      {/* Die 4 Hauptbereiche des Backoffice laut SPEC.md */}
      <div
        className="p-2 rounded-2xl border border-white/10 flex flex-wrap items-center justify-between gap-2"
        style={{ backgroundColor: THEME.bgCard }}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'analytics' as BackofficeTabId, label: '? Auswertung & Historie', icon: BarChart3 },
            {
              id: 'planner' as BackofficeTabId,
              label: '? Planung & Automatisierung',
              icon: CalendarClock
            },
            { id: 'addons' as BackofficeTabId, label: '? Add-on Zentrale', icon: Puzzle },
            { id: 'system' as BackofficeTabId, label: '?? System & Schnittstellen', icon: Cpu }
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onChangeTab(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition ${
                  active ? 'text-white shadow' : 'text-[#9CA3AF] hover:text-white border-transparent'
                }`}
                style={
                  active
                    ? { backgroundColor: THEME.accentPrimary, borderColor: THEME.accentHighlight }
                    : {}
                }
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <button
          onClick={onCloseBackoffice}
          className="px-3 py-2 rounded-xl text-xs font-bold bg-[#2F363D] text-[#14B8A6] hover:text-white flex items-center gap-1.5 border border-[#14B8A6]/40"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Front-Ansicht
        </button>
      </div>

      {/* BEREICH 1: ? AUSWERTUNG & HISTORIE */}
      {activeTab === 'analytics' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'sales', label: `? POS Event-Abrechnungen (${eventSalesLogs.length})` },
              { id: 'ailog', label: `? KI-Protokoll (${aiLogs.length})` },
              { id: 'selfchecks', label: `? Selbst-Check Verlauf (${selfChecks.length})` },
              {
                id: 'archive',
                label: `?? Aktenschrank (${projects.filter((p) => p.archived).length})`
              }
            ].map((sub) => (
              <button
                key={sub.id}
                onClick={() => setAnalyticsSubView(sub.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border ${
                  analyticsSubView === sub.id
                    ? 'bg-[#2F363D] text-[#14B8A6] border-[#14B8A6]'
                    : 'bg-[#24292E] text-[#9CA3AF] border-white/10'
                }`}
              >
                {sub.label}
              </button>
            ))}
          </div>

          {analyticsSubView === 'sales' && (
            <div
              className="p-5 rounded-2xl border border-white/10 space-y-4"
              style={{ backgroundColor: THEME.bgCard }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Pizza Bandit POS-Auswertung &amp; Google-Sheets-Export
                  </h3>
                  <p className="text-xs text-[#9CA3AF]">
                    Alle per 1-Klick aus dem Live-Verkaufs-Clicker übernommenen Einsätze inkl. Feuerwehrauto-Fonds.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={async () => {
                      await copyEventSalesAsTsvForSheets(eventSalesLogs);
                      onNotify('TSV für Google Sheets kopiert (Direkt mit Strg+V einfügen)!');
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-semibold bg-[#2F363D] text-[#14B8A6] border border-[#14B8A6]/40 flex items-center gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    TSV für Google Sheets kopieren
                  </button>
                  <button
                    onClick={() => {
                      exportEventSalesToCsv(eventSalesLogs);
                      onNotify('CSV-Datei exportiert!');
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5"
                    style={{ backgroundColor: THEME.accentPrimary }}
                  >
                    <Download className="w-3.5 h-3.5" />
                    CSV-Download
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {eventSalesLogs.map((sale) => (
                  <div
                    key={sale.id}
                    className="p-4 rounded-xl bg-[#2F363D] border border-white/10 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-mono text-[#14B8A6]">{sale.timestamp}</span>
                        <h4 className="text-sm font-bold text-white">{sale.eventName}</h4>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs font-mono">
                        <span className="px-2.5 py-1 rounded bg-[#181A1B] text-white">
                          {sale.totalPizzas} Pizzen
                        </span>
                        <span className="px-2.5 py-1 rounded bg-[#181A1B] text-[#14B8A6]">
                          Umsatz: {sale.grossRevenue.toFixed(2)} €
                        </span>
                        <span className="px-2.5 py-1 rounded bg-[#181A1B] text-emerald-400">
                          Rohertrag: {sale.grossProfit.toFixed(2)} €
                        </span>
                        <span className="px-2.5 py-1 rounded bg-[#181A1B] text-amber-300">
                          ? Fonds: +{sale.firetruckTipFund.toFixed(2)} €
                        </span>
                      </div>
                    </div>
                    <div className="text-[11px] text-[#9CA3AF]">
                      Sorten:{' '}
                      {sale.items
                        .filter((i) => i.count > 0)
                        .map((i) => `${i.name} (${i.count}x)`)
                        .join(' • ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {analyticsSubView === 'ailog' && (
            <div className="space-y-4">
              {aiLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-5 rounded-2xl border border-white/10 space-y-3"
                  style={{ backgroundColor: THEME.bgCard }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
                    <span className="text-xs font-mono text-[#14B8A6]">{log.timestamp}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-[#2F363D] text-white">
                      {log.engine}
                    </span>
                  </div>
                  <p className="text-xs italic text-white bg-[#181A1B] p-2.5 rounded-lg">
                    „{log.rawInput}“
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {log.actions.map((act) => {
                      const targetProj = projects.find((p) => p.id === act.targetProjectId);
                      return (
                        <div
                          key={act.actionId}
                          className={`p-3.5 rounded-xl bg-[#2F363D] border space-y-2 ${
                            act.undone ? 'opacity-40 border-white/5' : 'border-white/10'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/30 text-[#14B8A6]">
                              {act.actionType} • {targetProj?.name || act.targetProjectId}
                            </span>
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 border"
                              style={{
                                backgroundColor: 'rgba(239,68,68,0.16)',
                                borderColor: THEME.aiRedDot,
                                color: '#FCA5A5'
                              }}
                            >
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: THEME.aiRedDot }}
                              />
                              KI-bearbeitet
                            </span>
                          </div>
                          <p className="text-xs font-bold text-white">{act.shortCheckableTitle}</p>
                          <p className="text-[11px] text-[#9CA3AF]">{act.detailedExplanation}</p>

                          {!act.undone && (
                            <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                              <button
                                onClick={() => onJumpToAction(act)}
                                className="text-xs font-semibold text-[#14B8A6] hover:underline"
                              >
                                Zum Eintrag springen
                              </button>
                              <div className="flex items-center gap-1.5">
                                <select
                                  value={act.targetProjectId}
                                  onChange={(e) =>
                                    onMoveAiAction(log.id, act.actionId, e.target.value)
                                  }
                                  className="px-2 py-1 rounded text-[10px] bg-[#181A1B] text-white border border-white/10"
                                >
                                  {projects
                                    .filter((p) => !p.archived)
                                    .map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.name}
                                      </option>
                                    ))}
                                </select>
                                <button
                                  onClick={() => onUndoAiAction(log.id, act.actionId)}
                                  className="px-2 py-1 rounded text-[10px] bg-red-500/20 text-red-300 flex items-center gap-1"
                                >
                                  <Undo2 className="w-3 h-3" />
                                  Undo
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {analyticsSubView === 'selfchecks' && <SelfCheckHistoryPanel entries={selfChecks} />}

          {analyticsSubView === 'archive' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projects
                .filter((p) => p.archived)
                .map((arch) => (
                  <div
                    key={arch.id}
                    className="p-4 rounded-xl border border-white/10 flex items-center justify-between gap-3"
                    style={{ backgroundColor: THEME.bgCard }}
                  >
                    <div>
                      <span className="text-[10px] font-mono text-[#14B8A6]">
                        <FolderArchive className="w-3.5 h-3.5 inline mr-1" />
                        {arch.archivedAt || 'Archiviert'}
                      </span>
                      <h4 className="text-sm font-bold text-white mt-0.5">{arch.name}</h4>
                      <p className="text-xs text-[#9CA3AF]">{arch.subtitle}</p>
                    </div>
                    <button
                      onClick={() => onToggleArchiveProject(arch.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white shrink-0"
                      style={{ backgroundColor: THEME.accentPrimary }}
                    >
                      Wiederherstellen
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* BEREICH 2: ? PLANUNG & AUTOMATISIERUNG */}
      {activeTab === 'planner' && (
        <div className="space-y-5">
          <div
            className="p-4 rounded-2xl border border-white/10 flex flex-wrap items-center justify-between gap-3"
            style={{ backgroundColor: THEME.bgCard }}
          >
            <div>
              <h3 className="text-sm font-bold text-white">
                Tagesblock-Planung, Etappen-Runterbrecher &amp; Kalender-Bridge
              </h3>
              <p className="text-xs text-[#9CA3AF]">
                Verteile offene Tasks auf die 4 Tagesblöcke oder exportiere sie als `.ics`-Kalenderdatei.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={onAutoStructureDay}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5"
                style={{ backgroundColor: THEME.accentPrimary }}
              >
                <Sparkles className="w-4 h-4" />
                Tag per KI strukturieren
              </button>
              <button
                onClick={() => {
                  const cnt = exportScheduledTasksToIcs(projects);
                  onNotify(`.ics Kalenderdatei mit ${cnt} Terminen exportiert!`);
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#181A1B] text-white border border-white/15 flex items-center gap-1.5"
              >
                <Download className="w-4 h-4 text-[#14B8A6]" />
                .ics Kalender-Export
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div
              className="lg:col-span-5 p-4 rounded-2xl border border-white/10 space-y-3"
              style={{ backgroundColor: THEME.bgCard }}
            >
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#14B8A6]">
                Offene Aufgaben zuweisen
              </h4>
              <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                {projects
                  .filter((p) => !p.archived)
                  .flatMap((p) =>
                    p.tasks
                      .filter((t) => !t.completed)
                      .map((t) => ({ proj: p, task: t }))
                  )
                  .map(({ proj, task }) => (
                    <div
                      key={task.id}
                      className="p-3 rounded-xl bg-[#2F363D] border border-white/10 space-y-2"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#14B8A6] font-semibold">{proj.name}</span>
                        <span className="text-[#9CA3AF] font-mono">{task.estimatedMinutes}m</span>
                      </div>
                      <p className="text-xs font-bold text-white">{task.title}</p>
                      <div className="grid grid-cols-4 gap-1">
                        {DAY_BLOCKS.map((b, i) => (
                          <button
                            key={b.id}
                            onClick={() =>
                              onAssignDayBlock(
                                proj.id,
                                task.id,
                                task.dayBlock === b.id ? null : b.id
                              )
                            }
                            className={`py-1 rounded text-[10px] font-semibold border ${
                              task.dayBlock === b.id
                                ? 'bg-[#0A9396] text-white border-[#14B8A6]'
                                : 'bg-[#181A1B] text-[#9CA3AF] border-white/5'
                            }`}
                          >
                            Block {i + 1}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div className="lg:col-span-7 space-y-3">
              {DAY_BLOCKS.map((block) => {
                const assigned = projects
                  .filter((p) => !p.archived)
                  .flatMap((p) =>
                    p.tasks
                      .filter((t) => !t.completed && t.dayBlock === block.id)
                      .map((t) => ({ projName: p.name, task: t }))
                  );

                return (
                  <div
                    key={block.id}
                    className="p-4 rounded-2xl border border-white/10 space-y-2"
                    style={{ backgroundColor: THEME.bgCard }}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs sm:text-sm font-bold text-white">{block.title}</h4>
                      <span className="text-[11px] font-mono text-[#14B8A6]">{block.slot}</span>
                    </div>
                    <p className="text-[11px] text-[#9CA3AF]">{block.subtitle}</p>
                    {assigned.length === 0 ? (
                      <p className="text-[11px] text-[#9CA3AF]/60 pt-1">Keine Tasks zugewiesen.</p>
                    ) : (
                      <div className="space-y-1.5 pt-1">
                        {assigned.map(({ projName, task }) => (
                          <div
                            key={task.id}
                            className="p-2.5 rounded-lg bg-[#2F363D] flex items-center justify-between text-xs"
                          >
                            <span className="text-white font-semibold">{task.title}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-[#181A1B] text-[#14B8A6]">
                              {projName}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Großprojekt Etappen-Runterbrecher */}
              <div
                className="p-4 rounded-2xl border border-white/10 space-y-3"
                style={{ backgroundColor: THEME.bgCard }}
              >
                <h4 className="text-xs font-bold uppercase text-[#14B8A6]">
                  Großprojekt in Tages-Etappen herunterbrechen
                </h4>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={breakdownProjId}
                    onChange={(e) => setBreakdownProjId(e.target.value)}
                    className="px-3 py-1.5 rounded-lg text-xs bg-[#181A1B] text-white border border-white/10"
                  >
                    {projects
                      .filter((p) => !p.archived)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                  <input
                    type="number"
                    value={dailyBudgetMin}
                    onChange={(e) => setDailyBudgetMin(Number(e.target.value) || 60)}
                    className="w-28 px-2.5 py-1.5 rounded-lg text-xs bg-[#181A1B] text-white font-mono border border-white/10"
                  />
                  <button
                    onClick={() => {
                      const p = projects.find((x) => x.id === breakdownProjId);
                      if (!p) return;
                      const list = p.tasks
                        .filter((t) => !t.completed)
                        .map((t, idx) => ({
                          step: idx + 1,
                          title: t.title,
                          minutes: Math.min(dailyBudgetMin, t.estimatedMinutes || 30)
                        }));
                      setGeneratedStages(list);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                    style={{ backgroundColor: THEME.accentPrimary }}
                  >
                    Etappen berechnen
                  </button>
                </div>
                {generatedStages.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    {generatedStages.map((s) => (
                      <div
                        key={s.step}
                        className="p-2 rounded bg-[#181A1B] flex items-center justify-between text-xs"
                      >
                        <span>
                          <strong className="text-[#14B8A6]">Etappe {s.step}:</strong> {s.title}
                        </span>
                        <span className="font-mono text-[#9CA3AF]">{s.minutes} Min.</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BEREICH 3: ? ADD-ON ZENTRALE */}
      {activeTab === 'addons' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div
            className="p-5 rounded-2xl border border-white/10 space-y-4"
            style={{ backgroundColor: THEME.bgCard }}
          >
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Puzzle className="w-4 h-4 text-[#14B8A6]" />
                Isolierte Steckkarten-Plugins (`src/plugins/`)
              </h3>
              <p className="text-xs text-[#9CA3AF]">
                Schalte Werkzeuge gezielt pro Projekt für den Reiter „? Extras“ frei.
              </p>
            </div>

            <div className="space-y-3">
              {PLUGIN_REGISTRY.map((plugin) => (
                <div
                  key={plugin.id}
                  className="p-4 rounded-xl bg-[#2F363D] border border-white/10 space-y-2.5"
                >
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-white">{plugin.name}</h4>
                    <p className="text-[11px] text-[#9CA3AF] mt-0.5">{plugin.description}</p>
                    <span className="text-[10px] font-mono text-[#14B8A6] block mt-1">
                      customMeta Keys: {plugin.metaKeysUsed.join(', ')}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/10">
                    {projects
                      .filter((p) => !p.archived)
                      .map((proj) => {
                        const enabled = proj.enabledPlugins.includes(plugin.id);
                        return (
                          <button
                            key={proj.id}
                            onClick={() => onTogglePluginForProject(proj.id, plugin.id)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition ${
                              enabled
                                ? 'bg-[#0A9396] text-white border-[#14B8A6]'
                                : 'bg-[#181A1B] text-[#9CA3AF] border-white/10'
                            }`}
                          >
                            {enabled ? '? ' : '+ '}
                            {proj.name}
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            className="p-5 rounded-2xl border border-white/10 space-y-4"
            style={{ backgroundColor: THEME.bgCard }}
          >
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Calculator className="w-4 h-4 text-[#14B8A6]" />
              Live Notiz-Kalkulator (Direkt-Ablage in Projekt-Infos)
            </h3>
            <textarea
              rows={5}
              value={scratchpad}
              onChange={(e) => setScratchpad(e.target.value)}
              className="w-full p-3 rounded-xl text-xs font-mono bg-[#181A1B] text-white border border-white/10"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
              <div className="text-xs">
                Summe:{' '}
                <strong className="font-mono text-sm text-[#14B8A6]">
                  {scratchTotal.toFixed(2)} €
                </strong>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={scratchTargetId}
                  onChange={(e) => setScratchTargetId(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg text-xs bg-[#181A1B] text-white border border-white/10"
                >
                  {projects
                    .filter((p) => !p.archived)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
                <button
                  onClick={() =>
                    onSaveScratchpadToProject(
                      scratchTargetId,
                      `Kalkulations-Notiz (${scratchTotal.toFixed(2)} €)`,
                      `${scratchpad}\n---\nGesamtsumme: ${scratchTotal.toFixed(2)} €`
                    )
                  }
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                  style={{ backgroundColor: THEME.accentPrimary }}
                >
                  In Infos speichern
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BEREICH 4: ?? SYSTEM & SCHNITTSTELLEN */}
      {activeTab === 'system' && (
        <div className="space-y-6">
          <div
            className="p-5 rounded-2xl border border-white/10 space-y-4"
            style={{ backgroundColor: THEME.bgCard }}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <Key className="w-5 h-5 text-[#14B8A6]" />
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Gemini 2.5 Flash API-Key &amp; IndexedDB Voll-Backup
                  </h3>
                  <p className="text-[11px] text-[#9CA3AF]">
                    Ohne API-Key arbeitet automatisch der lokale Offline-Schema-Router.
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-[#2F363D] text-[#14B8A6]">
                {userApiKey ? 'Gemini API aktiv' : 'Offline-Router aktiv'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <input
                  type="password"
                  value={userApiKey}
                  onChange={(e) => onChangeApiKey(e.target.value)}
                  placeholder="Optionaler Gemini API-Key (AIzaSy...)"
                  className="w-full px-3 py-2 rounded-lg text-xs bg-[#181A1B] text-white border border-white/15 font-mono"
                />

                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#9CA3AF]">
                    Reality-Check Button im Header anzeigen:
                  </span>
                  <button
                    onClick={onToggleRealityCheck}
                    className="px-3 py-1 rounded-lg text-xs font-bold text-white"
                    style={{
                      backgroundColor: realityCheckEnabled ? THEME.accentPrimary : '#4B5563'
                    }}
                  >
                    {realityCheckEnabled ? 'Aktiv' : 'Aus'}
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
                  <button
                    onClick={onExportFullBackup}
                    className="px-3 py-2 rounded-xl text-xs font-semibold bg-[#2F363D] text-white border border-white/10 flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5 text-[#14B8A6]" />
                    IndexedDB JSON-Backup
                  </button>
                  <label className="cursor-pointer px-3 py-2 rounded-xl text-xs font-semibold bg-[#2F363D] text-[#14B8A6] border border-[#14B8A6]/40 flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    Backup einspielen
                    <input
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={handleBackupImportFile}
                    />
                  </label>
                </div>
              </div>

              <pre className="p-3 rounded-xl bg-[#181A1B] border border-white/10 text-[10px] font-mono text-[#9CA3AF] max-h-40 overflow-y-auto">
                {JSON.stringify(AI_ROUTER_RESPONSE_SCHEMA, null, 2)}
              </pre>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div
              className="p-5 rounded-2xl border border-[#14B8A6]/40 space-y-3"
              style={{ backgroundColor: THEME.bgCard }}
            >
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-[#14B8A6]" />
                <h3 className="text-sm font-bold text-white">
                  Galaxy Z Flip 7 Frontdisplay-Modus (`?mode=cover`)
                </h3>
              </div>
              <p className="text-xs text-[#9CA3AF]">
                Startet direkt per URL-Parameter `?mode=cover` oder über das PWA-App-Shortcut im Kompakt-Format.
              </p>
              <button
                onClick={onOpenFlip7Cover}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-white"
                style={{ backgroundColor: THEME.accentPrimary }}
              >
                Flip 7 Frontdisplay-Ansicht jetzt testen
              </button>
            </div>

            <div
              className="p-5 rounded-2xl border border-white/10 space-y-3"
              style={{ backgroundColor: THEME.bgCard }}
            >
              <div className="flex items-center gap-2">
                <Webhook className="w-5 h-5 text-[#14B8A6]" />
                <h3 className="text-sm font-bold text-white">
                  Home Assistant &amp; Shelly TSA-Schnittstelle
                </h3>
              </div>
              <input
                type="text"
                value={haWebhookUrl}
                onChange={(e) => onChangeHaWebhook(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-xs font-mono bg-[#181A1B] text-[#14B8A6] border border-white/10"
              />
              <pre className="p-2.5 rounded-xl bg-[#181A1B] border border-white/10 text-[10px] font-mono text-[#9CA3AF] overflow-x-auto">
{`type: iframe
url: "${haEmbedUrl}"
aspect_ratio: 100%
title: "NexusFlow • Pizza Bandit & Smart Home"`}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};