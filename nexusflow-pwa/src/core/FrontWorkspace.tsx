import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Crosshair,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import {
  Attachment,
  BanditUserPreferences,
  CartItem,
  CustomMeta,
  DomainType,
  EnergyLevel,
  EventSalesLog,
  ForemanProposal,
  KnowledgeItem,
  KnowledgeKind,
  PriorityType,
  Project,
  ProjectTabId,
  ReminderRecurrence,
  SmartHomeSwitchItem,
  TaskItem,
  AmbientLightMode
} from '../types';
import { BRAND_CONFIG } from '../config/brandConfig';
import { StepByStepAudioGuide } from '../components/StepByStepAudioGuide';
import { PLUGIN_REGISTRY } from '../plugins/registry';
import {
  loadAmbientLightMode,
  loadUserPrefs,
  saveUserPrefs,
  triggerHapticFeedback
} from '../services/storage';
import { UNDO_TOAST_MS } from '../config/runtimeConfig';
import { ZentraleSectionId } from './BackofficeWorkspace';
import type { CartReconcileMatch } from '../services/receiptForeman';
import type { SavedScannedReceipt } from '../services/storage';
import { analyzeProjectConsistency } from '../services/silentThinker';
import {
  NavigationDrawer,
  FrontHeader,
  TasksView,
  CartView,
  KnowledgeView,
  ExtrasView,
  ReceiptScanView,
  DeepResearchView,
  ForemanInboxCard
} from './front';

interface FrontWorkspaceProps {
  activeDomain: DomainType;
  allProjects?: Project[];
  domainProjects: Project[];
  activeProject?: Project;
  activeTab: ProjectTabId;
  highlightedItemId: string | null;
  userApiKey?: string;
  ambientLightMode?: AmbientLightMode;
  onSaveDossierToProject?: (
    projectId: string,
    title: string,
    markdownContent: string,
    followUpTasks: string[]
  ) => void;
  onReconcileReceiptWithCart?: (
    projectId: string,
    storeName: string,
    purchaseDate: string,
    totalAmount: string,
    items: Array<{ title: string; quantity: string; price: string }>
  ) => void;
  onReconcileCartItems?: (
    matches: CartReconcileMatch[],
    receipt: SavedScannedReceipt
  ) => void;
  onSwitchDomain: (d: DomainType) => void;
  onSelectProject: (id: string) => void;
  onChangeTab: (tab: ProjectTabId) => void;
  onOpenNewProjectModal: () => void;
  onUploadProjectLogo?: (projectId: string, file: File) => void;
  onResetProjectLogo?: (projectId: string) => void;
  onOpenDeepResearchModal?: () => void;
  onConfirmRedDot: (
    projectId: string,
    section: 'tasks' | 'cart' | 'knowledge',
    itemId: string
  ) => void;
  onResetChecklist?: (projectId: string) => void;
  onResetChecklistForDeployment?: (projectId: string) => void;
  onToggleTask: (projectId: string, taskId: string) => void;
  onAddSubTask?: (projectId: string, taskId: string, title: string) => void;
  onToggleSubTask?: (projectId: string, taskId: string, subTaskId: string) => void;
  onDeleteSubTask?: (projectId: string, taskId: string, subTaskId: string) => void;
  onAddTask: (
    projectId: string,
    title: string,
    priority?: PriorityType,
    estimatedMinutes?: number,
    assemblyGroup?: string,
    reminderAt?: string,
    reminderRecurrence?: ReminderRecurrence,
    extra?: { energyLevel?: EnergyLevel; isHurdleTask?: boolean }
  ) => void;
  externalUndoAction?: { message: string; undo: () => void } | null;
  onClearExternalUndo?: () => void;
  onDeleteTask: (projectId: string, taskId: string) => void;
  onUpdateTask?: (projectId: string, taskId: string, patch: Partial<TaskItem>) => void;
  onMoveTask?: (fromProjectId: string, toProjectId: string, taskId: string) => void;
  onSendTaskToCart?: (projectId: string, title: string) => void;
  onAddKnowledge?: (
    projectId: string,
    kind: KnowledgeKind,
    title: string,
    content: string,
    attachments?: Attachment[]
  ) => void;
  onUpdateKnowledge?: (
    projectId: string,
    itemId: string,
    title: string,
    content: string
  ) => void;
  onDeleteKnowledge?: (projectId: string, knowledgeId: string) => void;
  onRestoreKnowledge?: (projectId: string, item: KnowledgeItem, insertIndex?: number) => void;
  onUploadKnowledgeAttachment?: (
    projectId: string,
    itemId: string,
    file: File
  ) => void;
  onPreviewAttachment: (att: Attachment) => void;
  onAddCartItems: (
    projectId: string,
    items: Array<{ title: string; quantity: string; price?: string; reason?: string }>
  ) => void;
  onToggleCartItem: (projectId: string, cartId: string) => void;
  onDeleteCartItem: (projectId: string, cartId: string) => void;
  onUpdateCartItem?: (projectId: string, cartId: string, patch: Partial<CartItem>) => void;
  onMoveCartItem?: (fromProjectId: string, toProjectId: string, cartId: string) => void;
  onMoveKnowledge?: (fromProjectId: string, toProjectId: string, itemId: string) => void;
  onUpdateProjectMeta: (projectId: string, patch: CustomMeta) => void;
  onRecordEventSale: (entry: EventSalesLog) => void;
  onOpenSingleFocus?: (taskId?: string) => void;
  onOpenAddonsBackoffice: (section?: ZentraleSectionId) => void;
  onOpenFloatingCart?: () => void;
  isFloatingCartOpen?: boolean;
  prefs?: BanditUserPreferences;
  onUpdatePrefs?: (patch: Partial<BanditUserPreferences>) => void;
  foremanProposals?: ForemanProposal[];
  dismissedThinkerIds?: string[];
  onAcceptForemanProposal?: (proposal: ForemanProposal) => void;
  onSnoozeForemanProposal?: (proposal: ForemanProposal) => void;
  onDismissForemanProposal?: (proposal: ForemanProposal) => void;
  onParkForemanProposal?: (proposal: ForemanProposal) => void;
  smartHomeSwitches?: SmartHomeSwitchItem[];
  haWebhookUrl?: string;
  onTriggerSmartHomeSwitch?: (switchId: string, triggeredAt: string) => void;
  forceSingleViewSeq?: number;
  onNotify: (msg: string) => void;
}

