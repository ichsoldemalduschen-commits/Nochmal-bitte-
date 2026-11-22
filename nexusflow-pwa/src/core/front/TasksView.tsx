import React, { useMemo, useState } from 'react';
import {
  Calendar,
  Check,
  CheckSquare,
  Copy,
  Crosshair,
  Edit3,
  Eye,
  Plus,
  RotateCcw,
  Settings,
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
  onOpenSettings?: () => void;
  onNotify: (msg: string) => void;
  onRegisterUndo?: (action: { message: string; undo: () => void }) => void;
  onConfigMissing?: (msg: string) => void;
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
  onOpenSettings,
  onNotify,
  onRegisterUndo,
  onConfigMissing: _onConfigMissing
}) => {
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskGroup, setNewTaskGroup] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editTaskGroup, setEditTaskGroup] = useState('');
  const [singleFocusActive, setSingleFocusActive] = useState(false);
  const [selectedAssemblyGroup] = useState<string>('ALL');
  const [expandedActionCards, setExpandedActionCards] = useState<Record<string, boolean>>({});
  const [glowTaskId, setGlowTaskId] = useState<string | null>(null);

  const toggleActionCard = (id: string) => {
    triggerHapticFeedback(10);
    setExpandedActionCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

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
      .sort((a, b) => {
        // While glowing, keep item at its current position to prevent jump
        if (a.id === glowTaskId) return -1;
        if (b.id === glowTaskId) return 1;
        return Number(a.completed) - Number(b.completed);
      });

    if (prefs.adhdMasterEnabled && prefs.adhdSingleTaskMode && singleFocusActive) {
      const nextOpen = filtered.find((t) => !t.completed);
      return nextOpen ? [nextOpen] : filtered.slice(0, 1);
    }
    return filtered;
  }, [activeProject, searchQuery, selectedAssemblyGroup, prefs, singleFocusActive, glowTaskId]);

  const handleSoftToggle = (e: React.MouseEvent, task: TaskItem) => {
    e.stopPropagation();
    triggerHapticFeedback([15, 40, 20]);

    if (!task.completed) {
      // 400-500ms soft glow before re-sorting
      setGlowTaskId(task.id);
      setTimeout(() => {
        onToggleTask(activeProject.id, task.id);
        setGlowTaskId(null);
        const bracketMatch = task.title.match(/^\[(.*?)\]\s*(.*)$/);
        const titleToDisplay = bracketMatch ? bracketMatch[2] : task.title;
        onRegisterUndo?.({
          message: `„${titleToDisplay}“ erledigt`,
          undo: () => onToggleTask(activeProject.id, task.id)
        });
      }, 450);
    } else {
      onToggleTask(activeProject.id, task.id);
      const bracketMatch = task.title.match(/^\[(.*?)\]\s*(.*)$/);
      const titleToDisplay = bracketMatch ? bracketMatch[2] : task.title;
      onRegisterUndo?.({
        message: `„${titleToDisplay}“ wieder offen`,
        undo: () => onToggleTask(activeProject.id, task.id)
      });
    }
  };

  const handleDeleteWithUndo = (task: TaskItem) => {
    const taskBackup = { ...task };
    onDeleteTask(activeProject.id, task.id);
    onRegisterUndo?.({
      message: 'Aufgabe gelöscht',
      undo: () => {
        onAddTask(activeProject.id, taskBackup.title, taskBackup.priority, taskBackup.estimatedMinutes);
        onNotify('Aufgabe wiederhergestellt.');
      }
    });
    onNotify('Aufgabe gelöscht.');
  };

  return (
    <section className="space-y-3.5">
      {/* Sektions-Kopf ohne äußeren Kasten */}
      <div className="flex items-center justify-between gap-2 px-1 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <CheckSquare
            className="w-5 h-5 shrink-0"
            style={{ color: themeColors.highlight }}
          />
          <h3 className="text-base font-bold text-[#F1F5F9] tracking-wide">
            Tasks
          </h3>
          <span className="text-xs font-semibold text-[#94A3B8] px-2 py-0.5 rounded-full bg-[#191C22] border border-white/5 font-mono">
            {activeProject.tasks.filter((t) => !t.completed).length} offen
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          <button
            type="button"
            onClick={() => setIsAddingTask((v) => !v)}
            className={`w-11 h-11 min-h-[44px] min-w-[44px] rounded-2xl border flex items-center justify-center transition active:scale-95 cursor-pointer shrink-0 ${
              isAddingTask
                ? 'text-white border-white/30'
                : 'bg-[#191C22] hover:bg-[#22262F] text-white border-white/5'
            }`}
            style={isAddingTask ? { backgroundColor: themeColors.primary } : {}}
            aria-label="Aufgabe hinzufügen"
            title="Aufgabe hinzufügen"
          >
            <Plus className="w-5 h-5 text-[#14B8A6]" />
          </button>

          {prefs.adhdMasterEnabled && prefs.adhdSingleTaskMode && (
            <button
              type="button"
              onClick={() => setSingleFocusActive((s) => !s)}
              className={`min-h-[44px] px-3 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition active:scale-95 cursor-pointer shrink-0 ${
                singleFocusActive
                  ? 'text-white border-white/30'
                  : 'bg-[#191C22] text-[#94A3B8] border-white/5'
              }`}
              style={singleFocusActive ? { backgroundColor: themeColors.primary } : {}}
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
              className="min-h-[44px] px-3 rounded-xl bg-[#191C22] text-xs font-semibold text-[#94A3B8] hover:text-white border border-white/5 flex items-center gap-1.5 active:scale-95 transition cursor-pointer shrink-0"
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
          className="p-4 rounded-2xl bg-[#191C22] border border-white/10 space-y-3 shadow-lg"
        >
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              autoFocus
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Neue Aufgabe beschreiben..."
              className="flex-1 min-h-[44px] px-3.5 py-2.5 rounded-xl text-sm bg-[#111317] text-[#F1F5F9] border border-white/10 placeholder-[#94A3B8] focus:outline-none focus:border-white/20"
            />
            <input
              type="text"
              value={newTaskGroup}
              onChange={(e) => setNewTaskGroup(e.target.value)}
              placeholder="Baugruppe (optional)"
              className="sm:w-44 min-h-[44px] px-3.5 py-2.5 rounded-xl text-sm bg-[#111317] text-[#F1F5F9] border border-white/10 placeholder-[#94A3B8] focus:outline-none focus:border-white/20"
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
              className="min-h-[44px] px-4 rounded-xl text-xs font-semibold text-[#94A3B8] hover:text-white transition cursor-pointer"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={!newTaskTitle.trim()}
              className="min-h-[44px] px-5 rounded-xl text-xs font-bold text-white shadow-md active:scale-95 transition disabled:opacity-40 cursor-pointer"
              style={{ backgroundColor: themeColors.primary }}
            >
              Speichern
            </button>
          </div>
        </form>
      )}

      {/* Tasks-Liste: Zwei-Zonen-Karten direkt auf dem Canvas */}
      <div className="space-y-2.5">
        {sortedTasks.map((task) => {
          const isAnchored = prefs.activeFocusTaskId === task.id;
          const isTrayOpen = !!expandedActionCards[task.id];
          const isGlowing = glowTaskId === task.id;
          const isEffectivelyCompleted = task.completed || isGlowing;
          const bracketMatch = task.title.match(/^\[(.*?)\]\s*(.*)$/);
          const displayTitle = bracketMatch ? bracketMatch[2] : task.title;
          const displayGroup = task.assemblyGroup || (bracketMatch ? bracketMatch[1] : null);

          return (
            <div
              key={task.id}
              id={`item-card-${task.id}`}
              className={`rounded-2xl border transition-all duration-300 overflow-hidden shadow-sm ${
                task.completed && !isGlowing ? 'opacity-65' : ''
              }`}
              style={{
                backgroundColor: '#191C22',
                borderColor: isAnchored || highlightedItemId === task.id
                  ? themeColors.highlight
                  : isGlowing
                  ? `${themeColors.primary}99`
                  : 'rgba(255,255,255,0.04)',
                boxShadow: isGlowing
                  ? `0 0 16px ${themeColors.primary}44`
                  : undefined
              }}
            >
              {/* Karten-Ruhezustand: ZWEI ZONEN OHNE ••• BUTTON */}
              <div className="p-3.5 flex items-start gap-1">
                {/* ZONE 1 (LINKS): Striktes Abhaken (mind. 44x44 Touch-Fläche mit stopPropagation) */}
                <button
                  type="button"
                  onClick={(e) => handleSoftToggle(e, task)}
                  className="min-w-[44px] min-h-[44px] w-11 h-11 flex items-center justify-center -ml-1 shrink-0 cursor-pointer"
                  aria-label={task.completed ? 'Als unerledigt markieren' : 'Als erledigt markieren'}
                >
                  <div
                    className="w-5 h-5 rounded-md flex items-center justify-center border transition-all duration-300 active:scale-90"
                    style={{
                      backgroundColor: isEffectivelyCompleted
                        ? `${themeColors.primary}33`
                        : 'rgba(17,19,23,0.8)',
                      borderColor: isEffectivelyCompleted
                        ? themeColors.highlight
                        : '#6B7280',
                      boxShadow: isGlowing
                        ? `0 0 8px ${themeColors.highlight}`
                        : undefined
                    }}
                  >
                    {isEffectivelyCompleted && (
                      <Check className="w-3.5 h-3.5 text-white stroke-[2.5] animate-fadeIn" />
                    )}
                  </div>
                </button>

                {/* ZONE 2 (REST DER KARTE): Volle Breite für Titel & In-Place Aufklappen */}
                <div
                  onClick={() => toggleActionCard(task.id)}
                  className="flex-1 min-w-0 pt-2.5 pb-1 pr-1 cursor-pointer select-none"
                >
                  <span
                    className={`text-base font-semibold leading-snug block break-words transition-colors duration-300 ${
                      task.completed && !isGlowing
                        ? 'line-through text-[#94A3B8]/60 decoration-[#94A3B8]/40'
                        : 'text-[#F1F5F9]'
                    }`}
                  >
                    {displayTitle}
                  </span>

                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {/* KI-Hinweis: Warmes Honig-Gold #E5A93C ohne grelles Alarm-Rot */}
                    {task.aiTouched && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#E5A93C] bg-[#E5A93C]/10 px-2 py-0.5 rounded-md border border-[#E5A93C]/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#E5A93C] animate-pulse" />
                        KI-Hinweis
                      </span>
                    )}

                    {displayGroup && (
                      <span className="text-xs font-medium text-[#94A3B8] px-2 py-0.5 rounded-md bg-[#111317]">
                        {displayGroup}
                      </span>
                    )}

                    {task.estimatedMinutes && (
                      <span className="text-xs font-mono text-[#94A3B8]">
                        {Math.round(
                          task.estimatedMinutes *
                            (prefs.adhdMasterEnabled && prefs.adhdTimeBufferAndHaptics ? 1.25 : 1)
                        )}{' '}
                        Min.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* In-Place aufgeklappter Bereich (Kontext-Infos + Kompakte Aktionsleiste) */}
              {isTrayOpen && (
                <div className="px-4 pb-4 pt-2.5 border-t border-white/5 space-y-3 bg-[#111317]/80 animate-fadeIn">
                  {/* Inline-Bearbeitung */}
                  {editingTaskId === task.id ? (
                    <div className="p-3 rounded-2xl bg-[#191C22] border border-white/10 space-y-2.5">
                      <div className="text-xs font-bold text-[#F1F5F9]">Aufgabe bearbeiten</div>
                      <input
                        type="text"
                        value={editTaskTitle}
                        onChange={(e) => setEditTaskTitle(e.target.value)}
                        className="w-full min-h-[44px] px-3.5 py-2 rounded-xl text-sm bg-[#111317] text-[#F1F5F9] border border-white/10 focus:outline-none focus:border-[#14B8A6]"
                      />
                      <input
                        type="text"
                        value={editTaskGroup}
                        onChange={(e) => setEditTaskGroup(e.target.value)}
                        placeholder="Baugruppe (optional)"
                        className="w-full min-h-[44px] px-3.5 py-2 rounded-xl text-xs bg-[#111317] text-[#F1F5F9] border border-white/10 focus:outline-none focus:border-[#14B8A6]"
                      />
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setEditingTaskId(null)}
                          className="min-h-[44px] px-4 rounded-xl text-xs font-semibold text-[#94A3B8] hover:text-white cursor-pointer"
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
                          className="min-h-[44px] px-4 rounded-xl text-xs font-bold text-white shadow-md active:scale-95 transition cursor-pointer"
                          style={{ backgroundColor: themeColors.primary }}
                        >
                          Speichern
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {/* KI-Bestätigung: Dezent in Honig-Gold #E5A93C */}
                  {task.aiTouched && (
                    <button
                      type="button"
                      onClick={() => {
                        onConfirmRedDot(activeProject.id, 'tasks', task.id);
                        toggleActionCard(task.id);
                      }}
                      className="w-full min-h-[44px] px-4 rounded-xl text-xs font-bold bg-[#E5A93C]/15 hover:bg-[#E5A93C]/25 text-[#E5A93C] border border-[#E5A93C]/30 flex items-center justify-center gap-2 active:scale-95 transition cursor-pointer"
                    >
                      <span className="w-2 h-2 rounded-full bg-[#E5A93C]" />
                      <span>KI-Änderung prüfen &amp; bestätigen</span>
                    </button>
                  )}

                  {/* Kompakte Aktionsleiste (Touch-Ziele >= 44px) */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const m = task.title.match(/^\[(.*?)\]\s*(.*)$/);
                        const textToCopy = m ? m[2] : task.title;
                        navigator.clipboard.writeText(textToCopy);
                        triggerHapticFeedback(10);
                        onNotify('Aufgabe in die Zwischenablage kopiert.');
                      }}
                      className="min-w-0 min-h-[44px] px-3 rounded-xl text-xs font-semibold bg-[#191C22] hover:bg-[#22262F] text-[#F1F5F9] hover:text-[#14B8A6] border border-white/5 flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
                    >
                      <Copy className="w-4 h-4 text-[#14B8A6] shrink-0" />
                      <span className="truncate">Kopieren</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const m = task.title.match(/^\[(.*?)\]\s*(.*)$/);
                        setEditTaskTitle(m ? m[2] : task.title);
                        setEditTaskGroup(task.assemblyGroup || (m ? m[1] : ''));
                        setEditingTaskId(task.id);
                      }}
                      className="min-w-0 min-h-[44px] px-3 rounded-xl text-xs font-semibold bg-[#191C22] hover:bg-[#22262F] text-[#F1F5F9] hover:text-[#14B8A6] border border-white/5 flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4 text-[#14B8A6] shrink-0" />
                      <span className="truncate">Bearbeiten</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        window.open(
                          buildGoogleCalendarTemplateUrl(task, activeProject.name),
                          '_blank'
                        );
                      }}
                      className="min-w-0 min-h-[44px] px-3 rounded-xl text-xs font-semibold bg-[#191C22] hover:bg-[#22262F] text-[#F1F5F9] hover:text-[#14B8A6] border border-white/5 flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
                    >
                      <Calendar className="w-4 h-4 text-[#14B8A6] shrink-0" />
                      <span className="truncate">Google Kalender</span>
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
                        className="min-w-0 min-h-[44px] px-3 rounded-xl text-xs font-semibold bg-[#191C22] hover:bg-[#22262F] text-[#F1F5F9] border border-white/5 flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
                      >
                        <ShoppingCart className="w-4 h-4 text-[#14B8A6] shrink-0" />
                        <span className="truncate">In Einkaufswagen</span>
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
                        className={`min-w-0 min-h-[44px] px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer ${
                          isAnchored
                            ? 'text-white border-white/20'
                            : 'bg-[#191C22] text-[#94A3B8] hover:text-white border-white/5'
                        }`}
                        style={isAnchored ? { backgroundColor: themeColors.primary } : {}}
                      >
                        <Crosshair className="w-4 h-4 shrink-0" />
                        <span className="truncate">{isAnchored ? 'Fokus lösen' : 'Als Fokus anpinnen'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDeleteWithUndo(task)}
                      className="col-span-2 min-w-0 min-h-[44px] px-3.5 rounded-xl text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4 shrink-0" />
                      <span className="truncate">Löschen</span>
                    </button>
                  </div>

                  {/* Projektverschiebung */}
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
                        className="w-full min-h-[44px] px-3.5 py-2 rounded-xl text-xs bg-[#111317] text-[#F1F5F9] border border-white/10 focus:outline-none focus:border-[#14B8A6] cursor-pointer"
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

      {/* BEREICHS-EINSTELLUNGEN */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => onOpenSettings?.()}
          className="w-full min-h-[44px] py-2.5 px-4 rounded-xl text-xs font-semibold text-[#94A3B8] hover:text-white bg-[#191C22]/60 hover:bg-[#191C22] border border-white/5 flex items-center justify-center gap-2 active:scale-95 transition cursor-pointer"
        >
          <Settings className="w-4 h-4 text-[#14B8A6]" />
          <span>Aufgaben-Einstellungen &amp; ADHS</span>
        </button>
      </div>
    </section>
  );
};
