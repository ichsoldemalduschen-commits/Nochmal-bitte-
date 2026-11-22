import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Brain,
  Check,
  Keyboard,
  LayoutGrid,
  Loader2,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  Paperclip,
  Send,
  Trash2,
  Undo2,
  Volume2,
  VolumeX,
  X,
  Zap
} from 'lucide-react';
import { AiExecutedAction, AiLogEntry, Attachment, Project, THEME } from '../types';
import {
  compressImageFile,
  getTtsEnabled,
  loadUserPrefs,
  setTtsEnabled,
  speakText,
  stopSpeaking,
  triggerHapticFeedback
} from '../services/aiRouter';
import { STORAGE_KEYS, getActiveAiMode, getIdbItemSync, saveActiveAiMode, saveIdbItem } from '../services/storage';

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

export interface VoiceModalProps {
  open: boolean;
  stage?: 1 | 2;
  autoStartMic?: boolean;
  activeProjectName: string;
  projects?: Project[];
  aiLogs?: AiLogEntry[];
  themeColors?: {
    primary: string;
    highlight: string;
    glow: string;
  };
  onClose: () => void;
  onStageChange?: (newStage: 1 | 2 | 0) => void;
  onOpenQuickFan?: () => void;
  onExecuteCommand: (
    rawText: string,
    attachment: Attachment | null,
    requestedMode?: 'flash' | 'research',
    chatHistory?: Array<{ role: 'user' | 'assistant'; text: string }>
  ) => Promise<{
    replyText: string;
    spokenText: string;
    needsClarification: boolean;
    engine: string;
    logId?: string;
    actions: AiExecutedAction[];
    autoUpscaledToPro?: boolean;
  } | void>;
  onAskQuestion: (question: string, attachment: Attachment | null) => Promise<string>;
  onSaveAnswerToInfos: (question: string, answer: string, attachment: Attachment | null) => void;
  onJumpToAction?: (act: AiExecutedAction) => void;
  onUndoAiAction?: (logId: string, actionId: string) => void;
  onMoveAiAction?: (logId: string, actionId: string, newProjectId: string) => void;
}

