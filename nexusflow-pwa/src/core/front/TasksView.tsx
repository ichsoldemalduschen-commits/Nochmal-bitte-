import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  Check,
  CheckSquare,
  Clock,
  Copy,
  Crosshair,
  Dices,
  Edit3,
  Eye,
  MoreVertical,
  Plus,
  RotateCcw,
  Settings,
  ShoppingCart,
  Trash2
} from 'lucide-react';
import {
  BanditUserPreferences,
  DayBlockId,
  EnergyLevel,
  PriorityType,
  Project,
  ReminderRecurrence,
  SubTaskItem,
  TaskItem
} from '../../types';
import {
  buildGoogleCalendarTemplateUrl,
  formatReminderBadge,
  parseReminderDate,
  toLocalDateTimeInputValue
} from '../../services/cloudSyncAndPush';
import { filterTasksByEnergy, rollHurdleTask } from '../../services/adhsDriveEngine';
import { triggerHapticFeedback } from '../../services/storage';
import { DESIGN_TOKENS } from '../../config/designTokens';
import { CHECK_GLOW_MS } from '../../config/runtimeConfig';
import { ChangeLogAccordion } from './ChangeLogAccordion';
import { TasksNowStage } from './TasksNowStage';
import { ThemeColors } from './FrontHeader';

const DAY_BLOCK_OPTIONS: Array<{ id: DayBlockId; label: string; testKey: string }> = [
  { id: null, label: 'Ohne', testKey: 'none' },
  { id: 'morning', label: 'Morgens', testKey: 'morning' },
  { id: 'focus', label: 'Mittags', testKey: 'focus' },
  { id: 'errands', label: 'Nachmittags', testKey: 'errands' },
  { id: 'evening', label: 'Abends', testKey: 'evening' }
];

const DAY_BLOCK_LABEL_MAP: Record<Exclude<DayBlockId, null>, string> = {
  morning: 'Morgens',
  focus: 'Mittags',
  errands: 'Nachmittags',
  evening: 'Abends'
};

const PRIORITY_OPTIONS: PriorityType[] = ['Hoch', 'Mittel', 'Niedrig'];
const DURATION_PRESETS = [5, 15, 30, 60] as const;

