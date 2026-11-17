import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  ChevronDown,
  Loader2,
  Mic,
  MicOff,
  Paperclip,
  Send,
  Trash2,
  Undo2,
  Volume2,
  VolumeX
} from 'lucide-react';
import { AiExecutedAction, AiLogEntry, Attachment, Project, THEME } from '../types';
import { getTtsEnabled, setTtsEnabled, speakText } from '../services/aiRouter';

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  engine?: string;
  logId?: string;
  actions?: AiExecutedAction[];
  attachmentName?: string;
}

interface VoiceModalProps {
  open: boolean;
  autoStartMic?: boolean;
  activeProjectName: string;
  projects?: Project[];
  aiLogs?: AiLogEntry[];
  onClose: () => void;
  onExecuteCommand: (
    rawText: string,
    attachment: Attachment | null
  ) => Promise<{
    replyText: string;
    spokenText: string;
    needsClarification: boolean;
    engine: string;
    logId?: string;
    actions: AiExecutedAction[];
  } | void>;
  onAskQuestion: (question: string, attachment: Attachment | null) => Promise<string>;
  onSaveAnswerToInfos: (question: string, answer: string, attachment: Attachment | null) => void;
  onJumpToAction?: (act: AiExecutedAction) => void;
  onUndoAiAction?: (logId: string, actionId: string) => void;
  onMoveAiAction?: (logId: string, actionId: string, newProjectId: string) => void;
}

const SILENCE_AUTO_SEND_MS = 5000;
const CHAT_STORAGE_KEY = 'nexusflow_persistent_ai_chat_v2';

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
    if (currLower === prevLower) continue;
    if (currLower.startsWith(prevLower)) {
      segments[segments.length - 1] = rawChunk;
      continue;
    }
    if (prevLower.endsWith(currLower)) continue;
    segments.push(rawChunk);
  }

  const joined = segments.join(' ').replace(/\s+/g, ' ').trim();
  const words = joined.split(' ');
  const deduped: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const prevW = deduped[deduped.length - 1];
    if (prevW && prevW.toLowerCase() === w.toLowerCase()) continue;
    if (
      deduped.length >= 2 &&
      i + 1 < words.length &&
      deduped[deduped.length - 2].toLowerCase() === w.toLowerCase() &&
      deduped[deduped.length - 1].toLowerCase() === words[i + 1].toLowerCase()
    ) {
      i++;
      continue;
    }
    deduped.push(w);
  }
  return deduped.join(' ').trim();
}

