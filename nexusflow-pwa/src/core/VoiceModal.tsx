import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Keyboard, Loader2, Mic, MicOff, Send, Sparkles, Upload, X } from 'lucide-react';
import { Attachment, THEME } from '../types';

interface VoiceModalProps {
  open: boolean;
  activeProjectName: string;
  onClose: () => void;
  onExecuteCommand: (rawText: string, attachment: Attachment | null) => Promise<void>;
  onAskQuestion: (question: string, attachment: Attachment | null) => Promise<string>;
  onSaveAnswerToInfos: (question: string, answer: string, attachment: Attachment | null) => void;
}

const SILENCE_AUTO_SEND_MS = 5500;

function buildCleanTranscriptFromResults(results: any): string {
  const segments: string[] = [];

  for (let i = 0; i < results.length; i++) {
    const rawChunk = String(results[i]?.[0]?.transcript || '').trim();
    if (!rawChunk) continue;

    if (segments.length === 0) {
      segments.push(rawChunk);
      continue;
    }

    const prev = segments[segments.length - 1];
    const prevLower = prev.toLowerCase();
    const currLower = rawChunk.toLowerCase();

    if (currLower === prevLower) {
      continue;
    }
    if (currLower.startsWith(prevLower)) {
      segments[segments.length - 1] = rawChunk;
      continue;
    }
    if (prevLower.endsWith(currLower)) {
      continue;
    }

    segments.push(rawChunk);
  }

  const joined = segments.join(' ').replace(/\s+/g, ' ').trim();

  const words = joined.split(' ');
  const dedupedWords: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const prevW = dedupedWords[dedupedWords.length - 1];
    if (prevW && prevW.toLowerCase() === w.toLowerCase()) {
      continue;
    }
    if (
      dedupedWords.length >= 2 &&
      i + 1 < words.length &&
      dedupedWords[dedupedWords.length - 2].toLowerCase() === w.toLowerCase() &&
      dedupedWords[dedupedWords.length - 1].toLowerCase() === words[i + 1].toLowerCase()
    ) {
      i++;
      continue;
    }
    dedupedWords.push(w);
  }

  return dedupedWords.join(' ').trim();
}

