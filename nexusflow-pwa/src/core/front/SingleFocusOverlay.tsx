import React, { useEffect, useState } from 'react';
import { Check, CheckCircle2, Dices, RotateCcw, Timer, X } from 'lucide-react';
import { Project, TaskItem } from '../../types';
import { DESIGN_TOKENS } from '../../config/designTokens';
import { UNDO_TOAST_MS } from '../../config/runtimeConfig';

export interface SingleFocusOverlayProps {
  open: boolean;
  onClose: () => void;
  activeProject?: Project;
  initialTaskId?: string | null;
  driveDiceEnabled?: boolean;
  onRollAnotherTask?: (currentTaskId?: string | null) => void;
  onToggleTask: (projectId: string, taskId: string) => void;
  onToggleSubTask?: (projectId: string, taskId: string, subTaskId: string) => void;
  onRegisterUndo?: (action: { message: string; undo: () => void }) => void;
  themeColors: {
    primary: string;
    highlight: string;
  };
}

export const SingleFocusOverlay: React.FC<SingleFocusOverlayProps> = ({
  open,
  onClose,
  activeProject,
  initialTaskId,
  driveDiceEnabled = true,
  onRollAnotherTask,
  onToggleTask,
  onToggleSubTask,
  onRegisterUndo,
  themeColors
}) => {
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(initialTaskId || null);
  const [fiveMinStartActive, setFiveMinStartActive] = useState(false);
  const [progressPercent, setProgressPercent] = useState(100);
  const [localUndo, setLocalUndo] = useState<{ message: string; undo: () => void } | null>(null);

  // Sync initialTaskId when overlay opens
  useEffect(() => {
    if (open) {
      setCurrentTaskId(initialTaskId || null);
      setFiveMinStartActive(false);
      setProgressPercent(100);
      setLocalUndo(null);
    }
  }, [open, initialTaskId]);

  // 5-Minuten-Start Timer (300 Sekunden): Sanft kürzer werdende Linie, null hektische Ziffern
  useEffect(() => {
    if (!open || !fiveMinStartActive) {
      setProgressPercent(100);
      return;
    }

    const durationMs = 5 * 60 * 1000; // 5 Minuten = 300.000 ms
    const startTime = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remainingRatio = Math.max(0, 1 - elapsed / durationMs);
      setProgressPercent(remainingRatio * 100);

      if (elapsed >= durationMs) {
        clearInterval(interval);
        setFiveMinStartActive(false);
      }
    }, 250);

    return () => clearInterval(interval);
  }, [open, fiveMinStartActive]);

  if (!open || !activeProject) return null;

  const openTasks = activeProject.tasks.filter((t) => !t.completed);
  const currentTask: TaskItem | undefined =
    openTasks.find((t) => t.id === currentTaskId) || openTasks[0];

  const sortedSubTasks =
    currentTask && Array.isArray(currentTask.subTasks) && currentTask.subTasks.length > 0
      ? [...currentTask.subTasks].sort((a, b) => a.order - b.order)
      : [];
  const firstOpenSubTask = sortedSubTasks.find((st) => !st.completed) || null;
  const doneSubCount = sortedSubTasks.filter((st) => st.completed).length;
  const currentStepNumber = sortedSubTasks.length > 0 ? Math.min(doneSubCount + 1, sortedSubTasks.length) : 0;

  const handlePark = () => {
    if (openTasks.length <= 1) {
      // Keine weiteren offenen Aufgaben -> entspannt schließen
      onClose();
      return;
    }
    const currentIndex = openTasks.findIndex((t) => t.id === currentTask?.id);
    const nextIndex = (currentIndex + 1) % openTasks.length;
    setCurrentTaskId(openTasks[nextIndex]?.id || null);
  };

  const handleComplete = () => {
    if (!currentTask) return;

    // Sammel-Task: Schritt-für-Schritt-Spotlight über die offenen subTasks
    if (firstOpenSubTask && onToggleSubTask) {
      const remainingSubCount = sortedSubTasks.filter((s) => !s.completed && s.id !== firstOpenSubTask.id).length;
      const isLastSubTask = remainingSubCount === 0;
      const subId = firstOpenSubTask.id;
      const subTitle = firstOpenSubTask.title;
      const parentId = currentTask.id;
      const parentTitle = currentTask.title;

      onToggleSubTask(activeProject.id, parentId, subId);

      const undoObj = {
        message: isLastSubTask ? `„${parentTitle}“ erledigt` : `„${subTitle}“ erledigt`,
        undo: () => {
          onToggleSubTask(activeProject.id, parentId, subId);
          setCurrentTaskId(parentId);
        }
      };

      onRegisterUndo?.(undoObj);
      setLocalUndo(undoObj);
      setTimeout(() => {
        setLocalUndo(null);
      }, UNDO_TOAST_MS);

      if (isLastSubTask) {
        const remainingOpen = openTasks.filter((t) => t.id !== parentId);
        setCurrentTaskId(remainingOpen.length > 0 ? remainingOpen[0].id : null);
      }
      return;
    }

    const completedTaskId = currentTask.id;
    const titleToDisplay = currentTask.title;

    onToggleTask(activeProject.id, completedTaskId);

    const undoObj = {
      message: `„${titleToDisplay}“ erledigt`,
      undo: () => onToggleTask(activeProject.id, completedTaskId)
    };

    onRegisterUndo?.(undoObj);
    setLocalUndo(undoObj);
    setTimeout(() => {
      setLocalUndo(null);
    }, UNDO_TOAST_MS);

    // Zur nächsten Aufgabe wechseln
    const remainingOpen = openTasks.filter((t) => t.id !== completedTaskId);
    if (remainingOpen.length > 0) {
      setCurrentTaskId(remainingOpen[0].id);
    } else {
      setCurrentTaskId(null);
    }
  };

  const displayTitle = firstOpenSubTask ? firstOpenSubTask.title : currentTask?.title;
  const displayGroup = currentTask?.assemblyGroup || null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="1-Fokus-Modus"
      className="fixed inset-0 z-50 bg-[#0B0D11]/88 backdrop-blur-md flex flex-col justify-center items-center p-4 animate-fadeIn"
    >
      {/* Obere Schließen-Leiste */}
      <div className="w-full max-w-[420px] flex items-center justify-between pb-4">
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: activeProject.accentColor || themeColors.primary }}
          />
          <span className="text-xs font-bold uppercase tracking-wider text-[#94A3B8]">
            1-Fokus · {activeProject.name}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Schließen"
          className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-[#94A3B8] hover:text-white bg-[#191C22] border border-white/5 active:scale-95 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Hauptkarte: Genau 1 Aufgabe ODER „Alles frei für jetzt“ */}
      <div className="w-full max-w-[420px]">
        {currentTask ? (
          <div
            className="relative rounded-3xl border border-white/10 p-5 shadow-2xl overflow-hidden space-y-4"
            style={{ backgroundColor: '#191C22' }}
          >
            {/* 3px Projektfarbstreifen links */}
            <div
              className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-3xl"
              style={{ backgroundColor: activeProject.accentColor || themeColors.primary }}
            />

            {/* Hauchdünne, gleichmäßig kürzer werdende Fortschritts-Linie am oberen Kartenrand */}
            {fiveMinStartActive && (
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-white/5 overflow-hidden">
                <div
                  className="h-full transition-all duration-300 ease-linear"
                  style={{
                    width: `${progressPercent}%`,
                    backgroundColor: themeColors.highlight
                  }}
                />
              </div>
            )}

            {/* Kopfzeile der Karte: Baugruppe / Restzeit / Schweinehund + 5-Min-Start Schalter */}
            <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                {driveDiceEnabled && onRollAnotherTask && currentTask.isHurdleTask === true && (
                  <span
                    data-testid="single-focus-hurdle-badge"
                    className="text-xs font-mono font-bold px-2 py-0.5 rounded-md border"
                    style={{
                      color: DESIGN_TOKENS.accentHoney,
                      backgroundColor: `${DESIGN_TOKENS.accentHoney}1A`,
                      borderColor: `${DESIGN_TOKENS.accentHoney}33`
                    }}
                  >
                    Schweinehund-Pool
                  </span>
                )}
                {displayGroup && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-[#111317] text-[#94A3B8] border border-white/5 truncate">
                    {displayGroup}
                  </span>
                )}
                {currentTask.estimatedMinutes && (
                  <span className="text-xs font-mono text-[#94A3B8]">
                    ~{currentTask.estimatedMinutes} Min.
                  </span>
                )}
              </div>

              {/* Kleiner Schalter „5-Min-Start“ */}
              <button
                type="button"
                onClick={() => setFiveMinStartActive((v) => !v)}
                className={`min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition active:scale-95 cursor-pointer shrink-0 ${
                  fiveMinStartActive
                    ? 'text-white border-white/30'
                    : 'bg-[#111317] text-[#94A3B8] border-white/5 hover:text-white'
                }`}
                style={fiveMinStartActive ? { backgroundColor: themeColors.primary } : {}}
                title="Startet eine ruhige 5-Minuten-Fokuslinie"
              >
                <Timer className="w-3.5 h-3.5" />
                <span>{fiveMinStartActive ? '5-Min läuft' : '5-Min-Start'}</span>
              </button>
            </div>

            {/* Übergeordnetes Hauptziel & Schritt-Zähler bei Sammel-Tasks */}
            {firstOpenSubTask && (
              <div
                className="p-3 rounded-2xl border flex items-center justify-between gap-2 flex-wrap"
                style={{
                  backgroundColor: DESIGN_TOKENS.canvas,
                  borderColor: DESIGN_TOKENS.borderSubtle
                }}
              >
                <span className="text-xs font-medium text-[#94A3B8] break-words min-w-0 flex-1">
                  {currentTask?.title}
                </span>
                <span
                  className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-md shrink-0"
                  style={{
                    color: DESIGN_TOKENS.accentHoney,
                    backgroundColor: `${DESIGN_TOKENS.accentHoney}1A`
                  }}
                >
                  Schritt {currentStepNumber} von {sortedSubTasks.length}
                </span>
              </div>
            )}

            {/* Großer mehrzeiliger Aufgabentitel in Inter */}
            <div className="py-2">
              <h2 className="text-xl font-bold text-[#F1F5F9] leading-snug break-words tracking-tight">
                {displayTitle}
              </h2>
            </div>

            {/* Lokaler 4-Sekunden-Rückgängig-Hinweis */}
            {localUndo && (
              <div className="p-2.5 rounded-xl bg-[#111317] border border-white/10 flex items-center justify-between text-xs animate-fadeIn">
                <span className="text-[#F1F5F9] font-medium truncate">{localUndo.message}</span>
                <button
                  type="button"
                  onClick={() => {
                    localUndo.undo();
                    setLocalUndo(null);
                  }}
                  className="min-h-[44px] px-3 font-bold text-[#14B8A6] flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Rückgängig</span>
                </button>
              </div>
            )}

            {/* GENAU ZWEI WERTFREIE GROSSE DAUMEN-KNÖPFE (min-h-[48px]) */}
            <div className="grid grid-cols-2 gap-2.5 pt-2">
              {/* 1. „Erstmal parken“ (kein Rot, kein Vorwurf) */}
              <button
                type="button"
                onClick={handlePark}
                className="min-h-[48px] px-4 py-3 rounded-2xl text-xs font-bold text-[#F1F5F9] bg-[#242930] hover:bg-[#2A3038] border border-white/10 active:scale-95 transition cursor-pointer flex items-center justify-center text-center shadow-sm"
              >
                Erstmal parken
              </button>

              {/* 2. „Erledigt ✓“ */}
              <button
                type="button"
                onClick={handleComplete}
                className="min-h-[48px] px-4 py-3 rounded-2xl text-xs font-bold text-white active:scale-95 transition cursor-pointer flex items-center justify-center gap-1.5 shadow-lg"
                style={{
                  backgroundColor: themeColors.primary,
                  boxShadow: `0 4px 16px ${themeColors.primary}33`
                }}
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Erledigt ✓</span>
              </button>
            </div>

            {driveDiceEnabled && onRollAnotherTask && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  data-testid="btn-roll-another-task"
                  onClick={() => onRollAnotherTask(currentTask.id)}
                  className="flex-1 min-w-[200px] min-h-[44px] px-4 py-2.5 rounded-2xl text-xs font-semibold bg-[#111317] hover:bg-[#22262F] text-[#E5A93C] border border-[#E5A93C]/25 flex items-center justify-center gap-2 active:scale-95 transition cursor-pointer"
                >
                  <Dices className="w-4 h-4 shrink-0" />
                  <span>Andere Aufgabe würfeln</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Ruhige „Alles frei für jetzt“-Karte */
          <div
            className="rounded-3xl border border-white/10 p-6 text-center space-y-4 shadow-2xl animate-fadeIn"
            style={{ backgroundColor: '#191C22' }}
          >
            <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Alles frei für jetzt!</h2>
              <p className="text-xs text-[#94A3B8] mt-1">
                Alle Aufgaben in diesem Projekt sind erledigt. Gönn dir eine Pause.
              </p>
            </div>
            {localUndo && (
              <div className="p-2.5 rounded-xl bg-[#111317] border border-white/10 flex items-center justify-between text-xs animate-fadeIn text-left">
                <span className="text-[#F1F5F9] font-medium truncate">{localUndo.message}</span>
                <button
                  type="button"
                  onClick={() => {
                    localUndo.undo();
                    setLocalUndo(null);
                  }}
                  className="min-h-[44px] px-3 font-bold text-[#14B8A6] flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Rückgängig</span>
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-full min-h-[48px] px-4 py-3 rounded-2xl text-xs font-bold text-white active:scale-95 transition cursor-pointer shadow-md"
              style={{ backgroundColor: themeColors.primary }}
            >
              Fokus schließen
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
