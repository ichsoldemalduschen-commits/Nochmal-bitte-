import React from 'react';
import {
  Check,
  Keyboard,
  LayoutGrid,
  Loader2,
  Maximize2,
  Mic,
  Send,
  Volume2
} from 'lucide-react';
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
  return (
    <div
      role="region"
      aria-label="KI-Begleiter Kompakt"
      className="fixed inset-x-0 bottom-[calc(max(1rem,env(safe-area-inset-bottom))+82px)] z-40 pointer-events-none px-3"
    >
      <div
        className="max-w-[440px] mx-auto pointer-events-auto rounded-[26px] border shadow-2xl p-3 space-y-2.5 stage1-organic-grow transition-all duration-300 relative overflow-hidden"
        style={{
          backgroundColor: 'rgba(25, 28, 34, 0.94)',
          borderColor: `${accentColor}55`,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: `0 16px 45px rgba(0,0,0,0.7), 0 0 20px ${glowColor}`
        }}
        onTouchStart={(e) => onTouchStartY(e.touches[0].clientY)}
        onTouchEnd={(e) => onTouchEndY(e.changedTouches[0].clientY)}
      >
        {/* Organischer Verbinder nach unten zum Sechseck */}
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-2 bg-[#191C22] rounded-t-full border-t border-x border-[#14B8A6]/40 pointer-events-none" />

        {/* Oberer Zieh-Griff */}
        <div
          onClick={() => onUpdateStage(2)}
          className="w-12 h-1 rounded-full bg-white/20 mx-auto cursor-pointer hover:bg-white/40 transition"
          title="Nach oben ziehen für volles Gespräch"
          aria-label="Nach oben ziehen für volles Gespräch"
        />

        {/* Hauptzeile: Mini-Sechseck + 2-Zeilen-Textbereich + 3 Kontroll-Icons */}
        <div className="flex items-center justify-between gap-2.5">
          {/* Links: Lebendes Mini-Sechseck (min-h-[44px] min-w-[44px]) */}
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
            {/* Mini-Hexagon SVG */}
            <svg width="44" height="44" viewBox="0 0 44 44" className="absolute inset-0 pointer-events-none">
              <path
                d="M22 3 L39 12.8 L39 31.2 L22 41 L5 31.2 L5 12.8 Z"
                fill="#14171D"
                stroke={
                  isProcessing
                    ? '#E5A93C'
                    : isListening
                    ? accentColor
                    : isSpeaking
                    ? accentColor
                    : `${accentColor}88`
                }
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>

            {/* Status-Icon im Zentrum */}
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

          {/* Mitte: Textbereich (2 Zeilen) */}
          <div
            className="flex-1 min-w-0 cursor-pointer select-none"
            onClick={() => onUpdateStage(2)}
            title="Antippen für volles Gespräch"
          >
            {isListening ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-bold" style={{ color: accentColor }}>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full animate-ping shrink-0" style={{ backgroundColor: accentColor }} />
                    <span>Höre zu...</span>
                  </span>
                </div>
                <div className="text-xs text-white truncate mt-0.5">
                  {transcript || 'Sprechen oder aufhören zum Absenden...'}
                </div>
                {hasSpokenText && (
                  <div className="w-full h-1 bg-[#111317] rounded-full overflow-hidden">
                    <div
                      className="h-full transition-all duration-150 rounded-full"
                      style={{
                        width: `${progressPercent}%`,
                        backgroundColor: silenceLineColor
                      }}
                    />
                  </div>
                )}
              </div>
            ) : isProcessing ? (
              <div>
                <div className="text-xs font-bold text-[#E5A93C] flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                  <span>Denken &amp; Zuordnen...</span>
                </div>
                <div
                  data-testid={showSlowThinkingNotice ? 'slow-thinking-notice' : undefined}
                  className="text-xs text-[#94A3B8] truncate mt-0.5"
                >
                  {showSlowThinkingNotice ? 'Gisela denkt noch kurz nach…' : 'Eingabe wird verarbeitet'}
                </div>
              </div>
            ) : isSpeaking ? (
              <div>
                <div className="text-xs font-bold text-[#14B8A6] flex items-center gap-1.5">
                  <Volume2 className="w-3 h-3 animate-pulse shrink-0" />
                  <span>Gisela antwortet:</span>
                </div>
                <div className="text-xs text-white line-clamp-1 mt-0.5">
                  {lastAssistantMsg?.text || 'Sprachausgabe läuft...'}
                </div>
              </div>
            ) : isCooldown ? (
              <div>
                <div className="text-xs font-bold text-[#14B8A6] truncate">
                  Bereit zum Weiterreden...
                </div>
                <div className="text-xs text-[#94A3B8] truncate mt-0.5">
                  Mikrofon startet gleich automatisch
                </div>
              </div>
            ) : lastAction ? (
              <div className="flex items-center justify-between gap-1">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-[#14B8A6] truncate flex items-center gap-1">
                    <Check className="w-3 h-3 shrink-0" />
                    <span className="truncate">{lastAction.shortCheckableTitle}</span>
                  </div>
                  <div className="text-xs text-[#9CA3AF] truncate mt-0.5">
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
                    className="min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#E5A93C]/15 text-[#E5A93C] border border-[#E5A93C]/30 shrink-0 active:scale-95 transition flex items-center justify-center"
                    aria-label="Rückgängig"
                  >
                    Rückgängig
                  </button>
                )}
              </div>
            ) : lastAssistantMsg?.isErrorFallback ? (
              <div>
                <div className="text-xs font-bold text-[#E5A93C] truncate">
                  Verbindung unterbrochen – nichts angelegt
                </div>
                <div className="text-xs text-[#94A3B8] truncate mt-0.5">
                  Antippen für Erneut senden oder Parken
                </div>
              </div>
            ) : lastAssistantMsg?.text ? (
              <div>
                <div className="text-xs font-extrabold uppercase tracking-wider text-[#94A3B8] truncate">
                  {activeProjectName}
                </div>
                <div className="text-xs text-white truncate mt-0.5">
                  {lastAssistantMsg.text}
                </div>
              </div>
            ) : (
              <div>
                <div className="text-xs font-extrabold uppercase tracking-wider text-[#94A3B8] truncate">
                  {activeProjectName}
                </div>
                <div className="text-xs text-white truncate mt-0.5">
                  Begleiter bereit – tippen oder sprechen
                </div>
              </div>
            )}
          </div>

          {/* Rechts: Genau 3 Kontroll-Icons (je 44×44 px) */}
          <div className="flex items-center gap-1 shrink-0">
            {/* 1. ⌨ (Kurz tippen): Schmale Eingabezeile ein-/ausklappen */}
            <button
              type="button"
              onClick={onToggleStage1TextInput}
              className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center border transition active:scale-95 cursor-pointer ${
                showStage1TextInput
                  ? 'bg-[#14B8A6]/20 border-[#14B8A6] text-[#14B8A6]'
                  : 'bg-[#242930] hover:bg-[#2A3038] text-[#9CA3AF] hover:text-white border-white/5'
              }`}
              title="Tastatur einblenden"
              aria-label="Textfeld öffnen"
            >
              <Keyboard className="w-4 h-4" />
            </button>

            {/* 2. ⊞ (Schnellauswahl): Notausgang-Wechsel ins Schnellauswahl-Menü */}
            <button
              type="button"
              onClick={() => {
                onUpdateStage(0);
                onOpenQuickFan?.();
              }}
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-[#242930] hover:bg-[#2A3038] text-[#9CA3AF] hover:text-white border border-white/5 flex items-center justify-center active:scale-95 transition cursor-pointer"
              title="Schnellauswahl öffnen"
              aria-label="Schnellauswahl öffnen"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>

            {/* 3. ⤢ (Vergrößern): Schaltet auf Stufe 2 */}
            <button
              type="button"
              onClick={() => onUpdateStage(2)}
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-[#242930] hover:bg-[#2A3038] text-[#9CA3AF] hover:text-white border border-white/5 flex items-center justify-center active:scale-95 transition cursor-pointer"
              title="Vergrößern"
              aria-label="Vergrößern zu Vollbild"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Ruhiger Display-Wach-Label (Screen Wake Lock aktiv) */}
        {wakeLockActive && (
          <div className="px-1 text-xs text-[#94A3B8]">
            Display wach
          </div>
        )}

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
          <div className="pt-2 border-t border-white/5 flex items-center gap-2 animate-fadeIn">
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
              className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl text-xs bg-[#111317] text-white border border-white/10 focus:outline-none focus:border-[#14B8A6]"
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
      </div>
    </div>
  );
};
