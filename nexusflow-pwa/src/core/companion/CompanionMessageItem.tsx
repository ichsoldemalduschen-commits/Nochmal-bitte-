import React from 'react';
import { ArrowUpRight, Undo2 } from 'lucide-react';
import { AiExecutedAction, Project } from '../../types';
import { ConversationMessage } from './useVoiceSession';

export interface CompanionMessageItemProps {
  message: ConversationMessage;
  activeProjects: Project[];
  isProcessing: boolean;
  onJumpToAction?: (act: AiExecutedAction) => void;
  onCloseAfterJump: () => void;
  onMoveAiAction?: (logId: string, actionId: string, newProjectId: string) => void;
  onUndoAction: (messageId: string, logId: string, actionId: string) => void;
  hasUndoHandler: boolean;
  onRetryMessage: (msg: ConversationMessage) => void;
  onParkAsNote: (msg: ConversationMessage) => void;
  onSaveAsInfo: (msg: ConversationMessage) => void;
}

export const CompanionMessageItem: React.FC<CompanionMessageItemProps> = ({
  message: msg,
  activeProjects,
  isProcessing,
  onJumpToAction,
  onCloseAfterJump,
  onMoveAiAction,
  onUndoAction,
  hasUndoHandler,
  onRetryMessage,
  onParkAsNote,
  onSaveAsInfo
}) => {
  return (
    <div
      className={`flex flex-col ${
        msg.role === 'user' ? 'items-end' : 'items-start'
      }`}
    >
      <div
        className={`max-w-[90%] rounded-2xl p-3.5 text-xs leading-relaxed transition-all duration-300 ${
          msg.role === 'user'
            ? 'bg-[#0A9396] text-white rounded-br-sm'
            : msg.isErrorFallback
              ? 'bg-[#191C22] text-[#F1F5F9] border border-[#E5A93C]/50 rounded-bl-sm'
              : 'bg-[#24292E] text-[#F8F9FA] border border-white/10 rounded-bl-sm'
        }`}
      >
        <div className="flex items-center justify-between gap-3 mb-1 text-xs opacity-70">
          <span className={msg.isErrorFallback ? 'text-[#E5A93C] font-semibold' : ''}>
            {msg.role === 'user' ? 'Eingabe' : msg.engine || 'KI-Agent'}
          </span>
          <span>{msg.timestamp}</span>
        </div>
        <p className="whitespace-pre-wrap">{msg.text}</p>

        {msg.actions && msg.actions.length > 0 && (
          <div className="mt-2.5 pt-2.5 border-t border-white/10 space-y-1.5">
            <div className="text-xs font-bold uppercase tracking-wider text-[#14B8A6]">
              Ausgeführte Zuordnungen ({msg.actions.length}):
            </div>
            {msg.actions.map((act) => (
              <div
                key={act.actionId}
                className={`p-2.5 rounded-xl bg-[#181A1B] border border-white/10 space-y-1.5 ${
                  act.undone ? 'opacity-40' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap min-w-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (onJumpToAction) {
                        onJumpToAction(act);
                        onCloseAfterJump();
                      }
                    }}
                    className="text-xs font-bold text-[#14B8A6] hover:underline text-left flex items-center gap-1 truncate min-w-0"
                  >
                    <span className="truncate">{act.shortCheckableTitle}</span>
                    <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                  </button>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/5 text-[#9CA3AF] shrink-0">
                    {act.targetProjectName} / {act.targetSubTab}
                  </span>
                </div>

                {!act.undone && msg.logId && (
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5 flex-wrap min-w-0">
                    {onMoveAiAction && activeProjects.length > 0 && (
                      <select
                        value={act.targetProjectId}
                        onChange={(e) =>
                          onMoveAiAction(msg.logId!, act.actionId, e.target.value)
                        }
                        className="min-h-[44px] px-2.5 py-1.5 rounded-xl text-xs bg-[#24292E] text-white border border-white/10 flex-1"
                      >
                        {activeProjects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    )}
                    {hasUndoHandler && (
                      <button
                        type="button"
                        onClick={() => onUndoAction(msg.id, msg.logId!, act.actionId)}
                        className="min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-red-500/15 text-red-300 border border-red-500/30 flex items-center gap-1.5 active:scale-95 transition"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                        <span>Rückgängig</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {msg.role === 'assistant' && msg.isErrorFallback && (
          <div className="mt-2.5 pt-2.5 border-t border-[#E5A93C]/20 flex flex-wrap items-center gap-2">
            {msg.retryText && (
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => onRetryMessage(msg)}
                data-testid="btn-retry-voice-message"
                className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold bg-[#E5A93C] text-[#111317] hover:bg-[#eab54d] disabled:opacity-40 active:scale-95 transition flex items-center justify-center gap-1.5"
              >
                Nochmal senden
              </button>
            )}
            <button
              type="button"
              disabled={Boolean(msg.parkedAsNote)}
              onClick={() => onParkAsNote(msg)}
              data-testid="btn-park-as-note"
              className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#111317] text-[#E5A93C] border border-[#E5A93C]/40 hover:bg-[#E5A93C]/10 disabled:opacity-50 active:scale-95 transition flex items-center justify-center gap-1.5"
            >
              {msg.parkedAsNote ? 'Als Notiz geparkt ✓' : 'Als Notiz parken'}
            </button>
          </div>
        )}

        {msg.role === 'assistant' && !msg.isErrorFallback && (!msg.actions || msg.actions.length === 0) && (
          <div className="mt-2 pt-1.5 border-t border-white/10 flex justify-end">
            <button
              type="button"
              onClick={() => onSaveAsInfo(msg)}
              className="min-h-[44px] px-3 py-1.5 text-xs font-semibold text-[#14B8A6] hover:underline flex items-center"
            >
              Als Projekt-Info sichern
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
