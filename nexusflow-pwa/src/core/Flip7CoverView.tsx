import React from 'react';
import { Mic } from 'lucide-react';
import { Project, TaskItem, THEME } from '../types';
import { ProjectAvatar } from '../components/RaccoonAvatar';

interface Flip7Props {
  activeProject?: Project;
  topTasks: Array<{ projectId: string; projectName: string; task: TaskItem }>;
  onToggleTask: (projectId: string, taskId: string) => void;
  onOpenVoice: () => void;
  onExitCoverMode: () => void;
}

export const Flip7CoverView: React.FC<Flip7Props> = ({
  activeProject,
  topTasks,
  onToggleTask,
  onOpenVoice,
  onExitCoverMode
}) => {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 select-none"
      style={{ backgroundColor: '#0E1011', color: THEME.textMain }}
    >
      <div
        className="w-full max-w-[356px] rounded-[34px] p-4 border-2 shadow-2xl flex flex-col justify-between gap-3"
        style={{
          backgroundColor: THEME.bgMain,
          borderColor: THEME.accentPrimary,
          minHeight: '348px',
          boxShadow: '0 20px 60px rgba(10, 147, 150, 0.32)'
        }}
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div className="flex items-center gap-2 min-w-0">
            <ProjectAvatar project={activeProject} sizeClass="w-7 h-7" />
            <div className="min-w-0">
              <span className="text-[10px] uppercase tracking-wider text-[#14B8A6] font-bold block">
                Flip 7 Cover-Modus
              </span>
              <span className="text-xs font-bold text-white truncate block">
                {activeProject?.name || 'Pizza Bandit'}
              </span>
            </div>
          </div>
          <button
            onClick={onExitCoverMode}
            className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-[#24292E] text-[#9CA3AF] hover:text-white border border-white/10 shrink-0"
          >
            Aufklappen
          </button>
        </div>

        <button
          onClick={onOpenVoice}
          className="w-full py-4 rounded-2xl flex items-center justify-center gap-3 text-white font-bold text-sm shadow-lg transition active:scale-95 border border-[#14B8A6]"
          style={{ background: `linear-gradient(135deg, ${THEME.accentPrimary}, #055B5C)` }}
        >
          <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center">
            <Mic className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <span className="block text-sm font-bold leading-tight">Sprachbefehl / Notiz</span>
            <span className="block text-[10px] text-[#E5E7EB]/80 font-normal">
              Antippen oder Alt + S
            </span>
          </div>
        </button>

        <div className="space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF] block">
            Top 3 offene Punkte (Sofort abhaken):
          </span>
          {topTasks.length === 0 ? (
            <div className="p-2.5 rounded-xl bg-[#24292E] text-center text-xs text-[#14B8A6]">
              Alle aktuellen Tasks erledigt!
            </div>
          ) : (
            topTasks.map(({ projectId, projectName, task }) => (
              <div
                key={task.id}
                onClick={() => onToggleTask(projectId, task.id)}
                className="p-2.5 rounded-xl bg-[#24292E] border border-white/10 hover:border-[#14B8A6] flex items-center gap-2.5 cursor-pointer transition"
              >
                <div
                  className="w-4 h-4 rounded border shrink-0"
                  style={{ borderColor: THEME.accentHighlight }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white truncate">{task.title}</p>
                  <span className="text-[9px] text-[#14B8A6] block">{projectName}</span>
                </div>
                {task.aiTouched && (
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: THEME.aiRedDot }}
                  />
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};