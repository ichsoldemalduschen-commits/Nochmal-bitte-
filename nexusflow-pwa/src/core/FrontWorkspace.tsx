import React, { useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Edit3,
  FileText,
  FolderPlus,
  Image as ImageIcon,
  LayoutGrid,
  Menu,
  Plus,
  Puzzle,
  RotateCcw,
  Search,
  Settings,
  ShoppingCart,
  Trash2,
  Upload,
  X
} from 'lucide-react';
import {
  Attachment,
  CartItem,
  CustomMeta,
  DomainType,
  EventSalesLog,
  KnowledgeItem,
  KnowledgeKind,
  PriorityType,
  Project,
  ProjectTabId,
  THEME
} from '../types';
import { BRAND_CONFIG } from '../config/brandConfig';
import { ProjectAvatar } from '../components/RaccoonAvatar';
import { ProcurementCheckPanel } from '../plugins/procurementCheck';
import { PLUGIN_REGISTRY } from '../plugins/registry';
import {
  BanditUserPreferences,
  loadUserPrefs,
  saveUserPrefs,
  speakText,
  triggerHapticFeedback
} from '../services/aiRouter';

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
  onConfirmRedDot: (
    projectId: string,
    section: 'tasks' | 'explanations' | 'infos' | 'cart',
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
  onResetProjectLogo,
  onConfirmRedDot,
  onResetChecklist,
  onResetChecklistForDeployment,
  onToggleTask,
  onAddTask,
  onDeleteTask,
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
  onUpdateProjectMeta,
  onRecordEventSale,
  onOpenAddonsBackoffice,
  onNotify
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewAllSections, setViewAllSections] = useState(true);
  const [singleFocusActive, setSingleFocusActive] = useState(false);
  const [globalCartMode, setGlobalCartMode] = useState(true);
  const [cartProjectFilter, setCartProjectFilter] = useState<string>('ALL');
  const [cartCategoryFilter, setCartCategoryFilter] = useState<'ALL' | 'open' | 'completed'>('ALL');
  const [selectedAssemblyGroup, setSelectedAssemblyGroup] = useState<string>('ALL');
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newExpTitle, setNewExpTitle] = useState('');
  const [newExpSteps, setNewExpSteps] = useState('');
  const [editingExpId, setEditingExpId] = useState<string | null>(null);
  const [editExpTitle, setEditExpTitle] = useState('');
  const [editExpSteps, setEditExpSteps] = useState('');
  const [newInfoTitle, setNewInfoTitle] = useState('');
  const [newInfoContent, setNewInfoContent] = useState('');
  const [newTaskGroup, setNewTaskGroup] = useState('');

  const [isAddingCart, setIsAddingCart] = useState(false);
  const [newCartTitle, setNewCartTitle] = useState('');
  const [newCartQty, setNewCartQty] = useState('1x');
  const [newCartPrice, setNewCartPrice] = useState('');

  const [openExplanations, setOpenExplanations] = useState<Record<string, boolean>>({});
  const [openInfos, setOpenInfos] = useState<Record<string, boolean>>({});
  // Unified Knowledge State (Abläufe + Infos)
  const [knowledgeFilter, setKnowledgeFilter] = useState<'ALL' | 'explanation' | 'info'>('ALL');
  const [openKnowledge, setOpenKnowledge] = useState<Record<string, boolean>>({});
  const [speakingKnowledgeId, setSpeakingKnowledgeId] = useState<string | null>(null);
  const [isAddingKnowledge, setIsAddingKnowledge] = useState(false);
  const [newKnowledgeKind, setNewKnowledgeKind] = useState<KnowledgeKind>('explanation');
  const [newKnowledgeTitle, setNewKnowledgeTitle] = useState('');
  const [newKnowledgeContent, setNewKnowledgeContent] = useState('');
  const [editingKnowledgeId, setEditingKnowledgeId] = useState<string | null>(null);
  const [editKnowledgeTitle, setEditKnowledgeTitle] = useState('');
  const [editKnowledgeContent, setEditKnowledgeContent] = useState('');

  // Legacy compatibility states
  const [openProcurements, setOpenProcurements] = useState<Record<string, boolean>>({});

  // Touch-Swipe-Erkennung für den linken Drawer
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

  const themeColors = useMemo(() => {
    if (activeDomain === 'privat') {
      return { primary: '#4F46E5', highlight: '#818CF8', label: 'PRIVAT' };
      const customAccent =
        (activeProject?.customMeta?.customAccentColor as string | undefined) ||
        activeProject?.accentColor;
      if (customAccent) {
        return { primary: customAccent, highlight: customAccent, label: activeDomain.toUpperCase() };
      }
      if (activeProject?.id === 'proj-baeckerei') {
        return { primary: '#D97706', highlight: '#F59E0B', label: 'ARBEIT / BAUSTELLE' };
        const brandProj = activeProject ? BRAND_CONFIG.projects[activeProject.id] : null;
        if (brandProj) {
          return {
            primary: brandProj.accentColor,
            highlight: brandProj.highlightColor,
            label: brandProj.domainLabel
          };
        }
        return { primary: '#0A9396', highlight: '#14B8A6', label: 'ARBEIT / BETRIEB' };
        return BRAND_CONFIG.domainColors[activeDomain] || BRAND_CONFIG.domainColors.arbeit;
      }, [activeDomain, activeProject?.id]);

  const projectsSource = allProjects.length > 0 ? allProjects : domainProjects;
  const workProjects = projectsSource.filter((p) => !p.archived && p.domain === 'arbeit');
  const privateProjects = projectsSource.filter((p) => !p.archived && p.domain === 'privat');

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

  const projectKnowledge: KnowledgeItem[] = useMemo(() => {
    if (!activeProject) return [];
    if (Array.isArray(activeProject.knowledge) && activeProject.knowledge.length > 0) {
      return activeProject.knowledge;
    }
    return [
      ...(activeProject.explanations || []).map((e) => ({
        id: e.id,
        kind: 'explanation' as const,
        title: e.title,
        content: e.stepsText || '',
        attachments: [],
        lastModified: e.lastModified,
        changeReason: e.changeReason,
        source: e.source,
        aiTouched: e.aiTouched,
        customMeta: e.customMeta
      })),
      ...(activeProject.infos || []).map((i) => ({
        id: i.id,
        kind: 'info' as const,
        title: i.title,
        content: i.content || '',
        attachments: i.attachments || [],
        lastModified: i.lastModified,
        changeReason: i.changeReason,
        source: i.source,
        aiTouched: i.aiTouched,
        customMeta: i.customMeta
      }))
    ];
  }, [activeProject]);

  const filteredKnowledge = useMemo(() => {
    return projectKnowledge.filter((k) => {
      if (knowledgeFilter !== 'ALL' && k.kind !== knowledgeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return k.title.toLowerCase().includes(q) || k.content.toLowerCase().includes(q);
      }
      return true;
    });
  }, [projectKnowledge, knowledgeFilter, searchQuery]);

  const handleSpeakKnowledge = (item: KnowledgeItem) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      if (speakingKnowledgeId === item.id) {
        window.speechSynthesis.cancel();
        setSpeakingKnowledgeId(null);
        return;
      }
      window.speechSynthesis.cancel();
    }
    setSpeakingKnowledgeId(item.id);
    triggerHapticFeedback(12);
    speakText(`${item.title}.\n${item.content}`, () => {
      setSpeakingKnowledgeId(null);
    });
  };

  const sortedTasks = useMemo(() => {
    if (!activeProject) return [];
    return [...activeProject.tasks]
      .filter(
        (t) =>
          !searchQuery.trim() ||
          t.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => Number(a.completed) - Number(b.completed));
  }, [activeProject, searchQuery]);

  const sortedCart = useMemo(() => {
    if (!activeProject) return [];
    return [...activeProject.cart]
      .filter(
        (c) =>
          !searchQuery.trim() ||
          c.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    if (prefs.adhdMasterEnabled && prefs.adhdSingleTaskMode && singleFocusActive) {
      const nextOpen = filtered.find((t) => !t.completed);
      return nextOpen ? [nextOpen] : filtered.slice(0, 1);
    }
    return filtered;
  }, [activeProject, searchQuery, selectedAssemblyGroup, prefs, singleFocusActive]);

  const displayedCart = useMemo(() => {
    let items: Array<CartItem & { originProjectId: string; originProjectName: string }>;

    if (globalCartMode && allProjects.length > 0) {
      items = allProjects
        .filter((p) => !p.archived)
        .flatMap((p) =>
          p.cart.map((c) => ({
            ...c,
            originProjectId: p.id,
            originProjectName: p.name
          }))
        );
    } else if (activeProject) {
      items = [...activeProject.cart].map((c) => ({
        ...c,
        originProjectId: activeProject.id,
        originProjectName: activeProject.name
      }));
    } else {
      items = [];
    }

    return items
      .filter((c) => {
        if (cartProjectFilter !== 'ALL' && c.originProjectId !== cartProjectFilter) {
          return false;
        }
        if (cartCategoryFilter === 'open' && c.completed) return false;
        if (cartCategoryFilter === 'completed' && !c.completed) return false;
        if (searchQuery.trim() && !c.title.toLowerCase().includes(searchQuery.toLowerCase())) {
          return false;
        }
        return true;
      })
      .sort((a, b) => Number(a.completed) - Number(b.completed));
  }, [activeProject, searchQuery]);
}, [activeProject, allProjects, globalCartMode, cartProjectFilter, cartCategoryFilter, searchQuery]);

const handleResetTasks = (projectId: string) => {
  if (onResetChecklist) onResetChecklist(projectId);
  else if (onResetChecklistForDeployment) onResetChecklistForDeployment(projectId);
};

const handleCopyTaskToCart = (projectId: string, title: string) => {
  if (onSendTaskToCart) onSendTaskToCart(projectId, title);
  else {
    onAddCartItems(projectId, [
      { title, quantity: '1x', price: '', reason: 'Aus Tasks übernommen' }
    ]);
  }
};

const selectProjectAndSection = (
  proj: Project,
  tab: ProjectTabId | 'ALL'
) => {
  if (proj.domain !== activeDomain) {
    onSwitchDomain(proj.domain);
  }
  onSelectProject(proj.id);
  if (tab === 'ALL') {
    setViewAllSections(true);
  } else {
    setViewAllSections(false);
    onChangeTab(tab);
  }
  setDrawerOpen(false);
};