export const VoiceModal: React.FC<VoiceModalProps> = ({
  open,
  activeProjectName,
  onClose,
  onExecuteCommand,
  onAskQuestion,
  onSaveAnswerToInfos
}) => {
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [speechNotice, setSpeechNotice] = useState('');
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [qaReply, setQaReply] = useState('');
  const [showKeyboardEdit, setShowKeyboardEdit] = useState(false);
  const [remainingMs, setRemainingMs] = useState<number>(SILENCE_AUTO_SEND_MS);

  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');
  const manualPrefixRef = useRef('');
  const lastSpeechTimestampRef = useRef<number>(0);
  const autoSendTriggeredRef = useRef(false);
  const isListeningRef = useRef(false);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  const stopMicrophone = () => {
    isListeningRef.current = false;
    setIsListening(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
  };

  const startMicrophoneImmediately = () => {
    setSpeechNotice('');
    setQaReply('');
    autoSendTriggeredRef.current = false;

    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRec) {
      setSpeechNotice(
        'Browser-Spracherkennung nicht verfügbar – bitte nutze das Textfeld unten.'
      );
      setShowKeyboardEdit(true);
      return;
    }

    try {
      stopMicrophone();
      const rec = new SpeechRec();
      rec.lang = 'de-DE';
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      manualPrefixRef.current = transcriptRef.current.trim();
      lastSpeechTimestampRef.current = Date.now();
      setRemainingMs(SILENCE_AUTO_SEND_MS);

      rec.onstart = () => {
        isListeningRef.current = true;
        setIsListening(true);
        lastSpeechTimestampRef.current = Date.now();
      };

      rec.onresult = (event: any) => {
        lastSpeechTimestampRef.current = Date.now();
        setRemainingMs(SILENCE_AUTO_SEND_MS);

        const cleanSessionText = buildCleanTranscriptFromResults(event.results);
        const combined = [manualPrefixRef.current, cleanSessionText]
          .filter(Boolean)
          .join(' ')
          .trim();

        setTranscript(combined);
        transcriptRef.current = combined;
      };

      rec.onerror = (event: any) => {
        if (event?.error === 'no-speech') {
          return;
        }
        setSpeechNotice(`Mikrofon-Hinweis: ${event?.error || 'Bitte Berechtigung prüfen'}`);
        isListeningRef.current = false;
        setIsListening(false);
      };

      rec.onend = () => {
        if (isListeningRef.current && !autoSendTriggeredRef.current) {
          isListeningRef.current = false;
          setIsListening(false);
        }
      };

      recognitionRef.current = rec;
      rec.start();
    } catch {
      setSpeechNotice('Mikrofon konnte nicht automatisch gestartet werden.');
      setShowKeyboardEdit(true);
    }
  };

  useEffect(() => {
    if (open) {
      setTranscript('');
      transcriptRef.current = '';
      manualPrefixRef.current = '';
      setAttachment(null);
      setQaReply('');
      setShowKeyboardEdit(false);
      setRemainingMs(SILENCE_AUTO_SEND_MS);
      autoSendTriggeredRef.current = false;

      const startTimer = window.setTimeout(() => {
        startMicrophoneImmediately();
      }, 60);

      return () => {
        window.clearTimeout(startTimer);
        stopMicrophone();
      };
    } else {
      stopMicrophone();
    }
  }, [open]);

  useEffect(() => {
    if (!open || isProcessing || showKeyboardEdit || qaReply) return;

    const interval = window.setInterval(() => {
      const currentText = transcriptRef.current.trim();
      if (!currentText) {
        lastSpeechTimestampRef.current = Date.now();
        setRemainingMs(SILENCE_AUTO_SEND_MS);
        return;
      }

      const elapsed = Date.now() - lastSpeechTimestampRef.current;
      const left = Math.max(0, SILENCE_AUTO_SEND_MS - elapsed);
      setRemainingMs(left);

      if (left === 0 && !autoSendTriggeredRef.current) {
        autoSendTriggeredRef.current = true;
        stopMicrophone();
        void triggerAutoProcess(currentText);
      }
    }, 150);

    return () => window.clearInterval(interval);
  }, [open, isProcessing, showKeyboardEdit, qaReply]);

  const triggerAutoProcess = async (textToProcess: string) => {
    const clean = textToProcess.trim();
    if (!clean || isProcessing) return;

    stopMicrophone();
    setIsProcessing(true);

    try {
      const looksLikePureQuestion =
        (clean.endsWith('?') ||
          /^(wie\s+viel|welches\s+maß|welche\s+maße|wie\s+hoch|wie\s+breit|wie\s+tief|was\s+steht\s+unter|erkläre\s+mir|was\s+ist\s+auf\s+dem\s+foto)/i.test(
            clean
          )) &&
        !/(packe|notiere|ergänze|erstelle|kaufe|in\s+den\s+einkaufswagen|auf\s+die\s+liste|merke)/i.test(
          clean
        );

      if (looksLikePureQuestion) {
        const answer = await onAskQuestion(clean, attachment);
        setQaReply(answer);
        setIsProcessing(false);
        return;
      }

      await onExecuteCommand(clean, attachment);
      setTranscript('');
      transcriptRef.current = '';
      setAttachment(null);
      setIsProcessing(false);
      onClose();
    } catch {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    lastSpeechTimestampRef.current = Date.now();
    const sizeKB = `${Math.max(1, Math.round(file.size / 1024))} KB`;
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const reader = new FileReader();
    reader.onload = (ev) => {
      setAttachment({
        id: `att-${Date.now()}`,
        name: file.name,
        type: isImage ? 'image' : isPdf ? 'pdf' : 'text',
        mimeType: file.type || 'application/octet-stream',
        size: sizeKB,
        dataUrl: String(ev.target?.result || ''),
        textContent: null
      });
      lastSpeechTimestampRef.current = Date.now();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  if (!open) return null;

  const hasSpokenText = transcript.trim().length > 0;
  const countdownSeconds = (remainingMs / 1000).toFixed(1);
  const progressPercent = Math.min(100, Math.max(0, (remainingMs / SILENCE_AUTO_SEND_MS) * 100));

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4">
      <div
        className="w-full max-w-md rounded-3xl border border-white/15 shadow-2xl overflow-hidden transition-all"
        style={{ backgroundColor: THEME.bgCard }}
      >
        <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isListening ? 'bg-red-500 animate-ping' : 'bg-[#14B8A6]'
              }`}
            />
            <span className="text-xs font-bold uppercase tracking-wider text-[#14B8A6]">
              {isProcessing
                ? 'KI sortiert automatisch ein…'
                : isListening
                ? 'Mikrofon aktiv – Sprich einfach los'
                : 'Sprach-Assistent bereit'}
            </span>
          </div>
          <button
            onClick={() => {
              stopMicrophone();
              onClose();
            }}
            className="p-1.5 rounded-full text-[#9CA3AF] hover:text-white hover:bg-white/10"
            title="Abbrechen"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex flex-col items-center justify-center py-2">
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => {
                if (hasSpokenText && !showKeyboardEdit) {
                  autoSendTriggeredRef.current = true;
                  void triggerAutoProcess(transcript);
                } else if (isListening) {
                  stopMicrophone();
                } else {
                  startMicrophoneImmediately();
                }
              }}
              className={`relative w-20 h-20 rounded-full flex items-center justify-center text-white shadow-2xl transition-transform active:scale-95 ${
                isListening ? 'ring-8 ring-[#14B8A6]/25' : ''
              }`}
              style={{
                backgroundColor: isProcessing
                  ? '#2F363D'
                  : isListening
                  ? '#EF4444'
                  : THEME.accentPrimary
              }}
            >
              {isProcessing ? (
                <Loader2 className="w-9 h-9 animate-spin text-[#14B8A6]" />
              ) : isListening ? (
                <Mic className="w-9 h-9 animate-pulse" />
              ) : (
                <MicOff className="w-8 h-8" />
              )}
            </button>

            <p className="mt-2.5 text-xs text-center text-[#9CA3AF]">
              {isProcessing
                ? 'Erkenne Arbeit/Privat, Projekt & Reiter…'
                : hasSpokenText && !showKeyboardEdit
                ? `Auto-Sortierung in ${countdownSeconds}s Pause (oder Button antippen für Sofort-Start)`
                : 'Ich höre zu… (5,5 Sek. Nachdenk-Puffer bei Sprechpausen)'}
            </p>

            {hasSpokenText && !showKeyboardEdit && !isProcessing && !qaReply && (
              <div className="w-full max-w-xs h-1.5 bg-[#181A1B] rounded-full overflow-hidden mt-2 border border-white/10">
                <div
                  className="h-full transition-all duration-150 rounded-full"
                  style={{
                    width: `${progressPercent}%`,
                    backgroundColor: remainingMs < 2000 ? '#F59E0B' : '#14B8A6'
                  }}
                />
              </div>
            )}
          </div>

          {speechNotice && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 text-center">
              {speechNotice}
            </div>
          )}

          <div className="rounded-2xl bg-[#181A1B] border border-white/15 p-3.5">
            {showKeyboardEdit ? (
              <textarea
                rows={3}
                autoFocus
                value={transcript}
                onChange={(e) => {
                  setTranscript(e.target.value);
                  transcriptRef.current = e.target.value;
                  lastSpeechTimestampRef.current = Date.now();
                }}
                placeholder="Hier Text korrigieren oder direkt eintippen…"
                className="w-full bg-transparent text-sm text-white focus:outline-none resize-none"
              />
            ) : (
              <div className="min-h-[56px] flex items-center justify-center text-center">
                {transcript ? (
                  <p className="text-sm text-white font-medium leading-relaxed">„{transcript}“</p>
                ) : (
                  <p className="text-xs text-[#9CA3AF]/60 italic">
                    Sag z. B.: „Ich brauche noch Spiegelschrauben für das Waschbecken“ oder
                    „Auf der Baustelle Bäckerei morgen Lüftungsrohre ausmessen“…
                  </p>
                )}
              </div>
            )}
          </div>

          {qaReply && (
            <div className="p-3.5 rounded-2xl bg-[#181A1B] border border-[#14B8A6] space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#14B8A6]">
                <Sparkles className="w-4 h-4" />
                KI-Antwort:
              </div>
              <p className="text-xs text-white whitespace-pre-wrap leading-relaxed">{qaReply}</p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onSaveAnswerToInfos(transcript, qaReply, attachment);
                    onClose();
                  }}
                  className="flex-1 py-2 px-3 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5"
                  style={{ backgroundColor: THEME.accentPrimary }}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Unter „{activeProjectName} – Infos“ sichern
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="py-2 px-3 rounded-xl text-xs text-[#9CA3AF] bg-white/5 hover:text-white"
                >
                  Fertig
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5">
              <label className="cursor-pointer px-2.5 py-1.5 rounded-xl bg-[#181A1B] border border-white/10 text-[11px] text-[#9CA3AF] hover:text-white flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-[#14B8A6]" />
                {attachment ? 'Foto/Datei ✓' : 'Foto dazu'}
                <input type="file" className="hidden" onChange={handleFileUpload} />
              </label>

              <button
                type="button"
                onClick={() => {
                  stopMicrophone();
                  setShowKeyboardEdit((prev) => !prev);
                }}
                className={`px-2.5 py-1.5 rounded-xl border text-[11px] flex items-center gap-1.5 ${
                  showKeyboardEdit
                    ? 'bg-[#14B8A6]/20 border-[#14B8A6] text-white'
                    : 'bg-[#181A1B] border-white/10 text-[#9CA3AF] hover:text-white'
                }`}
                title="Timer anhalten & Text per Tastatur bearbeiten"
              >
                <Keyboard className="w-3.5 h-3.5" />
                {showKeyboardEdit ? 'Tastatur aktiv' : 'Tippen / Pause'}
              </button>
            </div>

            <button
              type="button"
              disabled={!hasSpokenText || isProcessing}
              onClick={() => {
                autoSendTriggeredRef.current = true;
                void triggerAutoProcess(transcript);
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 disabled:opacity-40 shadow-lg"
              style={{ backgroundColor: THEME.accentPrimary }}
            >
              <Send className="w-3.5 h-3.5" />
              Sofort einsortieren
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
