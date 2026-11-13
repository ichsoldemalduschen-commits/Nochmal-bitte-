import React, { useState } from 'react';
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Edit3,
  Eye,
  FileText,
  Image as ImageIcon,
  Plus,
  Puzzle,
  RotateCcw,
  Search,
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
  Project,
  ProjectTabId,
  THEME
} from '../types';
import { ProjectAvatar } from '../components/RaccoonAvatar';
import { ProcurementCheckPanel } from '../plugins/procurementCheck';
import { PLUGIN_REGISTRY } from '../plugins/registry';

interface FrontWorkspaceProps {
  activeDomain: DomainType;
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
  onResetChecklist: (projectId: string) => void;
  onToggleTask: (projectId: string, taskId: string) => void;
  onAddTask: (projectId: string, title: string) => void;
  onDeleteTask: (projectId: string, taskId: string) => void;
  onSendTaskToCart: (projectId: string, title: string) => void;
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
  const [isAccordionCollapsed, setIsAccordionCollapsed] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Formular-States
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

  const [openExplanations, setOpenExplanations] = useState<Record<string, boolean>>({
    'tsa-exp-all6': true
  });
  const [openInfos, setOpenInfos] = useState<Record<string, boolean>>({
    'tsa-info-1': true
  });
  const [openProcurements, setOpenProcurements] = useState<Record<string, boolean>>({
    'tsa-c1': true
  });

  const activePlugins = PLUGIN_REGISTRY.filter((pl) =>
    activeProject?.enabledPlugins.includes(pl.id)
  );

