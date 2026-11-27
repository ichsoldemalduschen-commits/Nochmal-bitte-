import React, { useEffect, useState } from 'react';
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Eye } from 'lucide-react';
import { DayBlockId, TaskItem } from '../../types';
import { DESIGN_TOKENS } from '../../config/designTokens';

export interface TasksNowStageProps {
  openTasks: TaskItem[];
  projectColor: string;
  timeBufferMultiplier?: number;
  completingTaskId?: string | null;
  listExpanded: boolean;
  onToggleListExpanded: () => void;
  totalRestCount: number;
  onCompleteTask: (task: TaskItem) => void;
  onStartSingleFocus?: (taskId: string) => void;
}

const DAY_BLOCK_LABELS: Record<Exclude<DayBlockId, null>, string> = {
  morning: 'Morgens',
  focus: 'Mittags',
  errands: 'Nachmittags',
  evening: 'Abends'
};

/**
 * Opt-in A+C-„Jetzt-Vorbühne“ über der Aufgabenliste:
 * Zeigt eine einzelne Fokus-Aufgabe zum ruhigen Durchblättern + Klapp-Riegel für die Restliste.
 */
export const TasksNowStage: React.FC<TasksNowStageProps> = ({
  openTasks,
  projectColor,
  timeBufferMultiplier = 1,
  completingTaskId = null,
  listExpanded,
  onToggleListExpanded,
  totalRestCount,
  onCompleteTask,
  onStartSingleFocus
}) => {
  const [focusIndex, setFocusIndex] = useState(0);

  useEffect(() => {
    if (openTasks.length === 0) {
      setFocusIndex(0);
    } else if (focusIndex >= openTasks.length) {
      setFocusIndex(openTasks.length - 1);
    }
  }, [openTasks.length, focusIndex]);

  if (openTasks.length === 0) {
    return null;
  }

  const safeIndex = Math.min(focusIndex, openTasks.length - 1);
  const currentTask = openTasks[safeIndex];
  const bracketMatch = currentTask.title.match(/^\[(.*?)\]\s*(.*)$/);
  const displayTitle = bracketMatch ? bracketMatch[2] : currentTask.title;
  const displayGroup = currentTask.assemblyGroup || (bracketMatch ? bracketMatch[1] : null);
  const sortedSubs = Array.isArray(currentTask.subTasks)
    ? [...currentTask.subTasks].sort((a, b) => a.order - b.order)
    : [];
  const nextOpenSub = sortedSubs.find((st) => !st.completed) || null;
  const isCompleting = completingTaskId === currentTask.id;
  const canBrowse = openTasks.length > 1;

  return (
    <div data-testid="tasks-now-stage" className="space-y-2.5">
      {/* Obere A-Fokus-Karte */}
      <div
        key={currentTask.id}
        className="relative rounded-2xl bg-[#191C22] border border-white/[0.06] overflow-hidden shadow-md bandit-reveal"
        style={
          isCompleting
            ? {
                borderColor: `${projectColor}99`,
                boxShadow: `0 0 16px ${projectColor}44`
              }
            : undefined
        }
      >
        <div
          className="absolute left-0 top-0 bottom-0 w-[3px]"
          style={{ backgroundColor: projectColor }}
          aria-hidden="true"
        />

        <div className="p-4 pl-5 space-y-3">
          {/* Ruhige Mono-Kopfzeile */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#94A3B8]">
              JETZT IM FOKUS
            </span>
            <span
              data-testid="now-stage-counter"
              className="text-xs font-mono font-semibold text-[#F1F5F9] px-2 py-0.5 rounded-md bg-[#111317] border border-white/5"
            >
              {safeIndex + 1} / {openTasks.length}
            </span>
          </div>

          {/* Voller mehrzeiliger Aufgabentitel */}
          <h4 className="text-base font-semibold text-[#F1F5F9] leading-snug break-words">
            {displayTitle}
          </h4>

          {/* Dezente Meta-Zeile */}
          {(displayGroup ||
            currentTask.priority ||
            currentTask.estimatedMinutes ||
            currentTask.dayBlock ||
            nextOpenSub) && (
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#94A3B8]">
                {displayGroup && (
                  <span className="px-2 py-0.5 rounded-md bg-[#111317] border border-white/5">
                    {displayGroup}
                  </span>
                )}
                {currentTask.priority && (
                  <span className="px-2 py-0.5 rounded-md bg-[#111317] border border-white/5">
                    {currentTask.priority}
                  </span>
                )}
                {currentTask.estimatedMinutes ? (
                  <span className="px-2 py-0.5 rounded-md bg-[#111317] border border-white/5 font-mono">
                    {Math.round(currentTask.estimatedMinutes * timeBufferMultiplier)} Min.
                  </span>
                ) : null}
                {currentTask.dayBlock && (
                  <span className="px-2 py-0.5 rounded-md bg-[#111317] border border-white/5">
                    {DAY_BLOCK_LABELS[currentTask.dayBlock]}
                  </span>
                )}
              </div>

              {nextOpenSub && (
                <div className="flex items-center gap-2 text-xs text-[#94A3B8] leading-snug break-words">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: DESIGN_TOKENS.accentHoney }}
                  />
                  <span className="min-w-0 break-words">
                    Nächster: <span className="text-[#F1F5F9]/90">{nextOpenSub.title}</span>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Griffige, kollisionsfreie Aktionszeile */}
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <button
              type="button"
              data-testid="now-stage-prev"
              disabled={!canBrowse}
              onClick={() =>
                setFocusIndex((prev) => (prev - 1 + openTasks.length) % openTasks.length)
              }
              className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold bg-[#111317] hover:bg-[#22262F] text-[#F1F5F9] border border-white/10 flex items-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none cursor-pointer bandit-pressable"
            >
              <ChevronLeft className="w-4 h-4 shrink-0" />
              <span>Zurück</span>
            </button>

            <button
              type="button"
              data-testid="now-stage-next"
              disabled={!canBrowse}
              onClick={() => setFocusIndex((prev) => (prev + 1) % openTasks.length)}
              className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold bg-[#111317] hover:bg-[#22262F] text-[#F1F5F9] border border-white/10 flex items-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none cursor-pointer bandit-pressable"
            >
              <span>Weiter</span>
              <ChevronRight className="w-4 h-4 shrink-0" />
            </button>

            {onStartSingleFocus && (
              <button
                type="button"
                data-testid="now-stage-focus"
                onClick={() => onStartSingleFocus(currentTask.id)}
                className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold bg-[#111317] hover:bg-[#22262F] text-[#14B8A6] border border-white/10 flex items-center gap-1.5 cursor-pointer bandit-pressable"
              >
                <Eye className="w-4 h-4 shrink-0" />
                <span>1-Fokus</span>
              </button>
            )}

            <button
              type="button"
              data-testid="now-stage-complete"
              onClick={() => onCompleteTask(currentTask)}
              className="ml-auto min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm flex items-center gap-1.5 cursor-pointer bandit-pressable"
              style={{ backgroundColor: projectColor }}
            >
              <Check className="w-4 h-4 shrink-0" />
              <span>Erledigt ✓</span>
            </button>
          </div>
        </div>
      </div>

      {/* Schlichter Klapp-Riegel direkt darunter */}
      <button
        type="button"
        aria-expanded={listExpanded}
        data-testid="now-stage-toggle-list"
        onClick={onToggleListExpanded}
        className="w-full min-h-[44px] px-4 py-2.5 rounded-2xl bg-[#191C22] hover:bg-[#22262F] border border-white/[0.06] flex items-center justify-between gap-2 text-xs font-semibold text-[#94A3B8] hover:text-[#F1F5F9] cursor-pointer bandit-pressable"
      >
        <span className="min-w-0 break-words text-left">
          {listExpanded
            ? `Liste wieder einklappen (${totalRestCount})`
            : `Alle weiteren Einträge entfalten (${totalRestCount})`}
        </span>
        {listExpanded ? (
          <ChevronUp className="w-4 h-4 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 shrink-0" />
        )}
      </button>
    </div>
  );
};
