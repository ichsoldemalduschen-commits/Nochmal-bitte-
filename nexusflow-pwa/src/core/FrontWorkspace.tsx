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
  CustomMeta,
  DomainType,
  EventSalesLog,
  PriorityType,
  Project,
  ProjectTabId,
  THEME
} from '../types';
import { ProjectAvatar } from '../components/RaccoonAvatar';
import { ProcurementCheckPanel } from '../plugins/procurementCheck';
import { PLUGIN_REGISTRY } from '../plugins/registry';

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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewAllSections, setViewAllSections] = useState(true);
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
  const [newCartTitle, setNewCartTitle] = useState('');
  const [newCartQty, setNewCartQty] = useState('1x');
  const [newCartPrice, setNewCartPrice] = useState('');

  const [openExplanations, setOpenExplanations] = useState<Record<string, boolean>>({});
  const [openInfos, setOpenInfos] = useState<Record<string, boolean>>({});
  const [openProcurements, setOpenProcurements] = useState<Record<string, boolean>>({});

  // Touch-Swipe-Erkennung für den linken Drawer
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

    // Wisch von links nach rechts öffnet das Seitenmenü
    if (!drawerOpen && touchStartXRef.current < 90 && deltaX > 65 && deltaY < 60) {
      setDrawerOpen(true);
    } else if (drawerOpen && deltaX < -65 && deltaY < 60) {
      setDrawerOpen(false);
    }
    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  const themeColors = useMemo(() => {
    if (activeDomain === 'privat') {
      return { primary: '#4F46E5', highlight: '#818CF8', label: 'PRIVAT' };
    }
    if (activeProject?.id === 'proj-baeckerei') {
      return { primary: '#D97706', highlight: '#F59E0B', label: 'ARBEIT / BAUSTELLE' };
    }
    return { primary: '#0A9396', highlight: '#14B8A6', label: 'ARBEIT / BETRIEB' };
  }, [activeDomain, activeProject?.id]);

  const projectsSource = allProjects.length > 0 ? allProjects : domainProjects;
  const workProjects = projectsSource.filter((p) => !p.archived && p.domain === 'arbeit');
  const privateProjects = projectsSource.filter((p) => !p.archived && p.domain === 'privat');

  const activePlugins = PLUGIN_REGISTRY.filter((pl) =>
    (activeProject?.enabledPlugins || []).includes(pl.id)
  );

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
      .sort((a, b) => Number(a.completed) - Number(b.completed));
  }, [activeProject, searchQuery]);

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

  return (
    <div
      className="min-h-[75vh] space-y-3"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
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
                  </div>
                  <div className="text-[10px] text-[#9CA3AF]">
                    Projekt oder Einzelbereich wählen
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

              {/* SEKTION 1: ARBEIT */}
              <div className="space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] px-1">
                  ARBEIT
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
            <button
              type="button"
              onClick={() => setViewAllSections((v) => !v)}
              className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold border border-white/10 text-white"
              style={{
                backgroundColor: viewAllSections ? themeColors.primary : '#181A1B'
              }}
            >
              {viewAllSections ? 'Alle aktiv' : 'Einzelansicht'}
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
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                      task.completed ? 'opacity-70' : ''
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
              </div>
            </section>
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
                />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  Einkaufswagen ({activeProject.cart.filter((c) => !c.completed).length} offen)
                </h3>
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
                {sortedCart.map((item) => {
                  const isProcOpen = !!openProcurements[item.id];
                  return (
                    <div
                      key={item.id}
                      id={`item-card-${item.id}`}
                      className={`rounded-xl border border-white/10 overflow-hidden ${
                        item.completed ? 'opacity-70' : ''
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
                            onClick={() => onDeleteCartItem(activeProject.id, item.id)}
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
                      className="rounded-xl border border-white/10 overflow-hidden"
                      style={{ backgroundColor: THEME.bgSub }}
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
                        className="p-2.5 flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <span className="text-xs font-bold text-white truncate">
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
};