export const FrontWorkspace: React.FC<FrontWorkspaceProps> = ({
  activeDomain,
  allProjects = [],
  domainProjects,
  activeProject,
  activeTab,
  highlightedItemId,
  userApiKey,
  onSwitchDomain,
  onSelectProject,
  onChangeTab,
  onOpenNewProjectModal,
  onUploadProjectLogo,
  onResetProjectLogo: _onResetProjectLogo,
  onOpenDeepResearchModal,
  onConfirmRedDot,
  onResetChecklist,
  onResetChecklistForDeployment,
  onToggleTask,
  onAddSubTask,
  onToggleSubTask,
  onDeleteSubTask,
  onAddTask,
  externalUndoAction,
  onClearExternalUndo,
  onDeleteTask,
  onUpdateTask,
  onMoveTask,
  onSendTaskToCart,
  onAddKnowledge,
  onUpdateKnowledge,
  onDeleteKnowledge,
  onRestoreKnowledge,
  onUploadKnowledgeAttachment,
  onPreviewAttachment,
  onAddCartItems,
  onToggleCartItem,
  onDeleteCartItem,
  onUpdateCartItem,
  onMoveCartItem,
  onMoveKnowledge,
  onUpdateProjectMeta,
  onRecordEventSale,
  onOpenSingleFocus,
  onOpenAddonsBackoffice,
  onOpenFloatingCart,
  isFloatingCartOpen = false,
  prefs: prefsProp,
  onUpdatePrefs: onUpdatePrefsProp,
  foremanProposals = [],
  dismissedThinkerIds = [],
  onAcceptForemanProposal,
  onSnoozeForemanProposal,
  onDismissForemanProposal,
  onParkForemanProposal,
  smartHomeSwitches = [],
  haWebhookUrl = '',
  onTriggerSmartHomeSwitch,
  forceSingleViewSeq = 0,
  ambientLightMode = 'shimmer',
  onSaveDossierToProject,
  onReconcileReceiptWithCart,
  onReconcileCartItems,
  onNotify
}) => {
  const [localPrefs, setLocalPrefs] = useState<BanditUserPreferences>(loadUserPrefs);
  const prefs = prefsProp || localPrefs;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeAudioGuideExp, setActiveAudioGuideExp] = useState<any | null>(null);
  const [viewAllSections, setViewAllSections] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 4-Sekunden-Rückgängig-Leiste State
  const [undoAction, setUndoAction] = useState<{ message: string; undo: () => void } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Zentraler Honig-Gold-Hinweis-Toast State (#E5A93C)
  const [configNotice, setConfigNotice] = useState<{ message: string; actionLabel: string; section?: ZentraleSectionId } | null>(null);
  const configNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const drawerDragXRef = useRef<number>(0);
  const [drawerDragX, setDrawerDragX] = useState<number>(0);

  const handleRegisterUndo = (action: { message: string; undo: () => void }) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoAction(action);
    undoTimerRef.current = setTimeout(() => {
      setUndoAction(null);
    }, UNDO_TOAST_MS);
  };

  const showConfigNotice = (message: string, actionLabel: string = 'Zentrale', section?: ZentraleSectionId) => {
    if (configNoticeTimerRef.current) clearTimeout(configNoticeTimerRef.current);
    triggerHapticFeedback([20, 30]);
    setConfigNotice({ message, actionLabel, section });
    configNoticeTimerRef.current = setTimeout(() => {
      setConfigNotice(null);
    }, 4500);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartXRef.current = t.clientX;
    touchStartYRef.current = t.clientY;
    drawerDragXRef.current = 0;
    setDrawerDragX(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const t = e.touches[0];
    const deltaX = t.clientX - touchStartXRef.current;
    const deltaY = Math.abs(t.clientY - touchStartYRef.current);
    if (deltaY > 60) return; // vertical scroll – ignore

    if (!drawerOpen && touchStartXRef.current <= 30 && deltaX > 0) {
      const drag = Math.min(deltaX, window.innerWidth * 0.85);
      drawerDragXRef.current = drag;
      setDrawerDragX(drag);
    } else if (drawerOpen && deltaX < 0) {
      const drag = Math.max(deltaX, -(window.innerWidth * 0.85));
      drawerDragXRef.current = drag;
      setDrawerDragX(drag);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const t = e.changedTouches[0];
    const deltaX = t.clientX - touchStartXRef.current;
    const deltaY = Math.abs(t.clientY - touchStartYRef.current);

    if (!drawerOpen && touchStartXRef.current <= 30 && deltaX > 50 && deltaY < 60) {
      setDrawerOpen(true);
    } else if (drawerOpen && deltaX < -50 && deltaY < 60) {
      setDrawerOpen(false);
    }
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    setDrawerDragX(0);
    drawerDragXRef.current = 0;
  };

  const updatePrefs = (patch: Partial<BanditUserPreferences>) => {
    if (onUpdatePrefsProp) {
      onUpdatePrefsProp(patch);
      return;
    }
    const next = { ...prefs, ...patch };
    setLocalPrefs(next);
    void saveUserPrefs(next);
  };

  const themeColors = useMemo(() => {
    const customAccent =
      (activeProject?.customMeta?.customAccentColor as string | undefined) ||
      activeProject?.accentColor;
    if (customAccent) {
      return { primary: customAccent, highlight: customAccent, label: activeDomain.toUpperCase() };
    }
    const brandProj = activeProject ? BRAND_CONFIG.projects[activeProject.id] : null;
    if (brandProj) {
      return {
        primary: brandProj.accentColor,
        highlight: brandProj.highlightColor,
        label: brandProj.domainLabel
      };
    }
    return activeDomain === 'private'
      ? BRAND_CONFIG.domainColors.private
      : BRAND_CONFIG.domainColors.business;
  }, [activeDomain, activeProject]);

  const isPrivDomain = (d?: DomainType) => d === 'private';
  const projectsSource = allProjects.length > 0 ? allProjects : domainProjects;
  const workProjects = projectsSource.filter((p) => !p.archived && !isPrivDomain(p.domain));
  const privateProjects = projectsSource.filter((p) => !p.archived && isPrivDomain(p.domain));

  const activePlugins = PLUGIN_REGISTRY.filter((pl) =>
    (activeProject?.enabledPlugins || []).includes(pl.id)
  );

  const isTabEnabled = (
    proj: Project | undefined,
    tab: 'tasks' | 'cart' | 'knowledge' | 'extras'
  ): boolean => {
    if (!proj) return true;
    const tabs = proj.enabledTabs || ['tasks', 'cart', 'knowledge', 'extras'];
    return tabs.includes(tab);
  };

  const getFirstActiveTab = (proj?: Project): ProjectTabId => {
    if (!proj) return 'tasks';
    const tabs = proj.enabledTabs || ['tasks', 'cart', 'knowledge', 'extras'];
    if (tabs.includes('tasks')) return 'tasks';
    if (tabs.includes('knowledge')) return 'knowledge';
    if (tabs.includes('cart')) return 'cart';
    if (tabs.includes('extras')) return 'extras';
    return 'tasks';
  };

  // Sicherheits-Fallback: Wenn Gesamt deaktiviert wird, während der Nutzer sich gerade darauf befindet
  useEffect(() => {
    if (activeProject && activeProject.overviewEnabled === false && viewAllSections) {
      setViewAllSections(false);
      onChangeTab(getFirstActiveTab(activeProject));
    }
  }, [activeProject, viewAllSections, onChangeTab]);

  useEffect(() => {
    if (forceSingleViewSeq > 0) {
      setViewAllSections(false);
    }
  }, [forceSingleViewSeq]);

  const selectProjectAndSection = (proj: Project, tab: ProjectTabId | 'ALL') => {
    if (proj.domain !== activeDomain) onSwitchDomain(proj.domain);
    onSelectProject(proj.id);
    if (tab === 'ALL') {
      if (proj.overviewEnabled === false) {
        setViewAllSections(false);
        onChangeTab(getFirstActiveTab(proj));
      } else {
        setViewAllSections(true);
      }
    } else {
      setViewAllSections(false);
      onChangeTab(tab);
    }
    setDrawerOpen(false);
  };

  const showTasksSection =
    (viewAllSections || activeTab === 'tasks') && isTabEnabled(activeProject, 'tasks');
  const showCartSection =
    !isFloatingCartOpen && (viewAllSections || activeTab === 'cart') && isTabEnabled(activeProject, 'cart');
  const showKnowledgeSection =
    (viewAllSections || activeTab === 'knowledge') &&
    isTabEnabled(activeProject, 'knowledge');
  const showExtrasSection =
    (!viewAllSections && activeTab === 'extras') && isTabEnabled(activeProject, 'extras');
  const showReceiptSection = !viewAllSections && activeTab === 'receipt';
  const showResearchSection = !viewAllSections && activeTab === 'research';

  const visibleForemanProposals = useMemo(() => {
    if (!activeProject) return [];
    const nowMs = Date.now();
    const storedById = new Map(foremanProposals.map((p) => [p.id, p]));

    const thinkerProposals: ForemanProposal[] =
      prefs.silentThinkerEnabled !== false
        ? analyzeProjectConsistency(activeProject, dismissedThinkerIds).filter((tp) => {
            const stored = storedById.get(tp.id);
            if (!stored) return true;
            if (stored.status === 'dismissed' || stored.status === 'accepted') return false;
            if (stored.status === 'snoozed' && stored.snoozedUntil) {
              const until = Date.parse(stored.snoozedUntil);
              if (Number.isFinite(until) && until > nowMs) return false;
            }
            return true;
          })
        : [];

    const murmurProposals: ForemanProposal[] =
      prefs.murmurAutopilotEnabled !== false
        ? foremanProposals.filter((p) => {
            if (p.kind !== 'murmur-research') return false;
            if (p.projectId !== activeProject.id) return false;
            if (p.status === 'accepted' || p.status === 'dismissed') return false;
            if (p.status === 'snoozed' && p.snoozedUntil) {
              const until = Date.parse(p.snoozedUntil);
              if (Number.isFinite(until) && until > nowMs) return false;
            }
            return true;
          })
        : [];

    return [...murmurProposals, ...thinkerProposals];
  }, [
    activeProject,
    prefs.silentThinkerEnabled,
    prefs.murmurAutopilotEnabled,
    foremanProposals,
    dismissedThinkerIds
  ]);

  const showForemanInbox =
    (showTasksSection || showCartSection || showKnowledgeSection) &&
    visibleForemanProposals.length > 0 &&
    Boolean(onAcceptForemanProposal && onSnoozeForemanProposal && onDismissForemanProposal);

  return (
    <div
      className="relative min-h-[75vh] space-y-3.5 pb-40"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Edge-Zone: unsichtbares 30px-Band am linken Viewport-Rand für Edge-Pull-Erkennung */}
      {!drawerOpen && (
        <div
          className="fixed top-0 left-0 h-full w-[30px] z-30 pointer-events-none"
          aria-hidden="true"
        />
      )}

      {/* ORGANISCHE HINTERGRUNDBELEUCHTUNG */}
      {ambientLightMode === 'static' && (
        <div
          className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[650px] h-[450px] blur-[120px] opacity-10 transition-all duration-700 z-0 rounded-full"
          style={{ backgroundColor: themeColors.primary }}
          aria-hidden="true"
        />
      )}

      {ambientLightMode === 'shimmer' && (
        <div
          className="pointer-events-none fixed inset-0 overflow-hidden z-0"
          aria-hidden="true"
        >
          {/* Blob 1: Oben links */}
          <div
            className="absolute -top-[10%] -left-[10%] w-[480px] h-[480px] rounded-full blur-[130px] ambient-shimmer-blob-1"
            style={{ backgroundColor: themeColors.primary }}
          />
          {/* Blob 2: Rechts mittig */}
          <div
            className="absolute top-[28%] -right-[15%] w-[520px] h-[520px] rounded-full blur-[140px] ambient-shimmer-blob-2"
            style={{ backgroundColor: themeColors.primary }}
          />
          {/* Blob 3: Unten links */}
          <div
            className="absolute bottom-[10%] -left-[5%] w-[440px] h-[440px] rounded-full blur-[130px] ambient-shimmer-blob-3"
            style={{ backgroundColor: themeColors.primary }}
          />
        </div>
      )}

      {/* Weicher dunkler Fade-Out-Verlauf am unteren Bildschirmrand (transparent → #111317) */}
      <div
        className="pointer-events-none fixed bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-[#111317] via-[#111317]/85 to-transparent z-20"
        aria-hidden="true"
      />

      {/* ZENTRALER HONIG-GOLD-HINWEIS-TOAST (#E5A93C) BEI FEHLENDEN KEYS / FUNKTIONEN */}
      {configNotice && (
        <div
          role="alert"
          className="fixed top-5 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-[420px] min-h-[44px] px-4 py-3 rounded-2xl border shadow-2xl flex items-center justify-between gap-3 animate-fadeIn backdrop-blur-md"
          style={{
            backgroundColor: '#191C22',
            borderColor: 'rgba(229,169,60,0.35)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 16px rgba(229,169,60,0.12)'
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <Sparkles className="w-4 h-4 text-[#E5A93C] shrink-0" />
            <span className="text-xs font-medium text-[#F1F5F9] leading-snug">
              {configNotice.message}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setConfigNotice(null);
              onOpenAddonsBackoffice(configNotice.section);
            }}
            className="min-h-[44px] px-3.5 rounded-xl text-xs font-bold text-[#111317] shrink-0 active:scale-95 transition cursor-pointer flex items-center justify-center shadow-sm"
            style={{ backgroundColor: '#E5A93C' }}
          >
            {configNotice.actionLabel}
          </button>
        </div>
      )}

      {/* 4-SEKUNDEN-RÜCKGÄNGIG-LEISTE (direkt über der unteren Leiste) */}
      {(undoAction || externalUndoAction) && (
        <div
          role="status"
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-[420px] min-h-[44px] px-4 py-2.5 rounded-2xl border shadow-2xl flex items-center justify-between gap-3 animate-fadeIn backdrop-blur-md"
          style={{
            backgroundColor: '#191C22',
            borderColor: 'rgba(255,255,255,0.08)'
          }}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <RotateCcw className="w-4 h-4 text-[#94A3B8] shrink-0" />
            <span className="text-xs font-medium text-[#F1F5F9] truncate">
              {(undoAction || externalUndoAction)!.message}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              const active = undoAction || externalUndoAction;
              active?.undo();
              setUndoAction(null);
              onClearExternalUndo?.();
              triggerHapticFeedback(10);
            }}
            className="min-h-[44px] min-w-[44px] px-3.5 rounded-xl text-xs font-bold shrink-0 active:scale-95 transition cursor-pointer flex items-center justify-center"
            style={{
              color: themeColors.highlight,
              backgroundColor: `${themeColors.primary}22`
            }}
          >
            Rückgängig
          </button>
        </div>
      )}

      {/* ADHS-FUNKTION: "WO WAR ICH GERADE?"-ANKER (Ruhige Fläche) */}
      {prefs.adhdMasterEnabled &&
        prefs.adhdFocusAnchor &&
        prefs.activeFocusTaskTitle && (
          <div
            className="p-4 rounded-3xl border flex items-center justify-between gap-3 shadow-xl transition-all duration-300"
            style={{
              backgroundColor: '#191C22',
              borderColor: `${themeColors.highlight}33`
            }}
          >
            <div
              className="flex items-center gap-3 min-w-0 cursor-pointer flex-1"
              onClick={() => {
                if (prefs.activeFocusProjectId) {
                  onSelectProject(prefs.activeFocusProjectId);
                }
              }}
            >
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border"
                style={{
                  backgroundColor: `${themeColors.primary}22`,
                  borderColor: `${themeColors.highlight}44`
                }}
              >
                <Crosshair
                  className="w-5 h-5 animate-pulse"
                  style={{ color: themeColors.highlight }}
                />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-extrabold uppercase tracking-wider text-[#94A3B8]">
                  Aktiver Fokus-Anker (Gerade dran)
                </div>
                <div className="text-sm font-semibold text-[#F1F5F9] truncate">
                  {prefs.activeFocusTaskTitle}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                updatePrefs({
                  activeFocusTaskId: null,
                  activeFocusTaskTitle: null,
                  activeFocusProjectId: null
                })
              }
              className="min-h-[44px] px-3.5 rounded-xl text-xs font-semibold bg-[#111317] hover:bg-[#22262F] text-[#94A3B8] hover:text-white shrink-0 border border-white/5 active:scale-95 transition cursor-pointer"
            >
              Lösen
            </button>
          </div>
        )}

      {/* LINKER SWIPE-DRAWER (z-[55] damit über minimiertem VoiceModal z-50) */}
      <NavigationDrawer
        drawerOpen={drawerOpen}
        drawerDragX={drawerDragX}
        themeColors={themeColors}
        workProjects={workProjects}
        privateProjects={privateProjects}
        activeProject={activeProject}
        viewAllSections={viewAllSections}
        activeTab={activeTab}
        cartOpenMode={prefs.cartOpenMode || 'floating'}
        onSelectProjectAndSection={selectProjectAndSection}
        onClose={() => setDrawerOpen(false)}
        onOpenNewProjectModal={onOpenNewProjectModal}
        onOpenDeepResearchModal={onOpenDeepResearchModal}
        onOpenAddonsBackoffice={onOpenAddonsBackoffice}
        onOpenFloatingCart={onOpenFloatingCart}
        isTabEnabled={isTabEnabled}
      />

      {/* RUHIGE PROJEKT-KOPFZEILE */}
      {activeProject && (
        <FrontHeader
          activeProject={activeProject}
          themeColors={themeColors}
          viewAllSections={viewAllSections}
          showSearch={showSearch}
          searchQuery={searchQuery}
          onToggleViewAll={() => setViewAllSections((v) => !v)}
          onToggleSearch={() => {
            setShowSearch((s) => !s);
            if (showSearch) setSearchQuery('');
          }}
          onSetSearchQuery={setSearchQuery}
          onOpenDrawer={() => setDrawerOpen(true)}
          onUploadProjectLogo={onUploadProjectLogo}
        />
      )}

      {/* HAUPTARBEITSFELD */}
      {activeProject && (
        <div className="space-y-4">
          {showForemanInbox && (
            <ForemanInboxCard
              proposals={visibleForemanProposals}
              onAcceptProposal={onAcceptForemanProposal!}
              onSnoozeProposal={onSnoozeForemanProposal!}
              onDismissProposal={onDismissForemanProposal!}
            />
          )}

          {/* SEKTION 1: TASKS */}
          {showTasksSection && (
            <TasksView
              activeProject={activeProject}
              allProjects={allProjects}
              themeColors={themeColors}
              prefs={prefs}
              searchQuery={searchQuery}
              highlightedItemId={highlightedItemId}
              onToggleTask={onToggleTask}
              onAddSubTask={onAddSubTask}
              onToggleSubTask={onToggleSubTask}
              onDeleteSubTask={onDeleteSubTask}
              onAddTask={onAddTask}
              onDeleteTask={onDeleteTask}
              onUpdateTask={onUpdateTask}
              onMoveTask={onMoveTask}
              onSendTaskToCart={onSendTaskToCart}
              onAddCartItems={onAddCartItems}
              onConfirmRedDot={onConfirmRedDot}
              onResetChecklist={onResetChecklist}
              onResetChecklistForDeployment={onResetChecklistForDeployment}
              onUpdatePrefs={updatePrefs}
              onOpenSingleFocus={onOpenSingleFocus}
              onOpenSettings={() => onOpenAddonsBackoffice('focus')}
              onNotify={onNotify}
              onRegisterUndo={handleRegisterUndo}
              onConfigMissing={(msg) => showConfigNotice(msg, 'Zentrale', 'ai')}
            />
          )}

          {/* SEKTION 2: EINKAUFSWAGEN */}
          {showCartSection && (
            <CartView
              activeProject={activeProject}
              allProjects={allProjects}
              themeColors={themeColors}
              searchQuery={searchQuery}
              highlightedItemId={highlightedItemId}
              onToggleCartItem={onToggleCartItem}
              onDeleteCartItem={onDeleteCartItem}
              onAddCartItems={onAddCartItems}
              onUpdateCartItem={onUpdateCartItem}
              onMoveCartItem={onMoveCartItem}
              onConfirmRedDot={onConfirmRedDot}
              onOpenSettings={() => onOpenAddonsBackoffice('projects')}
              onNotify={onNotify}
              onRegisterUndo={handleRegisterUndo}
              onConfigMissing={(msg) => showConfigNotice(msg, 'Zentrale', 'ai')}
            />
          )}

          {/* SEKTION 3: WISSEN */}
          {showKnowledgeSection && (
            <KnowledgeView
              activeProject={activeProject}
              allProjects={allProjects}
              themeColors={themeColors}
              searchQuery={searchQuery}
              highlightedItemId={highlightedItemId}
              userApiKey={userApiKey}
              onAddKnowledge={onAddKnowledge}
              onUpdateKnowledge={onUpdateKnowledge}
              onDeleteKnowledge={onDeleteKnowledge}
              onRestoreKnowledge={onRestoreKnowledge}
              onUploadKnowledgeAttachment={onUploadKnowledgeAttachment}
              onPreviewAttachment={onPreviewAttachment}
              onConfirmRedDot={onConfirmRedDot}
              onMoveKnowledge={onMoveKnowledge}
              onSetActiveAudioGuideExp={setActiveAudioGuideExp}
              onOpenSettings={() => onOpenAddonsBackoffice('ai')}
              onAskAi={(prompt) => {
                navigator.clipboard?.writeText(prompt);
                onNotify('In Zwischenablage kopiert & Deep Research geöffnet.');
                onOpenDeepResearchModal?.();
              }}
              onNotify={onNotify}
              onRegisterUndo={handleRegisterUndo}
              onConfigMissing={(msg) => showConfigNotice(msg, 'Zentrale', 'ai')}
            />
          )}

          {/* SEKTION 5: WERKZEUGE / EXTRAS */}
          {showExtrasSection && (
            <ExtrasView
              activeProject={activeProject}
              activePlugins={activePlugins}
              gastroCartBridgeEnabled={prefs.gastroCartBridgeEnabled !== false}
              smartHomeEnabled={prefs.smartHomeEnabled === true}
              smartHomeSwitches={smartHomeSwitches}
              haWebhookUrl={haWebhookUrl}
              onTriggerSmartHomeSwitch={onTriggerSmartHomeSwitch}
              onUpdateProjectMeta={onUpdateProjectMeta}
              onAddCartItems={onAddCartItems}
              onRecordEventSale={onRecordEventSale}
              onNotify={onNotify}
            />
          )}

          {/* SEKTION: BELEG-SCAN */}
          {showReceiptSection && (
            <ReceiptScanView
              activeProject={activeProject}
              allProjects={allProjects.length > 0 ? allProjects : domainProjects}
              themeColors={themeColors}
              userApiKey={userApiKey}
              receiptForemanEnabled={prefs.receiptForemanEnabled !== false}
              generalVisionEnabled={prefs.generalVisionEnabled !== false}
              onReconcileReceiptWithCart={
                onReconcileReceiptWithCart ||
                ((projectId, storeName, purchaseDate, totalAmount, items) => {
                  onAddCartItems(
                    projectId,
                    items.map((it) => ({
                      title: it.title,
                      quantity: it.quantity,
                      price: it.price,
                      reason: `Aus Kassenbon ${storeName}`
                    }))
                  );
                })
              }
              onReconcileCartItems={onReconcileCartItems}
              onAddKnowledge={onAddKnowledge}
              onAddTask={onAddTask}
              onAddCartItems={onAddCartItems}
              onOpenSettings={(sec) => onOpenAddonsBackoffice(sec || 'ai')}
              onNotify={onNotify}
            />
          )}

          {/* SEKTION: DEEP RESEARCH */}
          {showResearchSection && (
            <DeepResearchView
              activeProject={activeProject}
              allProjects={allProjects.length > 0 ? allProjects : domainProjects}
              themeColors={themeColors}
              userApiKey={userApiKey}
              murmurAutopilotEnabled={prefs.murmurAutopilotEnabled !== false}
              onParkForemanProposal={onParkForemanProposal}
              onSaveDossierToProject={onSaveDossierToProject}
              onAddTask={onAddTask}
              onAddKnowledge={onAddKnowledge}
              onOpenSettings={(sec) => onOpenAddonsBackoffice(sec || 'ai')}
              onNotify={onNotify}
            />
          )}
        </div>
      )}

      {/* FREIHÄNDIGER VORLESEMODUS (StepByStepAudioGuide Overlay) */}
      {activeAudioGuideExp && (
        <StepByStepAudioGuide
          explanation={activeAudioGuideExp}
          accentColor={themeColors.primary}
          onClose={() => setActiveAudioGuideExp(null)}
        />
      )}
    </div>
  );
};