interface TasksViewProps {
  activeProject: Project;
  allProjects: Project[];
  themeColors: ThemeColors;
  prefs: BanditUserPreferences;
  taskExtendedMetaEnabled?: boolean;
  changeHistoryEnabled?: boolean;
  nowStageEnabled?: boolean;
  searchQuery: string;
  highlightedItemId: string | null;
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
    extra?: { energyLevel?: EnergyLevel; isHurdleTask?: boolean; dayBlock?: DayBlockId }
  ) => void;
  onDeleteTask: (projectId: string, taskId: string) => void;
  onUpdateTask?: (projectId: string, taskId: string, patch: Partial<TaskItem>) => void;
  onMoveTask?: (fromProjectId: string, toProjectId: string, taskId: string) => void;
  onSendTaskToCart?: (projectId: string, title: string) => void;
  onAddCartItems: (projectId: string, items: Array<{ title: string; quantity: string; price?: string; reason?: string }>) => void;
  onConfirmRedDot: (projectId: string, section: 'tasks' | 'cart' | 'knowledge', itemId: string) => void;
  onResetChecklist?: (projectId: string) => void;
  onResetChecklistForDeployment?: (projectId: string) => void;
  onUpdatePrefs: (patch: Partial<BanditUserPreferences>) => void;
  onOpenSingleFocus?: (taskId?: string) => void;
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
  taskExtendedMetaEnabled,
  changeHistoryEnabled,
  nowStageEnabled,
  searchQuery,
  highlightedItemId,
  onToggleTask,
  onAddSubTask,
  onToggleSubTask,
  onDeleteSubTask,
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
  onOpenSingleFocus,
  onOpenSettings,
  onNotify,
  onRegisterUndo,
  onConfigMissing: _onConfigMissing
}) => {
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskGroup, setNewTaskGroup] = useState('');
  const [newTaskReminderAt, setNewTaskReminderAt] = useState('');
  const [newTaskRecurrence, setNewTaskRecurrence] = useState<ReminderRecurrence>('none');
  const [newTaskEnergy, setNewTaskEnergy] = useState<EnergyLevel>('medium');
  const [newTaskHurdle, setNewTaskHurdle] = useState(false);
  const [newTaskPriority, setNewTaskPriority] = useState<PriorityType>('Mittel');
  const [newTaskMinutes, setNewTaskMinutes] = useState<number>(25);
  const [newTaskDayBlock, setNewTaskDayBlock] = useState<DayBlockId>(null);
  const [showNewTaskExtendedMeta, setShowNewTaskExtendedMeta] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editTaskGroup, setEditTaskGroup] = useState('');
  const [editTaskReminderAt, setEditTaskReminderAt] = useState('');
  const [editTaskRecurrence, setEditTaskRecurrence] = useState<ReminderRecurrence>('none');
  const [editTaskEnergy, setEditTaskEnergy] = useState<EnergyLevel>('medium');
  const [editTaskHurdle, setEditTaskHurdle] = useState(false);
  const [editTaskPriority, setEditTaskPriority] = useState<PriorityType>('Mittel');
  const [editTaskMinutes, setEditTaskMinutes] = useState<number>(15);
  const [editTaskDayBlock, setEditTaskDayBlock] = useState<DayBlockId>(null);
  const [energyFilter, setEnergyFilter] = useState<EnergyLevel | 'all'>('all');
  const [singleFocusActive, setSingleFocusActive] = useState(false);
  const [nowListExpanded, setNowListExpanded] = useState(false);
  const [expandedActionCards, setExpandedActionCards] = useState<Record<string, boolean>>({});
  const [glowTaskId, setGlowTaskId] = useState<string | null>(null);
  const [glowSubTaskId, setGlowSubTaskId] = useState<string | null>(null);
  const [subTaskDrafts, setSubTaskDrafts] = useState<Record<string, string>>({});
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  const driveDiceEnabled = prefs.driveDiceEnabled !== false;
  const energyPlannerEnabled = prefs.energyPlannerEnabled !== false;
  const showExtendedMeta =
    typeof taskExtendedMetaEnabled === 'boolean'
      ? taskExtendedMetaEnabled
      : prefs.taskExtendedMetaEnabled !== false;
  const showChangeHistory =
    typeof changeHistoryEnabled === 'boolean'
      ? changeHistoryEnabled
      : prefs.changeHistoryEnabled !== false;
  const isNowStageActive =
    typeof nowStageEnabled === 'boolean' ? nowStageEnabled : prefs.nowStageEnabled === true;
  const effectiveEnergyFilter: EnergyLevel | 'all' = energyPlannerEnabled ? energyFilter : 'all';

  const toggleActionCard = (id: string) => {
    triggerHapticFeedback(10);
    setExpandedActionCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const sortedTasks = useMemo(() => {
    const baseTasks =
      effectiveEnergyFilter === 'all'
        ? [...activeProject.tasks]
        : filterTasksByEnergy(
            activeProject.tasks.filter((t) => !t.completed),
            effectiveEnergyFilter
          );

    const filtered = baseTasks
      .filter((t) => {
        if (searchQuery.trim() && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) {
          return false;
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
  }, [activeProject, searchQuery, prefs, singleFocusActive, glowTaskId, effectiveEnergyFilter]);

  const openTasksForNowStage = useMemo(
    () => sortedTasks.filter((t) => !t.completed),
    [sortedTasks]
  );

  const triggerSoftCompleteTask = (task: TaskItem) => {
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
      }, CHECK_GLOW_MS);
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

  const handleSoftToggle = (e: React.MouseEvent, task: TaskItem) => {
    e.stopPropagation();
    triggerSoftCompleteTask(task);
  };

  const handleSoftSubTaskToggle = (task: TaskItem, subTask: SubTaskItem) => {
    triggerHapticFeedback([12, 30]);
    if (!subTask.completed) {
      const sortedSubs = [...(task.subTasks || [])].sort((a, b) => a.order - b.order);
      const willAutoFinish = sortedSubs.filter((s) => !s.completed && s.id !== subTask.id).length === 0;
      setGlowSubTaskId(subTask.id);
      setTimeout(() => {
        onToggleSubTask?.(activeProject.id, task.id, subTask.id);
        setGlowSubTaskId(null);
        if (willAutoFinish) {
          onRegisterUndo?.({
            message: `„${task.title}“ komplett erledigt`,
            undo: () => onToggleSubTask?.(activeProject.id, task.id, subTask.id)
          });
        }
      }, CHECK_GLOW_MS);
    } else {
      onToggleSubTask?.(activeProject.id, task.id, subTask.id);
    }
  };

  const handleDeleteWithUndo = (task: TaskItem) => {
    const taskBackup = { ...task };
    onDeleteTask(activeProject.id, task.id);
    onRegisterUndo?.({
      message: 'Aufgabe gelöscht',
      undo: () => {
        onAddTask(
          activeProject.id,
          taskBackup.title,
          taskBackup.priority,
          taskBackup.estimatedMinutes,
          taskBackup.assemblyGroup,
          taskBackup.reminderAt || undefined,
          taskBackup.reminderRecurrence,
          {
            ...(taskBackup.energyLevel ? { energyLevel: taskBackup.energyLevel } : {}),
            ...(taskBackup.isHurdleTask ? { isHurdleTask: true } : {})
          }
        );
        onNotify('Aufgabe wiederhergestellt.');
      }
    });
    onNotify('Aufgabe gelöscht.');
  };

  const buildPresetLocalTime = (daysOffset: number, hour: number, minute: number): string => {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    d.setHours(hour, minute, 0, 0);
    return toLocalDateTimeInputValue(d);
  };

  const toDateTimeLocalInputVal = (val: string): string => {
    if (!val.trim()) return '';
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(val.trim())) {
      return val.trim().slice(0, 16);
    }
    const parsed = parseReminderDate(val);
    return parsed ? toLocalDateTimeInputValue(parsed) : '';
  };

  const renderReminderPicker = (
    reminderValue: string,
    recurrenceValue: ReminderRecurrence,
    onChangeReminder: (nextVal: string) => void,
    onChangeRecurrence: (nextRec: ReminderRecurrence) => void
  ) => {
    const chips = [
      { label: 'Heute 18:00', getValue: () => buildPresetLocalTime(0, 18, 0) },
      { label: 'Abend-Check 20:00', getValue: () => buildPresetLocalTime(0, 20, 0) },
      { label: 'Morgen 09:00', getValue: () => buildPresetLocalTime(1, 9, 0) }
    ];
    const recurrenceOptions: Array<{ id: ReminderRecurrence; label: string }> = [
      { id: 'none', label: 'Einmalig' },
      { id: 'daily', label: 'Täglich' },
      { id: 'weekly', label: 'Wöchentlich' }
    ];

    return (
      <div className="p-3 rounded-xl bg-[#111317] border border-white/10 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#E5A93C]">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>Erinnerung</span>
          </div>
          {reminderValue && (
            <button
              type="button"
              onClick={() => {
                onChangeReminder('');
                onChangeRecurrence('none');
              }}
              className="min-h-[44px] px-3 rounded-xl text-xs font-semibold text-[#94A3B8] hover:text-[#F1F5F9] bg-[#191C22] border border-white/5 active:scale-95 transition cursor-pointer"
            >
              Aus
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => onChangeReminder(chip.getValue())}
              className="min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#191C22] hover:bg-[#22262F] text-[#F1F5F9] border border-white/10 active:scale-95 transition cursor-pointer"
            >
              {chip.label}
            </button>
          ))}
        </div>

        <input
          type="datetime-local"
          aria-label="Erinnerungszeit wählen"
          value={toDateTimeLocalInputVal(reminderValue)}
          onChange={(e) => onChangeReminder(e.target.value)}
          className="w-full min-w-0 min-h-[44px] px-3 py-2 rounded-xl text-xs font-mono bg-[#191C22] text-[#F1F5F9] border border-white/10 focus:outline-none focus:border-[#E5A93C] [color-scheme:dark]"
        />

        {reminderValue && (
          <div className="grid grid-cols-3 gap-1.5">
            {recurrenceOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChangeRecurrence(opt.id)}
                className={`min-h-[44px] px-2 py-1.5 rounded-xl text-xs font-semibold border transition active:scale-95 cursor-pointer ${
                  recurrenceValue === opt.id
                    ? 'text-[#111317] border-transparent font-bold'
                    : 'bg-[#191C22] text-[#94A3B8] hover:text-[#F1F5F9] border-white/10'
                }`}
                style={recurrenceValue === opt.id ? { backgroundColor: DESIGN_TOKENS.accentHoney } : {}}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderExtendedMetaPicker = (
    priorityVal: PriorityType,
    minutesVal: number,
    dayBlockVal: DayBlockId,
    onChangePriority: (p: PriorityType) => void,
    onChangeMinutes: (m: number) => void,
    onChangeDayBlock: (b: DayBlockId) => void,
    prefix: string
  ) => (
    <div
      data-testid={`${prefix}-extended-meta`}
      className="p-3 rounded-xl bg-[#111317] border border-white/10 space-y-2.5"
    >
      <div className="space-y-1.5">
        <div className="text-xs font-semibold text-[#94A3B8]">Priorität</div>
        <div className="flex flex-wrap gap-1.5">
          {PRIORITY_OPTIONS.map((prio) => {
            const active = priorityVal === prio;
            return (
              <button
                key={prio}
                type="button"
                data-testid={`${prefix}-priority-${prio}`}
                onClick={() => onChangePriority(prio)}
                className={`min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition active:scale-95 cursor-pointer ${
                  active
                    ? 'text-white border-white/30 font-bold'
                    : 'bg-[#191C22] text-[#94A3B8] hover:text-[#F1F5F9] border-white/10'
                }`}
                style={active ? { backgroundColor: themeColors.primary } : {}}
              >
                {prio}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="text-xs font-semibold text-[#94A3B8]">Geschätzte Dauer</div>
        <div className="flex flex-wrap items-center gap-1.5">
          {DURATION_PRESETS.map((mins) => {
            const active = minutesVal === mins;
            return (
              <button
                key={mins}
                type="button"
                data-testid={`${prefix}-duration-${mins}`}
                onClick={() => onChangeMinutes(mins)}
                className={`min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-mono font-semibold border transition active:scale-95 cursor-pointer ${
                  active
                    ? 'text-white border-white/30 font-bold'
                    : 'bg-[#191C22] text-[#94A3B8] hover:text-[#F1F5F9] border-white/10'
                }`}
                style={active ? { backgroundColor: themeColors.primary } : {}}
              >
                {mins} min
              </button>
            );
          })}
          <div className="flex items-center gap-1.5 min-w-0">
            <input
              type="number"
              min={1}
              max={999}
              inputMode="numeric"
              aria-label="Freie Minuten"
              data-testid={`${prefix}-duration-input`}
              value={minutesVal > 0 ? minutesVal : ''}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n) && n >= 0) {
                  onChangeMinutes(Math.min(999, Math.round(n)));
                }
              }}
              className="w-20 min-w-0 min-h-[44px] px-2.5 py-1.5 rounded-xl text-xs font-mono bg-[#191C22] text-[#F1F5F9] border border-white/10 focus:outline-none focus:border-[#14B8A6]"
            />
            <span className="text-xs font-mono text-[#94A3B8]">min</span>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="text-xs font-semibold text-[#94A3B8]">Tagesblock</div>
        <div className="flex flex-wrap gap-1.5">
          {DAY_BLOCK_OPTIONS.map((opt) => {
            const active = (dayBlockVal ?? null) === opt.id;
            return (
              <button
                key={opt.testKey}
                type="button"
                data-testid={`${prefix}-dayblock-${opt.testKey}`}
                onClick={() => onChangeDayBlock(opt.id)}
                className={`min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition active:scale-95 cursor-pointer ${
                  active
                    ? 'text-white border-white/30 font-bold'
                    : 'bg-[#191C22] text-[#94A3B8] hover:text-[#F1F5F9] border-white/10'
                }`}
                style={active ? { backgroundColor: themeColors.primary } : {}}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

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

        <div className="relative flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsAddingTask((v) => !v)}
            className={`w-11 h-11 min-h-[44px] min-w-[44px] rounded-2xl border flex items-center justify-center transition active:scale-95 cursor-pointer shrink-0 ${isAddingTask
              ? 'text-white border-white/30'
              : 'bg-[#191C22] hover:bg-[#22262F] text-white border-white/5'
              }`}
            style={isAddingTask ? { backgroundColor: themeColors.primary } : {}}
            aria-label="Aufgabe hinzufügen"
            title="Aufgabe hinzufügen"
          >
            <Plus className="w-5 h-5 text-[#14B8A6]" />
          </button>

          <button
            type="button"
            onClick={() => setIsMenuOpen((v) => !v)}
            className={`w-11 h-11 min-h-[44px] min-w-[44px] rounded-2xl border flex items-center justify-center transition active:scale-95 cursor-pointer shrink-0 ${isMenuOpen
              ? 'bg-[#22262F] text-white border-white/20'
              : 'bg-[#191C22] hover:bg-[#22262F] text-[#94A3B8] hover:text-white border-white/5'
              }`}
            aria-label="Weitere Aufgaben-Aktionen"
            title="Weitere Optionen"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {isMenuOpen && (
            <div
              ref={menuRef}
              role="menu"
              aria-label="Aufgaben-Aktionen"
              className="absolute right-0 top-12 z-30 w-60 p-1.5 rounded-2xl bg-[#191C22] border border-white/10 shadow-xl space-y-1 animate-fadeIn"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setSingleFocusActive((s) => !s);
                  setIsMenuOpen(false);
                }}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-xs font-semibold text-left flex items-center gap-2.5 hover:bg-white/5 text-[#F1F5F9] active:scale-95 transition cursor-pointer"
              >
                <Eye className="w-4 h-4 text-[#14B8A6] shrink-0" />
                <span>{singleFocusActive ? '1-Fokus beenden' : '1-Fokus aktivieren'}</span>
              </button>

              {driveDiceEnabled && onOpenSingleFocus && (
                <button
                  type="button"
                  role="menuitem"
                  data-testid="menu-drive-dice"
                  onClick={() => {
                    const rolled = rollHurdleTask(
                      activeProject.tasks,
                      null,
                      effectiveEnergyFilter
                    );
                    setIsMenuOpen(false);
                    if (rolled) {
                      onOpenSingleFocus(rolled.id);
                    } else {
                      onNotify('Keine offenen Aufgaben für den Antriebs-Würfel.');
                    }
                  }}
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-xs font-semibold text-left flex items-center gap-2.5 hover:bg-white/5 text-[#E5A93C] active:scale-95 transition cursor-pointer"
                >
                  <Dices className="w-4 h-4 text-[#E5A93C] shrink-0" />
                  <span>Antriebs-Würfel (Schweinehund-Pool)</span>
                </button>
              )}

              <button
                type="button"
                role="menuitem"
                disabled={!activeProject.tasks.some((t) => t.completed)}
                onClick={() => {
                  if (onResetChecklist) onResetChecklist(activeProject.id);
                  else if (onResetChecklistForDeployment) onResetChecklistForDeployment(activeProject.id);
                  setIsMenuOpen(false);
                }}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-xs font-semibold text-left flex items-center gap-2.5 hover:bg-white/5 text-[#F1F5F9] disabled:opacity-40 disabled:pointer-events-none active:scale-95 transition cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 text-[#14B8A6] shrink-0" />
                <span>Checkliste zurücksetzen</span>
              </button>

              <div className="h-px bg-white/5 my-1" />

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenSettings?.();
                }}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-xs font-semibold text-left flex items-center gap-2.5 hover:bg-white/5 text-[#94A3B8] hover:text-white active:scale-95 transition cursor-pointer"
              >
                <Settings className="w-4 h-4 text-[#14B8A6] shrink-0" />
                <span>Aufgaben-Einstellungen &amp; ADHS</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* PROGRESSIVE DISCLOSURE: Eingabeformular für Tasks */}
      {isAddingTask && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newTaskTitle.trim()) return;
            onAddTask(
              activeProject.id,
              newTaskTitle.trim(),
              showExtendedMeta ? newTaskPriority : 'Mittel',
              showExtendedMeta && newTaskMinutes > 0 ? newTaskMinutes : 25,
              newTaskGroup.trim() || undefined,
              newTaskReminderAt || undefined,
              newTaskReminderAt ? newTaskRecurrence : undefined,
              {
                ...(energyPlannerEnabled ? { energyLevel: newTaskEnergy } : {}),
                ...(driveDiceEnabled && newTaskHurdle ? { isHurdleTask: true } : {}),
                ...(showExtendedMeta && newTaskDayBlock ? { dayBlock: newTaskDayBlock } : {})
              }
            );
            setNewTaskTitle('');
            setNewTaskGroup('');
            setNewTaskReminderAt('');
            setNewTaskRecurrence('none');
            setNewTaskEnergy('medium');
            setNewTaskHurdle(false);
            setNewTaskPriority('Mittel');
            setNewTaskMinutes(25);
            setNewTaskDayBlock(null);
            setShowNewTaskExtendedMeta(false);
            setIsAddingTask(false);
            if (isNowStageActive) {
              setNowListExpanded(true);
            }
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
          {(energyPlannerEnabled || driveDiceEnabled) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {energyPlannerEnabled &&
                ([
                  { id: 'low', label: 'Niedrig' },
                  { id: 'medium', label: 'Mittel' },
                  { id: 'high', label: 'Hoch' }
                ] as const).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    data-testid={`task-form-energy-${opt.id}`}
                    onClick={() => setNewTaskEnergy(opt.id)}
                    className={`min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition active:scale-95 cursor-pointer ${
                      newTaskEnergy === opt.id
                        ? 'text-white border-white/30'
                        : 'bg-[#111317] text-[#94A3B8] hover:text-[#F1F5F9] border-white/10'
                    }`}
                    style={
                      newTaskEnergy === opt.id ? { backgroundColor: themeColors.primary } : {}
                    }
                  >
                    Akku: {opt.label}
                  </button>
                ))}
              {driveDiceEnabled && (
                <button
                  type="button"
                  data-testid="task-form-hurdle-toggle"
                  onClick={() => setNewTaskHurdle((v) => !v)}
                  className={`min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition active:scale-95 cursor-pointer ${
                    newTaskHurdle
                      ? 'text-[#111317] border-transparent font-bold'
                      : 'bg-[#111317] text-[#94A3B8] hover:text-[#F1F5F9] border-white/10'
                  }`}
                  style={
                    newTaskHurdle ? { backgroundColor: DESIGN_TOKENS.accentHoney } : {}
                  }
                >
                  Schweinehund-Pool
                </button>
              )}
            </div>
          )}
          {showExtendedMeta && (
            <div className="space-y-2">
              <button
                type="button"
                aria-expanded={showNewTaskExtendedMeta}
                onClick={() => setShowNewTaskExtendedMeta((v) => !v)}
                className="min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#111317] text-[#94A3B8] hover:text-[#F1F5F9] border border-white/10 transition cursor-pointer"
              >
                {showNewTaskExtendedMeta
                  ? 'Priorität, Dauer & Tagesblock ausblenden'
                  : '+ Priorität, Dauer & Tagesblock'}
              </button>
              {showNewTaskExtendedMeta &&
                renderExtendedMetaPicker(
                  newTaskPriority,
                  newTaskMinutes,
                  newTaskDayBlock,
                  setNewTaskPriority,
                  setNewTaskMinutes,
                  setNewTaskDayBlock,
                  'add-task'
                )}
            </div>
          )}
          {renderReminderPicker(
            newTaskReminderAt,
            newTaskRecurrence,
            setNewTaskReminderAt,
            setNewTaskRecurrence
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setIsAddingTask(false);
                setNewTaskTitle('');
                setNewTaskGroup('');
                setNewTaskReminderAt('');
                setNewTaskRecurrence('none');
                setNewTaskEnergy('medium');
                setNewTaskHurdle(false);
                setNewTaskPriority('Mittel');
                setNewTaskMinutes(25);
                setNewTaskDayBlock(null);
                setShowNewTaskExtendedMeta(false);
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

      {/* Energie-gekoppelter Tagesplaner (Akku-Filterleiste) */}
      {energyPlannerEnabled && (
        <div
          data-testid="energy-filter-bar"
          className="flex items-center gap-1.5 flex-wrap px-1"
        >
          <span className="text-xs font-semibold text-[#94A3B8] mr-1">Akku:</span>
          {([
            { id: 'all', label: 'Alle' },
            { id: 'low', label: 'Niedrig' },
            { id: 'medium', label: 'Mittel' },
            { id: 'high', label: 'Hoch' }
          ] as const).map((chip) => {
            const isActive = effectiveEnergyFilter === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                data-testid={`energy-filter-${chip.id}`}
                onClick={() => setEnergyFilter(chip.id)}
                className={`min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition active:scale-95 cursor-pointer ${
                  isActive
                    ? 'text-white border-white/25'
                    : 'bg-[#191C22] text-[#94A3B8] hover:text-[#F1F5F9] border-white/5'
                }`}
                style={isActive ? { backgroundColor: themeColors.primary } : {}}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Opt-in A+C-„Jetzt-Vorbühne“ über der Aufgabenliste */}
      {isNowStageActive && openTasksForNowStage.length > 0 && (
        <TasksNowStage
          openTasks={openTasksForNowStage}
          projectColor={themeColors.primary}
          timeBufferMultiplier={
            prefs.adhdMasterEnabled && prefs.adhdTimeBufferAndHaptics ? 1.25 : 1
          }
          completingTaskId={glowTaskId}
          listExpanded={nowListExpanded}
          onToggleListExpanded={() => setNowListExpanded((v) => !v)}
          totalRestCount={sortedTasks.length}
          onCompleteTask={triggerSoftCompleteTask}
          onStartSingleFocus={onOpenSingleFocus}
        />
      )}

      {/* Tasks-Liste: Zwei-Zonen-Karten direkt auf dem Canvas */}
      {(!isNowStageActive || nowListExpanded || isAddingTask || openTasksForNowStage.length === 0) && (
      <div className={isNowStageActive ? 'space-y-2.5 bandit-reveal' : 'space-y-2.5'}>
        {energyPlannerEnabled && effectiveEnergyFilter !== 'all' && sortedTasks.length === 0 && (
          <div
            data-testid="energy-filter-empty"
            className="p-3.5 rounded-2xl bg-[#191C22] border border-white/5 flex items-center justify-between gap-2 flex-wrap"
          >
            <span className="text-xs text-[#94A3B8]">
              Keine offenen Aufgaben für dieses Akku-Level.
            </span>
            <button
              type="button"
              onClick={() => setEnergyFilter('all')}
              className="min-h-[44px] px-3.5 rounded-xl text-xs font-bold text-[#111317] active:scale-95 transition cursor-pointer"
              style={{ backgroundColor: DESIGN_TOKENS.accentHoney }}
            >
              Alle zeigen
            </button>
          </div>
        )}
        {sortedTasks.map((task) => {
          const isAnchored = prefs.activeFocusTaskId === task.id;
          const isTrayOpen = !!expandedActionCards[task.id];
          const isGlowing = glowTaskId === task.id;
          const isEffectivelyCompleted = task.completed || isGlowing;
          const bracketMatch = task.title.match(/^\[(.*?)\]\s*(.*)$/);
          const displayTitle = bracketMatch ? bracketMatch[2] : task.title;
          const displayGroup = task.assemblyGroup || (bracketMatch ? bracketMatch[1] : null);
          const sortedSubTasks =
            Array.isArray(task.subTasks) && task.subTasks.length > 0
              ? [...task.subTasks].sort((a, b) => a.order - b.order)
              : [];
          const hasSubTasks = sortedSubTasks.length > 0;
          const doneSubCount = sortedSubTasks.filter((st) => st.completed).length;
          const firstOpenSubTask = sortedSubTasks.find((st) => !st.completed) || null;

          return (
            <div
              key={task.id}
              id={`item-card-${task.id}`}
              className={`rounded-2xl border transition-all duration-300 overflow-hidden shadow-sm ${task.completed && !isGlowing ? 'opacity-65' : ''
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
                    className={`text-base font-semibold leading-snug block break-words transition-colors duration-300 ${task.completed && !isGlowing
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

                    {hasSubTasks && (
                      <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-[#111317] text-[#F1F5F9] border border-white/5">
                        {doneSubCount}/{sortedSubTasks.length}
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

                    {!task.completed && task.reminderAt && (
                      <span className="inline-flex items-center gap-1 text-xs font-mono text-[#94A3B8] px-2 py-0.5 rounded-md bg-[#111317]">
                        <span>⏰ {formatReminderBadge(task.reminderAt)}</span>
                        {(task.reminderRecurrence === 'daily' ||
                          task.reminderRecurrence === 'weekly') && (
                          <span aria-hidden="true">↻</span>
                        )}
                      </span>
                    )}

                    {energyPlannerEnabled &&
                      (task.energyLevel === 'low' || task.energyLevel === 'high') && (
                        <span className="text-xs font-medium text-[#94A3B8] px-2 py-0.5 rounded-md bg-[#111317]">
                          {task.energyLevel === 'low' ? 'Akku: Niedrig' : 'Akku: Hoch'}
                        </span>
                      )}

                    {driveDiceEnabled && task.isHurdleTask === true && (
                      <span className="text-xs font-semibold text-[#E5A93C] bg-[#E5A93C]/10 px-2 py-0.5 rounded-md border border-[#E5A93C]/20">
                        Schweinehund
                      </span>
                    )}
                  </div>

                  {/* Zugeklappter Sammel-Task: Genau eine ruhige Vorschauzeile mit erstem offenen Schritt */}
                  {!isTrayOpen && hasSubTasks && firstOpenSubTask && (
                    <div className="mt-1.5 flex items-center gap-2 text-xs text-[#94A3B8] leading-snug break-words">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: DESIGN_TOKENS.accentHoney }}
                      />
                      <span className="min-w-0 break-words">
                        Nächster: <span className="text-[#F1F5F9]/90">{firstOpenSubTask.title}</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* In-Place aufgeklappter Bereich (Kontext-Infos + Arbeitsschritte + Kompakte Aktionsleiste) */}
              {isTrayOpen && (
                <div className="px-4 pb-4 pt-2.5 border-t border-white/5 space-y-3 bg-[#111317]/80 animate-fadeIn">
                  {/* Arbeitsschritte (Sammel-Task / Arbeitsblock) */}
                  <div className="space-y-2">
                    {hasSubTasks && (
                      <div className="space-y-1.5">
                        {sortedSubTasks.map((st) => {
                          const isSubGlowing = glowSubTaskId === st.id;
                          const isSubCompleted = st.completed || isSubGlowing;
                          const isNextStep = firstOpenSubTask?.id === st.id;
                          return (
                            <div
                              key={st.id}
                              data-active-step={isNextStep ? 'true' : undefined}
                              className={`relative min-h-[44px] rounded-xl border flex items-center gap-1 pr-1 overflow-hidden transition-all duration-300 ${
                                st.completed && !isSubGlowing ? 'opacity-65' : ''
                              }`}
                              style={{
                                backgroundColor: DESIGN_TOKENS.surface,
                                borderColor: isSubGlowing
                                  ? `${themeColors.primary}99`
                                  : isNextStep
                                  ? `${DESIGN_TOKENS.accentHoney}55`
                                  : DESIGN_TOKENS.borderSubtle,
                                boxShadow: isSubGlowing
                                  ? `0 0 12px ${themeColors.primary}44`
                                  : undefined
                              }}
                            >
                              {isNextStep && (
                                <div
                                  className="absolute left-0 top-0 bottom-0 w-[3px]"
                                  style={{ backgroundColor: DESIGN_TOKENS.accentHoney }}
                                  aria-hidden="true"
                                />
                              )}

                              <button
                                type="button"
                                onClick={() => handleSoftSubTaskToggle(task, st)}
                                className="min-w-[44px] min-h-[44px] w-11 h-11 flex items-center justify-center shrink-0 cursor-pointer"
                                aria-label={
                                  st.completed
                                    ? `Arbeitsschritt ${st.title} wieder öffnen`
                                    : `Arbeitsschritt ${st.title} abhaken`
                                }
                              >
                                <div
                                  className="w-4 h-4 rounded flex items-center justify-center border transition-all duration-300"
                                  style={{
                                    backgroundColor: isSubCompleted
                                      ? `${themeColors.primary}33`
                                      : 'rgba(17,19,23,0.8)',
                                    borderColor: isSubCompleted ? themeColors.highlight : '#6B7280'
                                  }}
                                >
                                  {isSubCompleted && (
                                    <Check className="w-3 h-3 text-white stroke-[2.5]" />
                                  )}
                                </div>
                              </button>

                              <span
                                className={`flex-1 min-w-0 py-2 text-xs font-medium leading-snug break-words transition-colors duration-300 ${
                                  st.completed && !isSubGlowing
                                    ? 'line-through text-[#94A3B8]/60'
                                    : 'text-[#F1F5F9]'
                                }`}
                              >
                                {st.title}
                              </span>

                              <button
                                type="button"
                                onClick={() => onDeleteSubTask?.(activeProject.id, task.id, st.id)}
                                className="min-w-[44px] min-h-[44px] w-11 h-11 flex items-center justify-center rounded-xl text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5 shrink-0 transition cursor-pointer"
                                aria-label={`Arbeitsschritt ${st.title} löschen`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Schlanke Zeile zum Hinzufügen eines Arbeitsschritts (auch bei normalen Tasks) */}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const draft = (subTaskDrafts[task.id] || '').trim();
                        if (!draft) return;
                        onAddSubTask?.(activeProject.id, task.id, draft);
                        setSubTaskDrafts((prev) => ({ ...prev, [task.id]: '' }));
                      }}
                      className="flex items-center gap-1.5"
                    >
                      <input
                        type="text"
                        value={subTaskDrafts[task.id] || ''}
                        onChange={(e) =>
                          setSubTaskDrafts((prev) => ({ ...prev, [task.id]: e.target.value }))
                        }
                        placeholder="+ Arbeitsschritt hinzufügen..."
                        className="flex-1 min-w-0 min-h-[44px] px-3 py-2 rounded-xl text-xs bg-[#191C22] text-[#F1F5F9] border border-white/10 placeholder-[#94A3B8] focus:outline-none focus:border-white/25"
                      />
                      <button
                        type="submit"
                        disabled={!(subTaskDrafts[task.id] || '').trim()}
                        aria-label="Arbeitsschritt hinzufügen"
                        className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-xl bg-[#191C22] hover:bg-[#22262F] text-[#14B8A6] border border-white/10 flex items-center justify-center shrink-0 disabled:opacity-40 active:scale-95 transition cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </form>
                  </div>
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
                      {(energyPlannerEnabled || driveDiceEnabled) && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {energyPlannerEnabled &&
                            ([
                              { id: 'low', label: 'Niedrig' },
                              { id: 'medium', label: 'Mittel' },
                              { id: 'high', label: 'Hoch' }
                            ] as const).map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                data-testid={`edit-task-energy-${opt.id}`}
                                onClick={() => setEditTaskEnergy(opt.id)}
                                className={`min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition active:scale-95 cursor-pointer ${
                                  editTaskEnergy === opt.id
                                    ? 'text-white border-white/30'
                                    : 'bg-[#111317] text-[#94A3B8] hover:text-[#F1F5F9] border-white/10'
                                }`}
                                style={
                                  editTaskEnergy === opt.id
                                    ? { backgroundColor: themeColors.primary }
                                    : {}
                                }
                              >
                                Akku: {opt.label}
                              </button>
                            ))}
                          {driveDiceEnabled && (
                            <button
                              type="button"
                              data-testid="edit-task-hurdle-toggle"
                              onClick={() => setEditTaskHurdle((v) => !v)}
                              className={`min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition active:scale-95 cursor-pointer ${
                                editTaskHurdle
                                  ? 'text-[#111317] border-transparent font-bold'
                                  : 'bg-[#111317] text-[#94A3B8] hover:text-[#F1F5F9] border-white/10'
                              }`}
                              style={
                                editTaskHurdle
                                  ? { backgroundColor: DESIGN_TOKENS.accentHoney }
                                  : {}
                              }
                            >
                              Schweinehund-Pool
                            </button>
                          )}
                        </div>
                      )}
                      {showExtendedMeta &&
                        renderExtendedMetaPicker(
                          editTaskPriority,
                          editTaskMinutes,
                          editTaskDayBlock,
                          setEditTaskPriority,
                          setEditTaskMinutes,
                          setEditTaskDayBlock,
                          'edit-task'
                        )}
                      {renderReminderPicker(
                        editTaskReminderAt,
                        editTaskRecurrence,
                        setEditTaskReminderAt,
                        setEditTaskRecurrence
                      )}
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
                          data-testid={`save-edit-task-${task.id}`}
                          onClick={() => {
                            if (!editTaskTitle.trim()) return;
                            const nextReminder = editTaskReminderAt.trim();
                            onUpdateTask?.(activeProject.id, task.id, {
                              title: editTaskTitle.trim(),
                              assemblyGroup: editTaskGroup.trim() || undefined,
                              ...(showExtendedMeta
                                ? {
                                    priority: editTaskPriority,
                                    estimatedMinutes:
                                      editTaskMinutes > 0 ? Math.round(editTaskMinutes) : 15,
                                    dayBlock: editTaskDayBlock
                                  }
                                : {}),
                              reminderAt: nextReminder,
                              reminderRecurrence: nextReminder ? editTaskRecurrence : 'none',
                              ...(energyPlannerEnabled ? { energyLevel: editTaskEnergy } : {}),
                              ...(driveDiceEnabled ? { isHurdleTask: editTaskHurdle } : {}),
                              ...(nextReminder !== (task.reminderAt || '')
                                ? { lastReminderFiredAt: undefined, lastShoulderTapStage: 0 }
                                : {})
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
                  ) : showExtendedMeta ? (
                    <div
                      data-testid={`task-meta-summary-${task.id}`}
                      className="flex flex-wrap items-center gap-1.5 text-xs text-[#94A3B8]"
                    >
                      <span className="px-2 py-0.5 rounded-md bg-[#191C22] border border-white/5">
                        Priorität: <span className="text-[#F1F5F9] font-semibold">{task.priority}</span>
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-[#191C22] border border-white/5 font-mono">
                        {task.estimatedMinutes} min
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-[#191C22] border border-white/5">
                        Block:{' '}
                        <span className="text-[#F1F5F9] font-semibold">
                          {task.dayBlock ? DAY_BLOCK_LABEL_MAP[task.dayBlock] : 'Ohne'}
                        </span>
                      </span>
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
                        setEditTaskReminderAt(task.reminderAt || '');
                        setEditTaskRecurrence(task.reminderRecurrence || 'none');
                        setEditTaskEnergy(task.energyLevel ?? 'medium');
                        setEditTaskHurdle(Boolean(task.isHurdleTask));
                        setEditTaskPriority(task.priority || 'Mittel');
                        setEditTaskMinutes(task.estimatedMinutes || 15);
                        setEditTaskDayBlock(task.dayBlock ?? null);
                        setEditingTaskId(task.id);
                      }}
                      className="min-w-0 min-h-[44px] px-3 rounded-xl text-xs font-semibold bg-[#191C22] hover:bg-[#22262F] text-[#F1F5F9] hover:text-[#14B8A6] border border-white/5 flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4 text-[#14B8A6] shrink-0" />
                      <span className="truncate">Bearbeiten</span>
                    </button>

                    {onOpenSingleFocus && !task.completed && (
                      <button
                        type="button"
                        onClick={() => {
                          toggleActionCard(task.id);
                          onOpenSingleFocus(task.id);
                        }}
                        className="min-w-0 min-h-[44px] px-3 rounded-xl text-xs font-semibold bg-[#191C22] hover:bg-[#22262F] text-[#F1F5F9] hover:text-[#14B8A6] border border-white/5 flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
                        title="Diesen Task im 1-Fokus-Overlay öffnen"
                      >
                        <Eye className="w-4 h-4 text-[#14B8A6] shrink-0" />
                        <span className="truncate">1-Fokus</span>
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
                        className={`min-w-0 min-h-[44px] px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer ${isAnchored
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

                  {/* Änderungs-Chronologie (standardmäßig zugeklappt) */}
                  {showChangeHistory &&
                    Array.isArray(task.changeLog) &&
                    task.changeLog.length > 0 && (
                      <ChangeLogAccordion itemId={task.id} entries={task.changeLog} />
                    )}

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
      )}
    </section>
  );
};
