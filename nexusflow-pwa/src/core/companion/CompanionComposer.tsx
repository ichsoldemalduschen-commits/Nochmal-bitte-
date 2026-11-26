import React, { useEffect, useRef } from 'react';
import { Brain, Loader2, Mic, MicOff, Paperclip, Plus, Send, X, Zap } from 'lucide-react';
import { Attachment, OfflineAudioMemo, THEME } from '../../types';
import { OfflineAudioBufferBar } from '../front/OfflineAudioBufferBar';

export interface CompanionComposerProps {
  offlineAudioBufferEnabled: boolean;
  resolvedProjectId: string;
  userApiKey?: string;
  effectiveOfflineMemos: OfflineAudioMemo[];
  onSaveOfflineMemos: (next: OfflineAudioMemo[]) => void;
  transcript: string;
  attachment: Attachment | null;
  hasSpokenText: boolean;
  isListening: boolean;
  isProcessing: boolean;
  organicMotion: boolean;
  aiMode: 'flash' | 'research';
  projectColor: string;
  progressPercent: number;
  silenceLineColor: string;
  speechNotice: string;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  onClearAttachment: () => void;
  onToggleAiMode: () => void;
  onTranscriptChange: (value: string) => void;
  onSubmitTranscript: (overrideText?: string) => void;
  onManualMicToggle: () => void;
}

