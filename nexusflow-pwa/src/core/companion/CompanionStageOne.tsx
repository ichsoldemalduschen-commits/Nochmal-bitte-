import React from 'react';
import {
  Check,
  Keyboard,
  LayoutGrid,
  Loader2,
  Maximize2,
  Mic,
  Send,
  Volume2,
  X
} from 'lucide-react';
import { DESIGN_TOKENS } from '../../config/designTokens';
import { AiExecutedAction, OfflineAudioMemo } from '../../types';
import { OfflineAudioBufferBar } from '../front/OfflineAudioBufferBar';
import { ConversationMessage } from './useVoiceSession';

export interface CompanionStageOneProps {
  activeProjectName: string;
  resolvedProjectId: string;
  userApiKey?: string;
  offlineAudioBufferEnabled: boolean;
  effectiveOfflineMemos: OfflineAudioMemo[];
  onSaveOfflineMemos: (next: OfflineAudioMemo[]) => void;
  projectColor: string;
  accentColor: string;
  glowColor: string;
  silenceLineColor: string;
  progressPercent: number;
  hasSpokenText: boolean;
  transcript: string;
  isListening: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  isCooldown: boolean;
  showSlowThinkingNotice: boolean;
  wakeLockActive: boolean;
  shareIntakeNotice: string | null;
  voiceStatusNotice: string | null;
  showStage1TextInput: boolean;
  lastAssistantMsg?: ConversationMessage;
  lastAction?: AiExecutedAction;
  canUndoLastAction: boolean;
  onUpdateStage: (stage: 1 | 2 | 0) => void;
  onManualMicToggle: () => void;
  onToggleStage1TextInput: () => void;
  onOpenQuickFan?: () => void;
  onUndoLastAction: () => void;
  onTranscriptChange: (value: string) => void;
  onSubmitTranscript: (overrideText?: string) => void;
  onTouchStartY: (clientY: number) => void;
  onTouchEndY: (clientY: number) => void;
}