const SILENCE_AUTO_SEND_MS = 5000;

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
  stage = 1,
  autoStartMic = true,
  activeProjectName,
  projects = [],
  themeColors,
  onClose,
  onStageChange,
  onOpenQuickFan,
  onExecuteCommand,
  onSaveAnswerToInfos,
  onJumpToAction,
  onUndoAiAction,
  onMoveAiAction
}) => {
  const [messages, setMessages] = useState<ConversationMessage[]>(() => {
    return getIdbItemSync<ConversationMessage[]>(STORAGE_KEYS.AI_CHAT, []);
  });
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechNotice, setSpeechNotice] = useState('');
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [remainingMs, setRemainingMs] = useState<number>(SILENCE_AUTO_SEND_MS);
  const [ttsActive, setTtsActive] = useState<boolean>(getTtsEnabled);
  const [aiMode, setAiMode] = useState<'flash' | 'research'>(() => getActiveAiMode());
  const [upscaleNotice, setUpscaleNotice] = useState<string | null>(null);

  // 3-Stufen-Morphing: Stufe 1 (Kompakter Begleiter) vs. Stufe 2 (Volles Gespräch)
  const [currentStage, setCurrentStage] = useState<1 | 2>(stage);
  const [showStage1TextInput, setShowStage1TextInput] = useState(false);

  useEffect(() => {
    if (stage) setCurrentStage(stage);
  }, [stage]);

  const updateStage = (newStage: 1 | 2 | 0) => {
    if (newStage === 0) {
      stopSpeaking();
      setIsSpeaking(false);
      stopMicrophone();
      onClose();
      onStageChange?.(0);
    } else {
      setCurrentStage(newStage);
      onStageChange?.(newStage);
    }
  };

  const prefs = loadUserPrefs();
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');
  const lastSpeechTimestampRef = useRef<number>(0);
  const autoSendTriggeredRef = useRef(false);
  const isListeningRef = useRef(false);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);
  const headerTouchYRef = useRef<number | null>(null);
  const stage1TouchYRef = useRef<number | null>(null);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    saveIdbItem(STORAGE_KEYS.AI_CHAT, messages.slice(-40));
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
    stopSpeaking();
    setIsSpeaking(false);

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
        triggerHapticFeedback(10);
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
      stopSpeaking();
      setIsSpeaking(false);
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

  const isSendingRef = useRef(false);

  const triggerProcess = async (textToProcess: string) => {
    const clean = textToProcess.trim();
    if (!clean || isProcessing || isSendingRef.current) return;
    isSendingRef.current = true;
    autoSendTriggeredRef.current = true;

    stopMicrophone();
    setIsProcessing(true);
    triggerHapticFeedback([12, 30, 12]);
    const currentAtt = attachment;
    setTranscript('');
    transcriptRef.current = '';
    setAttachment(null);
    setShowStage1TextInput(false);

    const userMsg: ConversationMessage = {
      id: `msg-u-${Date.now()}`,
      role: 'user',
      text: clean,
      timestamp: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
      attachmentName: currentAtt?.name
    };

    const recentHistory = messages.slice(-10).map((m) => ({
      role: m.role,
      text: m.text
    }));

    setMessages((prev) => [...prev, userMsg]);

    try {
      const result = await onExecuteCommand(clean, currentAtt, aiMode, recentHistory);
      if (result) {
        if (result.autoUpscaledToPro) {
          setUpscaleNotice('Sprech → Research (Automatisch für Foto/Analyse auf Pro geschaltet)');
          window.setTimeout(() => setUpscaleNotice(null), 4000);
        }

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

        // Smart Auto-Expand von Stufe 1 nach Stufe 2 bei Klärungsbedarf oder langer Antwort (>120 Zeichen)
        if (currentStage === 1 && (result.needsClarification || result.replyText.length > 120)) {
          updateStage(2);
        }

        setIsSpeaking(true);
        speakText(result.spokenText, () => {
          setIsSpeaking(false);
          if (result.needsClarification && open) {
            startMicrophoneImmediately();
          }
        });
      }
    } catch (err) {
      console.warn('[VoiceModal] Fehler bei Sprachausführung:', err);
    } finally {
      setIsProcessing(false);
      isSendingRef.current = false;
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    lastSpeechTimestampRef.current = Date.now();
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const { dataUrl, sizeKB } = await compressImageFile(file);
    setAttachment({
      id: `att-${Date.now()}`,
      name: file.name,
      type: isImage ? 'image' : isPdf ? 'pdf' : 'text',
      mimeType: isImage ? 'image/jpeg' : file.type || 'application/octet-stream',
      size: sizeKB,
      dataUrl,
      textContent: null
    });
    lastSpeechTimestampRef.current = Date.now();
    e.target.value = '';
  };

  if (!open) return null;

  const hasSpokenText = transcript.trim().length > 0;
  const countdownSeconds = (remainingMs / 1000).toFixed(1);
  const progressPercent = Math.min(100, Math.max(0, (remainingMs / SILENCE_AUTO_SEND_MS) * 100));
  const activeProjects = projects.filter((p) => !p.archived);
  const accentColor = themeColors?.highlight || themeColors?.primary || '#14B8A6';
  const glowColor = themeColors?.glow || 'rgba(20, 184, 166, 0.35)';

  // Letzte Quittung für Stufe 1 ableiten
  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === 'assistant');
  const lastAction = lastAssistantMsg?.actions?.[0];

  // ═════════════════════════════════════════════════════════════════════════
  // STUFE 1 – KOMPAKTER, WACHER BEGLEITER (SEMI-INTEGRATION OHNE FULLSCREEN BLUR)
  // ═════════════════════════════════════════════════════════════════════════
  if (currentStage === 1) {
    return (
      <div
        role="region"
        aria-label="KI-Begleiter Kompakt"
        className="fixed inset-x-0 bottom-0 z-40 pointer-events-none pb-[max(0.75rem,env(safe-area-inset-bottom))] px-3"
      >
        <div
          className="max-w-[440px] mx-auto pointer-events-auto rounded-[26px] border shadow-2xl p-3 space-y-2.5 transition-all duration-300 relative overflow-hidden"
          style={{
            backgroundColor: 'rgba(25, 28, 34, 0.94)',
            borderColor: `${accentColor}55`,
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            boxShadow: `0 16px 45px rgba(0,0,0,0.7), 0 0 20px ${glowColor}`
          }}
          onTouchStart={(e) => {
            stage1TouchYRef.current = e.touches[0].clientY;
          }}
          onTouchEnd={(e) => {
            if (stage1TouchYRef.current !== null) {
              const deltaY = e.changedTouches[0].clientY - stage1TouchYRef.current;
              if (deltaY < -40) {
                // Hochziehen -> Stufe 2
                updateStage(2);
              } else if (deltaY > 40) {
                // Runterziehen -> Stufe 0
                updateStage(0);
              }
            }
            stage1TouchYRef.current = null;
          }}
        >
          {/* Oberer Zieh-Griff */}
          <div
            onClick={() => updateStage(2)}
            className="w-12 h-1 rounded-full bg-white/20 mx-auto cursor-pointer hover:bg-white/40 transition"
            title="Nach oben ziehen für volles Gespräch"
            aria-label="Nach oben ziehen für volles Gespräch"
          />

          {/* Hauptzeile: Mini-Sechseck + 2-Zeilen-Textbereich + 3 Kontroll-Icons */}
          <div className="flex items-center justify-between gap-2.5">
            {/* Links: Lebendes Mini-Sechseck (min-h-[44px] min-w-[44px]) */}
            <button
              type="button"
              onClick={() => {
                if (isSpeaking) {
                  stopSpeaking();
                  setIsSpeaking(false);
                } else if (isListening) {
                  if (hasSpokenText) {
                    autoSendTriggeredRef.current = true;
                    void triggerProcess(transcript);
                  } else {
                    stopMicrophone();
                  }
                } else {
                  startMicrophoneImmediately();
                }
              }}
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center relative cursor-pointer active:scale-95 transition shrink-0"
              title={
                isSpeaking
                  ? 'Gisela spricht – Antippen zum Stoppen'
                  : isProcessing
                  ? 'KI denkt...'
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
                      ? '#EF4444'
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
                  <Mic className="w-5 h-5 text-red-500 animate-pulse" />
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
              onClick={() => updateStage(2)}
              title="Antippen für volles Gespräch"
            >
              {isListening ? (
                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold text-red-400">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-ping shrink-0" />
                      <span>Höre zu...</span>
                    </span>
                    <span className="font-mono text-[#14B8A6]">{countdownSeconds}s</span>
                  </div>
                  <div className="text-xs text-white truncate mt-0.5">
                    {transcript || 'Sprechen oder aufhören zum Absenden...'}
                  </div>
                </div>
              ) : isProcessing ? (
                <div>
                  <div className="text-[11px] font-bold text-[#E5A93C] flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                    <span>Denken &amp; Zuordnen...</span>
                  </div>
                  <div className="text-xs text-[#9CA3AF] truncate mt-0.5">
                    Eingabe wird verarbeitet
                  </div>
                </div>
              ) : isSpeaking ? (
                <div>
                  <div className="text-[11px] font-bold text-[#14B8A6] flex items-center gap-1.5">
                    <Volume2 className="w-3 h-3 animate-pulse shrink-0" />
                    <span>Gisela antwortet:</span>
                  </div>
                  <div className="text-xs text-white line-clamp-1 mt-0.5">
                    {lastAssistantMsg?.text || 'Sprachausgabe läuft...'}
                  </div>
                </div>
              ) : lastAction ? (
                <div className="flex items-center justify-between gap-1">
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold text-[#14B8A6] truncate flex items-center gap-1">
                      <Check className="w-3 h-3 shrink-0" />
                      <span className="truncate">{lastAction.shortCheckableTitle}</span>
                    </div>
                    <div className="text-xs text-[#9CA3AF] truncate mt-0.5">
                      {lastAction.targetProjectName} / {lastAction.targetSubTab}
                    </div>
                  </div>
                  {!lastAction.undone && lastAssistantMsg?.logId && onUndoAiAction && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUndoAiAction(lastAssistantMsg.logId!, lastAction.actionId);
                        setMessages((prev) =>
                          prev.map((m) =>
                            m.id !== lastAssistantMsg.id
                              ? m
                              : {
                                  ...m,
                                  actions: m.actions?.map((a) =>
                                    a.actionId === lastAction.actionId
                                      ? { ...a, undone: true }
                                      : a
                                  )
                                }
                          )
                        );
                      }}
                      className="min-h-[36px] px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-red-500/15 text-red-300 border border-red-500/30 shrink-0 active:scale-95 transition"
                      aria-label="Rückgängig"
                    >
                      Rückgängig
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#94A3B8] truncate">
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
                onClick={() => setShowStage1TextInput((v) => !v)}
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
                  updateStage(0);
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
                onClick={() => updateStage(2)}
                className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-[#242930] hover:bg-[#2A3038] text-[#9CA3AF] hover:text-white border border-white/5 flex items-center justify-center active:scale-95 transition cursor-pointer"
                title="Vergrößern"
                aria-label="Vergrößern zu Vollbild"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Ausklappbare schmale Texteingabezeile in Stufe 1 */}
          {showStage1TextInput && (
            <div className="pt-2 border-t border-white/5 flex items-center gap-2 animate-fadeIn">
              <input
                type="text"
                value={transcript}
                onChange={(e) => {
                  setTranscript(e.target.value);
                  transcriptRef.current = e.target.value;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && transcript.trim()) {
                    void triggerProcess(transcript);
                  }
                }}
                placeholder="Befehl oder Notiz tippen..."
                className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl text-xs bg-[#111317] text-white border border-white/10 focus:outline-none focus:border-[#14B8A6]"
                autoFocus
              />
              <button
                type="button"
                disabled={!transcript.trim() || isProcessing}
                onClick={() => {
                  if (transcript.trim()) {
                    void triggerProcess(transcript);
                  }
                }}
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
  }

  // ═════════════════════════════════════════════════════════════════════════
  // STUFE 2 – VOLLES GESPRÄCH & PROTOKOLL (VOLLBILD-MODAL)
  // ═════════════════════════════════════════════════════════════════════════
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
      <div className="flex-1" onClick={() => updateStage(1)} />

      <div
        className="w-full max-w-[440px] mx-auto h-[85vh] rounded-t-3xl border-t border-white/15 shadow-2xl flex flex-col overflow-hidden transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ backgroundColor: THEME.bgMain }}
      >
        {/* Kopfzeile mit Swipe-Down Handler & Drag Pill */}
        <div
          onTouchStart={(e) => {
            headerTouchYRef.current = e.touches[0].clientY;
          }}
          onTouchEnd={(e) => {
            if (headerTouchYRef.current !== null) {
              const deltaY = e.changedTouches[0].clientY - headerTouchYRef.current;
              if (deltaY > 50) {
                updateStage(1);
              }
            }
            headerTouchYRef.current = null;
          }}
          className="px-4 pt-2 pb-3 border-b border-white/10 shrink-0 select-none"
          style={{ backgroundColor: THEME.bgCard }}
        >
          {/* Drag Pill */}
          <div
            onClick={() => updateStage(1)}
            className="w-12 h-1 rounded-full bg-white/25 mx-auto mb-2 cursor-pointer hover:bg-white/40 transition"
            title="Nach unten wischen oder klicken zum Minimieren"
            aria-label="Nach unten wischen zum Verkleinern"
          />

          <div className="flex items-center justify-between gap-2 flex-wrap min-w-0">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  isListening ? 'bg-red-500 animate-ping' : 'bg-[#14B8A6]'
                }`}
              />
              <div className="min-w-0">
                <div className="text-xs font-bold uppercase tracking-wider text-white truncate">
                  KI-Kontext &amp; Dialog
                </div>
                <div className="text-xs text-[#9CA3AF] truncate">
                  Fokus: {activeProjectName}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
              {/* 1-Tipp-Umschalter: ⚡ Sprech (Flash) ↔ 🧠 Research (Pro) */}
              <button
                type="button"
                onClick={() => {
                  const next = aiMode === 'flash' ? 'research' : 'flash';
                  setAiMode(next);
                  saveActiveAiMode(next);
                  triggerHapticFeedback(12);
                }}
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
                onClick={() => {
                  const next = !ttsActive;
                  setTtsActive(next);
                  setTtsEnabled(next);
                  if (!next) {
                    stopSpeaking();
                    setIsSpeaking(false);
                  }
                }}
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
                  onClick={() => {
                    setMessages([]);
                    saveIdbItem(STORAGE_KEYS.AI_CHAT, []);
                  }}
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
                onClick={() => updateStage(1)}
                className="min-w-[44px] min-h-[44px] rounded-xl bg-[#181A1B] text-xs font-bold text-[#9CA3AF] hover:text-white border border-white/10 flex items-center justify-center active:scale-95 transition"
                title="Verkleinern"
                aria-label="Verkleinern zu Stufe 1"
              >
                <Minimize2 className="w-4 h-4" />
              </button>

              {/* ✕ Schließen zu Stufe 0 */}
              <button
                type="button"
                onClick={() => updateStage(0)}
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
        </div>

        {/* Personalisierte Schnell-Befehle (Quick-Chips) */}
        {prefs.quickCommands && prefs.quickCommands.length > 0 && (
          <div className="px-3.5 py-2 border-b border-white/5 bg-[#1C2024] flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            {prefs.quickCommands.map((cmd, idx) => (
              <button
                type="button"
                key={idx}
                disabled={isProcessing}
                onClick={() => {
                  autoSendTriggeredRef.current = true;
                  void triggerProcess(cmd);
                }}
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
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[90%] rounded-2xl p-3.5 text-xs leading-relaxed transition-all duration-300 ${
                    msg.role === 'user'
                      ? 'bg-[#0A9396] text-white rounded-br-sm'
                      : 'bg-[#24292E] text-[#F8F9FA] border border-white/10 rounded-bl-sm'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 mb-1 text-xs opacity-70">
                    <span>{msg.role === 'user' ? 'Eingabe' : msg.engine || 'KI-Agent'}</span>
                    <span>{msg.timestamp}</span>
                  </div>
                  <p className="whitespace-pre-wrap">{msg.text}</p>

                  {msg.actions && msg.actions.length > 0 && (
                    <div className="mt-2.5 pt-2.5 border-t border-white/10 space-y-1.5">
                      <div className="text-xs font-bold uppercase tracking-wider text-[#14B8A6]">
                        Ausgeführte Zuordnungen ({msg.actions.length}):
                      </div>
                      {msg.actions.map((act) => (
                        <div
                          key={act.actionId}
                          className={`p-2.5 rounded-xl bg-[#181A1B] border border-white/10 space-y-1.5 ${
                            act.undone ? 'opacity-40' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap min-w-0">
                            <button
                              type="button"
                              onClick={() => {
                                if (onJumpToAction) {
                                  onJumpToAction(act);
                                  updateStage(0);
                                }
                              }}
                              className="text-xs font-bold text-[#14B8A6] hover:underline text-left flex items-center gap-1 truncate min-w-0"
                            >
                              <span className="truncate">{act.shortCheckableTitle}</span>
                              <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                            </button>
                            <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/5 text-[#9CA3AF] shrink-0">
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
                                  className="min-h-[44px] px-2.5 py-1.5 rounded-xl text-xs bg-[#24292E] text-white border border-white/10 flex-1"
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
                                  className="min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-red-500/15 text-red-300 border border-red-500/30 flex items-center gap-1.5 active:scale-95 transition"
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

                  {msg.role === 'assistant' && (!msg.actions || msg.actions.length === 0) && (
                    <div className="mt-2 pt-1.5 border-t border-white/10 flex justify-end">
                      <button
                        type="button"
                        onClick={() => onSaveAnswerToInfos('KI-Notiz', msg.text, null)}
                        className="min-h-[44px] px-3 py-1.5 text-xs font-semibold text-[#14B8A6] hover:underline flex items-center"
                      >
                        Als Projekt-Info sichern
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={scrollEndRef} />
        </div>

        {/* Untere Eingabeleiste - für flüssige Einhand-Eingaben optimiert */}
        <div
          className="p-3.5 border-t border-white/10 space-y-2.5 shrink-0"
          style={{ backgroundColor: THEME.bgCard }}
        >
          {isListening && hasSpokenText && !isProcessing && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-[#9CA3AF]">
                <span>Automatischer Versand nach Denkpause</span>
                <span className="font-mono text-[#14B8A6] font-bold">{countdownSeconds}s</span>
              </div>
              <div className="w-full h-1.5 bg-[#181A1B] rounded-full overflow-hidden">
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
            <div className="text-xs text-amber-300 px-2">{speechNotice}</div>
          )}

          <div className="flex items-center gap-2">
            <label
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-2xl bg-[#181A1B] border border-white/10 text-[#9CA3AF] hover:text-white cursor-pointer shrink-0 flex items-center justify-center active:scale-95 transition"
              title="Foto oder Datei anhängen"
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
                  ? 'Höre zu – einfach sprechen...'
                  : 'Sprechen oder direkt tippen...'
              }
              className="flex-1 min-h-[44px] px-4 py-2.5 rounded-2xl text-xs bg-[#181A1B] text-white border border-white/15 focus:outline-none focus:border-[#14B8A6] transition"
            />

            {hasSpokenText && (
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => {
                  autoSendTriggeredRef.current = true;
                  void triggerProcess(transcript);
                }}
                className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-2xl text-white shrink-0 flex items-center justify-center active:scale-95 transition shadow-md"
                style={{ backgroundColor: THEME.accentPrimary }}
                aria-label="Senden"
              >
                <Send className="w-4 h-4" />
              </button>
            )}

            {/* Organisch pulsierender Liquid-Orb Sprachbutton */}
            <div className="relative shrink-0">
              {isListening && prefs.organicMotion && (
                <>
                  <span className="absolute inset-0 rounded-2xl bg-[#14B8A6]/30 animate-ping pointer-events-none" />
                  <span className="absolute -inset-1.5 rounded-2xl bg-[#0A9396]/20 animate-pulse pointer-events-none" />
                </>
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
                className="relative w-11 h-11 min-w-[44px] min-h-[44px] rounded-2xl flex items-center justify-center text-white transition-transform duration-300 active:scale-90 shadow-md"
                style={{
                  backgroundColor: isProcessing
                    ? '#2F363D'
                    : isListening
                    ? '#EF4444'
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
      </div>
    </div>
  );
};
