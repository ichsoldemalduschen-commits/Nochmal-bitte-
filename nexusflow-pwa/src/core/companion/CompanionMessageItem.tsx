import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  BookmarkPlus,
  Brain,
  Check,
  Copy,
  Pencil,
  RotateCw,
  Undo2,
  Volume2
} from 'lucide-react';
import { AiExecutedAction, Project } from '../../types';
import { copyTextToClipboard } from './companionExport';
import { ConversationMessage } from './useVoiceSession';

export interface CompanionMessageItemProps {
  message: ConversationMessage;
  associatedPrompt?: string;
  activeProjects: Project[];
  projectColor: string;
  isProcessing: boolean;
  messageToolsEnabled: boolean;
  onJumpToAction?: (act: AiExecutedAction) => void;
  onCloseAfterJump: () => void;
  onMoveAiAction?: (logId: string, actionId: string, newProjectId: string) => void;
  onUndoAction: (messageId: string, logId: string, actionId: string) => void;
  hasUndoHandler: boolean;
  onRetryMessage: (msg: ConversationMessage) => void;
  onParkAsNote: (msg: ConversationMessage) => void;
  onSaveAsInfo: (msg: ConversationMessage) => void;
  onSpeakMessage: (text: string) => void;
  onEditPrompt: (text: string) => void;
  onReprocessPrompt: (promptText: string, mode?: 'flash' | 'research') => void;
}

