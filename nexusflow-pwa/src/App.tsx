import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Clock, MessageSquare, Scale, Mic, Plus, X, Send } from 'lucide-react';
import {
  AiExecutedAction,
  AiLogEntry,
  AiVoiceSettings,
  AmbientLightMode,
  AppStateSnapshot,
  Attachment,
  BanditUserPreferences,
  CartItem,
  DomainType,
  EnergyLevel,
  ForemanProposal,
  KnowledgeItem,
  KnowledgeKind,
  OfflineAudioMemo,
  Project,
  ProjectTabId,
  ReminderRecurrence,
  SubTaskItem,
  TaskItem,
  THEME,
  VoiceInteractionMode
} from './types';
import { BRAND_CONFIG } from './config/brandConfig';
import { DESIGN_TOKENS } from './config/designTokens';
import { UNDO_TOAST_MS } from './config/runtimeConfig';
import { INITIAL_APP_SNAPSHOT } from './data/pizzaBanditTsaSeed';
import {
  DEFAULT_AI_VOICE_SETTINGS,
  downloadFullBackupV2,
  formatNow,
  loadAiVoiceSettings,
  loadPersistedState,
  loadUserPrefs,
  loadUserPrefsAsync,
  saveAiVoiceSettings,
  savePersistedState,
  saveUserPrefs,
  requestStoragePersistence,
  migrateLocalStorageToIDB,
  loadIdbItem,
  saveIdbItem,
  saveThumbHubEnabled,
  saveThumbHubPosition,
  loadAmbientLightMode,
  saveAmbientLightMode,
  loadForemanProposals,
  loadForemanProposalsAsync,
  saveForemanProposals,
  loadDismissedThinkerIds,
  loadDismissedThinkerIdsAsync,
  saveDismissedThinkerIds,
  loadOfflineAudioMemos,
  loadOfflineAudioMemosAsync,
  saveOfflineAudioMemos,
  STORAGE_KEYS
} from './services/storage';
import {
  askQuickAssistantQuestion,
  buildLocalFallbackPlan,
  compressImageFile,
  enforceMaxSixWords,
  routeVoiceCommand,
  stopAllSpeech,
  StructuredAiResponse
} from './services/aiRouter';
import { buildProcurementCheck } from './plugins/procurementCheck';
import { RealityCheckModal, SelfCheckModal } from './plugins/mindfulChecks';
import { Flip7CoverView } from './core/Flip7CoverView';
import { VoiceModal } from './core/VoiceModal';
import { FrontWorkspace } from './core/FrontWorkspace';
import { HexThumbHub } from './core/front/HexThumbHub';
import { SingleFocusOverlay } from './core/front/SingleFocusOverlay';
import { FloatingCartOverlay } from './core/front/FloatingCartOverlay';
import { DeepResearchAndAuditModal } from './components/DeepResearchAndAuditModal';
import {
  computeNextRecurrenceReminder,
  DEFAULT_CLOUD_CONFIG,
  formatReminderBadge,
  loadCloudConfig,
  pushStateToCloud,
  toLocalDateTimeInputValue
} from './services/cloudSyncAndPush';
import { useReminderEngine } from './hooks/useReminderEngine';
import { rollHurdleTask } from './services/adhsDriveEngine';
import {
  inspectAndQueueCriticalTopic
} from './services/deepResearchAndScanner';
import { BackofficeWorkspace, ZentraleSectionId } from './core/BackofficeWorkspace';
import type { BlueprintTemplate } from './core/backoffice/SystemAndBackupSection';
import type { CartReconcileMatch } from './services/receiptForeman';
import type { SavedScannedReceipt } from './services/storage';

interface PhotoMeasurePin {
  id: string;
  xPercent: number;
  yPercent: number;
  label: string;
}

