import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, MessageSquare, Scale, Mic, Plus, X } from 'lucide-react';
import {
  AiExecutedAction,
  AiLogEntry,
  AppStateSnapshot,
  Attachment,
  BackofficeTabId,
  DomainType,
  Project,
  ProjectTabId,
  PriorityType,
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
  compressImageFile,
  enforceMaxSixWords,
  routeVoiceCommand
} from './services/aiRouter';
import { buildProcurementCheck } from './plugins/procurementCheck';
import { RealityCheckModal, SelfCheckModal } from './plugins/mindfulChecks';
import { Flip7CoverView } from './core/Flip7CoverView';
import { VoiceModal } from './core/VoiceModal';
import { FrontWorkspace } from './core/FrontWorkspace';
import { DeepResearchAndAuditModal } from './components/DeepResearchAndAuditModal';
import {
  checkAndFireDueReminders,
  loadCloudConfig,
  pushStateToCloud
} from './services/cloudSyncAndPush';
import {
  inspectAndQueueCriticalTopic,
  loadAuditSettings,
  loadAuditWatchlist,
  runDeepResearchWithCitations,
  saveAuditSettings,
  saveAuditWatchlist
} from './services/deepResearchAndScanner';
import { BackofficeWorkspace } from './core/BackofficeWorkspace';

interface PhotoMeasurePin {
  id: string;
  xPercent: number;
  yPercent: number;
  label: string;
}

const PHOTO_PINS_STORAGE_KEY = 'banditos_photo_pins_v3';

function isCoverScreenEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  if (new URLSearchParams(window.location.search).get('mode') === 'cover') {
    return true;
  }
  return window.innerHeight <= 470 && window.innerWidth <= 520;
}

