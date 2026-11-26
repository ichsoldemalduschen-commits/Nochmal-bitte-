import React from 'react';
import {
  Brain,
  Loader2,
  Minimize2,
  Trash2,
  Volume2,
  VolumeX,
  X,
  Zap
} from 'lucide-react';
import { AiExecutedAction, OfflineAudioMemo, Project, THEME } from '../../types';
import { CompanionComposer } from './CompanionComposer';
import { CompanionMessageItem } from './CompanionMessageItem';
import { ConversationMessage } from './useVoiceSession';

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
  hasSpokenText: boolean;
  isListening: boolean;
  isProcessing: boolean;
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
  onTranscriptChange: (value: string) => void;
  onManualMicToggle: () => void;
  onJumpToAction?: (act: AiExecutedAction) => void;
  onMoveAiAction?: (logId: string, actionId: string, newProjectId: string) => void;
  onUndoAction: (messageId: string, logId: string, actionId: string) => void;
  hasUndoHandler: boolean;
  onRetryMessage: (msg: ConversationMessage) => void;
  onParkAsNote: (msg: ConversationMessage) => void;
  onSaveAsInfo: (msg: ConversationMessage) => void;
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
  hasSpokenText,
  isListening,
  isProcessing,
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
  onTranscriptChange,
  onManualMicToggle,
  onJumpToAction,
  onMoveAiAction,
  onUndoAction,
  hasUndoHandler,
  onRetryMessage,
  onParkAsNote,
  onSaveAsInfo
}) => {
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
        className="w-full max-w-[440px] mx-auto h-[85vh] rounded-t-3xl border-t border-white/15 shadow-2xl flex flex-col overflow-hidden transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ backgroundColor: THEME.bgMain }}
      >
        {/* Kopfzeile mit Swipe-Down Handler & Drag Pill */}
        <div
          onTouchStart={(e) => onHeaderTouchStart(e.touches[0].clientY)}
          onTouchEnd={(e) => onHeaderTouchEnd(e.changedTouches[0].clientY)}
          className="px-4 pt-2 pb-3 border-b border-white/10 shrink-0 select-none"
          style={{ backgroundColor: THEME.bgCard }}
        >
          {/* Drag Pill */}
          <div
            onClick={() => onUpdateStage(1)}
            className="w-12 h-1 rounded-full bg-white/25 mx-auto mb-2 cursor-pointer hover:bg-white/40 transition"
            title="Nach unten wischen oder klicken zum Minimieren"
            aria-label="Nach unten wischen zum Verkleinern"
          />

          <div className="flex items-center justify-between gap-2 flex-wrap min-w-0">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  isListening
                    ? 'bg-[#E5A93C] animate-ping'
                    : isProcessing
                    ? 'bg-[#E5A93C]'
                    : 'bg-[#14B8A6]'
                }`}
              />
              <div className="min-w-0">
                <div className="text-xs font-bold uppercase tracking-wider text-white truncate">
                  KI-Kontext &amp; Dialog
                </div>
                <div className="text-xs text-[#9CA3AF] truncate">
                  Fokus: {activeProjectName}
                  {wakeLockActive ? ' · Display wach' : ''}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
              {/* 1-Tipp-Umschalter: ⚡ Sprech (Flash) ↔ 🧠 Research (Pro) */}
              <button
                type="button"
                onClick={onToggleAiMode}
                className={`min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 active:scale-95 transition ${
                  aiMode === 'flash'
                    ? 'bg-[#0A9396]/25 border-[#14B8A6] text-white shadow-sm'
                    : 'bg-purple-900/35 border-purple-400 text-purple-200 shadow-sm'
                }`}
                title={
                  aiMode === 'flash'
                    ? 'Aktuell: Sprech (Flash, schnell) – Tippen für Research (Pro)'
                    : 'Aktuell: Research (Pro, tiefgründig) – Tippen für Sprech (Flash)'
                }
                aria-label="KI-Modus umschalten"
              >
                {aiMode === 'flash' ? (
                  <>
                    <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Sprech</span>
                  </>
                ) : (
                  <>
                    <Brain className="w-4 h-4 text-purple-300 shrink-0" />
                    <span>Research</span>
                  </>
                )}
              </button>

              {/* Stimme Umschalter */}
              <button
                type="button"
                onClick={onToggleTts}
                className={`min-h-[44px] px-2.5 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1 active:scale-95 transition ${
                  ttsActive
                    ? 'bg-[#0A9396]/25 border-[#14B8A6] text-white'
                    : 'bg-[#181A1B] border-white/10 text-[#9CA3AF]'
                }`}
                aria-label="Stimme umschalten"
              >
                {ttsActive ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{ttsActive ? 'Stimme An' : 'Stumm'}</span>
              </button>

              {/* Verlauf leeren */}
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={onClearMessages}
                  className="min-w-[44px] min-h-[44px] rounded-xl bg-[#181A1B] text-[#9CA3AF] hover:text-white border border-white/10 flex items-center justify-center active:scale-95 transition"
                  title="Verlauf leeren"
                  aria-label="Verlauf leeren"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              {/* ⤡ Verkleinern zu Stufe 1 */}
              <button
                type="button"
                onClick={() => onUpdateStage(1)}
                className="min-w-[44px] min-h-[44px] rounded-xl bg-[#181A1B] text-xs font-bold text-[#9CA3AF] hover:text-white border border-white/10 flex items-center justify-center active:scale-95 transition"
                title="Verkleinern"
                aria-label="Verkleinern zu Stufe 1"
              >
                <Minimize2 className="w-4 h-4" />
              </button>

              {/* ✕ Schließen zu Stufe 0 */}
              <button
                type="button"
                onClick={() => onUpdateStage(0)}
                className="min-w-[44px] min-h-[44px] rounded-xl bg-[#181A1B] text-xs font-bold text-[#9CA3AF] hover:text-white border border-white/10 flex items-center justify-center active:scale-95 transition"
                title="Schließen"
                aria-label="Schließen"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Automatische Hochschaltung Hinweis im Vollbild */}
          {upscaleNotice && (
            <div className="mt-2 px-3 py-1.5 rounded-xl bg-purple-950/70 border border-purple-500/40 text-purple-200 text-xs flex items-center gap-2 animate-fadeIn">
              <Brain className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span className="truncate">{upscaleNotice}</span>
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
        </div>

        {/* Personalisierte Schnell-Befehle (Quick-Chips) */}
        {quickCommands && quickCommands.length > 0 && (
          <div className="px-3.5 py-2 border-b border-white/5 bg-[#1C2024] flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            {quickCommands.map((cmd, idx) => (
              <button
                type="button"
                key={idx}
                disabled={isProcessing}
                onClick={() => onSubmitTranscript(cmd)}
                className="min-h-[44px] px-3.5 py-1.5 rounded-full bg-[#24292E] hover:bg-[#0A9396]/30 border border-white/10 text-xs font-semibold text-[#F8F9FA] shrink-0 flex items-center gap-1.5 transition active:scale-95"
              >
                <Zap className="w-3.5 h-3.5 text-[#14B8A6]" />
                <span>{cmd}</span>
              </button>
            ))}
          </div>
        )}

        {/* Gesprächs- und Zuordnungs-Verlauf */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-6 space-y-2 text-[#9CA3AF]">
              <p className="text-sm font-semibold text-white">
                KI Sprach- &amp; Projekt-Agent bereit
              </p>
              <p className="text-xs leading-relaxed">
                Sprich Aufgaben, Einkäufe, Baugruppen oder Fragen frei ein. Jede Aktion wird hier im
                Verlauf als überprüfbare Karte dokumentiert.
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <CompanionMessageItem
                key={msg.id}
                message={msg}
                activeProjects={activeProjects}
                isProcessing={isProcessing}
                onJumpToAction={onJumpToAction}
                onCloseAfterJump={() => onUpdateStage(0)}
                onMoveAiAction={onMoveAiAction}
                onUndoAction={onUndoAction}
                hasUndoHandler={hasUndoHandler}
                onRetryMessage={onRetryMessage}
                onParkAsNote={onParkAsNote}
                onSaveAsInfo={onSaveAsInfo}
              />
            ))
          )}
          {isProcessing && showSlowThinkingNotice && (
            <div
              data-testid="slow-thinking-notice"
              className="px-2 py-1 text-xs text-[#94A3B8] flex items-center gap-2"
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#E5A93C] shrink-0" />
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
          hasSpokenText={hasSpokenText}
          isListening={isListening}
          isProcessing={isProcessing}
          organicMotion={Boolean(organicMotion)}
          progressPercent={progressPercent}
          silenceLineColor={silenceLineColor}
          speechNotice={speechNotice}
          onFileUpload={onFileUpload}
          onTranscriptChange={onTranscriptChange}
          onSubmitTranscript={onSubmitTranscript}
          onManualMicToggle={onManualMicToggle}
        />
      </div>
    </div>
  );
};
