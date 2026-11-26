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
import {
  AiExecutedAction,
  AiVoiceSettings,
  Attachment,
  OfflineAudioMemo,
  Project,
  THEME,
  VoiceInteractionMode
} from '../types';
import {
  compressImageFile,
  enforceMaxSixWords,
  getPreferredModelMode,
  getTtsEnabled,
  loadUserPrefs,
  resolveEffectiveAiMode,
  setTtsEnabled,
  speakText,
  stopAllSpeech,
  triggerHapticFeedback,
  unlockAudioPlayback
} from '../services/aiRouter';
import {
  STORAGE_KEYS,
  getActiveAiMode,
  getAutoModeDetection,
  getAzureSpeechKey,
  getAzureSpeechRegion,
  getContinuousListening,
  getIdbItemSync,
  getVoiceProvider,
  loadOfflineAudioMemos,
  saveActiveAiMode,
  saveIdbItem,
  saveOfflineAudioMemos
} from '../services/storage';
import {
  API_TIMEOUT_EXTENDED_MS,
  API_TIMEOUT_FLASH_MS,
  API_TIMEOUT_PRO_MS,
  SILENCE_COLLECT_MS,
  SILENCE_DIALOG_MS,
  STT_ABORT_RETRY_DELAY_MS,
  STT_MAX_CONSECUTIVE_ABORTS,
  TTS_ECHO_COOLDOWN_MS,
  VOICE_START_DEBOUNCE_MS
} from '../config/runtimeConfig';
import { classifyLiveSpeechIntent } from '../services/voiceModeClassifier';
import { useWakeLock } from '../hooks/useWakeLock';
import { OfflineAudioBufferBar } from './front/OfflineAudioBufferBar';

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  engine?: string;
  logId?: string;
  actions?: AiExecutedAction[];
  attachmentName?: string;
  isErrorFallback?: boolean;
  errorReason?: 'timeout' | 'network' | 'api';
  retryText?: string;
  retryAttachment?: Attachment | null;
  parkedAsNote?: boolean;
}

export interface VoiceModalProps {
  open: boolean;
  stage?: 1 | 2;
  autoStartMic?: boolean;
  wakeLockEnabled?: boolean;
  offlineAudioBufferEnabled?: boolean;
  activeProjectId?: string;
  userApiKey?: string;
  offlineAudioMemos?: OfflineAudioMemo[];
  onUpdateOfflineAudioMemos?: (memos: OfflineAudioMemo[]) => void;
  initialPrefillText?: string;
  activeProjectName: string;
  projects?: Project[];
  aiVoiceSettings?: AiVoiceSettings;
  onUpdateAiVoiceSettings?: (patch: Partial<AiVoiceSettings>) => void;
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
    chatHistory?: Array<{ role: 'user' | 'assistant'; text: string }>,
    options?: {
      signal?: AbortSignal;
      settings?: AiVoiceSettings;
      hintMode?: VoiceInteractionMode;
      previousMode?: VoiceInteractionMode | null;
    }
  ) => Promise<{
    replyText: string;
    spokenText: string;
    needsClarification: boolean;
    detectedMode?: VoiceInteractionMode;
    expectFollowUp?: boolean;
    engine: string;
    logId?: string;
    actions: AiExecutedAction[];
    autoUpscaledToPro?: boolean;
    isErrorFallback?: boolean;
    errorReason?: 'timeout' | 'network' | 'api';
  } | void>;
  onExecuteOfflineFallback?: (
    rawText: string,
    attachment: Attachment | null,
    reason?: string,
    hintMode?: VoiceInteractionMode,
    previousMode?: VoiceInteractionMode | null
  ) => {
    replyText: string;
    spokenText: string;
    needsClarification: boolean;
    detectedMode?: VoiceInteractionMode;
    expectFollowUp?: boolean;
    engine: string;
    logId?: string;
    actions: AiExecutedAction[];
    autoUpscaledToPro?: boolean;
    isErrorFallback?: boolean;
    errorReason?: 'timeout' | 'network' | 'api';
  } | void;
  onAskQuestion: (question: string, attachment: Attachment | null) => Promise<string>;
  onSaveAnswerToInfos: (question: string, answer: string, attachment: Attachment | null) => void;
  onJumpToAction?: (act: AiExecutedAction) => void;
  onUndoAiAction?: (logId: string, actionId: string) => void;
  onMoveAiAction?: (logId: string, actionId: string, newProjectId: string) => void;
  onListeningChange?: (listening: boolean) => void;
  onProcessingChange?: (processing: boolean) => void;
  onSpeakingChange?: (speaking: boolean) => void;
}

export type VoicePhase = 'IDLE' | 'LISTENING' | 'PROCESSING' | 'SPEAKING' | 'COOLDOWN';

const ABORT_RETRY_DELAY_MS = STT_ABORT_RETRY_DELAY_MS;
const MAX_CONSECUTIVE_ABORTS = STT_MAX_CONSECUTIVE_ABORTS;
const ECHO_COOLDOWN_MS = TTS_ECHO_COOLDOWN_MS;
const BARGE_IN_COOLDOWN_MS = 180;
const ANDROID_ONEND_GRACE_MS = 1200;
const END_DIALOG_REGEX = /\b(danke,?\s*reicht|fertig|stopp|schluss|bis später|pause)\b/i;

function dedupeTranscriptWords(text: string): string {
  const words = text.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
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
      i += 1;
      continue;
    }
    if (
      deduped.length >= 3 &&
      i + 2 < words.length &&
      deduped[deduped.length - 3].toLowerCase() === w.toLowerCase() &&
      deduped[deduped.length - 2].toLowerCase() === words[i + 1].toLowerCase() &&
      deduped[deduped.length - 1].toLowerCase() === words[i + 2].toLowerCase()
    ) {
      i += 2;
      continue;
    }
    deduped.push(w);
  }
  return deduped.join(' ').trim();
}