export const VoiceModal: React.FC<VoiceModalProps> = ({
  open,
  autoStartMic = true,
  activeProjectName,
  projects = [],
  onClose,
  onExecuteCommand,
  onSaveAnswerToInfos,
  onJumpToAction,
  onUndoAiAction,
  onMoveAiAction
}) => {
  const [messages, setMessages] = useState<ConversationMessage[]>(() => {
    try {
      const saved = localStorage.getItem(CHAT_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [speechNotice, setSpeechNotice] = useState('');
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [remainingMs, setRemainingMs] = useState<number>(SILENCE_AUTO_SEND_MS);
  const [ttsActive, setTtsActive] = useState<boolean>(getTtsEnabled);

  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');
  const lastSpeechTimestampRef = useRef<number>(0);
  const autoSendTriggeredRef = useRef(false);
  const isListeningRef = useRef(false);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages.slice(-40)));
    } catch {
      // ignore
    }
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

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
    autoSendTriggeredRef.current = false;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setSpeechNotice('Spracherkennung im Browser nicht verfügbar – bitte Textfeld nutzen.');
      return;
    }

    try {
      stopMicrophone();
      const rec = new SpeechRec();
      rec.lang = 'de-DE';
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

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
        setTranscript(cleanSessionText);
        transcriptRef.current = cleanSessionText;
      };

      rec.onerror = (event: any) => {
        if (event?.error === 'no-speech') return;
        setSpeechNotice(`Mikrofon-Status: ${event?.error || 'Berechtigung prüfen'}`);
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
      setSpeechNotice('Mikrofon konnte nicht gestartet werden.');
    }
  };

  useEffect(() => {
    if (open) {
      setRemainingMs(SILENCE_AUTO_SEND_MS);
      autoSendTriggeredRef.current = false;
      if (autoStartMic) {
        const timer = window.setTimeout(() => {
          startMicrophoneImmediately();
        }, 50);
        return () => {
          window.clearTimeout(timer);
          stopMicrophone();
        };
      }
    } else {
      stopMicrophone();
    }
  }, [open, autoStartMic]);

  useEffect(() => {
    if (!open || !isListening || isProcessing) return;

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
        void triggerProcess(currentText);
      }
    }, 150);

    return () => window.clearInterval(interval);
  }, [open, isListening, isProcessing]);

  const triggerProcess = async (textToProcess: string) => {
    const clean = textToProcess.trim();
    if (!clean || isProcessing) return;

    stopMicrophone();
    setIsProcessing(true);
    const currentAtt = attachment;
    setTranscript('');
    transcriptRef.current = '';
    setAttachment(null);

    const userMsg: ConversationMessage = {
      id: `msg-u-${Date.now()}`,
      role: 'user',
      text: clean,
      timestamp: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
      attachmentName: currentAtt?.name
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const result = await onExecuteCommand(clean, currentAtt);
      if (result) {
        const assistantMsg: ConversationMessage = {
          id: `msg-a-${Date.now()}`,
          role: 'assistant',
          text: result.replyText,
          timestamp: new Date().toLocaleTimeString('de-DE', {
            hour: '2-digit',
            minute: '2-digit'
          }),
          engine: result.engine,
          logId: result.logId,
          actions: result.actions
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setIsProcessing(false);

        // Sprachausgabe + bei Rückfrage Mikrofon sofort wieder öffnen!
        speakText(result.spokenText, () => {
          if (result.needsClarification && open) {
            startMicrophoneImmediately();
          }
        });
      } else {
        setIsProcessing(false);
      }
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
  const activeProjects = projects.filter((p) => !p.archived);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex flex-col justify-end">
      {/* Klick auf den abgedunkelten oberen Rand schließt die Schublade zurück zur Liste */}
      <div className="flex-1" onClick={onClose} />

      <div
        className="w-full max-w-lg mx-auto h-[84vh] rounded-t-3xl border-t border-white/15 shadow-2xl flex flex-col overflow-hidden"
        style={{ backgroundColor: THEME.bgMain }}
      >
        {/* Schubladen-Kopfzeile (Sachlich, ohne Emojis) */}
        <div
          className="px-4 py-3 border-b border-white/10 flex items-center justify-between shrink-0"
          style={{ backgroundColor: THEME.bgCard }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                isListening ? 'bg-red-500 animate-ping' : 'bg-[#14B8A6]'
              }`}
            />
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-wider text-white truncate">
                KI-Kontext &amp; Verlauf
              </div>
              <div className="text-[10px] text-[#9CA3AF] truncate">
                Kontext: {activeProjectName}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                const next = !ttsActive;
                setTtsActive(next);
                setTtsEnabled(next);
                if (!next && typeof window !== 'undefined' && 'speechSynthesis' in window) {
                  window.speechSynthesis.cancel();
                }
              }}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border flex items-center gap-1 ${
                ttsActive
                  ? 'bg-[#0A9396]/25 border-[#14B8A6] text-white'
                  : 'bg-[#181A1B] border-white/10 text-[#9CA3AF]'
              }`}
              title="Sprachausgabe umschalten"
            >
              {ttsActive ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span>{ttsActive ? 'Stimme An' : 'Stumm'}</span>
            </button>

            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setMessages([]);
                  localStorage.removeItem(CHAT_STORAGE_KEY);
                }}
                className="p-1.5 rounded-lg bg-[#181A1B] text-[#9CA3AF] hover:text-white border border-white/10"
                title="Gesprächsverlauf leeren"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                stopMicrophone();
                onClose();
              }}
              className="px-2.5 py-1.5 rounded-lg bg-[#181A1B] text-xs font-bold text-[#9CA3AF] hover:text-white border border-white/10 flex items-center gap-1"
            >
              <ChevronDown className="w-4 h-4" />
              <span>Schließen</span>
            </button>
          </div>
        </div>

        {/* Scrollbarer Gesprächs- und Zuordnungs-Verlauf */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-6 space-y-2 text-[#9CA3AF]">
              <p className="text-xs font-semibold text-white">
                Autonomer Sprach- und System-Agent bereit
              </p>
              <p className="text-[11px] leading-relaxed">
                Sprich Aufgaben, Einkäufe, Maße oder Fragen einfach frei ein. Alle Antworten und
                Zuordnungen bleiben hier im Verlauf dauerhaft abrufbar.
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[90%] rounded-2xl p-3 text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#0A9396] text-white rounded-br-sm'
                      : 'bg-[#24292E] text-[#F8F9FA] border border-white/10 rounded-bl-sm'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 mb-1 text-[10px] opacity-70">
                    <span>{msg.role === 'user' ? 'Eingabe' : msg.engine || 'System-Agent'}</span>
                    <span>{msg.timestamp}</span>
                  </div>
                  <p className="whitespace-pre-wrap">{msg.text}</p>

                  {/* Integrierte Zuordnungs-Karten (Ersetzt das unübersichtliche Protokoll) */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="mt-2.5 pt-2.5 border-t border-white/10 space-y-1.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#14B8A6]">
                        Zugeordnete Einträge ({msg.actions.length}):
                      </div>
                      {msg.actions.map((act) => (
                        <div
                          key={act.actionId}
                          className={`p-2 rounded-xl bg-[#181A1B] border border-white/10 space-y-1.5 ${
                            act.undone ? 'opacity-40' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (onJumpToAction) {
                                  onJumpToAction(act);
                                  onClose();
                                }
                              }}
                              className="text-xs font-bold text-[#14B8A6] hover:underline text-left flex items-center gap-1 truncate"
                            >
                              <span className="truncate">{act.shortCheckableTitle}</span>
                              <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                            </button>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-[#9CA3AF] shrink-0">
                              {act.targetProjectName} / {act.targetSubTab}
                            </span>
                          </div>

                          {!act.undone && msg.logId && (
                            <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
                              {onMoveAiAction && activeProjects.length > 0 && (
                                <select
                                  value={act.targetProjectId}
                                  onChange={(e) =>
                                    onMoveAiAction(msg.logId!, act.actionId, e.target.value)
                                  }
                                  className="px-2 py-1 rounded text-[10px] bg-[#24292E] text-white border border-white/10 flex-1"
                                >
                                  {activeProjects.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name}
                                    </option>
                                  ))}
                                </select>
                              )}
                              {onUndoAiAction && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onUndoAiAction(msg.logId!, act.actionId);
                                    setMessages((prev) =>
                                      prev.map((m) =>
                                        m.id !== msg.id
                                          ? m
                                          : {
                                              ...m,
                                              actions: m.actions?.map((a) =>
                                                a.actionId === act.actionId
                                                  ? { ...a, undone: true }
                                                  : a
                                              )
                                            }
                                      )
                                    );
                                  }}
                                  className="px-2 py-1 rounded text-[10px] bg-red-500/15 text-red-300 border border-red-500/30 flex items-center gap-1"
                                >
                                  <Undo2 className="w-3 h-3" />
                                  <span>Rückgängig</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {msg.role === 'assistant' && (!msg.actions || msg.actions.length === 0) && (
                    <div className="mt-2 pt-1.5 border-t border-white/10 flex justify-end">
                      <button
                        type="button"
                        onClick={() => onSaveAnswerToInfos('KI-Notiz', msg.text, null)}
                        className="text-[10px] font-semibold text-[#14B8A6] hover:underline"
                      >
                        Als Projekt-Info speichern
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={scrollEndRef} />
        </div>

        {/* Untere direkte Sprach- & Text-Steuerung ohne Zwischenschritte */}
        <div
          className="p-3.5 border-t border-white/10 space-y-2.5 shrink-0"
          style={{ backgroundColor: THEME.bgCard }}
        >
          {isListening && hasSpokenText && !isProcessing && (
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-[#9CA3AF]">
                <span>Automatischer Versand nach Sprechpause</span>
                <span className="font-mono text-[#14B8A6]">{countdownSeconds}s</span>
              </div>
              <div className="w-full h-1 bg-[#181A1B] rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-150 rounded-full"
                  style={{
                    width: `${progressPercent}%`,
                    backgroundColor: remainingMs < 1800 ? '#F59E0B' : '#14B8A6'
                  }}
                />
              </div>
            </div>
          )}

          {speechNotice && (
            <div className="text-[11px] text-amber-300 px-2">{speechNotice}</div>
          )}

          <div className="flex items-center gap-2">
            <label
              className="p-2.5 rounded-xl bg-[#181A1B] border border-white/10 text-[#9CA3AF] hover:text-white cursor-pointer shrink-0"
              title="Foto oder Dokument anhängen"
            >
              <Paperclip className="w-4 h-4" />
              <input type="file" className="hidden" onChange={handleFileUpload} />
            </label>

            <input
              type="text"
              value={transcript}
              onChange={(e) => {
                setTranscript(e.target.value);
                transcriptRef.current = e.target.value;
                lastSpeechTimestampRef.current = Date.now();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && transcript.trim()) {
                  autoSendTriggeredRef.current = true;
                  void triggerProcess(transcript);
                }
              }}
              placeholder={
                isListening
                  ? 'Mikrofon aktiv – einfach sprechen...'
                  : 'Sprechen oder direkt tippen...'
              }
              className="flex-1 px-3.5 py-2.5 rounded-xl text-xs bg-[#181A1B] text-white border border-white/15 focus:outline-none focus:border-[#14B8A6]"
            />

            {hasSpokenText && (
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => {
                  autoSendTriggeredRef.current = true;
                  void triggerProcess(transcript);
                }}
                className="p-2.5 rounded-xl text-white shrink-0"
                style={{ backgroundColor: THEME.accentPrimary }}
                title="Sofort absenden"
              >
                <Send className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              disabled={isProcessing}
              onClick={() => {
                if (isListening && hasSpokenText) {
                  autoSendTriggeredRef.current = true;
                  void triggerProcess(transcript);
                } else if (isListening) {
                  stopMicrophone();
                } else {
                  startMicrophoneImmediately();
                }
              }}
              className={`w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0 transition ${
                isListening ? 'ring-4 ring-red-500/30' : ''
              }`}
              style={{
                backgroundColor: isProcessing
                  ? '#2F363D'
                  : isListening
                  ? '#EF4444'
                  : THEME.accentPrimary
              }}
              title={isListening ? 'Aufnahme läuft (Tippen zum Senden/Stoppen)' : 'Mikrofon starten'}
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
    </div>
  );
};
