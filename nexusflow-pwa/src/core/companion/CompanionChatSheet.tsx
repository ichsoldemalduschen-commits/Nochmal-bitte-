import React, { useEffect, useRef, useState } from 'react';
import {
  BookmarkPlus,
  Brain,
  Check,
  Copy,
  Download,
  FileText,
  Loader2,
  Minimize2,
  MoreVertical,
  Trash2,
  Volume2,
  VolumeX,
  X,
  Zap
} from 'lucide-react';
import { DESIGN_TOKENS } from '../../config/designTokens';
import { AiExecutedAction, Attachment, OfflineAudioMemo, Project, THEME } from '../../types';
import { CompanionComposer } from './CompanionComposer';
import { CompanionMessageItem } from './CompanionMessageItem';
import { ConversationMessage } from './useVoiceSession';
import { VoiceWaveformBars } from './VoiceWaveformBars';

export interface CompanionChatSheetProps {
  activeProjectName: string;
  activeProjects: Project[];
  resolvedProjectId: string;
  userApiKey?: string;
  offlineAudioBufferEnabled: boolean;
  effectiveOfflineMemos: OfflineAudioMemo[];
  onSaveOfflineMemos: (next: OfflineAudioMemo[]) => void;
  messages: ConversationMessage[];
  transcript: string;
  attachment: Attachment | null;
  hasSpokenText: boolean;
  isListening: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  showSlowThinkingNotice: boolean;
  wakeLockActive: boolean;
  aiMode: 'flash' | 'research';
  ttsActive: boolean;
  upscaleNotice: string | null;
  shareIntakeNotice: string | null;
  voiceStatusNotice: string | null;
  speechNotice: string;
  quickCommands?: string[];
  organicMotion: boolean;
  messageToolsEnabled: boolean;
  quickChipsEnabled: boolean;
  projectColor: string;
  progressPercent: number;
  silenceLineColor: string;
  scrollEndRef: React.RefObject<HTMLDivElement>;
  onUpdateStage: (stage: 1 | 2 | 0) => void;
  onHeaderTouchStart: (clientY: number) => void;
  onHeaderTouchEnd: (clientY: number) => void;
  onToggleAiMode: () => void;
  onToggleTts: () => void;
  onClearMessages: () => void;
  onSubmitTranscript: (overrideText?: string) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  onClearAttachment: () => void;
  onTranscriptChange: (value: string) => void;
  onManualMicToggle: () => void;
  onJumpToAction?: (act: AiExecutedAction) => void;
  onMoveAiAction?: (logId: string, actionId: string, newProjectId: string) => void;
  onUndoAction: (messageId: string, logId: string, actionId: string) => void;
  hasUndoHandler: boolean;
  onRetryMessage: (msg: ConversationMessage) => void;
  onParkAsNote: (msg: ConversationMessage) => void;
  onSaveAsInfo: (msg: ConversationMessage) => void;
  onSpeakMessage: (text: string) => void;
  onEditPrompt: (text: string) => void;
  onReprocessPrompt: (promptText: string, mode?: 'flash' | 'research') => void;
  onExportChatTranscript: (format: 'clipboard' | 'markdown' | 'text') => Promise<boolean>;
  onSaveChatAsKnowledge: () => boolean;
}

