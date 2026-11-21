import React, { useMemo, useRef, useState } from 'react';
import {
  Crosshair
} from 'lucide-react';
import {
  Attachment,
  CartItem,
  CustomMeta,
  DomainType,
  EventSalesLog,
  KnowledgeKind,
  PriorityType,
  Project,
  ProjectTabId,
  TaskItem
} from '../types';
import { BRAND_CONFIG } from '../config/brandConfig';
import { StepByStepAudioGuide } from '../components/StepByStepAudioGuide';
import { PLUGIN_REGISTRY } from '../plugins/registry';
import {
  BanditUserPreferences,
  loadUserPrefs,
  saveUserPrefs
} from '../services/aiRouter';
import {
  NavigationDrawer,
  FrontHeader,
  TasksView,
  CartView,
  KnowledgeView,
  ExtrasView
} from './front';

interface FrontWorkspaceProps {
  activeDomain: DomainType;
  allProjects?: Project[];
  domainProjects: Project[];
  activeProject?: Project;
  activeTab: ProjectTabId;
  highlightedItemId: string | null;
  onSwitchDomain: (d: DomainType) => void;
  onSelectProject: (id: string) => void;
  onChangeTab: (tab: ProjectTabId) => void;
  onOpenNewProjectModal: () => void;
  onUploadProjectLogo: (projectId: string, file: File) => void;
  onResetProjectLogo: (projectId: string) => void;
  onOpenDeepResearchModal?: () => void;
  onConfirmRedDot: (
    projectId: string,
    section: 'tasks' | 'explanations' | 'infos' | 'cart' | 'knowledge',
    itemId: string
  ) => void;
  onResetChecklist?: (projectId: string) => void;
  onResetChecklistForDeployment?: (projectId: string) => void;
  onToggleTask: (projectId: string, taskId: string) => void;
  onAddTask: (
    projectId: string,
    title: string,
    priority?: PriorityType,
    estimatedMinutes?: number
  ) => void;
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
  onUploadKnowledgeAttachment?: (
    projectId: string,
    itemId: string,
    file: File
  ) => void;
  onAddExplanation: (projectId: string, title: string, steps: string) => void;
  onUpdateExplanation: (projectId: string, expId: string, title: string, steps: string) => void;
  onAddInfo: (projectId: string, title: string, content: string) => void;
  onUploadInfoAttachment: (projectId: string, infoId: string, file: File) => void;
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
  onOpenAddonsBackoffice: () => void;
  onNotify: (msg: string) => void;
}