export const CompanionMessageItem: React.FC<CompanionMessageItemProps> = ({
  message: msg,
  associatedPrompt,
  activeProjects,
  projectColor,
  isProcessing,
  messageToolsEnabled,
  onJumpToAction,
  onCloseAfterJump,
  onMoveAiAction,
  onUndoAction,
  hasUndoHandler,
  onRetryMessage,
  onParkAsNote,
  onSaveAsInfo,
  onSpeakMessage,
  onEditPrompt,
  onReprocessPrompt
}) => {
  const [copied, setCopied] = useState(false);
  const [savedAsKnowledge, setSavedAsKnowledge] = useState(false);
  const copyTimerRef = useRef<number | null>(null);
  const savedTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      if (savedTimerRef.current !== null) window.clearTimeout(savedTimerRef.current);
    };
  }, []);

  const handleCopy = async () => {
    await copyTextToClipboard(msg.text);
    setCopied(true);
    if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    copyTimerRef.current = window.setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveKnowledge = () => {
    onSaveAsInfo(msg);
    setSavedAsKnowledge(true);
    if (savedTimerRef.current !== null) window.clearTimeout(savedTimerRef.current);
    savedTimerRef.current = window.setTimeout(() => setSavedAsKnowledge(false), 2500);
  };

  // ── NUTZER-NACHRICHT (rechtsbündige, ruhige Kapsel) ──────────────────────
  if (msg.role === 'user') {
    return (
      <div className="flex flex-col items-end space-y-1 min-w-0">
        <div className="max-w-[88%] rounded-2xl rounded-br-md bg-[#222630] px-3.5 py-2.5 text-sm text-[#F1F5F9] leading-relaxed break-words">
          {msg.attachmentName && (
            <div className="text-xs text-[#94A3B8] mb-1 break-all">
              Anhang: {msg.attachmentName}
            </div>
          )}
          <p className="whitespace-pre-wrap break-words">{msg.text}</p>
          <div className="mt-1 text-right text-xs font-mono text-[#94A3B8]/80">
            {msg.timestamp}
          </div>
        </div>

        {messageToolsEnabled && (
          <div className="flex flex-wrap items-center justify-end gap-1.5 max-w-full">
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="min-h-[44px] px-2.5 py-1.5 rounded-xl text-xs font-medium text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#14B8A6]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Kopiert ✓' : 'Kopieren'}</span>
            </button>

            <button
              type="button"
              onClick={() => onEditPrompt(msg.text)}
              className="min-h-[44px] px-2.5 py-1.5 rounded-xl text-xs font-medium text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Bearbeiten</span>
            </button>

            <button
              type="button"
              disabled={isProcessing}
              onClick={() => onReprocessPrompt(msg.text)}
              className="min-h-[44px] px-2.5 py-1.5 rounded-xl text-xs font-medium text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5 disabled:opacity-40 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Nochmal senden</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── KI-ANTWORT (ruhig und flächig links auf Canvas/Surface) ────────────────
  return (
    <div className="flex flex-col items-start space-y-2 min-w-0">
      <div
        className={`w-full min-w-0 ${
          msg.isErrorFallback
            ? 'bg-[#191C22] rounded-2xl p-3.5 border border-white/[0.04] border-l-[3px] border-l-[#E5A93C]'
            : 'px-1 py-0.5'
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-1 text-xs text-[#94A3B8]">
          <span className={msg.isErrorFallback ? 'text-[#E5A93C] font-semibold' : 'font-medium'}>
            {msg.engine || 'Gisela'}
          </span>
          <span className="font-mono shrink-0">{msg.timestamp}</span>
        </div>

        <p className="text-sm text-[#F1F5F9] leading-relaxed whitespace-pre-wrap break-words">
          {msg.text}
        </p>

        {/* Schmale, gestapelte 1-Zeilen-Quittungskarten für ausgeführte Aktionen */}
        {msg.actions && msg.actions.length > 0 && (
          <div className="mt-2.5 space-y-1.5">
            {msg.actions.map((act) => (
              <div
                key={act.actionId}
                className={`p-2.5 rounded-xl bg-[#191C22] border border-white/[0.04] space-y-1.5 ${
                  act.undone ? 'opacity-45' : ''
                }`}
                style={{
                  borderLeftWidth: '3px',
                  borderLeftColor: projectColor
                }}
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
                    className="min-h-[44px] text-xs font-semibold text-[#14B8A6] hover:underline text-left flex items-center gap-1 min-w-0 flex-1 cursor-pointer"
                  >
                    <span className="break-words">{act.shortCheckableTitle}</span>
                    <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                  </button>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/5 text-[#94A3B8] shrink-0">
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
                        className="min-h-[44px] min-w-0 px-2.5 py-1.5 rounded-xl text-xs bg-[#111317] text-[#F1F5F9] border border-white/10 flex-1"
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
                        className="min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#E5A93C]/12 text-[#E5A93C] border border-[#E5A93C]/30 flex items-center gap-1.5 active:scale-95 transition cursor-pointer shrink-0"
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

        {/* Honig-Gold-Fehler-/Timeout-Karte */}
        {msg.isErrorFallback && (
          <div className="mt-3 pt-2.5 border-t border-[#E5A93C]/20 flex flex-wrap items-center gap-2">
            {msg.retryText && (
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => onRetryMessage(msg)}
                data-testid="btn-retry-voice-message"
                className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold bg-[#E5A93C] text-[#111317] hover:bg-[#eab54d] disabled:opacity-40 active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                Nochmal senden
              </button>
            )}
            <button
              type="button"
              disabled={Boolean(msg.parkedAsNote)}
              onClick={() => onParkAsNote(msg)}
              data-testid="btn-park-as-note"
              className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#111317] text-[#E5A93C] border border-[#E5A93C]/40 hover:bg-[#E5A93C]/10 disabled:opacity-50 active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {msg.parkedAsNote ? 'Als Notiz geparkt ✓' : 'Als Notiz parken'}
            </button>
          </div>
        )}
      </div>

      {/* Schlanke Gemini-Aktionszeile direkt unter jeder KI-Antwort */}
      <div className="flex flex-wrap items-center gap-1.5 max-w-full">
        <button
          type="button"
          onClick={() => onSpeakMessage(msg.text)}
          className="min-h-[44px] px-2.5 py-1.5 rounded-xl text-xs font-medium text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
        >
          <Volume2 className="w-3.5 h-3.5" />
          <span>Vorlesen</span>
        </button>

        {messageToolsEnabled && !msg.isErrorFallback && (
          <>
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="min-h-[44px] px-2.5 py-1.5 rounded-xl text-xs font-medium text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#14B8A6]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Kopiert ✓' : 'Kopieren'}</span>
            </button>

            {associatedPrompt && (
              <>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => onReprocessPrompt(associatedPrompt)}
                  className="min-h-[44px] px-2.5 py-1.5 rounded-xl text-xs font-medium text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5 disabled:opacity-40 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Neu verarbeiten</span>
                </button>

                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => onReprocessPrompt(associatedPrompt, 'research')}
                  className="min-h-[44px] px-2.5 py-1.5 rounded-xl text-xs font-medium text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5 disabled:opacity-40 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  <Brain className="w-3.5 h-3.5 text-purple-300 shrink-0" />
                  <span>Mit 🧠 Pro</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handleSaveKnowledge}
              className="min-h-[44px] px-2.5 py-1.5 rounded-xl text-xs font-medium text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              {savedAsKnowledge ? (
                <Check className="w-3.5 h-3.5 text-[#14B8A6]" />
              ) : (
                <BookmarkPlus className="w-3.5 h-3.5" />
              )}
              <span>{savedAsKnowledge ? 'Gesichert ✓' : 'Als Wissen'}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
