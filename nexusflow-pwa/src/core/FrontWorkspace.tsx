import React, { useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Volume2,
  Scale,
  Calendar,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Crosshair,
  Edit3,
  Eye,
  FileText,
  FolderPlus,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  Menu,
  MoreHorizontal,
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
  CustomMeta,
  DomainType,
  EventSalesLog,
  PriorityType,
  Project,
  ProjectTabId,
  THEME
} from '../types';
import { ProjectAvatar } from '../components/RaccoonAvatar';
import { StepByStepAudioGuide } from '../components/StepByStepAudioGuide';
import { buildGoogleCalendarTemplateUrl } from '../services/cloudSyncAndPush';
import { ProcurementCheckPanel } from '../plugins/procurementCheck';
import { PLUGIN_REGISTRY } from '../plugins/registry';
import {
  BanditUserPreferences,
  loadUserPrefs,
  saveUserPrefs,
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
  onOpenDeepResearchModal?: () => void;
  onConfirmRedDot: (
    projectId: string,
    section: 'tasks' | 'explanations' | 'infos' | 'cart',
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
  onResetProjectLogo: _onResetProjectLogo,
  onOpenDeepResearchModal,
  onConfirmRedDot,
  onResetChecklist,
  onResetChecklistForDeployment,
  onToggleTask,
  onAddTask,
  onDeleteTask,
  onSendTaskToCart,
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
  const [prefs, setPrefs] = useState<BanditUserPreferences>(loadUserPrefs);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeAudioGuideExp, setActiveAudioGuideExp] = useState<any | null>(null);
  const [viewAllSections, setViewAllSections] = useState(true);
  const [singleFocusActive, setSingleFocusActive] = useState(false);
  const [globalCartMode, setGlobalCartMode] = useState(false);
  const [selectedAssemblyGroup, setSelectedAssemblyGroup] = useState<string>('ALL');
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Progressive Disclosure Form States
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskGroup, setNewTaskGroup] = useState('');

  const [isAddingCart, setIsAddingCart] = useState(false);
  const [newCartTitle, setNewCartTitle] = useState('');
  const [newCartQty, setNewCartQty] = useState('1x');
  const [newCartPrice, setNewCartPrice] = useState('');

  const [isAddingExp, setIsAddingExp] = useState(false);
  const [newExpTitle, setNewExpTitle] = useState('');
  const [newExpSteps, setNewExpSteps] = useState('');
  const [editingExpId, setEditingExpId] = useState<string | null>(null);
  const [editExpTitle, setEditExpTitle] = useState('');
  const [editExpSteps, setEditExpSteps] = useState('');

  const [isAddingInfo, setIsAddingInfo] = useState(false);
  const [newInfoTitle, setNewInfoTitle] = useState('');
  const [newInfoContent, setNewInfoContent] = useState('');

  // Accordion & Tray States
  const [openExplanations, setOpenExplanations] = useState<Record<string, boolean>>({});
  const [openInfos, setOpenInfos] = useState<Record<string, boolean>>({});
  const [openProcurements, setOpenProcurements] = useState<Record<string, boolean>>({});
  const [expandedActionCards, setExpandedActionCards] = useState<Record<string, boolean>>({});

  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const drawerDragXRef = useRef<number>(0);
  const [drawerDragX, setDrawerDragX] = useState<number>(0);

  const toggleActionCard = (id: string) => {
    triggerHapticFeedback(10);
    setExpandedActionCards((prev) => ({ ...prev, [id]: !prev[id] }));
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
    const customAccent = activeProject?.customMeta?.customAccentColor as string | undefined;
    if (customAccent) {
      return { primary: customAccent, highlight: customAccent, label: activeDomain.toUpperCase() };
    }
    if (activeDomain === 'privat') {
      return { primary: '#4F46E5', highlight: '#818CF8', label: 'PRIVAT' };
    }
    if (activeProject?.id === 'proj-baeckerei') {
      return { primary: '#D97706', highlight: '#F59E0B', label: 'ARBEIT / BAUSTELLE' };
    }
    return { primary: '#0A9396', highlight: '#14B8A6', label: 'ARBEIT / BETRIEB' };
  }, [activeDomain, activeProject]);

  const projectsSource = allProjects.length > 0 ? allProjects : domainProjects;
  const workProjects = projectsSource.filter((p) => !p.archived && p.domain === 'arbeit');
  const privateProjects = projectsSource.filter((p) => !p.archived && p.domain === 'privat');

  const activePlugins = PLUGIN_REGISTRY.filter((pl) =>
    (activeProject?.enabledPlugins || []).includes(pl.id)
  );

  const assemblyGroups = useMemo(() => {
    if (!activeProject) return [];
    const groups = new Set<string>();
    activeProject.tasks.forEach((t) => {
      if (t.assemblyGroup) groups.add(t.assemblyGroup);
      else {
        const bracketMatch = t.title.match(/^\[(.*?)\]/);
        if (bracketMatch) groups.add(bracketMatch[1]);
      }
    });
    return Array.from(groups);
  }, [activeProject]);

  const sortedTasks = useMemo(() => {
    if (!activeProject) return [];
    const filtered = [...activeProject.tasks]
      .filter((t) => {
        if (searchQuery.trim() && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) {
          return false;
        }
        if (selectedAssemblyGroup !== 'ALL') {
          const matchesProp = t.assemblyGroup === selectedAssemblyGroup;
          const matchesBracket = t.title.includes(selectedAssemblyGroup);
          return matchesProp || matchesBracket;
        }
        return true;
      })
      .sort((a, b) => Number(a.completed) - Number(b.completed));

    if (prefs.adhdMasterEnabled && prefs.adhdSingleTaskMode && singleFocusActive) {
      const nextOpen = filtered.find((t) => !t.completed);
      return nextOpen ? [nextOpen] : filtered.slice(0, 1);
    }
    return filtered;
  }, [activeProject, searchQuery, selectedAssemblyGroup, prefs, singleFocusActive]);

  const displayedCart = useMemo(() => {
    if (globalCartMode && allProjects.length > 0) {
      return allProjects
        .filter((p) => !p.archived)
        .flatMap((p) =>
          p.cart.map((c) => ({
            ...c,
            originProjectId: p.id,
            originProjectName: p.name
          }))
        )
        .filter(
          (c) =>
            !searchQuery.trim() ||
            c.title.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a, b) => Number(a.completed) - Number(b.completed));
    }
    if (!activeProject) return [];
    return [...activeProject.cart]
      .map((c) => ({
        ...c,
        originProjectId: activeProject.id,
        originProjectName: activeProject.name
      }))
      .filter(
        (c) =>
          !searchQuery.trim() ||
          c.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => Number(a.completed) - Number(b.completed));
  }, [activeProject, allProjects, globalCartMode, searchQuery]);

  const selectProjectAndSection = (proj: Project, tab: ProjectTabId | 'ALL') => {
    if (proj.domain !== activeDomain) onSwitchDomain(proj.domain);
    onSelectProject(proj.id);
    setSelectedAssemblyGroup('ALL');
    if (tab === 'ALL') setViewAllSections(true);
    else {
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
    : 'Werkzeuge';

  return (
    <div
      className="relative min-h-[75vh] space-y-3.5 pb-24"
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
        className={`fixed inset-0 z-50 flex transition-opacity duration-300 ${
          drawerOpen ? 'opacity-100 pointer-events-auto' : drawerDragX > 0 ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        style={drawerDragX > 0 ? { opacity: drawerDragX / (window.innerWidth * 0.85) } : undefined}
      >
        <div
          className={`w-[85vw] max-w-sm h-full border-r border-white/10 flex flex-col justify-between overflow-y-auto shadow-2xl ${
            drawerDragX === 0 ? 'transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]' : ''
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
                  (proj.id === 'proj-baeckerei' ? '#D97706' : '#0A9396');
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
                        <button
                          type="button"
                          onClick={() => selectProjectAndSection(proj, 'explanations')}
                          className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between ${
                            !viewAllSections && activeTab === 'explanations'
                              ? 'text-white'
                              : 'bg-[#242930] text-[#9CA3AF] hover:text-white'
                          }`}
                          style={
                            !viewAllSections && activeTab === 'explanations'
                              ? { backgroundColor: pColor }
                              : {}
                          }
                        >
                          <span>Abläufe</span>
                          <span className="font-mono text-xs px-1.5 py-0.5 rounded-md bg-black/30">
                            {proj.explanations.length}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => selectProjectAndSection(proj, 'infos')}
                          className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between ${
                            !viewAllSections && activeTab === 'infos'
                              ? 'text-white'
                              : 'bg-[#242930] text-[#9CA3AF] hover:text-white'
                          }`}
                          style={
                            !viewAllSections && activeTab === 'infos'
                              ? { backgroundColor: pColor }
                              : {}
                          }
                        >
                          <span>Infos</span>
                          <span className="font-mono text-xs px-1.5 py-0.5 rounded-md bg-black/30">
                            {proj.infos.length}
                          </span>
                        </button>
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
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* PRIVAT */}
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF] px-1">
                PRIVAT
              </div>
              {privateProjects.map((proj) => {
                const isActive = activeProject?.id === proj.id;
                const pColor =
                  (proj.customMeta?.customAccentColor as string) || '#4F46E5';
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
                        <button
                          type="button"
                          onClick={() => selectProjectAndSection(proj, 'infos')}
                          className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold text-left flex items-center justify-between ${
                            !viewAllSections && activeTab === 'infos'
                              ? 'text-white'
                              : 'bg-[#242930] text-[#9CA3AF]'
                          }`}
                          style={
                            !viewAllSections && activeTab === 'infos'
                              ? { backgroundColor: pColor }
                              : {}
                          }
                        >
                          <span>Infos</span>
                          <span className="font-mono text-xs px-1.5 py-0.5 rounded-md bg-black/30">
                            {proj.infos.length}
                          </span>
                        </button>
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
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#9CA3AF]">
                BANDIT.OS • {currentSectionLabel}
              </div>
              <h2 className="text-base font-bold text-white truncate leading-tight">
                {activeProject.name}
              </h2>
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

              {/* Dynamische Baugruppen-/Phasen-Filter */}
              {assemblyGroups.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                  <button
                    type="button"
                    onClick={() => setSelectedAssemblyGroup('ALL')}
                    className={`min-h-[38px] px-3.5 rounded-xl text-xs font-bold shrink-0 border transition active:scale-95 ${
                      selectedAssemblyGroup === 'ALL'
                        ? 'text-white border-white/20'
                        : 'bg-[#242930] text-[#9CA3AF] border-white/5'
                    }`}
                    style={
                      selectedAssemblyGroup === 'ALL'
                        ? { backgroundColor: themeColors.primary }
                        : {}
                    }
                  >
                    Alle Baugruppen
                  </button>
                  {assemblyGroups.map((grp) => (
                    <button
                      type="button"
                      key={grp}
                      onClick={() => setSelectedAssemblyGroup(grp)}
                      className={`min-h-[38px] px-3.5 rounded-xl text-xs font-bold shrink-0 border transition active:scale-95 ${
                        selectedAssemblyGroup === grp
                          ? 'text-white border-white/20'
                          : 'bg-[#242930] text-[#9CA3AF] border-white/5'
                      }`}
                      style={
                        selectedAssemblyGroup === grp
                          ? { backgroundColor: themeColors.primary }
                          : {}
                      }
                    >
                      {grp}
                    </button>
                  ))}
                </div>
              )}

              {/* PROGRESSIVE DISCLOSURE: Eingabeformular für Tasks */}
              {!isAddingTask ? (
                <button
                  type="button"
                  onClick={() => setIsAddingTask(true)}
                  className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-[#242930] hover:bg-[#2A3038] text-sm font-semibold text-white/90 border border-white/5 flex items-center justify-center gap-2 active:scale-[0.99] transition shadow-sm"
                >
                  <Plus className="w-4 h-4" style={{ color: themeColors.highlight }} />
                  <span>Aufgabe hinzufügen</span>
                </button>
              ) : (
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

              {/* Tasks-Liste */}
              <div className="space-y-2">
                {sortedTasks.map((task) => {
                  const isAnchored = prefs.activeFocusTaskId === task.id;
                  const isTrayOpen = !!expandedActionCards[task.id];
                  const bracketMatch = task.title.match(/^\[(.*?)\]\s*(.*)$/);
                  const displayTitle = bracketMatch ? bracketMatch[2] : task.title;
                  const displayGroup = task.assemblyGroup || (bracketMatch ? bracketMatch[1] : null);

                  return (
                    <div
                      key={task.id}
                      id={`item-card-${task.id}`}
                      className={`rounded-2xl border transition-all duration-200 overflow-hidden shadow-sm ${
                        task.completed ? 'opacity-75' : ''
                      }`}
                      style={{
                        backgroundColor: '#242930',
                        borderColor:
                          isAnchored || highlightedItemId === task.id
                            ? themeColors.highlight
                            : 'rgba(255,255,255,0.05)'
                      }}
                    >
                      {/* Karten-Ruhezustand: Checkbox + Titel + Badges + ••• Trigger */}
                      <div className="p-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {/* Große Touch-Fläche (>= 44px) für Checkbox */}
                          <button
                            type="button"
                            onClick={() => {
                              triggerHapticFeedback([15, 40, 20]);
                              onToggleTask(activeProject.id, task.id);
                            }}
                            className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2 shrink-0 cursor-pointer"
                            aria-label={task.completed ? 'Als unerledigt markieren' : 'Als erledigt markieren'}
                          >
                            <div
                              className="w-6 h-6 rounded-lg flex items-center justify-center border transition-all active:scale-90"
                              style={{
                                backgroundColor: task.completed
                                  ? themeColors.primary
                                  : 'rgba(28,32,38,0.8)',
                                borderColor: task.completed ? themeColors.highlight : '#6B7280'
                              }}
                            >
                              {task.completed && (
                                <Check className="w-4 h-4 text-white stroke-[3]" />
                              )}
                            </div>
                          </button>

                          {/* Titel & Metadaten (Kein Durchstreichen!) */}
                          <div
                            onClick={() => toggleActionCard(task.id)}
                            className="flex-1 min-w-0 cursor-pointer select-none"
                          >
                            <span
                              className={`text-base font-semibold leading-snug block break-words ${
                                task.completed ? 'text-white/80' : 'text-white'
                              }`}
                            >
                              {displayTitle}
                            </span>

                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {task.aiTouched && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-300 bg-red-500/20 px-2 py-0.5 rounded-md border border-red-500/30">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                  KI-Vorschlag
                                </span>
                              )}

                              {displayGroup && (
                                <span className="text-[11px] font-medium text-[#9CA3AF] px-2 py-0.5 rounded-md bg-[#1C2026]">
                                  {displayGroup}
                                </span>
                              )}

                              {prefs.adhdMasterEnabled &&
                                prefs.adhdTimeBufferAndHaptics &&
                                task.estimatedMinutes && (
                                  <span className="text-[11px] font-mono text-[#9CA3AF]">
                                    {Math.round(task.estimatedMinutes * 1.25)} Min. (inkl. Puffer)
                                  </span>
                                )}
                            </div>
                          </div>
                        </div>

                        {/* Konsolidierter ••• Trigger (Große Touch-Fläche >= 44px) */}
                        <button
                          type="button"
                          onClick={() => toggleActionCard(task.id)}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2 rounded-xl text-[#9CA3AF] hover:text-white hover:bg-white/5 active:scale-95 transition cursor-pointer shrink-0"
                          aria-label="Aktionsmenü öffnen"
                        >
                          <MoreHorizontal className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Ausklappbare Aktionsleiste (Kontextbezogen, >= 44px Buttons) */}
                      {isTrayOpen && (
                        <div className="px-4 pb-4 pt-3 border-t border-white/5 space-y-2 bg-[#1C2026]/80 animate-fadeIn">
                          {/* KI-Bestätigung nur falls aiTouched */}
                          {task.aiTouched && (
                            <button
                              type="button"
                              onClick={() => {
                                onConfirmRedDot(activeProject.id, 'tasks', task.id);
                                toggleActionCard(task.id);
                              }}
                              className="w-full min-h-[44px] px-4 rounded-xl text-xs font-bold bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/30 flex items-center justify-center gap-2 active:scale-95 transition"
                            >
                              <span className="w-2 h-2 rounded-full bg-red-400" />
                              <span>KI-Änderung bestätigen &amp; Punkt schließen</span>
                            </button>
                          )}

                          <div className="grid grid-cols-2 gap-2">
                            {/* In Google Kalender eintragen */}
                            <button
                              type="button"
                              onClick={() => {
                                window.open(
                                  buildGoogleCalendarTemplateUrl(task, activeProject.name),
                                  '_blank'
                                );
                              }}
                              className="min-h-[44px] px-3.5 rounded-xl text-xs font-semibold bg-[#242930] hover:bg-[#2A3038] text-white hover:text-[#14B8A6] border border-white/5 flex items-center justify-center gap-2 active:scale-95 transition"
                            >
                              <Calendar className="w-4 h-4 text-[#14B8A6]" />
                              <span>Google Kalender</span>
                            </button>

                            {/* In Einkaufswagen übernehmen: Nur wenn noch nicht erledigt */}
                            {!task.completed ? (
                              <button
                                type="button"
                                onClick={() => {
                                  if (onSendTaskToCart) {
                                    onSendTaskToCart(activeProject.id, task.title);
                                  } else {
                                    onAddCartItems(activeProject.id, [
                                      {
                                        title: task.title,
                                        quantity: '1x',
                                        price: '',
                                        reason: 'Aus Tasks übernommen'
                                      }
                                    ]);
                                  }
                                  toggleActionCard(task.id);
                                  onNotify('In Einkaufswagen übernommen.');
                                }}
                                className="min-h-[44px] px-3.5 rounded-xl text-xs font-semibold bg-[#242930] hover:bg-[#2A3038] text-white border border-white/5 flex items-center justify-center gap-2 active:scale-95 transition"
                              >
                                <ShoppingCart className="w-4 h-4 text-[#14B8A6]" />
                                <span>In Einkaufswagen</span>
                              </button>
                            ) : (
                              <div />
                            )}

                            {/* ADHS Fokus-Anker */}
                            {prefs.adhdMasterEnabled && prefs.adhdFocusAnchor && (
                              <button
                                type="button"
                                onClick={() => {
                                  updatePrefs({
                                    activeFocusTaskId: isAnchored ? null : task.id,
                                    activeFocusTaskTitle: isAnchored ? null : task.title,
                                    activeFocusProjectId: isAnchored ? null : activeProject.id
                                  });
                                  toggleActionCard(task.id);
                                }}
                                className={`min-h-[44px] px-3.5 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 active:scale-95 transition ${
                                  isAnchored
                                    ? 'text-white border-white/20'
                                    : 'bg-[#242930] text-[#9CA3AF] hover:text-white border-white/5'
                                }`}
                                style={
                                  isAnchored ? { backgroundColor: themeColors.primary } : {}
                                }
                              >
                                <Crosshair className="w-4 h-4" />
                                <span>{isAnchored ? 'Fokus lösen' : 'Als Fokus anpinnen'}</span>
                              </button>
                            )}

                            {/* Löschen */}
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteTask(activeProject.id, task.id);
                                onNotify('Aufgabe gelöscht.');
                              }}
                              className="min-h-[44px] px-3.5 rounded-xl text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 flex items-center justify-center gap-2 active:scale-95 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>Löschen</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ================================================================ */}
          {/* SEKTION 2: EINKAUFSWAGEN */}
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
                  <h3 className="text-base font-bold text-white tracking-wide">
                    Einkaufswagen
                  </h3>
                  <span className="text-xs font-semibold text-[#9CA3AF] px-2 py-0.5 rounded-full bg-[#242930]">
                    {displayedCart.filter((c) => !c.completed).length} offen
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setGlobalCartMode((g) => !g)}
                  className={`min-h-[44px] px-3.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition active:scale-95 ${
                    globalCartMode
                      ? 'text-white border-white/30'
                      : 'bg-[#242930] text-[#9CA3AF] border-white/5'
                  }`}
                  style={globalCartMode ? { backgroundColor: themeColors.primary } : {}}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>{globalCartMode ? 'Alle Projekte' : 'Nur Projekt'}</span>
                </button>
              </div>

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
                    onAddCartItems(activeProject.id, [
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

              {/* Einkaufswagen-Liste */}
              <div className="space-y-2">
                {displayedCart.map((item) => {
                  const isProcOpen = !!openProcurements[item.id];
                  const isTrayOpen = !!expandedActionCards[item.id];

                  return (
                    <div
                      key={`${item.originProjectId}-${item.id}`}
                      id={`item-card-${item.id}`}
                      className={`rounded-2xl border transition-all duration-200 overflow-hidden shadow-sm ${
                        item.completed ? 'opacity-75' : ''
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

                          {/* Titel & Metadaten (Kein Durchstreichen!) */}
                          <div
                            onClick={() => toggleActionCard(item.id)}
                            className="flex-1 min-w-0 cursor-pointer select-none"
                          >
                            <span
                              className={`text-base font-semibold leading-snug block truncate ${
                                item.completed ? 'text-white/80' : 'text-white'
                              }`}
                            >
                              {item.title}
                            </span>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span
                                className="text-xs font-semibold"
                                style={{ color: themeColors.highlight }}
                              >
                                Menge: {item.quantity}
                              </span>

                              {item.price && (
                                <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                                  {item.price}
                                </span>
                              )}

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
                        </div>

                        {/* Konsolidierter ••• Trigger */}
                        <button
                          type="button"
                          onClick={() => toggleActionCard(item.id)}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2 rounded-xl text-[#9CA3AF] hover:text-white hover:bg-white/5 active:scale-95 transition cursor-pointer shrink-0"
                          aria-label="Aktionsmenü öffnen"
                        >
                          <MoreHorizontal className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Ausklappbare Aktionsleiste */}
                      {isTrayOpen && (
                        <div className="px-4 pb-4 pt-3 border-t border-white/5 space-y-2 bg-[#1C2026]/80 animate-fadeIn">
                          {item.aiTouched && (
                            <button
                              type="button"
                              onClick={() => {
                                onConfirmRedDot(item.originProjectId, 'cart', item.id);
                                toggleActionCard(item.id);
                              }}
                              className="w-full min-h-[44px] px-4 rounded-xl text-xs font-bold bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/30 flex items-center justify-center gap-2 active:scale-95 transition"
                            >
                              <span className="w-2 h-2 rounded-full bg-red-400" />
                              <span>KI-Änderung bestätigen</span>
                            </button>
                          )}

                          <div className="flex items-center gap-2">
                            {/* Beschaffungs-Check / Preisvergleich: Nur wenn unvollständig */}
                            {!item.completed && (
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenProcurements((p) => ({
                                    ...p,
                                    [item.id]: !p[item.id]
                                  }))
                                }
                                className={`flex-1 min-h-[44px] px-3.5 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 active:scale-95 transition ${
                                  isProcOpen
                                    ? 'text-white border-white/30'
                                    : 'bg-[#242930] hover:bg-[#2A3038] text-white border-white/5'
                                }`}
                                style={
                                  isProcOpen ? { backgroundColor: themeColors.primary } : {}
                                }
                              >
                                <Scale className="w-4 h-4 text-[#14B8A6]" />
                                <span>{isProcOpen ? 'Vergleich schließen' : 'Beschaffungs-Check'}</span>
                              </button>
                            )}

                            {/* Löschen */}
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteCartItem(item.originProjectId, item.id);
                                onNotify('Artikel entfernt.');
                              }}
                              className="min-h-[44px] px-4 rounded-xl text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 flex items-center justify-center gap-2 active:scale-95 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>Löschen</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Beschaffungs-Check Panel */}
                      {isProcOpen && (
                        <div className="border-t border-white/5 bg-[#1C2026]">
                          <ProcurementCheckPanel
                            title={item.title}
                            customCheck={item.procurementCheck}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ================================================================ */}
          {/* SEKTION 3: ABLÄUFE & ERKLÄRUNGEN */}
          {/* ================================================================ */}
          {showExplanationsSection && (
            <section
              className="rounded-3xl border border-white/5 p-5 space-y-4 shadow-xl transition-all"
              style={{ backgroundColor: '#1C2026' }}
            >
              <div className="flex items-center gap-2.5">
                <BookOpen
                  className="w-5 h-5"
                  style={{ color: themeColors.highlight }}
                />
                <h3 className="text-base font-bold text-white tracking-wide">
                  Abläufe &amp; Erklärungen
                </h3>
                <span className="text-xs font-semibold text-[#9CA3AF] px-2 py-0.5 rounded-full bg-[#242930]">
                  {activeProject.explanations.length}
                </span>
              </div>

              {/* PROGRESSIVE DISCLOSURE: Eingabeformular für Abläufe */}
              {!isAddingExp ? (
                <button
                  type="button"
                  onClick={() => setIsAddingExp(true)}
                  className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-[#242930] hover:bg-[#2A3038] text-sm font-semibold text-white/90 border border-white/5 flex items-center justify-center gap-2 active:scale-[0.99] transition shadow-sm"
                >
                  <Plus className="w-4 h-4" style={{ color: themeColors.highlight }} />
                  <span>Ablauf hinzufügen</span>
                </button>
              ) : (
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
                    setIsAddingExp(false);
                    onNotify('Ablauf gespeichert.');
                  }}
                  className="p-4 rounded-2xl bg-[#242930] border border-white/10 space-y-3 shadow-inner"
                >
                  <input
                    type="text"
                    autoFocus
                    value={newExpTitle}
                    onChange={(e) => setNewExpTitle(e.target.value)}
                    placeholder="Titel des Ablaufs (z.B. Ofen einbrennen)..."
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-sm bg-[#1C2026] text-white border border-white/10 placeholder-[#9CA3AF] focus:outline-none focus:border-white/20"
                  />
                  <textarea
                    rows={4}
                    value={newExpSteps}
                    onChange={(e) => setNewExpSteps(e.target.value)}
                    placeholder="Einzelschritte (Schritt für Schritt notieren)..."
                    className="w-full p-3.5 rounded-xl text-sm bg-[#1C2026] text-white border border-white/10 placeholder-[#9CA3AF] focus:outline-none focus:border-white/20"
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingExp(false);
                        setNewExpTitle('');
                        setNewExpSteps('');
                      }}
                      className="min-h-[44px] px-4 rounded-xl text-xs font-semibold text-[#9CA3AF] hover:text-white transition"
                    >
                      Abbrechen
                    </button>
                    <button
                      type="submit"
                      disabled={!newExpTitle.trim()}
                      className="min-h-[44px] px-5 rounded-xl text-xs font-bold text-white shadow-md active:scale-95 transition disabled:opacity-40"
                      style={{ backgroundColor: themeColors.primary }}
                    >
                      Speichern
                    </button>
                  </div>
                </form>
              )}

              {/* Abläufe-Liste */}
              <div className="space-y-2">
                {activeProject.explanations.map((exp) => {
                  const isOpen = !!openExplanations[exp.id];
                  const isEditing = editingExpId === exp.id;

                  return (
                    <div
                      key={exp.id}
                      id={`item-card-${exp.id}`}
                      className="rounded-2xl border border-white/5 overflow-hidden transition-all shadow-sm"
                      style={{ backgroundColor: '#242930' }}
                    >
                      {/* Karten-Ruhezustand */}
                      <div
                        onClick={() =>
                          setOpenExplanations((p) => ({ ...p, [exp.id]: !p[exp.id] }))
                        }
                        className="p-4 flex items-center justify-between gap-3 cursor-pointer select-none"
                      >
                        <span className="text-base font-semibold text-white truncate flex-1">
                          {exp.title}
                        </span>

                        <div className="flex items-center gap-1 shrink-0">
                          <div className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[#9CA3AF]">
                            {isOpen ? (
                              <ChevronUp className="w-5 h-5" />
                            ) : (
                              <ChevronDown className="w-5 h-5" />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Aufgeklappter Zustand */}
                      {isOpen && (
                        <div className="px-4 pb-4 pt-2 border-t border-white/5 space-y-3 bg-[#1C2026]/70 animate-fadeIn">
                          {isEditing ? (
                            <div className="space-y-3 pt-2">
                              <input
                                type="text"
                                value={editExpTitle}
                                onChange={(e) => setEditExpTitle(e.target.value)}
                                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl text-sm bg-[#242930] text-white border border-white/10"
                              />
                              <textarea
                                rows={5}
                                value={editExpSteps}
                                onChange={(e) => setEditExpSteps(e.target.value)}
                                className="w-full p-3 rounded-xl text-sm bg-[#242930] text-white border border-white/10 font-mono"
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingExpId(null)}
                                  className="min-h-[44px] px-4 rounded-xl text-xs font-semibold text-[#9CA3AF] hover:text-white"
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
                                    onNotify('Ablauf aktualisiert.');
                                  }}
                                  className="min-h-[44px] px-5 rounded-xl text-xs font-bold text-white shadow-md"
                                  style={{ backgroundColor: themeColors.primary }}
                                >
                                  Speichern
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="text-sm text-[#F8F9FA] leading-relaxed whitespace-pre-line py-2">
                                {exp.stepsText}
                              </div>

                              <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                                {/* Freihändig vorlesen */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveAudioGuideExp(exp);
                                  }}
                                  className="min-h-[44px] px-4 rounded-xl bg-[#242930] hover:bg-[#2A3038] text-[#14B8A6] hover:text-white text-xs font-bold flex items-center gap-2 border border-[#14B8A6]/30 active:scale-95 transition"
                                  title="Freihändig Schritt für Schritt vorlesen lassen"
                                >
                                  <Volume2 className="w-4 h-4" />
                                  <span>Freihändig vorlesen</span>
                                </button>

                                {/* Bearbeiten */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingExpId(exp.id);
                                    setEditExpTitle(exp.title);
                                    setEditExpSteps(exp.stepsText);
                                  }}
                                  className="min-h-[44px] px-4 rounded-xl bg-[#242930] hover:bg-[#2A3038] text-[#9CA3AF] hover:text-white text-xs font-semibold flex items-center gap-2 border border-white/5 active:scale-95 transition"
                                >
                                  <Edit3 className="w-4 h-4" />
                                  <span>Bearbeiten</span>
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ================================================================ */}
          {/* SEKTION 4: INFOS, MASSE & DATEIEN */}
          {/* ================================================================ */}
          {showInfosSection && (
            <section
              className="rounded-3xl border border-white/5 p-5 space-y-4 shadow-xl transition-all"
              style={{ backgroundColor: '#1C2026' }}
            >
              <div className="flex items-center gap-2.5">
                <FileText
                  className="w-5 h-5"
                  style={{ color: themeColors.highlight }}
                />
                <h3 className="text-base font-bold text-white tracking-wide">
                  Infos, Maße &amp; Dateien
                </h3>
                <span className="text-xs font-semibold text-[#9CA3AF] px-2 py-0.5 rounded-full bg-[#242930]">
                  {activeProject.infos.length}
                </span>
              </div>

              {/* PROGRESSIVE DISCLOSURE: Eingabeformular für Infos */}
              {!isAddingInfo ? (
                <button
                  type="button"
                  onClick={() => setIsAddingInfo(true)}
                  className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-[#242930] hover:bg-[#2A3038] text-sm font-semibold text-white/90 border border-white/5 flex items-center justify-center gap-2 active:scale-[0.99] transition shadow-sm"
                >
                  <Plus className="w-4 h-4" style={{ color: themeColors.highlight }} />
                  <span>Notiz / Info hinzufügen</span>
                </button>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newInfoTitle.trim()) return;
                    onAddInfo(activeProject.id, newInfoTitle.trim(), newInfoContent.trim());
                    setNewInfoTitle('');
                    setNewInfoContent('');
                    setIsAddingInfo(false);
                    onNotify('Info gespeichert.');
                  }}
                  className="p-4 rounded-2xl bg-[#242930] border border-white/10 space-y-3 shadow-inner"
                >
                  <input
                    type="text"
                    autoFocus
                    value={newInfoTitle}
                    onChange={(e) => setNewInfoTitle(e.target.value)}
                    placeholder="Titel der Info / Maße..."
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-sm bg-[#1C2026] text-white border border-white/10 placeholder-[#9CA3AF] focus:outline-none focus:border-white/20"
                  />
                  <textarea
                    rows={3}
                    value={newInfoContent}
                    onChange={(e) => setNewInfoContent(e.target.value)}
                    placeholder="Details, Notizen, Kennzahlen..."
                    className="w-full p-3.5 rounded-xl text-sm bg-[#1C2026] text-white border border-white/10 placeholder-[#9CA3AF] focus:outline-none focus:border-white/20"
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingInfo(false);
                        setNewInfoTitle('');
                        setNewInfoContent('');
                      }}
                      className="min-h-[44px] px-4 rounded-xl text-xs font-semibold text-[#9CA3AF] hover:text-white transition"
                    >
                      Abbrechen
                    </button>
                    <button
                      type="submit"
                      disabled={!newInfoTitle.trim()}
                      className="min-h-[44px] px-5 rounded-xl text-xs font-bold text-white shadow-md active:scale-95 transition disabled:opacity-40"
                      style={{ backgroundColor: themeColors.primary }}
                    >
                      Speichern
                    </button>
                  </div>
                </form>
              )}

              {/* Infos-Liste */}
              <div className="space-y-2">
                {activeProject.infos.map((info) => {
                  const isOpen = !!openInfos[info.id];

                  return (
                    <div
                      key={info.id}
                      id={`item-card-${info.id}`}
                      className="rounded-2xl border border-white/5 overflow-hidden transition-all shadow-sm"
                      style={{ backgroundColor: '#242930' }}
                    >
                      {/* Karten-Ruhezustand */}
                      <div
                        onClick={() =>
                          setOpenInfos((p) => ({ ...p, [info.id]: !p[info.id] }))
                        }
                        className="p-4 flex items-center justify-between gap-3 cursor-pointer select-none"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="text-base font-semibold text-white block truncate">
                            {info.title}
                          </span>
                          {info.attachments.length > 0 && (
                            <span className="text-[11px] font-medium text-[#14B8A6] mt-0.5 inline-block">
                              {info.attachments.length} Anhang{info.attachments.length > 1 ? 'änge' : ''}
                            </span>
                          )}
                        </div>

                        <div className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[#9CA3AF]">
                          {isOpen ? (
                            <ChevronUp className="w-5 h-5" />
                          ) : (
                            <ChevronDown className="w-5 h-5" />
                          )}
                        </div>
                      </div>

                      {/* Aufgeklappter Zustand */}
                      {isOpen && (
                        <div className="px-4 pb-4 pt-2 border-t border-white/5 space-y-3 bg-[#1C2026]/70 animate-fadeIn">
                          {info.content && (
                            <div className="text-sm text-[#F8F9FA] leading-relaxed whitespace-pre-line py-2">
                              {info.content}
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-2 border-t border-white/5">
                            <span className="text-xs font-semibold text-[#9CA3AF]">
                              Anhänge ({info.attachments.length})
                            </span>
                            <label
                              className="cursor-pointer min-h-[44px] px-4 rounded-xl text-xs font-bold text-white flex items-center gap-2 shadow-sm active:scale-95 transition"
                              style={{ backgroundColor: themeColors.primary }}
                            >
                              <Upload className="w-4 h-4" />
                              <span>Foto / PDF hochladen</span>
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
                              className="min-h-[48px] p-3 rounded-xl bg-[#242930] hover:bg-[#2A3038] border border-white/5 flex items-center justify-between text-xs cursor-pointer active:scale-[0.99] transition"
                            >
                              <span className="text-white font-medium truncate">{att.name}</span>
                              <span className="text-xs font-semibold text-[#14B8A6] ml-2 shrink-0">
                                Öffnen / Maß-Pin ({att.size})
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

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