export default function App() {
  const [state, setState] = useState<AppStateSnapshot>(INITIAL_APP_SNAPSHOT);
  const [hydrated, setHydrated] = useState(false);

  const [isBackoffice, setIsBackoffice] = useState(false);
  const [backofficeTab, setBackofficeTab] = useState<BackofficeTabId>('analytics');
  const [flip7CoverMode, setFlip7CoverMode] = useState<boolean>(isCoverScreenEnvironment);

  const [activeDomain, setActiveDomain] = useState<DomainType>('arbeit');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('proj-foodtruck');
  const [activeProjectTab, setActiveProjectTab] = useState<ProjectTabId>('tasks');
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);

  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [deepResearchModalOpen, setDeepResearchModalOpen] = useState(false);
  const [autoStartMicOnOpen, setAutoStartMicOnOpen] = useState(true);
  const [realityModalOpen, setRealityModalOpen] = useState(false);
  const [selfCheckModalOpen, setSelfCheckModalOpen] = useState(false);
  const [newProjectModalOpen, setNewProjectModalOpen] = useState(false);
  const [newProjName, setNewProjName] = useState('');
  const [newProjSubtitle, setNewProjSubtitle] = useState('');
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [photoPins, setPhotoPins] = useState<Record<string, PhotoMeasurePin[]>>(() => {
    try {
      const raw = localStorage.getItem(PHOTO_PINS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [newPinLabel, setNewPinLabel] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const notify = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    const onResize = () => {
      if (window.innerHeight <= 470 && window.innerWidth <= 520) {
        setFlip7CoverMode(true);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    loadPersistedState(INITIAL_APP_SNAPSHOT).then((loaded) => {
      const normalizedProjects = (loaded.projects || INITIAL_APP_SNAPSHOT.projects).map((p) => {
        if (p.id === 'proj-foodtruck') {
          return {
            ...p,
            customLogoUrl: p.customLogoUrl || '/raccoon-logo.png',
            enabledPlugins: Array.isArray(p.enabledPlugins) ? p.enabledPlugins : []
          };
        }
        if (p.id === 'proj-baeckerei') {
          return {
            ...p,
            name: 'Baustelle Bäckerei (Umbau)',
            subtitle: p.subtitle || 'Reine Baustelle & Renovierung (150 m² Backstube)',
            accentColor: '#D97706',
            enabledPlugins: Array.isArray(p.enabledPlugins) ? p.enabledPlugins : []
          };
        }
        return {
          ...p,
          enabledPlugins: Array.isArray(p.enabledPlugins) ? p.enabledPlugins : []
        };
      });

      setState({
        ...INITIAL_APP_SNAPSHOT,
        ...loaded,
        projects: normalizedProjects,
        eventSalesLogs: Array.isArray(loaded.eventSalesLogs) ? loaded.eventSalesLogs : [],
        aiLogs: Array.isArray(loaded.aiLogs) ? loaded.aiLogs : [],
        selfChecks: Array.isArray(loaded.selfChecks) ? loaded.selfChecks : []
      });
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    savePersistedState(state);
  }, [state, hydrated]);

  const toggleCoverMode = (enable: boolean) => {
    setFlip7CoverMode(enable);
    try {
      const url = new URL(window.location.href);
      if (enable) url.searchParams.set('mode', 'cover');
      else url.searchParams.delete('mode');
      window.history.replaceState({}, '', url.toString());
    } catch {
      // ignore
    }
  };

  const domainProjects = useMemo(
    () => state.projects.filter((p) => !p.archived && p.domain === activeDomain),
    [state.projects, activeDomain]
  );

  const activeProject = useMemo(
    () =>
      domainProjects.find((p) => p.id === selectedProjectId) ||
      domainProjects[0] ||
      state.projects.find((p) => !p.archived),
    [domainProjects, selectedProjectId, state.projects]
  );

  const activeVisualTheme = useMemo(() => {
    if (activeDomain === 'privat') {
      return {
        primary: '#4F46E5',
        highlight: '#818CF8',
        glow: 'rgba(79, 70, 229, 0.35)'
      };
    }
    if (activeProject?.id === 'proj-baeckerei') {
      return {
        primary: '#D97706',
        highlight: '#F59E0B',
        glow: 'rgba(217, 119, 6, 0.35)'
      };
    }
    return {
      primary: '#0A9396',
      highlight: '#14B8A6',
      glow: 'rgba(10, 147, 150, 0.4)'
    };
  }, [activeDomain, activeProject?.id]);

  const topThreeOpenTasks = useMemo(() => {
    const list: Array<{ projectId: string; projectName: string; task: any }> = [];
    for (const proj of state.projects.filter((p) => !p.archived)) {
      for (const t of proj.tasks) {
        if (!t.completed) {
          list.push({ projectId: proj.id, projectName: proj.name, task: t });
        }
        if (list.length >= 3) break;
      }
      if (list.length >= 3) break;
    }
    return list;
  }, [state.projects]);

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
      activeProject?.id || 'proj-foodtruck',
      state.projects,
      undefined,
      attachment
    );

    const timestamp = formatNow();
    const executedActions: AiExecutedAction[] = [];
    const logId = `log-${Date.now()}`;
    let firstTargetProjectId = activeProject?.id || 'proj-foodtruck';
    inspectAndQueueCriticalTopic(
      rawText,
      firstTargetProjectId,
      activeProject?.name || 'Pizza Bandit',
      state.projects
    );
    let firstTab: ProjectTabId = activeProjectTab;

    if (plan.actions && plan.actions.length > 0) {
      setState((prev) => {
        const nextProjects = prev.projects.map((p) => ({
          ...p,
          tasks: [...p.tasks],
          explanations: [...p.explanations],
          infos: [...p.infos],
          cart: [...p.cart]
        }));

        plan.actions.forEach((act, idx) => {
          const target =
            nextProjects.find((p) => p.id === act.targetProjectId) ||
            nextProjects.find((p) => p.id === (activeProject?.id || 'proj-foodtruck')) ||
            nextProjects[0];

          if (!target) return;
          if (idx === 0) firstTargetProjectId = target.id;

          const itemId = `ai-${Date.now()}-${idx}`;
          const safeTitle = enforceMaxSixWords(act.shortCheckableTitle, 'Neuer Eintrag');
          const safeNote = enforceMaxSixWords(
            act.changeFooterNote || 'Durch KI zugeordnet',
            'Durch KI zugeordnet'
          );

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
              customMeta: {}
            });
            executedActions.push({
              actionId: `act-${itemId}`,
              actionType: act.actionType,
              targetProjectId: target.id,
              targetProjectName: target.name,
              targetSubTab: 'cart',
              targetItemId: itemId,
              shortCheckableTitle: safeTitle,
              detailedExplanation: act.detailedExplanation,
              changeFooterNote: safeNote,
              undone: false
            } as any);
          } else if (act.actionType === 'UPDATE_EXPLANATION') {
            if (idx === 0) firstTab = 'explanations';
            target.explanations.unshift({
              id: itemId,
              title: safeTitle,
              stepsText: act.detailedExplanation || rawText,
              lastModified: timestamp,
              changeReason: safeNote,
              source: 'KI-Zuordnung',
              aiTouched: true,
              customMeta: {}
            });
            executedActions.push({
              actionId: `act-${itemId}`,
              actionType: act.actionType,
              targetProjectId: target.id,
              targetProjectName: target.name,
              targetSubTab: 'explanations',
              targetItemId: itemId,
              shortCheckableTitle: safeTitle,
              detailedExplanation: act.detailedExplanation,
              changeFooterNote: safeNote,
              undone: false
            } as any);
          } else if (act.actionType === 'ADD_INFO') {
            if (idx === 0) firstTab = 'infos';
            target.infos.unshift({
              id: itemId,
              title: safeTitle,
              content: act.detailedExplanation || rawText,
              attachments: attachment ? [attachment] : [],
              lastModified: timestamp,
              changeReason: safeNote,
              source: 'KI-Zuordnung',
              aiTouched: true,
              customMeta: {}
            });
            executedActions.push({
              actionId: `act-${itemId}`,
              actionType: act.actionType,
              targetProjectId: target.id,
              targetProjectName: target.name,
              targetSubTab: 'infos',
              targetItemId: itemId,
              shortCheckableTitle: safeTitle,
              detailedExplanation: act.detailedExplanation,
              changeFooterNote: safeNote,
              undone: false
            } as any);
          } else {
            if (idx === 0) firstTab = 'tasks';
            target.tasks.unshift({
              id: itemId,
              title: act.assemblyGroup ? `[${act.assemblyGroup}] ${safeTitle}` : safeTitle,
              completed: act.actionType === 'CHECK_OFF_TASK',
              priority: act.priority || 'Mittel',
              estimatedMinutes: act.estimatedMinutes || 25,
              dayBlock: null,
              reminderAt: '',
              aiTouched: true,
              lastModified: timestamp,
              changeReason: safeNote,
              source: 'KI-Zuordnung',
              assemblyGroup: act.assemblyGroup,
              customMeta: {}
            });
            executedActions.push({
              actionId: `act-${itemId}`,
              actionType: act.actionType,
              targetProjectId: target.id,
              targetProjectName: target.name,
              targetSubTab: 'tasks',
              targetItemId: itemId,
              shortCheckableTitle: safeTitle,
              detailedExplanation: act.detailedExplanation,
              changeFooterNote: safeNote,
              undone: false
            } as any);
          }
        });

        const newLog: AiLogEntry = {
          id: logId,
          timestamp,
          rawTranscript: rawText,
          rawInput: rawText,
          summary: plan.summary,
          engineUsed: engine,
          engine: engine,
          undone: false,
          actions: executedActions
        } as any;

        return {
          ...prev,
          projects: nextProjects,
          aiLogs: [newLog, ...prev.aiLogs]
        };
      });

      const targetProj = state.projects.find((p) => p.id === firstTargetProjectId);
      if (targetProj) {
        setActiveDomain(targetProj.domain);
        setSelectedProjectId(targetProj.id);
        setActiveProjectTab(firstTab);
      }
    }

    return {
      replyText: plan.directAnswer || plan.summary,
      spokenText: plan.spokenFeedback || plan.summary,
      needsClarification: Boolean(plan.needsClarification),
      engine,
      logId,
      actions: executedActions
    };
  };

  const handleUndoAiAction = (logId: string, actionId: string) => {
    setState((prev) => {
      const log = prev.aiLogs.find((l) => l.id === logId);
      const act = log?.actions.find((a) => a.actionId === actionId);
      if (!act || act.undone) return prev;
      return {
        ...prev,
        projects: prev.projects.map((p) =>
          p.id !== act.targetProjectId
            ? p
            : {
                ...p,
                [act.targetSubTab]: (p[act.targetSubTab] as any[]).filter(
                  (it) => it.id !== act.targetItemId
                )
              }
        ),
        aiLogs: prev.aiLogs.map((l) =>
          l.id !== logId
            ? l
            : {
                ...l,
                actions: l.actions.map((a) =>
                  a.actionId === actionId ? { ...a, undone: true } : a
                )
              }
        )
      };
    });
    notify('Aktion rückgängig gemacht.');
  };

  const handleMoveAiAction = (logId: string, actionId: string, newProjId: string) => {
    setState((prev) => {
      const log = prev.aiLogs.find((l) => l.id === logId);
      const act = log?.actions.find((a) => a.actionId === actionId);
      if (!act || act.targetProjectId === newProjId) return prev;
      let movedItem: any = null;
      const removed = prev.projects.map((p) => {
        if (p.id !== act.targetProjectId) return p;
        const list = p[act.targetSubTab] as any[];
        movedItem = list.find((it) => it.id === act.targetItemId);
        return {
          ...p,
          [act.targetSubTab]: list.filter((it) => it.id !== act.targetItemId)
        };
      });
      const added = removed.map((p) => {
        if (p.id !== newProjId || !movedItem) return p;
        return {
          ...p,
          [act.targetSubTab]: [movedItem, ...(p[act.targetSubTab] as any[])]
        };
      });
      return {
        ...prev,
        projects: added,
        aiLogs: prev.aiLogs.map((l) =>
          l.id !== logId
            ? l
            : {
                ...l,
                actions: l.actions.map((a) =>
                  a.actionId === actionId ? { ...a, targetProjectId: newProjId } : a
                )
              }
        )
      };
    });
    notify('Eintrag verschoben.');
  };

  const handleJumpToAction = (act: AiExecutedAction) => {
    const targetProj = state.projects.find((p) => p.id === act.targetProjectId);
    if (!targetProj) return;
    setIsBackoffice(false);
    setActiveDomain(targetProj.domain);
    setSelectedProjectId(targetProj.id);
    setActiveProjectTab(act.targetSubTab);
    setHighlightedItemId(act.targetItemId);
    setTimeout(() => setHighlightedItemId(null), 2400);
  };

  // Update 3: Vor-Ort Foto-Maßband (Direktes Anpinnen von Maßen auf Fotos)
  const handleImageClickForMeasurePin = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!previewAttachment || !newPinLabel.trim()) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xPercent = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const yPercent = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    const pin: PhotoMeasurePin = {
      id: `pin-${Date.now()}`,
      xPercent,
      yPercent,
      label: newPinLabel.trim()
    };
    const current = photoPins[previewAttachment.id] || [];
    const next = { ...photoPins, [previewAttachment.id]: [...current, pin] };
    setPhotoPins(next);
    localStorage.setItem(PHOTO_PINS_STORAGE_KEY, JSON.stringify(next));
    setNewPinLabel('');
    notify('Maß-Pin auf dem Foto verankert.');
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
          onOpenVoice={() => {
            setAutoStartMicOnOpen(true);
            setVoiceModalOpen(true);
          }}
          onExitCoverMode={() => toggleCoverMode(false)}
        />
        <VoiceModal
          open={voiceModalOpen}
          autoStartMic={autoStartMicOnOpen}
          activeProjectName={activeProject?.name || 'Pizza Bandit'}
          projects={state.projects}
          aiLogs={state.aiLogs}
          onClose={() => setVoiceModalOpen(false)}
          onExecuteCommand={handleDistributeVoiceCommand}
          onAskQuestion={(q, att) =>
            askQuickAssistantQuestion(
              q,
              activeProject?.name || 'Pizza Bandit',
              state.userApiKey,
              att
            )
          }
          onSaveAnswerToInfos={(q, ans, att) => {
            if (!activeProject) return;
            updateProject(activeProject.id, (p) => ({
              ...p,
              infos: [
                {
                  id: `i-qa-${Date.now()}`,
                  title: enforceMaxSixWords(q, 'KI-Notiz'),
                  content: ans,
                  attachments: att ? [att] : [],
                  lastModified: formatNow(),
                  changeReason: 'Aus KI-Verlauf gespeichert',
                  source: 'KI-Zuordnung',
                  aiTouched: true,
                  customMeta: {}
                },
                ...p.infos
              ]
            }));
            notify('Unter Infos gespeichert.');
          }}
          onJumpToAction={handleJumpToAction}
          onUndoAiAction={handleUndoAiAction}
          onMoveAiAction={handleMoveAiAction}
        />
      </>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: THEME.bgMain, color: THEME.textMain }}
    >
      <div
        className="h-1 w-full transition-colors duration-500"
        style={{ backgroundColor: activeVisualTheme.primary }}
      />

      <main className="flex-1 w-full max-w-md mx-auto px-3 pt-3 pb-24">
        {!isBackoffice ? (
          <FrontWorkspace
            activeDomain={activeDomain}
            allProjects={state.projects}
            domainProjects={domainProjects}
            activeProject={activeProject}
            activeTab={activeProjectTab}
            highlightedItemId={highlightedItemId}
            onSwitchDomain={(d) => {
              setActiveDomain(d);
              const firstInDomain = state.projects.find((p) => !p.archived && p.domain === d);
              if (firstInDomain) setSelectedProjectId(firstInDomain.id);
            }}
            onSelectProject={(id) => setSelectedProjectId(id)}
            onChangeTab={(tab) => setActiveProjectTab(tab)}
            onOpenNewProjectModal={() => setNewProjectModalOpen(true)}
            onOpenDeepResearchModal={() => setDeepResearchModalOpen(true)}
            onUploadProjectLogo={async (projId, file) => {
              const { dataUrl } = await compressImageFile(file);
              updateProject(projId, (p) => ({
                ...p,
                customLogoUrl: dataUrl
              }));
              notify('Projekt-Logo aktualisiert.');
            }}
            onResetProjectLogo={(projId) => {
              updateProject(projId, (p) => ({ ...p, customLogoUrl: '/raccoon-logo.png' }));
              notify('Standard-Logo gesetzt.');
            }}
            onConfirmRedDot={(projId, section, itemId) => {
              const ts = formatNow();
              updateProject(projId, (p) => ({
                ...p,
                [section]: (p[section] as any[]).map((it) =>
                  it.id === itemId
                    ? { ...it, aiTouched: false, lastModified: ts, changeReason: 'Bestätigt' }
                    : it
                )
              }));
            }}
            onAddTask={(projId, title, prio = 'Mittel', mins = 25) => {
              const ts = formatNow();
              updateProject(projId, (p) => ({
                ...p,
                tasks: [
                  {
                    id: `t-${Date.now()}`,
                    title,
                    completed: false,
                    priority: prio,
                    estimatedMinutes: mins,
                    dayBlock: null,
                    reminderAt: '',
                    aiTouched: false,
                    lastModified: ts,
                    changeReason: 'Manuell angelegt',
                    source: 'Manuell',
                    customMeta: {}
                  },
                  ...p.tasks
                ]
              }));
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
            onDeleteTask={(projId, taskId) =>
              updateProject(projId, (p) => ({
                ...p,
                tasks: p.tasks.filter((t) => t.id !== taskId)
              }))
            }
            onResetChecklistForDeployment={(projId) => {
              const ts = formatNow();
              updateProject(projId, (p) => ({
                ...p,
                tasks: p.tasks.map((t) => ({ ...t, completed: false, lastModified: ts }))
              }));
              notify('Checkliste zurückgesetzt.');
            }}
            onAddExplanation={(projId, title, stepsText) => {
              const ts = formatNow();
              updateProject(projId, (p) => ({
                ...p,
                explanations: [
                  {
                    id: `e-${Date.now()}`,
                    title,
                    stepsText,
                    lastModified: ts,
                    changeReason: 'Manuell erstellt',
                    source: 'Manuell',
                    aiTouched: false,
                    customMeta: {}
                  },
                  ...p.explanations
                ]
              }));
            }}
            onUpdateExplanation={(projId, expId, title, stepsText) => {
              const ts = formatNow();
              updateProject(projId, (p) => ({
                ...p,
                explanations: p.explanations.map((e) =>
                  e.id === expId
                    ? { ...e, title, stepsText, lastModified: ts, changeReason: 'Bearbeitet' }
                    : e
                )
              }));
            }}
            onAddInfo={(projId, title, content) => {
              const ts = formatNow();
              updateProject(projId, (p) => ({
                ...p,
                infos: [
                  {
                    id: `i-${Date.now()}`,
                    title,
                    content,
                    attachments: [],
                    lastModified: ts,
                    changeReason: 'Manuell erstellt',
                    source: 'Manuell',
                    aiTouched: false,
                    customMeta: {}
                  },
                  ...p.infos
                ]
              }));
            }}
            onUploadInfoAttachment={async (projId, infoId, file) => {
              const isImage = file.type.startsWith('image/');
              const isPdf =
                file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
              const isText =
                file.type.startsWith('text/') || /\.(txt|md|json|csv)$/i.test(file.name);

              if (isImage) {
                const { dataUrl, sizeKB } = await compressImageFile(file);
                const newAtt: Attachment = {
                  id: `att-${Date.now()}`,
                  name: file.name,
                  type: 'image',
                  mimeType: 'image/jpeg',
                  size: sizeKB,
                  dataUrl,
                  textContent: null
                };
                updateProject(projId, (p) => ({
                  ...p,
                  infos: p.infos.map((inf) =>
                    inf.id === infoId
                      ? {
                          ...inf,
                          attachments: [...inf.attachments, newAtt],
                          lastModified: formatNow(),
                          changeReason: `Foto ${file.name} komprimiert gespeichert`
                        }
                      : inf
                  )
                }));
                notify(`Foto "${file.name}" (${sizeKB}) gespeichert.`);
                return;
              }

              const sizeKB = `${Math.max(1, Math.round(file.size / 1024))} KB`;
              const reader = new FileReader();
              reader.onload = (ev) => {
                const res = ev.target?.result;
                const newAtt: Attachment = {
                  id: `att-${Date.now()}`,
                  name: file.name,
                  type: isPdf ? 'pdf' : 'text',
                  mimeType: file.type || 'application/octet-stream',
                  size: sizeKB,
                  dataUrl: isPdf ? String(res) : null,
                  textContent: isText ? String(res) : null
                };
                updateProject(projId, (p) => ({
                  ...p,
                  infos: p.infos.map((inf) =>
                    inf.id === infoId
                      ? {
                          ...inf,
                          attachments: [...inf.attachments, newAtt],
                          lastModified: formatNow(),
                          changeReason: `Anhang ${file.name}`
                        }
                      : inf
                  )
                }));
                notify(`Datei "${file.name}" gespeichert.`);
              };
              if (isText && !isPdf) reader.readAsText(file);
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
                    changeReason: it.reason || 'Hinzugefügt',
                    source: 'Manuell' as const,
                    procurementCheck: buildProcurementCheck(it.title),
                    customMeta: {}
                  })),
                  ...p.cart
                ]
              }));
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
            onUpdateProjectMeta={(projId, patch) =>
              updateProject(projId, (p) => ({
                ...p,
                customMeta: { ...p.customMeta, ...patch }
              }))
            }
            onRecordEventSale={(entry) =>
              setState((prev) => ({
                ...prev,
                eventSalesLogs: [entry, ...prev.eventSalesLogs]
              }))
            }
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
            onJumpToAction={handleJumpToAction}
            onUndoAiAction={handleUndoAiAction}
            onMoveAiAction={handleMoveAiAction}
            onToggleArchiveProject={(projId) => {
              const ts = formatNow();
              updateProject(projId, (p) => ({
                ...p,
                archived: !p.archived,
                archivedAt: !p.archived ? ts : undefined
              }));
              notify('Archiv-Status aktualisiert.');
            }}
            onAssignDayBlock={(projId, taskId, block) =>
              updateProject(projId, (p) => ({
                ...p,
                tasks: p.tasks.map((t) => (t.id === taskId ? { ...t, dayBlock: block } : t))
              }))
            }
            onAutoStructureDay={() => {
              setState((prev) => ({
                ...prev,
                projects: prev.projects.map((p) =>
                  p.archived
                    ? p
                    : {
                        ...p,
                        tasks: p.tasks.map((t, i) => {
                          if (t.completed || t.dayBlock) return t;
                          const blocks: Array<'morning' | 'focus' | 'errands' | 'evening'> = [
                            'morning',
                            'focus',
                            'errands',
                            'evening'
                          ];
                          return {
                            ...t,
                            dayBlock: t.priority === 'Hoch' ? 'focus' : blocks[i % blocks.length]
                          };
                        })
                      }
                )
              }));
              notify('Aufgaben auf Tagesblöcke verteilt.');
            }}
            onTogglePluginForProject={(projId, pluginId) =>
              updateProject(projId, (p) => ({
                ...p,
                enabledPlugins: (p.enabledPlugins || []).includes(pluginId)
                  ? (p.enabledPlugins || []).filter((id) => id !== pluginId)
                  : [...(p.enabledPlugins || []), pluginId]
              }))
            }
            onSaveScratchpadToProject={(projId, title, content) => {
              updateProject(projId, (p) => ({
                ...p,
                infos: [
                  {
                    id: `i-calc-${Date.now()}`,
                    title,
                    content,
                    attachments: [],
                    lastModified: formatNow(),
                    changeReason: 'Aus Vorlage/Notiz gespeichert',
                    source: 'Manuell',
                    aiTouched: false,
                    customMeta: {}
                  },
                  ...p.infos
                ]
              }));
            }}
            onChangeApiKey={(key) => setState((prev) => ({ ...prev, userApiKey: key }))}
            onToggleRealityCheck={() =>
              setState((prev) => ({ ...prev, realityCheckEnabled: !prev.realityCheckEnabled }))
            }
            onChangeHaWebhook={(url) => setState((prev) => ({ ...prev, haWebhookUrl: url }))}
            onOpenFlip7Cover={() => toggleCoverMode(true)}
            onOpenRealityModal={() => setRealityModalOpen(true)}
            onOpenSelfCheckModal={() => setSelfCheckModalOpen(true)}
            onResetProjectStructure={() => {
              setState((prev) => ({
                ...INITIAL_APP_SNAPSHOT,
                userApiKey: prev.userApiKey,
                aiLogs: prev.aiLogs,
                selfChecks: prev.selfChecks,
                eventSalesLogs: prev.eventSalesLogs
              }));
              notify('Projektstruktur aktualisiert.');
            }}
            onExportFullBackup={() => downloadStateBackupJson(state)}
            onImportFullBackup={(snap) => {
              setState(snap);
              notify('Backup geladen.');
            }}
            onNotify={notify}
          />
        )}
      </main>

      {/* UNTERE BANDIT.OS KI-KONTEXT-LEISTE */}
      <div className="fixed bottom-3 inset-x-0 z-40 pointer-events-none">
        <div className="max-w-md mx-auto px-3">
          <div
            className="pointer-events-auto rounded-3xl border border-white/10 p-2 shadow-2xl flex items-center gap-2"
            style={{ backgroundColor: '#1C2026' }}
          >
            <button
              type="button"
              onClick={() => {
                setAutoStartMicOnOpen(false);
                setVoiceModalOpen(true);
              }}
              className="flex-1 min-h-[48px] px-4 py-2.5 rounded-2xl bg-[#242930] hover:bg-[#2A3038] text-left text-xs font-medium text-[#9CA3AF] hover:text-white border border-white/5 flex items-center gap-2.5 truncate active:scale-[0.99] transition"
            >
              <MessageSquare
                className="w-4 h-4 shrink-0"
                style={{ color: activeVisualTheme.highlight }}
              />
              <span className="truncate">BANDIT.OS KI-Kontext &amp; Verlauf...</span>
            </button>

            <button
              type="button"
              onClick={() => setDeepResearchModalOpen(true)}
              aria-label="Deep Research &amp; Cloud"
              title="Deep Research, Scanner &amp; Cloud"
              className="w-12 h-12 rounded-2xl bg-[#242930] hover:bg-[#2A3038] text-[#14B8A6] hover:text-white border border-white/5 flex items-center justify-center shrink-0 active:scale-95 transition"
            >
              <Scale className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                setAutoStartMicOnOpen(true);
                setVoiceModalOpen(true);
              }}
              aria-label="Sofort sprechen"
              className="min-h-[48px] px-5 py-2.5 rounded-2xl text-white font-bold text-xs flex items-center gap-2 shrink-0 active:scale-95 transition shadow-lg"
              style={{
                backgroundColor: activeVisualTheme.primary,
                boxShadow: `0 6px 20px ${activeVisualTheme.glow}`
              }}
            >
              <Mic className="w-4 h-4" />
              <span>Sprechen</span>
            </button>
          </div>
        </div>
      </div>

      {/* KI-KONTEXT-SCHUBLADE */}
      <VoiceModal
        open={voiceModalOpen}
        autoStartMic={autoStartMicOnOpen}
        activeProjectName={activeProject?.name || 'Pizza Bandit'}
        projects={state.projects}
        aiLogs={state.aiLogs}
        onClose={() => setVoiceModalOpen(false)}
        onExecuteCommand={handleDistributeVoiceCommand}
        onAskQuestion={(q, att) =>
          askQuickAssistantQuestion(
            q,
            activeProject?.name || 'Pizza Bandit',
            state.userApiKey,
            att
          )
        }
        onSaveAnswerToInfos={(q, ans, att) => {
          if (!activeProject) return;
          updateProject(activeProject.id, (p) => ({
            ...p,
            infos: [
              {
                id: `i-qa-${Date.now()}`,
                title: enforceMaxSixWords(q, 'KI-Notiz'),
                content: ans,
                attachments: att ? [att] : [],
                lastModified: formatNow(),
                changeReason: 'Aus KI-Verlauf gespeichert',
                source: 'KI-Zuordnung',
                aiTouched: true,
                customMeta: {}
              },
              ...p.infos
            ]
          }));
          notify('In Projekt-Infos gespeichert.');
        }}
        onJumpToAction={handleJumpToAction}
        onUndoAiAction={handleUndoAiAction}
        onMoveAiAction={handleMoveAiAction}
      />

      <DeepResearchAndAuditModal
        open={deepResearchModalOpen}
        projects={state.projects}
        activeProject={activeProject}
        userApiKey={state.userApiKey}
        fullState={state}
        onClose={() => setDeepResearchModalOpen(false)}
        onSaveDossierToProject={(projectId, title, markdownContent, followUpTasks) => {
          updateProject(projectId, (p) => {
            const newInfo = {
              id: `info-dossier-${Date.now()}`,
              title: enforceMaxSixWords(title, 'Rechts-Dossier'),
              content: markdownContent,
              attachments: [],
              lastModified: formatNow(),
              changeReason: 'Deep Research Beleg',
              source: 'KI-Recherche',
              aiTouched: true,
              customMeta: {}
            };
            const newTasks = (followUpTasks || []).map((tText, idx) => ({
              id: `task-dossier-${Date.now()}-${idx}`,
              title: enforceMaxSixWords(tText, 'Recherche To-do'),
              completed: false,
              priority: 'high' as PriorityType,
              estimatedMinutes: 30,
              dayBlock: null,
              reminderAt: '',
              aiTouched: true,
              lastModified: formatNow(),
              changeReason: 'Aus Deep Research abgeleitet',
              source: 'Deep Research',
              assemblyGroup: '',
              customMeta: {}
            }));
            return {
              ...p,
              infos: [newInfo, ...p.infos],
              tasks: [...newTasks, ...p.tasks]
            };
          });
          notify('Rechts-Dossier & To-dos im Projekt gespeichert.');
        }}
        onReconcileReceiptWithCart={(projectId, storeName, purchaseDate, totalAmount, items) => {
          updateProject(projectId, (p) => {
            let updatedCart = [...p.cart];
            const unmatchedItems: Array<{ title: string; quantity: string; price: string }> = [];

            for (const item of items) {
              const itemTitleLower = item.title.toLowerCase();
              const foundIdx = updatedCart.findIndex(
                (c) =>
                  !c.completed &&
                  (c.title.toLowerCase().includes(itemTitleLower) ||
                    itemTitleLower.includes(c.title.toLowerCase()))
              );
              if (foundIdx !== -1) {
                updatedCart[foundIdx] = {
                  ...updatedCart[foundIdx],
                  completed: true,
                  price: item.price ? `${item.price} €` : updatedCart[foundIdx].price,
                  lastModified: formatNow(),
                  changeReason: `Kassenbon ${storeName} (${purchaseDate})`
                };
              } else {
                unmatchedItems.push(item);
              }
            }

            const newCartItems = unmatchedItems.map((item, idx) => ({
              id: `cart-receipt-${Date.now()}-${idx}`,
              title: enforceMaxSixWords(item.title, 'Beleg-Artikel'),
              quantity: item.quantity || '1x',
              price: item.price ? `${item.price} €` : '',
              completed: true,
              lastModified: formatNow(),
              changeReason: `Aus Kassenbon ${storeName}`,
              source: 'Beleg-Scanner',
              aiTouched: true,
              customMeta: {}
            }));

            const receiptInfo = {
              id: `info-receipt-${Date.now()}`,
              title: enforceMaxSixWords(`Beleg ${storeName} ${totalAmount} €`, 'Kassenbon'),
              content: `Kassenbon / Rechnung von ${storeName}\nDatum: ${purchaseDate}\nGesamtbetrag: ${totalAmount} €\n\nErfasste Positionen:\n${items
                .map((it) => `- ${it.quantity} ${it.title}: ${it.price} €`)
                .join('\n')}`,
              attachments: [],
              lastModified: formatNow(),
              changeReason: 'Kassenbon gescannt & abgeglichen',
              source: 'Beleg-Scanner',
              aiTouched: true,
              customMeta: { totalAmount, storeName, purchaseDate }
            };

            return {
              ...p,
              cart: [...newCartItems, ...updatedCart],
              infos: [receiptInfo, ...p.infos]
            };
          });
          notify(`Kassenbon (${totalAmount} €) verbucht & Einkaufswagen abgeglichen!`);
        }}
        onReplaceFullStateFromCloud={(newState) => {
          setState(newState);
          notify('Datenstand aus der Cloud übernommen.');
        }}
        onNotify={notify}
      />

      <RealityCheckModal open={realityModalOpen} onClose={() => setRealityModalOpen(false)} />

      <SelfCheckModal
        open={selfCheckModalOpen}
        onClose={() => setSelfCheckModalOpen(false)}
        onSave={(entry) => {
          setState((prev) => ({ ...prev, selfChecks: [entry, ...prev.selfChecks] }));
          notify('Selbst-Check gespeichert.');
        }}
      />

      {newProjectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className="max-w-sm w-full rounded-2xl border border-white/15 p-5 space-y-3"
            style={{ backgroundColor: THEME.bgCard }}
          >
            <h3 className="text-sm font-bold text-white">Neues Projekt ({activeDomain})</h3>
            <input
              type="text"
              value={newProjName}
              onChange={(e) => setNewProjName(e.target.value)}
              placeholder="Projektname..."
              className="w-full px-3 py-2 rounded-lg text-xs bg-[#181A1B] text-white border border-white/10"
            />
            <input
              type="text"
              value={newProjSubtitle}
              onChange={(e) => setNewProjSubtitle(e.target.value)}
              placeholder="Kurzbeschreibung..."
              className="w-full px-3 py-2 rounded-lg text-xs bg-[#181A1B] text-white border border-white/10"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setNewProjectModalOpen(false)}
                className="px-3 py-1.5 text-xs text-[#9CA3AF]"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!newProjName.trim()) return;
                  const id = `proj-${Date.now()}`;
                  setState((prev) => ({
                    ...prev,
                    projects: [
                      ...prev.projects,
                      {
                        id,
                        domain: activeDomain,
                        name: newProjName.trim(),
                        subtitle: newProjSubtitle.trim() || 'Eigenes Projekt',
                        icon: 'FolderKanban',
                        customLogoUrl: null,
                        accentColor: activeVisualTheme.primary,
                        archived: false,
                        customMeta: {},
                        enabledPlugins: [],
                        tasks: [],
                        explanations: [],
                        infos: [],
                        cart: []
                      }
                    ]
                  }));
                  setSelectedProjectId(id);
                  setNewProjName('');
                  setNewProjSubtitle('');
                  setNewProjectModalOpen(false);
                  notify('Projekt angelegt.');
                }}
                className="px-4 py-1.5 rounded-lg text-xs font-bold text-white"
                style={{ backgroundColor: activeVisualTheme.primary }}
              >
                Anlegen
              </button>
            </div>
          </div>
        </div>
      )}

      {previewAttachment && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className="max-w-2xl w-full rounded-2xl border border-white/15 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            style={{ backgroundColor: THEME.bgCard }}
          >
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <span className="text-xs font-bold text-white truncate">
                {previewAttachment.name} ({previewAttachment.size})
              </span>
              <button
                type="button"
                onClick={() => setPreviewAttachment(null)}
                className="p-1 text-[#9CA3AF] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {previewAttachment.type === 'image' && (
              <div className="px-4 py-2 border-b border-white/10 bg-[#181A1B] flex items-center gap-2">
                <input
                  type="text"
                  value={newPinLabel}
                  onChange={(e) => setNewPinLabel(e.target.value)}
                  placeholder="Maß-Label (z.B. 'Breite: 85cm')... dann Foto anklicken"
                  className="flex-1 px-3 py-1.5 rounded-lg text-xs bg-[#24292E] text-white border border-white/10 placeholder-[#9CA3AF]"
                />
                <span className="text-[10px] text-[#9CA3AF] shrink-0">Klick = Pin setzen</span>
              </div>
            )}

            <div className="p-4 overflow-y-auto flex-1">
              {previewAttachment.type === 'image' && previewAttachment.dataUrl && (
                <div
                  className="relative inline-block mx-auto cursor-crosshair select-none"
                  onClick={handleImageClickForMeasurePin}
                >
                  <img
                    src={previewAttachment.dataUrl}
                    alt={previewAttachment.name}
                    className="max-h-[60vh] mx-auto rounded-lg block"
                  />
                  {(photoPins[previewAttachment.id] || []).map((pin) => (
                    <div
                      key={pin.id}
                      className="absolute -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 rounded-md text-[10px] font-bold text-white shadow-lg flex items-center gap-1 border border-white/30"
                      style={{
                        left: `${pin.xPercent}%`,
                        top: `${pin.yPercent}%`,
                        backgroundColor: activeVisualTheme.primary
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span>{pin.label}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const current = photoPins[previewAttachment.id] || [];
                          const next = {
                            ...photoPins,
                            [previewAttachment.id]: current.filter((p) => p.id !== pin.id)
                          };
                          setPhotoPins(next);
                          localStorage.setItem(PHOTO_PINS_STORAGE_KEY, JSON.stringify(next));
                          notify('Pin entfernt.');
                        }}
                        className="text-white/70 hover:text-white ml-0.5"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {previewAttachment.type === 'pdf' && previewAttachment.dataUrl && (
                <iframe
                  src={previewAttachment.dataUrl}
                  title={previewAttachment.name}
                  className="w-full h-[65vh] rounded-lg border border-white/10"
                />
              )}
              {previewAttachment.type === 'text' && (
                <pre className="p-3 rounded-lg bg-[#181A1B] text-xs font-mono text-white whitespace-pre-wrap">
                  {previewAttachment.textContent || 'Kein Textinhalt.'}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-white text-xs font-bold shadow-2xl flex items-center gap-2 border border-white/20 max-w-[90vw]"
          style={{ backgroundColor: activeVisualTheme.primary }}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="truncate">{toast}</span>
        </div>
      )}
    </div>
  );
}
