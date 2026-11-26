import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Mic,
  Send,
  Square,
  Trash2,
  WifiOff
} from 'lucide-react';
import { OfflineAudioMemo } from '../../types';
import { DESIGN_TOKENS } from '../../config/designTokens';
import {
  ActiveAudioRecorderSession,
  OFFLINE_AUDIO_MAX_DURATION_SEC,
  OfflineRecordingResult,
  processOfflineAudioMemo,
  startOfflineAudioRecording
} from '../../services/offlineAudioQueue';
import { formatNow, loadOfflineAudioMemosAsync } from '../../services/storage';
import { triggerHapticFeedback } from '../../services/aiRouter';

export interface OfflineAudioBufferBarProps {
  enabled: boolean;
  activeProjectId: string;
  userApiKey?: string;
  memos: OfflineAudioMemo[];
  onSaveMemos: (memos: OfflineAudioMemo[]) => void;
  onSubmitTranscript: (text: string) => void;
  onNotify?: (msg: string) => void;
  compact?: boolean;
  className?: string;
}

function formatTimerMmSs(totalSec: number): string {
  const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const s = String(totalSec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export const OfflineAudioBufferBar: React.FC<OfflineAudioBufferBarProps> = ({
  enabled,
  activeProjectId,
  userApiKey = '',
  memos,
  onSaveMemos,
  onSubmitTranscript,
  onNotify,
  compact = false,
  className = ''
}) => {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine !== false
  );
  const [listOpen, setListOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [noteInput, setNoteInput] = useState('');
  const [inlineNotice, setInlineNotice] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const recorderRef = useRef<ActiveAudioRecorderSession | null>(null);
  const memosRef = useRef<OfflineAudioMemo[]>(memos);
  memosRef.current = memos;

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void loadOfflineAudioMemosAsync().then((loaded) => {
      if (!cancelled && loaded.length !== memosRef.current.length) {
        onSaveMemos(loaded);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  useEffect(() => {
    return () => {
      if (recorderRef.current) {
        void recorderRef.current.stop();
        recorderRef.current = null;
      }
    };
  }, []);

  if (!enabled) return null;
  if (isOnline && memos.length === 0 && !isRecording) return null;

  const persistRecordedResult = (res: OfflineRecordingResult) => {
    setIsRecording(false);
    setElapsedSec(0);
    recorderRef.current = null;
    if (!res.ok || !res.audioDataUrl) {
      setInlineNotice(res.error || 'Aufnahme nicht gespeichert.');
      return;
    }

    const newMemo: OfflineAudioMemo = {
      id: `memo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      projectId: activeProjectId,
      createdAt: formatNow(),
      durationSec: res.durationSec,
      mimeType: res.mimeType,
      audioDataUrl: res.audioDataUrl,
      status: 'queued'
    };
    onSaveMemos([newMemo, ...memosRef.current]);
    setListOpen(true);
    setInlineNotice('Funkloch-Memo sicher lokal gepuffert.');
    onNotify?.('Funkloch-Memo im Offline-Puffer gespeichert.');
  };

  const handleToggleRecording = async () => {
    triggerHapticFeedback(14);
    setInlineNotice(null);

    if (isRecording && recorderRef.current) {
      const session = recorderRef.current;
      recorderRef.current = null;
      const res = await session.stop();
      persistRecordedResult(res);
      return;
    }

    const started = await startOfflineAudioRecording(
      (sec) => setElapsedSec(sec),
      (autoRes) => persistRecordedResult(autoRes)
    );

    if (!started.ok || !started.session) {
      setInlineNotice(
        started.error || 'Audio-Aufnahme nicht verfügbar – nutze die Funkloch-Notiz.'
      );
      return;
    }

    recorderRef.current = started.session;
    setElapsedSec(0);
    setIsRecording(true);
  };

  const handleSaveOfflineNote = () => {
    const clean = noteInput.trim();
    if (!clean) return;
    triggerHapticFeedback(12);
    const newMemo: OfflineAudioMemo = {
      id: `memo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      projectId: activeProjectId,
      createdAt: formatNow(),
      durationSec: 0,
      mimeType: 'text/plain',
      noteText: clean,
      status: 'queued'
    };
    onSaveMemos([newMemo, ...memos]);
    setNoteInput('');
    setListOpen(true);
    setInlineNotice('Funkloch-Notiz sicher gepuffert.');
  };

  const handleProcessMemo = async (memo: OfflineAudioMemo) => {
    if (!isOnline) {
      setInlineNotice('Noch offline – Auswertung startet, sobald wieder Netz da ist.');
      return;
    }
    triggerHapticFeedback(14);
    setProcessingId(memo.id);
    setInlineNotice(null);

    const markedProcessing = memos.map((m) =>
      m.id === memo.id ? { ...m, status: 'processing' as const, errorMessage: undefined } : m
    );
    onSaveMemos(markedProcessing);

    const res = await processOfflineAudioMemo(memo, userApiKey);
    setProcessingId(null);

    if (res.ok && res.transcript) {
      const remaining = memosRef.current.filter((m) => m.id !== memo.id);
      onSaveMemos(remaining);
      onSubmitTranscript(res.transcript);
      onNotify?.('Funkloch-Memo übergeben ✓');
      return;
    }

    const markedError = memosRef.current.map((m) =>
      m.id === memo.id
        ? {
            ...m,
            status: 'error' as const,
            errorMessage: res.error || 'Auswertung fehlgeschlagen.'
          }
        : m
    );
    onSaveMemos(markedError);
    setInlineNotice(res.error || 'Auswertung derzeit nicht möglich.');
  };

  const handleDeleteMemo = (memoId: string) => {
    triggerHapticFeedback(10);
    onSaveMemos(memos.filter((m) => m.id !== memoId));
  };

  return (
    <div
      data-testid="offline-audio-buffer-bar"
      className={`rounded-2xl border p-3 space-y-2.5 ${className}`.trim()}
      style={{
        backgroundColor: DESIGN_TOKENS.surface,
        borderColor: 'rgba(229,169,60,0.4)'
      }}
    >
      {/* Funkloch-Kopfzeile & Aufnahme bei Offline-Zustand */}
      {!isOnline && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <WifiOff className="w-4 h-4 text-[#E5A93C] shrink-0" />
              <span className="text-xs font-bold text-[#E5A93C]">
                Funkloch erkannt – lokal puffern
              </span>
            </div>
            {isRecording && (
              <span className="text-xs font-mono font-bold text-[#E5A93C]">
                {formatTimerMmSs(elapsedSec)} / {formatTimerMmSs(OFFLINE_AUDIO_MAX_DURATION_SEC)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              data-testid="btn-record-offline-memo"
              onClick={handleToggleRecording}
              className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition cursor-pointer shrink-0"
              style={{
                backgroundColor: isRecording ? '#111317' : DESIGN_TOKENS.accentHoney,
                color: isRecording ? DESIGN_TOKENS.accentHoney : '#111317',
                border: isRecording ? '1px solid rgba(229,169,60,0.6)' : 'none'
              }}
            >
              {isRecording ? (
                <>
                  <Square className="w-4 h-4 shrink-0" />
                  <span>Aufnahme stoppen</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 shrink-0" />
                  <span>Funkloch-Memo aufnehmen</span>
                </>
              )}
            </button>
          </div>

          {!compact && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                data-testid="input-offline-memo-note"
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && noteInput.trim()) {
                    e.preventDefault();
                    handleSaveOfflineNote();
                  }
                }}
                placeholder="Oder kurze Funkloch-Notiz puffern..."
                className="flex-1 min-w-0 min-h-[44px] px-3 py-2 rounded-xl text-xs bg-[#111317] text-[#F1F5F9] border border-white/10 focus:outline-none focus:border-[#E5A93C]"
              />
              <button
                type="button"
                data-testid="btn-save-offline-note"
                disabled={!noteInput.trim()}
                onClick={handleSaveOfflineNote}
                className="min-h-[44px] min-w-[44px] px-3 py-2 rounded-xl text-xs font-bold text-[#111317] disabled:opacity-40 active:scale-95 transition cursor-pointer shrink-0"
                style={{ backgroundColor: DESIGN_TOKENS.accentHoney }}
                aria-label="Offline-Notiz puffern"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {inlineNotice && (
        <div className="text-xs text-[#E5A93C] leading-snug">{inlineNotice}</div>
      )}

      {/* Aufklappbare Liste gepufferter Memos */}
      {memos.length > 0 && (
        <div className="space-y-2">
          <button
            type="button"
            data-testid="offline-buffer-toggle"
            aria-expanded={listOpen}
            onClick={() => {
              triggerHapticFeedback(10);
              setListOpen((o) => !o);
            }}
            className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-[#111317] border border-white/10 flex items-center justify-between gap-2 text-left cursor-pointer active:bg-white/5 transition"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span
                data-testid="offline-buffer-count"
                className="text-xs font-mono font-bold px-2 py-0.5 rounded-md"
                style={{
                  backgroundColor: 'rgba(229,169,60,0.18)',
                  color: DESIGN_TOKENS.accentHoney
                }}
              >
                {memos.length} {memos.length === 1 ? 'gepuffertes Memo' : 'gepufferte Memos'}
              </span>
              <span className="text-xs text-[#94A3B8] truncate">
                {isOnline ? 'Bereit zur Übergabe' : 'Wartet auf Netz'}
              </span>
            </div>
            {listOpen ? (
              <ChevronUp className="w-4 h-4 text-[#94A3B8] shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[#94A3B8] shrink-0" />
            )}
          </button>

          {listOpen && (
            <div data-testid="offline-buffer-list" className="space-y-2">
              {memos.map((memo) => {
                const isBusy = processingId === memo.id || memo.status === 'processing';
                return (
                  <div
                    key={memo.id}
                    data-testid={`offline-memo-${memo.id}`}
                    className="p-3 rounded-xl bg-[#111317] border border-white/10 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-mono text-[#94A3B8]">
                        {memo.createdAt}
                        {memo.durationSec > 0 ? ` · ${formatTimerMmSs(memo.durationSec)}` : ''}
                      </span>
                      <span
                        className="text-xs font-mono px-2 py-0.5 rounded"
                        style={{
                          backgroundColor: 'rgba(229,169,60,0.15)',
                          color: DESIGN_TOKENS.accentHoney
                        }}
                      >
                        {isBusy ? 'Auswertung…' : memo.status === 'error' ? 'Hinweis' : 'Gepuffert'}
                      </span>
                    </div>

                    {memo.noteText && (
                      <p className="text-xs text-[#F1F5F9] break-words leading-snug">
                        {memo.noteText}
                      </p>
                    )}

                    {memo.audioDataUrl && (
                      <audio controls src={memo.audioDataUrl} className="w-full h-9" />
                    )}

                    {memo.errorMessage && (
                      <div className="text-xs text-[#E5A93C] leading-snug">
                        {memo.errorMessage}
                      </div>
                    )}

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        data-testid={`btn-process-offline-memo-${memo.id}`}
                        disabled={!isOnline || isBusy}
                        onClick={() => handleProcessMemo(memo)}
                        className="flex-1 min-w-0 min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold text-[#111317] flex items-center justify-center gap-1.5 disabled:opacity-40 active:scale-95 transition cursor-pointer"
                        style={{ backgroundColor: DESIGN_TOKENS.accentHoney }}
                      >
                        {isBusy ? (
                          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                        ) : (
                          <Send className="w-4 h-4 shrink-0" />
                        )}
                        <span className="break-words">Jetzt auswerten &amp; übergeben</span>
                      </button>

                      <button
                        type="button"
                        data-testid={`btn-delete-offline-memo-${memo.id}`}
                        onClick={() => handleDeleteMemo(memo.id)}
                        className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold text-[#94A3B8] hover:text-[#F1F5F9] bg-[#191C22] border border-white/10 flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-4 h-4 shrink-0" />
                        <span>Löschen</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
