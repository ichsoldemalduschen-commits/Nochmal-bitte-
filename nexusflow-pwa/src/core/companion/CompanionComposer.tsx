import React from 'react';
import { Loader2, Mic, MicOff, Paperclip, Send } from 'lucide-react';
import { OfflineAudioMemo, THEME } from '../../types';
import { OfflineAudioBufferBar } from '../front/OfflineAudioBufferBar';

export interface CompanionComposerProps {
  offlineAudioBufferEnabled: boolean;
  resolvedProjectId: string;
  userApiKey?: string;
  effectiveOfflineMemos: OfflineAudioMemo[];
  onSaveOfflineMemos: (next: OfflineAudioMemo[]) => void;
  transcript: string;
  hasSpokenText: boolean;
  isListening: boolean;
  isProcessing: boolean;
  organicMotion: boolean;
  progressPercent: number;
  silenceLineColor: string;
  speechNotice: string;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
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
  hasSpokenText,
  isListening,
  isProcessing,
  organicMotion,
  progressPercent,
  silenceLineColor,
  speechNotice,
  onFileUpload,
  onTranscriptChange,
  onSubmitTranscript,
  onManualMicToggle
}) => {
  return (
    <>
      {/* Isolierter Offline-Audio-Puffer fürs Funkloch (Stufe 2) */}
      <OfflineAudioBufferBar
        enabled={offlineAudioBufferEnabled}
        activeProjectId={resolvedProjectId}
        userApiKey={userApiKey}
        memos={effectiveOfflineMemos}
        onSaveMemos={onSaveOfflineMemos}
        onSubmitTranscript={(text) => onSubmitTranscript(text)}
        className="mx-3.5 mt-2 shrink-0"
      />

      {/* Untere Eingabeleiste - für flüssige Einhand-Eingaben optimiert */}
      <div
        className="p-3.5 border-t border-white/10 space-y-2.5 shrink-0"
        style={{ backgroundColor: THEME.bgCard }}
      >
        {isListening && hasSpokenText && !isProcessing && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-[#94A3B8]">
              <span>Automatischer Versand nach Denkpause</span>
            </div>
            <div className="w-full h-1 bg-[#111317] rounded-full overflow-hidden">
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
          <div className="text-xs text-amber-300 px-2">{speechNotice}</div>
        )}

        <div className="flex items-center gap-2">
          <label
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-2xl bg-[#181A1B] border border-white/10 text-[#9CA3AF] hover:text-white cursor-pointer shrink-0 flex items-center justify-center active:scale-95 transition"
            title="Foto oder Datei anhängen"
          >
            <Paperclip className="w-4 h-4" />
            <input type="file" className="hidden" onChange={onFileUpload} />
          </label>

          <input
            type="text"
            value={transcript}
            onChange={(e) => onTranscriptChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && transcript.trim()) {
                onSubmitTranscript(transcript);
              }
            }}
            placeholder={
              isListening
                ? 'Höre zu – einfach sprechen...'
                : 'Sprechen oder direkt tippen...'
            }
            className="flex-1 min-h-[44px] px-4 py-2.5 rounded-2xl text-xs bg-[#181A1B] text-white border border-white/15 focus:outline-none focus:border-[#14B8A6] transition"
          />

          {hasSpokenText && (
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => onSubmitTranscript(transcript)}
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-2xl text-white shrink-0 flex items-center justify-center active:scale-95 transition shadow-md"
              style={{ backgroundColor: THEME.accentPrimary }}
              aria-label="Senden"
            >
              <Send className="w-4 h-4" />
            </button>
          )}

          {/* Organisch pulsierender Liquid-Orb Sprachbutton */}
          <div className="relative shrink-0">
            {isListening && organicMotion && (
              <>
                <span className="absolute inset-0 rounded-2xl bg-[#14B8A6]/30 animate-ping pointer-events-none" />
                <span className="absolute -inset-1.5 rounded-2xl bg-[#0A9396]/20 animate-pulse pointer-events-none" />
              </>
            )}
            <button
              type="button"
              disabled={isProcessing}
              onClick={onManualMicToggle}
              className="relative w-11 h-11 min-w-[44px] min-h-[44px] rounded-2xl flex items-center justify-center text-white transition-transform duration-300 active:scale-90 shadow-md"
              style={{
                backgroundColor: isProcessing
                  ? '#2F363D'
                  : isListening
                  ? '#E5A93C'
                  : THEME.accentPrimary
              }}
              aria-label="Mikrofon umschalten"
            >
              {isProcessing ? (
                <Loader2 className="w-5 h-5 animate-spin text-[#14B8A6]" />
              ) : isListening ? (
                <Mic className="w-5 h-5 animate-pulse" />
              ) : (
                <MicOff className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
