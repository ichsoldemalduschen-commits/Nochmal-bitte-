import { AiActionType, Attachment, PriorityType, Project } from '../types';

const MODEL_STORAGE_KEY = 'nexusflow_preferred_gemini_model';
const TTS_STORAGE_KEY = 'nexusflow_tts_enabled';

export function getPreferredModelMode(): string {
  try {
    return localStorage.getItem(MODEL_STORAGE_KEY) || 'SMART_PRO';
  } catch {
    return 'SMART_PRO';
  }
}

export function setPreferredModelMode(mode: string): void {
  try {
    localStorage.setItem(MODEL_STORAGE_KEY, mode);
  } catch {
    // ignore
  }
}

export function getTtsEnabled(): boolean {
  try {
    const val = localStorage.getItem(TTS_STORAGE_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

export function setTtsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(TTS_STORAGE_KEY, String(enabled));
  } catch {
    // ignore
  }
}

export function speakText(text: string, onEnd?: () => void): void {
  if (!getTtsEnabled() || typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (onEnd) onEnd();
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const clean = text.replace(/[*#_`~]/g, '').trim();
    if (!clean) {
      if (onEnd) onEnd();
      return;
    }
    const utter = new SpeechSynthesisUtterance(clean);
    utter.lang = 'de-DE';
    utter.rate = 1.08;
    utter.onend = () => {
      if (onEnd) onEnd();
    };
    utter.onerror = () => {
      if (onEnd) onEnd();
    };
    window.speechSynthesis.speak(utter);
  } catch {
    if (onEnd) onEnd();
  }
}

export interface StructuredAiActionPlan {
  actionType: AiActionType;
  targetProjectId: string;
  shortCheckableTitle: string;
  detailedExplanation: string;
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

export async function fetchAvailableGeminiModels(apiKey: string): Promise<string[]> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) return [];
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cleanKey)}`
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

async function buildModelCandidateList(
  apiKey: string,
  task: 'sort' | 'qa'
): Promise<string[]> {
  const mode = getPreferredModelMode();
  const defaultsProFirst = [
    'gemini-3.8-pro',
    'gemini-3.8-flash',
    'gemini-3.5-pro',
    'gemini-3.5-flash'
  ];
  const defaultsFlashFirst = [
    'gemini-3.8-flash',
    'gemini-3.8-pro',
    'gemini-3.5-flash',
    'gemini-3.5-pro'
  ];

  let baseList: string[] = [];
  if (mode === 'ALWAYS_PRO') baseList = defaultsProFirst;
  else if (mode === 'ALWAYS_FLASH') baseList = defaultsFlashFirst;
  else if (mode === 'SMART_PRO') baseList = task === 'qa' ? defaultsProFirst : defaultsFlashFirst;
  else baseList = [mode, ...defaultsProFirst];

  return Array.from(new Set(baseList));
}

async function callGeminiWithAutoFallback(
  apiKey: string,
  task: 'sort' | 'qa',
  payload: Record<string, unknown>
): Promise<{ ok: boolean; data?: any; usedModel: string; errorMessage?: string }> {
  const cleanKey = apiKey.trim();
  const candidates = await buildModelCandidateList(cleanKey, task);
  let lastError = 'Unbekannter API-Fehler';

  for (const modelName of candidates) {
    const endpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=` +
      encodeURIComponent(cleanKey);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      return { ok: true, data, usedModel: modelName };
    }

    const errData = await res.json().catch(() => ({}));
    lastError = errData?.error?.message || `HTTP ${res.status}`;
    if (res.status === 404) continue;
    else break;
  }

  const liveModels = await fetchAvailableGeminiModels(cleanKey);
  for (const liveModel of liveModels.slice(0, 3)) {
    const endpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/${liveModel}:generateContent?key=` +
      encodeURIComponent(cleanKey);
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const data = await res.json();
      return { ok: true, data, usedModel: liveModel };
    }
  }

  return { ok: false, usedModel: candidates[0], errorMessage: lastError };
}

const AI_ROUTER_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    isQuestion: {
      type: 'BOOLEAN',
      description: 'TRUE bei Fragen, Beratungen, Bestandsabfragen oder Rückfragen. FALSE bei reinen Befehlen/Eintragungen.'
    },
    needsClarification: {
      type: 'BOOLEAN',
      description: 'TRUE, wenn die Eingabe unklar ist und der Nutzer direkt antworten soll (Mikrofon öffnet sich danach automatisch).'
    },
    spokenFeedback: {
      type: 'STRING',
      description: 'Kurze gesprochene Rückmeldung für die Sprachausgabe. Bei einfachen Befehlen nur 2-5 Wörter (z. B. "Ist erledigt." oder "Unter Pizza Bandit eingetragen."). Bei Fragen oder Rückfragen die prägnante gesprochene Antwort.'
    },
    directAnswer: {
      type: 'STRING',
      description: 'Ausführliche, sachliche Textantwort für das Chatfenster (ohne Emojis). Wird bei Fragen, Analysen, Zusammenfassungen oder Rückfragen angezeigt.'
    },
    summary: {
      type: 'STRING',
      description: 'Sachliche Kurzfassung der ausgeführten Aktionen.'
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
            description: 'Alle technischen Details, Maße oder Ablaufschritte.'
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

function buildWorkspaceContextSummary(projects: Project[]): string {
  if (!Array.isArray(projects) || projects.length === 0) return 'Keine Projekte geladen.';
  return projects
    .filter((p) => !p.archived)
    .map((p) => {
      const openTasks = p.tasks
        .filter((t) => !t.completed)
        .slice(0, 12)
        .map((t) => `- [Task] ${t.title}`)
        .join('\n');
      const openCart = p.cart
        .filter((c) => !c.completed)
        .slice(0, 10)
        .map((c) => `- [Einkauf] ${c.title} (${c.quantity})`)
        .join('\n');
      const infoTitles = p.infos
        .slice(0, 8)
        .map((i) => `- [Info] ${i.title}: ${i.content.slice(0, 120)}`)
        .join('\n');
      return `PROJEKT ID="${p.id}" | NAME="${p.name}" | BEREICH="${p.domain}":\n${
        openTasks || '(Keine offenen Tasks)'
      }\n${openCart || ''}\n${infoTitles || ''}`;
    })
    .join('\n\n');
}

const SYSTEM_PROMPT = `Du bist der autonome KI-Projekt- und System-Agent von NexusFlow.
Du arbeitest NICHT nach starren Schlüsselwörtern, sondern verstehst natürliche Sprache wie ein erfahrener technischer Partner.
Verwende KEINE Emojis in Titeln oder Antworten. Halte den Ton klar, sachlich und präzise.

DEINE KOMPETENZEN:
1. Vollständiger Überblick: Du siehst im Kontext alle Projekte, offenen Tasks, Einkäufe und Infos des Nutzers.
2. Autonomes Handeln: Wenn der Nutzer Aufgaben, Einkäufe, Maße, Abläufe oder erledigte Schritte erwähnt, führst du die passenden Aktionen im Array "actions" aus – auch mehrere gleichzeitig über verschiedene Projekte hinweg.
3. Projekt-Abgrenzung:
   - "proj-foodtruck" (Pizza Bandit): Alles rund um den DDR-TSA-Anhänger (Auszugtisch, Saladette-Lift, Ofen, Gas, Waschbecken, 12V/230V-Elektrik, Euroboxen) SOWIE das gesamte Back-, Teig-, Rezept- und Event-Geschäft.
   - "proj-baeckerei" (Baustelle Bäckerei): AUSSCHLIESSLICH baulicher Umbau und Renovierung der 150m² Backstube (Decke, Wände, Lüftung, Trockenbau, Baustrom). Keine Backrezepte.
   - "proj-smarthome", "proj-gewohnheiten", "proj-alltag": Private Projekte.
4. Fragen & Beratung: Wenn der Nutzer eine Frage zu seinen Beständen, Maßen oder Projekten stellt, beantworte sie präzise in "directAnswer". Du kannst gleichzeitig eine Frage beantworten UND Aktionen in "actions" ausführen.
5. Rückfragen bei Unklarheit: Wenn eine Eingabe mehrdeutig ist (z. B. unklar welches Projekt oder welches Maß), setze "needsClarification": true und stelle in "spokenFeedback" sowie "directAnswer" eine kurze, gezielte Rückfrage.
6. Sprachausgabe-Steuerung ("spokenFeedback"):
   - Wenn der Nutzer nur kurz etwas diktiert ("Merke dir...", "Pack X auf die Liste"), halte "spokenFeedback" extrem kurz (z. B. "Ist erledigt." oder "Im Einkaufswagen Pizza Bandit notiert.").
   - Bei Fragen oder Rückfragen formuliere "spokenFeedback" so, dass man es gut anhören kann.`;

export function buildLocalFallbackPlan(
  rawText: string,
  defaultProjectId: string
): StructuredAiResponse {
  const trimmed = rawText.trim();
  const isQuestion =
    trimmed.endsWith('?') ||
    /^(wie|was|wo|wann|warum|welche|welcher|welches|kannst du|weißt du|zeig mir)/i.test(trimmed);

  if (isQuestion) {
    return {
      isQuestion: true,
      needsClarification: false,
      spokenFeedback: 'Bitte prüfe den API-Schlüssel in den Einstellungen.',
      directAnswer:
        'Offline-Modus aktiv: Für autonome Antworten und Datenbank-Abfragen bitte in den Einstellungen unter KI-Schnittstelle den Gemini API-Key prüfen.',
      summary: 'Frage im Offline-Modus',
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
    let targetProjectId = defaultProjectId || 'proj-foodtruck';

    if (
      /(baustelle\s*bäckerei|backstube.*umbau|umbau.*bäckerei|decke|tiefgrund|lüftung|abluft|wickelfalz|trockenbau|fliesen|wände|baustelle)/i.test(
        lower
      )
    ) {
      targetProjectId = 'proj-baeckerei';
    } else if (
      /(pizza|bandit|anhänger|tsa|auszug|saladette|ofen|gas|sauerteig|mehl|dinkel|teig|backen|event|waschbecken|eurobox)/i.test(
        lower
      )
    ) {
      targetProjectId = 'proj-foodtruck';
    } else if (/(smart\s*home|zigbee|proxmox|home\s*assistant|sensor|vlan)/i.test(lower)) {
      targetProjectId = 'proj-smarthome';
    } else if (/(gewohnheit|routine|mobilität|training|sport)/i.test(lower)) {
      targetProjectId = 'proj-gewohnheiten';
    } else if (/(privat|alltag|haushalt|steuer|auto|wochenende|familie)/i.test(lower)) {
      targetProjectId = 'proj-alltag';
    }

    let actionType: AiActionType = 'ADD_TASK';
    if (/(einkauf|kaufe|besorgen|bestellen|brauche|säcke|paar|rollen|set|pakete|kartusche|schrauben|winkel)/i.test(lower)) {
      actionType = 'ADD_CART_ITEM';
    } else if (/(erklärung|anleitung|rezept|ablauf|schritt)/i.test(lower)) {
      actionType = 'UPDATE_EXPLANATION';
    } else if (/(info|maß|maße|merke|notiere\s+info|daten)/i.test(lower)) {
      actionType = 'ADD_INFO';
    } else if (/(erledigt|abgehakt|ist\s+fertig|gemacht)/i.test(lower)) {
      actionType = 'CHECK_OFF_TASK';
    }

    const cleanTitle = seg
      .replace(/^(packe|ergänze|erstelle|füge|lege|notiere|merke\s+dir|ich\s+muss\s+noch|bitte)\s+/i, '')
      .split(/[:–-]/)[0]
      .trim();

    return {
      actionType,
      targetProjectId,
      shortCheckableTitle: enforceMaxSixWords(cleanTitle, 'Neuer Eintrag'),
      detailedExplanation: seg,
      quantityOrMeasure: '1x',
      estimatedPrice: '',
      changeFooterNote: 'Lokal zugeordnet',
      estimatedMinutes: 25,
      priority: 'Mittel'
    };
  });

  return {
    isQuestion: false,
    needsClarification: false,
    spokenFeedback: 'Ist erledigt.',
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
  attachment?: Attachment | null
): Promise<{ plan: StructuredAiResponse; engine: string }> {
  const cleanKey = apiKey ? apiKey.trim() : '';

  if (cleanKey) {
    try {
      const workspaceContext = allProjects ? buildWorkspaceContextSummary(allProjects) : '';
      const historyText =
        chatHistory && chatHistory.length > 0
          ? chatHistory
              .slice(-6)
              .map((h) => `${h.role === 'user' ? 'Nutzer' : 'Agent'}: ${h.text}`)
              .join('\n')
          : 'Kein vorheriger Gesprächsverlauf.';

      const userParts: any[] = [
        {
          text: [
            `AKTUELL GEÖFFNETES PROJEKT: "${defaultProjectId}"`,
            `LETZTER GESPRÄCHSVERLAUF:\n${historyText}`,
            `AKTUELLER DATENBESTAND DER APP:\n${workspaceContext}`,
            `NEUE EINGABE DES NUTZERS:\n"${rawText}"`
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

      const taskType = rawText.trim().endsWith('?') || Boolean(attachment) ? 'qa' : 'sort';

      const result = await callGeminiWithAutoFallback(cleanKey, taskType, {
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }]
        },
        contents: [{ role: 'user', parts: userParts }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema: AI_ROUTER_RESPONSE_SCHEMA
        }
      });

      if (!result.ok) {
        const fallback = buildLocalFallbackPlan(rawText, defaultProjectId);
        return {
          plan: {
            ...fallback,
            directAnswer: `Hinweis: API meldete "${result.errorMessage}". Lokale Zuordnung wurde genutzt.`,
            summary: `${fallback.summary} (API-Fehler)`
          },
          engine: `Fallback (${result.errorMessage})`
        };
      }

      const rawJsonText = result.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawJsonText) {
        const parsed = JSON.parse(rawJsonText) as StructuredAiResponse;
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
              estimatedMinutes: Number(act.estimatedMinutes) || 25,
              priority: act.priority || 'Mittel'
            }))
          : [];

        return {
          plan: {
            isQuestion: Boolean(parsed.isQuestion),
            needsClarification: Boolean(parsed.needsClarification),
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
          engine: result.usedModel
        };
      }
    } catch (err: any) {
      console.warn('[NexusFlow AI-Router] Fehler:', err);
    }
  }

  return {
    plan: buildLocalFallbackPlan(rawText, defaultProjectId),
    engine: cleanKey ? 'Fallback (Verbindungsfehler)' : 'Lokaler Modus (Kein API-Key)'
  };
}

export async function askQuickAssistantQuestion(
  question: string,
  projectName: string,
  apiKey: string,
  attachment: Attachment | null
): Promise<string> {
  const { plan } = await routeVoiceCommand(
    question,
    apiKey,
    'proj-foodtruck',
    undefined,
    undefined,
    attachment
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
