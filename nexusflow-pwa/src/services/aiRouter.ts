import { AiActionType, AiVoiceSettings, Attachment, KnowledgeKind, PriorityType, Project, VoiceInteractionMode } from '../types';
import { BRAND_CONFIG } from '../config/brandConfig';
import { STORAGE_KEYS, getActiveAiMode, getIdbItemSync, saveIdbItem } from './storage';
import { speakText, stopAllSpeech, stopSpeaking, testGiselaVoice, unlockAudioPlayback } from './azureSpeech';
import { classifyLiveSpeechIntent } from './voiceModeClassifier';

export { speakText, stopAllSpeech, stopSpeaking, testGiselaVoice, unlockAudioPlayback };

export interface BanditUserPreferences {
  // Schaltbare ADHS-Unterstützung
  adhdMasterEnabled: boolean;
  adhdFocusAnchor: boolean;       // 1. "Wo war ich gerade?"-Anker oben anpinnen
  adhdSingleTaskMode: boolean;    // 2. 1-Fokus-Blende gegen Paralyse verfügbar
  adhdTwoMinuteStarter: boolean;  // 3. Automatischer 2-Minuten-Einstieg durch KI
  adhdTimeBufferAndHaptics: boolean; // 4. +25% Zeitpuffer & Haptik-Vibration
  // Update 5: Personalisierung
  uiDensity: 'compact' | 'standard' | 'large';
  aiTone: 'short' | 'partner' | 'coach';
  organicMotion: boolean;
  quickCommands: string[];
  activeFocusTaskId: string | null;
  activeFocusTaskTitle: string | null;
  activeFocusProjectId: string | null;
}

export const DEFAULT_USER_PREFS: BanditUserPreferences = {
  adhdMasterEnabled: true,
  adhdFocusAnchor: true,
  adhdSingleTaskMode: true,
  adhdTwoMinuteStarter: true,
  adhdTimeBufferAndHaptics: true,
  uiDensity: 'standard',
  aiTone: 'partner',
  organicMotion: true,
  quickCommands: [
    'Gib mir ein kurzes 3-Punkte-Briefing für dieses Projekt',
    'Welche Materialien fehlen noch im Einkaufswagen?',
    'Brich mir die nächste große Aufgabe in 2-Minuten-Schritte herunter'
  ],
  activeFocusTaskId: null,
  activeFocusTaskTitle: null,
  activeFocusProjectId: null
};

export function loadUserPrefs(): BanditUserPreferences {
  return getIdbItemSync<BanditUserPreferences>(STORAGE_KEYS.USER_PREFS, DEFAULT_USER_PREFS);
}

export function saveUserPrefs(prefs: BanditUserPreferences): void {
  saveIdbItem(STORAGE_KEYS.USER_PREFS, prefs);
}

export function triggerHapticFeedback(pattern: number | number[] = 14): void {
  const prefs = loadUserPrefs();
  if (!prefs.adhdMasterEnabled || !prefs.adhdTimeBufferAndHaptics) return;
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    // ignore
  }
}

/**
 * Update 1 (Performance): Komprimiert große Handy-Fotos automatisch vor dem Speichern in IndexedDB
 */
export async function compressImageFile(file: File): Promise<{ dataUrl: string; sizeKB: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rawUrl = String(ev.target?.result || '');
      if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
        resolve({
          dataUrl: rawUrl,
          sizeKB: `${Math.max(1, Math.round(file.size / 1024))} KB`
        });
        return;
      }
      const img = new Image();
      img.onload = () => {
        const maxDim = 1400;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({
            dataUrl: rawUrl,
            sizeKB: `${Math.max(1, Math.round(file.size / 1024))} KB`
          });
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', 0.82);
        const approxKB = Math.max(1, Math.round((compressed.length * 0.75) / 1024));
        resolve({ dataUrl: compressed, sizeKB: `${approxKB} KB` });
      };
      img.onerror = () => {
        resolve({
          dataUrl: rawUrl,
          sizeKB: `${Math.max(1, Math.round(file.size / 1024))} KB`
        });
      };
      img.src = rawUrl;
    };
    reader.readAsDataURL(file);
  });
}

export function getPreferredModelMode(): string {
  return getIdbItemSync<string>(STORAGE_KEYS.PREFERRED_MODEL, 'SMART_PRO');
}

export function setPreferredModelMode(mode: string): void {
  saveIdbItem(STORAGE_KEYS.PREFERRED_MODEL, mode);
}

export function getTtsEnabled(): boolean {
  return getIdbItemSync<boolean>(STORAGE_KEYS.TTS_ENABLED, true);
}

export function setTtsEnabled(enabled: boolean): void {
  saveIdbItem(STORAGE_KEYS.TTS_ENABLED, enabled);
}