const showTasksSection = viewAllSections || activeTab === 'tasks';
const showCartSection = viewAllSections || activeTab === 'cart';
const showExplanationsSection = viewAllSections || activeTab === 'explanations';
const showInfosSection = viewAllSections || activeTab === 'infos';
const showExtrasSection = !viewAllSections && activeTab === 'extras';
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
      : activeTab === 'explanations'
        ? 'Abläufe'
        : activeTab === 'infos'
          ? 'Infos & Dateien'
          : 'Extras';
    ?'Tasks'
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
          className="fixed top-0 left-0 h-full w-[30px] z-40 pointer-events-none"
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

      {/* LINKER SWIPE-DRAWER (Mit sanfter Feder-Physik & visueller Ruhe) */}
      <div
        className="fixed top-0 left-0 h-full w-[30px] z-40 pointer-events-none"
        aria-hidden="true"
      />
    )}
    {/* LINKER SWIPE-DRAWER (Erscheint beim Reinwischen von links oder Tipp auf das Menü-Icon) */}
    {drawerOpen && (
      <div className="fixed inset-0 z-50 flex">
        <div
          className="w-[82vw] max-w-xs h-full border-r border-white/15 flex flex-col justify-between overflow-y-auto shadow-2xl"
          style={{ backgroundColor: THEME.bgCard }}
        >
          <div className="p-4 space-y-5">
            {/* Drawer-Kopf */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <div className="text-xs font-extrabold uppercase tracking-wider text-white">
                  Navigation &amp; Bereiche
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
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#9CA3AF]">
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

                {/* LINKER SWIPE-DRAWER (Mit sanfter Feder-Physik & visueller Ruhe) */}
                <div
                  className={`fixed inset-0 z-50 flex transition-opacity duration-300 ${drawerOpen ? 'opacity-100 pointer-events-auto' : drawerDragX > 0 ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                    }`}
                  style={drawerDragX > 0 ? { opacity: drawerDragX / (window.innerWidth * 0.85) } : undefined}
                >
                  <div
                    className={`w-[85vw] max-w-sm h-full border-r border-white/10 flex flex-col justify-between overflow-y-auto shadow-2xl ${drawerDragX === 0 ? 'transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]' : ''
                      }`}
                    style={{
                      backgroundColor: '#1C2026',
                      transform: drawerOpen
                        ? drawerDragX < 0
                          ? `translateX(${drawerDragX}px)`
                          : 'translateX(0)'
                        : drawerDragX > 0
                          ? `translateX(calc(-100% + ${drawerDragX}px))`
                          : 'translateX(-100%)'
                    }}
                  >
                    <div className="p-5 space-y-6">
                      <div className="flex items-center justify-between border-b border-white/10 pb-4">
                        <div>
                          <div className="text-sm font-extrabold uppercase tracking-wider text-white">
                            BANDIT.OS Navigation
                          </div>
                          <div className="text-xs text-[#9CA3AF]">
                            Projekt &amp; Arbeitsbereich wählen
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDrawerOpen(false)}
                          className="w-11 h-11 rounded-2xl text-[#9CA3AF] hover:text-white bg-[#242930] flex items-center justify-center border border-white/5 active:scale-95 transition"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      {/* ARBEIT */}
                      <div className="space-y-3">
                        <div className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF] px-1">
                          ARBEIT
                        </div>
                        {workProjects.map((proj) => {
                          const isActive = activeProject?.id === proj.id;
                          const pColor =
                            (proj.customMeta?.customAccentColor as string) ||
                            proj.accentColor ||
                            BRAND_CONFIG.projects[proj.id]?.accentColor ||
                            BRAND_CONFIG.domainColors.arbeit.primary;
                          return (
                  <div
                    key={proj.id}
                    className="rounded-2xl border overflow-hidden transition-all shadow-sm"
                    style={{
                      backgroundColor: '#242930',
                      borderColor: isActive ? `${pColor}88` : 'rgba(255,255,255,0.06)'
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => selectProjectAndSection(proj, 'ALL')}
                      className="w-full min-h-[50px] p-3.5 flex items-center justify-between text-left active:bg-white/5 transition"
                      style={isActive ? { backgroundColor: `${pColor}22` } : {}}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <ProjectAvatar project={proj} sizeClass="w-7 h-7" />
                        <span className="text-sm font-bold text-white truncate">
                          {proj.name}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#9CA3AF] shrink-0" />
                    </button>

                    {isActive && (
                      <div className="p-2.5 pt-1.5 grid grid-cols-2 gap-2 border-t border-white/5 bg-[#1C2026]/70">
                        <button
                          type="button"
                          onClick={() => selectProjectAndSection(proj, 'ALL')}
                          className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between ${
                            viewAllSections
                              ? 'text-white'
                              : 'bg-[#242930] text-[#9CA3AF] hover:text-white'
                          }`}
                          style={viewAllSections ? { backgroundColor: pColor } : {}}
                        >
                          <span>Gesamt</span>
                          <LayoutGrid className="w-3.5 h-3.5" />
                        </button>
                        {isTabEnabled(proj, 'tasks') && (
                          <button
                            type="button"
                            onClick={() => selectProjectAndSection(proj, 'tasks')}
                            className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between ${
                              !viewAllSections && activeTab === 'tasks'
                                ? 'text-white'
                                : 'bg-[#242930] text-[#9CA3AF] hover:text-white'
                            }`}
                            style={
                              !viewAllSections && activeTab === 'tasks'
                                ? { backgroundColor: pColor }
                                : {}
                            }
                          >
                            <span>Tasks</span>
                            <span className="font-mono text-xs px-1.5 py-0.5 rounded-md bg-black/30">
                              {proj.tasks.filter((t) => !t.completed).length}
                            </span>
                          </button>
                        )}
                        {isTabEnabled(proj, 'cart') && (
                          <button
                            type="button"
                            onClick={() => selectProjectAndSection(proj, 'cart')}
                            className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between ${
                              !viewAllSections && activeTab === 'cart'
                                ? 'text-white'
                                : 'bg-[#242930] text-[#9CA3AF] hover:text-white'
                            }`}
                            style={
                              !viewAllSections && activeTab === 'cart'
                                ? { backgroundColor: pColor }
                                : {}
                            }
                          >
                            <span>Einkauf</span>
                            <span className="font-mono text-xs px-1.5 py-0.5 rounded-md bg-black/30">
                              {proj.cart.filter((c) => !c.completed).length}
                            </span>
                          </button>
                        )}
                        {isTabEnabled(proj, 'knowledge') && (
                          <button
                            type="button"
                            onClick={() => selectProjectAndSection(proj, 'knowledge')}
                            className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between ${
                              !viewAllSections &&
                              (activeTab === 'knowledge' ||
                                activeTab === 'explanations' ||
                                activeTab === 'infos')
                                ? 'text-white'
                                : 'bg-[#242930] text-[#9CA3AF] hover:text-white'
                            }`}
                            style={
                              !viewAllSections &&
                              (activeTab === 'knowledge' ||
                                activeTab === 'explanations' ||
                                activeTab === 'infos')
                                ? { backgroundColor: pColor }
                                : {}
                            }
                          >
                            <span>Wissen</span>
                            <span className="font-mono text-xs px-1.5 py-0.5 rounded-md bg-black/30">
                              {(proj.knowledge || []).length}
                            </span>
                          </button>
                        )}
                        {isTabEnabled(proj, 'extras') && (
                          <button
                            type="button"
                            onClick={() => selectProjectAndSection(proj, 'extras')}
                            className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between ${
                              !viewAllSections && activeTab === 'extras'
                                ? 'text-white'
                                : 'bg-[#242930] text-[#9CA3AF] hover:text-white'
                            }`}
                            style={
                              !viewAllSections && activeTab === 'extras'
                                ? { backgroundColor: pColor }
                                : {}
                            }
                          >
                            <span>Werkzeuge</span>
                            <Puzzle className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-[10px] text-[#9CA3AF]">
                    Projekt oder Einzelbereich wählen
                );
              })}
            </div>

            {/* PRIVAT */ }
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF] px-1">
                PRIVAT
              </div>
              {privateProjects.map((proj) => {
                const isActive = activeProject?.id === proj.id;
                const pColor =
                  (proj.customMeta?.customAccentColor as string) ||
                  proj.accentColor ||
                  BRAND_CONFIG.projects[proj.id]?.accentColor ||
                  BRAND_CONFIG.domainColors.privat.primary;
                return (
                  <div
                    key={proj.id}
                    className="rounded-2xl border overflow-hidden shadow-sm"
                    style={{
                      backgroundColor: '#242930',
                      borderColor: isActive ? `${pColor}88` : 'rgba(255,255,255,0.06)'
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => selectProjectAndSection(proj, 'ALL')}
                      className="w-full min-h-[50px] p-3.5 flex items-center justify-between text-left active:bg-white/5 transition"
                      style={isActive ? { backgroundColor: `${pColor}22` } : {}}
                    >
                      <span className="text-sm font-bold text-white truncate">
                        {proj.name}
                      </span>
                      <span className="text-xs font-mono text-[#9CA3AF] px-2 py-0.5 rounded-md bg-black/30">
                        {proj.tasks.filter((t) => !t.completed).length} offen
                      </span>
                    </button>

                    {isActive && (
                      <div className="p-2.5 pt-1.5 grid grid-cols-2 gap-2 border-t border-white/5 bg-[#1C2026]/70">
                        <button
                          type="button"
                          onClick={() => selectProjectAndSection(proj, 'ALL')}
                          className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold text-left flex items-center justify-between ${
                            viewAllSections ? 'text-white' : 'bg-[#242930] text-[#9CA3AF]'
                          }`}
                          style={viewAllSections ? { backgroundColor: pColor } : {}}
                        >
                          <span>Gesamt</span>
                          <LayoutGrid className="w-3.5 h-3.5" />
                        </button>
                        {isTabEnabled(proj, 'tasks') && (
                          <button
                            type="button"
                            onClick={() => selectProjectAndSection(proj, 'tasks')}
                            className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold text-left flex items-center justify-between ${
                              !viewAllSections && activeTab === 'tasks'
                                ? 'text-white'
                                : 'bg-[#242930] text-[#9CA3AF]'
                            }`}
                            style={
                              !viewAllSections && activeTab === 'tasks'
                                ? { backgroundColor: pColor }
                                : {}
                            }
                          >
                            <span>Tasks</span>
                            <span className="font-mono text-xs px-1.5 py-0.5 rounded-md bg-black/30">
                              {proj.tasks.filter((t) => !t.completed).length}
                            </span>
                          </button>
                        )}
                        {isTabEnabled(proj, 'cart') && (
                          <button
                            type="button"
                            onClick={() => selectProjectAndSection(proj, 'cart')}
                            className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold text-left flex items-center justify-between ${
                              !viewAllSections && activeTab === 'cart'
                                ? 'text-white'
                                : 'bg-[#242930] text-[#9CA3AF]'
                            }`}
                            style={
                              !viewAllSections && activeTab === 'cart'
                                ? { backgroundColor: pColor }
                                : {}
                            }
                          >
                            <span>Einkauf</span>
                            <span className="font-mono text-xs px-1.5 py-0.5 rounded-md bg-black/30">
                              {proj.cart.filter((c) => !c.completed).length}
                            </span>
                          </button>
                        )}
                        {isTabEnabled(proj, 'knowledge') && (
                          <button
                            type="button"
                            onClick={() => selectProjectAndSection(proj, 'knowledge')}
                            className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold text-left flex items-center justify-between ${
                              !viewAllSections &&
                              (activeTab === 'knowledge' ||
                                activeTab === 'explanations' ||
                                activeTab === 'infos')
                                ? 'text-white'
                                : 'bg-[#242930] text-[#9CA3AF]'
                            }`}
                            style={
                              !viewAllSections &&
                              (activeTab === 'knowledge' ||
                                activeTab === 'explanations' ||
                                activeTab === 'infos')
                                ? { backgroundColor: pColor }
                                : {}
                            }
                          >
                            <span>Wissen</span>
                            <span className="font-mono text-xs px-1.5 py-0.5 rounded-md bg-black/30">
                              {(proj.knowledge || []).length}
                            </span>
                          </button>
                        )}
                        {isTabEnabled(proj, 'extras') && (
                          <button
                            type="button"
                            onClick={() => selectProjectAndSection(proj, 'extras')}
                            className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between ${
                              !viewAllSections && activeTab === 'extras'
                                ? 'text-white'
                                : 'bg-[#242930] text-[#9CA3AF] hover:text-white'
                            }`}
                            style={
                              !viewAllSections && activeTab === 'extras'
                                ? { backgroundColor: pColor }
                                : {}
                            }
                          >
                            <span>Werkzeuge</span>
                            <Puzzle className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-5 border-t border-white/10 space-y-2.5 bg-[#181A1E]">
            <button
              type="button"
              onClick={() => {
                setDrawerOpen(false);
                onOpenNewProjectModal();
              }}
              className="w-full min-h-[48px] py-2.5 px-4 rounded-2xl text-xs font-semibold bg-[#242930] text-white border border-white/10 flex items-center gap-2.5 hover:bg-[#2A3038] active:scale-95 transition"
            >
              <FolderPlus className="w-4 h-4 text-[#14B8A6]" />
              <span>Neues Projekt anlegen</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setDrawerOpen(false);
                onOpenDeepResearchModal?.();
              }}
              className="w-full min-h-[48px] py-2.5 px-4 rounded-2xl text-xs font-semibold bg-[#242930] text-white border border-white/10 flex items-center gap-2.5 hover:bg-[#2A3038] active:scale-95 transition"
            >
              <Scale className="w-4 h-4 text-[#14B8A6]" />
              <span>Deep Research, Scanner &amp; Cloud</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setDrawerOpen(false);
                onOpenAddonsBackoffice();
              }}
              className="w-full min-h-[48px] py-2.5 px-4 rounded-2xl text-xs font-bold text-white flex items-center gap-2.5 shadow-lg active:scale-95 transition"
              style={{ backgroundColor: themeColors.primary }}
            >
              <Settings className="w-4 h-4" />
              <span>Einstellungen, ADHS &amp; System</span>
            </button>
          </div>
        </div>

        <div
          className="flex-1 bg-black/60 backdrop-blur-xs"
          onClick={() => setDrawerOpen(false)}
        />
      </div>

      {/* RUHIGE PROJEKT-KOPFZEILE */}
      {activeProject && (
        <div
          className="p-4 rounded-3xl border flex items-center justify-between gap-3 shadow-lg transition-colors duration-500"
          style={{
            backgroundColor: '#1C2026',
            borderColor: `${themeColors.primary}55`
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="w-11 h-11 rounded-2xl text-white shrink-0 flex items-center justify-center active:scale-95 transition shadow-sm"
              style={{ backgroundColor: themeColors.primary }}
              aria-label="Navigation öffnen"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="relative shrink-0">
              <ProjectAvatar project={activeProject} sizeClass="w-9 h-9" />
              <label
                title="Projekt-Logo ändern"
                className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full text-white flex items-center justify-center cursor-pointer border border-[#1C2026] shadow-sm"
                style={{ backgroundColor: themeColors.primary }}
              >
                <ImageIcon className="w-2.5 h-2.5" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onUploadProjectLogo(activeProject.id, f);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>

            <div className="min-w-0 cursor-pointer" onClick={() => setDrawerOpen(true)}>
              <h1 className="text-lg font-extrabold text-white truncate leading-tight">
                {activeProject.name}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setViewAllSections((v) => !v)}
              className="min-h-[44px] px-3.5 rounded-xl text-xs font-bold border border-white/5 text-white transition active:scale-95 shadow-sm"
              style={{
                backgroundColor: viewAllSections ? themeColors.primary : '#242930'
              }}
            >
              {viewAllSections ? 'Gesamt' : 'Einzeln'}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowSearch((s) => !s);
                if (showSearch) setSearchQuery('');
              }}
              className="w-11 h-11 rounded-xl bg-[#242930] text-[#9CA3AF] hover:text-white border border-white/5 flex items-center justify-center active:scale-95 transition"
              aria-label="Suche umschalten"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* SUCHE */}
      {showSearch && activeProject && (
        <div className="px-4 py-3 rounded-2xl border border-white/10 bg-[#1C2026] flex items-center gap-2.5 shadow-md">
          <Search className="w-4 h-4 text-[#9CA3AF] shrink-0" />
          <input
            type="text"
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`In ${activeProject.name} filtern...`}
            className="flex-1 bg-transparent text-sm text-white focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="min-h-[36px] min-w-[36px] flex items-center justify-center text-[#9CA3AF] hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* HAUPTARBEITSFELD */}
      {activeProject && (
        <div className="space-y-4">
          {/* ================================================================ */}
          {/* SEKTION 1: TASKS */}
          {/* ================================================================ */}
          {showTasksSection && (
            <section
              className="rounded-3xl border border-white/5 p-5 space-y-4 shadow-xl transition-all"
              style={{ backgroundColor: '#1C2026' }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <CheckSquare
                    className="w-5 h-5"
                    style={{ color: themeColors.highlight }}
                  />
                  <h3 className="text-base font-bold text-white tracking-wide">
                    Tasks
                  </h3>
                  <span className="text-xs font-semibold text-[#9CA3AF] px-2 py-0.5 rounded-full bg-[#242930]">
                    {activeProject.tasks.filter((t) => !t.completed).length} offen
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Schlanker "+" Button für progressive disclosure */}
                  <button
                    type="button"
                    onClick={() => setIsAddingTask((v) => !v)}
                    className={`min-h-[44px] min-w-[44px] px-3.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition active:scale-95 ${
                      isAddingTask
                        ? 'text-white border-white/30'
                        : 'bg-[#242930] hover:bg-[#2A3038] text-white border-white/5'
                    }`}
                    style={isAddingTask ? { backgroundColor: themeColors.primary } : {}}
                    aria-label="Aufgabe hinzufügen"
                    title="Aufgabe hinzufügen"
                  >
                    <Plus className="w-4 h-4 text-[#14B8A6]" />
                    <span className="hidden sm:inline">Aufgabe</span>
                  </button>

                  {/* ADHS-FUNKTION: 1-FOKUS-BLENDE */}
                  {prefs.adhdMasterEnabled && prefs.adhdSingleTaskMode && (
                    <button
                      type="button"
                      onClick={() => setSingleFocusActive((s) => !s)}
                      className={`min-h-[44px] px-3.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition active:scale-95 ${
                        singleFocusActive
                          ? 'text-white border-white/30'
                          : 'bg-[#242930] text-[#9CA3AF] border-white/5'
                      }`}
                      style={
                        singleFocusActive ? { backgroundColor: themeColors.primary } : {}
                      }
                      title="Blendet alle Punkte bis auf die nächste einzelne Aufgabe aus"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{singleFocusActive ? '1-Fokus Aktiv' : '1-Fokus'}</span>
                    </button>
                  )}

                  {/* Reset-Button: Kontextbezogen NUR wenn erledigte Tasks existieren */}
                  {activeProject.tasks.some((t) => t.completed) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (onResetChecklist) onResetChecklist(activeProject.id);
                        else if (onResetChecklistForDeployment)
                          onResetChecklistForDeployment(activeProject.id);
                      }}
                      className="min-h-[44px] px-3.5 rounded-xl bg-[#242930] text-xs font-semibold text-[#9CA3AF] hover:text-white border border-white/5 flex items-center gap-1.5 active:scale-95 transition"
                      title="Erledigte Aufgaben zurücksetzen"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset</span>
                    </button>
                  )}
                </div>
              </div>

              {/* PROGRESSIVE DISCLOSURE: Eingabeformular für Tasks (nur geöffnet bei Klick auf "+") */}
              {isAddingTask && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newTaskTitle.trim()) return;
                    const finalTitle = newTaskGroup.trim()
                      ? `[${newTaskGroup.trim()}] ${newTaskTitle.trim()}`
                      : newTaskTitle.trim();
                    onAddTask(activeProject.id, finalTitle, 'Mittel', 25);
                    setNewTaskTitle('');
                    setNewTaskGroup('');
                    setIsAddingTask(false);
                    onNotify('Aufgabe hinzugefügt.');
                  }}
                  className="p-4 rounded-2xl bg-[#242930] border border-white/10 space-y-3 shadow-inner"
                >
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      autoFocus
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder="Neue Aufgabe beschreiben..."
                      className="flex-1 min-h-[44px] px-3.5 py-2.5 rounded-xl text-sm bg-[#1C2026] text-white border border-white/10 placeholder-[#9CA3AF] focus:outline-none focus:border-white/20"
                    />
                    <input
                      type="text"
                      value={newTaskGroup}
                      onChange={(e) => setNewTaskGroup(e.target.value)}
                      placeholder="Baugruppe (optional)"
                      className="sm:w-44 min-h-[44px] px-3.5 py-2.5 rounded-xl text-sm bg-[#1C2026] text-white border border-white/10 placeholder-[#9CA3AF] focus:outline-none focus:border-white/20"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingTask(false);
                        setNewTaskTitle('');
                        setNewTaskGroup('');
                      }}
                      className="min-h-[44px] px-4 rounded-xl text-xs font-semibold text-[#9CA3AF] hover:text-white transition"
                    >
                      Abbrechen
                    </button>
                    <button
                      type="submit"
                      disabled={!newTaskTitle.trim()}
                      className="min-h-[44px] px-5 rounded-xl text-xs font-bold text-white shadow-md active:scale-95 transition disabled:opacity-40"
                      style={{ backgroundColor: themeColors.primary }}
                    >
                      Speichern
                    </button>
                  </div>
                </form>
              )}

                      {/* LINKER SWIPE-DRAWER (Mit sanfter Feder-Physik & visueller Ruhe) */}
                      <div
                        className={`fixed inset-0 z-50 flex transition-opacity duration-300 ${drawerOpen ? 'opacity-100 pointer-events-auto' : drawerDragX > 0 ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                          }`}
                        style={drawerDragX > 0 ? { opacity: drawerDragX / (window.innerWidth * 0.85) } : undefined}
                      >
                        <div
                          className={`w-[85vw] max-w-sm h-full border-r border-white/10 flex flex-col justify-between overflow-y-auto shadow-2xl ${drawerDragX === 0 ? 'transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]' : ''
                            }`}
                          style={{
                            backgroundColor: '#1C2026',
                            transform: drawerOpen
                              ? drawerDragX < 0
                                ? `translateX(${drawerDragX}px)`
                                : 'translateX(0)'
                              : drawerDragX > 0
                                ? `translateX(calc(-100% + ${drawerDragX}px))`
                                : 'translateX(-100%)'
                          }}
                        >
                          <div className="p-5 space-y-6">
                            <div className="flex items-center justify-between border-b border-white/10 pb-4">
                              <div>
                                <div className="text-sm font-extrabold uppercase tracking-wider text-white">
                                  BANDIT.OS Navigation
                                </div>
                                {workProjects.map((proj) => {
                                  const isActive = activeProject?.id === proj.id;
                                  const pColor = proj.id === 'proj-baeckerei' ? '#D97706' : '#0A9396';
                                  return (
                                    <div
                                      key={proj.id}
                                      className="rounded-xl border overflow-hidden"
                                      style={{
                                        backgroundColor: '#181A1B',
                                        borderColor: isActive ? pColor : 'rgba(255,255,255,0.08)'
                                      }}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => selectProjectAndSection(proj, 'ALL')}
                                        className="w-full p-2.5 flex items-center justify-between text-left"
                                        style={isActive ? { backgroundColor: `${pColor}22` } : {}}
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          <ProjectAvatar project={proj} sizeClass="w-6 h-6" />
                                          <span className="text-xs font-bold text-white truncate">
                                            {proj.name}
                                          </span>
                                        </div>
                                        <ChevronRight className="w-3.5 h-3.5 text-[#9CA3AF] shrink-0" />
                                      </button>

                                      {/* Unterkategorien im Raster */}
                                      {isActive && (
                                        <div className="p-2 pt-1 grid grid-cols-2 gap-1.5 border-t border-white/5">
                                          <button
                                            type="button"
                                            onClick={() => selectProjectAndSection(proj, 'ALL')}
                                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-between ${viewAllSections
                                              ? 'text-white'
                                              : 'bg-[#24292E] text-[#9CA3AF] hover:text-white'
                                              }`}
                                            style={viewAllSections ? { backgroundColor: pColor } : {}}
                                          >
                                            <span>Gesamt</span>
                                            <LayoutGrid className="w-3 h-3" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => selectProjectAndSection(proj, 'tasks')}
                                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-between ${!viewAllSections && activeTab === 'tasks'
                                              ? 'text-white'
                                              : 'bg-[#24292E] text-[#9CA3AF] hover:text-white'
                                              }`}
                                            style={
                                              !viewAllSections && activeTab === 'tasks'
                                                ? { backgroundColor: pColor }
                                                : {}
                                            }
                                          >
                                            <span>Tasks</span>
                                            <span className="font-mono text-[10px]">
                                              {proj.tasks.filter((t) => !t.completed).length}
                                            </span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => selectProjectAndSection(proj, 'cart')}
                                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-between ${!viewAllSections && activeTab === 'cart'
                                              ? 'text-white'
                                              : 'bg-[#24292E] text-[#9CA3AF] hover:text-white'
                                              }`}
                                            style={
                                              !viewAllSections && activeTab === 'cart'
                                                ? { backgroundColor: pColor }
                                                : {}
                                            }
                                          >
                                            <span>Einkauf</span>
                                            <span className="font-mono text-[10px]">
                                              {proj.cart.filter((c) => !c.completed).length}
                                            </span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => selectProjectAndSection(proj, 'explanations')}
                                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-between ${!viewAllSections && activeTab === 'explanations'
                                              ? 'text-white'
                                              : 'bg-[#24292E] text-[#9CA3AF] hover:text-white'
                                              }`}
                                            style={
                                              !viewAllSections && activeTab === 'explanations'
                                                ? { backgroundColor: pColor }
                                                : {}
                                            }
                                          >
                                            <span>Abläufe</span>
                                            <span className="font-mono text-[10px]">
                                              {proj.explanations.length}
                                            </span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => selectProjectAndSection(proj, 'infos')}
                                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-between ${!viewAllSections && activeTab === 'infos'
                                              ? 'text-white'
                                              : 'bg-[#24292E] text-[#9CA3AF] hover:text-white'
                                              }`}
                                            style={
                                              !viewAllSections && activeTab === 'infos'
                                                ? { backgroundColor: pColor }
                                                : {}
                                            }
                                          >
                                            <span>Infos</span>
                                            <span className="font-mono text-[10px]">{proj.infos.length}</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => selectProjectAndSection(proj, 'extras')}
                                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-between ${!viewAllSections && activeTab === 'extras'
                                              ? 'text-white'
                                              : 'bg-[#24292E] text-[#9CA3AF] hover:text-white'
                                              }`}
                                            style={
                                              !viewAllSections && activeTab === 'extras'
                                                ? { backgroundColor: pColor }
                                                : {}
                                            }
                                          >
                                            <span>Werkzeuge</span>
                                            <Puzzle className="w-3 h-3" />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>

                              {/* SEKTION 2: PRIVAT */}
                              <div className="space-y-2">
                                <div className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] px-1">
                                  PRIVAT
                                </div>
                                {privateProjects.map((proj) => {
                                  const isActive = activeProject?.id === proj.id;
                                  const pColor = '#4F46E5';
                                  return (
                                    <div
                                      key={proj.id}
                                      className="rounded-xl border overflow-hidden"
                                      style={{
                                        backgroundColor: '#181A1B',
                                        borderColor: isActive ? pColor : 'rgba(255,255,255,0.08)'
                                      }}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => selectProjectAndSection(proj, 'ALL')}
                                        className="w-full p-2.5 flex items-center justify-between text-left"
                                        style={isActive ? { backgroundColor: `${pColor}22` } : {}}
                                      >
                                        <span className="text-xs font-bold text-white truncate">
                                          {proj.name}
                                        </span>
                                        <span className="text-[10px] font-mono text-[#9CA3AF]">
                                          {proj.tasks.filter((t) => !t.completed).length} offen
                                        </span>
                                      </button>

                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {task.aiTouched && (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-red-300 bg-red-500/20 px-2 py-0.5 rounded-md border border-red-500/30">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                  KI-Vorschlag
                                </span>
                              )}

                              {displayGroup && (
                                <span className="text-xs font-medium text-[#9CA3AF] px-2 py-0.5 rounded-md bg-[#1C2026]">
                                  {displayGroup}
                                </span>
                              )}

                              {prefs.adhdMasterEnabled &&
                                prefs.adhdTimeBufferAndHaptics &&
                                task.estimatedMinutes && (
                                  <span className="text-xs font-mono text-[#9CA3AF]">
                                    {Math.round(task.estimatedMinutes * 1.25)} Min. (inkl. Puffer)
                                  </span>
                                )}
                            </div>

                            {/* UNTEN IM DRAWER VERANKERT: NEUES PROJEKT & EINSTELLUNGEN */}
                            <div className="p-4 border-t border-white/10 space-y-2 bg-[#181A1B]">
                              <button
                                type="button"
                                onClick={() => {
                                  setDrawerOpen(false);
                                  onOpenNewProjectModal();
                                }}
                                className="w-full py-2 px-3 rounded-xl text-xs font-semibold bg-[#24292E] text-white border border-white/10 flex items-center gap-2"
                              >
                                <FolderPlus className="w-4 h-4 text-[#14B8A6]" />
                                <span>Neues Projekt anlegen</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setDrawerOpen(false);
                                  onOpenAddonsBackoffice();
                                }}
                                className="w-full py-2.5 px-3 rounded-xl text-xs font-bold text-white flex items-center gap-2"
                                style={{ backgroundColor: themeColors.primary }}
                              >
                                <Settings className="w-4 h-4" />
                                <span>System, Planer &amp; Einstellungen</span>
                              </button>
                            </div>
                          </div>

                          <div
                            className="flex-1 bg-black/60 backdrop-blur-xs"
                            onClick={() => setDrawerOpen(false)}
                            {/* ================================================================ */}
                            {/* SEKTION 2: EINKAUFSWAGEN MIT ANGEPINNTEN FILTER-CHIPS */}
                            {/* ================================================================ */}
                            {showCartSection && (
            <section
              className="rounded-3xl border border-white/5 p-5 space-y-4 shadow-xl transition-all"
              style={{ backgroundColor: '#1C2026' }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <ShoppingCart
                    className="w-5 h-5"
                    style={{ color: themeColors.highlight }}
                  />
                </div>
      )}

                {/* SCHLANKE PROJEKT-KOPFZEILE IM HAUPTFELD (Öffnet links den Swipe-Drawer) */}
                {activeProject && (
                  <div
                    className="p-3 rounded-2xl border flex items-center justify-between gap-2 shadow-md"
                    style={{
                      backgroundColor: THEME.bgCard,
                      borderColor: `${themeColors.primary}66`
                    }}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingCart((v) => !v)}
                    className={`min-h-[44px] min-w-[44px] px-3.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition active:scale-95 ${
                      isAddingCart
                        ? 'text-white border-white/30'
                        : 'bg-[#242930] hover:bg-[#2A3038] text-white border-white/5'
                    }`}
                    style={isAddingCart ? { backgroundColor: themeColors.primary } : {}}
                    aria-label="Artikel hinzufügen"
                    title="Artikel hinzufügen"
                  >
                    <Plus className="w-4 h-4 text-[#14B8A6]" />
                    <span className="hidden sm:inline">Artikel</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setGlobalCartMode((g) => !g)}
                    className={`min-h-[44px] px-3.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition active:scale-95 ${
                      globalCartMode
                        ? 'text-white border-white/30 shadow-sm'
                        : 'bg-[#242930] text-[#9CA3AF] border-white/5'
                    }`}
                    style={globalCartMode ? { backgroundColor: themeColors.primary } : {}}
                    title="Projektübergreifenden Modus umschalten"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>{globalCartMode ? 'Alle Projekte' : 'Nur Projekt'}</span>
                  </button>
                </div>
              </div>

              {/* ANGEPINNTE FILTER-LEISTE MIT PROJEKT-CHIPS & KATEGORIE-FILTER */}
              <div className="sticky top-0 z-20 py-2.5 -mx-2 px-2 bg-[#1C2026]/95 backdrop-blur-md rounded-2xl border border-white/5 space-y-2">
                {/* Projekt-Filter-Chips */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
                  <button
                    type="button"
                    onClick={() => setCartProjectFilter('ALL')}
                    className={`min-h-[44px] px-3.5 rounded-xl text-xs font-bold border shrink-0 transition active:scale-95 ${
                      cartProjectFilter === 'ALL'
                        ? 'bg-[#0A9396] text-white border-[#14B8A6] shadow-sm'
                        : 'bg-[#242930] text-[#9CA3AF] border-white/5 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => setDrawerOpen(true)}
                        className="p-2 rounded-xl text-white shrink-0"
                        style={{ backgroundColor: themeColors.primary }}
                        title="Menü öffnen (oder vom linken Rand wischen)"
                      >
                        <Menu className="w-4 h-4" />
                      </button>
                    Alle (
                    {
                      allProjects
                        .flatMap((p) => (p.archived ? [] : p.cart))
                        .filter((c) => !c.completed).length
                    }
                    )
                  </button>

                      <div className="relative shrink-0">
                        <ProjectAvatar project={activeProject} sizeClass="w-8 h-8" />
                        <label
                          title="Projekt-Logo ändern"
                          className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full text-white flex items-center justify-center cursor-pointer border border-black"
                          style={{ backgroundColor: themeColors.primary }}
                  {allProjects
                    .filter((p) => !p.archived)
                    .map((proj) => {
                      const isActive = cartProjectFilter === proj.id;
                      const openCount = proj.cart.filter((c) => !c.completed).length;
                      const pColor =
                        (proj.customMeta?.customAccentColor as string) ||
                        proj.accentColor ||
                        BRAND_CONFIG.projects[proj.id]?.accentColor ||
                        '#0A9396';

                      return (
                        <button
                          key={proj.id}
                          type="button"
                          onClick={() =>
                            setCartProjectFilter((prev) => (prev === proj.id ? 'ALL' : proj.id))
                          }
                          className={`min-h-[44px] px-3.5 rounded-xl text-xs font-bold border shrink-0 flex items-center gap-1.5 transition active:scale-95 ${
                            isActive
                              ? 'text-white border-white/30 shadow-sm'
                              : 'bg-[#242930] text-[#9CA3AF] border-white/5 hover:text-white'
                          }`}
                          style={isActive ? { backgroundColor: pColor } : {}}
                        >
                          <ImageIcon className="w-2.5 h-2.5" />
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) onUploadProjectLogo(activeProject.id, f);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      </div>
                          <span className="truncate max-w-[140px]">{proj.name}</span>
                          <span className="font-mono text-xs px-1.5 py-0.5 rounded-md bg-black/30">
                            {openCount}
                          </span>
                        </button>
                      );
                    })}
                </div>

                      <div
                        className="min-w-0 cursor-pointer"
                        onClick={() => setDrawerOpen(true)}
                      >
                        <div className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                          {themeColors.label} • {currentSectionLabel}
                        </div>
                        <h2 className="text-xs sm:text-sm font-bold text-white truncate">
                          {activeProject.name}
                        </h2>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                {/* Optionaler Status-/Kategorie-Filter */}
                <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                  <span className="text-xs font-semibold text-[#9CA3AF] pl-1">Status:</span>
                  {(['ALL', 'open', 'completed'] as const).map((status) => {
                    const isSelected = cartCategoryFilter === status;
                    const label =
                      status === 'ALL' ? 'Alle' : status === 'open' ? 'Offen' : 'Erledigt';
                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setViewAllSections((v) => !v)}
                        className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold border border-white/10 text-white"
                        style={{
                          backgroundColor: viewAllSections ? themeColors.primary : '#181A1B'
                        }}
                        onClick={() =>
                          setCartCategoryFilter((prev) => (prev === status ? 'ALL' : status))
                        }
                        className={`min-h-[44px] px-3 rounded-lg text-xs font-semibold transition active:scale-95 ${
                          isSelected
                            ? 'bg-white/10 text-white border border-white/20'
                            : 'text-[#9CA3AF] hover:text-white'
                        }`}
                      >
                        {viewAllSections ? 'Alle aktiv' : 'Einzelansicht'}
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* PROGRESSIVE DISCLOSURE: Eingabeformular für Einkaufswagen */}
              {isAddingCart && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newCartTitle.trim()) return;
                    const targetProjectId =
                      cartProjectFilter !== 'ALL' ? cartProjectFilter : activeProject.id;
                    onAddCartItems(targetProjectId, [
                      {
                        title: newCartTitle.trim(),
                        quantity: newCartQty.trim() || '1x',
                        price: newCartPrice.trim()
                      }
                    ]);
                    setNewCartTitle('');
                    setNewCartQty('1x');
                    setNewCartPrice('');
                    setIsAddingCart(false);
                    onNotify('Artikel zum Einkaufswagen hinzugefügt.');
                  }}
                  className="p-4 rounded-2xl bg-[#242930] border border-white/10 space-y-3 shadow-inner"
                >
                  <input
                    type="text"
                    autoFocus
                    value={newCartTitle}
                    onChange={(e) => setNewCartTitle(e.target.value)}
                    placeholder="Material / Artikel beschreiben..."
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-sm bg-[#1C2026] text-white border border-white/10 placeholder-[#9CA3AF] focus:outline-none focus:border-white/20"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCartQty}
                      onChange={(e) => setNewCartQty(e.target.value)}
                      placeholder="Menge (z.B. 2x, 50kg)"
                      className="w-36 min-h-[44px] px-3.5 py-2.5 rounded-xl text-sm bg-[#1C2026] text-white border border-white/10 placeholder-[#9CA3AF] focus:outline-none focus:border-white/20"
                    />
                    <input
                      type="text"
                      value={newCartPrice}
                      onChange={(e) => setNewCartPrice(e.target.value)}
                      placeholder="Preis (opt., z.B. 45 €)"
                      className="flex-1 min-h-[44px] px-3.5 py-2.5 rounded-xl text-sm bg-[#1C2026] text-white border border-white/10 placeholder-[#9CA3AF] focus:outline-none focus:border-white/20"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingCart(false);
                        setNewCartTitle('');
                        setNewCartQty('1x');
                        setNewCartPrice('');
                      }}
                      className="min-h-[44px] px-4 rounded-xl text-xs font-semibold text-[#9CA3AF] hover:text-white transition"
                    >
                      Abbrechen
                    </button>
                    <button
                      type="submit"
                      disabled={!newCartTitle.trim()}
                      className="min-h-[44px] px-5 rounded-xl text-xs font-bold text-white shadow-md active:scale-95 transition disabled:opacity-40"
                      style={{ backgroundColor: themeColors.primary }}
                    >
                      Speichern
                    </button>
                  </div>
                </form>
              )}

                      {showSearch && activeProject && (
                        <div className="px-3 py-2 rounded-xl border border-white/15 bg-[#181A1B] flex items-center gap-2">
                          <Search className="w-3.5 h-3.5 text-[#9CA3AF]" />
                          {/* PROGRESSIVE DISCLOSURE: Eingabeformular für Einkaufswagen */}
                          {!isAddingCart ? (
                            <button
                              type="button"
                              onClick={() => setIsAddingCart(true)}
                              className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-[#242930] hover:bg-[#2A3038] text-sm font-semibold text-white/90 border border-white/5 flex items-center justify-center gap-2 active:scale-[0.99] transition shadow-sm"
                            >
                              <Plus className="w-4 h-4" style={{ color: themeColors.highlight }} />
                              <span>Artikel hinzufügen</span>
                            </button>
                          ) : (
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                if (!newCartTitle.trim()) return;
                                const targetProjectId =
                                  cartProjectFilter !== 'ALL' ? cartProjectFilter : activeProject.id;
                                onAddCartItems(targetProjectId, [
                                  {
                                    title: newCartTitle.trim(),
                                    quantity: newCartQty.trim() || '1x',
                                    price: newCartPrice.trim()
                                  }
                                ]);
                                setNewCartTitle('');
                                setNewCartQty('1x');
                                setNewCartPrice('');
                                setIsAddingCart(false);
                                onNotify('Artikel zum Einkaufswagen hinzugefügt.');
                              }}
                              className="p-4 rounded-2xl bg-[#242930] border border-white/10 space-y-3 shadow-inner"
                            >
                              <input
                                type="text"
                                autoFocus
                                value={newCartTitle}
                                onChange={(e) => setNewCartTitle(e.target.value)}
                                placeholder="Material / Artikel beschreiben..."
                                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-sm bg-[#1C2026] text-white border border-white/10 placeholder-[#9CA3AF] focus:outline-none focus:border-white/20"
                              />
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  autoFocus
                                  value={searchQuery}
                                  onChange={(e) => setSearchQuery(e.target.value)}
                                  placeholder={`In ${activeProject.name} filtern...`}
                                  className="flex-1 bg-transparent text-xs text-white focus:outline-none"
                                />
                                {searchQuery && (
                                  <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="text-[#9CA3AF] hover:text-white"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                )}

                              {/* HAUPTARBEITSFELD: Strukturierte Sektionen */}
                              {activeProject && (
                                <div className="space-y-4">
                                  {/* SEKTION 1: TASKS */}
                                  {showTasksSection && (
                                    <section
                                      className="rounded-2xl border border-white/10 p-3 space-y-2.5"
                                      style={{ backgroundColor: THEME.bgCard }}
                                    >
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <CheckSquare
                                            className="w-4 h-4"
                                            style={{ color: themeColors.highlight }}
                                          />
                                          <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                                            Tasks ({activeProject.tasks.filter((t) => !t.completed).length} offen)
                                          </h3>
                                          {/* Einkaufswagen-Liste */}
                                          <div className="space-y-2">
                                            {displayedCart.map((item) => {
                                              const isProcOpen = !!openProcurements[item.id];
                                              const isTrayOpen = !!expandedActionCards[item.id];

                                              return (
                                                <div
                                                  key={`${item.originProjectId}-${item.id}`}
                                                  id={`item-card-${item.id}`}
                                                  className={`rounded-2xl border transition-all duration-200 overflow-hidden shadow-sm ${item.completed ? 'opacity-75' : ''
                                                    }`}
                                                  style={{
                                                    backgroundColor: '#242930',
                                                    borderColor: 'rgba(255,255,255,0.05)'
                                                  }}
                                                >
                                                  {/* Karten-Ruhezustand */}
                                                  <div className="p-4 flex items-center justify-between gap-3">
                                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                                      {/* Große Touch-Fläche (>= 44px) für Checkbox */}
                                                      <button
                                                        type="button"
                                                        onClick={() => {
                                                          triggerHapticFeedback(15);
                                                          onToggleCartItem(item.originProjectId, item.id);
                                                        }}
                                                        className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2 shrink-0 cursor-pointer"
                                                        aria-label={item.completed ? 'Als offen markieren' : 'Als besorgt markieren'}
                                                      >
                                                        <div
                                                          className="w-6 h-6 rounded-lg flex items-center justify-center border transition-all active:scale-90"
                                                          style={{
                                                            backgroundColor: item.completed
                                                              ? themeColors.primary
                                                              : 'rgba(28,32,38,0.8)',
                                                            borderColor: item.completed ? themeColors.highlight : '#6B7280'
                                                          }}
                                                        >
                                                          {item.completed && (
                                                            <Check className="w-4 h-4 text-white stroke-[3]" />
                                                          )}
                                                        </div>
                                                      </button>

                              {globalCartMode && (
                                <span className="text-xs px-2 py-0.5 rounded-md bg-[#1C2026] text-[#9CA3AF]">
                                  {item.originProjectName}
                                </span>
                              )}

                              {item.aiTouched && (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-red-300 bg-red-500/20 px-2 py-0.5 rounded-md border border-red-500/30">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                  KI-Artikel
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                                                          {globalCartMode && (
                                                            <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#1C2026] text-[#9CA3AF]">
                                                              {item.originProjectName}
                                                            </span>
                                                          )}

                                                          {item.aiTouched && (
                                                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-300 bg-red-500/20 px-2 py-0.5 rounded-md border border-red-500/30">
                                                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                                              KI-Artikel
                                                            </span>
                                                          )}
                                                        </div>
                                                      </div>
                                                      {activeProject.tasks.some((t) => t.completed) && (
                                                        <button
                                                          type="button"
                                                          onClick={() => handleResetTasks(activeProject.id)}
                                                          className="text-[10px] text-[#9CA3AF] hover:text-white flex items-center gap-1"
                                                        >
                                                          <RotateCcw className="w-3 h-3" />
                                                          <span>Reset</span>
                                                        </button>
                                                      )}
                                                    </div>

                                                    <form
                                                      onSubmit={(e) => {
                                                        e.preventDefault();
                                                        if (!newTaskTitle.trim()) return;
                                                        onAddTask(activeProject.id, newTaskTitle.trim(), 'Mittel', 25);
                                                        setNewTaskTitle('');
                                                      }}
                                                      className="flex items-center gap-1.5"
                                                    >
                                                      <input
                                                        type="text"
                                                        value={newTaskTitle}
                                                        onChange={(e) => setNewTaskTitle(e.target.value)}
                                                        placeholder="Neuen Task eintragen..."
                                                        className="flex-1 px-3 py-2 rounded-xl text-xs bg-[#181A1B] text-white border border-white/10 focus:outline-none"
                                                      />
                                                      <button
                                                        type="submit"
                                                        className="px-3 py-2 rounded-xl text-xs font-bold text-white"
                                                        style={{ backgroundColor: themeColors.primary }}
                                                      >
                                                        <Plus className="w-4 h-4" />
                                                      </button>
                                                    </form>

                                                    <div className="space-y-1.5">
                                                      {sortedTasks.map((task) => (
                                                        <div
                                                          key={task.id}
                                                          id={`item-card-${task.id}`}
                                                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${task.completed ? 'opacity-70' : ''
                                                            }`}
                                                          style={{
                                                            backgroundColor: THEME.bgSub,
                                                            borderColor:
                                                              highlightedItemId === task.id
                                                                ? themeColors.highlight
                                                                : 'rgba(255,255,255,0.07)'
                                                          }}
                                                        >
                                                          <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                                            {task.aiTouched && (
                                                              <button
                                                                type="button"
                                                                onClick={() =>
                                                                  onConfirmRedDot(activeProject.id, 'tasks', task.id)
                                                                }
                                                                className="w-2 h-2 rounded-full shrink-0"
                                                                style={{ backgroundColor: THEME.aiRedDot }}
                                                                title="KI-Eintrag bestätigen"
                                                              />
                                                            )}
                                                            <button
                                                              type="button"
                                                              onClick={() => onToggleTask(activeProject.id, task.id)}
                                                              className="w-5 h-5 rounded-md flex items-center justify-center border shrink-0"
                                                              style={{
                                                                backgroundColor: task.completed
                                                                  ? themeColors.primary
                                                                  : 'rgba(24,26,27,0.7)',
                                                                borderColor: task.completed ? themeColors.highlight : '#9CA3AF'
                                                              }}
                                                            >
                                                              {task.completed && (
                                                                <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                                                              )}
                                                            </button>
                                                            <span
                                                              onClick={() => onToggleTask(activeProject.id, task.id)}
                                                              className="text-xs font-semibold text-[#F8F9FA] leading-snug cursor-pointer flex-1"
                                                            >
                                                              {task.title}
                                                            </span>
                                                          </div>

                                                          <div className="flex items-center gap-1 shrink-0">
                                                            <button
                                                              type="button"
                                                              onClick={() => handleCopyTaskToCart(activeProject.id, task.title)}
                                                              className="p-1.5 rounded-lg bg-[#181A1B] text-[#9CA3AF] hover:text-white border border-white/10"
                                                              title="In Einkaufswagen übernehmen"
                                                            >
                                                              <ShoppingCart className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                              type="button"
                                                              onClick={() => onDeleteTask(activeProject.id, task.id)}
                                                              className="p-1.5 text-[#9CA3AF] hover:text-red-400"
                                                            >
                                                              <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                          </div>
                                                        </div>
                                                      ))}
                                                      <Trash2 className="w-4 h-4" />
                                                      <span>Löschen</span>
                                                    </button>
                                                  </div>
                                                </div>
                      </section>
                    )}
                      )}

                                          {/* SEKTION 2: EINKAUFSWAGEN */}
                                          {showCartSection && (
                                            <section
                                              className="rounded-2xl border border-white/10 p-3 space-y-2.5"
                                              style={{ backgroundColor: THEME.bgCard }}
                                            >
                                              <div className="flex items-center gap-2">
                                                <ShoppingCart
                                                  className="w-4 h-4"
                                                  style={{ color: themeColors.highlight }}
                                                  {/* Beschaffungs-Check Panel */}
                                                  {isProcOpen && (
                                                    <div className="border-t border-white/5 bg-[#1C2026]">
                                                      <ProcurementCheckPanel
                                                        title={item.title}
                                                        customCheck={item.procurementCheck}
                                                      />
                                                      <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                                                        Einkaufswagen ({activeProject.cart.filter((c) => !c.completed).length} offen)
                                                      </h3>
                                                    </div>
                                                  )}
                    </div>
                                              );
                })}
                                            </div>
            </section>
          )}

          {/* ================================================================ */}
          {/* SEKTION 3: WISSEN (Abläufe & Infos zusammengelegt mit einheitlichem Vorlesen) */}
          {/* ================================================================ */}
          {showKnowledgeSection && (
            <section
              className="rounded-3xl border border-white/5 p-5 space-y-4 shadow-xl transition-all"
              style={{ backgroundColor: '#1C2026' }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <BookOpen
                    className="w-5 h-5"
                    style={{ color: themeColors.highlight }}
                  />
                  <h3 className="text-base font-bold text-white tracking-wide">
                    Wissen
                  </h3>
                  <span className="text-xs font-semibold text-[#9CA3AF] px-2 py-0.5 rounded-full bg-[#242930]">
                    {projectKnowledge.length} Einträge
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAddingKnowledge((v) => !v)}
                  className={`min-h-[44px] min-w-[44px] px-3.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition active:scale-95 ${
                    isAddingKnowledge
                      ? 'text-white border-white/30'
                      : 'bg-[#242930] hover:bg-[#2A3038] text-white border-white/5'
                  }`}
                  style={isAddingKnowledge ? { backgroundColor: themeColors.primary } : {}}
                  aria-label="Wissenseintrag hinzufügen"
                  title="Wissenseintrag hinzufügen"
                >
                  <Plus className="w-4 h-4 text-[#14B8A6]" />
                  <span className="hidden sm:inline">Eintrag</span>
                </button>
              </div>

                                            <div className="space-y-1.5">
                                              {sortedCart.map((item) => {
                                                const isProcOpen = !!openProcurements[item.id];
                                                return (
                                                  <div
                                                    key={item.id}
                                                    id={`item-card-${item.id}`}
                                                    className={`rounded-xl border border-white/10 overflow-hidden ${item.completed ? 'opacity-70' : ''
                                                      }`}
                                                    style={{ backgroundColor: THEME.bgSub }}
                                                  >
                                                    <div className="p-2.5 flex items-center justify-between gap-2">
                                                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                                        {item.aiTouched && (
                                                          <button
                                                            type="button"
                                                            onClick={() =>
                                                              onConfirmRedDot(activeProject.id, 'cart', item.id)
                                                            }
                                                            className="w-2 h-2 rounded-full shrink-0"
                                                            style={{ backgroundColor: THEME.aiRedDot }}
                                                          />
                                                        )}
                                                        <button
                                                          type="button"
                                                          onClick={() => onToggleCartItem(activeProject.id, item.id)}
                                                          className="w-5 h-5 rounded-md flex items-center justify-center border shrink-0"
                                                          style={{
                                                            backgroundColor: item.completed
                                                              ? themeColors.primary
                                                              : 'rgba(24,26,27,0.7)',
                                                            borderColor: item.completed ? themeColors.highlight : '#9CA3AF'
                                                          }}
                                                        >
                                                          {item.completed && (
                                                            <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                                                          )}
                                                        </button>
                                                        <div
                                                          onClick={() => onToggleCartItem(activeProject.id, item.id)}
                                                          className="min-w-0 flex-1 cursor-pointer"
                                                        >
                                                          <span className="text-xs font-semibold text-[#F8F9FA] block truncate">
                                                            {item.title}
                                                          </span>
                                                          <span
                                                            className="text-[10px] font-mono"
                                                            style={{ color: themeColors.highlight }}
                                                          >
                                                            Menge: {item.quantity}
                                                          </span>
                                                        </div>
                                                      </div>
                                                      {/* SCHNELLE FILTER-CHIPS: Alle / Abläufe / Infos */}
                                                      <div className="flex items-center gap-2 pb-1 overflow-x-auto no-scrollbar">
                                                        <button
                                                          type="button"
                                                          onClick={() => setKnowledgeFilter('ALL')}
                                                          className={`min-h-[44px] px-3.5 rounded-xl text-xs font-bold border shrink-0 transition active:scale-95 ${knowledgeFilter === 'ALL'
                                                            ? 'bg-[#0A9396] text-white border-[#14B8A6] shadow-sm'
                                                            : 'bg-[#242930] text-[#9CA3AF] border-white/5 hover:text-white'
                                                            }`}
                                                        >
                                                          Alle ({projectKnowledge.length})
                                                        </button>
                                                        <button
                                                          type="button"
                                                          onClick={() =>
                                                            setKnowledgeFilter((prev) => (prev === 'explanation' ? 'ALL' : 'explanation'))
                                                          }
                                                          className={`min-h-[44px] px-3.5 rounded-xl text-xs font-bold border shrink-0 transition active:scale-95 ${knowledgeFilter === 'explanation'
                                                            ? 'bg-[#0A9396] text-white border-[#14B8A6] shadow-sm'
                                                            : 'bg-[#242930] text-[#9CA3AF] border-white/5 hover:text-white'
                                                            }`}
                                                        >
                                                          Abläufe ({projectKnowledge.filter((k) => k.kind === 'explanation').length})
                                                        </button>
                                                        <button
                                                          type="button"
                                                          onClick={() =>
                                                            setKnowledgeFilter((prev) => (prev === 'info' ? 'ALL' : 'info'))
                                                          }
                                                          className={`min-h-[44px] px-3.5 rounded-xl text-xs font-bold border shrink-0 transition active:scale-95 ${knowledgeFilter === 'info'
                                                            ? 'bg-[#0A9396] text-white border-[#14B8A6] shadow-sm'
                                                            : 'bg-[#242930] text-[#9CA3AF] border-white/5 hover:text-white'
                                                            }`}
                                                        >
                                                          Infos ({projectKnowledge.filter((k) => k.kind !== 'explanation').length})
                                                        </button>
                                                      </div>

              {/* PROGRESSIVE DISCLOSURE: Eingabeformular für Wissen */}
              {isAddingKnowledge && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newKnowledgeTitle.trim()) return;
                    if (onAddKnowledge) {
                      onAddKnowledge(
                        activeProject.id,
                        newKnowledgeKind,
                        newKnowledgeTitle.trim(),
                        newKnowledgeContent.trim()
                      );
                    } else if (newKnowledgeKind === 'explanation') {
                      onAddExplanation(
                        activeProject.id,
                        newKnowledgeTitle.trim(),
                        newKnowledgeContent.trim()
                      );
                    } else {
                      onAddInfo(
                        activeProject.id,
                        newKnowledgeTitle.trim(),
                        newKnowledgeContent.trim()
                      );
                    }
                    setNewKnowledgeTitle('');
                    setNewKnowledgeContent('');
                    setIsAddingKnowledge(false);
                    onNotify('Wissenseintrag gespeichert.');
                  }}
                  className="p-4 rounded-2xl bg-[#242930] border border-white/10 space-y-3 shadow-inner"
                >
                  {/* Segmented Control: Ablauf vs. Info */}
                  <div className="grid grid-cols-2 gap-2 bg-[#1C2026] p-1 rounded-xl border border-white/10">
                    <button
                      type="button"
                      onClick={() => setNewKnowledgeKind('explanation')}
                      className={`min-h-[44px] rounded-lg text-xs font-bold transition ${
                        newKnowledgeKind === 'explanation'
                          ? 'bg-[#0A9396] text-white shadow'
                          : 'text-[#9CA3AF] hover:text-white'
                      }`}
                    >
                      Ablauf / Checkliste
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewKnowledgeKind('info')}
                      className={`min-h-[44px] rounded-lg text-xs font-bold transition ${
                        newKnowledgeKind === 'info'
                          ? 'bg-[#0A9396] text-white shadow'
                          : 'text-[#9CA3AF] hover:text-white'
                      }`}
                    >
                      Info / Maße / Notiz
                    </button>
                  </div>

                                                        {isProcOpen && (
                                                          <ProcurementCheckPanel
                                                            title={item.title}
                                                            customCheck={item.procurementCheck}
                                                          />
                                                        )}
                                                      </div>
                                                    );
                          })}
                                                  </div>
                      </section>
                                        )}
                                        <input
                                          type="text"
                                          autoFocus
                                          value={newKnowledgeTitle}
                                          onChange={(e) => setNewKnowledgeTitle(e.target.value)}
                                          placeholder={
                                            newKnowledgeKind === 'explanation'
                                              ? 'Titel des Ablaufs (z. B. Ofen einbrennen)...'
                                              : 'Titel der Info / Maße (z. B. Gasanschluss-Maße)...'
                                          }
                                          className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-sm bg-[#1C2026] text-white border border-white/10 placeholder-[#9CA3AF] focus:outline-none focus:border-white/20"
                                        />
                                        <textarea
                                          rows={4}
                                          value={newKnowledgeContent}
                                          onChange={(e) => setNewKnowledgeContent(e.target.value)}
                                          placeholder={
                                            newKnowledgeKind === 'explanation'
                                              ? 'Einzelschritte (Zeile für Zeile notieren)...'
                                              : 'Details, technische Daten, Notizen...'
                                          }
                                          className="w-full p-3.5 rounded-xl text-sm bg-[#1C2026] text-white border border-white/10 placeholder-[#9CA3AF] focus:outline-none focus:border-white/20"
                                        />
                                        <div className="flex justify-end gap-2 pt-1">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setIsAddingKnowledge(false);
                                              setNewKnowledgeTitle('');
                                              setNewKnowledgeContent('');
                                            }}
                                            className="min-h-[44px] px-4 rounded-xl text-xs font-semibold text-[#9CA3AF] hover:text-white transition"
                                          >
                                            Abbrechen
                                          </button>
                                          <button
                                            type="submit"
                                            disabled={!newKnowledgeTitle.trim()}
                                            className="min-h-[44px] px-5 rounded-xl text-xs font-bold text-white shadow-md active:scale-95 transition disabled:opacity-40"
                                            style={{ backgroundColor: themeColors.primary }}
                                          >
                                            Speichern
                                          </button>
                                        </div>
                                      </form>
              )}

                                      {/* SEKTION 3: ABLÄUFE & ERKLÄRUNGEN */}
                                      {showExplanationsSection && (
                      <section
                        className="rounded-2xl border border-white/10 p-3 space-y-2.5"
                        style={{ backgroundColor: THEME.bgCard }}
              {/* WISSENS-LISTE */}
              <div className="space-y-2">
                {filteredKnowledge.map((item) => {
                  const isOpen = !!openKnowledge[item.id];
                  const isEditing = editingKnowledgeId === item.id;
                  const isSpeaking = speakingKnowledgeId === item.id;

                  return (
                    <div
                      key={item.id}
                      id={`item-card-${item.id}`}
                      className="rounded-2xl border border-white/5 overflow-hidden transition-all shadow-sm"
                      style={{ backgroundColor: '#242930' }}
                    >
                      {/* Karten-Ruhezustand */}
                      <div
                        onClick={() =>
                          setOpenKnowledge((p) => ({ ...p, [item.id]: !p[item.id] }))
                        }
                        className="p-4 flex items-center justify-between gap-3 cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-2">
                          <BookOpen
                            className="w-4 h-4"
                            style={{ color: themeColors.highlight }}
                          />
                          <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                            Abläufe &amp; Erklärungen ({activeProject.explanations.length})
                          </h3>
                        </div>

                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (!newExpTitle.trim()) return;
                            onAddExplanation(
                              activeProject.id,
                              newExpTitle.trim(),
                              newExpSteps.trim() || '1. Schritt eintragen...'
                            );
                            setNewExpTitle('');
                            setNewExpSteps('');
                          }}
                          className="space-y-2"
                        >
                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              value={newExpTitle}
                              onChange={(e) => setNewExpTitle(e.target.value)}
                              placeholder="Neuer Ablauf..."
                              className="flex-1 px-3 py-2 rounded-xl text-xs bg-[#181A1B] text-white border border-white/10"
                        <div className="min-w-0 flex-1 flex items-center gap-2.5">
                          {/* Roter KI-Punkt */}
                          {item.aiTouched && (
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: THEME.aiRedDot }}
                              title="Automatisch von KI bearbeitet"
                            />
                            <button
                              type="submit"
                              className="px-3 py-2 rounded-xl text-xs font-bold text-white"
                              style={{ backgroundColor: themeColors.primary }}
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                          {newExpTitle && (
                            <textarea
                              rows={3}
                              value={newExpSteps}
                              onChange={(e) => setNewExpSteps(e.target.value)}
                              placeholder="Einzelschritte..."
                              className="w-full p-2.5 rounded-xl text-xs bg-[#181A1B] text-white border border-white/10"
                            />
                          )}
                        </form>

                        <div className="space-y-1.5">
                          {activeProject.explanations.map((exp) => {
                            const isOpen = !!openExplanations[exp.id];
                            const isEditing = editingExpId === exp.id;
                            return (
                              <div
                                key={exp.id}
                                id={`item-card-${exp.id}`}
                                className="rounded-xl border border-white/10 overflow-hidden"
                                style={{ backgroundColor: THEME.bgSub }}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                                  item.kind === 'explanation'
                                    ? 'bg-[#14B8A6]/20 text-[#14B8A6]'
                                    : 'bg-indigo-500/20 text-indigo-300'
                                }`}
                              >
                                <div
                                  onClick={() =>
                                    setOpenExplanations((p) => ({ ...p, [exp.id]: !p[exp.id] }))
                                  }
                                  className="p-2.5 flex items-center justify-between gap-2 cursor-pointer"
                                >
                                  <span className="text-xs font-bold text-white truncate">
                                    {exp.title}
                                  </span>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingExpId(exp.id);
                                        setEditExpTitle(exp.title);
                                        setEditExpSteps(exp.stepsText);
                                        setOpenExplanations((p) => ({ ...p, [exp.id]: true }));
                                      }}
                                      className="p-1 text-[#9CA3AF] hover:text-white"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    {isOpen ? (
                                      <ChevronUp className="w-4 h-4 text-[#9CA3AF]" />
                                    ) : (
                                      <ChevronDown className="w-4 h-4 text-[#9CA3AF]" />
                                    )}
                                  </div>
                                </div>

                                {isOpen && (
                                  <div className="px-3 pb-3 pt-2 border-t border-white/10 space-y-2 bg-[#181A1B]/60">
                                    {isEditing ? (
                                      <div className="space-y-2">
                                        <input
                                          type="text"
                                          value={editExpTitle}
                                          onChange={(e) => setEditExpTitle(e.target.value)}
                                          className="w-full px-2.5 py-1.5 rounded text-xs bg-[#181A1B] text-white border border-white/15"
                                        />
                                        <textarea
                                          rows={4}
                                          value={editExpSteps}
                                          onChange={(e) => setEditExpSteps(e.target.value)}
                                          className="w-full p-2 rounded text-xs bg-[#181A1B] text-white border border-white/15 font-mono"
                                        />
                                        <div className="flex justify-end gap-2">
                                          <button
                                            type="button"
                                            onClick={() => setEditingExpId(null)}
                                            className="px-2.5 py-1 text-xs text-[#9CA3AF]"
                                          >
                                            Abbrechen
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              onUpdateExplanation(
                                                activeProject.id,
                                                exp.id,
                                                editExpTitle,
                                                editExpSteps
                                              );
                                              setEditingExpId(null);
                                            }}
                                            className="px-3 py-1 rounded text-xs font-bold text-white"
                                            style={{ backgroundColor: themeColors.primary }}
                                          >
                                            Speichern
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="text-xs whitespace-pre-line text-[#F8F9FA] leading-relaxed">
                                        {exp.stepsText}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                                {item.kind === 'explanation' ? 'Ablauf' : 'Info'}
                              </span>
                              <span className="text-base font-semibold text-white truncate">
                                {item.title}
                              </span>
                            </div>
                            {item.attachments && item.attachments.length > 0 && (
                              <span className="text-xs font-medium text-[#14B8A6] mt-0.5 inline-block">
                                {item.attachments.length} Anhang
                                {item.attachments.length > 1 ? 'änge' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      </section>
                                      )}

                                      {/* SEKTION 4: INFOS & DATEIEN */}
                                      {showInfosSection && (
                      <section
                        className="rounded-2xl border border-white/10 p-3 space-y-2.5"
                        style={{ backgroundColor: THEME.bgCard }}
                      >
                        <div className="flex items-center gap-2">
                          <FileText
                            className="w-4 h-4"
                            style={{ color: themeColors.highlight }}
                          />
                          <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                            Infos, Maße &amp; Dokumente ({activeProject.infos.length})
                          </h3>
                        </div>
                        {/* EINHEITLICHER VORLESE-BUTTON AN EXAKT DERSELBEN STELLE */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (item.kind === 'explanation') {
                                setActiveAudioGuideExp(item);
                              } else {
                                handleSpeakKnowledge(item);
                              }
                            }}
                            className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border transition active:scale-95 ${
                              isSpeaking
                                ? 'bg-[#0A9396] text-white border-[#14B8A6] animate-pulse'
                                : 'bg-[#1C2026] text-[#14B8A6] border-white/10 hover:border-[#14B8A6]/40 hover:text-white'
                            }`}
                            title={
                              item.kind === 'explanation'
                                ? 'Freihändigen Audio-Guide starten'
                                : isSpeaking
                                ? 'Vorlesen anhalten'
                                : 'Text flüssig vorlesen'
                            }
                            aria-label="Vorlesen"
                          >
                            <Volume2 className="w-5 h-5" />
                          </button>

                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (!newInfoTitle.trim()) return;
                            onAddInfo(activeProject.id, newInfoTitle.trim(), newInfoContent.trim());
                            setNewInfoTitle('');
                            setNewInfoContent('');
                          }}
                          className="space-y-2"
                        >
                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              value={newInfoTitle}
                              onChange={(e) => setNewInfoTitle(e.target.value)}
                              placeholder="Neue Info / Maß..."
                              className="flex-1 px-3 py-2 rounded-xl text-xs bg-[#181A1B] text-white border border-white/10"
                            />
                            <button
                              type="submit"
                              className="px-3 py-2 rounded-xl text-xs font-bold text-white"
                              style={{ backgroundColor: themeColors.primary }}
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          <div className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[#9CA3AF]">
                            {isOpen ? (
                              <ChevronUp className="w-5 h-5" />
                            ) : (
                              <ChevronDown className="w-5 h-5" />
                            )}
                          </div>
                          {newInfoTitle && (
                            <textarea
                              rows={2}
                              value={newInfoContent}
                              onChange={(e) => setNewInfoContent(e.target.value)}
                              placeholder="Details..."
                              className="w-full p-2.5 rounded-xl text-xs bg-[#181A1B] text-white border border-white/10"
                            />
                          )}
                        </form>
                        </div>
                      </div>

                        <div className="space-y-1.5">
                          {activeProject.infos.map((info) => {
                            const isOpen = !!openInfos[info.id];
                            return (
                              <div
                                key={info.id}
                                id={`item-card-${info.id}`}
                                className="rounded-xl border border-white/10 overflow-hidden"
                                style={{ backgroundColor: THEME.bgSub }}
                              >
                                <div
                                  onClick={() =>
                                    setOpenInfos((p) => ({ ...p, [info.id]: !p[info.id] }))
                                  }
                                  className="p-2.5 flex items-center justify-between gap-2 cursor-pointer"
                      {/* Aufgeklappter Zustand */}
                      {isOpen && (
                        <div className="px-4 pb-4 pt-2 border-t border-white/5 space-y-3 bg-[#1C2026]/70 animate-fadeIn">
                          {isEditing ? (
                            <div className="space-y-3 pt-2">
                              <input
                                type="text"
                                value={editKnowledgeTitle}
                                onChange={(e) => setEditKnowledgeTitle(e.target.value)}
                                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl text-sm bg-[#242930] text-white border border-white/10"
                              />
                              <textarea
                                rows={5}
                                value={editKnowledgeContent}
                                onChange={(e) => setEditKnowledgeContent(e.target.value)}
                                className="w-full p-3 rounded-xl text-sm bg-[#242930] text-white border border-white/10 font-mono"
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingKnowledgeId(null)}
                                  className="min-h-[44px] px-4 rounded-xl text-xs font-semibold text-[#9CA3AF] hover:text-white"
                                >
                                  <span className="text-xs font-bold text-white truncate">
                                    {info.title}
                                  {task.completed && (
                                    <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (onUpdateKnowledge) {
                                      onUpdateKnowledge(
                                        activeProject.id,
                                        item.id,
                                        editKnowledgeTitle,
                                        editKnowledgeContent
                                      );
                                    } else if (item.kind === 'explanation') {
                                      onUpdateExplanation(
                                        activeProject.id,
                                        item.id,
                                        editKnowledgeTitle,
                                        editKnowledgeContent
                                      );
                                    } else {
                                      onAddInfo(
                                        activeProject.id,
                                        editKnowledgeTitle,
                                        editKnowledgeContent
                                      );
                                    }
                                    setEditingKnowledgeId(null);
                                    onNotify('Wissenseintrag aktualisiert.');
                                  }}
                                  className="min-h-[44px] px-5 rounded-xl text-xs font-bold text-white shadow-md"
                                  style={{ backgroundColor: themeColors.primary }}
                                >
                                  {task.title}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="text-sm text-[#F8F9FA] leading-relaxed whitespace-pre-line py-2">
                                {item.content}
                              </div>

                              {/* KI-Bestätigung falls aiTouched */}
                              {item.aiTouched && (
                                <div className="p-2.5 rounded-xl bg-red-950/30 border border-red-500/30 flex items-center justify-between">
                                  <span className="text-xs text-red-200">
                                    KI-Änderung prüfen: {item.changeReason || 'KI-Zuordnung'}
                                  </span>
                                  {isOpen ? (
                                    <ChevronUp className="w-4 h-4 text-[#9CA3AF]" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4 text-[#9CA3AF]" />
                                  )}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onConfirmRedDot(
                                        activeProject.id,
                                        'knowledge',
                                        item.id
                                      )
                                    }
                                    className="min-h-[44px] px-3 rounded-lg bg-red-500/20 text-red-200 text-xs font-bold hover:bg-red-500/30 transition"
                                  >
                                    Bestätigen
                                  </button>
                                </div>
                              )}

                                {isOpen && (
                                  <div className="px-3 pb-3 pt-2 border-t border-white/10 space-y-2 bg-[#181A1B]/60">
                                    <div className="text-xs whitespace-pre-line text-[#F8F9FA]">
                                      {info.content}
                                    </div>
                                    <div className="flex items-center justify-between pt-1">
                                      <span className="text-[10px] text-[#9CA3AF]">
                                        Anhänge ({info.attachments.length})
                                      </span>
                                      <label
                                        className="cursor-pointer px-2.5 py-1 rounded-lg text-[10px] font-bold text-white flex items-center gap-1"
                                        style={{ backgroundColor: themeColors.primary }}
                                      >
                                        <Upload className="w-3 h-3" />
                                        <span>Datei hochladen</span>
                                        <input
                                          type="file"
                                          accept="image/*,.pdf,.txt,.md"
                                          className="hidden"
                                          onChange={(e) => {
                                            const f = e.target.files?.[0];
                                            if (f) onUploadInfoAttachment(activeProject.id, info.id, f);
                                            e.target.value = '';
                                          }}
                                        />
                                      </label>
                                    </div>
                                    {info.attachments.map((att) => (
                                      <div
                                        key={att.id}
                                        onClick={() => onPreviewAttachment(att)}
                                        className="p-2 rounded-lg bg-[#24292E] border border-white/10 flex items-center justify-between text-xs cursor-pointer"
                                      >
                                        <span className="text-white truncate">{att.name}</span>
                                        <span className="text-[10px] text-[#9CA3AF]">{att.size}</span>
                                      </div>
                                    ))}
                              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingKnowledgeId(item.id);
                                      setEditKnowledgeTitle(item.title);
                                      setEditKnowledgeContent(item.content);
                                    }}
                                    className="min-h-[44px] px-4 rounded-xl bg-[#242930] hover:bg-[#2A3038] text-[#9CA3AF] hover:text-white text-xs font-semibold flex items-center gap-2 border border-white/5 active:scale-95 transition"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                    <span>Bearbeiten</span>
                                  </button>
                                </div>

                                <label
                                  className="cursor-pointer min-h-[44px] px-4 rounded-xl text-xs font-bold text-white flex items-center gap-2 shadow-sm active:scale-95 transition"
                                  style={{ backgroundColor: themeColors.primary }}
                                >
                                  <Upload className="w-4 h-4" />
                                  <span>Foto / PDF anhängen</span>
                                  <input
                                    type="file"
                                    accept="image/*,.pdf,.txt,.md"
                                    className="hidden"
                                    onChange={(e) => {
                                      const f = e.target.files?.[0];
                                      if (f) {
                                        if (onUploadKnowledgeAttachment) {
                                          onUploadKnowledgeAttachment(activeProject.id, item.id, f);
                                        } else {
                                          onUploadInfoAttachment(activeProject.id, item.id, f);
                                        }
                                      }
                                      e.target.value = '';
                                    }}
                                  />
                                </label>
                              </div>

                              {/* Anhänge-Liste */}
                              {item.attachments &&
                                item.attachments.map((att) => (
                                  <div
                                    key={att.id}
                                    onClick={() => onPreviewAttachment(att)}
                                    className="min-h-[48px] p-3 rounded-xl bg-[#242930] hover:bg-[#2A3038] border border-white/5 flex items-center justify-between text-xs cursor-pointer active:scale-[0.99] transition"
                                  >
                                    <span className="text-white font-medium truncate">
                                      {att.name}
                                    </span>
                                    <span className="text-xs font-semibold text-[#14B8A6] ml-2 shrink-0">
                                      Öffnen / Maß-Pin ({att.size})
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                                ))}
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {/* SEKTION 5: WERKZEUGE / EXTRAS */}
                    {showExtrasSection && (
                      <section className="space-y-3">
                        {activePlugins.map((plugin) => (
                          <div key={plugin.id}>
                            {plugin.render({
                              project: activeProject,
                              onUpdateProjectMeta: (patch) =>
                                onUpdateProjectMeta(activeProject.id, patch),
                              onAddCartItems: (items) => onAddCartItems(activeProject.id, items),
                              onAddInfoCard: (title, content) => onAddInfo(activeProject.id, title, content),
                              onRecordEventSale,
                              onNotify
                            })}
                          </div>
                        ))}
                      </section>
                    )}
                  </div>
                                      )}
                                    </div>
                                  );
                                  {/* ================================================================ */}
                                  {/* SEKTION 5: WERKZEUGE / EXTRAS */}
                                  {/* ================================================================ */}
                                  {showExtrasSection && (
                                    <section className="space-y-4">
                                      {activePlugins.map((plugin) => (
                                        <div key={plugin.id} className="rounded-3xl overflow-hidden shadow-xl">
                                          {plugin.render({
                                            project: activeProject,
                                            onUpdateProjectMeta: (patch) =>
                                              onUpdateProjectMeta(activeProject.id, patch),
                                            onAddCartItems: (items) => onAddCartItems(activeProject.id, items),
                                            onRecordEventSale,
                                            onNotify
                                          })}
                                        </div>
                                      ))}
                                    </section>
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