export const CompanionStageOne: React.FC<CompanionStageOneProps> = ({
  activeProjectName,
  resolvedProjectId,
  userApiKey = '',
  offlineAudioBufferEnabled,
  effectiveOfflineMemos,
  onSaveOfflineMemos,
  projectColor,
  accentColor,
  glowColor,
  silenceLineColor,
  progressPercent,
  hasSpokenText,
  transcript,
  isListening,
  isProcessing,
  isSpeaking,
  isCooldown,
  showSlowThinkingNotice,
  wakeLockActive,
  shareIntakeNotice,
  voiceStatusNotice,
  showStage1TextInput,
  lastAssistantMsg,
  lastAction,
  canUndoLastAction,
  onUpdateStage,
  onManualMicToggle,
  onToggleStage1TextInput,
  onOpenQuickFan,
  onUndoLastAction,
  onTranscriptChange,
  onSubmitTranscript,
  onTouchStartY,
  onTouchEndY
}) => {
  const statusLabel = isListening
    ? 'Höre zu...'
    : isProcessing
      ? 'Denkt nach...'
      : isSpeaking
        ? 'Spricht...'
        : isCooldown
          ? 'Bereit...'
          : 'Bereit';

  return (
    <div
      role="region"
      aria-label="KI-Begleiter Kompakt"
      className="fixed inset-x-0 bottom-[calc(max(1rem,env(safe-area-inset-bottom))+82px)] z-40 pointer-events-none px-3"
    >
      <div
        className="max-w-[440px] mx-auto pointer-events-auto rounded-[24px] border shadow-2xl p-3 space-y-2 stage1-organic-grow transition-all duration-300 relative overflow-hidden"
        style={{
          backgroundColor: 'rgba(25, 28, 34, 0.96)',
          borderColor: 'rgba(255,255,255,0.08)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: `0 16px 45px rgba(0,0,0,0.72), 0 0 18px ${glowColor}`
        }}
        onTouchStart={(e) => onTouchStartY(e.touches[0].clientY)}
        onTouchEnd={(e) => onTouchEndY(e.changedTouches[0].clientY)}
      >
        {/* Oberer Zieh-Griff zum Hochziehen in Stufe 2 */}
        <div
          onClick={() => onUpdateStage(2)}
          className="w-12 h-1 rounded-full bg-white/20 mx-auto cursor-pointer hover:bg-white/40 transition"
          title="Nach oben ziehen für volles Gespräch"
          aria-label="Nach oben ziehen für volles Gespräch"
        />

        {/* Dezente 1-Zeilen-Statusanzeige (Projektfarbpunkt + Status + optional Display wach) */}
        <div
          className="flex items-center justify-between gap-2 text-xs min-w-0 cursor-pointer"
          onClick={() => onUpdateStage(2)}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                isListening || isProcessing ? 'animate-pulse' : ''
              }`}
              style={{
                backgroundColor: isProcessing ? DESIGN_TOKENS.accentHoney : projectColor
              }}
            />
            <span
              className="font-semibold shrink-0"
              style={{
                color: isProcessing
                  ? DESIGN_TOKENS.accentHoney
                  : isListening
                    ? accentColor
                    : DESIGN_TOKENS.textPrimary
              }}
            >
              {statusLabel}
            </span>
            <span className="text-[#94A3B8] truncate">{activeProjectName}</span>
          </div>
          {wakeLockActive && (
            <span className="text-xs text-[#94A3B8] shrink-0">Display wach</span>
          )}
        </div>

        {/* Ein einziges ruhiges Fokus-Feld (Live-Transkript / 2-Zeilen-Antwort / schlanke Quittung) */}
        <div
          className="min-w-0 cursor-pointer select-none rounded-2xl bg-[#111317]/80 border border-white/[0.04] px-3 py-2 space-y-1.5"
          onClick={() => onUpdateStage(2)}
          title="Antippen für volles Gespräch"
        >
          {isListening ? (
            <p className="text-xs sm:text-sm text-[#F1F5F9] leading-snug break-words line-clamp-2">
              {transcript || 'Sprechen oder aufhören zum Absenden...'}
            </p>
          ) : isProcessing ? (
            <div className="flex items-center gap-2 min-w-0">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#E5A93C] shrink-0" />
              <span
                data-testid={showSlowThinkingNotice ? 'slow-thinking-notice' : undefined}
                className="text-xs text-[#94A3B8] break-words"
              >
                {showSlowThinkingNotice ? 'Gisela denkt noch kurz nach…' : 'Eingabe wird verarbeitet'}
              </span>
            </div>
          ) : isSpeaking ? (
            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-[#14B8A6] flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 animate-pulse shrink-0" />
                <span>Gisela antwortet:</span>
              </div>
              <p className="text-xs text-[#F1F5F9] leading-snug break-words line-clamp-2">
                {lastAssistantMsg?.text || 'Sprachausgabe läuft...'}
              </p>
            </div>
          ) : isCooldown ? (
            <p className="text-xs text-[#94A3B8] leading-snug">
              Mikrofon startet gleich automatisch…
            </p>
          ) : lastAction ? (
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-[#14B8A6] flex items-center gap-1.5 min-w-0">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span className="break-words line-clamp-1">{lastAction.shortCheckableTitle}</span>
                </div>
                <div className="text-xs text-[#94A3B8] truncate">
                  {lastAction.targetProjectName} / {lastAction.targetSubTab}
                </div>
              </div>
              {canUndoLastAction && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUndoLastAction();
                  }}
                  className="min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#E5A93C]/15 text-[#E5A93C] border border-[#E5A93C]/30 shrink-0 active:scale-95 transition flex items-center justify-center cursor-pointer"
                  aria-label="Rückgängig"
                >
                  Rückgängig
                </button>
              )}
            </div>
          ) : lastAssistantMsg?.isErrorFallback ? (
            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-[#E5A93C]">
                Verbindung unterbrochen – nichts angelegt
              </div>
              <div className="text-xs text-[#94A3B8]">
                Antippen für Erneut senden oder Parken
              </div>
            </div>
          ) : lastAssistantMsg?.text ? (
            <p className="text-xs text-[#F1F5F9] leading-snug break-words line-clamp-2">
              {lastAssistantMsg.text}
            </p>
          ) : (
            <p className="text-xs text-[#94A3B8] leading-snug">
              Begleiter bereit – tippen oder sprechen
            </p>
          )}

          {/* Feine 2-px-Fortschrittslinie */}
          <div className="w-full h-[2px] bg-white/5 rounded-full overflow-hidden">
            {isListening && hasSpokenText && (
              <div
                className="h-full transition-all duration-150 rounded-full"
                style={{
                  width: `${progressPercent}%`,
                  backgroundColor: silenceLineColor
                }}
              />
            )}
          </div>
        </div>

        {/* Ruhiger Honig-Gold-Hinweis bei geteilten Inhalten */}
        {shareIntakeNotice && (
          <div
            data-testid="share-intake-notice"
            className="px-3 py-1.5 rounded-xl bg-[#E5A93C]/10 border border-[#E5A93C]/30 text-[#E5A93C] text-xs leading-snug"
          >
            {shareIntakeNotice}
          </div>
        )}

        {/* Ruhiger Honig-Gold-Statushinweis (Fallback / API-Timeout) */}
        {voiceStatusNotice && (
          <div className="px-3 py-1.5 rounded-xl bg-[#E5A93C]/10 border border-[#E5A93C]/30 text-[#E5A93C] text-xs leading-snug">
            {voiceStatusNotice}
          </div>
        )}

        {/* Isolierter Offline-Audio-Puffer fürs Funkloch */}
        <OfflineAudioBufferBar
          enabled={offlineAudioBufferEnabled}
          activeProjectId={resolvedProjectId}
          userApiKey={userApiKey}
          memos={effectiveOfflineMemos}
          onSaveMemos={onSaveOfflineMemos}
          onSubmitTranscript={(text) => onSubmitTranscript(text)}
          compact
        />

        {/* Ausklappbare schmale Texteingabezeile in Stufe 1 */}
        {showStage1TextInput && (
          <div className="pt-1.5 border-t border-white/5 flex items-center gap-2 animate-fadeIn">
            <input
              type="text"
              value={transcript}
              onChange={(e) => onTranscriptChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && transcript.trim()) {
                  onSubmitTranscript(transcript);
                }
              }}
              placeholder="Befehl oder Notiz tippen..."
              className="flex-1 min-w-0 min-h-[44px] px-3.5 py-2 rounded-xl text-xs bg-[#111317] text-[#F1F5F9] border border-white/10 focus:outline-none focus:border-[#14B8A6]"
              autoFocus
            />
            <button
              type="button"
              disabled={!transcript.trim() || isProcessing}
              onClick={() => onSubmitTranscript(transcript)}
              className="min-h-[44px] min-w-[44px] px-3 py-2 rounded-xl text-xs font-bold text-white flex items-center justify-center shrink-0 disabled:opacity-35 active:scale-95 transition cursor-pointer shadow-md"
              style={{ backgroundColor: accentColor }}
              aria-label="Befehl senden"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Kompakte, kollisionsfreie Daumen-Steuerung */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          {/* Links: Lebendes Mini-Sechseck (Start/Stopp) */}
          <button
            type="button"
            onClick={onManualMicToggle}
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center relative cursor-pointer active:scale-95 transition shrink-0"
            title={
              isSpeaking
                ? 'Gisela spricht – Antippen zum Unterbrechen & Weiterreden'
                : isProcessing
                  ? 'KI denkt...'
                  : isCooldown
                    ? 'Kurze Echo-Pause – Mikrofon startet gleich'
                    : isListening
                      ? 'Zuhören aktiv – Antippen zum Beenden/Senden'
                      : 'Mikrofon aktivieren'
            }
            aria-label="Begleiter Status & Mikrofon"
          >
            <svg width="44" height="44" viewBox="0 0 44 44" className="absolute inset-0 pointer-events-none">
              <path
                d="M22 3 L39 12.8 L39 31.2 L22 41 L5 31.2 L5 12.8 Z"
                fill="#14171D"
                stroke={
                  isProcessing
                    ? '#E5A93C'
                    : isListening || isSpeaking
                      ? accentColor
                      : `${accentColor}88`
                }
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
            <div className="relative z-10 flex items-center justify-center">
              {isProcessing ? (
                <Loader2 className="w-5 h-5 animate-spin text-[#E5A93C]" />
              ) : isListening ? (
                <Mic className="w-5 h-5 animate-pulse" style={{ color: accentColor }} />
              ) : isSpeaking ? (
                <Volume2 className="w-5 h-5 text-[#14B8A6] hex-speak-anim" />
              ) : (
                <Mic className="w-5 h-5" style={{ color: accentColor }} />
              )}
            </div>
          </button>

          {/* Rechts: ⌨, ⊞, ⤢, ✕ */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onToggleStage1TextInput}
              className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center border transition active:scale-95 cursor-pointer ${
                showStage1TextInput
                  ? 'bg-[#14B8A6]/20 border-[#14B8A6] text-[#14B8A6]'
                  : 'bg-[#22262F] hover:bg-[#2A3038] text-[#94A3B8] hover:text-[#F1F5F9] border-white/[0.06]'
              }`}
              title="Tastatur einblenden"
              aria-label="Textfeld öffnen"
            >
              <Keyboard className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                onUpdateStage(0);
                onOpenQuickFan?.();
              }}
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-[#22262F] hover:bg-[#2A3038] text-[#94A3B8] hover:text-[#F1F5F9] border border-white/[0.06] flex items-center justify-center active:scale-95 transition cursor-pointer"
              title="Schnellauswahl öffnen"
              aria-label="Schnellauswahl öffnen"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => onUpdateStage(2)}
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-[#22262F] hover:bg-[#2A3038] text-[#94A3B8] hover:text-[#F1F5F9] border border-white/[0.06] flex items-center justify-center active:scale-95 transition cursor-pointer"
              title="Vergrößern"
              aria-label="Vergrößern zu Vollbild"
            >
              <Maximize2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => onUpdateStage(0)}
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-[#22262F] hover:bg-[#2A3038] text-[#94A3B8] hover:text-[#F1F5F9] border border-white/[0.06] flex items-center justify-center active:scale-95 transition cursor-pointer"
              title="Schließen"
              aria-label="Begleiter schließen"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