const PHOTO_PINS_STORAGE_KEY = STORAGE_KEYS.PHOTO_PINS;

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
  const [zentraleSection, setZentraleSection] = useState<ZentraleSectionId | null>(null);
  const [flip7CoverMode, setFlip7CoverMode] = useState<boolean>(isCoverScreenEnvironment);

  const [activeDomain, setActiveDomain] = useState<DomainType>('business');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(BRAND_CONFIG.defaultProjectId);
  const [activeProjectTab, setActiveProjectTab] = useState<ProjectTabId>('tasks');
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);

  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [companionStage, setCompanionStage] = useState<1 | 2>(1);
  const [floatingCartOpen, setFloatingCartOpen] = useState(false);
  const [quickFanOpen, setQuickFanOpen] = useState(false);
  const [deepResearchModalOpen, setDeepResearchModalOpen] = useState(false);
  const [autoStartMicOnOpen, setAutoStartMicOnOpen] = useState(true);
  const [voicePrefillText, setVoicePrefillText] = useState('');
  const urlIntakeHandledRef = useRef(false);
  const [realityModalOpen, setRealityModalOpen] = useState(false);
  const [selfCheckModalOpen, setSelfCheckModalOpen] = useState(false);
  const [newProjectModalOpen, setNewProjectModalOpen] = useState(false);
  const [newProjName, setNewProjName] = useState('');
  const [newProjSubtitle, setNewProjSubtitle] = useState('');
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [photoPins, setPhotoPins] = useState<Record<string, PhotoMeasurePin[]>>({});
  const [newPinLabel, setNewPinLabel] = useState('');
  const [bottomAiText, setBottomAiText] = useState('');
  const [singleFocusOpen, setSingleFocusOpen] = useState(false);
  const [singleFocusTaskId, setSingleFocusTaskId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [externalUndoAction, setExternalUndoAction] = useState<{
    message: string;
    undo: () => void;
  } | null>(null);
  const externalUndoTimerRef = useRef<number | null>(null);
  const [companionIsListening, setCompanionIsListening] = useState(false);
  const [companionIsProcessing, setCompanionIsProcessing] = useState(false);
  const [companionIsSpeaking, setCompanionIsSpeaking] = useState(false);
  const [prefs, setPrefs] = useState<BanditUserPreferences>(loadUserPrefs);
  const [foremanProposals, setForemanProposals] = useState<ForemanProposal[]>(loadForemanProposals);
  const [dismissedThinkerIds, setDismissedThinkerIds] = useState<string[]>(loadDismissedThinkerIds);
  const [offlineAudioMemos, setOfflineAudioMemos] = useState<OfflineAudioMemo[]>(
    loadOfflineAudioMemos
  );
  const [forceSingleViewSeq, setForceSingleViewSeq] = useState(0);
  const skipNextAutoSyncRef = useRef<boolean>(true);
  const autoSyncTimerRef = useRef<number | null>(null);

  const handleUpdatePrefs = (patch: Partial<BanditUserPreferences>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      void saveUserPrefs(next);
      return next;
    });
  };

  const aiVoiceSettings: AiVoiceSettings = state.aiVoiceSettings || DEFAULT_AI_VOICE_SETTINGS;
  const aiVoiceSettingsRef = useRef<AiVoiceSettings>(aiVoiceSettings);
  aiVoiceSettingsRef.current = aiVoiceSettings;

  const handleUpdateAiVoiceSettings = (patch: Partial<AiVoiceSettings>) => {
    if (patch.ttsEnabled === false) {
      stopAllSpeech();
    }
    const next: AiVoiceSettings = { ...aiVoiceSettingsRef.current, ...patch };
    aiVoiceSettingsRef.current = next;
    void saveAiVoiceSettings(next);
    setState((prev) => ({
      ...prev,
      aiVoiceSettings: { ...(prev.aiVoiceSettings || DEFAULT_AI_VOICE_SETTINGS), ...patch }
    }));
  };

  const handleOpenVoice = (stage?: 1 | 2, autoStart = true) => {
    const resolvedStage: 1 | 2 = stage ?? (prefs.companionStartExpanded ? 2 : 1);
    setCompanionStage(resolvedStage);
    setAutoStartMicOnOpen(autoStart);
    setVoiceModalOpen(true);
  };

  const handleExportFullBackup = () => {
    downloadFullBackupV2(state).catch(console.warn);
  };

  const handleToggleThumbHub = (enabled: boolean) => {
    setState((prev) => ({ ...prev, thumbHubEnabled: enabled }));
    saveThumbHubEnabled(enabled);
    notify(enabled ? 'Sechskant-Daumenmodul aktiviert.' : 'Klassische untere Leiste aktiviert.');
  };

  const handleChangeThumbHubPosition = (pos: 'left' | 'center' | 'right') => {
    setState((prev) => ({ ...prev, thumbHubPosition: pos }));
    saveThumbHubPosition(pos);
    notify(`Parkplatz auf ${pos === 'left' ? 'Links' : pos === 'right' ? 'Rechts' : 'Mitte'} gesetzt.`);
  };

  const handleChangeAmbientLightMode = (mode: AmbientLightMode) => {
    setState((prev) => ({ ...prev, ambientLightMode: mode }));
    saveAmbientLightMode(mode);
    notify(
      mode === 'off'
        ? 'Hintergrundbeleuchtung deaktiviert.'
        : mode === 'static'
          ? 'Statische Hintergrundbeleuchtung aktiviert.'
          : 'Sanftes Schimmern aktiviert.'
    );
  };

  const notify = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  };

  const registerExternalUndo = (action: { message: string; undo: () => void }) => {
    if (externalUndoTimerRef.current !== null) {
      window.clearTimeout(externalUndoTimerRef.current);
    }
    setExternalUndoAction(action);
    externalUndoTimerRef.current = window.setTimeout(() => {
      setExternalUndoAction(null);
      externalUndoTimerRef.current = null;
    }, UNDO_TOAST_MS);
  };

  const handleMarkReminderFired = (
    projId: string,
    taskId: string,
    firedIso: string,
    shoulderTapStage?: number
  ) => {
    setState((prev) => ({
      ...prev,
      projects: prev.projects.map((p) =>
        p.id !== projId
          ? p
          : {
              ...p,
              tasks: p.tasks.map((t) =>
                t.id === taskId
                  ? {
                      ...t,
                      lastReminderFiredAt: firedIso,
                      ...(typeof shoulderTapStage === 'number'
                        ? { lastShoulderTapStage: shoulderTapStage }
                        : {})
                    }
                  : t
              )
            }
      )
    }));
  };

  const { activeReminder, dismissActiveReminder } = useReminderEngine({
    projects: state.projects,
    enabled: state.remindersEnabled !== false,
    systemPushEnabled: prefs.reminderSystemPushEnabled !== false,
    shoulderTapEnabled: prefs.shoulderTapEnabled === true,
    shoulderTapQuietStart: prefs.shoulderTapQuietStart || '22:00',
    shoulderTapQuietEnd: prefs.shoulderTapQuietEnd || '08:00',
    shoulderTapTone: prefs.shoulderTapTone || 'calm',
    hydrated,
    onMarkReminderFired: handleMarkReminderFired
  });

  useEffect(() => {
    document.documentElement.dataset.density = prefs.uiDensity || 'standard';
  }, [prefs.uiDensity]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    const originalVibrate = navigator.vibrate.bind(navigator);
    try {
      navigator.vibrate = ((pattern: VibratePattern) => {
        if (loadUserPrefs().hapticsEnabled === false) {
          return false;
        }
        return originalVibrate(pattern);
      }) as typeof navigator.vibrate;
    } catch {
      return;
    }
    return () => {
      try {
        navigator.vibrate = originalVibrate;
      } catch {
        // ignore
      }
    };
  }, []);

  useEffect(() => {
    const onResize = () => {
      // Only auto-update cover mode when ?mode=cover is NOT explicitly set in the URL.
      const urlForcedCover =
        new URLSearchParams(window.location.search).get('mode') === 'cover';
      if (urlForcedCover) {
        setFlip7CoverMode(true);
        return;
      }
      if (prefs.flipCoverAutoDetect === false) {
        return;
      }
      setFlip7CoverMode(isCoverScreenEnvironment());
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [prefs.flipCoverAutoDetect]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 1. Silent IDB migration & request storage persistence BEFORE loading settings
      requestStoragePersistence();
      await migrateLocalStorageToIDB();
      const [pins, loadedPrefs, loadedProposals, loadedDismissedIds, loadedAudioMemos] =
        await Promise.all([
          loadIdbItem<Record<string, PhotoMeasurePin[]>>(STORAGE_KEYS.PHOTO_PINS, {}),
          loadUserPrefsAsync(),
          loadForemanProposalsAsync(),
          loadDismissedThinkerIdsAsync(),
          loadOfflineAudioMemosAsync(),
          loadIdbItem(STORAGE_KEYS.CLOUD_SYNC, DEFAULT_CLOUD_CONFIG),
          loadIdbItem(STORAGE_KEYS.AUDIT_SETTINGS, { weeklyAutoAuditEnabled: true, lastRunIso: null }),
          loadIdbItem(STORAGE_KEYS.BLUEPRINTS, [])
        ]);
      if (!cancelled && pins && Object.keys(pins).length > 0) {
        setPhotoPins(pins);
      }
      if (!cancelled) {
        setPrefs(loadedPrefs);
        setForemanProposals(loadedProposals);
        setDismissedThinkerIds(loadedDismissedIds);
        setOfflineAudioMemos(loadedAudioMemos);
      }

      // 2. Load persisted app state & unified AI/Voice settings
      const loaded = await loadPersistedState(INITIAL_APP_SNAPSHOT);
      const [savedAmbientMode, loadedAiVoiceSettings] = await Promise.all([
        loadAmbientLightMode(),
        loadAiVoiceSettings(loaded)
      ]);
      if (cancelled) return;

      const normalizedProjects = (loaded.projects || INITIAL_APP_SNAPSHOT.projects).map((p) => {
        const brandProj = (BRAND_CONFIG.projects as Record<string, any>)[p.id];
        return {
          ...p,
          name: brandProj?.name || p.name,
          subtitle: p.subtitle || brandProj?.subtitle,
          accentColor: p.accentColor || brandProj?.accentColor,
          customLogoUrl: p.customLogoUrl || (p.id === BRAND_CONFIG.defaultProjectId ? './raccoon-logo.png' : null),
          enabledPlugins: Array.isArray(p.enabledPlugins) ? p.enabledPlugins : [],
          enabledTabs: (Array.isArray(p.enabledTabs) && p.enabledTabs.length > 0
            ? (p.enabledTabs as ('tasks' | 'cart' | 'knowledge' | 'extras')[])
            : ['tasks', 'cart', 'knowledge', 'extras']) as ('tasks' | 'cart' | 'knowledge' | 'extras')[],
          knowledge: Array.isArray(p.knowledge) ? p.knowledge : []
        };
      });

      aiVoiceSettingsRef.current = loadedAiVoiceSettings;
      skipNextAutoSyncRef.current = true;
      setState({
        ...INITIAL_APP_SNAPSHOT,
        ...loaded,
        schemaVersion: 2,
        ambientLightMode: savedAmbientMode || (loaded as any).ambientLightMode || 'shimmer',
        thumbHubEnabled: typeof (loaded as any).thumbHubEnabled === 'boolean' ? (loaded as any).thumbHubEnabled : true,
        thumbHubPosition: (loaded as any).thumbHubPosition || 'center',
        aiVoiceSettings: loadedAiVoiceSettings,
        projects: normalizedProjects,
        eventSalesLogs: Array.isArray(loaded.eventSalesLogs) ? loaded.eventSalesLogs : [],
        aiLogs: Array.isArray(loaded.aiLogs) ? loaded.aiLogs : [],
        selfChecks: Array.isArray(loaded.selfChecks) ? loaded.selfChecks : []
      });
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onProposalsUpdated = (ev: Event) => {
      const detail = (ev as CustomEvent)?.detail;
      if (Array.isArray(detail)) {
        setForemanProposals(detail);
      }
    };
    const onDismissedUpdated = (ev: Event) => {
      const detail = (ev as CustomEvent)?.detail;
      if (Array.isArray(detail)) {
        setDismissedThinkerIds(detail);
      }
    };
    const onOfflineAudioUpdated = (ev: Event) => {
      const detail = (ev as CustomEvent)?.detail;
      if (Array.isArray(detail)) {
        setOfflineAudioMemos(detail);
      }
    };
    window.addEventListener('banditos:foreman-proposals-updated', onProposalsUpdated);
    window.addEventListener('banditos:dismissed-thinker-updated', onDismissedUpdated);
    window.addEventListener('banditos:offline-audio-memos-updated', onOfflineAudioUpdated);
    return () => {
      window.removeEventListener('banditos:foreman-proposals-updated', onProposalsUpdated);
      window.removeEventListener('banditos:dismissed-thinker-updated', onDismissedUpdated);
      window.removeEventListener('banditos:offline-audio-memos-updated', onOfflineAudioUpdated);
    };
  }, []);

  useEffect(() => {
    if (!hydrated || urlIntakeHandledRef.current) return;
    urlIntakeHandledRef.current = true;
    if (typeof window === 'undefined') return;

    try {
      const url = new URL(window.location.href);
      const params = url.searchParams;
      const hasActionParam = params.has('action');
      const hasShareParam =
        params.has('share_title') || params.has('share_text') || params.has('share_url');

      if (!hasActionParam && !hasShareParam) return;

      const shareTitle = params.get('share_title')?.trim() || '';
      const shareText = params.get('share_text')?.trim() || '';
      const shareUrl = params.get('share_url')?.trim() || '';
      const rawShareParts = [shareTitle, shareText, shareUrl].filter(Boolean);
      const dedupedShareParts: string[] = [];
      for (const part of rawShareParts) {
        if (!dedupedShareParts.some((existing) => existing.includes(part))) {
          dedupedShareParts.push(part);
        }
      }
      const combinedShareText = dedupedShareParts.join(' · ').trim();
      const actionParam = params.get('action')?.trim().toLowerCase() || '';

      if (combinedShareText) {
        if (prefs.shareTargetEnabled !== false) {
          setIsBackoffice(false);
          setVoicePrefillText(combinedShareText);
          handleOpenVoice(1, false);
        }
      } else if (actionParam) {
        if (prefs.appShortcutsEnabled !== false) {
          if (actionParam === 'voice') {
            setIsBackoffice(false);
            handleOpenVoice(prefs.companionStartExpanded ? 2 : 1, true);
          } else if (actionParam === 'receipt') {
            setIsBackoffice(false);
            setFloatingCartOpen(false);
            setActiveProjectTab('receipt');
            setForceSingleViewSeq((s) => s + 1);
          } else if (actionParam === 'cart') {
            setIsBackoffice(false);
            if (prefs.cartOpenMode === 'tab') {
              setFloatingCartOpen(false);
              setActiveProjectTab('cart');
              setForceSingleViewSeq((s) => s + 1);
            } else {
              setFloatingCartOpen(true);
            }
          }
        }
      }

      params.delete('action');
      params.delete('share_title');
      params.delete('share_text');
      params.delete('share_url');
      const cleanUrl = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState({}, '', cleanUrl);
    } catch {
      // ignore invalid URL state
    }
  }, [hydrated, prefs]);

  useEffect(() => {
    if (!hydrated) return;
    savePersistedState(state);

    if (skipNextAutoSyncRef.current) {
      skipNextAutoSyncRef.current = false;
      return;
    }

    const cloudCfg = loadCloudConfig();
    if (!cloudCfg.enabled || !cloudCfg.autoSyncOnChange || !cloudCfg.endpointUrl.trim()) {
      return;
    }

    if (autoSyncTimerRef.current !== null) {
      window.clearTimeout(autoSyncTimerRef.current);
    }

    const snapshotToPush = state;
    autoSyncTimerRef.current = window.setTimeout(() => {
      autoSyncTimerRef.current = null;
      void pushStateToCloud(snapshotToPush).catch(() => {
        // Ruhige, stille Fehlerbehandlung im Offline-Betrieb
      });
    }, 5000);

    return () => {
      if (autoSyncTimerRef.current !== null) {
        window.clearTimeout(autoSyncTimerRef.current);
        autoSyncTimerRef.current = null;
      }
    };
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

  const isPrivateDomain = (d?: DomainType) => d === 'private';

  const domainProjects = useMemo(
    () => state.projects.filter((p) => !p.archived && isPrivateDomain(p.domain) === isPrivateDomain(activeDomain)),
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
    if (isPrivateDomain(activeDomain)) {
      return {
        primary: BRAND_CONFIG.domainColors.private.primary,
        highlight: '#818CF8',
        glow: 'rgba(79, 70, 229, 0.35)'
      };
    }
    const brandProj = activeProject ? (BRAND_CONFIG.projects as Record<string, any>)[activeProject.id] : null;
    if (brandProj?.accentColor) {
      return {
        primary: brandProj.accentColor,
        highlight: brandProj.accentColor === '#D97706' ? '#F59E0B' : '#14B8A6',
        glow: brandProj.accentColor === '#D97706' ? 'rgba(217, 119, 6, 0.35)' : 'rgba(10, 147, 150, 0.4)'
      };
    }
    return {
      primary: BRAND_CONFIG.domainColors.business.primary,
      highlight: '#14B8A6',
      glow: 'rgba(10, 147, 150, 0.4)'
    };
  }, [activeDomain, activeProject]);

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

  const handleToggleTabForProject = (projId: string, tab: 'tasks' | 'cart' | 'knowledge' | 'extras') => {
    updateProject(projId, (p) => {
      const current = p.enabledTabs || ['tasks', 'cart', 'knowledge', 'extras'];
      const next = current.includes(tab)
        ? current.filter((t) => t !== tab)
        : [...current, tab];
      return {
        ...p,
        enabledTabs: next.length > 0 ? next : [tab]
      };
    });
    notify('Modul-Einstellung aktualisiert.');
  };

  const handleToggleTask = (projId: string, taskId: string) => {
    const ts = formatNow();
    updateProject(projId, (p) => ({
      ...p,
      tasks: p.tasks.map((t) =>
        t.id === taskId ? { ...t, completed: !t.completed, lastModified: ts } : t
      )
    }));
  };

  const handleAddSubTask = (projId: string, taskId: string, title: string) => {
    const clean = title.trim();
    if (!clean) return;
    const ts = formatNow();
    updateProject(projId, (p) => ({
      ...p,
      tasks: p.tasks.map((t) => {
        if (t.id !== taskId) return t;
        const existing = Array.isArray(t.subTasks) ? t.subTasks : [];
        const maxOrder = existing.reduce((max, st) => Math.max(max, st.order), -1);
        const newSub: SubTaskItem = {
          id: `st-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: clean,
          completed: false,
          order: maxOrder + 1
        };
        return {
          ...t,
          completed: false,
          subTasks: [...existing, newSub],
          lastModified: ts
        };
      })
    }));
  };

  const handleToggleSubTask = (projId: string, taskId: string, subTaskId: string) => {
    const ts = formatNow();
    updateProject(projId, (p) => ({
      ...p,
      tasks: p.tasks.map((t) => {
        if (t.id !== taskId || !Array.isArray(t.subTasks) || t.subTasks.length === 0) return t;
        const nextSubs = t.subTasks.map((st) =>
          st.id === subTaskId
            ? {
                ...st,
                completed: !st.completed,
                completedAt: !st.completed ? ts : undefined
              }
            : st
        );
        const allDone = nextSubs.length > 0 && nextSubs.every((st) => st.completed);
        return {
          ...t,
          subTasks: nextSubs,
          completed: allDone ? true : false,
          lastModified: ts
        };
      })
    }));
  };

  const handleDeleteSubTask = (projId: string, taskId: string, subTaskId: string) => {
    const ts = formatNow();
    updateProject(projId, (p) => ({
      ...p,
      tasks: p.tasks.map((t) => {
        if (t.id !== taskId || !Array.isArray(t.subTasks)) return t;
        const remaining = t.subTasks.filter((st) => st.id !== subTaskId);
        return {
          ...t,
          subTasks: remaining.length > 0 ? remaining : undefined,
          lastModified: ts
        };
      })
    }));
  };

  const handleUpdateTask = (projId: string, taskId: string, patch: Partial<TaskItem>) => {
    const ts = formatNow();
    updateProject(projId, (p) => ({
      ...p,
      tasks: p.tasks.map((t) => (t.id === taskId ? { ...t, ...patch, lastModified: ts } : t))
    }));
    notify('Aufgabe aktualisiert.');
  };

  const handleMoveTask = (fromProjId: string, toProjId: string, taskId: string) => {
    if (fromProjId === toProjId) return;
    const ts = formatNow();
    const fromProj = state.projects.find((p) => p.id === fromProjId);
    const taskToMove = fromProj?.tasks.find((t) => t.id === taskId);
    if (!taskToMove) return;

    setState((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => {
        if (p.id === fromProjId) {
          return { ...p, tasks: p.tasks.filter((t) => t.id !== taskId) };
        }
        if (p.id === toProjId) {
          return {
            ...p,
            tasks: [{ ...taskToMove, lastModified: ts, changeReason: 'Verschoben' }, ...p.tasks]
          };
        }
        return p;
      })
    }));
    notify('Aufgabe in anderes Projekt verschoben.');
  };

  const handleUpdateCartItem = (projId: string, cartId: string, patch: Partial<CartItem>) => {
    const ts = formatNow();
    updateProject(projId, (p) => ({
      ...p,
      cart: p.cart.map((c) => (c.id === cartId ? { ...c, ...patch, lastModified: ts } : c))
    }));
    notify('Einkaufs-Artikel aktualisiert.');
  };

  const handleToggleCartItem = (projId: string, cartId: string) => {
    const ts = formatNow();
    updateProject(projId, (p) => ({
      ...p,
      cart: p.cart.map((c) =>
        c.id === cartId
          ? {
              ...c,
              completed: !c.completed,
              boughtAt: !c.completed ? new Date().toISOString() : undefined,
              lastModified: ts
            }
          : c
      )
    }));
  };

  const handleDeleteCartItem = (projId: string, cartId: string) => {
    updateProject(projId, (p) => ({
      ...p,
      cart: p.cart.filter((c) => c.id !== cartId)
    }));
  };

  const handleAddCartItems = (
    projId: string,
    items: Array<{ title: string; quantity: string; price?: string; reason?: string }>
  ) => {
    const ts = formatNow();
    updateProject(projId, (p) => ({
      ...p,
      cart: [
        ...items.map((it) => ({
          id: `cart-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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
  };

  const handleConfirmRedDot = (
    projId: string,
    section: 'tasks' | 'cart' | 'knowledge',
    itemId: string
  ) => {
    const ts = formatNow();
    updateProject(projId, (p) => ({
      ...p,
      [section]: (((p as any)[section] as any[]) || []).map((it) =>
        it.id === itemId
          ? { ...it, aiTouched: false, lastModified: ts, changeReason: 'Bestätigt' }
          : it
      )
    }));
  };

  const handleMoveCartItem = (fromProjId: string, toProjId: string, cartId: string) => {
    if (fromProjId === toProjId) return;
    const ts = formatNow();
    const fromProj = state.projects.find((p) => p.id === fromProjId);
    const itemToMove = fromProj?.cart.find((c) => c.id === cartId);
    if (!itemToMove) return;

    setState((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => {
        if (p.id === fromProjId) {
          return { ...p, cart: p.cart.filter((c) => c.id !== cartId) };
        }
        if (p.id === toProjId) {
          return {
            ...p,
            cart: [{ ...itemToMove, lastModified: ts, changeReason: 'Verschoben' }, ...p.cart]
          };
        }
        return p;
      })
    }));
    notify('Artikel in anderes Projekt verschoben.');
  };

  const handleMoveKnowledge = (fromProjId: string, toProjId: string, itemId: string) => {
    if (fromProjId === toProjId) return;
    const ts = formatNow();
    const fromProj = state.projects.find((p) => p.id === fromProjId);
    const itemToMove = fromProj?.knowledge?.find((k) => k.id === itemId);
    if (!itemToMove) return;

    setState((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => {
        if (p.id === fromProjId) {
          const nextK = (p.knowledge || []).filter((k) => k.id !== itemId);
          return {
            ...p,
            knowledge: nextK
          };
        }
        if (p.id === toProjId) {
          const nextK = [{ ...itemToMove, lastModified: ts, changeReason: 'Verschoben' }, ...(p.knowledge || [])];
          return {
            ...p,
            knowledge: nextK
          };
        }
        return p;
      })
    }));
    notify('Wissenseintrag in anderes Projekt verschoben.');
  };

  const handleCreateProject = (input: {
    name: string;
    subtitle?: string;
    domain: DomainType;
  }) => {
    const cleanName = input.name.trim();
    if (!cleanName) return;
    const id = `proj-${Date.now()}`;
    const defaultColor =
      input.domain === 'private'
        ? DESIGN_TOKENS.projectPresets.privat
        : DESIGN_TOKENS.projectPresets.pizzaBandit;
    setState((prev) => ({
      ...prev,
      projects: [
        ...prev.projects,
        {
          id,
          domain: input.domain,
          businessDomain: input.domain,
          lifecycle: 'project',
          name: cleanName,
          subtitle: input.subtitle?.trim() || 'Eigenes Projekt',
          icon: 'FolderKanban',
          customLogoUrl: null,
          accentColor: defaultColor,
          archived: false,
          overviewEnabled: true,
          legalWatchEnabled: true,
          customMeta: {},
          enabledPlugins: [],
          enabledTabs: ['tasks', 'cart', 'knowledge', 'extras'],
          tasks: [],
          knowledge: [],
          cart: []
        }
      ]
    }));
    setSelectedProjectId(id);
    notify(`Projekt "${cleanName}" angelegt.`);
  };

  const handleUpdateProject = (projId: string, patch: Partial<Project>) => {
    updateProject(projId, (p) => ({
      ...p,
      ...patch
    }));
    notify('Projektdaten gespeichert.');
  };

  const handleSaveDossierToProject = (
    projectId: string,
    title: string,
    markdownContent: string,
    followUpTasks: string[]
  ) => {
    updateProject(projectId, (p) => {
      const newK: KnowledgeItem = {
        id: `k-dossier-${Date.now()}`,
        title: enforceMaxSixWords(title, 'Rechts-Dossier'),
        kind: 'reference',
        content: markdownContent,
        attachments: [],
        lastModified: formatNow(),
        changeReason: 'Deep Research Beleg',
        source: 'KI-Recherche',
        aiTouched: true,
        customMeta: {}
      };
      const newTasks: TaskItem[] = (followUpTasks || []).map((tText, idx) => ({
        id: `task-dossier-${Date.now()}-${idx}`,
        title: enforceMaxSixWords(tText, 'Recherche To-do'),
        completed: false,
        priority: 'Hoch',
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
        knowledge: [newK, ...(p.knowledge || [])],
        tasks: [...newTasks, ...p.tasks]
      };
    });
    notify('Rechts-Dossier & To-dos im Projekt gespeichert.');
  };

  const handleReconcileReceiptWithCart = (
    projectId: string,
    storeName: string,
    purchaseDate: string,
    totalAmount: string,
    items: Array<{ title: string; quantity: string; price: string }>
  ) => {
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
            boughtAt: updatedCart[foundIdx].boughtAt || new Date().toISOString(),
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
        boughtAt: new Date().toISOString(),
        lastModified: formatNow(),
        changeReason: `Aus Kassenbon ${storeName}`,
        source: 'Beleg-Scanner',
        aiTouched: true,
        customMeta: {}
      }));

      const receiptContent = `Kassenbon / Rechnung von ${storeName}\nDatum: ${purchaseDate}\nGesamtbetrag: ${totalAmount} €\n\nErfasste Positionen:\n${items
        .map((it) => `- ${it.quantity} ${it.title}: ${it.price} €`)
        .join('\n')}`;

      const receiptK: KnowledgeItem = {
        id: `k-receipt-${Date.now()}`,
        title: enforceMaxSixWords(`Beleg ${storeName} ${totalAmount} €`, 'Kassenbon'),
        kind: 'info',
        content: receiptContent,
        attachments: [],
        lastModified: formatNow(),
        changeReason: 'Kassenbon gescannt & abgeglichen',
        source: 'Beleg-Scanner',
        aiTouched: true,
        customMeta: { totalAmount, storeName, purchaseDate }
      };

      return {
        ...p,
        knowledge: [receiptK, ...(p.knowledge || [])],
        cart: [...newCartItems, ...updatedCart]
      };
    });
    notify(`Kassenbon (${totalAmount} €) verbucht & Einkaufswagen abgeglichen!`);
  };

  const handleReconcileCartItems = (
    matches: CartReconcileMatch[],
    receipt: SavedScannedReceipt
  ) => {
    if (!matches.length) return;
    const boughtIso = new Date().toISOString();
    const ts = formatNow();
    const previousSnapshots: Array<{
      projectId: string;
      cartId: string;
      completed: boolean;
      boughtAt?: string;
      price: string;
      lastModified: string;
      changeReason: string;
    }> = [];

    for (const m of matches) {
      const proj = state.projects.find((p) => p.id === m.projectId);
      const item = proj?.cart.find((c) => c.id === m.cartItemId);
      if (item) {
        previousSnapshots.push({
          projectId: m.projectId,
          cartId: m.cartItemId,
          completed: item.completed,
          boughtAt: item.boughtAt,
          price: item.price,
          lastModified: item.lastModified,
          changeReason: item.changeReason
        });
      }
    }

    setState((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => {
        const projMatches = matches.filter((m) => m.projectId === p.id);
        if (projMatches.length === 0) return p;
        const byId = new Map(projMatches.map((m) => [m.cartItemId, m]));
        return {
          ...p,
          cart: p.cart.map((c) => {
            const m = byId.get(c.id);
            if (!m) return c;
            return {
              ...c,
              completed: true,
              boughtAt: c.boughtAt || boughtIso,
              price: m.receiptPrice ? `${m.receiptPrice} €` : c.price,
              lastModified: ts,
              changeReason: `Beleg ${receipt.storeName || 'Scan'} (${receipt.purchaseDate || ''})`
            };
          })
        };
      })
    }));

    registerExternalUndo({
      message: `${matches.length} Artikel abgehakt`,
      undo: () => {
        setState((prev) => ({
          ...prev,
          projects: prev.projects.map((p) => {
            const snaps = previousSnapshots.filter((s) => s.projectId === p.id);
            if (snaps.length === 0) return p;
            const byId = new Map(snaps.map((s) => [s.cartId, s]));
            return {
              ...p,
              cart: p.cart.map((c) => {
                const s = byId.get(c.id);
                if (!s) return c;
                return {
                  ...c,
                  completed: s.completed,
                  boughtAt: s.boughtAt,
                  price: s.price,
                  lastModified: s.lastModified,
                  changeReason: s.changeReason
                };
              })
            };
          })
        }));
        notify('Einkaufswagen-Abgleich rückgängig gemacht.');
      }
    });
    notify(`${matches.length} Artikel im Einkaufswagen abgehakt ✓`);
  };

  const handleParkForemanProposal = (proposal: ForemanProposal) => {
    setForemanProposals((prev) => {
      const next = [proposal, ...prev.filter((p) => p.id !== proposal.id)];
      void saveForemanProposals(next);
      return next;
    });
  };

  const handleSnoozeForemanProposal = (proposal: ForemanProposal) => {
    const snoozedUntil = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
    setForemanProposals((prev) => {
      const exists = prev.some((p) => p.id === proposal.id);
      const next = exists
        ? prev.map((p) =>
            p.id === proposal.id ? { ...p, status: 'snoozed' as const, snoozedUntil } : p
          )
        : [{ ...proposal, status: 'snoozed' as const, snoozedUntil }, ...prev];
      void saveForemanProposals(next);
      return next;
    });
    notify('Für 4 Stunden zurückgestellt.');
  };

  const handleDismissForemanProposal = (proposal: ForemanProposal) => {
    if (proposal.kind === 'thinker-contradiction') {
      setDismissedThinkerIds((prev) => {
        if (prev.includes(proposal.id)) return prev;
        const next = [...prev, proposal.id];
        void saveDismissedThinkerIds(next);
        return next;
      });
      setForemanProposals((prev) => {
        if (!prev.some((p) => p.id === proposal.id)) return prev;
        const next = prev.filter((p) => p.id !== proposal.id);
        void saveForemanProposals(next);
        return next;
      });
    } else {
      setForemanProposals((prev) => {
        const next = prev.map((p) =>
          p.id === proposal.id ? { ...p, status: 'dismissed' as const } : p
        );
        void saveForemanProposals(next);
        return next;
      });
    }
    notify('Vorschlag verworfen.');
  };

  const handleAcceptForemanProposal = (proposal: ForemanProposal) => {
    const ts = formatNow();
    const stamp = Date.now();
    const prevProjectsSnapshot = state.projects.map((p) => ({
      ...p,
      tasks: [...p.tasks],
      cart: [...p.cart],
      knowledge: [...(p.knowledge || [])]
    }));
    const prevProposalsSnapshot = [...foremanProposals];
    const prevDismissedSnapshot = [...dismissedThinkerIds];

    setState((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => {
        const projActions = proposal.actions.filter((a) => (a.projectId || proposal.projectId) === p.id);
        if (projActions.length === 0) return p;

        let nextTasks = [...p.tasks];
        let nextCart = [...p.cart];
        let nextKnowledge = [...(p.knowledge || [])];

        projActions.forEach((act, idx) => {
          if (act.type === 'dedupe-cart') {
            const removeSet = new Set(act.payload.removeCartItemIds || []);
            if (removeSet.size > 0) {
              nextCart = nextCart.filter((c) => !removeSet.has(c.id));
            }
          } else if (act.type === 'mark-cart-bought') {
            const targetId = act.payload.cartItemId;
            if (targetId) {
              nextCart = nextCart.map((c) =>
                c.id === targetId
                  ? {
                      ...c,
                      completed: true,
                      boughtAt: c.boughtAt || new Date().toISOString(),
                      lastModified: ts,
                      changeReason: 'Vorarbeiter-Abgleich'
                    }
                  : c
              );
            }
          } else if (act.type === 'add-task') {
            const taskTitle = (act.payload.title || proposal.title).trim();
            if (taskTitle) {
              nextTasks = [
                {
                  id: `t-foreman-${stamp}-${idx}`,
                  title: taskTitle,
                  completed: false,
                  priority: 'Mittel',
                  estimatedMinutes: 25,
                  dayBlock: null,
                  reminderAt: '',
                  aiTouched: true,
                  lastModified: ts,
                  changeReason: act.payload.notes || 'Vorarbeiter-Freigabe',
                  source: 'Vorarbeiter',
                  customMeta: {}
                },
                ...nextTasks
              ];
            }
          } else if (act.type === 'add-cart') {
            const itemTitle = (act.payload.title || proposal.title).trim();
            if (itemTitle) {
              nextCart = [
                {
                  id: `c-foreman-${stamp}-${idx}`,
                  title: itemTitle,
                  quantity: act.payload.quantity || '1x',
                  price: '',
                  completed: false,
                  aiTouched: true,
                  lastModified: ts,
                  changeReason: act.payload.notes || 'Vorarbeiter-Freigabe',
                  source: 'Vorarbeiter',
                  procurementCheck: buildProcurementCheck(itemTitle),
                  customMeta: {}
                },
                ...nextCart
              ];
            }
          } else if (act.type === 'add-knowledge') {
            const kTitle = enforceMaxSixWords(
              act.payload.title || proposal.title,
              'Vorarbeiter-Beleg'
            );
            nextKnowledge = [
              {
                id: `k-foreman-${stamp}-${idx}`,
                kind: 'reference',
                title: kTitle,
                content: act.payload.content || proposal.detail || proposal.summary,
                attachments: [],
                lastModified: ts,
                changeReason: act.payload.notes || 'Vorarbeiter-Freigabe',
                source: 'Vorarbeiter',
                aiTouched: true,
                customMeta: {}
              },
              ...nextKnowledge
            ];
          }
        });

        return {
          ...p,
          tasks: nextTasks,
          cart: nextCart,
          knowledge: nextKnowledge
        };
      })
    }));

    if (proposal.kind === 'murmur-research') {
      setForemanProposals((prev) => {
        const next = prev.map((p) =>
          p.id === proposal.id ? { ...p, status: 'accepted' as const } : p
        );
        void saveForemanProposals(next);
        return next;
      });
    } else {
      // Auch bei Prüf-Aufgabe oder direkter Annahme nicht sofort wieder einblenden
      setDismissedThinkerIds((prev) => {
        if (prev.includes(proposal.id)) return prev;
        const next = [...prev, proposal.id];
        void saveDismissedThinkerIds(next);
        return next;
      });
      setForemanProposals((prev) => {
        if (!prev.some((p) => p.id === proposal.id)) return prev;
        const next = prev.filter((p) => p.id !== proposal.id);
        void saveForemanProposals(next);
        return next;
      });
    }

    registerExternalUndo({
      message: 'Vorarbeiter-Vorschlag übernommen',
      undo: () => {
        setState((prev) => ({
          ...prev,
          projects: prevProjectsSnapshot
        }));
        setForemanProposals(prevProposalsSnapshot);
        void saveForemanProposals(prevProposalsSnapshot);
        setDismissedThinkerIds(prevDismissedSnapshot);
        void saveDismissedThinkerIds(prevDismissedSnapshot);
        notify('Freigabe rückgängig gemacht.');
      }
    });
    notify('Vorarbeiter-Vorschlag übernommen ✓');
  };

  const handleReplaceFullStateFromCloud = (newState: AppStateSnapshot) => {
    skipNextAutoSyncRef.current = true;
    setState(newState);
    notify('Datenstand aus der Cloud übernommen.');
  };

  const handleApplyBlueprint = (projectId: string, blueprint: BlueprintTemplate) => {
    const targetProj =
      state.projects.find((p) => p.id === projectId) ||
      state.projects.find((p) => !p.archived) ||
      state.projects[0];
    if (!targetProj) return;

    const ts = formatNow();
    const stamp = Date.now();
    const newTasks: TaskItem[] = (blueprint.tasks || [])
      .map((raw) => raw.trim())
      .filter(Boolean)
      .map((raw, idx) => {
        const bracketMatch = raw.match(/^\[([^\]]+)\]\s*(.+)$/);
        return {
          id: `t-bp-${stamp}-${idx}`,
          title: bracketMatch ? bracketMatch[2].trim() : raw,
          completed: false,
          priority: 'Mittel',
          estimatedMinutes: 25,
          dayBlock: null,
          reminderAt: '',
          aiTouched: false,
          lastModified: ts,
          changeReason: `Aus Vorlage: ${blueprint.name}`,
          source: 'Vorlage',
          assemblyGroup: bracketMatch ? bracketMatch[1].trim() : undefined,
          customMeta: {}
        };
      });

    const newCart: CartItem[] = (blueprint.cart || [])
      .map((raw) => raw.trim())
      .filter(Boolean)
      .map((title, idx) => ({
        id: `c-bp-${stamp}-${idx}`,
        title,
        quantity: '1x',
        price: '',
        completed: false,
        aiTouched: false,
        lastModified: ts,
        changeReason: `Aus Vorlage: ${blueprint.name}`,
        source: 'Vorlage',
        procurementCheck: buildProcurementCheck(title),
        customMeta: {}
      }));

    const infoSummaryParts: string[] = [];
    if (newTasks.length > 0) {
      infoSummaryParts.push(`Aufgaben:\n${blueprint.tasks.map((t) => `- ${t}`).join('\n')}`);
    }
    if (newCart.length > 0) {
      infoSummaryParts.push(`Einkauf:\n${blueprint.cart.map((c) => `- ${c}`).join('\n')}`);
    }

    const newInfo: KnowledgeItem = {
      id: `k-bp-${stamp}`,
      title: enforceMaxSixWords(blueprint.name, 'Vorlage'),
      kind: 'info',
      content: infoSummaryParts.join('\n\n') || blueprint.name,
      attachments: [],
      lastModified: ts,
      changeReason: 'Vorlage eingespielt',
      source: 'Vorlage',
      aiTouched: false,
      customMeta: {}
    };

    updateProject(targetProj.id, (p) => ({
      ...p,
      tasks: [...newTasks, ...p.tasks],
      cart: [...newCart, ...p.cart],
      knowledge: [newInfo, ...(p.knowledge || [])]
    }));

    notify(
      `Vorlage "${blueprint.name}" eingespielt (${newTasks.length} Aufgaben, ${newCart.length} Einkäufe).`
    );
  };

  const handleAddKnowledge = (
    projId: string,
    kind: KnowledgeKind,
    title: string,
    content: string,
    attachments: Attachment[] = []
  ) => {
    const ts = formatNow();
    updateProject(projId, (p) => {
      const newItem: KnowledgeItem = {
        id: `k-${Date.now()}`,
        title,
        kind,
        content,
        stepsText: kind === 'explanation' ? content : undefined,
        attachments: attachments || [],
        lastModified: ts,
        changeReason: 'Manuell erstellt',
        source: 'Manuell',
        aiTouched: false,
        customMeta: {}
      };
      const nextKnowledge = [newItem, ...(p.knowledge || [])];

      return {
        ...p,
        knowledge: nextKnowledge
      };
    });
    notify(kind === 'explanation' ? 'Ablauf angelegt.' : 'Wissen/Info angelegt.');
  };

  const handleUpdateKnowledge = (
    projId: string,
    itemId: string,
    title: string,
    content: string
  ) => {
    const ts = formatNow();
    updateProject(projId, (p) => {
      const nextKnowledge = (p.knowledge || []).map((k) =>
        k.id === itemId
          ? {
            ...k,
            title,
            content,
            stepsText: k.kind === 'explanation' ? content : k.stepsText,
            lastModified: ts,
            changeReason: 'Bearbeitet'
          }
          : k
      );
      return {
        ...p,
        knowledge: nextKnowledge
      };
    });
    notify('Eintrag aktualisiert.');
  };

  const handleDeleteKnowledge = (projectId: string, knowledgeId: string) => {
    updateProject(projectId, (p) => ({
      ...p,
      knowledge: (p.knowledge || []).filter((k) => k.id !== knowledgeId)
    }));
  };

  const handleRestoreKnowledge = (
    projectId: string,
    item: KnowledgeItem,
    insertIndex?: number
  ) => {
    updateProject(projectId, (p) => {
      const baseKnowledge = Array.isArray(p.knowledge) ? p.knowledge : [];
      const currentKnowledge = baseKnowledge.filter((k) => k.id !== item.id);
      const idx =
        typeof insertIndex === 'number' && insertIndex >= 0 && insertIndex <= currentKnowledge.length
          ? insertIndex
          : 0;
      const nextKnowledge = [
        ...currentKnowledge.slice(0, idx),
        item,
        ...currentKnowledge.slice(idx)
      ];
      return {
        ...p,
        knowledge: nextKnowledge
      };
    });
  };

  const handleUploadKnowledgeAttachment = async (projId: string, itemId: string, file: File) => {
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isText = file.type.startsWith('text/') || /\.(txt|md|json|csv)$/i.test(file.name);

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
        knowledge: (p.knowledge || []).map((k) =>
          k.id === itemId
            ? {
              ...k,
              attachments: [...(k.attachments || []), newAtt],
              lastModified: formatNow(),
              changeReason: `Foto ${file.name} komprimiert gespeichert`
            }
            : k
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
        knowledge: (p.knowledge || []).map((k) =>
          k.id === itemId
            ? {
              ...k,
              attachments: [...(k.attachments || []), newAtt],
              lastModified: formatNow(),
              changeReason: `Anhang ${file.name}`
            }
            : k
        )
      }));
      notify(`Datei "${file.name}" gespeichert.`);
    };
    if (isText && !isPdf) reader.readAsText(file);
    else reader.readAsDataURL(file);
  };

  const applyAiPlanToAppState = (
    rawText: string,
    plan: StructuredAiResponse,
    engine: string,
    attachment: Attachment | null,
    autoUpscaledToPro?: boolean
  ) => {
    const defaultProjId = BRAND_CONFIG.defaultProjectId;
    const timestamp = formatNow();
    const executedActions: AiExecutedAction[] = [];
    const logId = `log-${Date.now()}`;
    let firstTargetProjectId = activeProject?.id || defaultProjId;
    if (!plan.isErrorFallback) {
      inspectAndQueueCriticalTopic(
        rawText,
        firstTargetProjectId,
        activeProject?.name || BRAND_CONFIG.projects['proj-foodtruck']?.name || 'Pizza Bandit',
        state.projects
      );
    }
    let firstTab: ProjectTabId = activeProjectTab;

    if (plan.actions && plan.actions.length > 0) {
      setState((prev) => {
        const nextProjects = prev.projects.map((p) => ({
          ...p,
          tasks: [...p.tasks],
          knowledge: [...(p.knowledge || [])],
          cart: [...p.cart]
        }));

        plan.actions.forEach((act, idx) => {
          const target =
            nextProjects.find((p) => p.id === act.targetProjectId) ||
            nextProjects.find((p) => p.id === (activeProject?.id || defaultProjId)) ||
            nextProjects[0];

          if (!target) return;
          if (idx === 0) firstTargetProjectId = target.id;

          const itemId = `ai-${Date.now()}-${idx}`;
          const safeTitle = enforceMaxSixWords(act.shortCheckableTitle, 'Neuer Eintrag');
          const safeNote = enforceMaxSixWords(
            act.changeFooterNote || 'Durch KI zugeordnet',
            'Durch KI zugeordnet'
          );

          if (act.actionType === 'ADD_KNOWLEDGE') {
            if (idx === 0) firstTab = 'knowledge';
            const kKind: KnowledgeKind = (act.knowledgeKind as KnowledgeKind) || 'info';
            const kItem: KnowledgeItem = {
              id: itemId,
              title: safeTitle,
              kind: kKind,
              content: act.detailedExplanation || rawText,
              stepsText: kKind === 'explanation' ? (act.detailedExplanation || rawText) : undefined,
              attachments: attachment ? [attachment] : [],
              lastModified: timestamp,
              changeReason: safeNote,
              source: 'KI-Zuordnung',
              aiTouched: true,
              customMeta: {}
            };
            target.knowledge.unshift(kItem);
            executedActions.push({
              actionId: `act-${itemId}`,
              actionType: act.actionType,
              targetProjectId: target.id,
              targetProjectName: target.name,
              targetSubTab: 'knowledge',
              targetItemId: itemId,
              shortCheckableTitle: safeTitle,
              detailedExplanation: act.detailedExplanation,
              changeFooterNote: safeNote,
              undone: false
            } as any);
          } else if (act.actionType === 'ADD_CART_ITEM') {
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
            if (idx === 0) firstTab = 'knowledge';
            target.knowledge.unshift({
              id: itemId,
              title: safeTitle,
              kind: 'explanation',
              content: act.detailedExplanation || rawText,
              stepsText: act.detailedExplanation || rawText,
              attachments: [],
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
              targetSubTab: 'knowledge',
              targetItemId: itemId,
              shortCheckableTitle: safeTitle,
              detailedExplanation: act.detailedExplanation,
              changeFooterNote: safeNote,
              undone: false
            } as any);
          } else if (act.actionType === 'ADD_INFO') {
            if (idx === 0) firstTab = 'knowledge';
            target.knowledge.unshift({
              id: itemId,
              title: safeTitle,
              kind: 'info',
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
              targetSubTab: 'knowledge',
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
      if (targetProj && !targetProj.archived) {
        setActiveDomain(targetProj.domain);
        setSelectedProjectId(targetProj.id);
        setActiveProjectTab(firstTab);
      }
    }

    return {
      replyText: plan.directAnswer || plan.summary,
      spokenText: plan.spokenFeedback || plan.summary,
      needsClarification: Boolean(plan.needsClarification),
      detectedMode: plan.detectedMode,
      expectFollowUp: plan.expectFollowUp,
      engine,
      logId,
      actions: executedActions,
      autoUpscaledToPro,
      isErrorFallback: plan.isErrorFallback,
      errorReason: plan.errorReason
    };
  };

  const getEffectiveDefaultProjectId = () => {
    const activeProjects = state.projects.filter((p) => !p.archived);
    const defaultProjId = BRAND_CONFIG.defaultProjectId;
    return (!activeProject || activeProject.archived)
      ? (activeProjects.find((p) => p.id === defaultProjId)?.id || activeProjects[0]?.id || defaultProjId)
      : activeProject.id;
  };

  const handleDistributeVoiceCommand = async (
    rawText: string,
    attachment: Attachment | null,
    requestedMode?: 'flash' | 'research',
    chatHistory?: Array<{ role: 'user' | 'assistant'; text: string }>,
    options?: {
      signal?: AbortSignal;
      settings?: AiVoiceSettings;
      hintMode?: VoiceInteractionMode;
      previousMode?: VoiceInteractionMode | null;
      overrideAiMode?: 'flash' | 'research';
    }
  ) => {
    const activeProjects = state.projects.filter((p) => !p.archived);
    const effectiveDefaultProjId = getEffectiveDefaultProjectId();
    const baseSettings = options?.settings || aiVoiceSettingsRef.current;
    const effectiveRequestSettings: AiVoiceSettings = options?.overrideAiMode
      ? { ...baseSettings, activeAiMode: options.overrideAiMode }
      : baseSettings;
    const { plan, engine, autoUpscaledToPro, aborted } = await routeVoiceCommand(
      rawText,
      state.userApiKey,
      effectiveDefaultProjId,
      activeProjects,
      chatHistory,
      attachment,
      options?.overrideAiMode || requestedMode,
      {
        signal: options?.signal,
        settings: effectiveRequestSettings,
        hintMode: options?.hintMode,
        previousMode: options?.previousMode
      }
    );

    if (aborted || options?.signal?.aborted) {
      return;
    }

    return applyAiPlanToAppState(rawText, plan, engine, attachment, autoUpscaledToPro);
  };

  const handleExecuteOfflineFallback = (
    rawText: string,
    attachment: Attachment | null,
    reason = 'Fallback (API-Timeout)',
    hintMode?: VoiceInteractionMode,
    previousMode?: VoiceInteractionMode | null
  ) => {
    if (state.userApiKey.trim()) {
      return {
        replyText: 'Die Verbindung hat diesmal zu lange gedauert – es wurde nichts angelegt.',
        spokenText: 'Die Verbindung hat diesmal zu lange gedauert – es wurde nichts angelegt.',
        needsClarification: false,
        detectedMode: hintMode,
        expectFollowUp: false,
        engine: reason,
        actions: [],
        autoUpscaledToPro: false,
        isErrorFallback: true,
        errorReason: 'timeout' as const
      };
    }
    const activeProjects = state.projects.filter((p) => !p.archived);
    const effectiveDefaultProjId = getEffectiveDefaultProjectId();
    const plan = buildLocalFallbackPlan(rawText, effectiveDefaultProjId, activeProjects, hintMode, previousMode);
    return applyAiPlanToAppState(rawText, plan, reason, attachment, false);
  };

  const handleUndoAiAction = (logId: string, actionId: string) => {
    setState((prev) => {
      const log = prev.aiLogs.find((l) => l.id === logId);
      const act = log?.actions.find((a) => a.actionId === actionId);
      if (!act || act.undone) return prev;
      const subTab = (
        act.targetSubTab === 'explanations' || act.targetSubTab === 'infos'
          ? 'knowledge'
          : act.targetSubTab
      ) as 'tasks' | 'cart' | 'knowledge';
      return {
        ...prev,
        projects: prev.projects.map((p) =>
          p.id !== act.targetProjectId
            ? p
            : {
              ...p,
              [subTab]: ((p[subTab] as any[]) || []).filter(
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
      const subTab = (
        act.targetSubTab === 'explanations' || act.targetSubTab === 'infos'
          ? 'knowledge'
          : act.targetSubTab
      ) as 'tasks' | 'cart' | 'knowledge';
      let movedItem: any = null;
      const removed = prev.projects.map((p) => {
        if (p.id !== act.targetProjectId) return p;
        const list = (p[subTab] as any[]) || [];
        movedItem = list.find((it) => it.id === act.targetItemId);
        return {
          ...p,
          [subTab]: list.filter((it) => it.id !== act.targetItemId)
        };
      });
      const added = removed.map((p) => {
        if (p.id !== newProjId || !movedItem) return p;
        return {
          ...p,
          [subTab]: [movedItem, ...((p[subTab] as any[]) || [])]
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

  const handleBottomAiSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const val = bottomAiText.trim();
    if (!val) {
      setAutoStartMicOnOpen(false);
      setVoiceModalOpen(true);
      return;
    }
    setBottomAiText('');
    await handleDistributeVoiceCommand(val, null);
  };

  const handleJumpToAction = (act: AiExecutedAction) => {
    const targetProj = state.projects.find((p) => p.id === act.targetProjectId);
    if (!targetProj) return;
    setIsBackoffice(false);
    setActiveDomain(targetProj.domain);
    setSelectedProjectId(targetProj.id);
    setActiveProjectTab(
      act.targetSubTab === 'explanations' || act.targetSubTab === 'infos'
        ? 'knowledge'
        : act.targetSubTab
    );
    setHighlightedItemId(act.targetItemId);
    setTimeout(() => setHighlightedItemId(null), 2400);
  };

  // Vor-Ort Foto-Maßband (Direktes Anpinnen von Maßen auf Fotos)
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
    saveIdbItem(STORAGE_KEYS.PHOTO_PINS, next);
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
          wakeLockEnabled={prefs.wakeLockEnabled !== false}
          offlineAudioBufferEnabled={prefs.offlineAudioBufferEnabled !== false}
          companionMessageToolsEnabled={prefs.companionMessageToolsEnabled !== false}
          companionQuickChipsEnabled={prefs.companionQuickChipsEnabled !== false}
          activeProjectId={activeProject?.id || BRAND_CONFIG.defaultProjectId}
          userApiKey={state.userApiKey}
          offlineAudioMemos={offlineAudioMemos}
          onUpdateOfflineAudioMemos={(next) => {
            setOfflineAudioMemos(next);
            void saveOfflineAudioMemos(next);
          }}
          initialPrefillText={voicePrefillText}
          activeProjectName={activeProject?.name || BRAND_CONFIG.projects['proj-foodtruck']?.name || 'Pizza Bandit'}
          projects={state.projects}
          aiVoiceSettings={aiVoiceSettings}
          onUpdateAiVoiceSettings={handleUpdateAiVoiceSettings}
          onClose={() => {
            setVoiceModalOpen(false);
            setVoicePrefillText('');
          }}
          onExecuteCommand={handleDistributeVoiceCommand}
          onExecuteOfflineFallback={handleExecuteOfflineFallback}
          onAskQuestion={(q, att) =>
            askQuickAssistantQuestion(
              q,
              getEffectiveDefaultProjectId(),
              state.userApiKey,
              att,
              {
                allProjects: state.projects.filter((p) => !p.archived),
                settings: aiVoiceSettingsRef.current
              }
            )
          }
          onSaveAnswerToInfos={(q, ans, att) => {
            if (!activeProject) return;
            const newAtts = att ? [att] : [];
            const newK: KnowledgeItem = {
              id: `k-qa-${Date.now()}`,
              title: enforceMaxSixWords(q, 'KI-Notiz'),
              kind: 'info',
              content: ans,
              attachments: newAtts,
              lastModified: formatNow(),
              changeReason: 'Aus KI-Verlauf gespeichert',
              source: 'KI-Zuordnung',
              aiTouched: true,
              customMeta: {}
            };
            updateProject(activeProject.id, (p) => ({
              ...p,
              knowledge: [newK, ...(p.knowledge || [])]
            }));
            notify('Unter Wissen & Infos gespeichert.');
          }}
          onJumpToAction={handleJumpToAction}
          onUndoAiAction={handleUndoAiAction}
          onMoveAiAction={handleMoveAiAction}
          onSaveChatAsKnowledge={(title, content) => {
            if (!activeProject) return;
            handleAddKnowledge(activeProject.id, 'info', title, content);
          }}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#111317] flex justify-center">
      <div
        className="w-full max-w-[440px] min-h-screen flex flex-col relative sm:border-x sm:border-white/5 sm:shadow-2xl"
        style={{ backgroundColor: THEME.bgMain, color: THEME.textMain }}
      >
        <div
          className="h-1 w-full transition-colors duration-500"
          style={{ backgroundColor: activeVisualTheme.primary }}
        />

        <main className="flex-1 w-full px-3 pt-3 pb-32">
          {!isBackoffice ? (
            <FrontWorkspace
              activeDomain={activeDomain}
              allProjects={state.projects}
              domainProjects={domainProjects}
              activeProject={activeProject}
              activeTab={activeProjectTab}
              highlightedItemId={highlightedItemId}
              userApiKey={state.userApiKey}
              onSwitchDomain={(d) => {
                setActiveDomain(d);
                const firstInDomain = state.projects.find(
                  (p) => !p.archived && isPrivateDomain(p.domain) === isPrivateDomain(d)
                );
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
                updateProject(projId, (p) => ({ ...p, customLogoUrl: './raccoon-logo.png' }));
                notify('Standard-Logo gesetzt.');
              }}
              onConfirmRedDot={handleConfirmRedDot}
              onAddTask={(
                projId,
                title,
                prio = 'Mittel',
                mins = 25,
                assemblyGroup,
                reminderAt,
                reminderRecurrence,
                extra?: { energyLevel?: EnergyLevel; isHurdleTask?: boolean }
              ) => {
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
                      reminderAt: reminderAt || '',
                      reminderRecurrence: reminderAt ? reminderRecurrence || 'none' : undefined,
                      ...(extra?.energyLevel ? { energyLevel: extra.energyLevel } : {}),
                      ...(extra?.isHurdleTask ? { isHurdleTask: true } : {}),
                      aiTouched: false,
                      lastModified: ts,
                      changeReason: 'Manuell angelegt',
                      source: 'Manuell',
                      assemblyGroup: assemblyGroup || undefined,
                      customMeta: {}
                    },
                    ...p.tasks
                  ]
                }));
              }}
              externalUndoAction={externalUndoAction}
              onClearExternalUndo={() => setExternalUndoAction(null)}
              onToggleTask={handleToggleTask}
              onAddSubTask={handleAddSubTask}
              onToggleSubTask={handleToggleSubTask}
              onDeleteSubTask={handleDeleteSubTask}
              onDeleteTask={(projId, taskId) =>
                updateProject(projId, (p) => ({
                  ...p,
                  tasks: p.tasks.filter((t) => t.id !== taskId)
                }))
              }
              onOpenSingleFocus={(taskId) => {
                setSingleFocusTaskId(taskId || null);
                setSingleFocusOpen(true);
              }}
              onUpdateTask={handleUpdateTask}
              onMoveTask={handleMoveTask}
              onResetChecklistForDeployment={(projId) => {
                const ts = formatNow();
                updateProject(projId, (p) => ({
                  ...p,
                  tasks: p.tasks.map((t) => ({ ...t, completed: false, lastModified: ts }))
                }));
                notify('Checkliste zurückgesetzt.');
              }}
              onAddKnowledge={handleAddKnowledge}
              onUpdateKnowledge={handleUpdateKnowledge}
              onDeleteKnowledge={handleDeleteKnowledge}
              onRestoreKnowledge={handleRestoreKnowledge}
              onUploadKnowledgeAttachment={handleUploadKnowledgeAttachment}
              onPreviewAttachment={(att) => setPreviewAttachment(att)}
              onAddCartItems={handleAddCartItems}
              onToggleCartItem={handleToggleCartItem}
              onDeleteCartItem={handleDeleteCartItem}
              onUpdateCartItem={handleUpdateCartItem}
              onMoveCartItem={handleMoveCartItem}
              onMoveKnowledge={handleMoveKnowledge}
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
              onOpenAddonsBackoffice={(section?: ZentraleSectionId) => {
                setZentraleSection(section || null);
                setIsBackoffice(true);
              }}
              onOpenFloatingCart={() => setFloatingCartOpen(true)}
              isFloatingCartOpen={floatingCartOpen}
              prefs={prefs}
              onUpdatePrefs={handleUpdatePrefs}
              foremanProposals={foremanProposals}
              dismissedThinkerIds={dismissedThinkerIds}
              onAcceptForemanProposal={handleAcceptForemanProposal}
              onSnoozeForemanProposal={handleSnoozeForemanProposal}
              onDismissForemanProposal={handleDismissForemanProposal}
              onParkForemanProposal={handleParkForemanProposal}
              forceSingleViewSeq={forceSingleViewSeq}
              ambientLightMode={state.ambientLightMode || 'shimmer'}
              onSaveDossierToProject={handleSaveDossierToProject}
              onReconcileReceiptWithCart={handleReconcileReceiptWithCart}
              onReconcileCartItems={handleReconcileCartItems}
              onNotify={notify}
            />
          ) : (
            <BackofficeWorkspace
              projects={state.projects}
              selfChecks={state.selfChecks}
              eventSalesLogs={state.eventSalesLogs}
              userApiKey={state.userApiKey}
              realityCheckEnabled={state.realityCheckEnabled}
              haWebhookUrl={state.haWebhookUrl}
              haEmbedUrl={state.haEmbedUrl}
              initialSection={zentraleSection}
              ambientLightMode={state.ambientLightMode || 'shimmer'}
              onChangeAmbientLightMode={handleChangeAmbientLightMode}
              fullState={state}
              onReplaceFullStateFromCloud={handleReplaceFullStateFromCloud}
              onCloseBackoffice={() => { setIsBackoffice(false); setZentraleSection(null); }}
              onToggleArchiveProject={(projId) => {
                const ts = formatNow();
                updateProject(projId, (p) => ({
                  ...p,
                  archived: !p.archived,
                  archivedAt: !p.archived ? ts : undefined
                }));
                notify('Archiv-Status aktualisiert.');
              }}
              onUpdateProject={handleUpdateProject}
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
              onToggleTabForProject={handleToggleTabForProject}
              onSaveScratchpadToProject={(projId, title, content) => {
                handleAddKnowledge(projId, 'info', title, content);
              }}
              onApplyBlueprint={handleApplyBlueprint}
              onChangeApiKey={(key) => setState((prev) => ({ ...prev, userApiKey: key }))}
              onToggleRealityCheck={() =>
                setState((prev) => ({ ...prev, realityCheckEnabled: !prev.realityCheckEnabled }))
              }
              onChangeHaWebhook={(url) => setState((prev) => ({ ...prev, haWebhookUrl: url }))}
              onChangeHaEmbed={(url) => setState((prev) => ({ ...prev, haEmbedUrl: url }))}
              onOpenFlip7Cover={() => toggleCoverMode(true)}
              onOpenRealityModal={() => setRealityModalOpen(true)}
              onOpenSelfCheckModal={() => setSelfCheckModalOpen(true)}
              onCreateProject={handleCreateProject}
              onResetProjectStructure={() => {
                setState((prev) => ({
                  ...INITIAL_APP_SNAPSHOT,
                  userApiKey: prev.userApiKey,
                  aiVoiceSettings: prev.aiVoiceSettings,
                  aiLogs: prev.aiLogs,
                  selfChecks: prev.selfChecks,
                  eventSalesLogs: prev.eventSalesLogs
                }));
                notify('Projektstruktur aktualisiert.');
              }}
              aiVoiceSettings={aiVoiceSettings}
              onUpdateAiVoiceSettings={handleUpdateAiVoiceSettings}
              prefs={prefs}
              onUpdatePrefs={handleUpdatePrefs}
              onExportFullBackup={handleExportFullBackup}
              onImportFullBackup={(snap) => {
                skipNextAutoSyncRef.current = true;
                setState(snap);
                void loadUserPrefsAsync().then(setPrefs);
                void loadForemanProposalsAsync().then(setForemanProposals);
                void loadDismissedThinkerIdsAsync().then(setDismissedThinkerIds);
                void loadOfflineAudioMemosAsync().then(setOfflineAudioMemos);
                notify('Backup geladen.');
              }}
              onUploadProjectLogo={async (projId, file) => {
                const { dataUrl } = await compressImageFile(file);
                updateProject(projId, (p) => ({
                  ...p,
                  customLogoUrl: dataUrl
                }));
                notify('Projekt-Logo aktualisiert.');
              }}
              onResetProjectLogo={(projId) => {
                updateProject(projId, (p) => ({ ...p, customLogoUrl: './raccoon-logo.png' }));
                notify('Standard-Logo gesetzt.');
              }}
              thumbHubEnabled={state.thumbHubEnabled !== false}
              thumbHubPosition={state.thumbHubPosition || 'center'}
              onToggleThumbHub={handleToggleThumbHub}
              onChangeThumbHubPosition={handleChangeThumbHubPosition}
              remindersEnabled={state.remindersEnabled !== false}
              onToggleRemindersEnabled={(enabled) => {
                setState((prev) => ({ ...prev, remindersEnabled: enabled }));
                notify(enabled ? 'Erinnerungen aktiviert.' : 'Erinnerungen pausiert.');
              }}
              onNotify={notify}
            />
          )}
        </main>

        {/* UNTERE BANDIT.OS STEUERUNG: Sechskant-Daumenmodul (hinter Feature-Flag) ODER Klassische Leiste */}
        {!isBackoffice && (
          state.thumbHubEnabled !== false ? (
            <HexThumbHub
              position={state.thumbHubPosition || 'center'}
              organicMotion={prefs.organicMotion !== false}
              cartOpenMode={prefs.cartOpenMode || 'floating'}
              activeProject={activeProject}
              domainProjects={domainProjects}
              allProjects={state.projects}
              activeTab={activeProjectTab}
              onSelectProject={(id) => setSelectedProjectId(id)}
              onChangeTab={(tab) => {
                setActiveProjectTab(tab);
                setForceSingleViewSeq((s) => s + 1);
              }}
              onOpenVoice={(stage) =>
                handleOpenVoice(prefs.companionStartExpanded ? 2 : (stage || 1), true)
              }
              onOpenDeepResearch={() => setDeepResearchModalOpen(true)}
              onOpenSingleFocus={(taskId) => {
                setSingleFocusTaskId(taskId || null);
                setSingleFocusOpen(true);
              }}
              onOpenZentrale={() => {
                setZentraleSection(null);
                setIsBackoffice(true);
              }}
              onOpenFloatingCart={() => setFloatingCartOpen(true)}
              isCompanionActive={voiceModalOpen}
              isFloatingCartOpen={floatingCartOpen}
              isFanOpen={quickFanOpen}
              onToggleFan={setQuickFanOpen}
              onCloseCompanion={() => {
                setVoiceModalOpen(false);
                setVoicePrefillText('');
              }}
              companionIsListening={companionIsListening}
              companionIsProcessing={companionIsProcessing}
              companionIsSpeaking={companionIsSpeaking}
              bottomAiText={bottomAiText}
              onSetBottomAiText={setBottomAiText}
              onSubmitBottomAi={handleBottomAiSubmit}
              themeColors={{
                primary: activeVisualTheme.primary,
                highlight: activeVisualTheme.highlight,
                glow: activeVisualTheme.glow
              }}
            />
          ) : (
            <div className="fixed bottom-3 inset-x-0 z-40 pointer-events-none">
              <div className="max-w-[440px] mx-auto px-3">
                <form
                  onSubmit={handleBottomAiSubmit}
                  className="pointer-events-auto rounded-3xl border border-white/10 p-1.5 shadow-2xl flex items-center gap-1.5"
                  style={{ backgroundColor: '#1C2026' }}
                >
                  <button
                    type="button"
                    onClick={() => setDeepResearchModalOpen(true)}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-2xl text-[#94A3B8] hover:text-white bg-[#242930] border border-white/5 active:scale-95 transition shrink-0"
                    aria-label="Deep Research"
                  >
                    <Scale className="w-4 h-4" />
                  </button>

                  <input
                    type="text"
                    value={bottomAiText}
                    onChange={(e) => setBottomAiText(e.target.value)}
                    placeholder="Frag mich etwas oder gib einen Befehl..."
                    className="flex-1 min-h-[44px] px-3 py-2 rounded-2xl text-xs bg-transparent text-white placeholder-[#94A3B8] outline-none min-w-0"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      if (bottomAiText.trim()) {
                        handleBottomAiSubmit();
                      } else {
                        handleOpenVoice(2, true);
                      }
                    }}
                    aria-label={bottomAiText.trim() ? 'Befehl senden' : 'Sofort sprechen'}
                    className="min-h-[44px] min-w-[44px] px-3.5 py-2.5 rounded-2xl text-white font-bold text-xs flex items-center justify-center gap-1.5 shrink-0 active:scale-95 transition shadow-lg"
                    style={{
                      backgroundColor: activeVisualTheme.primary,
                      boxShadow: `0 4px 16px ${activeVisualTheme.glow}`
                    }}
                  >
                    {bottomAiText.trim() ? (
                      <>
                        <Send className="w-4 h-4" />
                        <span className="hidden sm:inline">Senden</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-4 h-4" />
                        <span>Sprechen</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          )
        )}

        {/* 1-FOKUS-OVERLAY (Lesebrillen-Modus) */}
        <SingleFocusOverlay
          open={singleFocusOpen}
          onClose={() => setSingleFocusOpen(false)}
          activeProject={activeProject}
          initialTaskId={singleFocusTaskId}
          driveDiceEnabled={prefs.driveDiceEnabled !== false}
          onRollAnotherTask={(currentId?: string | null) => {
            if (!activeProject) return;
            const rolled = rollHurdleTask(
              activeProject.tasks,
              currentId ?? singleFocusTaskId
            );
            if (rolled) {
              setSingleFocusTaskId(rolled.id);
            }
          }}
          onToggleTask={handleToggleTask}
          onToggleSubTask={handleToggleSubTask}
          onRegisterUndo={(action) => {
            notify(action.message);
          }}
          themeColors={{
            primary: activeVisualTheme.primary,
            highlight: activeVisualTheme.highlight
          }}
        />

        {/* SCHWEBENDER EINKAUFSWAGEN */}
        <FloatingCartOverlay
          open={floatingCartOpen}
          onClose={() => setFloatingCartOpen(false)}
          onSwitchToFullScreen={() => {
            setFloatingCartOpen(false);
            setActiveProjectTab('cart');
            setForceSingleViewSeq((s) => s + 1);
          }}
          activeProject={activeProject || BRAND_CONFIG.projects['proj-foodtruck'] || state.projects[0]}
          allProjects={state.projects}
          themeColors={{
            primary: activeVisualTheme.primary,
            highlight: activeVisualTheme.highlight,
            label: activeDomain.toUpperCase()
          }}
          highlightedItemId={highlightedItemId}
          onToggleCartItem={handleToggleCartItem}
          onDeleteCartItem={handleDeleteCartItem}
          onAddCartItems={handleAddCartItems}
          onUpdateCartItem={handleUpdateCartItem}
          onMoveCartItem={handleMoveCartItem}
          onConfirmRedDot={handleConfirmRedDot}
          onOpenSettings={() => {
            setZentraleSection('projects');
            setIsBackoffice(true);
          }}
          onNotify={notify}
          onRegisterUndo={(action) => notify(action.message)}
          onConfigMissing={(msg) => notify(msg)}
        />

        {/* LEBENDIGER SECHSECK-BEGLEITER (3-STUFEN-MORPHING) */}
        <VoiceModal
          open={voiceModalOpen}
          stage={companionStage}
          onStageChange={(newStage) => {
            if (newStage === 0) {
              setVoiceModalOpen(false);
              setVoicePrefillText('');
            } else {
              setCompanionStage(newStage);
            }
          }}
          themeColors={{
            primary: activeVisualTheme.primary,
            highlight: activeVisualTheme.highlight,
            glow: activeVisualTheme.glow
          }}
          onOpenQuickFan={() => {
          setVoiceModalOpen(false);
          setQuickFanOpen(true);
        }}
        autoStartMic={autoStartMicOnOpen}
        wakeLockEnabled={prefs.wakeLockEnabled !== false}
        offlineAudioBufferEnabled={prefs.offlineAudioBufferEnabled !== false}
        companionMessageToolsEnabled={prefs.companionMessageToolsEnabled !== false}
        companionQuickChipsEnabled={prefs.companionQuickChipsEnabled !== false}
        activeProjectId={activeProject?.id || BRAND_CONFIG.defaultProjectId}
        userApiKey={state.userApiKey}
        offlineAudioMemos={offlineAudioMemos}
        onUpdateOfflineAudioMemos={(next) => {
          setOfflineAudioMemos(next);
          void saveOfflineAudioMemos(next);
        }}
        initialPrefillText={voicePrefillText}
        activeProjectName={activeProject?.name || BRAND_CONFIG.projects['proj-foodtruck']?.name || 'Pizza Bandit'}
        projects={state.projects}
        aiVoiceSettings={aiVoiceSettings}
        onUpdateAiVoiceSettings={handleUpdateAiVoiceSettings}
        onClose={() => {
          setVoiceModalOpen(false);
          setVoicePrefillText('');
        }}
        onExecuteCommand={handleDistributeVoiceCommand}
        onExecuteOfflineFallback={handleExecuteOfflineFallback}
        onAskQuestion={(q, att) =>
          askQuickAssistantQuestion(
            q,
            getEffectiveDefaultProjectId(),
            state.userApiKey,
            att,
            {
              allProjects: state.projects.filter((p) => !p.archived),
              settings: aiVoiceSettingsRef.current
            }
          )
        }
        onSaveAnswerToInfos={(q, ans, att) => {
          if (!activeProject) return;
          const newAtts = att ? [att] : [];
          const newK: KnowledgeItem = {
            id: `k-qa-${Date.now()}`,
            title: enforceMaxSixWords(q, 'KI-Notiz'),
            kind: 'info',
            content: ans,
            attachments: newAtts,
            lastModified: formatNow(),
            changeReason: 'Aus KI-Verlauf gespeichert',
            source: 'KI-Zuordnung',
            aiTouched: true,
            customMeta: {}
          };
          updateProject(activeProject.id, (p) => ({
            ...p,
            knowledge: [newK, ...(p.knowledge || [])]
          }));
          notify('Unter Wissen & Infos gespeichert.');
        }}
        onJumpToAction={handleJumpToAction}
        onUndoAiAction={handleUndoAiAction}
        onMoveAiAction={handleMoveAiAction}
        onSaveChatAsKnowledge={(title, content) => {
          if (!activeProject) return;
          handleAddKnowledge(activeProject.id, 'info', title, content);
        }}
        onListeningChange={setCompanionIsListening}
        onProcessingChange={setCompanionIsProcessing}
        onSpeakingChange={setCompanionIsSpeaking}
      />

        <DeepResearchAndAuditModal
          open={deepResearchModalOpen}
          projects={state.projects}
          activeProject={activeProject}
          userApiKey={state.userApiKey}
          fullState={state}
          themeColors={{
            primary: activeVisualTheme.primary,
            highlight: activeVisualTheme.highlight,
            label: activeDomain.toUpperCase()
          }}
          onClose={() => setDeepResearchModalOpen(false)}
          onSaveDossierToProject={handleSaveDossierToProject}
          onReconcileReceiptWithCart={handleReconcileReceiptWithCart}
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
                  changeReason: 'Aus Deep Research übernommen',
                  source: 'Deep Research',
                  customMeta: {}
                },
                ...p.tasks
              ]
            }));
          }}
          onAddKnowledge={handleAddKnowledge}
          onOpenSettings={(sec) => {
            setZentraleSection(sec || 'ai');
            setIsBackoffice(true);
          }}
          onReplaceFullStateFromCloud={handleReplaceFullStateFromCloud}
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
                          enabledTabs: ['tasks', 'cart', 'knowledge', 'extras'],
                          tasks: [],
                          knowledge: [],
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
                  <span className="text-xs text-[#9CA3AF] shrink-0">Klick = Pin setzen</span>
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
                        className="absolute -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 rounded-md text-xs font-bold text-white shadow-lg flex items-center gap-1 border border-white/30"
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
                            saveIdbItem(STORAGE_KEYS.PHOTO_PINS, next);
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

        {activeReminder && (
          <div
            role="alertdialog"
            aria-label="Aufgaben-Erinnerung"
            data-testid="in-app-reminder-banner"
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[48] w-[calc(100%-24px)] max-w-[440px] rounded-2xl border p-3.5 shadow-2xl space-y-3 animate-fadeIn backdrop-blur-md"
            style={{
              backgroundColor: DESIGN_TOKENS.surface,
              borderColor: `${DESIGN_TOKENS.accentHoney}66`,
              boxShadow: '0 12px 36px rgba(0,0,0,0.7), 0 0 20px rgba(229,169,60,0.16)'
            }}
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border"
                style={{
                  backgroundColor: `${DESIGN_TOKENS.accentHoney}1A`,
                  borderColor: `${DESIGN_TOKENS.accentHoney}44`
                }}
              >
                <Clock className="w-4 h-4" style={{ color: DESIGN_TOKENS.accentHoney }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#E5A93C]">
                    {activeReminder.projectName}
                  </span>
                  <span className="text-xs font-mono text-[#94A3B8]">
                    ⏰ {formatReminderBadge(activeReminder.task.reminderAt)}
                  </span>
                  {activeReminder.shoulderTapLabel && (
                    <span
                      data-testid="shoulder-tap-stage-badge"
                      className="text-xs font-mono font-bold px-2 py-0.5 rounded-md border"
                      style={{
                        color: DESIGN_TOKENS.accentHoney,
                        backgroundColor: `${DESIGN_TOKENS.accentHoney}1A`,
                        borderColor: `${DESIGN_TOKENS.accentHoney}33`
                      }}
                    >
                      {activeReminder.shoulderTapLabel}
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold text-[#F1F5F9] leading-snug break-words mt-0.5">
                  {activeReminder.task.title}
                </p>
                {activeReminder.shoulderTapMessage && (
                  <p
                    data-testid="shoulder-tap-message"
                    className="text-xs text-[#94A3B8] leading-snug break-words mt-1"
                  >
                    {activeReminder.shoulderTapMessage}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  const { projectId, task, firedKey } = activeReminder;
                  const rec: ReminderRecurrence = task.reminderRecurrence || 'none';
                  const nowIso = new Date().toISOString();
                  if (rec === 'daily' || rec === 'weekly') {
                    const nextAt = computeNextRecurrenceReminder(task.reminderAt, rec);
                    handleUpdateTask(projectId, task.id, {
                      reminderAt: nextAt,
                      lastReminderFiredAt: nowIso,
                      lastShoulderTapStage: 0
                    });
                    notify(`Für heute erledigt – nächste Erinnerung ${formatReminderBadge(nextAt)}`);
                  } else {
                    handleUpdateTask(projectId, task.id, {
                      completed: true,
                      lastReminderFiredAt: nowIso,
                      lastShoulderTapStage: 0
                    });
                    registerExternalUndo({
                      message: `„${task.title}“ erledigt`,
                      undo: () => handleToggleTask(projectId, task.id)
                    });
                  }
                  dismissActiveReminder(firedKey);
                }}
                className="min-h-[44px] px-2.5 py-2 rounded-xl text-xs font-bold text-[#111317] active:scale-95 transition cursor-pointer flex items-center justify-center"
                style={{ backgroundColor: DESIGN_TOKENS.accentHoney }}
              >
                Erledigt ✓
              </button>
              <button
                type="button"
                onClick={() => {
                  const { projectId, task, firedKey } = activeReminder;
                  const snoozed = toLocalDateTimeInputValue(new Date(Date.now() + 30 * 60 * 1000));
                  handleUpdateTask(projectId, task.id, {
                    reminderAt: snoozed,
                    lastReminderFiredAt: undefined,
                    lastShoulderTapStage: 0
                  });
                  dismissActiveReminder(firedKey);
                  notify(`Erinnerung verschoben auf ${formatReminderBadge(snoozed)}.`);
                }}
                className="min-h-[44px] px-2.5 py-2 rounded-xl text-xs font-semibold bg-[#111317] hover:bg-[#22262F] text-[#F1F5F9] border border-white/10 active:scale-95 transition cursor-pointer flex items-center justify-center"
              >
                +30 Min
              </button>
              <button
                type="button"
                onClick={() => {
                  const { projectId, task, firedKey } = activeReminder;
                  const rec: ReminderRecurrence = task.reminderRecurrence || 'none';
                  const nowIso = new Date().toISOString();
                  if (rec === 'daily' || rec === 'weekly') {
                    const nextAt = computeNextRecurrenceReminder(task.reminderAt, rec);
                    handleUpdateTask(projectId, task.id, {
                      reminderAt: nextAt,
                      lastReminderFiredAt: nowIso,
                      lastShoulderTapStage: 0
                    });
                  } else {
                    handleUpdateTask(projectId, task.id, {
                      lastReminderFiredAt: nowIso,
                      ...(activeReminder.shoulderTapStage ? { lastShoulderTapStage: 4 } : {})
                    });
                  }
                  dismissActiveReminder(firedKey);
                }}
                className="min-h-[44px] px-2.5 py-2 rounded-xl text-xs font-semibold bg-[#111317] hover:bg-[#22262F] text-[#94A3B8] hover:text-[#F1F5F9] border border-white/10 active:scale-95 transition cursor-pointer flex items-center justify-center"
              >
                OK
              </button>
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
    </div >
  );
}