export const CompanionChatSheet: React.FC<CompanionChatSheetProps> = ({
  activeProjectName,
  activeProjects,
  resolvedProjectId,
  userApiKey = '',
  offlineAudioBufferEnabled,
  effectiveOfflineMemos,
  onSaveOfflineMemos,
  messages,
  transcript,
  attachment,
  hasSpokenText,
  isListening,
  isProcessing,
  isSpeaking,
  showSlowThinkingNotice,
  wakeLockActive,
  aiMode,
  ttsActive,
  upscaleNotice,
  shareIntakeNotice,
  voiceStatusNotice,
  speechNotice,
  quickCommands,
  organicMotion,
  messageToolsEnabled,
  quickChipsEnabled,
  projectColor,
  progressPercent,
  silenceLineColor,
  scrollEndRef,
  onUpdateStage,
  onHeaderTouchStart,
  onHeaderTouchEnd,
  onToggleAiMode,
  onToggleTts,
  onClearMessages,
  onSubmitTranscript,
  onFileUpload,
  onClearAttachment,
  onTranscriptChange,
  onManualMicToggle,
  onJumpToAction,
  onMoveAiAction,
  onUndoAction,
  hasUndoHandler,
  onRetryMessage,
  onParkAsNote,
  onSaveAsInfo,
  onSpeakMessage,
  onEditPrompt,
  onReprocessPrompt,
  onExportChatTranscript,
  onSaveChatAsKnowledge
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copiedChat, setCopiedChat] = useState(false);
  const [chatActionNotice, setChatActionNotice] = useState<string | null>(null);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);
  const noticeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutside = (ev: MouseEvent) => {
      if (
        menuContainerRef.current &&
        !menuContainerRef.current.contains(ev.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    const handleEsc = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [menuOpen]);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current !== null) {
        window.clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  const showTransientNotice = (msg: string) => {
    setChatActionNotice(msg);
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = window.setTimeout(() => {
      setChatActionNotice(null);
    }, 3000);
  };

  const phaseText = isListening
    ? 'Hört zu'
    : isProcessing
      ? 'Denkt nach'
      : isSpeaking
        ? 'Spricht'
        : 'Bereit';

  const handleCopyAll = async () => {
    await onExportChatTranscript('clipboard');
    setCopiedChat(true);
    showTransientNotice('Verlauf kopiert ✓');
    window.setTimeout(() => setCopiedChat(false), 2000);
    setMenuOpen(false);
  };

  const handleExportMd = async () => {
    await onExportChatTranscript('markdown');
    showTransientNotice('Als Markdown (.md) exportiert ✓');
    setMenuOpen(false);
  };

  const handleExportTxt = async () => {
    await onExportChatTranscript('text');
    showTransientNotice('Als Text (.txt) exportiert ✓');
    setMenuOpen(false);
  };

  const handleSaveChatKnowledge = () => {
    const saved = onSaveChatAsKnowledge();
    setMenuOpen(false);
    if (saved) {
      showTransientNotice('Verlauf als Projekt-Wissen gesichert ✓');
    } else {
      showTransientNotice('Noch keine Nachrichten zum Sichern vorhanden.');
    }
  };

  const handleClearChat = () => {
    onClearMessages();
    setMenuOpen(false);
    showTransientNotice('Verlauf geleert.');
  };

  return (
    <div
      role="dialog"
      aria-label="KI-Sprachassistent Dialog"
      className="fixed inset-0 z-50 flex flex-col justify-end transition-opacity duration-300"
      style={{
        backgroundColor: 'rgba(11, 13, 17, 0.78)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)'
      }}
    >
      {/* Klick außerhalb minimiert zu Stufe 1 */}
      <div className="flex-1" onClick={() => onUpdateStage(1)} />

      <div
        className="w-full max-w-[440px] mx-auto h-[85vh] rounded-t-3xl border-t border-white/10 shadow-2xl flex flex-col overflow-hidden transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ backgroundColor: THEME.bgMain }}
      >
        {/* Minimaler, einzeiliger Kopf */}
        <div
          ref={menuContainerRef}
          onTouchStart={(e) => onHeaderTouchStart(e.touches[0].clientY)}
          onTouchEnd={(e) => onHeaderTouchEnd(e.changedTouches[0].clientY)}
          className="px-4 pt-2 pb-2.5 border-b border-white/[0.06] shrink-0 select-none relative"
          style={{ backgroundColor: DESIGN_TOKENS.surface }}
        >
          {/* Drag Pill */}
          <div
            onClick={() => onUpdateStage(1)}
            className="w-12 h-1 rounded-full bg-white/20 mx-auto mb-2 cursor-pointer hover:bg-white/40 transition"
            title="Nach unten wischen oder klicken zum Minimieren"
            aria-label="Nach unten wischen zum Verkleinern"
          />

          <div className="flex items-center justify-between gap-2 min-w-0">
            {/* Links: Projektfarbpunkt + Projektname + dezenter Phasen-Indikator */}
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  isListening || isProcessing ? 'animate-pulse' : ''
                }`}
                style={{
                  backgroundColor: isProcessing ? DESIGN_TOKENS.accentHoney : projectColor
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-[#F1F5F9] truncate">
                  {activeProjectName}
                </div>
                <div className="text-xs text-[#94A3B8] flex items-center gap-2 min-w-0">
                  <span className="truncate">
                    {phaseText}
                    {wakeLockActive ? ' · Display wach' : ''}
                  </span>
                  {isListening && (
                    <VoiceWaveformBars color={projectColor} organicMotion={organicMotion} />
                  )}
                </div>
              </div>
            </div>

            {/* Rechts: Genau 4 saubere min-h-[44px]-Icon-Knöpfe: Stumm/Ton, ⤡, ⋮, ✕ */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={onToggleTts}
                className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl border flex items-center justify-center active:scale-95 transition cursor-pointer ${
                  ttsActive
                    ? 'bg-[#0A9396]/20 border-[#14B8A6]/60 text-[#F1F5F9]'
                    : 'bg-[#111317] border-white/10 text-[#94A3B8]'
                }`}
                title={ttsActive ? 'Stimme stummschalten' : 'Stimme einschalten'}
                aria-label="Stimme umschalten"
              >
                {ttsActive ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={() => onUpdateStage(1)}
                className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-[#111317] text-[#94A3B8] hover:text-[#F1F5F9] border border-white/10 flex items-center justify-center active:scale-95 transition cursor-pointer"
                title="Verkleinern"
                aria-label="Verkleinern zu Stufe 1"
              >
                <Minimize2 className="w-4 h-4" />
              </button>

              <button
                type="button"
                aria-label="Chat-Optionen"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((o) => !o)}
                className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl border flex items-center justify-center active:scale-95 transition cursor-pointer ${
                  menuOpen
                    ? 'bg-[#22262F] border-white/20 text-[#F1F5F9]'
                    : 'bg-[#111317] border-white/10 text-[#94A3B8] hover:text-[#F1F5F9]'
                }`}
                title="Chat-Optionen"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => onUpdateStage(0)}
                className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-[#111317] text-[#94A3B8] hover:text-[#F1F5F9] border border-white/10 flex items-center justify-center active:scale-95 transition cursor-pointer"
                title="Schließen"
                aria-label="Schließen"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Aufklappbares Chat-Menü (⋮) */}
          {menuOpen && (
            <div
              role="menu"
              aria-label="Chat-Optionen Menü"
              className="absolute right-4 top-full mt-1.5 z-30 w-[min(290px,calc(100vw-32px))] rounded-2xl bg-[#191C22] border border-white/10 shadow-2xl p-1.5 space-y-1 animate-fadeIn"
            >
              {messageToolsEnabled && (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={messages.length === 0}
                    onClick={() => void handleCopyAll()}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl text-left text-xs font-medium text-[#F1F5F9] hover:bg-white/5 disabled:opacity-40 flex items-center gap-2.5 transition cursor-pointer"
                  >
                    {copiedChat ? (
                      <Check className="w-4 h-4 text-[#14B8A6] shrink-0" />
                    ) : (
                      <Copy className="w-4 h-4 text-[#94A3B8] shrink-0" />
                    )}
                    <span className="break-words">
                      {copiedChat ? 'Kopiert ✓' : 'Verlauf kopieren'}
                    </span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    disabled={messages.length === 0}
                    onClick={() => void handleExportMd()}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl text-left text-xs font-medium text-[#F1F5F9] hover:bg-white/5 disabled:opacity-40 flex items-center gap-2.5 transition cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-[#94A3B8] shrink-0" />
                    <span className="break-words">Als Markdown (.md) exportieren</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    disabled={messages.length === 0}
                    onClick={() => void handleExportTxt()}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl text-left text-xs font-medium text-[#F1F5F9] hover:bg-white/5 disabled:opacity-40 flex items-center gap-2.5 transition cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-[#94A3B8] shrink-0" />
                    <span className="break-words">Als Text (.txt) exportieren</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    disabled={messages.length === 0}
                    onClick={handleSaveChatKnowledge}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl text-left text-xs font-medium text-[#F1F5F9] hover:bg-white/5 disabled:opacity-40 flex items-center gap-2.5 transition cursor-pointer"
                  >
                    <BookmarkPlus className="w-4 h-4 text-[#14B8A6] shrink-0" />
                    <span className="break-words">Verlauf als Projekt-Wissen sichern</span>
                  </button>

                  <div className="my-1 border-t border-white/5" />
                </>
              )}

              <button
                type="button"
                role="menuitem"
                disabled={messages.length === 0}
                onClick={handleClearChat}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl text-left text-xs font-medium text-[#94A3B8] hover:text-[#E5A93C] hover:bg-white/5 disabled:opacity-40 flex items-center gap-2.5 transition cursor-pointer"
              >
                <Trash2 className="w-4 h-4 shrink-0" />
                <span>Verlauf leeren</span>
              </button>
            </div>
          )}

          {/* Automatische Hochschaltung Hinweis im Vollbild */}
          {upscaleNotice && (
            <div className="mt-2 px-3 py-1.5 rounded-xl bg-purple-950/70 border border-purple-500/40 text-purple-200 text-xs flex items-center gap-2 animate-fadeIn">
              <Brain className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span className="break-words">{upscaleNotice}</span>
            </div>
          )}

          {/* Ruhiger Honig-Gold-Hinweis bei geteilten Inhalten */}
          {shareIntakeNotice && (
            <div
              data-testid="share-intake-notice"
              className="mt-2 px-3 py-1.5 rounded-xl bg-[#E5A93C]/10 border border-[#E5A93C]/30 text-[#E5A93C] text-xs leading-snug"
            >
              {shareIntakeNotice}
            </div>
          )}

          {/* Ruhiger Honig-Gold-Statushinweis (Fallback / API-Timeout) */}
          {voiceStatusNotice && (
            <div className="mt-2 px-3 py-1.5 rounded-xl bg-[#E5A93C]/10 border border-[#E5A93C]/30 text-[#E5A93C] text-xs leading-snug">
              {voiceStatusNotice}
            </div>
          )}

          {/* Ruhige Rückmeldung für Kopieren / Export / Wissen sichern */}
          {chatActionNotice && (
            <div
              data-testid="companion-chat-action-notice"
              className="mt-2 px-3 py-1.5 rounded-xl bg-[#14B8A6]/12 border border-[#14B8A6]/30 text-[#14B8A6] text-xs leading-snug"
            >
              {chatActionNotice}
            </div>
          )}
        </div>

        {/* Gesprächs- und Zuordnungs-Verlauf */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4 space-y-4">
              <div className="space-y-1.5 max-w-[320px]">
                <p className="text-base font-semibold text-[#F1F5F9]">
                  Wie kann Gisela helfen?
                </p>
                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  Aufgaben, Einkäufe, Notizen oder Fragen frei einsprechen oder eintippen.
                </p>
              </div>

              {/* Quick-Command-Chips nur wenn aktiviert UND der Chat leer ist */}
              {quickChipsEnabled && quickCommands && quickCommands.length > 0 && (
                <div
                  data-testid="companion-quick-chips"
                  className="w-full flex flex-wrap items-center justify-center gap-2 pt-1"
                >
                  {quickCommands.map((cmd, idx) => (
                    <button
                      type="button"
                      key={idx}
                      disabled={isProcessing}
                      onClick={() => onSubmitTranscript(cmd)}
                      className="min-h-[44px] px-3.5 py-2 rounded-2xl bg-[#191C22] hover:bg-[#22262F] border border-white/[0.06] text-xs font-medium text-[#F1F5F9] flex items-center gap-2 text-left transition active:scale-95 cursor-pointer max-w-full"
                    >
                      <Zap className="w-3.5 h-3.5 text-[#14B8A6] shrink-0" />
                      <span className="break-words">{cmd}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            messages.map((msg, index) => {
              let associatedPrompt: string | undefined;
              if (msg.role === 'assistant') {
                for (let j = index - 1; j >= 0; j--) {
                  if (messages[j].role === 'user') {
                    associatedPrompt = messages[j].text;
                    break;
                  }
                }
              }

              return (
                <CompanionMessageItem
                  key={msg.id}
                  message={msg}
                  associatedPrompt={associatedPrompt}
                  activeProjects={activeProjects}
                  projectColor={projectColor}
                  isProcessing={isProcessing}
                  messageToolsEnabled={messageToolsEnabled}
                  onJumpToAction={onJumpToAction}
                  onCloseAfterJump={() => onUpdateStage(0)}
                  onMoveAiAction={onMoveAiAction}
                  onUndoAction={onUndoAction}
                  hasUndoHandler={hasUndoHandler}
                  onRetryMessage={onRetryMessage}
                  onParkAsNote={onParkAsNote}
                  onSaveAsInfo={onSaveAsInfo}
                  onSpeakMessage={onSpeakMessage}
                  onEditPrompt={onEditPrompt}
                  onReprocessPrompt={onReprocessPrompt}
                />
              );
            })
          )}

          {/* 5s-Wartehinweis (PROCESSING > 5s) */}
          {isProcessing && showSlowThinkingNotice && (
            <div
              data-testid="slow-thinking-notice"
              className="px-3.5 py-2.5 rounded-2xl bg-[#191C22] border border-[#E5A93C]/25 text-xs text-[#E5A93C] flex items-center gap-2.5 animate-pulse"
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              <span>Gisela denkt noch kurz nach…</span>
            </div>
          )}
          <div ref={scrollEndRef} />
        </div>

        <CompanionComposer
          offlineAudioBufferEnabled={offlineAudioBufferEnabled}
          resolvedProjectId={resolvedProjectId}
          userApiKey={userApiKey}
          effectiveOfflineMemos={effectiveOfflineMemos}
          onSaveOfflineMemos={onSaveOfflineMemos}
          transcript={transcript}
          attachment={attachment}
          hasSpokenText={hasSpokenText}
          isListening={isListening}
          isProcessing={isProcessing}
          organicMotion={Boolean(organicMotion)}
          aiMode={aiMode}
          projectColor={projectColor}
          progressPercent={progressPercent}
          silenceLineColor={silenceLineColor}
          speechNotice={speechNotice}
          onFileUpload={onFileUpload}
          onClearAttachment={onClearAttachment}
          onToggleAiMode={onToggleAiMode}
          onTranscriptChange={onTranscriptChange}
          onSubmitTranscript={onSubmitTranscript}
          onManualMicToggle={onManualMicToggle}
        />
      </div>
    </div>
  );
};
