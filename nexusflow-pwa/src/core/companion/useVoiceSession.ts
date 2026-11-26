import React, { useEffect, useRef, useState } from 'react';
import {
  AiExecutedAction,
  AiVoiceSettings,
  Attachment,
  BanditUserPreferences,
  OfflineAudioMemo,
  Project,
  VoiceInteractionMode
} from '../../types';
import {
  compressImageFile,
  enforceMaxSixWords,
  getPreferredModelMode,
  getTtsEnabled,
  resolveEffectiveAiMode,
  setTtsEnabled,
  speakText,
  stopAllSpeech,
  triggerHapticFeedback,
  unlockAudioPlayback
} from '../../services/aiRouter';
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
  loadUserPrefs,
  saveActiveAiMode,
  saveIdbItem,
  saveOfflineAudioMemos
} from '../../services/storage';
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
} from '../../config/runtimeConfig';
import { classifyLiveSpeechIntent } from '../../services/voiceModeClassifier';
import { useWakeLock } from '../../hooks/useWakeLock';
import {
  copyTextToClipboard,
  formatChatAsMarkdown,
  formatChatAsPlainText,
  triggerTextDownload
} from './companionExport';

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
  companionMessageToolsEnabled?: boolean;
  companionQuickChipsEnabled?: boolean;
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
      overrideAiMode?: 'flash' | 'research';
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
  onSaveChatAsKnowledge?: (title: string, content: string) => void;
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

export interface UseVoiceSessionReturn {
  // State & Phasen
  messages: ConversationMessage[];
  transcript: string;
  voicePhase: VoicePhase;
  isListening: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  isCooldown: boolean;
  speechNotice: string;
  voiceStatusNotice: string | null;
  shareIntakeNotice: string | null;
  showSlowThinkingNotice: boolean;
  wakeLockActive: boolean;
  attachment: Attachment | null;
  currentStage: 1 | 2;
  showStage1TextInput: boolean;
  ttsActive: boolean;
  aiMode: 'flash' | 'research';
  upscaleNotice: string | null;
  prefs: BanditUserPreferences;
  messageToolsEnabled: boolean;
  quickChipsEnabled: boolean;

  // Abgeleitete UI-Werte
  hasSpokenText: boolean;
  progressPercent: number;
  activeProjects: Project[];
  projectColor: string;
  accentColor: string;
  glowColor: string;
  silenceLineColor: string;
  lastAssistantMsg: ConversationMessage | undefined;
  lastAction: AiExecutedAction | undefined;
  resolvedProjectId: string;
  effectiveOfflineMemos: OfflineAudioMemo[];

  // Refs für UI
  scrollEndRef: React.RefObject<HTMLDivElement>;

  // Aktionen & Handler
  updateStage: (newStage: 1 | 2 | 0) => void;
  handleManualMicToggle: () => void;
  handleToggleStage1TextInput: () => void;
  handleTranscriptChange: (value: string) => void;
  handleSubmitTranscript: (overrideText?: string) => void;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  clearAttachment: () => void;
  handleToggleAiMode: () => void;
  handleToggleTts: () => void;
  handleClearMessages: () => void;
  handleSaveOfflineMemos: (next: OfflineAudioMemo[]) => void;
  handleUndoAction: (messageId: string, logId: string, actionId: string) => void;
  handleRetryMessage: (msg: ConversationMessage) => void;
  handleParkMessageAsNote: (msg: ConversationMessage) => void;
  handleSaveMessageAsInfo: (msg: ConversationMessage) => void;
  handleStage1TouchStart: (clientY: number) => void;
  handleStage1TouchEnd: (clientY: number) => void;
  handleHeaderTouchStart: (clientY: number) => void;
  handleHeaderTouchEnd: (clientY: number) => void;
  reprocessPrompt: (
    promptText: string,
    options?: { attachment?: Attachment | null; mode?: 'flash' | 'research' }
  ) => void;
  loadPromptIntoComposer: (promptText: string) => void;
  exportChatTranscript: (format: 'clipboard' | 'markdown' | 'text') => Promise<boolean>;
  saveChatAsProjectKnowledge: () => boolean;
  speakAssistantMessage: (text: string) => void;
}

