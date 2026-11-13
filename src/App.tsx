import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Compass,
  HeartHandshake,
  Layers,
  Mic,
  Settings2,
  Smartphone,
  X
} from 'lucide-react';
import {
  AiExecutedAction,
  AiLogEntry,
  AppStateSnapshot,
  Attachment,
  BackofficeTabId,
  DayBlockId,
  DomainType,
  Project,
  ProjectTabId,
  THEME
} from './types';
import { INITIAL_APP_SNAPSHOT } from './data/pizzaBanditTsaSeed';
import {
  downloadStateBackupJson,
  formatNow,
  loadPersistedState,
  savePersistedState
} from './services/storage';
import {
  askQuickAssistantQuestion,
  enforceMaxSixWords,
  routeVoiceCommand
} from './services/aiRouter';
import { buildProcurementCheck } from './plugins/procurementCheck';
import { RealityCheckModal, SelfCheckModal } from './plugins/mindfulChecks';
import { Flip7CoverView } from './core/Flip7CoverView';
import { VoiceModal } from './core/VoiceModal';
import { FrontWorkspace } from './core/FrontWorkspace';
import { BackofficeWorkspace } from './core/BackofficeWorkspace';

export default function App() {
  const [state, setState] = useState<AppStateSnapshot>(INITIAL_APP_SNAPSHOT);
  const [hydrated, setHydrated] = useState(false);

  // Navigation & URL ?mode=cover Erkennung
  const [isBackoffice, setIsBackoffice] = useState(false);
  const [backofficeTab, setBackofficeTab] = useState<BackofficeTabId>('analytics');
  const [flip7CoverMode, setFlip7CoverMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('mode') === 'cover';
  });

  const [activeDomain, setActiveDomain] = useState<DomainType>('arbeit');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('proj-foodtruck');
  const [activeProjectTab, setActiveProjectTab] = useState<ProjectTabId>('tasks');
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);

  // Modals & Toast
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [realityModalOpen, setRealityModalOpen] = useState(false);
  const [selfCheckModalOpen, setSelfCheckModalOpen] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [newProjectModalOpen, setNewProjectModalOpen] = useState(false);
  const [newProjName, setNewProjName] = useState('');
  const [newProjSubtitle, setNewProjSubtitle] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3400);
  };

  // Initiales Laden aus IndexedDB
  useEffect(() => {
    loadPersistedState(INITIAL_APP_SNAPSHOT).then((loaded) => {
      setState(loaded);
      setHydrated(true);
    });
  }, []);

  // Automatische Speicherung in IndexedDB nach Hydration
  useEffect(() => {
    if (!hydrated) return;
    savePersistedState(state);
  }, [state, hydrated]);

  // URL-Parameter ?mode=cover sauber synchron halten
  const toggleCoverMode = (enable: boolean) => {
    setFlip7CoverMode(enable);
    try {
      const url = new URL(window.location.href);
      if (enable) url.searchParams.set('mode', 'cover');
      else url.searchParams.delete('mode');
      window.history.replaceState({}, '', url.toString());
    } catch {
      // ignore in restricted environments
    }
  };

  // Globaler Alt + S Shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        setVoiceModalOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const domainProjects = useMemo(
    () => state.projects.filter((p) => !p.archived && p.domain === activeDomain),
    [state.projects, activeDomain]
  );

  const activeProject = useMemo(() => {
    return (
      domainProjects.find((p) => p.id === selectedProjectId) ||
      domainProjects[0] ||
      state.projects.find((p) => !p.archived)
    );
  }, [domainProjects, selectedProjectId, state.projects]);

  const topThreeOpenTasks = useMemo(() => {
    const out: Array<{ projectId: string; projectName: string; task: Project['tasks'][0] }> = [];
    if (activeProject) {
      activeProject.tasks.forEach((t) => {
        if (!t.completed) out.push({ projectId: activeProject.id, projectName: activeProject.name, task: t });
      });
    }
    state.projects.forEach((p) => {
      if (p.archived || p.id === activeProject?.id) return;
      p.tasks.forEach((t) => {
        if (!t.completed) out.push({ projectId: p.id, projectName: p.name, task: t });
      });
    });
    return out.slice(0, 3);
  }, [state.projects, activeProject]);

  // Projekt-Mutationen
  const updateProject = (projectId: string, updater: (p: Project) => Project) => {
    setState((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => (p.id === projectId ? updater(p) : p))
    }));
  };

  const handleDistributeVoiceCommand = async (
    rawText: string,
    attachment: Attachment | null
  ) => {
    const { plan, engine } = await routeVoiceCommand(
      rawText,
      state.userApiKey,
      activeProject?.id || 'proj-foodtruck'
    );
    const timestamp = formatNow();
    const executedActions: AiExecutedAction[] = [];
    let firstProjId = selectedProjectId;
    let firstTab: ProjectTabId = activeProjectTab;

    setState((prev) => {
      const nextProjects: Project[] = JSON.parse(JSON.stringify(prev.projects));

      plan.actions.forEach((act, idx) => {
        const target =
          nextProjects.find((p) => p.id === act.targetProjectId) || nextProjects[0];
        if (idx === 0) firstProjId = target.id;

        const safeTitle = enforceMaxSixWords(act.shortCheckableTitle, 'Neuer KI-Punkt');
        const safeNote = enforceMaxSixWords(act.changeFooterNote, 'Per KI einsortiert');
        const itemId = `ai-${Date.now()}-${idx}`;

        if (act.actionType === 'ADD_CART_ITEM') {
          if (idx === 0) firstTab = 'cart';
          target.cart.unshift({
            id: itemId,
            title: safeTitle,
            quantity: act.quantityOrMeasure || '1x',
            price: act.estimatedPrice || '',
            completed: false,
            aiTouched: true,
            lastModified: timestamp,
            changeReason: safeNote,
            source: 'KI-Zuordnung',
            procurementCheck: buildProcurementCheck(safeTitle),
            customMeta: { detail: act.detailedExplanation }
          });
          executedActions.push({
            actionId: `act-${Date.now()}-${idx}`,
            actionType: act.actionType,
            targetProjectId: target.id,
            targetSubTab: 'cart',
            targetItemId: itemId,
            shortCheckableTitle: safeTitle,
            detailedExplanation: act.detailedExplanation,
            changeFooterNote: safeNote,
            undone: false
          });
        } else if (act.actionType === 'UPDATE_EXPLANATION') {
          if (idx === 0) firstTab = 'explanations';
          target.explanations.unshift({
            id: itemId,
            title: safeTitle,
            stepsText: act.detailedExplanation,
            lastModified: timestamp,
            changeReason: safeNote,
            source: 'KI-Zuordnung',
            aiTouched: true,
            customMeta: {}
          });
          executedActions.push({
            actionId: `act-${Date.now()}-${idx}`,
            actionType: act.actionType,
            targetProjectId: target.id,
            targetSubTab: 'explanations',
            targetItemId: itemId,
            shortCheckableTitle: safeTitle,
            detailedExplanation: act.detailedExplanation,
            changeFooterNote: safeNote,
            undone: false
          });
        } else if (act.actionType === 'ADD_INFO') {
          if (idx === 0) firstTab = 'infos';
          target.infos.unshift({
            id: itemId,
            title: safeTitle,
            content: act.detailedExplanation,
            attachments: attachment ? [attachment] : [],
            lastModified: timestamp,
            changeReason: safeNote,
            source: 'KI-Zuordnung',
            aiTouched: true,
            customMeta: {}
          });
          executedActions.push({
            actionId: `act-${Date.now()}-${idx}`,
            actionType: act.actionType,
            targetProjectId: target.id,
            targetSubTab: 'infos',
            targetItemId: itemId,
            shortCheckableTitle: safeTitle,
            detailedExplanation: act.detailedExplanation,
            changeFooterNote: safeNote,
            undone: false
          });
        } else {
          if (idx === 0) firstTab = 'tasks';
          target.tasks.unshift({
            id: itemId,
            title: safeTitle,
            completed: act.actionType === 'CHECK_OFF_TASK',
            priority: act.priority || 'Mittel',
            estimatedMinutes: act.estimatedMinutes || 25,
            dayBlock: null,
            reminderAt: '',
            aiTouched: true,
            lastModified: timestamp,
            changeReason: safeNote,
            source: 'KI-Zuordnung',
            customMeta: { detail: act.detailedExplanation }
          });
          executedActions.push({
            actionId: `act-${Date.now()}-${idx}`,
            actionType: act.actionType,
            targetProjectId: target.id,
            targetSubTab: 'tasks',
            targetItemId: itemId,
            shortCheckableTitle: safeTitle,
            detailedExplanation: act.detailedExplanation,
            changeFooterNote: safeNote,
            undone: false
          });
        }
      });

      const newLog: AiLogEntry = {
        id: `log-${Date.now()}`,
        timestamp,
        rawInput: rawText,
        summary: plan.summary,
        engine,
        undone: false,
        actions: executedActions
      };

      return {
        ...prev,
        projects: nextProjects,
        aiLogs: [newLog, ...prev.aiLogs]
      };
    });

    const dest = state.projects.find((p) => p.id === firstProjId);
    if (dest) {
      setActiveDomain(dest.domain);
      setSelectedProjectId(dest.id);
      setActiveProjectTab(firstTab);
    }
    notify(`KI-Router: ${executedActions.length} Aktion(en) einsortiert!`);
  };

  if (flip7CoverMode) {
    return (
      <>
        <Flip7CoverView
          activeProject={activeProject}
          topTasks={topThreeOpenTasks}
          onToggleTask={(projId, taskId) => {
            const ts = formatNow();
            updateProject(projId, (p) => ({
              ...p,
              tasks: p.tasks.map((t) =>
                t.id === taskId ? { ...t, completed: !t.completed, lastModified: ts } : t
              )
            }));
          }}
          onOpenVoice={() => setVoiceModalOpen(true)}
          onExitCoverMode={() => toggleCoverMode(false)}
        />
        <VoiceModal
          open={voiceModalOpen}
          activeProjectName={activeProject?.name || 'Pizza Bandit'}
          onClose={() => setVoiceModalOpen(false)}
          onDistributeCommand={handleDistributeVoiceCommand}
          onAskQuickQuestion={async (q, att) => ({
            answer: await askQuickAssistantQuestion(
              q,
              activeProject?.name || 'Pizza Bandit',
              state.userApiKey,
              att
            )
          })}
          onSaveAnswerToInfos={(q, ans, att) => {
            if (!activeProject) return;
            updateProject(activeProject.id, (p) => ({
              ...p,
              infos: [
                {
                  id: `i-qa-${Date.now()}`,
                  title: enforceMaxSixWords(q, 'KI-Schnellfrage'),
                  content: `Frage: ${q}\n\nAntwort:\n${ans}`,
                  attachments: att ? [att] : [],
                  lastModified: formatNow(),
                  changeReason: 'Aus Schnell-Frage gespeichert',
                  source: 'KI-Zuordnung',
                  aiTouched: true,
                  customMeta: {}
                },
                ...p.infos
              ]
            }));
            notify('Antwort unter Infos gespeichert!');
          }}
        />
      </>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col selection:bg-[#0A9396] selection:text-white"
      style={{ backgroundColor: THEME.bgMain, color: THEME.textMain }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-30 border-b border-white/10 backdrop-blur-md"
        style={{ backgroundColor: 'rgba(24, 26, 27, 0.95)' }}
      >
        <div
          className={`mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2 ${
            isBackoffice ? 'max-w-6xl' : 'max-w-md'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shadow border border-white/10 shrink-0"
              style={{
                background: isBackoffice
                  ? 'linear-gradient(135deg, #2F363D, #181A1B)'
                  : `linear-gradient(135deg, ${THEME.accentPrimary}, #055B5C)`
              }}
            >
              {isBackoffice ? (
                <Settings2 className="w-4 h-4 text-[#14B8A6]" />
              ) : (
                <Layers className="w-4 h-4 text-white" />
              )}
            </div>
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-sm font-bold tracking-tight text-[#F8F9FA]">
                NEXUS<span style={{ color: THEME.accentHighlight }}>FLOW</span>
              </span>
              {isBackoffice && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2F363D] text-[#14B8A6] font-semibold">
                  Backoffice
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <div
              className="flex items-center rounded-full p-0.5 border"
              style={{
                backgroundColor: THEME.bgCard,
                borderColor: 'rgba(20, 184, 166, 0.32)'
              }}
            >
              {state.realityCheckEnabled && (
                <>
                  <button
                    onClick={() => setRealityModalOpen(true)}
                    className="px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 text-[#14B8A6] hover:bg-white/5"
                  >
                    <Compass className="w-3.5 h-3.5" />
                    <span>Reality</span>
                  </button>
                  <span className="w-[1px] h-3.5 bg-white/10" />
                </>
              )}
              <button
                onClick={() => setSelfCheckModalOpen(true)}
                className="px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 text-[#F8F9FA] hover:bg-white/5"
              >
                <HeartHandshake className="w-3.5 h-3.5 text-[#14B8A6]" />
                <span>Selbst-Check</span>
              </button>
            </div>

            <button
              onClick={() => toggleCoverMode(true)}
              title="Flip 7 Frontdisplay-Modus (?mode=cover)"
              className="p-1.5 rounded-full border border-white/10 text-[#9CA3AF] hover:text-[#14B8A6]"
              style={{ backgroundColor: THEME.bgCard }}
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main
        className={`flex-1 w-full mx-auto px-3 sm:px-4 pt-3 pb-28 ${
          isBackoffice ? 'max-w-6xl' : 'max-w-md'
        }`}
      >
        {!isBackoffice ? (
          <FrontWorkspace
            activeDomain={activeDomain}
            domainProjects={domainProjects}
            activeProject={activeProject}
            activeTab={activeProjectTab}
            highlightedItemId={highlightedItemId}
            onSwitchDomain={(d) => {
              setActiveDomain(d);
              const first = state.projects.find((p) => !p.archived && p.domain === d);
              if (first) setSelectedProjectId(first.id);
            }}
            onSelectProject={setSelectedProjectId}
            onChangeTab={setActiveProjectTab}
            onOpenNewProjectModal={() => setNewProjectModalOpen(true)}
            onUploadProjectLogo={(projId, file) => {
              const reader = new FileReader();
              reader.onload = (ev) => {
                updateProject(projId, (p) => ({
                  ...p,
                  customLogoUrl: String(ev.target?.result || '')
                }));
                notify('Eigenes Projekt-Logo in IndexedDB gespeichert!');
              };
              reader.readAsDataURL(file);
            }}
            onResetProjectLogo={(projId) => {
              updateProject(projId, (p) => ({ ...p, customLogoUrl: null }));
              notify('Standard-Logo wiederhergestellt.');
            }}
            onConfirmRedDot={(projId, section, itemId) => {
              const ts = formatNow();
              updateProject(projId, (p) => ({
                ...p,
                [section]: (p[section] as any[]).map((it) =>
                  it.id === itemId
                    ? { ...it, aiTouched: false, lastModified: ts, changeReason: 'KI-Punkt bestätigt' }
                    : it
                )
              }));
              notify('KI-Änderung bestätigt.');
            }}
            onResetChecklist={(projId) => {
              const ts = formatNow();
              updateProject(projId, (p) => ({
                ...p,
                tasks: p.tasks.map((t) => ({
                  ...t,
                  completed: false,
                  lastModified: ts,
                  changeReason: 'Checkliste für Einsatz zurückgesetzt'
                }))
              }));
              notify('Checkliste für neuen Einsatz zurückgesetzt!');
            }}
            onToggleTask={(projId, taskId) => {
              const ts = formatNow();
              updateProject(projId, (p) => ({
                ...p,
                tasks: p.tasks.map((t) =>
                  t.id === taskId ? { ...t, completed: !t.completed, lastModified: ts } : t
                )
              }));
            }}
            onAddTask={(projId, title) => {
              updateProject(projId, (p) => ({
                ...p,
                tasks: [
                  {
                    id: `t-${Date.now()}`,
                    title,
                    completed: false,
                    priority: 'Mittel',
                    estimatedMinutes: 25,
                    dayBlock: null,
                    reminderAt: '',
                    aiTouched: false,
                    lastModified: formatNow(),
                    changeReason: 'Manuell angelegt',
                    source: 'Manuell',
                    customMeta: {}
                  },
                  ...p.tasks
                ]
              }));
              notify('Task angelegt.');
            }}
            onDeleteTask={(projId, taskId) =>
              updateProject(projId, (p) => ({
                ...p,
                tasks: p.tasks.filter((t) => t.id !== taskId)
              }))
            }
            onSendTaskToCart={(projId, title) => {
              updateProject(projId, (p) => ({
                ...p,
                cart: [
                  {
                    id: `c-${Date.now()}`,
                    title,
                    quantity: '1x',
                    price: '',
                    completed: false,
                    aiTouched: false,
                    lastModified: formatNow(),
                    changeReason: 'Aus Tasks übernommen',
                    source: 'Manuell',
                    procurementCheck: buildProcurementCheck(title),
                    customMeta: {}
                  },
                  ...p.cart
                ]
              }));
              notify('In den Einkaufswagen übernommen!');
            }}
            onAddExplanation={(projId, title, stepsText) => {
              updateProject(projId, (p) => ({
                ...p,
                explanations: [
                  {
                    id: `e-${Date.now()}`,
                    title,
                    stepsText,
                    lastModified: formatNow(),
                    changeReason: 'Manuell erstellt',
                    source: 'Manuell',
                    aiTouched: false,
                    customMeta: {}
                  },
                  ...p.explanations
                ]
              }));
              notify('Arbeitserklärung gespeichert.');
            }}
            onUpdateExplanation={(projId, expId, title, stepsText) => {
              updateProject(projId, (p) => ({
                ...p,
                explanations: p.explanations.map((ex) =>
                  ex.id === expId
                    ? {
                        ...ex,
                        title,
                        stepsText,
                        lastModified: formatNow(),
                        changeReason: 'Ablauf bearbeitet',
                        aiTouched: false
                      }
                    : ex
                )
              }));
              notify('Arbeitserklärung aktualisiert.');
            }}
            onAddInfo={(projId, title, content) => {
              updateProject(projId, (p) => ({
                ...p,
                infos: [
                  {
                    id: `i-${Date.now()}`,
                    title,
                    content,
                    attachments: [],
                    lastModified: formatNow(),
                    changeReason: 'Manuell angelegt',
                    source: 'Manuell',
                    aiTouched: false,
                    customMeta: {}
                  },
                  ...p.infos
                ]
              }));
              notify('Info-Karte gespeichert.');
            }}
            onUploadInfoAttachment={(projId, infoId, file) => {
              const sizeKB = `${Math.max(1, Math.round(file.size / 1024))} KB`;
              const isImage = file.type.startsWith('image/');
              const isPdf =
                file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
              const isText =
                file.type.startsWith('text/') || /\.(txt|md|json|csv)$/i.test(file.name);

              const reader = new FileReader();
              reader.onload = (ev) => {
                const res = ev.target?.result;
                const newAtt: Attachment = {
                  id: `att-${Date.now()}`,
                  name: file.name,
                  type: isImage ? 'image' : isPdf ? 'pdf' : 'text',
                  mimeType: file.type || 'application/octet-stream',
                  size: sizeKB,
                  dataUrl: isImage || isPdf ? String(res) : null,
                  textContent: isText && !isImage && !isPdf ? String(res) : null
                };
                updateProject(projId, (p) => ({
                  ...p,
                  infos: p.infos.map((info) =>
                    info.id === infoId
                      ? {
                          ...info,
                          attachments: [newAtt, ...info.attachments],
                          lastModified: formatNow(),
                          changeReason: 'Anhang hinzugefügt'
                        }
                      : info
                  )
                }));
                notify('Anhang in IndexedDB gespeichert!');
              };
              if (isText && !isImage && !isPdf) reader.readAsText(file);
              else reader.readAsDataURL(file);
            }}
            onPreviewAttachment={(att) => setPreviewAttachment(att)}
            onAddCartItems={(projId, items) => {
              const ts = formatNow();
              updateProject(projId, (p) => ({
                ...p,
                cart: [
                  ...items.map((it, idx) => ({
                    id: `c-${Date.now()}-${idx}`,
                    title: it.title,
                    quantity: it.quantity || '1x',
                    price: it.price || '',
                    completed: false,
                    aiTouched: false,
                    lastModified: ts,
                    changeReason: it.reason || 'Manuell hinzugefügt',
                    source: 'Manuell',
                    procurementCheck: buildProcurementCheck(it.title),
                    customMeta: {}
                  })),
                  ...p.cart
                ]
              }));
              notify(`${items.length} Position(en) in den Wagen gelegt.`);
            }}
            onToggleCartItem={(projId, cartId) => {
              const ts = formatNow();
              updateProject(projId, (p) => ({
                ...p,
                cart: p.cart.map((c) =>
                  c.id === cartId ? { ...c, completed: !c.completed, lastModified: ts } : c
                )
              }));
            }}
            onDeleteCartItem={(projId, cartId) =>
              updateProject(projId, (p) => ({
                ...p,
                cart: p.cart.filter((c) => c.id !== cartId)
              }))
            }
            onUpdateProjectMeta={(projId, patch) => {
              updateProject(projId, (p) => ({
                ...p,
                customMeta: { ...p.customMeta, ...patch }
              }));
            }}
            onRecordEventSale={(entry) => {
              setState((prev) => ({
                ...prev,
                eventSalesLogs: [entry, ...prev.eventSalesLogs]
              }));
            }}
            onOpenAddonsBackoffice={() => {
              setIsBackoffice(true);
              setBackofficeTab('addons');
            }}
            onNotify={notify}
          />
        ) : (
          <BackofficeWorkspace
            activeTab={backofficeTab}
            projects={state.projects}
            aiLogs={state.aiLogs}
            selfChecks={state.selfChecks}
            eventSalesLogs={state.eventSalesLogs}
            userApiKey={state.userApiKey}
            realityCheckEnabled={state.realityCheckEnabled}
            haWebhookUrl={state.haWebhookUrl}
            haEmbedUrl={state.haEmbedUrl}
            onChangeTab={setBackofficeTab}
            onCloseBackoffice={() => setIsBackoffice(false)}
            onJumpToAction={(act) => {
              const p = state.projects.find((proj) => proj.id === act.targetProjectId);
              if (p) {
                setActiveDomain(p.domain);
                setSelectedProjectId(p.id);
                setActiveProjectTab(act.targetSubTab);
                setHighlightedItemId(act.targetItemId);
                setIsBackoffice(false);
                setTimeout(() => setHighlightedItemId(null), 3000);
              }
            }}
            onUndoAiAction={(logId, actionId) => {
              setState((prev) => {
                const nextLogs = prev.aiLogs.map((l) =>
                  l.id === logId
                    ? {
                        ...l,
                        actions: l.actions.map((a) =>
                          a.actionId === actionId ? { ...a, undone: true } : a
                        )
                      }
                    : l
                );
                const targetLog = prev.aiLogs.find((l) => l.id === logId);
                const targetAct = targetLog?.actions.find((a) => a.actionId === actionId);
                if (!targetAct) return { ...prev, aiLogs: nextLogs };

                const nextProjects = prev.projects.map((p) => {
                  if (p.id !== targetAct.targetProjectId) return p;
                  return {
                    ...p,
                    tasks: p.tasks.filter((t) => t.id !== targetAct.targetItemId),
                    cart: p.cart.filter((c) => c.id !== targetAct.targetItemId),
                    explanations: p.explanations.filter((e) => e.id !== targetAct.targetItemId),
                    infos: p.infos.filter((i) => i.id !== targetAct.targetItemId)
                  };
                });
                return { ...prev, projects: nextProjects, aiLogs: nextLogs };
              });
              notify('KI-Aktion rückgängig gemacht.');
            }}
            onMoveAiAction={(logId, actionId, newProjId) => {
              setState((prev) => {
                let movedItem: any = null;
                let subTab: string = 'tasks';
                const sourceLog = prev.aiLogs.find((l) => l.id === logId);
                const act = sourceLog?.actions.find((a) => a.actionId === actionId);
                if (!act) return prev;

                const nextProjects = prev.projects.map((p) => {
                  if (p.id === act.targetProjectId) {
                    subTab = act.targetSubTab;
                    if (subTab === 'tasks') {
                      movedItem = p.tasks.find((t) => t.id === act.targetItemId);
                      return { ...p, tasks: p.tasks.filter((t) => t.id !== act.targetItemId) };
                    }
                    if (subTab === 'cart') {
                      movedItem = p.cart.find((c) => c.id === act.targetItemId);
                      return { ...p, cart: p.cart.filter((c) => c.id !== act.targetItemId) };
                    }
                    if (subTab === 'explanations') {
                      movedItem = p.explanations.find((e) => e.id === act.targetItemId);
                      return { ...p, explanations: p.explanations.filter((e) => e.id !== act.targetItemId) };
                    }
                    if (subTab === 'infos') {
                      movedItem = p.infos.find((i) => i.id === act.targetItemId);
                      return { ...p, infos: p.infos.filter((i) => i.id !== act.targetItemId) };
                    }
                  }
                  return p;
                });

                if (!movedItem) return prev;

                const finalProjects = nextProjects.map((p) => {
                  if (p.id === newProjId) {
                    if (subTab === 'tasks') return { ...p, tasks: [movedItem, ...p.tasks] };
                    if (subTab === 'cart') return { ...p, cart: [movedItem, ...p.cart] };
                    if (subTab === 'explanations') return { ...p, explanations: [movedItem, ...p.explanations] };
                    if (subTab === 'infos') return { ...p, infos: [movedItem, ...p.infos] };
                  }
                  return p;
                });

                const nextLogs = prev.aiLogs.map((l) =>
                  l.id === logId
                    ? {
                        ...l,
                        actions: l.actions.map((a) =>
                          a.actionId === actionId ? { ...a, targetProjectId: newProjId } : a
                        )
                      }
                    : l
                );

                return { ...prev, projects: finalProjects, aiLogs: nextLogs };
              });
              notify('Eintrag in anderes Projekt verschoben.');
            }}
            onToggleArchiveProject={(projId) => {
              updateProject(projId, (p) => ({
                ...p,
                archived: !p.archived,
                archivedAt: !p.archived ? formatNow() : undefined
              }));
              notify('Projekt-Status geändert.');
            }}
            onAssignDayBlock={(projId, taskId, block) => {
              updateProject(projId, (p) => ({
                ...p,
                tasks: p.tasks.map((t) => (t.id === taskId ? { ...t, dayBlock: block } : t))
              }));
            }}
            onAutoStructureDay={() => {
              const blocks: DayBlockId[] = ['morning', 'focus', 'errands', 'evening'];
              setState((prev) => ({
                ...prev,
                projects: prev.projects.map((p) => ({
                  ...p,
                  tasks: p.tasks.map((t, idx) =>
                    !t.completed && !t.dayBlock
                      ? { ...t, dayBlock: blocks[idx % blocks.length] }
                      : t
                  )
                }))
              }));
              notify('Offene Tasks auf 4 Tagesblöcke verteilt!');
            }}
            onTogglePluginForProject={(projId, pluginId) => {
              updateProject(projId, (p) => {
                const exists = p.enabledPlugins.includes(pluginId);
                return {
                  ...p,
                  enabledPlugins: exists
                    ? p.enabledPlugins.filter((id) => id !== pluginId)
                    : [...p.enabledPlugins, pluginId]
                };
              });
            }}
            onSaveScratchpadToProject={(projId, title, content) => {
              updateProject(projId, (p) => ({
                ...p,
                infos: [
                  {
                    id: `i-scratch-${Date.now()}`,
                    title,
                    content,
                    attachments: [],
                    lastModified: formatNow(),
                    changeReason: 'Aus Notiz-Kalkulator gespeichert',
                    source: 'Manuell',
                    aiTouched: false,
                    customMeta: {}
                  },
                  ...p.infos
                ]
              }));
              notify('Notiz im Projekt gespeichert!');
            }}
            onChangeApiKey={(key) => setState((prev) => ({ ...prev, userApiKey: key }))}
            onToggleRealityCheck={() =>
              setState((prev) => ({
                ...prev,
                realityCheckEnabled: !prev.realityCheckEnabled
              }))
            }
            onChangeHaWebhook={(url) => setState((prev) => ({ ...prev, haWebhookUrl: url }))}
            onOpenFlip7Cover={() => toggleCoverMode(true)}
            onExportFullBackup={() => {
              downloadStateBackupJson(state);
              notify('Backup erfolgreich heruntergeladen.');
            }}
            onImportFullBackup={(snapshot) => {
              setState(snapshot);
              notify('Backup erfolgreich eingespielt!');
            }}
            onNotify={notify}
          />
        )}
      </main>

      {/* Bottom Sticky Bar: Großer Sprach-Button & Backoffice-Umschalter */}
      <footer
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/10 backdrop-blur-lg"
        style={{ backgroundColor: 'rgba(24, 26, 27, 0.95)' }}
      >
        <div className="max-w-md mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
          <button
            onClick={() => setIsBackoffice(false)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border ${
              !isBackoffice
                ? 'bg-[#2F363D] text-[#14B8A6] border-[#14B8A6]/40'
                : 'text-[#9CA3AF] hover:text-white border-transparent'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Front</span>
          </button>

          <button
            onClick={() => setVoiceModalOpen(true)}
            title="Globaler Sprach- & KI-Shortcut (Alt + S)"
            className="w-12 h-12 -mt-5 rounded-full flex items-center justify-center shadow-2xl transition-transform active:scale-90 border-2 border-[#14B8A6]"
            style={{
              background: `linear-gradient(135deg, ${THEME.accentPrimary}, #055B5C)`,
              boxShadow: '0 8px 24px rgba(10, 147, 150, 0.45)'
            }}
          >
            <Mic className="w-6 h-6 text-white" />
          </button>

          <button
            onClick={() => setIsBackoffice(true)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border ${
              isBackoffice
                ? 'bg-[#2F363D] text-[#14B8A6] border-[#14B8A6]/40'
                : 'text-[#9CA3AF] hover:text-white border-transparent'
            }`}
          >
            <Settings2 className="w-4 h-4" />
            <span>Backoffice</span>
          </button>
        </div>
      </footer>

      {/* Sprach- & KI-Modal (Alt + S) */}
      <VoiceModal
        open={voiceModalOpen}
        activeProjectName={activeProject?.name || 'Pizza Bandit'}
        onClose={() => setVoiceModalOpen(false)}
        onDistributeCommand={handleDistributeVoiceCommand}
        onAskQuickQuestion={async (q, att) => ({
          answer: await askQuickAssistantQuestion(
            q,
            activeProject?.name || 'Pizza Bandit',
            state.userApiKey,
            att
          )
        })}
        onSaveAnswerToInfos={(q, ans, att) => {
          if (!activeProject) return;
          updateProject(activeProject.id, (p) => ({
            ...p,
            infos: [
              {
                id: `i-qa-${Date.now()}`,
                title: enforceMaxSixWords(q, 'KI-Schnellfrage'),
                content: `Frage: ${q}\n\nAntwort:\n${ans}`,
                attachments: att ? [att] : [],
                lastModified: formatNow(),
                changeReason: 'Aus Schnell-Frage gespeichert',
                source: 'KI-Zuordnung',
                aiTouched: true,
                customMeta: {}
              },
              ...p.infos
            ]
          }));
          notify('Antwort unter Infos gespeichert!');
        }}
      />

      {/* Reality-Check Modal */}
      <RealityCheckModal
        open={realityModalOpen}
        onClose={() => setRealityModalOpen(false)}
      />

      {/* Wertfreier Selbst-Check Modal */}
      <SelfCheckModal
        open={selfCheckModalOpen}
        onClose={() => setSelfCheckModalOpen(false)}
        onSave={(entry) => {
          setState((prev) => ({
            ...prev,
            selfChecks: [entry, ...prev.selfChecks]
          }));
          notify('Selbst-Check wertfrei gespeichert.');
        }}
      />

      {/* Vorschau-Modal für IndexedDB-Dateianhänge (Bilder, PDFs, Text) */}
      {previewAttachment && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className="max-w-2xl w-full rounded-2xl border border-white/20 overflow-hidden flex flex-col max-h-[90vh] shadow-2xl"
            style={{ backgroundColor: THEME.bgCard }}
          >
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <span className="text-xs font-bold text-white truncate">
                {previewAttachment.name} ({previewAttachment.size})
              </span>
              <button
                onClick={() => setPreviewAttachment(null)}
                className="p-1 text-[#9CA3AF] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1 flex items-center justify-center">
              {previewAttachment.type === 'image' && previewAttachment.dataUrl && (
                <img
                  src={previewAttachment.dataUrl}
                  alt={previewAttachment.name}
                  className="max-h-[70vh] object-contain rounded-lg"
                />
              )}
              {previewAttachment.type === 'pdf' && previewAttachment.dataUrl && (
                <iframe
                  src={previewAttachment.dataUrl}
                  title={previewAttachment.name}
                  className="w-full h-[70vh] rounded-lg"
                />
              )}
              {previewAttachment.type === 'text' && previewAttachment.textContent && (
                <pre className="p-4 rounded-xl bg-[#181A1B] text-xs font-mono text-white whitespace-pre-wrap overflow-auto max-h-[70vh] w-full">
                  {previewAttachment.textContent}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Neues Projekt Anlegen Modal */}
      {newProjectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className="max-w-sm w-full rounded-2xl border border-white/15 p-5 space-y-4 shadow-2xl"
            style={{ backgroundColor: THEME.bgCard }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Neues Projekt anlegen</h3>
              <button
                onClick={() => setNewProjectModalOpen(false)}
                className="p-1 text-[#9CA3AF] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              value={newProjName}
              onChange={(e) => setNewProjName(e.target.value)}
              placeholder="Projektname (z. B. Ofenbau Phase 2)..."
              className="w-full px-3 py-2 rounded-xl text-xs bg-[#181A1B] text-white border border-white/10"
            />
            <input
              type="text"
              value={newProjSubtitle}
              onChange={(e) => setNewProjSubtitle(e.target.value)}
              placeholder="Untertitel / Kurzbeschreibung..."
              className="w-full px-3 py-2 rounded-xl text-xs bg-[#181A1B] text-white border border-white/10"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setNewProjectModalOpen(false)}
                className="px-3 py-1.5 text-xs text-[#9CA3AF]"
              >
                Abbrechen
              </button>
              <button
                onClick={() => {
                  if (!newProjName.trim()) return;
                  const newId = `proj-${Date.now()}`;
                  const newProj = {
                    id: newId,
                    domain: activeDomain,
                    name: newProjName.trim(),
                    subtitle: newProjSubtitle.trim() || 'Individuelles Projekt',
                    icon: 'FolderKanban',
                    customLogoUrl: null,
                    accentColor: '#14B8A6',
                    archived: false,
                    enabledPlugins: [],
                    tasks: [],
                    explanations: [],
                    infos: [],
                    cart: [],
                    customMeta: {}
                  };
                  setState((prev) => ({
                    ...prev,
                    projects: [...prev.projects, newProj]
                  }));
                  setSelectedProjectId(newId);
                  setNewProjName('');
                  setNewProjSubtitle('');
                  setNewProjectModalOpen(false);
                  notify('Neues Projekt erfolgreich erstellt!');
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white"
                style={{ backgroundColor: THEME.accentPrimary }}
              >
                Anlegen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Benachrichtigung */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-[#24292E] border border-[#14B8A6] text-white text-xs font-semibold shadow-2xl flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-[#14B8A6]" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