function mergeTranscriptWithPrefix(prefix: string, sessionText: string): string {
  const cleanPrefix = prefix.trim();
  const cleanSession = sessionText.trim();
  if (!cleanPrefix) return dedupeTranscriptWords(cleanSession);
  if (!cleanSession) return dedupeTranscriptWords(cleanPrefix);

  const prefixWords = cleanPrefix.split(/\s+/).filter(Boolean);
  const sessionWords = cleanSession.split(/\s+/).filter(Boolean);

  let overlap = 0;
  const maxOverlap = Math.min(prefixWords.length, sessionWords.length);
  for (let k = maxOverlap; k >= 1; k--) {
    let matches = true;
    for (let j = 0; j < k; j++) {
      if (prefixWords[prefixWords.length - k + j].toLowerCase() !== sessionWords[j].toLowerCase()) {
        matches = false;
        break;
      }
    }
    if (matches) {
      overlap = k;
      break;
    }
  }

  return dedupeTranscriptWords([...prefixWords, ...sessionWords.slice(overlap)].join(' '));
}

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

  return dedupeTranscriptWords(segments.join(' '));
}

export const VoiceModal: React.FC<VoiceModalProps> = ({
  open,
  stage = 1,
  autoStartMic = true,
  wakeLockEnabled = true,
  offlineAudioBufferEnabled = true,
  activeProjectId,
  userApiKey = '',
  offlineAudioMemos: offlineAudioMemosProp,
  onUpdateOfflineAudioMemos,
  initialPrefillText,
  activeProjectName,
  projects = [],
  aiVoiceSettings,
  onUpdateAiVoiceSettings,
  themeColors,
  onClose,
  onStageChange,
  onOpenQuickFan,
  onExecuteCommand,
  onExecuteOfflineFallback,
  onSaveAnswerToInfos,
  onJumpToAction,
  onUndoAiAction,
  onMoveAiAction,
  onListeningChange,
  onProcessingChange,
  onSpeakingChange
}) => {
  const [messages, setMessages] = useState<ConversationMessage[]>(() => {
    return getIdbItemSync<ConversationMessage[]>(STORAGE_KEYS.AI_CHAT, []);
  });
  const [transcript, setTranscript] = useState('');
  const [voicePhase, setVoicePhase] = useState<VoicePhase>('IDLE');
  const voicePhaseRef = useRef<VoicePhase>('IDLE');
  const isListening = voicePhase === 'LISTENING';
  const isProcessing = voicePhase === 'PROCESSING';
  const isSpeaking = voicePhase === 'SPEAKING';
  const isCooldown = voicePhase === 'COOLDOWN';

  const [speechNotice, setSpeechNotice] = useState('');
  const [voiceStatusNotice, setVoiceStatusNotice] = useState<string | null>(null);
  const [shareIntakeNotice, setShareIntakeNotice] = useState<string | null>(null);
  const [showSlowThinkingNotice, setShowSlowThinkingNotice] = useState(false);
  const { isActive: wakeLockActive } = useWakeLock(
    open && wakeLockEnabled && voicePhase !== 'IDLE'
  );
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [silenceLimitMs, setSilenceLimitMs] = useState<number>(SILENCE_COLLECT_MS);
  const [remainingMs, setRemainingMs] = useState<number>(SILENCE_COLLECT_MS);
  const [localTtsActive, setLocalTtsActive] = useState<boolean>(getTtsEnabled);
  const [localAiMode, setLocalAiMode] = useState<'flash' | 'research'>(() => getActiveAiMode());
  const [upscaleNotice, setUpscaleNotice] = useState<string | null>(null);
  const [localOfflineMemos, setLocalOfflineMemos] = useState<OfflineAudioMemo[]>(() =>
    loadOfflineAudioMemos()
  );
  const effectiveOfflineMemos = offlineAudioMemosProp ?? localOfflineMemos;
  const handleSaveOfflineMemos = (next: OfflineAudioMemo[]) => {
    if (onUpdateOfflineAudioMemos) {
      onUpdateOfflineAudioMemos(next);
    } else {
      setLocalOfflineMemos(next);
      void saveOfflineAudioMemos(next);
    }
  };
  const resolvedProjectId =
    activeProjectId ||
    projects.find((p) => p.name === activeProjectName && !p.archived)?.id ||
    projects[0]?.id ||
    'proj-foodtruck';

  const effectiveSettings: AiVoiceSettings = aiVoiceSettings || {
    ttsEnabled: localTtsActive,
    voiceProvider: getVoiceProvider(),
    azureSpeechKey: getAzureSpeechKey(),
    azureSpeechRegion: getAzureSpeechRegion(),
    preferredModelMode: getPreferredModelMode(),
    activeAiMode: localAiMode,
    continuousListening: getContinuousListening(),
    autoModeDetection: getAutoModeDetection()
  };
  const ttsActive = effectiveSettings.ttsEnabled;
  const aiMode = effectiveSettings.activeAiMode;

  const settingsRef = useRef<AiVoiceSettings>(effectiveSettings);
  settingsRef.current = effectiveSettings;

  useEffect(() => {
    settingsRef.current = effectiveSettings;
  }, [effectiveSettings]);

  // 3-Stufen-Morphing: Stufe 1 (Kompakter Begleiter) vs. Stufe 2 (Volles Gespräch)
  const [currentStage, setCurrentStage] = useState<1 | 2>(stage);
  const [showStage1TextInput, setShowStage1TextInput] = useState(false);

  useEffect(() => {
    if (stage) setCurrentStage(stage);
  }, [stage]);

  const openRef = useRef(open);
  openRef.current = open;
  const sessionActiveRef = useRef(false);
  const micLockedRef = useRef(false);
  const lastMicToggleRef = useRef(0);
  const consecutiveAbortCountRef = useRef(0);
  const cooldownTimerRef = useRef<number | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const androidGraceTimerRef = useRef<number | null>(null);
  const accumulatedPrefixRef = useRef('');
  const isTypingPausedRef = useRef(false);

  const activeRequestIdRef = useRef(0);
  const activeRequestControllerRef = useRef<AbortController | null>(null);
  const activeTimeoutRef = useRef<number | null>(null);
  const isSendingRef = useRef(false);

  const prefs = loadUserPrefs();
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');
  const lastSpeechTimestampRef = useRef<number>(0);
  const silenceLimitRef = useRef<number>(SILENCE_COLLECT_MS);
  const lastDetectedModeRef = useRef<VoiceInteractionMode | null>(null);
  const liveHintModeRef = useRef<VoiceInteractionMode>('dialog');
  const autoSendTriggeredRef = useRef(false);
  const isListeningRef = useRef(false);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);
  const headerTouchYRef = useRef<number | null>(null);
  const stage1TouchYRef = useRef<number | null>(null);

  const setPhase = (next: VoicePhase) => {
    voicePhaseRef.current = next;
    setVoicePhase(next);
    isListeningRef.current = next === 'LISTENING';
    onListeningChange?.(next === 'LISTENING');
    onProcessingChange?.(next === 'PROCESSING');
    onSpeakingChange?.(next === 'SPEAKING');
  };

  const clearVoiceTimers = () => {
    if (cooldownTimerRef.current !== null) {
      window.clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (androidGraceTimerRef.current !== null) {
      window.clearTimeout(androidGraceTimerRef.current);
      androidGraceTimerRef.current = null;
    }
  };

  const cancelPendingRequest = () => {
    activeRequestIdRef.current += 1;
    if (activeTimeoutRef.current !== null) {
      window.clearTimeout(activeTimeoutRef.current);
      activeTimeoutRef.current = null;
    }
    if (activeRequestControllerRef.current) {
      try {
        activeRequestControllerRef.current.abort();
      } catch {
        // ignore
      }
      activeRequestControllerRef.current = null;
    }
    isSendingRef.current = false;
    micLockedRef.current = false;
    if (voicePhaseRef.current === 'PROCESSING') {
      setPhase('IDLE');
    } else {
      onProcessingChange?.(false);
    }
  };

  const stopMicrophone = () => {
    isListeningRef.current = false;
    if (recognitionRef.current) {
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      try {
        rec.onstart = null;
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        rec.stop();
      } catch {
        // ignore
      }
    }
    if (voicePhaseRef.current === 'LISTENING') {
      setPhase('IDLE');
    } else {
      onListeningChange?.(false);
    }
  };

  const updateStage = (newStage: 1 | 2 | 0) => {
    if (newStage === 0) {
      sessionActiveRef.current = false;
      accumulatedPrefixRef.current = '';
      isTypingPausedRef.current = false;
      clearVoiceTimers();
      cancelPendingRequest();
      stopAllSpeech();
      stopMicrophone();
      micLockedRef.current = false;
      setPhase('IDLE');
      onClose();
      onStageChange?.(0);
    } else {
      setCurrentStage(newStage);
      onStageChange?.(newStage);
    }
  };

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    saveIdbItem(STORAGE_KEYS.AI_CHAT, messages.slice(-40));
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const preserveCurrentTranscriptPrefix = () => {
    const current = transcriptRef.current.trim();
    if (current) {
      accumulatedPrefixRef.current = current;
    }
  };

  const startMicrophoneImmediately = (options?: { bypassDebounce?: boolean }) => {
    // Harte Half-Duplex-Sperre: während PROCESSING oder SPEAKING oder gesperrtem Mic niemals aufnehmen
    if (
      !openRef.current ||
      micLockedRef.current ||
      voicePhaseRef.current === 'PROCESSING' ||
      voicePhaseRef.current === 'SPEAKING'
    ) {
      return;
    }

    const now = Date.now();
    if (!options?.bypassDebounce && now - lastMicToggleRef.current < VOICE_START_DEBOUNCE_MS) {
      return;
    }
    lastMicToggleRef.current = now;

    clearVoiceTimers();
    isTypingPausedRef.current = false;
    setSpeechNotice('');
    autoSendTriggeredRef.current = false;
    stopAllSpeech();

    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setVoiceStatusNotice('Spracherkennung im Browser nicht verfügbar – bitte Textfeld nutzen.');
      setPhase('IDLE');
      return;
    }

    try {
      stopMicrophone();
      const rec = new SpeechRec();
      rec.lang = 'de-DE';
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      let abortedThisSession = false;
      const startLimit =
        settingsRef.current.autoModeDetection !== false
          ? classifyLiveSpeechIntent(
              accumulatedPrefixRef.current,
              lastDetectedModeRef.current,
              true
            ).silenceTimeoutMs
          : SILENCE_COLLECT_MS;
      silenceLimitRef.current = startLimit;
      setSilenceLimitMs(startLimit);
      lastSpeechTimestampRef.current = Date.now();
      setRemainingMs(startLimit);

      rec.onstart = () => {
        if (
          !openRef.current ||
          micLockedRef.current ||
          voicePhaseRef.current === 'PROCESSING' ||
          voicePhaseRef.current === 'SPEAKING' ||
          recognitionRef.current !== rec
        ) {
          try {
            rec.stop();
          } catch {
            // ignore
          }
          return;
        }
        setPhase('LISTENING');
        lastSpeechTimestampRef.current = Date.now();
        triggerHapticFeedback(10);
      };

      rec.onresult = (event: any) => {
        if (isTypingPausedRef.current || recognitionRef.current !== rec) return;
        if (androidGraceTimerRef.current !== null) {
          window.clearTimeout(androidGraceTimerRef.current);
          androidGraceTimerRef.current = null;
        }
        consecutiveAbortCountRef.current = 0;
        lastSpeechTimestampRef.current = Date.now();
        const cleanSessionText = buildCleanTranscriptFromResults(event.results);
        const combinedText = mergeTranscriptWithPrefix(
          accumulatedPrefixRef.current,
          cleanSessionText
        );
        const autoDetect = settingsRef.current.autoModeDetection !== false;
        const classified = classifyLiveSpeechIntent(
          combinedText,
          lastDetectedModeRef.current,
          autoDetect
        );
        liveHintModeRef.current = classified.mode;
        silenceLimitRef.current = classified.silenceTimeoutMs;
        setSilenceLimitMs(classified.silenceTimeoutMs);
        setRemainingMs(classified.silenceTimeoutMs);
        setTranscript(combinedText);
        transcriptRef.current = combinedText;
      };

      rec.onerror = (event: any) => {
        const errCode = event?.error;
        if (errCode === 'no-speech') return;

        if (errCode === 'aborted') {
          abortedThisSession = true;
          if (recognitionRef.current === rec) recognitionRef.current = null;
          isListeningRef.current = false;

          if (
            openRef.current &&
            sessionActiveRef.current &&
            !micLockedRef.current &&
            voicePhaseRef.current !== 'PROCESSING' &&
            voicePhaseRef.current !== 'SPEAKING' &&
            !isTypingPausedRef.current
          ) {
            preserveCurrentTranscriptPrefix();
            consecutiveAbortCountRef.current += 1;
            if (consecutiveAbortCountRef.current >= MAX_CONSECUTIVE_ABORTS) {
              sessionActiveRef.current = false;
              setPhase('IDLE');
              setVoiceStatusNotice(
                transcriptRef.current.trim()
                  ? 'Mikrofon pausiert – Text prüfen oder absenden'
                  : 'Mikrofon pausiert – zum Weiterreden tippen'
              );
            } else {
              setPhase('COOLDOWN');
              if (retryTimerRef.current !== null) {
                window.clearTimeout(retryTimerRef.current);
              }
              retryTimerRef.current = window.setTimeout(() => {
                retryTimerRef.current = null;
                if (
                  openRef.current &&
                  sessionActiveRef.current &&
                  !micLockedRef.current &&
                  voicePhaseRef.current !== 'PROCESSING' &&
                  voicePhaseRef.current !== 'SPEAKING' &&
                  !isTypingPausedRef.current
                ) {
                  startMicrophoneImmediately({ bypassDebounce: true });
                }
              }, ABORT_RETRY_DELAY_MS);
            }
          }
          return;
        }

        if (recognitionRef.current === rec) recognitionRef.current = null;
        sessionActiveRef.current = false;
        setPhase('IDLE');
        setVoiceStatusNotice(`Mikrofon-Status: ${errCode || 'Berechtigung prüfen'}`);
      };

      rec.onend = () => {
        if (recognitionRef.current === rec) recognitionRef.current = null;
        isListeningRef.current = false;

        if (
          abortedThisSession ||
          autoSendTriggeredRef.current ||
          !openRef.current ||
          micLockedRef.current ||
          voicePhaseRef.current === 'PROCESSING' ||
          voicePhaseRef.current === 'SPEAKING'
        ) {
          return;
        }

        if (isTypingPausedRef.current) {
          if (voicePhaseRef.current === 'LISTENING') setPhase('IDLE');
          return;
        }

        const currentCleanText = transcriptRef.current.trim();
        if (currentCleanText.length > 0 && (voicePhaseRef.current === 'LISTENING' || sessionActiveRef.current)) {
          sessionActiveRef.current = true;
          const isIncompleteCollect =
            liveHintModeRef.current === 'collect' &&
            (/(?:^|\s)(?:und|oder|aber|für|auf|im|in|an|bei|mit|von|zu|wegen|dass|weil|mal|noch|äh|ähm)[,.…\s]*$/i.test(
              currentCleanText
            ) ||
              currentCleanText.split(/\s+/).length <= 3);

          if (isIncompleteCollect && consecutiveAbortCountRef.current < MAX_CONSECUTIVE_ABORTS) {
            preserveCurrentTranscriptPrefix();
            consecutiveAbortCountRef.current += 1;
            setPhase('COOLDOWN');
            if (retryTimerRef.current !== null) {
              window.clearTimeout(retryTimerRef.current);
            }
            retryTimerRef.current = window.setTimeout(() => {
              retryTimerRef.current = null;
              if (
                openRef.current &&
                sessionActiveRef.current &&
                !micLockedRef.current &&
                voicePhaseRef.current !== 'PROCESSING' &&
                voicePhaseRef.current !== 'SPEAKING' &&
                !isTypingPausedRef.current
              ) {
                startMicrophoneImmediately({ bypassDebounce: true });
              }
            }, ABORT_RETRY_DELAY_MS);
            return;
          }

          // Android Chrome onend mit erkanntem Text: Sitzung offen halten & nach kurzer Nachlauf-Pause regulär absenden
          setPhase('LISTENING');
          const graceMs = Math.min(
            silenceLimitRef.current || ANDROID_ONEND_GRACE_MS,
            ANDROID_ONEND_GRACE_MS
          );
          silenceLimitRef.current = graceMs;
          setSilenceLimitMs(graceMs);
          lastSpeechTimestampRef.current = Date.now();
          setRemainingMs(graceMs);
          if (androidGraceTimerRef.current !== null) {
            window.clearTimeout(androidGraceTimerRef.current);
          }
          androidGraceTimerRef.current = window.setTimeout(() => {
            androidGraceTimerRef.current = null;
            const latestText = transcriptRef.current.trim();
            if (
              openRef.current &&
              !autoSendTriggeredRef.current &&
              !isTypingPausedRef.current &&
              voicePhaseRef.current !== 'PROCESSING' &&
              latestText
            ) {
              autoSendTriggeredRef.current = true;
              void triggerProcess(latestText);
            }
          }, graceMs);
          return;
        }

        // Transkript noch leer bei Android-onend: einmalig kontrolliert neu starten (über Retry-Zähler gedeckelt)
        if (openRef.current && sessionActiveRef.current) {
          consecutiveAbortCountRef.current += 1;
          if (consecutiveAbortCountRef.current <= 1 && consecutiveAbortCountRef.current < MAX_CONSECUTIVE_ABORTS) {
            setPhase('COOLDOWN');
            if (retryTimerRef.current !== null) {
              window.clearTimeout(retryTimerRef.current);
            }
            retryTimerRef.current = window.setTimeout(() => {
              retryTimerRef.current = null;
              if (
                openRef.current &&
                sessionActiveRef.current &&
                !micLockedRef.current &&
                voicePhaseRef.current !== 'PROCESSING' &&
                voicePhaseRef.current !== 'SPEAKING' &&
                !isTypingPausedRef.current
              ) {
                startMicrophoneImmediately({ bypassDebounce: true });
              }
            }, ABORT_RETRY_DELAY_MS);
            return;
          }
          sessionActiveRef.current = false;
          setPhase('IDLE');
          setVoiceStatusNotice('Mikrofon pausiert – zum Weiterreden tippen');
          return;
        }

        if (voicePhaseRef.current === 'LISTENING') {
          setPhase('IDLE');
        }
      };

      recognitionRef.current = rec;
      rec.start();
    } catch {
      recognitionRef.current = null;
      sessionActiveRef.current = false;
      setPhase('IDLE');
      setVoiceStatusNotice('Mikrofon konnte nicht gestartet werden.');
    }
  };

  const handleBargeIn = () => {
    const now = Date.now();
    if (now - lastMicToggleRef.current < VOICE_START_DEBOUNCE_MS) return;
    lastMicToggleRef.current = now;

    unlockAudioPlayback();
    clearVoiceTimers();
    stopAllSpeech();
    micLockedRef.current = false;
    sessionActiveRef.current = true;
    consecutiveAbortCountRef.current = 0;
    isTypingPausedRef.current = false;
    setVoiceStatusNotice(null);
    setPhase('COOLDOWN');

    cooldownTimerRef.current = window.setTimeout(() => {
      cooldownTimerRef.current = null;
      if (
        openRef.current &&
        sessionActiveRef.current &&
        !micLockedRef.current &&
        voicePhaseRef.current === 'COOLDOWN'
      ) {
        startMicrophoneImmediately({ bypassDebounce: true });
      }
    }, BARGE_IN_COOLDOWN_MS);
  };

  const handleManualMicToggle = () => {
    unlockAudioPlayback();
    if (voicePhaseRef.current === 'PROCESSING') return;
    if (voicePhaseRef.current === 'SPEAKING') {
      handleBargeIn();
      return;
    }

    const now = Date.now();
    if (now - lastMicToggleRef.current < VOICE_START_DEBOUNCE_MS) return;

    if (voicePhaseRef.current === 'LISTENING') {
      lastMicToggleRef.current = now;
      if (transcriptRef.current.trim()) {
        autoSendTriggeredRef.current = true;
        void triggerProcess(transcriptRef.current);
      } else {
        sessionActiveRef.current = false;
        accumulatedPrefixRef.current = '';
        clearVoiceTimers();
        stopMicrophone();
        setPhase('IDLE');
      }
      return;
    }

    clearVoiceTimers();
    micLockedRef.current = false;
    sessionActiveRef.current = true;
    consecutiveAbortCountRef.current = 0;
    isTypingPausedRef.current = false;
    if (transcriptRef.current.trim()) {
      accumulatedPrefixRef.current = transcriptRef.current.trim();
    }
    setVoiceStatusNotice(null);
    startMicrophoneImmediately();
  };

  useEffect(() => {
    openRef.current = open;
    if (open) {
      const baseLimit =
        settingsRef.current.autoModeDetection !== false
          ? classifyLiveSpeechIntent('', lastDetectedModeRef.current, true).silenceTimeoutMs
          : SILENCE_COLLECT_MS;
      silenceLimitRef.current = baseLimit;
      setSilenceLimitMs(baseLimit);
      setRemainingMs(baseLimit);
      autoSendTriggeredRef.current = false;
      consecutiveAbortCountRef.current = 0;
      accumulatedPrefixRef.current = '';
      isTypingPausedRef.current = false;
      micLockedRef.current = false;

      const cleanPrefill = initialPrefillText?.trim() || '';
      if (cleanPrefill) {
        setTranscript(cleanPrefill);
        transcriptRef.current = cleanPrefill;
        accumulatedPrefixRef.current = cleanPrefill;
        isTypingPausedRef.current = true;
        setShowStage1TextInput(true);
        setShareIntakeNotice('Geteilter Inhalt übernommen – kurz prüfen & absenden');
        sessionActiveRef.current = false;
      } else {
        setShareIntakeNotice(null);
        sessionActiveRef.current = Boolean(autoStartMic);

        if (autoStartMic) {
          startMicrophoneImmediately({ bypassDebounce: true });
        }
      }
    } else {
      setShareIntakeNotice(null);
      sessionActiveRef.current = false;
      lastDetectedModeRef.current = null;
      accumulatedPrefixRef.current = '';
      isTypingPausedRef.current = false;
      clearVoiceTimers();
      cancelPendingRequest();
      stopMicrophone();
      stopAllSpeech();
      micLockedRef.current = false;
      lastMicToggleRef.current = 0;
      setPhase('IDLE');
    }
  }, [open, autoStartMic, initialPrefillText]);

  useEffect(() => {
    return () => {
      sessionActiveRef.current = false;
      accumulatedPrefixRef.current = '';
      isTypingPausedRef.current = false;
      clearVoiceTimers();
      cancelPendingRequest();
      stopMicrophone();
      stopAllSpeech();
    };
  }, []);

  useEffect(() => {
    if (!open || !isProcessing) {
      setShowSlowThinkingNotice(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setShowSlowThinkingNotice(true);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [open, isProcessing]);

  useEffect(() => {
    if (!open || !isListening || isProcessing) return;

    const interval = window.setInterval(() => {
      if (isTypingPausedRef.current) return;
      const currentText = transcriptRef.current.trim();
      const activeLimit = silenceLimitRef.current || SILENCE_DIALOG_MS;
      if (!currentText) {
        lastSpeechTimestampRef.current = Date.now();
        setRemainingMs(activeLimit);
        return;
      }

      const elapsed = Date.now() - lastSpeechTimestampRef.current;
      const left = Math.max(0, activeLimit - elapsed);
      setRemainingMs(left);

      if (left === 0 && !autoSendTriggeredRef.current) {
        autoSendTriggeredRef.current = true;
        stopMicrophone();
        void triggerProcess(currentText);
      }
    }, 150);

    return () => window.clearInterval(interval);
  }, [open, isListening, isProcessing]);

  const scheduleReListenAfterCooldown = (
    needsClarification: boolean,
    lastUserText: string,
    requestId: number,
    detectedMode?: VoiceInteractionMode,
    expectFollowUp?: boolean
  ) => {
    clearVoiceTimers();
    const hasEndSignal = END_DIALOG_REGEX.test(lastUserText);
    const autoModeOn = settingsRef.current.autoModeDetection !== false;
    const modeAllowsReListen = autoModeOn
      ? Boolean(expectFollowUp) ||
        needsClarification ||
        (Boolean(settingsRef.current.continuousListening) && detectedMode !== 'quick')
      : Boolean(settingsRef.current.continuousListening) || needsClarification;

    const shouldReListen =
      openRef.current &&
      sessionActiveRef.current &&
      !hasEndSignal &&
      modeAllowsReListen;

    if (hasEndSignal) {
      sessionActiveRef.current = false;
    }

    if (!shouldReListen) {
      micLockedRef.current = false;
      setPhase('IDLE');
      return;
    }

    setPhase('COOLDOWN');
    cooldownTimerRef.current = window.setTimeout(() => {
      cooldownTimerRef.current = null;
      if (requestId !== activeRequestIdRef.current || !openRef.current || !sessionActiveRef.current) {
        micLockedRef.current = false;
        if (voicePhaseRef.current === 'COOLDOWN') setPhase('IDLE');
        return;
      }
      micLockedRef.current = false;
      startMicrophoneImmediately({ bypassDebounce: true });
    }, ECHO_COOLDOWN_MS);
  };

  const speakAssistantReply = async (
    spokenText: string,
    needsClarification: boolean,
    requestId: number,
    lastUserText: string,
    detectedMode?: VoiceInteractionMode,
    expectFollowUp?: boolean
  ) => {
    if (requestId !== activeRequestIdRef.current || !openRef.current) return;
    clearVoiceTimers();
    stopMicrophone();
    micLockedRef.current = true;
    stopAllSpeech();
    const currentSettings = settingsRef.current;

    if (!currentSettings.ttsEnabled) {
      scheduleReListenAfterCooldown(
        needsClarification,
        lastUserText,
        requestId,
        detectedMode,
        expectFollowUp
      );
      return;
    }

    setPhase('SPEAKING');
    const completedNaturally = await speakText(
      spokenText,
      undefined,
      (engine, fallbackReason) => {
        if (requestId !== activeRequestIdRef.current) return;
        if (
          settingsRef.current.voiceProvider === 'azure-gisela' &&
          engine === 'browser-fallback' &&
          fallbackReason
        ) {
          setVoiceStatusNotice(
            `Gisela nicht erreichbar (${fallbackReason}) – Browser-Stimme aktiv (Auswahl bleibt gespeichert).`
          );
        } else if (engine === 'azure-gisela') {
          setVoiceStatusNotice(null);
        }
      },
      currentSettings
    );

    if (requestId !== activeRequestIdRef.current || !openRef.current) return;

    if (!completedNaturally) {
      if (voicePhaseRef.current === 'SPEAKING') {
        micLockedRef.current = false;
        setPhase('IDLE');
      }
      return;
    }

    scheduleReListenAfterCooldown(
      needsClarification,
      lastUserText,
      requestId,
      detectedMode,
      expectFollowUp
    );
  };

  const triggerProcess = async (textToProcess: string, overrideAttachment?: Attachment | null) => {
    const clean = textToProcess.trim();
    if (!clean || voicePhaseRef.current === 'PROCESSING' || isSendingRef.current) return;
    isSendingRef.current = true;
    autoSendTriggeredRef.current = true;

    clearVoiceTimers();
    accumulatedPrefixRef.current = '';
    isTypingPausedRef.current = false;
    micLockedRef.current = true;
    stopMicrophone();
    stopAllSpeech();
    setPhase('PROCESSING');
    setVoiceStatusNotice(null);

    if (activeTimeoutRef.current !== null) {
      window.clearTimeout(activeTimeoutRef.current);
      activeTimeoutRef.current = null;
    }
    if (activeRequestControllerRef.current) {
      try {
        activeRequestControllerRef.current.abort();
      } catch {
        // ignore
      }
    }

    const requestId = ++activeRequestIdRef.current;
    const controller = new AbortController();
    activeRequestControllerRef.current = controller;
    let settled = false;

    const currentSettings = settingsRef.current;
    const currentAtt = overrideAttachment !== undefined ? overrideAttachment : attachment;
    const { effectiveMode: resolvedTimeoutMode } = resolveEffectiveAiMode(
      clean,
      currentAtt,
      currentSettings.activeAiMode,
      currentSettings
    );
    const hasPhotoAttachment = Boolean(
      currentAtt && (currentAtt.type === 'image' || currentAtt.dataUrl?.startsWith('data:image/'))
    );
    const wordCount = clean.split(/\s+/).filter(Boolean).length;
    const hintClassification = classifyLiveSpeechIntent(
      clean,
      lastDetectedModeRef.current,
      currentSettings.autoModeDetection !== false
    );
    const requestHintMode = hintClassification.mode;
    const requestPrevMode = lastDetectedModeRef.current;
    const requestTimeoutMs =
      resolvedTimeoutMode === 'research' || hasPhotoAttachment
        ? API_TIMEOUT_PRO_MS
        : wordCount > 30 || requestHintMode === 'collect' || requestHintMode === 'dialog'
          ? Math.max(API_TIMEOUT_FLASH_MS, API_TIMEOUT_EXTENDED_MS)
          : API_TIMEOUT_FLASH_MS;
    const timeoutSeconds = Math.round(requestTimeoutMs / 1000);

    triggerHapticFeedback([12, 30, 12]);
    setTranscript('');
    transcriptRef.current = '';
    if (overrideAttachment === undefined) {
      setAttachment(null);
    }
    setShowStage1TextInput(false);
    setShareIntakeNotice(null);

    const userMsg: ConversationMessage = {
      id: `msg-u-${Date.now()}`,
      role: 'user',
      text: clean,
      timestamp: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
      attachmentName: currentAtt?.name
    };

    const recentHistory = messages
      .filter((m) => !m.isErrorFallback)
      .slice(-6)
      .map((m) => ({
        role: m.role,
        text: m.text
      }));

    setMessages((prev) => [...prev, userMsg]);

    const finalizeWithResult = (result: {
      replyText: string;
      spokenText: string;
      needsClarification: boolean;
      detectedMode?: VoiceInteractionMode;
      expectFollowUp?: boolean;
      engine: string;
      logId?: string;
      actions: AiExecutedAction[];
      autoUpscaledToPro?: boolean;
      isErrorFallback?: boolean;
      errorReason?: 'timeout' | 'network' | 'api';
      retryText?: string;
      retryAttachment?: Attachment | null;
    }) => {
      const isErr = Boolean(result.isErrorFallback);
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
        actions: result.actions,
        isErrorFallback: isErr,
        errorReason: result.errorReason,
        retryText: isErr ? (result.retryText ?? clean) : undefined,
        retryAttachment: isErr ? (result.retryAttachment ?? currentAtt) : undefined
      };
      setMessages((prev) => [...prev, assistantMsg]);

      const resolvedMode = result.detectedMode || requestHintMode;
      lastDetectedModeRef.current = resolvedMode;

      // Smart Auto-Expand von Stufe 1 nach Stufe 2 bei Klärungsbedarf, Fehlerkarte oder langer Antwort (>120 Zeichen)
      if (currentStage === 1 && (result.needsClarification || isErr || result.replyText.length > 120)) {
        updateStage(2);
      }

      isSendingRef.current = false;
      void speakAssistantReply(
        result.spokenText,
        result.needsClarification,
        requestId,
        clean,
        resolvedMode,
        isErr ? false : result.expectFollowUp
      );
    };

    activeTimeoutRef.current = window.setTimeout(() => {
      if (settled || requestId !== activeRequestIdRef.current) return;
      settled = true;
      activeTimeoutRef.current = null;
      controller.abort();
      activeRequestControllerRef.current = null;
      setVoiceStatusNotice(
        `Verbindung hat nach ${timeoutSeconds}s zu lange gedauert – es wurde nichts angelegt.`
      );

      finalizeWithResult({
        replyText: 'Die Verbindung hat diesmal zu lange gedauert – es wurde nichts angelegt.',
        spokenText: 'Die Verbindung hat diesmal zu lange gedauert – es wurde nichts angelegt.',
        needsClarification: false,
        detectedMode: requestHintMode,
        expectFollowUp: false,
        engine: `Zeitüberschreitung (${timeoutSeconds}s)`,
        actions: [],
        isErrorFallback: true,
        errorReason: 'timeout',
        retryText: clean,
        retryAttachment: currentAtt
      });
    }, requestTimeoutMs);

    try {
      const result = await onExecuteCommand(
        clean,
        currentAtt,
        currentSettings.activeAiMode,
        recentHistory,
        {
          signal: controller.signal,
          settings: currentSettings,
          hintMode: requestHintMode,
          previousMode: requestPrevMode
        }
      );
      if (settled || requestId !== activeRequestIdRef.current) return;
      settled = true;
      if (activeTimeoutRef.current !== null) {
        window.clearTimeout(activeTimeoutRef.current);
        activeTimeoutRef.current = null;
      }
      activeRequestControllerRef.current = null;

      if (result) {
        if (result.autoUpscaledToPro) {
          setUpscaleNotice('Sprech → Research (Automatisch für Foto/Analyse auf Pro geschaltet)');
          window.setTimeout(() => setUpscaleNotice(null), 4000);
        }
        finalizeWithResult(result);
      } else {
        micLockedRef.current = false;
        setPhase('IDLE');
        isSendingRef.current = false;
      }
    } catch (err) {
      if (settled || requestId !== activeRequestIdRef.current) return;
      settled = true;
      if (activeTimeoutRef.current !== null) {
        window.clearTimeout(activeTimeoutRef.current);
        activeTimeoutRef.current = null;
      }
      activeRequestControllerRef.current = null;
      console.warn('[VoiceModal] Fehler bei Sprachausführung:', err);
      finalizeWithResult({
        replyText: 'Die Verbindung hat diesmal zu lange gedauert – es wurde nichts angelegt.',
        spokenText: 'Die Verbindung hat diesmal zu lange gedauert – es wurde nichts angelegt.',
        needsClarification: false,
        detectedMode: requestHintMode,
        expectFollowUp: false,
        engine: 'Verbindungsfehler',
        actions: [],
        isErrorFallback: true,
        errorReason: 'network',
        retryText: clean,
        retryAttachment: currentAtt
      });
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
  const progressPercent = Math.min(100, Math.max(0, (remainingMs / Math.max(1, silenceLimitMs)) * 100));
  const activeProjects = projects.filter((p) => !p.archived);
  const accentColor = themeColors?.highlight || themeColors?.primary || '#14B8A6';
  const glowColor = themeColors?.glow || 'rgba(20, 184, 166, 0.35)';
  const silenceLineColor = remainingMs < 900 ? '#E5A93C' : accentColor;

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
          {/* Organischer Verbinder nach unten zum Sechseck */}
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-2 bg-[#191C22] rounded-t-full border-t border-x border-[#14B8A6]/40 pointer-events-none" />

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
              onClick={handleManualMicToggle}
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
              onClick={() => updateStage(2)}
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
                onClick={() => {
                  const willOpen = !showStage1TextInput;
                  if (willOpen) {
                    isTypingPausedRef.current = true;
                    clearVoiceTimers();
                  }
                  setShowStage1TextInput(willOpen);
                }}
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
            enabled={offlineAudioBufferEnabled !== false}
            activeProjectId={resolvedProjectId}
            userApiKey={userApiKey}
            memos={effectiveOfflineMemos}
            onSaveMemos={handleSaveOfflineMemos}
            onSubmitTranscript={(text) => {
              unlockAudioPlayback();
              autoSendTriggeredRef.current = true;
              void triggerProcess(text);
            }}
            compact
          />

          {/* Ausklappbare schmale Texteingabezeile in Stufe 1 */}
          {showStage1TextInput && (
            <div className="pt-2 border-t border-white/5 flex items-center gap-2 animate-fadeIn">
              <input
                type="text"
                value={transcript}
                onChange={(e) => {
                  isTypingPausedRef.current = true;
                  clearVoiceTimers();
                  setTranscript(e.target.value);
                  transcriptRef.current = e.target.value;
                  accumulatedPrefixRef.current = e.target.value.trim();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && transcript.trim()) {
                    unlockAudioPlayback();
                    autoSendTriggeredRef.current = true;
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
                    unlockAudioPlayback();
                    autoSendTriggeredRef.current = true;
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
                onClick={() => {
                  const current = settingsRef.current;
                  const next: 'flash' | 'research' = current.activeAiMode === 'flash' ? 'research' : 'flash';
                  const nextPreferred =
                    next === 'research'
                      ? (current.preferredModelMode === 'ALWAYS_FLASH' ? 'SMART_PRO' : current.preferredModelMode)
                      : (current.preferredModelMode === 'ALWAYS_PRO' ? 'SMART_PRO' : current.preferredModelMode);
                  if (onUpdateAiVoiceSettings) {
                    onUpdateAiVoiceSettings({ activeAiMode: next, preferredModelMode: nextPreferred });
                  } else {
                    setLocalAiMode(next);
                    saveActiveAiMode(next);
                  }
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
                  const next = !settingsRef.current.ttsEnabled;
                  if (next) {
                    unlockAudioPlayback();
                  }
                  if (onUpdateAiVoiceSettings) {
                    onUpdateAiVoiceSettings({ ttsEnabled: next });
                  } else {
                    setLocalTtsActive(next);
                    setTtsEnabled(next);
                  }
                  if (!next) {
                    stopAllSpeech();
                    if (voicePhaseRef.current === 'SPEAKING') {
                      micLockedRef.current = false;
                      setPhase('IDLE');
                    }
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
        {prefs.quickCommands && prefs.quickCommands.length > 0 && (
          <div className="px-3.5 py-2 border-b border-white/5 bg-[#1C2024] flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            {prefs.quickCommands.map((cmd, idx) => (
              <button
                type="button"
                key={idx}
                disabled={isProcessing}
                onClick={() => {
                  unlockAudioPlayback();
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
                      : msg.isErrorFallback
                        ? 'bg-[#191C22] text-[#F1F5F9] border border-[#E5A93C]/50 rounded-bl-sm'
                        : 'bg-[#24292E] text-[#F8F9FA] border border-white/10 rounded-bl-sm'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 mb-1 text-xs opacity-70">
                    <span className={msg.isErrorFallback ? 'text-[#E5A93C] font-semibold' : ''}>
                      {msg.role === 'user' ? 'Eingabe' : msg.engine || 'KI-Agent'}
                    </span>
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

                  {msg.role === 'assistant' && msg.isErrorFallback && (
                    <div className="mt-2.5 pt-2.5 border-t border-[#E5A93C]/20 flex flex-wrap items-center gap-2">
                      {msg.retryText && (
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => {
                            unlockAudioPlayback();
                            autoSendTriggeredRef.current = true;
                            void triggerProcess(msg.retryText!, msg.retryAttachment ?? null);
                          }}
                          data-testid="btn-retry-voice-message"
                          className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold bg-[#E5A93C] text-[#111317] hover:bg-[#eab54d] disabled:opacity-40 active:scale-95 transition flex items-center justify-center gap-1.5"
                        >
                          Nochmal senden
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={Boolean(msg.parkedAsNote)}
                        onClick={() => {
                          const noteText = msg.retryText || msg.text;
                          onSaveAnswerToInfos(
                            enforceMaxSixWords(noteText, 'Geparkte Notiz'),
                            noteText,
                            msg.retryAttachment ?? null
                          );
                          setMessages((prev) =>
                            prev.map((m) => (m.id === msg.id ? { ...m, parkedAsNote: true } : m))
                          );
                        }}
                        data-testid="btn-park-as-note"
                        className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#111317] text-[#E5A93C] border border-[#E5A93C]/40 hover:bg-[#E5A93C]/10 disabled:opacity-50 active:scale-95 transition flex items-center justify-center gap-1.5"
                      >
                        {msg.parkedAsNote ? 'Als Notiz geparkt ✓' : 'Als Notiz parken'}
                      </button>
                    </div>
                  )}

                  {msg.role === 'assistant' && !msg.isErrorFallback && (!msg.actions || msg.actions.length === 0) && (
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

        {/* Isolierter Offline-Audio-Puffer fürs Funkloch (Stufe 2) */}
        <OfflineAudioBufferBar
          enabled={offlineAudioBufferEnabled !== false}
          activeProjectId={resolvedProjectId}
          userApiKey={userApiKey}
          memos={effectiveOfflineMemos}
          onSaveMemos={handleSaveOfflineMemos}
          onSubmitTranscript={(text) => {
            unlockAudioPlayback();
            autoSendTriggeredRef.current = true;
            void triggerProcess(text);
          }}
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
              <input type="file" className="hidden" onChange={handleFileUpload} />
            </label>

            <input
              type="text"
              value={transcript}
              onChange={(e) => {
                isTypingPausedRef.current = true;
                clearVoiceTimers();
                setTranscript(e.target.value);
                transcriptRef.current = e.target.value;
                accumulatedPrefixRef.current = e.target.value.trim();
                lastSpeechTimestampRef.current = Date.now();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && transcript.trim()) {
                  unlockAudioPlayback();
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
                  unlockAudioPlayback();
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
                onClick={handleManualMicToggle}
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
      </div>
    </div>
  );
};