export interface StructuredAiActionPlan {
  actionType: AiActionType;
  knowledgeKind?: KnowledgeKind;
  targetProjectId: string;
  shortCheckableTitle: string;
  detailedExplanation: string;
  assemblyGroup?: string;
  quantityOrMeasure?: string;
  estimatedPrice?: string;
  changeFooterNote: string;
  estimatedMinutes?: number;
  priority?: PriorityType;
}

export interface StructuredAiResponse {
  summary: string;
  spokenFeedback: string;
  directAnswer?: string;
  isQuestion?: boolean;
  needsClarification?: boolean;
  detectedMode?: VoiceInteractionMode;
  expectFollowUp?: boolean;
  actions: StructuredAiActionPlan[];
}

export interface ChatTurnHistory {
  role: 'user' | 'assistant';
  text: string;
}

export const DEMO_VOICE_COMMANDS: Array<{ id: string; label: string; text: string }> = [];

export const enforceMaxSixWords = (str: string, fallback = 'Neuer Eintrag'): string => {
  if (!str || typeof str !== 'string') return fallback;
  const words = str.trim().replace(/\s+/g, ' ').split(' ');
  return words.length <= 6 ? words.join(' ') : words.slice(0, 6).join(' ');
};

export async function fetchAvailableGeminiModels(
  apiKey: string,
  signal?: AbortSignal
): Promise<string[]> {
  const cleanKey = apiKey.trim();
  if (!cleanKey || signal?.aborted) return [];
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cleanKey)}`,
      { signal }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const models: string[] = (data.models || [])
      .filter(
        (m: any) =>
          Array.isArray(m.supportedGenerationMethods) &&
          m.supportedGenerationMethods.includes('generateContent') &&
          typeof m.name === 'string' &&
          m.name.includes('gemini') &&
          !m.name.includes('embedding') &&
          !m.name.includes('vision-only')
      )
      .map((m: any) => String(m.name).replace(/^models\//, ''));

    return models.sort((a, b) => {
      const verA = parseFloat(a.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] || '0');
      const verB = parseFloat(b.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] || '0');
      if (verB !== verA) return verB - verA;
      const isProA = a.includes('pro') ? 1 : 0;
      const isProB = b.includes('pro') ? 1 : 0;
      return isProB - isProA;
    });
  } catch {
    return [];
  }
}

const DEEP_ANALYSIS_REGEX =
  /(tiefenanalyse|ausführlicher\s+vergleich|rechtlich\s+prüfen|gutachten)/i;

export function resolveEffectiveAiMode(
  rawText: string,
  attachment?: Attachment | null,
  requestedMode?: 'flash' | 'research',
  settings?: Partial<AiVoiceSettings>
): { effectiveMode: 'flash' | 'research'; autoUpscaledToPro: boolean; preferredModelMode: string } {
  const preferredModelMode = settings?.preferredModelMode ?? getPreferredModelMode();
  const currentMode = requestedMode || settings?.activeAiMode || getActiveAiMode() || 'flash';
  const hasPhoto = Boolean(attachment && attachment.dataUrl && attachment.dataUrl.startsWith('data:image/'));
  const isDeepAnalysisQuery = DEEP_ANALYSIS_REGEX.test(rawText);

  if (preferredModelMode === 'ALWAYS_PRO') {
    return { effectiveMode: 'research', autoUpscaledToPro: false, preferredModelMode };
  }
  if (preferredModelMode === 'ALWAYS_FLASH') {
    return { effectiveMode: 'flash', autoUpscaledToPro: false, preferredModelMode };
  }

  const autoUpscaledToPro = currentMode === 'flash' && (hasPhoto || isDeepAnalysisQuery);
  return {
    effectiveMode: autoUpscaledToPro ? 'research' : currentMode,
    autoUpscaledToPro,
    preferredModelMode
  };
}

async function buildModelCandidateList(
  _apiKey: string,
  _task: 'sort' | 'qa',
  effectiveMode?: 'flash' | 'research',
  preferredModelModeOverride?: string
): Promise<string[]> {
  const mode = (preferredModelModeOverride || getPreferredModelMode() || 'SMART_PRO').trim();
  const defaultsProFirst = ['gemini-2.5-pro', 'gemini-2.5-flash'];
  const defaultsFlashFirst = ['gemini-2.5-flash', 'gemini-2.5-pro'];

  let baseList: string[] = [];
  if (mode !== 'SMART_PRO' && mode !== 'ALWAYS_PRO' && mode !== 'ALWAYS_FLASH') {
    // Direkte Modellwahl aus Zentrale hat Vorrang
    baseList = [mode, ...(effectiveMode === 'research' ? defaultsProFirst : defaultsFlashFirst)];
  } else if (mode === 'ALWAYS_PRO') {
    baseList = defaultsProFirst;
  } else if (mode === 'ALWAYS_FLASH') {
    baseList = defaultsFlashFirst;
  } else {
    // SMART_PRO: Research-Modus / Foto / Tiefenanalyse -> Pro zuerst, normale Befehle & Fragen -> Flash zuerst
    baseList = effectiveMode === 'research' ? defaultsProFirst : defaultsFlashFirst;
  }

  return Array.from(new Set(baseList));
}

function withFlashThinkingDisabled(
  payload: Record<string, unknown>,
  modelName: string,
  effectiveMode?: 'flash' | 'research'
): { bodyPayload: Record<string, unknown>; usedThinkingConfig: boolean } {
  const shouldDisableThinking =
    effectiveMode === 'flash' && modelName.includes('2.5-flash') && payload.generationConfig;
  if (!shouldDisableThinking) {
    return { bodyPayload: payload, usedThinkingConfig: false };
  }
  return {
    bodyPayload: {
      ...payload,
      generationConfig: {
        ...(payload.generationConfig as Record<string, unknown>),
        thinkingConfig: { thinkingBudget: 0 }
      }
    },
    usedThinkingConfig: true
  };
}

async function callGeminiWithAutoFallback(
  apiKey: string,
  task: 'sort' | 'qa',
  payload: Record<string, unknown>,
  effectiveMode?: 'flash' | 'research',
  preferredModelModeOverride?: string,
  signal?: AbortSignal
): Promise<{ ok: boolean; data?: any; usedModel: string; errorMessage?: string; aborted?: boolean }> {
  const cleanKey = apiKey.trim();
  const candidates = await buildModelCandidateList(
    cleanKey,
    task,
    effectiveMode,
    preferredModelModeOverride
  );
  let lastError = 'Unbekannter API-Fehler';
  let hitNon404Failure = false;

  for (const modelName of candidates) {
    if (signal?.aborted) {
      return { ok: false, usedModel: modelName, errorMessage: 'Abgebrochen', aborted: true };
    }
    const endpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=` +
      encodeURIComponent(cleanKey);

    try {
      const { bodyPayload, usedThinkingConfig } = withFlashThinkingDisabled(
        payload,
        modelName,
        effectiveMode
      );
      let res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
        signal
      });

      // Sicherer Retry ohne thinkingConfig, falls das Modell den Parameter mit HTTP 400 ablehnt
      if (res.status === 400 && usedThinkingConfig && !signal?.aborted) {
        res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal
        });
      }

      if (res.ok) {
        const data = await res.json();
        return { ok: true, data, usedModel: modelName };
      }

      const errData = await res.json().catch(() => ({}));
      lastError = errData?.error?.message || `HTTP ${res.status}`;
      if (res.status === 404) {
        continue;
      }
      hitNon404Failure = true;
      break;
    } catch (err: any) {
      if (signal?.aborted || err?.name === 'AbortError') {
        return { ok: false, usedModel: modelName, errorMessage: 'Abgebrochen', aborted: true };
      }
      lastError = err?.message || 'Netzwerkfehler';
      hitNon404Failure = true;
      break;
    }
  }

  // Live-Modellermittlung ausschließlich dann, wenn ALLE Kandidaten mit 404 (Modell nicht gefunden) scheiterten
  if (hitNon404Failure || signal?.aborted) {
    return {
      ok: false,
      usedModel: candidates[0],
      errorMessage: signal?.aborted ? 'Abgebrochen' : lastError,
      aborted: Boolean(signal?.aborted)
    };
  }

  const liveModels = await fetchAvailableGeminiModels(cleanKey, signal);
  for (const liveModel of liveModels.slice(0, 3)) {
    if (signal?.aborted) {
      return { ok: false, usedModel: liveModel, errorMessage: 'Abgebrochen', aborted: true };
    }
    const endpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/${liveModel}:generateContent?key=` +
      encodeURIComponent(cleanKey);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal
      });
      if (res.ok) {
        const data = await res.json();
        return { ok: true, data, usedModel: liveModel };
      }
      const errData = await res.json().catch(() => ({}));
      lastError = errData?.error?.message || `HTTP ${res.status}`;
      if (res.status !== 404) break;
    } catch (err: any) {
      if (signal?.aborted || err?.name === 'AbortError') {
        return { ok: false, usedModel: liveModel, errorMessage: 'Abgebrochen', aborted: true };
      }
      lastError = err?.message || 'Netzwerkfehler';
      break;
    }
  }

  return { ok: false, usedModel: candidates[0], errorMessage: lastError };
}

const AI_ROUTER_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    isQuestion: {
      type: 'BOOLEAN',
      description: 'TRUE bei Fragen, Beratungen, Briefings oder Rückfragen. FALSE bei reinen Befehlen.'
    },
    needsClarification: {
      type: 'BOOLEAN',
      description: 'TRUE, wenn eine Angabe unklar ist und das Mikrofon nach der Antwort direkt wieder zuhören soll.'
    },
    detectedMode: {
      type: 'STRING',
      enum: ['quick', 'collect', 'dialog'],
      description: 'Erkannter Gesprächsmodus: quick (kurzer Befehl), collect (mehrteiliges Einsammeln), dialog (Beratung/Nachdenken).'
    },
    expectFollowUp: {
      type: 'BOOLEAN',
      description: 'TRUE, wenn nach der Antwort ein direkter Anschlussbeitrag erwartet wird (collect, dialog oder Rückfrage). FALSE bei abgeschlossenen Quick-Befehlen.'
    },
    spokenFeedback: {
      type: 'STRING',
      description: 'Gesprochene Rückmeldung. Bei kurzen Befehlen nur 2-4 Wörter ("Ist erledigt."). Bei Fragen/Briefings eine prägnante gesprochene Antwort.'
    },
    directAnswer: {
      type: 'STRING',
      description: 'Ausführliche, sachliche Textantwort für das KI-Kontextfenster (ohne Emojis).'
    },
    summary: {
      type: 'STRING',
      description: 'Kurzfassung der durchgeführten Aktionen.'
    },
    actions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          actionType: {
            type: 'STRING',
            enum: [
              'ADD_TASK',
              'ADD_KNOWLEDGE',
              'UPDATE_EXPLANATION',
              'ADD_INFO',
              'ADD_CART_ITEM',
              'CHECK_OFF_TASK'
            ]
          },
          targetProjectId: {
            type: 'STRING'
          },
          shortCheckableTitle: {
            type: 'STRING',
            description: 'STRIKT maximal 6 Wörter, sachlich, ohne Emojis.'
          },
          detailedExplanation: {
            type: 'STRING',
            description: 'Technische Details, Maße oder der erste 2-Minuten-Handgriff.'
          },
          assemblyGroup: {
            type: 'STRING',
            description: 'Optionale Baugruppe oder Phase, z. B. "1. Auszugtisch", "3. Ofen/Gas", "Deckenbau".'
          },
          quantityOrMeasure: {
            type: 'STRING'
          },
          estimatedPrice: {
            type: 'STRING'
          },
          changeFooterNote: {
            type: 'STRING'
          },
          estimatedMinutes: {
            type: 'NUMBER'
          },
          priority: {
            type: 'STRING',
            enum: ['Niedrig', 'Mittel', 'Hoch']
          }
        },
        required: [
          'actionType',
          'targetProjectId',
          'shortCheckableTitle',
          'detailedExplanation',
          'changeFooterNote',
          'priority'
        ]
      }
    }
  },
  required: ['isQuestion', 'needsClarification', 'spokenFeedback', 'directAnswer', 'summary', 'actions']
};

function buildWorkspaceContextSummary(projects: Project[], activeProjectId?: string): string {
  if (!Array.isArray(projects) || projects.length === 0) return 'Keine Projekte geladen.';
  const activeProjects = projects.filter((p) => !p.archived);
  if (activeProjects.length === 0) return 'Keine aktiven Projekte geladen.';

  const resolvedActiveId =
    activeProjectId && activeProjects.some((p) => p.id === activeProjectId)
      ? activeProjectId
      : activeProjects[0].id;

  return activeProjects
    .map((p) => {
      if (p.id === resolvedActiveId) {
        const openTasks = p.tasks
          .filter((t) => !t.completed)
          .slice(0, 10)
          .map((t) => `- [Task] ${t.title}${t.assemblyGroup ? ` (Gruppe: ${t.assemblyGroup})` : ''}`)
          .join('\n');
        const openCart = p.cart
          .filter((c) => !c.completed)
          .slice(0, 8)
          .map((c) => `- [Einkauf] ${c.title} (${c.quantity})`)
          .join('\n');
        const knowledgeTitles = (p.knowledge || [])
          .slice(0, 5)
          .map((k) => `- [Wissen] ${String(k.title || '').trim().slice(0, 80)}`)
          .join('\n');
        return `PROJEKT ID="${p.id}" | NAME="${p.name}" | BEREICH="${p.domain}" (AKTIV):\n${
          openTasks || '(Keine offenen Tasks)'
        }${openCart ? `\n${openCart}` : ''}${knowledgeTitles ? `\n${knowledgeTitles}` : ''}`;
      }

      const anchorTitles = [
        ...p.tasks.filter((t) => !t.completed).map((t) => t.title),
        ...p.cart.filter((c) => !c.completed).map((c) => c.title)
      ]
        .slice(0, 3)
        .map((title) => `- ${String(title || '').trim().slice(0, 80)}`)
        .join('\n');

      return `PROJEKT ID="${p.id}" | NAME="${p.name}" | BEREICH="${p.domain}"${
        anchorTitles ? `:\n${anchorTitles}` : ''
      }`;
    })
    .join('\n\n');
}

export function buildLocalFallbackPlan(
  rawText: string,
  defaultProjectId: string,
  allProjects?: Project[],
  hintMode?: VoiceInteractionMode,
  previousMode?: VoiceInteractionMode | null
): StructuredAiResponse {
  const prefs = loadUserPrefs();
  const trimmed = rawText.trim();
  const classifiedHint = hintMode || classifyLiveSpeechIntent(trimmed, previousMode).mode;
  const isQuestion =
    trimmed.endsWith('?') ||
    /^(wie|was|wo|wann|warum|welche|welcher|welches|kannst du|weißt du|zeig mir|gib mir)/i.test(
      trimmed
    );

  if (isQuestion) {
    return {
      isQuestion: true,
      needsClarification: false,
      detectedMode: 'dialog',
      expectFollowUp: true,
      spokenFeedback: 'Bitte prüfe den API-Schlüssel in den Einstellungen.',
      directAnswer:
        'Offline-Modus aktiv: Für autonome Antworten und Analysen bitte in den Einstellungen unter KI-Schnittstelle den Gemini API-Key prüfen.',
      summary: 'Frage im Offline-Modus',
      actions: []
    };
  }

  // Rückfrage-Schutz bei neutralen / mehrdeutigen Begriffen ohne Projektkontext
  const isAmbiguous =
    /(?:^|\b)(silikon|schrauben|maße|acryl|dichtband|malerband|dübel|nägel)(?:\b|$)/i.test(trimmed) &&
    !/(foodtruck|anhänger|tsa|pizza|baustelle|bäckerei|backstube|privat|smarthome)/i.test(trimmed);

  if (isAmbiguous) {
    return {
      isQuestion: true,
      needsClarification: true,
      detectedMode: classifiedHint,
      expectFollowUp: true,
      spokenFeedback: 'Für welches Projekt soll ich das eintragen – Foodtruck oder Baustelle?',
      directAnswer:
        'Rückfrage: Zu welchem Projekt gehört das (z. B. Pizza Bandit Foodtruck oder Baustelle Bäckerei)?',
      summary: 'Rückfrage zu Projektzuordnung',
      actions: []
    };
  }

  const segments = trimmed
    .split(
      /;|\.\s+|\s+(?:außerdem|zusätzlich|und\s+dann\s+noch|und\s+ergänze|und\s+erstelle|und\s+notiere|und\s+packe|und\s+kaufe|und\s+brauche)\s+/i
    )
    .map((s) => s.trim())
    .filter(Boolean);

  const actions: StructuredAiActionPlan[] = segments.map((seg) => {
    const lower = seg.toLowerCase();
    let targetProjectId = defaultProjectId || BRAND_CONFIG.defaultProjectId;

    for (const pConfig of Object.values(BRAND_CONFIG.projects)) {
      if (pConfig.routingKeywords && pConfig.routingKeywords.test(lower)) {
        const isArchived = allProjects?.find((p) => p.id === pConfig.id)?.archived;
        if (!isArchived) {
          targetProjectId = pConfig.id;
          break;
        }
      }
    }

    let actionType: AiActionType = 'ADD_TASK';
    if (
      /(einkauf|kaufe|besorgen|bestellen|brauche|säcke|paar|rollen|set|pakete|kartusche|schrauben|winkel)/i.test(
        lower
      )
    ) {
      actionType = 'ADD_CART_ITEM';
    } else if (/(erklärung|anleitung|rezept|ablauf|schritt)/i.test(lower)) {
      actionType = 'ADD_KNOWLEDGE';
    } else if (/(wissen|info|maß|maße|merke|notiere\s+info|daten|dossier)/i.test(lower)) {
      actionType = 'ADD_KNOWLEDGE';
    } else if (/(erledigt|abgehakt|ist\s+fertig|gemacht)/i.test(lower)) {
      actionType = 'CHECK_OFF_TASK';
    }

    const cleanTitle = seg
      .replace(/^(packe|ergänze|erstelle|füge|lege|notiere|merke\s+dir|ich\s+muss\s+noch|bitte)\s+/i, '')
      .split(/[:–-]/)[0]
      .trim();

    const starterHint =
      prefs.adhdMasterEnabled && prefs.adhdTwoMinuteStarter && actionType === 'ADD_TASK'
        ? `${seg}\nErster 2-Minuten-Handgriff: Werkzeug und Maßband am Einsatzort bereitlegen.`
        : seg;

    return {
      actionType,
      targetProjectId,
      shortCheckableTitle: enforceMaxSixWords(cleanTitle, 'Neuer Eintrag'),
      detailedExplanation: starterHint,
      quantityOrMeasure: '1x',
      estimatedPrice: '',
      changeFooterNote: 'Lokal zugeordnet',
      estimatedMinutes: 25,
      priority: 'Mittel'
    };
  });

  const resolvedMode: VoiceInteractionMode =
    actions.length > 1 || classifiedHint === 'collect'
      ? 'collect'
      : classifiedHint === 'dialog'
        ? 'dialog'
        : 'quick';
  const expectFollowUp = resolvedMode !== 'quick';
  const fallbackSpoken =
    resolvedMode === 'collect'
      ? `${actions.length} Punkt${actions.length === 1 ? '' : 'e'} geparkt – noch was?`
      : resolvedMode === 'dialog'
        ? `Notiert: ${actions[0]?.shortCheckableTitle || 'Eintrag'}. Worauf sollen wir als Nächstes schauen?`
        : actions.length === 1 && actions[0].actionType === 'ADD_CART_ITEM'
          ? 'Steht auf Einkauf.'
          : 'Ist erledigt.';

  return {
    isQuestion: false,
    needsClarification: false,
    detectedMode: resolvedMode,
    expectFollowUp,
    spokenFeedback: fallbackSpoken,
    directAnswer: `${actions.length} Eintrag/Einträge lokal zugeordnet.`,
    summary: `${actions.length} Punkt(e) zugeordnet.`,
    actions
  };
}

export async function routeVoiceCommand(
  rawText: string,
  apiKey: string,
  defaultProjectId: string,
  allProjects?: Project[],
  chatHistory?: ChatTurnHistory[],
  attachment?: Attachment | null,
  requestedMode?: 'flash' | 'research',
  options?: {
    signal?: AbortSignal;
    settings?: AiVoiceSettings;
    hintMode?: VoiceInteractionMode;
    previousMode?: VoiceInteractionMode | null;
  }
): Promise<{
  plan: StructuredAiResponse;
  engine: string;
  autoUpscaledToPro?: boolean;
  detectedMode?: VoiceInteractionMode;
  expectFollowUp?: boolean;
  aborted?: boolean;
}> {
  const cleanKey = apiKey ? apiKey.trim() : '';
  const prefs = loadUserPrefs();
  const signal = options?.signal;
  const autoHint = options?.hintMode || classifyLiveSpeechIntent(rawText, options?.previousMode).mode;

  // 1-Tipp-Modus: Flash (⚡ Sprech) vs. Research (🧠 Pro) + Intelligenz-Modus aus Zentrale
  const { effectiveMode, autoUpscaledToPro, preferredModelMode } = resolveEffectiveAiMode(
    rawText,
    attachment,
    requestedMode,
    options?.settings
  );

  if (signal?.aborted) {
    return {
      plan: {
        isQuestion: false,
        needsClarification: false,
        spokenFeedback: '',
        directAnswer: '',
        summary: '',
        actions: []
      },
      engine: 'Abgebrochen',
      autoUpscaledToPro,
      aborted: true
    };
  }

  const toneInstruction =
    prefs.aiTone === 'short'
      ? 'Antworte extrem knapp im Kommando-Stil (1-2 Sätze).'
      : prefs.aiTone === 'coach'
        ? 'Antworte strukturiert, motivierend und halte den Fokus des Nutzers auf den nächsten greifbaren Schritt.'
        : 'Antworte als sachlicher, erfahrener technischer Projekt-Partner.';

  const adhdInstruction =
    prefs.adhdMasterEnabled && prefs.adhdTwoMinuteStarter
      ? 'ADHS-STARTHILFE AKTIV: Wenn du einen neuen Task (ADD_TASK) anlegst oder Aufgaben besprichst, füge in "detailedExplanation" immer eine Zeile "Erster 2-Minuten-Handgriff: [konkreter sofort machbarer erster Handgriff]" hinzu.'
      : '';

  const dynamicSystemPrompt = `Du bist der autonome System-Agent von ${BRAND_CONFIG.appName}.
Verwende KEINE Emojis. ${toneInstruction}
${adhdInstruction}

${BRAND_CONFIG.systemPromptProjectContext}

REGELN:
- Du hast vollen Lesezugriff auf alle Projekte, Tasks, Einkäufe und Wissenseinträge (Abläufe & Infos) im Kontext.
- Bei einfachen Befehlen ("Merke dir...", "Leg X in den Einkaufswagen") halte "spokenFeedback" ultrakurz (z. B. "Ist erledigt.").
- Bei Unklarheit setze "needsClarification": true und stelle eine präzise Rückfrage.
- WICHTIG BEI MEHRDEUTIGKEIT: Wenn der Nutzer neutrale Werkzeuge, Baumaterialien oder Maße nennt, die ohne Kontext nicht eindeutig einem Projekt zuordenbar sind (z. B. "Silikon kaufen", "Schrauben besorgen", "Maße nehmen", "Acryl", "Malerband", "Dichtband"), ordne NICHT blind zu! Setze "needsClarification": true, "isQuestion": true, "actions": [] und frage kurz und präzise, zu welchem Projekt es gehört.
- UNSICHTBARE 3-MODI-ERKENNUNG (setze "detectedMode" und "expectFollowUp"):
  • "quick": Sofortige Ausführung, ultraknappe Bestätigung (1 kurzer Satz, z. B. "Steht auf Einkauf."). "expectFollowUp": false – außer bei mehrdeutigem Projekt/fehlender Info (dann kurze Rückfrage + "expectFollowUp": true).
  • "collect": Zerlege längeren Redefluss sauber in gebündelte Tasks-, Einkaufs- oder Wissenskarten; fasse kurz die Anzahl zusammen ("4 Punkte geparkt – noch was?"). "expectFollowUp": true.
  • "dialog": Natürliches Gespräch auf Augenhöhe mit gezielter Rückfrage; lege erst dann Karten an, wenn etwas konkret spruchreif oder ausdrücklich gewünscht ist. "expectFollowUp": true.`;

  if (cleanKey) {
    try {
      const workspaceContext = allProjects ? buildWorkspaceContextSummary(allProjects, defaultProjectId) : '';
      const historyText =
        chatHistory && chatHistory.length > 0
          ? chatHistory
            .slice(-6)
            .map((h) => `${h.role === 'user' ? 'Nutzer' : 'BANDIT.OS'}: ${h.text}`)
            .join('\n')
          : 'Kein vorheriger Gesprächsverlauf.';

      const userParts: any[] = [
        {
          text: [
            `AKTUELLES PROJEKT: "${defaultProjectId}"`,
            `MODUS-KONTEXT: vorläufiger Hinweis="${autoHint}"${options?.previousMode ? `, vorheriger Modus="${options.previousMode}"` : ''}`,
            `GESPRÄCHSVERLAUF:\n${historyText}`,
            `DATENBESTAND:\n${workspaceContext}`,
            `EINGABE:\n"${rawText}"`
          ].join('\n\n')
        }
      ];

      if (attachment && attachment.dataUrl && attachment.dataUrl.startsWith('data:image/')) {
        const [meta, base64Data] = attachment.dataUrl.split(',');
        const mimeMatch = meta.match(/data:(.*?);base64/);
        if (base64Data) {
          userParts.push({
            inlineData: {
              mimeType: mimeMatch ? mimeMatch[1] : 'image/jpeg',
              data: base64Data
            }
          });
        }
      }

      const taskType = effectiveMode === 'research' || rawText.trim().endsWith('?') || Boolean(attachment) ? 'qa' : 'sort';

      const result = await callGeminiWithAutoFallback(
        cleanKey,
        taskType,
        {
          systemInstruction: {
            parts: [{ text: dynamicSystemPrompt }]
          },
          contents: [{ role: 'user', parts: userParts }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
            responseSchema: AI_ROUTER_RESPONSE_SCHEMA
          }
        },
        effectiveMode,
        preferredModelMode,
        signal
      );

      if (result.aborted || signal?.aborted) {
        return {
          plan: {
            isQuestion: false,
            needsClarification: false,
            spokenFeedback: '',
            directAnswer: '',
            summary: '',
            actions: []
          },
          engine: 'Abgebrochen',
          autoUpscaledToPro,
          aborted: true
        };
      }

      if (!result.ok) {
        const fallback = buildLocalFallbackPlan(rawText, defaultProjectId, allProjects, autoHint, options?.previousMode);
        return {
          plan: {
            ...fallback,
            directAnswer: `Hinweis: API meldete "${result.errorMessage}". Lokale Zuordnung genutzt.`
          },
          engine: `Fallback (${result.errorMessage})`,
          autoUpscaledToPro,
          detectedMode: fallback.detectedMode,
          expectFollowUp: fallback.expectFollowUp
        };
      }

      const rawJsonText = result.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawJsonText) {
        const parsed = JSON.parse(rawJsonText) as StructuredAiResponse;
        const bufferMultiplier =
          prefs.adhdMasterEnabled && prefs.adhdTimeBufferAndHaptics ? 1.25 : 1;

        const sanitizedActions = Array.isArray(parsed.actions)
          ? parsed.actions.map((act) => ({
            ...act,
            targetProjectId: act.targetProjectId || defaultProjectId || 'proj-foodtruck',
            shortCheckableTitle: enforceMaxSixWords(act.shortCheckableTitle, 'Neuer Punkt'),
            detailedExplanation: act.detailedExplanation || rawText,
            quantityOrMeasure: act.quantityOrMeasure || '1x',
            estimatedPrice: act.estimatedPrice || '',
            changeFooterNote: enforceMaxSixWords(
              act.changeFooterNote || `Durch ${result.usedModel}`,
              'Durch KI zugeordnet'
            ),
            estimatedMinutes: Math.round((Number(act.estimatedMinutes) || 25) * bufferMultiplier),
            priority: act.priority || 'Mittel'
          }))
          : [];

        const resolvedMode: VoiceInteractionMode =
          parsed.detectedMode === 'quick' || parsed.detectedMode === 'collect' || parsed.detectedMode === 'dialog'
            ? parsed.detectedMode
            : autoHint;
        const resolvedFollowUp =
          typeof parsed.expectFollowUp === 'boolean'
            ? parsed.expectFollowUp
            : resolvedMode !== 'quick' || Boolean(parsed.needsClarification);

        return {
          plan: {
            isQuestion: Boolean(parsed.isQuestion),
            needsClarification: Boolean(parsed.needsClarification),
            detectedMode: resolvedMode,
            expectFollowUp: resolvedFollowUp,
            spokenFeedback:
              parsed.spokenFeedback ||
              (sanitizedActions.length > 0 ? 'Ist erledigt.' : parsed.directAnswer || 'Verstanden.'),
            directAnswer:
              parsed.directAnswer ||
              parsed.summary ||
              `${sanitizedActions.length} Aktion(en) ausgeführt.`,
            summary:
              parsed.summary ||
              `${sanitizedActions.length} Aktion(en) ausgeführt.`,
            actions: sanitizedActions
          },
          engine: result.usedModel,
          autoUpscaledToPro,
          detectedMode: resolvedMode,
          expectFollowUp: resolvedFollowUp
        };
      }
    } catch (err: any) {
      if (signal?.aborted || err?.name === 'AbortError') {
        return {
          plan: {
            isQuestion: false,
            needsClarification: false,
            spokenFeedback: '',
            directAnswer: '',
            summary: '',
            actions: []
          },
          engine: 'Abgebrochen',
          autoUpscaledToPro,
          aborted: true
        };
      }
      console.warn('[BANDIT.OS AI-Router] Fehler:', err);
    }
  }

  const offlineFallback = buildLocalFallbackPlan(
    rawText,
    defaultProjectId,
    allProjects,
    autoHint,
    options?.previousMode
  );
  return {
    plan: offlineFallback,
    engine: cleanKey ? 'Fallback (Verbindungsfehler)' : 'Lokaler Modus (Kein API-Key)',
    autoUpscaledToPro,
    detectedMode: offlineFallback.detectedMode,
    expectFollowUp: offlineFallback.expectFollowUp
  };
}

export async function askQuickAssistantQuestion(
  question: string,
  projectId: string,
  apiKey: string,
  attachment: Attachment | null,
  options?: {
    allProjects?: Project[];
    settings?: AiVoiceSettings;
  }
): Promise<string> {
  const { plan } = await routeVoiceCommand(
    question,
    apiKey,
    projectId || BRAND_CONFIG.defaultProjectId,
    options?.allProjects,
    undefined,
    attachment,
    options?.settings?.activeAiMode,
    {
      settings: options?.settings
    }
  );
  return plan.directAnswer || plan.summary;
}

export async function testGeminiApiKey(
  apiKey: string
): Promise<{ ok: boolean; message: string; availableModels?: string[] }> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    return { ok: false, message: 'Kein API-Key eingegeben.' };
  }
  try {
    const availableModels = await fetchAvailableGeminiModels(cleanKey);
    const result = await callGeminiWithAutoFallback(cleanKey, 'qa', {
      contents: [{ role: 'user', parts: [{ text: 'Antworte nur mit: OK' }] }],
      generationConfig: { maxOutputTokens: 10 }
    });

    if (result.ok) {
      const topList =
        availableModels.length > 0
          ? ` | Verfügbare Modelle: ${availableModels.slice(0, 5).join(', ')}`
          : '';
      return {
        ok: true,
        message: `Verbindung aktiv. Modell: "${result.usedModel}"${topList}`,
        availableModels
      };
    }
    return {
      ok: false,
      message: `API-Fehler: ${result.errorMessage || 'Schlüssel ungültig.'}`,
      availableModels
    };
  } catch (e: any) {
    return { ok: false, message: `Netzwerkfehler: ${e?.message || 'Keine Verbindung.'}` };
  }
}
