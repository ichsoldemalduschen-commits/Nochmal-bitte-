import React, { useMemo, useState } from 'react';
import {
  Calendar,
  Check,
  CheckSquare,
  Crosshair,
  Edit3,
  Eye,
  MoreHorizontal,
  Plus,
  RotateCcw,
  ShoppingCart,
  Trash2
} from 'lucide-react';
import {
  PriorityType,
  Project,
  TaskItem
} from '../../types';
import { buildGoogleCalendarTemplateUrl } from '../../services/cloudSyncAndPush';
import { BanditUserPreferences, triggerHapticFeedback } from '../../services/aiRouter';
import { ThemeColors } from './FrontHeader';

interface TasksViewProps {
  activeProject: Project;
  allProjects: Project[];
  themeColors: ThemeColors;
  prefs: BanditUserPreferences;
  searchQuery: string;
  highlightedItemId: string | null;
  onToggleTask: (projectId: string, taskId: string) => void;
  onAddTask: (projectId: string, title: string, priority?: PriorityType, estimatedMinutes?: number) => void;
  onDeleteTask: (projectId: string, taskId: string) => void;
  onUpdateTask?: (projectId: string, taskId: string, patch: Partial<TaskItem>) => void;
  onMoveTask?: (fromProjectId: string, toProjectId: string, taskId: string) => void;
  onSendTaskToCart?: (projectId: string, title: string) => void;
  onAddCartItems: (projectId: string, items: Array<{ title: string; quantity: string; price?: string; reason?: string }>) => void;
  onConfirmRedDot: (projectId: string, section: 'tasks' | 'explanations' | 'infos' | 'cart' | 'knowledge', itemId: string) => void;
  onResetChecklist?: (projectId: string) => void;
  onResetChecklistForDeployment?: (projectId: string) => void;
  onUpdatePrefs: (patch: Partial<BanditUserPreferences>) => void;
  onNotify: (msg: string) => void;
}

export const TasksView: React.FC<TasksViewProps> = ({
  activeProject,
  allProjects,
  themeColors,
  prefs,
  searchQuery,
  highlightedItemId,
  onToggleTask,
  onAddTask,
  onDeleteTask,
  onUpdateTask,
  onMoveTask,
  onSendTaskToCart,
  onAddCartItems,
  onConfirmRedDot,
  onResetChecklist,
  onResetChecklistForDeployment,
  onUpdatePrefs,
  onNotify
}) => {
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskGroup, setNewTaskGroup] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editTaskGroup, setEditTaskGroup] = useState('');
  const [singleFocusActive, setSingleFocusActive] = useState(false);
  const [selectedAssemblyGroup, setSelectedAssemblyGroup] = useState<string>('ALL');
  const [expandedActionCards, setExpandedActionCards] = useState<Record<string, boolean>>({});

  const toggleActionCard = (id: string) => {
    triggerHapticFeedback(10);
    setExpandedActionCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const assemblyGroups = useMemo(() => {
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

  return (
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

      {/* PROGRESSIVE DISCLOSURE: Eingabeformular für Tasks */}
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
              {/* Karten-Ruhezustand */}
              <div className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
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
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => toggleActionCard(task.id)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2 rounded-xl text-[#9CA3AF] hover:text-white hover:bg-white/5 active:scale-95 transition cursor-pointer shrink-0"
                  aria-label="Aktionsmenü öffnen"
                >
                  <MoreHorizontal className="w-5 h-5" />
                </button>
              </div>

              {/* Ausklappbare Aktionsleiste */}
              {isTrayOpen && (
                <div className="px-4 pb-4 pt-3 border-t border-white/5 space-y-2.5 bg-[#1C2026]/80 animate-fadeIn">
                  {editingTaskId === task.id ? (
                    <div className="p-3 rounded-2xl bg-[#242930] border border-white/10 space-y-2.5">
                      <div className="text-xs font-bold text-white">Aufgabe bearbeiten</div>
                      <input
                        type="text"
                        value={editTaskTitle}
                        onChange={(e) => setEditTaskTitle(e.target.value)}
                        className="w-full min-h-[44px] px-3.5 py-2 rounded-xl text-sm bg-[#1C2026] text-white border border-white/10 focus:outline-none focus:border-[#14B8A6]"
                      />
                      <input
                        type="text"
                        value={editTaskGroup}
                        onChange={(e) => setEditTaskGroup(e.target.value)}
                        placeholder="Baugruppe (optional)"
                        className="w-full min-h-[44px] px-3.5 py-2 rounded-xl text-xs bg-[#1C2026] text-white border border-white/10 focus:outline-none focus:border-[#14B8A6]"
                      />
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setEditingTaskId(null)}
                          className="min-h-[44px] px-4 rounded-xl text-xs font-semibold text-[#9CA3AF] hover:text-white"
                        >
                          Abbrechen
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!editTaskTitle.trim()) return;
                            const finalTitle = editTaskGroup.trim()
                              ? `[${editTaskGroup.trim()}] ${editTaskTitle.trim()}`
                              : editTaskTitle.trim();
                            onUpdateTask?.(activeProject.id, task.id, {
                              title: finalTitle,
                              assemblyGroup: editTaskGroup.trim() || undefined
                            });
                            setEditingTaskId(null);
                            onNotify('Aufgabe aktualisiert.');
                          }}
                          className="min-h-[44px] px-4 rounded-xl text-xs font-bold text-white shadow-md active:scale-95 transition"
                          style={{ backgroundColor: themeColors.primary }}
                        >
                          Speichern
                        </button>
                      </div>
                    </div>
                  ) : null}

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
                    <button
                      type="button"
                      onClick={() => {
                        const m = task.title.match(/^\[(.*?)\]\s*(.*)$/);
                        setEditTaskTitle(m ? m[2] : task.title);
                        setEditTaskGroup(task.assemblyGroup || (m ? m[1] : ''));
                        setEditingTaskId(task.id);
                      }}
                      className="min-h-[44px] px-3.5 rounded-xl text-xs font-semibold bg-[#242930] hover:bg-[#2A3038] text-white hover:text-[#14B8A6] border border-white/5 flex items-center justify-center gap-2 active:scale-95 transition"
                    >
                      <Edit3 className="w-4 h-4 text-[#14B8A6]" />
                      <span>Bearbeiten</span>
                    </button>

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

                    {prefs.adhdMasterEnabled && prefs.adhdFocusAnchor && (
                      <button
                        type="button"
                        onClick={() => {
                          onUpdatePrefs({
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

                    <button
                      type="button"
                      onClick={() => {
                        onDeleteTask(activeProject.id, task.id);
                        onNotify('Aufgabe gelöscht.');
                      }}
                      className="col-span-2 min-h-[44px] px-3.5 rounded-xl text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 flex items-center justify-center gap-2 active:scale-95 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Löschen</span>
                    </button>
                  </div>

                  {allProjects.filter((p) => !p.archived && p.id !== activeProject.id).length > 0 && (
                    <div className="pt-1.5 border-t border-white/5">
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) {
                            onMoveTask?.(activeProject.id, e.target.value, task.id);
                            toggleActionCard(task.id);
                          }
                        }}
                        className="w-full min-h-[44px] px-3.5 py-2 rounded-xl text-xs bg-[#181A1B] text-white border border-white/10 focus:outline-none focus:border-[#14B8A6] cursor-pointer"
                      >
                        <option value="" disabled>
                          In anderes Projekt verschieben...
                        </option>
                        {allProjects
                          .filter((p) => !p.archived && p.id !== activeProject.id)
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              Verschieben nach: {p.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