  return (
    <div className="space-y-3">
      {/* 1. Domänen-Umschalter: ARBEIT vs. PRIVAT */}
      <div
        className="grid grid-cols-2 p-1 rounded-xl border border-white/10"
        style={{ backgroundColor: THEME.bgCard }}
      >
        <button
          onClick={() => {
            onSwitchDomain('arbeit');
            setIsAccordionCollapsed(false);
          }}
          className={`py-2 rounded-lg text-xs font-bold transition-all ${
            activeDomain === 'arbeit' ? 'text-white shadow' : 'text-[#9CA3AF] hover:text-white'
          }`}
          style={activeDomain === 'arbeit' ? { backgroundColor: THEME.accentPrimary } : {}}
        >
          ?? ARBEIT
        </button>
        <button
          onClick={() => {
            onSwitchDomain('privat');
            setIsAccordionCollapsed(false);
          }}
          className={`py-2 rounded-lg text-xs font-bold transition-all ${
            activeDomain === 'privat' ? 'text-white shadow' : 'text-[#9CA3AF] hover:text-white'
          }`}
          style={activeDomain === 'privat' ? { backgroundColor: THEME.accentPrimary } : {}}
        >
          ? PRIVAT
        </button>
      </div>

      {/* 2. Ziehharmonika-Projektfokus */}
      {isAccordionCollapsed && activeProject ? (
        <div
          className="px-3 py-2.5 rounded-xl border flex items-center justify-between gap-2 shadow-md"
          style={{
            backgroundColor: THEME.bgCard,
            borderColor: activeProject.accentColor || THEME.accentPrimary
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative shrink-0">
              <ProjectAvatar project={activeProject} sizeClass="w-9 h-9" />
              <label
                title="Eigenes Projekt-/Waschbär-Logo aus Galerie wählen"
                className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#0A9396] text-white flex items-center justify-center cursor-pointer border border-black"
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
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#F8F9FA] truncate">
                <span className="text-[#9CA3AF] font-normal mr-1">
                  {activeDomain === 'arbeit' ? '??' : '?'}
                </span>
                {activeProject.name}
              </div>
              <p className="text-[10px] text-[#9CA3AF] truncate">
                {activeProject.tasks.filter((t) => !t.completed).length} offene Tasks •{' '}
                {activeProject.cart.filter((c) => !c.completed).length} im Einkaufswagen
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {activeProject.customLogoUrl && (
              <button
                onClick={() => onResetProjectLogo(activeProject.id)}
                title="Standard-Logo wiederherstellen"
                className="p-1.5 rounded-lg bg-[#2F363D] text-[#9CA3AF] hover:text-white"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={() => setIsAccordionCollapsed(false)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#2F363D] text-[#14B8A6] hover:text-white border border-white/10 flex items-center gap-1"
            >
              <span>Wechseln</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div
          className="p-3 rounded-2xl border border-white/10 space-y-2.5 shadow-lg"
          style={{ backgroundColor: THEME.bgCard }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#14B8A6]">
              Projekt wählen:
            </span>
            <button
              onClick={onOpenNewProjectModal}
              className="text-[11px] font-semibold text-[#14B8A6] flex items-center gap-1 hover:underline"
            >
              <Plus className="w-3.5 h-3.5" />
              Neues Projekt
            </button>
          </div>

          <div className="space-y-2">
            {domainProjects.map((proj) => {
              const hasAiDot =
                proj.tasks.some((t) => t.aiTouched) ||
                proj.explanations.some((e) => e.aiTouched) ||
                proj.infos.some((i) => i.aiTouched) ||
                proj.cart.some((c) => c.aiTouched);

              return (
                <div
                  key={proj.id}
                  onClick={() => {
                    onSelectProject(proj.id);
                    setIsAccordionCollapsed(true);
                  }}
                  className="p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition hover:border-[#14B8A6]"
                  style={{
                    backgroundColor: activeProject?.id === proj.id ? THEME.bgSub : '#1C2024',
                    borderColor:
                      activeProject?.id === proj.id ? proj.accentColor : 'rgba(255,255,255,0.08)'
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ProjectAvatar project={proj} sizeClass="w-10 h-10" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white truncate">{proj.name}</span>
                        {hasAiDot && (
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: THEME.aiRedDot }}
                          />
                        )}
                      </div>
                      <p className="text-[11px] text-[#9CA3AF] truncate">{proj.subtitle}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#9CA3AF] shrink-0" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Die 5 festen Projekt-Reiter */}
      {activeProject && (
        <div
          className="rounded-2xl border border-white/10 overflow-hidden shadow-xl"
          style={{ backgroundColor: THEME.bgCard }}
        >
          <div
            className="grid grid-cols-5 border-b border-white/10"
            style={{ backgroundColor: '#1C2024' }}
          >
            {[
              {
                id: 'tasks' as ProjectTabId,
                label: 'Tasks',
                count: activeProject.tasks.length,
                redDot: activeProject.tasks.some((t) => t.aiTouched)
              },
              {
                id: 'explanations' as ProjectTabId,
                label: 'Abläufe',
                count: activeProject.explanations.length,
                redDot: activeProject.explanations.some((e) => e.aiTouched)
              },
              {
                id: 'infos' as ProjectTabId,
                label: 'Infos',
                count: activeProject.infos.length,
                redDot: activeProject.infos.some((i) => i.aiTouched)
              },
              {
                id: 'cart' as ProjectTabId,
                label: 'Wagen',
                count: activeProject.cart.length,
                redDot: activeProject.cart.some((c) => c.aiTouched)
              },
              {
                id: 'extras' as ProjectTabId,
                label: '? Extras',
                count: activePlugins.length,
                redDot: false
              }
            ].map((t) => {
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => onChangeTab(t.id)}
                  className={`py-2.5 px-1 text-[10px] sm:text-[11px] font-bold flex flex-col items-center justify-center gap-0.5 border-b-2 transition ${
                    active
                      ? 'text-white bg-[#24292E]'
                      : 'text-[#9CA3AF] hover:text-white border-transparent'
                  }`}
                  style={active ? { borderBottomColor: THEME.accentHighlight } : {}}
                >
                  <div className="flex items-center gap-1 max-w-full">
                    <span className="truncate">{t.label}</span>
                    {t.redDot && (
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: THEME.aiRedDot }}
                      />
                    )}
                  </div>
                  <span className="text-[9px] font-mono text-[#14B8A6]">({t.count})</span>
                </button>
              );
            })}
          </div>

          {/* Filter & Einsatz-Reset */}
          {activeTab !== 'extras' && (
            <div className="px-3 py-2 border-b border-white/10 flex flex-wrap items-center justify-between gap-2 bg-[#1E2226]">
              <div className="relative flex-1 min-w-[120px]">
                <Search className="w-3 h-3 text-[#9CA3AF] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Einträge filtern..."
                  className="w-full pl-7 pr-6 py-1 rounded-lg text-[11px] bg-[#181A1B] text-[#F8F9FA] border border-white/10 focus:outline-none focus:border-[#14B8A6]"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {activeTab === 'tasks' && (
                <button
                  onClick={() => onResetChecklist(activeProject.id)}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-[#2F363D] text-[#14B8A6] hover:text-white border border-white/10 flex items-center gap-1 shrink-0"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Checkliste für Einsatz zurücksetzen</span>
                </button>
              )}
            </div>
          )}

          <div className="p-3 space-y-3">
            {/* TAB 1: TASKS */}
            {activeTab === 'tasks' && (
              <div className="space-y-2.5">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newTaskTitle.trim()) return;
                    onAddTask(activeProject.id, newTaskTitle.trim());
                    setNewTaskTitle('');
                  }}
                  className="flex items-center gap-1.5"
                >
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Neuer Task / Baugruppen-Schritt..."
                    className="flex-1 px-3 py-2 rounded-xl text-xs bg-[#181A1B] text-white border border-white/10 focus:outline-none focus:border-[#14B8A6]"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 rounded-xl text-xs font-bold text-white"
                    style={{ backgroundColor: THEME.accentPrimary }}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </form>

                <div className="space-y-2">
                  {activeProject.tasks
                    .filter(
                      (t) =>
                        !searchQuery.trim() ||
                        t.title.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((task) => (
                      <div
                        key={task.id}
                        id={`item-card-${task.id}`}
                        className="p-3 rounded-xl border transition-all flex items-center justify-between gap-2.5"
                        style={{
                          backgroundColor: THEME.bgSub,
                          borderColor:
                            highlightedItemId === task.id
                              ? THEME.accentHighlight
                              : 'rgba(255,255,255,0.08)'
                        }}
                      >
                        {task.aiTouched && (
                          <button
                            onClick={() => onConfirmRedDot(activeProject.id, 'tasks', task.id)}
                            title="Von KI bearbeitet – Antippen zum Bestätigen"
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: THEME.aiRedDot }}
                          />
                        )}

                        <button
                          onClick={() => onToggleTask(activeProject.id, task.id)}
                          className="w-5 h-5 rounded-md flex items-center justify-center border shrink-0"
                          style={{
                            backgroundColor: task.completed
                              ? THEME.accentPrimary
                              : 'rgba(24, 26, 27, 0.7)',
                            borderColor: task.completed ? THEME.accentHighlight : '#9CA3AF'
                          }}
                        >
                          {task.completed && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                        </button>

                        <div
                          onClick={() => onToggleTask(activeProject.id, task.id)}
                          className="flex-1 min-w-0 cursor-pointer"
                        >
                          <span className="text-xs sm:text-sm font-semibold text-[#F8F9FA] leading-snug block">
                            {task.title}
                          </span>
                          {task.completed && (
                            <span className="text-[10px] font-semibold text-[#14B8A6]">
                              ? Erledigt
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => onSendTaskToCart(activeProject.id, task.title)}
                            title="Als Position in den Einkaufswagen kopieren"
                            className="p-1.5 rounded-lg bg-[#181A1B] text-[#14B8A6] hover:bg-[#0A9396] hover:text-white border border-white/10"
                          >
                            <ShoppingCart className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteTask(activeProject.id, task.id)}
                            className="p-1 text-[#9CA3AF] hover:text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* TAB 2: ARBEITSERKLÄRUNGEN */}
            {activeTab === 'explanations' && (
              <div className="space-y-3">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newExpTitle.trim()) return;
                    onAddExplanation(
                      activeProject.id,
                      newExpTitle.trim(),
                      newExpSteps.trim() || '1. Schritt hier eintragen...'
                    );
                    setNewExpTitle('');
                    setNewExpSteps('');
                  }}
                  className="p-2.5 rounded-xl border border-white/10 space-y-2"
                  style={{ backgroundColor: THEME.bgSub }}
                >
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={newExpTitle}
                      onChange={(e) => setNewExpTitle(e.target.value)}
                      placeholder="Neue Arbeitserklärung / Rezeptur / Bauanleitung..."
                      className="flex-1 px-2.5 py-1.5 rounded-lg text-xs bg-[#181A1B] text-white border border-white/10"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white shrink-0"
                      style={{ backgroundColor: THEME.accentPrimary }}
                    >
                      + Neu
                    </button>
                  </div>
                  {newExpTitle && (
                    <textarea
                      rows={3}
                      value={newExpSteps}
                      onChange={(e) => setNewExpSteps(e.target.value)}
                      placeholder="Schritt-für-Schritt Ablauf..."
                      className="w-full p-2 rounded-lg text-xs bg-[#181A1B] text-white border border-white/10"
                    />
                  )}
                </form>

                <div className="space-y-2">
                  {activeProject.explanations
                    .filter(
                      (ex) =>
                        !searchQuery.trim() ||
                        ex.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        ex.stepsText.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((exp) => {
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
                            className="p-3 flex items-center justify-between gap-2 cursor-pointer"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {exp.aiTouched && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onConfirmRedDot(activeProject.id, 'explanations', exp.id);
                                  }}
                                  className="w-1.5 h-1.5 rounded-full shrink-0"
                                  style={{ backgroundColor: THEME.aiRedDot }}
                                />
                              )}
                              <BookOpen className="w-3.5 h-3.5 text-[#14B8A6] shrink-0" />
                              <h4 className="text-xs sm:text-sm font-bold text-[#F8F9FA] truncate">
                                {exp.title}
                              </h4>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
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
                            <div className="px-3 pb-3 pt-2 border-t border-white/10 space-y-2 bg-[#181A1B]/55">
                              {isEditing ? (
                                <div className="space-y-2">
                                  <input
                                    type="text"
                                    value={editExpTitle}
                                    onChange={(e) => setEditExpTitle(e.target.value)}
                                    className="w-full px-2.5 py-1.5 rounded text-xs bg-[#181A1B] text-white border border-white/15"
                                  />
                                  <textarea
                                    rows={5}
                                    value={editExpSteps}
                                    onChange={(e) => setEditExpSteps(e.target.value)}
                                    className="w-full p-2 rounded text-xs bg-[#181A1B] text-white border border-white/15 font-mono"
                                  />
                                  <div className="flex justify-end gap-2">
                                    <button
                                      onClick={() => setEditingExpId(null)}
                                      className="px-2.5 py-1 text-xs text-[#9CA3AF]"
                                    >
                                      Abbrechen
                                    </button>
                                    <button
                                      onClick={() => {
                                        onUpdateExplanation(
                                          activeProject.id,
                                          exp.id,
                                          editExpTitle,
                                          editExpSteps
                                        );
                                        setEditingExpId(null);
                                      }}
                                      className="px-3 py-1 rounded text-xs font-semibold text-white"
                                      style={{ backgroundColor: THEME.accentPrimary }}
                                    >
                                      Speichern
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-xs leading-relaxed whitespace-pre-line text-[#F8F9FA]">
                                  {exp.stepsText}
                                </div>
                              )}
                              <div className="pt-1.5 border-t border-white/5 text-[10px] text-[#9CA3AF]/75">
                                Stand: {exp.lastModified} • {exp.changeReason} ({exp.source})
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* TAB 3: ALLGEMEINE INFOS & INDEXEDDB DATEI-ANHÄNGE */}
            {activeTab === 'infos' && (
              <div className="space-y-3">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newInfoTitle.trim()) return;
                    onAddInfo(activeProject.id, newInfoTitle.trim(), newInfoContent.trim());
                    setNewInfoTitle('');
                    setNewInfoContent('');
                  }}
                  className="p-2.5 rounded-xl border border-white/10 space-y-2"
                  style={{ backgroundColor: THEME.bgSub }}
                >
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={newInfoTitle}
                      onChange={(e) => setNewInfoTitle(e.target.value)}
                      placeholder="Neue Info-Karte / Maße / Schaltplan..."
                      className="flex-1 px-2.5 py-1.5 rounded-lg text-xs bg-[#181A1B] text-white border border-white/10"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white shrink-0"
                      style={{ backgroundColor: THEME.accentPrimary }}
                    >
                      + Info
                    </button>
                  </div>
                  {newInfoTitle && (
                    <textarea
                      rows={2}
                      value={newInfoContent}
                      onChange={(e) => setNewInfoContent(e.target.value)}
                      placeholder="Referenzdaten eintragen..."
                      className="w-full p-2 rounded-lg text-xs bg-[#181A1B] text-white border border-white/10"
                    />
                  )}
                </form>

                <div className="space-y-2.5">
                  {activeProject.infos
                    .filter(
                      (inf) =>
                        !searchQuery.trim() ||
                        inf.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        inf.content.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((info) => {
                      const isOpen = !!openInfos[info.id];
                      return (
                        <div
                          key={info.id}
                          id={`item-card-${info.id}`}
                          className="rounded-xl border border-white/10 overflow-hidden"
                          style={{ backgroundColor: THEME.bgSub }}
                        >
                          <div
                            onClick={() => setOpenInfos((p) => ({ ...p, [info.id]: !p[info.id] }))}
                            className="p-3 flex items-center justify-between gap-2 cursor-pointer"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {info.aiTouched && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onConfirmRedDot(activeProject.id, 'infos', info.id);
                                  }}
                                  className="w-1.5 h-1.5 rounded-full shrink-0"
                                  style={{ backgroundColor: THEME.aiRedDot }}
                                />
                              )}
                              <FileText className="w-3.5 h-3.5 text-[#14B8A6] shrink-0" />
                              <h4 className="text-xs sm:text-sm font-bold text-[#F8F9FA] truncate">
                                {info.title}
                              </h4>
                            </div>
                            {isOpen ? (
                              <ChevronUp className="w-4 h-4 text-[#9CA3AF]" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-[#9CA3AF]" />
                            )}
                          </div>

                          {isOpen && (
                            <div className="px-3 pb-3 pt-2 border-t border-white/10 space-y-2.5 bg-[#181A1B]/55">
                              <div className="text-xs whitespace-pre-line text-[#F8F9FA] leading-relaxed">
                                {info.content}
                              </div>

                              <div className="flex items-center justify-between pt-1">
                                <span className="text-[10px] text-[#9CA3AF]">
                                  IndexedDB-Anhänge ({info.attachments.length})
                                </span>
                                <label
                                  className="cursor-pointer px-2.5 py-1 rounded-lg text-[10px] font-semibold text-white flex items-center gap-1"
                                  style={{ backgroundColor: THEME.accentPrimary }}
                                >
                                  <Upload className="w-3 h-3" />
                                  Foto / PDF / Text
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

                              {info.attachments.length > 0 && (
                                <div className="space-y-1.5">
                                  {info.attachments.map((att) => (
                                    <div
                                      key={att.id}
                                      onClick={() => onPreviewAttachment(att)}
                                      className="p-2 rounded-lg bg-[#24292E] border border-white/10 flex items-center justify-between text-xs cursor-pointer hover:border-[#14B8A6]"
                                    >
                                      <span className="truncate text-[#F8F9FA]">
                                        {att.name} ({att.size})
                                      </span>
                                      <Eye className="w-3.5 h-3.5 text-[#14B8A6] shrink-0" />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* TAB 4: EINKAUFSWAGEN INKL. BESCHAFFUNGS-CHECK PLUGIN */}
            {activeTab === 'cart' && (
              <div className="space-y-3">
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
                  className="p-2.5 rounded-xl border border-white/10 space-y-2"
                  style={{ backgroundColor: THEME.bgSub }}
                >
                  <input
                    type="text"
                    value={newCartTitle}
                    onChange={(e) => setNewCartTitle(e.target.value)}
                    placeholder="Artikel hinzufügen (aktiviert automatisch Beschaffungs-Check)..."
                    className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-[#181A1B] text-white border border-white/10"
                  />
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={newCartQty}
                      onChange={(e) => setNewCartQty(e.target.value)}
                      placeholder="Menge"
                      className="w-24 px-2.5 py-1.5 rounded-lg text-xs bg-[#181A1B] text-white border border-white/10"
                    />
                    <input
                      type="text"
                      value={newCartPrice}
                      onChange={(e) => setNewCartPrice(e.target.value)}
                      placeholder="Preis €"
                      className="w-24 px-2.5 py-1.5 rounded-lg text-xs bg-[#181A1B] text-white border border-white/10 font-mono"
                    />
                    <button
                      type="submit"
                      className="flex-1 py-1.5 rounded-lg text-xs font-bold text-white flex items-center justify-center gap-1"
                      style={{ backgroundColor: THEME.accentPrimary }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      In den Wagen
                    </button>
                  </div>
                </form>

                <div className="space-y-2">
                  {activeProject.cart
                    .filter(
                      (c) =>
                        !searchQuery.trim() ||
                        c.title.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((item) => {
                      const isProcOpen = !!openProcurements[item.id];
                      return (
                        <div
                          key={item.id}
                          id={`item-card-${item.id}`}
                          className="rounded-xl border border-white/10 overflow-hidden"
                          style={{ backgroundColor: THEME.bgSub }}
                        >
                          <div className="p-3 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 flex-1 min-w-0">
                              {item.aiTouched && (
                                <button
                                  onClick={() => onConfirmRedDot(activeProject.id, 'cart', item.id)}
                                  className="w-1.5 h-1.5 rounded-full shrink-0"
                                  style={{ backgroundColor: THEME.aiRedDot }}
                                />
                              )}

                              <button
                                onClick={() => onToggleCartItem(activeProject.id, item.id)}
                                className="w-5 h-5 rounded-md flex items-center justify-center border shrink-0"
                                style={{
                                  backgroundColor: item.completed
                                    ? THEME.accentPrimary
                                    : 'rgba(24, 26, 27, 0.7)',
                                  borderColor: item.completed ? THEME.accentHighlight : '#9CA3AF'
                                }}
                              >
                                {item.completed && (
                                  <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                                )}
                              </button>

                              <div className="min-w-0 flex-1">
                                <span className="text-xs sm:text-sm font-semibold text-[#F8F9FA] block truncate">
                                  {item.title}
                                </span>
                                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#181A1B] text-[#14B8A6]">
                                    {item.quantity}
                                  </span>
                                  {item.price && (
                                    <span className="text-[10px] font-mono text-[#9CA3AF]">
                                      {item.price} €
                                    </span>
                                  )}
                                  {item.completed && (
                                    <span className="text-[10px] font-bold text-[#14B8A6]">
                                      ? Besorgt
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() =>
                                  setOpenProcurements((p) => ({
                                    ...p,
                                    [item.id]: !p[item.id]
                                  }))
                                }
                                className={`px-2 py-1 rounded-lg text-[10px] font-semibold border flex items-center gap-1 transition ${
                                  isProcOpen
                                    ? 'bg-[#0A9396] text-white border-[#14B8A6]'
                                    : 'bg-[#181A1B] text-[#14B8A6] border-white/10'
                                }`}
                              >
                                <span>? Check</span>
                                {isProcOpen ? (
                                  <ChevronUp className="w-3 h-3" />
                                ) : (
                                  <ChevronDown className="w-3 h-3" />
                                )}
                              </button>
                              <button
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
              </div>
            )}

            {/* TAB 5: ? EXTRAS (ISOLIERTE STECKKARTEN-PLUGINS) */}
            {activeTab === 'extras' && (
              <div className="space-y-3">
                {activePlugins.length === 0 ? (
                  <div className="p-4 rounded-xl bg-[#2F363D] border border-white/10 text-center space-y-2">
                    <Puzzle className="w-6 h-6 text-[#14B8A6] mx-auto" />
                    <p className="text-xs text-white font-semibold">
                      Noch keine Steckkarten für „{activeProject.name}“ aktiviert.
                    </p>
                    <button
                      onClick={onOpenAddonsBackoffice}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                      style={{ backgroundColor: THEME.accentPrimary }}
                    >
                      In der Add-on Zentrale aktivieren
                    </button>
                  </div>
                ) : (
                  activePlugins.map((plugin) => (
                    <div key={plugin.id}>
                      {plugin.render({
                        project: activeProject,
                        onUpdateProjectMeta: (patch) =>
                          onUpdateProjectMeta(activeProject.id, patch),
                        onAddCartItems: (items) => onAddCartItems(activeProject.id, items),
                        onAddInfoCard: (title, content) =>
                          onAddInfo(activeProject.id, title, content),
                        onRecordEventSale,
                        onNotify
                      })}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};