export const FrontWorkspace: React.FC<FrontWorkspaceProps> = ({
  activeDomain,
  allProjects = [],
  domainProjects,
  activeProject,
  activeTab,
  highlightedItemId,
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
  onAddTask,
  onDeleteTask,
  onUpdateTask,
  onMoveTask,
  onSendTaskToCart,
  onAddKnowledge,
  onUpdateKnowledge,
  onUploadKnowledgeAttachment,
  onAddExplanation,
  onUpdateExplanation,
  onAddInfo,
  onUploadInfoAttachment,
  onPreviewAttachment,
  onAddCartItems,
  onToggleCartItem,
  onDeleteCartItem,
  onUpdateCartItem,
  onMoveCartItem,
  onMoveKnowledge,
  onUpdateProjectMeta,
  onRecordEventSale,
  onOpenAddonsBackoffice,
  onNotify
}) => {
  const [prefs, setPrefs] = useState<BanditUserPreferences>(loadUserPrefs);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeAudioGuideExp, setActiveAudioGuideExp] = useState<any | null>(null);
  const [viewAllSections, setViewAllSections] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const drawerDragXRef = useRef<number>(0);
  const [drawerDragX, setDrawerDragX] = useState<number>(0);

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
      // Edge-pull: clamp to drawer width
      const drag = Math.min(deltaX, window.innerWidth * 0.85);
      drawerDragXRef.current = drag;
      setDrawerDragX(drag);
    } else if (drawerOpen && deltaX < 0) {
      // Swipe-away: clamp to negative drawer width
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
    const next = { ...prefs, ...patch };
    setPrefs(next);
    saveUserPrefs(next);
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
    return (activeDomain === 'privat' || activeDomain === 'private')
      ? BRAND_CONFIG.domainColors.private
      : BRAND_CONFIG.domainColors.business;
  }, [activeDomain, activeProject]);

  const isPrivDomain = (d?: string) => d === 'privat' || d === 'private';
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

  const selectProjectAndSection = (proj: Project, tab: ProjectTabId | 'ALL') => {
    if (proj.domain !== activeDomain) onSwitchDomain(proj.domain);
    onSelectProject(proj.id);
    if (tab === 'ALL') setViewAllSections(true);
    else {
      setViewAllSections(false);
      onChangeTab(tab);
    }
    setDrawerOpen(false);
  };

  const activeTabs = activeProject?.enabledTabs || ['tasks', 'cart', 'knowledge', 'extras'];
  const showTasksSection =
    (viewAllSections || activeTab === 'tasks') && isTabEnabled(activeProject, 'tasks');
  const showCartSection =
    (viewAllSections || activeTab === 'cart') && isTabEnabled(activeProject, 'cart');
  const showKnowledgeSection =
    (viewAllSections ||
      activeTab === 'knowledge' ||
      activeTab === 'explanations' ||
      activeTab === 'infos') &&
    isTabEnabled(activeProject, 'knowledge');
  const showExtrasSection =
    (!viewAllSections && activeTab === 'extras') && isTabEnabled(activeProject, 'extras');

  const currentSectionLabel = viewAllSections
    ? 'Gesamtübersicht'
    : activeTab === 'tasks'
      ? 'Tasks'
      : activeTab === 'cart'
        ? 'Einkaufswagen'
        : activeTab === 'knowledge' || activeTab === 'explanations' || activeTab === 'infos'
          ? 'Wissen'
          : 'Werkzeuge';

  return (
    <div
      className="relative min-h-[75vh] space-y-3.5 pb-32"
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
      {/* Organische Ambient-Aura im Hintergrund */}
      {prefs.organicMotion && (
        <div
          className="pointer-events-none fixed top-6 left-1/2 -translate-x-1/2 w-96 h-40 rounded-full blur-3xl opacity-20 transition-all duration-700"
          style={{ backgroundColor: themeColors.primary }}
        />
      )}

      {/* ADHS-FUNKTION: "WO WAR ICH GERADE?"-ANKER (Ruhige Fläche) */}
      {prefs.adhdMasterEnabled &&
        prefs.adhdFocusAnchor &&
        prefs.activeFocusTaskTitle && (
          <div
            className="p-4 rounded-3xl border flex items-center justify-between gap-3 shadow-xl transition-all duration-300"
            style={{
              backgroundColor: '#1C2026',
              borderColor: `${themeColors.highlight}55`
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
                <div className="text-xs font-extrabold uppercase tracking-wider text-[#9CA3AF]">
                  Aktiver Fokus-Anker (Gerade dran)
                </div>
                <div className="text-sm font-semibold text-white truncate">
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
              className="min-h-[44px] px-3.5 rounded-xl text-xs font-semibold bg-[#242930] hover:bg-[#2A3038] text-[#9CA3AF] hover:text-white shrink-0 border border-white/5 active:scale-95 transition"
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
        onSelectProjectAndSection={selectProjectAndSection}
        onClose={() => setDrawerOpen(false)}
        onOpenNewProjectModal={onOpenNewProjectModal}
        onOpenDeepResearchModal={onOpenDeepResearchModal}
        onOpenAddonsBackoffice={onOpenAddonsBackoffice}
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
              onOpenSettings={onOpenAddonsBackoffice}
              onNotify={onNotify}
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
              onOpenSettings={onOpenAddonsBackoffice}
              onNotify={onNotify}
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
              onAddKnowledge={onAddKnowledge}
              onUpdateKnowledge={onUpdateKnowledge}
              onUploadKnowledgeAttachment={onUploadKnowledgeAttachment}
              onAddExplanation={onAddExplanation}
              onUpdateExplanation={onUpdateExplanation}
              onAddInfo={onAddInfo}
              onUploadInfoAttachment={onUploadInfoAttachment}
              onPreviewAttachment={onPreviewAttachment}
              onConfirmRedDot={onConfirmRedDot}
              onMoveKnowledge={onMoveKnowledge}
              onSetActiveAudioGuideExp={setActiveAudioGuideExp}
              onOpenSettings={onOpenAddonsBackoffice}
              onAskAi={(prompt) => {
                navigator.clipboard?.writeText(prompt);
                onNotify('In Zwischenablage kopiert & Deep Research geöffnet.');
                onOpenDeepResearchModal?.();
              }}
              onNotify={onNotify}
            />
          )}

          {/* SEKTION 5: WERKZEUGE / EXTRAS */}
          {showExtrasSection && (
            <ExtrasView
              activeProject={activeProject}
              activePlugins={activePlugins}
              onUpdateProjectMeta={onUpdateProjectMeta}
              onAddCartItems={onAddCartItems}
              onRecordEventSale={onRecordEventSale}
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