export const CompanionComposer: React.FC<CompanionComposerProps> = ({
  offlineAudioBufferEnabled,
  resolvedProjectId,
  userApiKey = '',
  effectiveOfflineMemos,
  onSaveOfflineMemos,
  transcript,
  attachment,
  hasSpokenText,
  isListening,
  isProcessing,
  organicMotion,
  aiMode,
  projectColor,
  progressPercent,
  silenceLineColor,
  speechNotice,
  onFileUpload,
  onClearAttachment,
  onToggleAiMode,
  onTranscriptChange,
  onSubmitTranscript,
  onManualMicToggle
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const canSend = hasSpokenText || Boolean(attachment);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(112, Math.max(44, el.scrollHeight))}px`;
  }, [transcript]);

  return (
    <div className="shrink-0 space-y-2 pt-1">
      {/* Isolierter Offline-Audio-Puffer fürs Funkloch (über der Eingabe-Kapsel) */}
      <OfflineAudioBufferBar
        enabled={offlineAudioBufferEnabled}
        activeProjectId={resolvedProjectId}
        userApiKey={userApiKey}
        memos={effectiveOfflineMemos}
        onSaveMemos={onSaveOfflineMemos}
        onSubmitTranscript={(text) => onSubmitTranscript(text)}
        className="mx-3 mt-1 shrink-0"
      />

      {isListening && hasSpokenText && !isProcessing && (
        <div className="px-4 space-y-1">
          <div className="flex justify-between text-xs text-[#94A3B8]">
            <span>Automatischer Versand nach Denkpause</span>
          </div>
          <div className="w-full h-[2px] bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-150 rounded-full"
              style={{
                width: `${progressPercent}%`,
                backgroundColor: silenceLineColor
              }}
            />
          </div>
        </div>
      )}

      {speechNotice && (
        <div className="text-xs text-[#E5A93C] px-4">{speechNotice}</div>
      )}

      {/* Gemini-Eingabe-Kapsel */}
      <div className="mx-3 mb-3 rounded-[24px] bg-[#191C22] border border-white/10 p-2.5 space-y-2 shadow-lg">
        {/* Kompakte Bild-/Datei-Vorschau-Chip */}
        {attachment && (
          <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-2xl bg-[#111317] border border-white/10 min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {attachment.type === 'image' && attachment.dataUrl ? (
                <img
                  src={attachment.dataUrl}
                  alt={attachment.name}
                  className="w-8 h-8 rounded-lg object-cover shrink-0"
                />
              ) : (
                <Paperclip className="w-4 h-4 text-[#14B8A6] shrink-0" />
              )}
              <span className="text-xs text-[#F1F5F9] truncate">{attachment.name}</span>
            </div>
            <button
              type="button"
              onClick={onClearAttachment}
              aria-label="Anhang entfernen"
              className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-[#94A3B8] hover:text-[#F1F5F9] cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Obere Zeile: Auto-mitwachsendes Textarea (max. 4 Zeilen) */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={transcript}
          onChange={(e) => onTranscriptChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && canSend && !isProcessing) {
              e.preventDefault();
              onSubmitTranscript();
            }
          }}
          placeholder={
            isListening
              ? 'Höre zu – einfach sprechen...'
              : 'Gisela fragen, notieren oder diktieren...'
          }
          className="w-full min-w-0 min-h-[44px] max-h-[112px] px-2.5 py-2.5 bg-transparent text-sm text-[#F1F5F9] placeholder-[#94A3B8] resize-none focus:outline-none leading-snug"
        />

        {/* Untere Werkzeugzeile */}
        <div className="flex items-center justify-between gap-1.5 flex-wrap pt-0.5">
          {/* Links: + Foto-Button & Modus-Umschalter-Pill */}
          <div className="flex items-center gap-1.5 min-w-0">
            <label
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-[#111317] border border-white/10 text-[#94A3B8] hover:text-[#F1F5F9] cursor-pointer shrink-0 flex items-center justify-center active:scale-95 transition"
              title="Foto oder Datei anhängen"
              aria-label="Foto oder Datei anhängen"
            >
              <Plus className="w-4 h-4" />
              <input type="file" className="hidden" onChange={onFileUpload} />
            </label>

            <button
              type="button"
              onClick={onToggleAiMode}
              className={`min-h-[44px] px-3 py-1.5 rounded-full text-xs font-semibold border flex items-center gap-1.5 active:scale-95 transition cursor-pointer shrink-0 ${
                aiMode === 'flash'
                  ? 'bg-[#111317] border-white/10 text-[#F1F5F9]'
                  : 'bg-purple-900/35 border-purple-400/70 text-purple-200'
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
                  <Zap className="w-3.5 h-3.5 text-[#E5A93C] shrink-0" />
                  <span>Sprech</span>
                </>
              ) : (
                <>
                  <Brain className="w-3.5 h-3.5 text-purple-300 shrink-0" />
                  <span>Research</span>
                </>
              )}
            </button>
          </div>

          {/* Rechts: Mikrofon-Button & Senden-Button */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="relative shrink-0">
              {isListening && organicMotion && (
                <>
                  <span className="absolute inset-0 rounded-full bg-[#14B8A6]/30 animate-ping pointer-events-none" />
                  <span className="absolute -inset-1 rounded-full bg-[#0A9396]/20 animate-pulse pointer-events-none" />
                </>
              )}
              <button
                type="button"
                disabled={isProcessing}
                onClick={onManualMicToggle}
                className="relative w-11 h-11 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-white transition-transform duration-300 active:scale-90 cursor-pointer"
                style={{
                  backgroundColor: isProcessing
                    ? '#2F363D'
                    : isListening
                      ? THEME.aiGold
                      : projectColor
                }}
                aria-label="Mikrofon umschalten"
              >
                {isProcessing ? (
                  <Loader2 className="w-5 h-5 animate-spin text-[#E5A93C]" />
                ) : isListening ? (
                  <Mic className="w-5 h-5 animate-pulse" />
                ) : (
                  <MicOff className="w-5 h-5" />
                )}
              </button>
            </div>

            <button
              type="button"
              disabled={!canSend || isProcessing}
              onClick={() => onSubmitTranscript()}
              className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-full shrink-0 flex items-center justify-center active:scale-95 transition cursor-pointer ${
                canSend && !isProcessing
                  ? 'text-white shadow-md'
                  : 'bg-[#111317] text-[#94A3B8]/50 border border-white/5 disabled:opacity-50'
              }`}
              style={canSend && !isProcessing ? { backgroundColor: projectColor } : undefined}
              aria-label="Senden"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
