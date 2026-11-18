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
  onResetProjectLogo,
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

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskGroup, setNewTaskGroup] = useState('');
  const [newExpTitle, setNewExpTitle] = useState('');
  const [newExpSteps, setNewExpSteps] = useState('');
  const [editingExpId, setEditingExpId] = useState<string | null>(null);
  const [editExpTitle, setEditExpTitle] = useState('');
  const [editExpSteps, setEditExpSteps] = useState('');
  const [newInfoTitle, setNewInfoTitle] = useState('');
  const [newInfoContent, setNewInfoContent] = useState('');
  const [newCartTitle, setNewCartTitle] = useState('');
  const [newCartQty, setNewCartQty] = useState('1x');
  const [newCartPrice, setNewCartPrice] = useState('');

  const [openExplanations, setOpenExplanations] = useState<Record<string, boolean>>({});
  const [openInfos, setOpenInfos] = useState<Record<string, boolean>>({});
  const [openProcurements, setOpenProcurements] = useState<Record<string, boolean>>({});

  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartXRef.current = t.clientX;
    touchStartYRef.current = t.clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const t = e.changedTouches[0];
    const deltaX = t.clientX - touchStartXRef.current;
    const deltaY = Math.abs(t.clientY - touchStartYRef.current);

    if (!drawerOpen && touchStartXRef.current < 90 && deltaX > 60 && deltaY < 60) {
      setDrawerOpen(true);
    } else if (drawerOpen && deltaX < -60 && deltaY < 60) {
      setDrawerOpen(false);
    }
    touchStartXRef.current = null;
    touchStartYRef.current = null;
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

  // Update 6 (Erweiterung): Automatische Extraktion aller Baugruppen / Phasen des Projekts
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

    // ADHS 1-Fokus-Blende: Zeigt nur die nächste einzelne offene Aufgabe
    if (prefs.adhdMasterEnabled && prefs.adhdSingleTaskMode && singleFocusActive) {
      const nextOpen = filtered.find((t) => !t.completed);
      return nextOpen ? [nextOpen] : filtered.slice(0, 1);
    }
    return filtered;
  }, [activeProject, searchQuery, selectedAssemblyGroup, prefs, singleFocusActive]);

  // Update 2: Projektübergreifender Sammel-Einkaufswagen
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

  // UI-Dichte (Update 5: Personalisierung)
  const cardPadding =
    prefs.uiDensity === 'large'
      ? 'p-3.5'
      : prefs.uiDensity === 'compact'
      ? 'p-2'
      : 'p-2.5';
  const titleFontSize =
    prefs.uiDensity === 'large'
      ? 'text-sm font-bold'
      : prefs.uiDensity === 'compact'
      ? 'text-[11px] font-semibold'
      : 'text-xs font-semibold';

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
      className="relative min-h-[75vh] space-y-3"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Organische Ambient-Aura im Hintergrund */}
      {prefs.organicMotion && (
        <div
          className="pointer-events-none fixed top-6 left-1/2 -translate-x-1/2 w-80 h-36 rounded-full blur-3xl opacity-20 transition-all duration-700"
          style={{ backgroundColor: themeColors.primary }}
        />
      )}

      {/* ADHS-FUNKTION 1: "WO WAR ICH GERADE?"-ANKER (Roter Faden oben angepinnt) */}
      {prefs.adhdMasterEnabled &&
        prefs.adhdFocusAnchor &&
        prefs.activeFocusTaskTitle && (
          <div
            className="p-2.5 rounded-2xl border flex items-center justify-between gap-2 shadow-lg transition-all duration-300"
            style={{
              backgroundColor: '#1E2328',
              borderColor: themeColors.highlight
            }}
          >
            <div
              className="flex items-center gap-2 min-w-0 cursor-pointer"
              onClick={() => {
                if (prefs.activeFocusProjectId) {
                  onSelectProject(prefs.activeFocusProjectId);
                }
              }}
            >
              <Crosshair
                className="w-4 h-4 shrink-0 animate-pulse"
                style={{ color: themeColors.highlight }}
              />
              <div className="min-w-0">
                <div className="text-[9px] font-extrabold uppercase tracking-wider text-[#9CA3AF]">
                  Aktiver Fokus-Anker (Gerade dran)
                </div>
                <div className="text-xs font-bold text-white truncate">
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
              className="px-2 py-1 rounded-lg text-[10px] bg-white/5 text-[#9CA3AF] hover:text-white shrink-0"
            >
              Lösen
            </button>
          </div>
        )}

      {/* LINKER SWIPE-DRAWER (Mit sanfter Feder-Physik) */}
      <div
        className={`fixed inset-0 z-50 flex transition-opacity duration-300 ${
          drawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div
          className={`w-[82vw] max-w-xs h-full border-r border-white/15 flex flex-col justify-between overflow-y-auto shadow-2xl transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            drawerOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          style={{ backgroundColor: THEME.bgCard }}
        >
          <div className="p-4 space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <div className="text-xs font-extrabold uppercase tracking-wider text-white">
                  BANDIT.OS Navigation
                </div>
                <div className="text-[10px] text-[#9CA3AF]">
                  Projekt &amp; Arbeitsbereich wählen
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-white bg-[#181A1B]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ARBEIT */}
            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] px-1">
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
                    className="rounded-xl border overflow-hidden transition-all"
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

                    {isActive && (
                      <div className="p-2 pt-1 grid grid-cols-2 gap-1.5 border-t border-white/5">
                        <button
                          type="button"
                          onClick={() => selectProjectAndSection(proj, 'ALL')}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-between ${
                            viewAllSections
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
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-between ${
                            !viewAllSections && activeTab === 'tasks'
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
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-between ${
                            !viewAllSections && activeTab === 'cart'
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
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-between ${
                            !viewAllSections && activeTab === 'explanations'
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
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-between ${
                            !viewAllSections && activeTab === 'infos'
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
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-between ${
                            !viewAllSections && activeTab === 'extras'
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

            {/* PRIVAT */}
            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] px-1">
                PRIVAT
              </div>
              {privateProjects.map((proj) => {
                const isActive = activeProject?.id === proj.id;
                const pColor =
                  (proj.customMeta?.customAccentColor as string) || '#4F46E5';
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

                    {isActive && (
                      <div className="p-2 pt-1 grid grid-cols-2 gap-1.5 border-t border-white/5">
                        <button
                          type="button"
                          onClick={() => selectProjectAndSection(proj, 'ALL')}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-left ${
                            viewAllSections ? 'text-white' : 'bg-[#24292E] text-[#9CA3AF]'
                          }`}
                          style={viewAllSections ? { backgroundColor: pColor } : {}}
                        >
                          Gesamt
                        </button>
                        <button
                          type="button"
                          onClick={() => selectProjectAndSection(proj, 'tasks')}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-left ${
                            !viewAllSections && activeTab === 'tasks'
                              ? 'text-white'
                              : 'bg-[#24292E] text-[#9CA3AF]'
                          }`}
                          style={
                            !viewAllSections && activeTab === 'tasks'
                              ? { backgroundColor: pColor }
                              : {}
                          }
                        >
                          Tasks ({proj.tasks.filter((t) => !t.completed).length})
                        </button>
                        <button
                          type="button"
                          onClick={() => selectProjectAndSection(proj, 'cart')}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-left ${
                            !viewAllSections && activeTab === 'cart'
                              ? 'text-white'
                              : 'bg-[#24292E] text-[#9CA3AF]'
                          }`}
                          style={
                            !viewAllSections && activeTab === 'cart'
                              ? { backgroundColor: pColor }
                              : {}
                          }
                        >
                          Einkauf ({proj.cart.filter((c) => !c.completed).length})
                        </button>
                        <button
                          type="button"
                          onClick={() => selectProjectAndSection(proj, 'infos')}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-left ${
                            !viewAllSections && activeTab === 'infos'
                              ? 'text-white'
                              : 'bg-[#24292E] text-[#9CA3AF]'
                          }`}
                          style={
                            !viewAllSections && activeTab === 'infos'
                              ? { backgroundColor: pColor }
                              : {}
                          }
                        >
                          Infos ({proj.infos.length})
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

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
                onOpenDeepResearchModal?.();
              }}
              className="w-full py-2 px-3 rounded-xl text-xs font-semibold bg-[#24292E] text-white border border-white/10 flex items-center gap-2 hover:bg-[#2A3036]"
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
              className="w-full py-2.5 px-3 rounded-xl text-xs font-bold text-white flex items-center gap-2"
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

      {/* SCHLANKE PROJEKT-KOPFZEILE */}
      {activeProject && (
        <div
          className="p-3 rounded-2xl border flex items-center justify-between gap-2 shadow-md transition-colors duration-500"
          style={{
            backgroundColor: THEME.bgCard,
            borderColor: `${themeColors.primary}66`
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="p-2 rounded-xl text-white shrink-0 active:scale-95 transition"
              style={{ backgroundColor: themeColors.primary }}
            >
              <Menu className="w-4 h-4" />
            </button>

            <div className="relative shrink-0">
              <ProjectAvatar project={activeProject} sizeClass="w-8 h-8" />
              <label
                title="Projekt-Logo ändern"
                className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full text-white flex items-center justify-center cursor-pointer border border-black"
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
              <h2 className="text-xs sm:text-sm font-bold text-white truncate">
                {activeProject.name}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setViewAllSections((v) => !v)}
              className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold border border-white/10 text-white transition"
              style={{
                backgroundColor: viewAllSections ? themeColors.primary : '#181A1B'
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
              className="p-2 rounded-lg bg-[#181A1B] text-[#9CA3AF] hover:text-white border border-white/10"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {showSearch && activeProject && (
        <div className="px-3 py-2 rounded-xl border border-white/15 bg-[#181A1B] flex items-center gap-2">
          <Search className="w-3.5 h-3.5 text-[#9CA3AF]" />
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

      {/* HAUPTARBEITSFELD */}
      {activeProject && (
        <div className="space-y-4">
          {/* SEKTION 1: TASKS (inkl. Baugruppen-Filter & ADHS 1-Fokus-Blende) */}
          {showTasksSection && (
            <section
              className="rounded-2xl border border-white/10 p-3 space-y-2.5 transition-all"
              style={{ backgroundColor: THEME.bgCard }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckSquare
                    className="w-4 h-4"
                    style={{ color: themeColors.highlight }}
                  />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                    Tasks ({activeProject.tasks.filter((t) => !t.completed).length} offen)
                  </h3>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* ADHS-FUNKTION 2: 1-FOKUS-BLENDE */}
                  {prefs.adhdMasterEnabled && prefs.adhdSingleTaskMode && (
                    <button
                      type="button"
                      onClick={() => setSingleFocusActive((s) => !s)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border flex items-center gap-1 transition ${
                        singleFocusActive
                          ? 'text-white border-white/30'
                          : 'bg-[#181A1B] text-[#9CA3AF] border-white/10'
                      }`}
                      style={
                        singleFocusActive ? { backgroundColor: themeColors.primary } : {}
                      }
                      title="Blendet alle Punkte bis auf die nächste einzelne Aufgabe aus"
                    >
                      <Eye className="w-3 h-3" />
                      <span>{singleFocusActive ? '1-Fokus Aktiv' : '1-Fokus'}</span>
                    </button>
                  )}

                  {activeProject.tasks.some((t) => t.completed) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (onResetChecklist) onResetChecklist(activeProject.id);
                        else if (onResetChecklistForDeployment)
                          onResetChecklistForDeployment(activeProject.id);
                      }}
                      className="px-2 py-1 rounded-lg bg-[#181A1B] text-[10px] text-[#9CA3AF] hover:text-white border border-white/10 flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Update 6 (Erweiterung): Dynamische Baugruppen-/Phasen-Filter */}
              {assemblyGroups.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  <button
                    type="button"
                    onClick={() => setSelectedAssemblyGroup('ALL')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold shrink-0 border transition ${
                      selectedAssemblyGroup === 'ALL'
                        ? 'text-white border-white/25'
                        : 'bg-[#181A1B] text-[#9CA3AF] border-white/10'
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
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold shrink-0 border transition ${
                        selectedAssemblyGroup === grp
                          ? 'text-white border-white/25'
                          : 'bg-[#181A1B] text-[#9CA3AF] border-white/10'
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

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newTaskTitle.trim()) return;
                  const finalTitle = newTaskGroup.trim()
                    ? `[${newTaskGroup.trim()}] ${newTaskTitle.trim()}`
                    : newTaskTitle.trim();
                  onAddTask(activeProject.id, finalTitle, 'Mittel', 25);
                  setNewTaskTitle('');
                }}
                className="flex items-center gap-1.5"
              >
                <input
                  type="text"
                  value={newTaskGroup}
                  onChange={(e) => setNewTaskGroup(e.target.value)}
                  placeholder="Baugruppe (opt.)"
                  className="w-28 px-2.5 py-2 rounded-xl text-xs bg-[#181A1B] text-white border border-white/10 focus:outline-none"
                />
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
                {sortedTasks.map((task) => {
                  const isAnchored = prefs.activeFocusTaskId === task.id;
                  return (
                    <div
                      key={task.id}
                      id={`item-card-${task.id}`}
                      className={`${cardPadding} rounded-xl border flex items-center justify-between gap-2 transition-all duration-300 active:scale-[0.99] ${
                        task.completed ? 'opacity-70' : ''
                      }`}
                      style={{
                        backgroundColor: THEME.bgSub,
                        borderColor:
                          isAnchored || highlightedItemId === task.id
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
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            triggerHapticFeedback([15, 40, 20]);
                            onToggleTask(activeProject.id, task.id);
                          }}
                          className="w-5 h-5 rounded-md flex items-center justify-center border shrink-0 transition-transform active:scale-75"
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
                        <div
                          onClick={() => {
                            triggerHapticFeedback(12);
                            onToggleTask(activeProject.id, task.id);
                          }}
                          className="flex-1 min-w-0 cursor-pointer"
                        >
                          <span className={`${titleFontSize} text-[#F8F9FA] leading-snug block`}>
                            {task.title}
                          </span>
                          {prefs.adhdMasterEnabled &&
                            prefs.adhdTimeBufferAndHaptics &&
                            task.estimatedMinutes && (
                              <span className="text-[10px] font-mono text-[#9CA3AF]">
                                Planzeit inkl. Puffer: {Math.round(task.estimatedMinutes * 1.25)} Min.
                              </span>
                            )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {/* ADHS Fokus-Anker Pin */}
                        {prefs.adhdMasterEnabled && prefs.adhdFocusAnchor && (
                          <button
                            type="button"
                            onClick={() =>
                              updatePrefs({
                                activeFocusTaskId: isAnchored ? null : task.id,
                                activeFocusTaskTitle: isAnchored ? null : task.title,
                                activeFocusProjectId: isAnchored ? null : activeProject.id
                              })
                            }
                            title="Als 'Gerade dran' oben anpinnen"
                            className={`p-1.5 rounded-lg border ${
                              isAnchored
                                ? 'text-white border-white/30'
                                : 'bg-[#181A1B] text-[#9CA3AF] hover:text-white border-white/10'
                            }`}
                            style={
                              isAnchored ? { backgroundColor: themeColors.primary } : {}
                            }
                          >
                            <Crosshair className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            window.open(
                              buildGoogleCalendarTemplateUrl(task, activeProject.name),
                              '_blank'
                            );
                          }}
                          className="p-1.5 rounded-lg bg-[#181A1B] text-[#9CA3AF] hover:text-[#14B8A6] border border-white/10"
                          title="In Google Kalender eintragen"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (onSendTaskToCart)
                              onSendTaskToCart(activeProject.id, task.title);
                            else
                              onAddCartItems(activeProject.id, [
                                {
                                  title: task.title,
                                  quantity: '1x',
                                  price: '',
                                  reason: 'Aus Tasks übernommen'
                                }
                              ]);
                          }}
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
                  );
                })}
              </div>
            </section>
          )}

          {/* SEKTION 2: EINKAUFSWAGEN (Mit Update 2: Projektübergreifender Sammel-Einkauf) */}
          {showCartSection && (
            <section
              className="rounded-2xl border border-white/10 p-3 space-y-2.5"
              style={{ backgroundColor: THEME.bgCard }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShoppingCart
                    className="w-4 h-4"
                    style={{ color: themeColors.highlight }}
                  />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                    Einkaufswagen ({displayedCart.filter((c) => !c.completed).length} offen)
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => setGlobalCartMode((g) => !g)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border flex items-center gap-1 transition ${
                    globalCartMode
                      ? 'text-white border-white/30'
                      : 'bg-[#181A1B] text-[#9CA3AF] border-white/10'
                  }`}
                  style={globalCartMode ? { backgroundColor: themeColors.primary } : {}}
                >
                  <Layers className="w-3 h-3" />
                  <span>{globalCartMode ? 'Alle Projekte (Sammel-Liste)' : 'Nur Projekt'}</span>
                </button>
              </div>

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
                }}
                className="flex items-center gap-1.5"
              >
                <input
                  type="text"
                  value={newCartTitle}
                  onChange={(e) => setNewCartTitle(e.target.value)}
                  placeholder="Material / Artikel..."
                  className="flex-1 px-3 py-2 rounded-xl text-xs bg-[#181A1B] text-white border border-white/10"
                />
                <input
                  type="text"
                  value={newCartQty}
                  onChange={(e) => setNewCartQty(e.target.value)}
                  placeholder="Menge"
                  className="w-16 px-2 py-2 rounded-xl text-xs bg-[#181A1B] text-white border border-white/10"
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
                {displayedCart.map((item) => {
                  const isProcOpen = !!openProcurements[item.id];
                  return (
                    <div
                      key={`${item.originProjectId}-${item.id}`}
                      id={`item-card-${item.id}`}
                      className={`rounded-xl border border-white/10 overflow-hidden transition-all ${
                        item.completed ? 'opacity-70' : ''
                      }`}
                      style={{ backgroundColor: THEME.bgSub }}
                    >
                      <div className={`${cardPadding} flex items-center justify-between gap-2`}>
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={() => {
                              triggerHapticFeedback(15);
                              onToggleCartItem(item.originProjectId, item.id);
                            }}
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
                            onClick={() => onToggleCartItem(item.originProjectId, item.id)}
                            className="min-w-0 flex-1 cursor-pointer"
                          >
                            <span className={`${titleFontSize} text-[#F8F9FA] block truncate`}>
                              {item.title}
                            </span>
                            <div className="flex items-center gap-2">
                              <span
                                className="text-[10px] font-mono"
                                style={{ color: themeColors.highlight }}
                              >
                                Menge: {item.quantity}
                              </span>
                              {globalCartMode && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-black/30 text-[#9CA3AF]">
                                  {item.originProjectName}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenProcurements((p) => ({
                                ...p,
                                [item.id]: !p[item.id]
                              }))
                            }
                            className="px-2 py-1 rounded-lg text-[10px] font-semibold border border-white/10 bg-[#181A1B] text-[#9CA3AF] hover:text-white"
                          >
                            Vergleich
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onDeleteCartItem(item.originProjectId, item.id)
                            }
                            className="p-1 text-[#9CA3AF] hover:text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
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

          {/* SEKTION 3: ABLÄUFE & ERKLÄRUNGEN */}
          {showExplanationsSection && (
            <section
              className="rounded-2xl border border-white/10 p-3 space-y-2.5"
              style={{ backgroundColor: THEME.bgCard }}
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
                      className="rounded-xl border border-white/10 overflow-hidden transition-all"
                      style={{ backgroundColor: THEME.bgSub }}
                    >
                      <div
                        onClick={() =>
                          setOpenExplanations((p) => ({ ...p, [exp.id]: !p[exp.id] }))
                        }
                        className={`${cardPadding} flex items-center justify-between gap-2 cursor-pointer`}
                      >
                        <span className={`${titleFontSize} text-white truncate`}>
                          {exp.title}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveAudioGuideExp(exp);
                            }}
                            className="px-2 py-1 rounded-lg bg-[#181A1B] text-[#14B8A6] hover:text-white text-[10px] font-bold flex items-center gap-1 border border-[#14B8A6]/30"
                            title="Freihändig vorlesen"
                          >
                            <Volume2 className="w-3 h-3" />
                            <span>Vorlesen</span>
                          </button>
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
              </div>
            </section>
          )}

          {/* SEKTION 4: INFOS, MASSE & FOTO-MASSBAND */}
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
                  Infos, Maße &amp; Foto-Maßband ({activeProject.infos.length})
                </h3>
              </div>

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
                        className={`${cardPadding} flex items-center justify-between gap-2 cursor-pointer`}
                      >
                        <span className={`${titleFontSize} text-white truncate`}>
                          {info.title}
                        </span>
                        {isOpen ? (
                          <ChevronUp className="w-4 h-4 text-[#9CA3AF]" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-[#9CA3AF]" />
                        )}
                      </div>

                      {isOpen && (
                        <div className="px-3 pb-3 pt-2 border-t border-white/10 space-y-2 bg-[#181A1B]/60">
                          <div className="text-xs whitespace-pre-line text-[#F8F9FA]">
                            {info.content}
                          </div>
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[10px] text-[#9CA3AF]">
                              Anhänge &amp; Maß-Fotos ({info.attachments.length})
                            </span>
                            <label
                              className="cursor-pointer px-2.5 py-1 rounded-lg text-[10px] font-bold text-white flex items-center gap-1"
                              style={{ backgroundColor: themeColors.primary }}
                            >
                              <Upload className="w-3 h-3" />
                              <span>Foto / PDF</span>
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
                              className="p-2 rounded-lg bg-[#24292E] border border-white/10 flex items-center justify-between text-xs cursor-pointer hover:border-[#14B8A6]"
                            >
                              <span className="text-white truncate">{att.name}</span>
                              <span className="text-[10px] text-[#14B8A6]">
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
                    onRecordEventSale,
                    onNotify
                  })}
                </div>
              ))}
            </section>
          )}
        </div>
      )}
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