/**
 * Kapselt die komplette 5-Zustands-Sprach-Engine, STT-Hardening, Audio-Unlock,
 * TTS-Playback, Timeout-/Retry-Steuerung und Chat-Persistenz für VoiceModal.
 */
export function useVoiceSession(props: VoiceModalProps): UseVoiceSessionReturn {
  const {
    open,
    stage = 1,
    autoStartMic = true,
    wakeLockEnabled = true,
    companionMessageToolsEnabled,
    companionQuickChipsEnabled,
    activeProjectId,
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
    onExecuteCommand,
    onSaveAnswerToInfos,
    onSaveChatAsKnowledge,
    onUndoAiAction,
    onListeningChange,
    onProcessingChange,
    onSpeakingChange
  } = props;

  const [messages, setMessages] = useState<ConversationMessage[]>(() => {
    return getIdbItemSync<ConversationMessage[]>(STORAGE_KEYS.AI_CHAT, []);
  });
  const messagesRef = useRef<ConversationMessage[]>(messages);
  messagesRef.current = messages;

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
  const attachmentRef = useRef<Attachment | null>(attachment);
  attachmentRef.current = attachment;

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
  const currentStageRef = useRef<1 | 2>(currentStage);
  currentStageRef.current = currentStage;
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
  const messageToolsEnabled =
    companionMessageToolsEnabled !== undefined
      ? companionMessageToolsEnabled
      : prefs.companionMessageToolsEnabled !== false;
  const quickChipsEnabled =
    companionQuickChipsEnabled !== undefined
      ? companionQuickChipsEnabled
      : prefs.companionQuickChipsEnabled !== false;

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

  const triggerProcess = async (
    textToProcess: string,
    overrideAttachment?: Attachment | null,
    overrideAiMode?: 'flash' | 'research'
  ) => {
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
    const effectiveModeForRequest = overrideAiMode || currentSettings.activeAiMode;
    const requestSettings: AiVoiceSettings = overrideAiMode
      ? { ...currentSettings, activeAiMode: overrideAiMode }
      : currentSettings;
    const currentAtt = overrideAttachment !== undefined ? overrideAttachment : attachmentRef.current;
    const { effectiveMode: resolvedTimeoutMode } = resolveEffectiveAiMode(
      clean,
      currentAtt,
      effectiveModeForRequest,
      requestSettings
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

    const recentHistory = messagesRef.current
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
      if (currentStageRef.current === 1 && (result.needsClarification || isErr || result.replyText.length > 120)) {
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
        effectiveModeForRequest,
        recentHistory,
        {
          signal: controller.signal,
          settings: requestSettings,
          hintMode: requestHintMode,
          previousMode: requestPrevMode,
          overrideAiMode
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

  const clearAttachment = () => {
    setAttachment(null);
  };

  const handleToggleStage1TextInput = () => {
    const willOpen = !showStage1TextInput;
    if (willOpen) {
      isTypingPausedRef.current = true;
      clearVoiceTimers();
    }
    setShowStage1TextInput(willOpen);
  };

  const handleTranscriptChange = (value: string) => {
    isTypingPausedRef.current = true;
    clearVoiceTimers();
    setTranscript(value);
    transcriptRef.current = value;
    accumulatedPrefixRef.current = value.trim();
    lastSpeechTimestampRef.current = Date.now();
  };

  const handleSubmitTranscript = (overrideText?: string) => {
    const rawCandidate =
      overrideText !== undefined
        ? overrideText
        : transcriptRef.current.trim() || (attachmentRef.current ? 'Foto oder Datei auswerten' : '');
    if (!rawCandidate.trim()) return;
    unlockAudioPlayback();
    autoSendTriggeredRef.current = true;
    void triggerProcess(rawCandidate);
  };

  const reprocessPrompt = (
    promptText: string,
    options?: { attachment?: Attachment | null; mode?: 'flash' | 'research' }
  ) => {
    const clean = promptText.trim();
    if (!clean || voicePhaseRef.current === 'PROCESSING' || isSendingRef.current) return;
    unlockAudioPlayback();
    autoSendTriggeredRef.current = true;
    void triggerProcess(clean, options?.attachment ?? null, options?.mode);
  };

  const loadPromptIntoComposer = (promptText: string) => {
    isTypingPausedRef.current = true;
    clearVoiceTimers();
    setTranscript(promptText);
    transcriptRef.current = promptText;
    accumulatedPrefixRef.current = promptText.trim();
    lastSpeechTimestampRef.current = Date.now();
  };

  const exportChatTranscript = async (
    format: 'clipboard' | 'markdown' | 'text'
  ): Promise<boolean> => {
    const currentMsgs = messagesRef.current;
    if (format === 'clipboard') {
      const plain = formatChatAsPlainText(currentMsgs, activeProjectName);
      return copyTextToClipboard(plain);
    }
    const dateStamp = new Date().toISOString().slice(0, 10);
    if (format === 'markdown') {
      const md = formatChatAsMarkdown(currentMsgs, activeProjectName);
      triggerTextDownload(`banditos-chat-${dateStamp}.md`, md, 'text/markdown;charset=utf-8');
      return true;
    }
    const txt = formatChatAsPlainText(currentMsgs, activeProjectName);
    triggerTextDownload(`banditos-chat-${dateStamp}.txt`, txt, 'text/plain;charset=utf-8');
    return true;
  };

  const saveChatAsProjectKnowledge = (): boolean => {
    const currentMsgs = messagesRef.current;
    if (currentMsgs.length === 0) return false;
    const title = enforceMaxSixWords(
      `Begleiter-Chat ${new Date().toLocaleDateString('de-DE')}`,
      'Begleiter-Chat'
    );
    const content = formatChatAsMarkdown(currentMsgs, activeProjectName);
    if (onSaveChatAsKnowledge) {
      onSaveChatAsKnowledge(title, content);
    } else {
      onSaveAnswerToInfos(title, content, null);
    }
    return true;
  };

  const speakAssistantMessage = (text: string) => {
    if (!text.trim()) return;
    unlockAudioPlayback();
    stopAllSpeech();
    void speakText(text, undefined, undefined, settingsRef.current);
  };

  const handleToggleAiMode = () => {
    const current = settingsRef.current;
    const next: 'flash' | 'research' = current.activeAiMode === 'flash' ? 'research' : 'flash';
    const nextPreferred =
      next === 'research'
        ? current.preferredModelMode === 'ALWAYS_FLASH'
          ? 'SMART_PRO'
          : current.preferredModelMode
        : current.preferredModelMode === 'ALWAYS_PRO'
          ? 'SMART_PRO'
          : current.preferredModelMode;
    if (onUpdateAiVoiceSettings) {
      onUpdateAiVoiceSettings({ activeAiMode: next, preferredModelMode: nextPreferred });
    } else {
      setLocalAiMode(next);
      saveActiveAiMode(next);
    }
    triggerHapticFeedback(12);
  };

  const handleToggleTts = () => {
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
  };

  const handleClearMessages = () => {
    setMessages([]);
    saveIdbItem(STORAGE_KEYS.AI_CHAT, []);
  };

  const handleUndoAction = (messageId: string, logId: string, actionId: string) => {
    if (!onUndoAiAction) return;
    onUndoAiAction(logId, actionId);
    setMessages((prev) =>
      prev.map((m) =>
        m.id !== messageId
          ? m
          : {
              ...m,
              actions: m.actions?.map((a) =>
                a.actionId === actionId ? { ...a, undone: true } : a
              )
            }
      )
    );
  };

  const handleRetryMessage = (msg: ConversationMessage) => {
    if (!msg.retryText) return;
    unlockAudioPlayback();
    autoSendTriggeredRef.current = true;
    void triggerProcess(msg.retryText, msg.retryAttachment ?? null);
  };

  const handleParkMessageAsNote = (msg: ConversationMessage) => {
    const noteText = msg.retryText || msg.text;
    onSaveAnswerToInfos(
      enforceMaxSixWords(noteText, 'Geparkte Notiz'),
      noteText,
      msg.retryAttachment ?? null
    );
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, parkedAsNote: true } : m))
    );
  };

  const handleSaveMessageAsInfo = (msg: ConversationMessage) => {
    onSaveAnswerToInfos('KI-Notiz', msg.text, null);
  };

  const handleStage1TouchStart = (clientY: number) => {
    stage1TouchYRef.current = clientY;
  };

  const handleStage1TouchEnd = (clientY: number) => {
    if (stage1TouchYRef.current !== null) {
      const deltaY = clientY - stage1TouchYRef.current;
      if (deltaY < -40) {
        updateStage(2);
      } else if (deltaY > 40) {
        updateStage(0);
      }
    }
    stage1TouchYRef.current = null;
  };

  const handleHeaderTouchStart = (clientY: number) => {
    headerTouchYRef.current = clientY;
  };

  const handleHeaderTouchEnd = (clientY: number) => {
    if (headerTouchYRef.current !== null) {
      const deltaY = clientY - headerTouchYRef.current;
      if (deltaY > 50) {
        updateStage(1);
      }
    }
    headerTouchYRef.current = null;
  };

  const hasSpokenText = transcript.trim().length > 0;
  const progressPercent = Math.min(
    100,
    Math.max(0, (remainingMs / Math.max(1, silenceLimitMs)) * 100)
  );
  const activeProjects = projects.filter((p) => !p.archived);
  const projectColor = themeColors?.primary || '#0D9488';
  const accentColor = themeColors?.highlight || themeColors?.primary || '#14B8A6';
  const glowColor = themeColors?.glow || 'rgba(20, 184, 166, 0.35)';
  const silenceLineColor = remainingMs < 900 ? '#E5A93C' : accentColor;

  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === 'assistant');
  const lastAction = lastAssistantMsg?.actions?.[0];

  return {
    messages,
    transcript,
    voicePhase,
    isListening,
    isProcessing,
    isSpeaking,
    isCooldown,
    speechNotice,
    voiceStatusNotice,
    shareIntakeNotice,
    showSlowThinkingNotice,
    wakeLockActive,
    attachment,
    currentStage,
    showStage1TextInput,
    ttsActive,
    aiMode,
    upscaleNotice,
    prefs,
    messageToolsEnabled,
    quickChipsEnabled,
    hasSpokenText,
    progressPercent,
    activeProjects,
    projectColor,
    accentColor,
    glowColor,
    silenceLineColor,
    lastAssistantMsg,
    lastAction,
    resolvedProjectId,
    effectiveOfflineMemos,
    scrollEndRef,
    updateStage,
    handleManualMicToggle,
    handleToggleStage1TextInput,
    handleTranscriptChange,
    handleSubmitTranscript,
    handleFileUpload,
    clearAttachment,
    handleToggleAiMode,
    handleToggleTts,
    handleClearMessages,
    handleSaveOfflineMemos,
    handleUndoAction,
    handleRetryMessage,
    handleParkMessageAsNote,
    handleSaveMessageAsInfo,
    handleStage1TouchStart,
    handleStage1TouchEnd,
    handleHeaderTouchStart,
    handleHeaderTouchEnd,
    reprocessPrompt,
    loadPromptIntoComposer,
    exportChatTranscript,
    saveChatAsProjectKnowledge,
    speakAssistantMessage
  };
}
