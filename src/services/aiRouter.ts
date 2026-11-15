import { AiActionType, Attachment, PriorityType } from '../types';

const MODEL_STORAGE_KEY = 'nexusflow_preferred_gemini_model';

// Standard: 'SMART_PRO' nutzt für Fragen/Fotos automatisch das höhere Pro-Modell
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
  actions: StructuredAiActionPlan[];
  isQuestion?: boolean;
  directAnswer?: string;
}

export const DEMO_VOICE_COMMANDS: Array<{ id: string; label: string; text: string }> = [];

export const enforceMaxSixWords = (str: string, fallback = 'Neuer Eintrag'): string => {
  if (!str || typeof str !== 'string') return fallback;
  const words = str.trim().replace(/\s+/g, ' ').split(' ');
  return words.length <= 6 ? words.join(' ') : words.slice(0, 6).join(' ');
};

/**
 * Fragt live bei Google AI Studio ab, welche Modelle für diesen API-Key freigeschaltet sind,
 * und sortiert höhere Modelle (Pro / neuere Versionen) nach oben.
 */
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

    // Sortiere nach Versionsnummer absteigend und bevorzuge Pro vor Flash
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

/**
 * Baut eine intelligente Modell-Reihenfolge auf:
 * Versucht zuerst das gewählte höhere Modell und fällt bei einem 404 automatisch
 * auf das nächsthöhere verfügbare Modell im Account zurück.
 */
async function buildModelCandidateList(
  apiKey: string,
  task: 'sort' | 'qa'
): Promise<string[]> {
  const mode = getPreferredModelMode();
  const defaultsProFirst = [
    'gemini-3.8-pro',
    'gemini-3.8-flash',
    'gemini-3.5-pro',
    'gemini-3.5-flash',
    'gemini-3.0-pro',
    'gemini-3.0-flash'
  ];
  const defaultsFlashFirst = [
    'gemini-3.8-flash',
    'gemini-3.8-pro',
    'gemini-3.5-flash',
    'gemini-3.5-pro'
  ];

  let baseList: string[] = [];
  if (mode === 'ALWAYS_PRO') {
    baseList = defaultsProFirst;
  } else if (mode === 'ALWAYS_FLASH') {
    baseList = defaultsFlashFirst;
  } else if (mode === 'SMART_PRO') {
    baseList = task === 'qa' ? defaultsProFirst : defaultsFlashFirst;
  } else {
    // Spezifisches vom Nutzer gewähltes Modell zuerst
    baseList = [mode, ...defaultsProFirst];
  }

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

    // Falls 404 (Modellname existiert nicht oder wurde aktualisiert), probiere sofort den nächsten Kandidaten
    if (res.status === 404) {
      continue;
    } else {
      break;
    }
  }

  // Letzter Rettungsanker: Frage live die verfügbaren Account-Modelle ab und nimm das höchste!
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
      description: 'TRUE, wenn der Nutzer nur eine Frage stellt und nichts einsortiert werden soll. FALSE bei Aufgaben, Notizen, Infos oder Einkäufen.'
    },
    directAnswer: {
      type: 'STRING',
      description: 'Falls isQuestion=true: Kurze, präzise Antwort auf die Frage des Nutzers. Sonst leerer String.'
    },
    summary: {
      type: 'STRING',
      description: 'Kurze Zusammenfassung für das Protokoll, z. B. "2 Punkte einsortiert (Pizza Bandit, Privat)".'
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
            type: 'STRING',
            enum: [
              'proj-foodtruck',
              'proj-baeckerei',
              'proj-smarthome',
              'proj-gewohnheiten',
              'proj-alltag'
            ]
          },
          shortCheckableTitle: {
            type: 'STRING',
            description: 'STRIKT maximal 6 Wörter! Kurzer, klarer Abhak-Titel ohne Füllwörter.'
          },
          detailedExplanation: {
            type: 'STRING',
            description: 'Ausführliche Details, Maße, Abläufe oder Hintergrundinfos aus dem Gesprochenen.'
          },
          quantityOrMeasure: {
            type: 'STRING',
            description: 'Menge oder Maß bei Einkäufen (z. B. "2 Stück", "5 kg", "1200 mm"), sonst "1x".'
          },
          estimatedPrice: {
            type: 'STRING',
            description: 'Geschätzter Preis in Euro (z. B. "24.90") oder leerer String.'
          },
          changeFooterNote: {
            type: 'STRING',
            description: 'Kurzer Änderungsvermerk (max. 5 Wörter), z. B. "Per Sprachnotiz automatisch einsortiert".'
          },
          estimatedMinutes: {
            type: 'NUMBER',
            description: 'Geschätzte Dauer in Minuten (z. B. 15, 30, 60).'
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
  required: ['isQuestion', 'summary', 'actions']
};

const SYSTEM_PROMPT = `Du bist der vollautomatische KI-Sortier-Router der App NexusFlow.
Deine Aufgabe: Analysiere den eingesprochenen Text des Nutzers und sortiere ihn OHNE Rückfrage in die richtigen Projekte und Reiter ein.

WICHTIGE PROJEKT-REGELN (STRIKT EINHALTEN!):
1. "proj-foodtruck" (ARBEIT – Pizza Bandit: Foodtruck & Gesamtbetrieb):
   - Hierhin gehört ALLES rund um den Pizza-Anhänger (TSA-Ausbau, Auszugtisch, Saladette-Lift, Pizzaofen, Gas, Waschbecken, 12V/230V-Elektrik, Euroboxen) SOWIE das komplette Back- und Lebensmittelgeschäft (Pizzateig, Mehl, Sauerteig, Dinkel, Zutaten, Rezepte, Events, Kalkulation, Verkauf).
2. "proj-baeckerei" (ARBEIT – Baustelle Bäckerei / Umbau):
   - ACHTUNG: Dieses Projekt ist AUSSCHLIESSLICH eine Baustelle (Renovierung/Umbau der 150m² Backstube)!
   - Hierhin gehören NUR Bau- und Umbau-Themen der Räumlichkeiten: Decke abhängen/spachteln, Wände, Fliesen, Lüftungsbau/Abluftrohre, Baustrom, Trockenbau, Malerarbeiten in der Backstube. KEINE Backrezepte oder Lebensmittel!
3. "proj-smarthome" (PRIVAT – Smart Home & Technik):
   - Home Assistant, Proxmox, Zigbee, Sensoren, Netzwerk, VLAN, private Automatisierung.
4. "proj-gewohnheiten" (PRIVAT – Gewohnheiten & Routinen):
   - Sport, Gesundheit, Morgen-/Abendroutine, Mobilität, Training, Wasser trinken.
5. "proj-alltag" (PRIVAT – Alltag & Haushalt):
   - Private Erledigungen, Familie, Auto, Versicherungen, Steuer, privater Haushaltseinkauf, Wochenende.

REITER-ZUORDNUNG (actionType):
- "ADD_CART_ITEM": Wenn etwas gekauft, bestellt oder besorgt werden muss (Material, Werkzeug, Zutaten, Einkauf).
- "UPDATE_EXPLANATION": Wenn ein Ablauf, eine Anleitung, ein Rezept oder eine Schritt-für-Schritt-Erklärung beschrieben wird.
- "ADD_INFO": Wenn reine Maße, Daten, Kontakte, Notizen oder technische Fakten festgehalten werden sollen.
- "CHECK_OFF_TASK": Wenn der Nutzer sagt, dass etwas erledigt oder abgehakt ist.
- "ADD_TASK": Für alle konkreten To-dos, Aufgaben und Bauschritte.

ZUSATZREGEL:
- Wenn der Nutzer eine reine Frage stellt, setze isQuestion=true, schreibe die Antwort in directAnswer und lasse actions leer [].
- shortCheckableTitle darf STRIKT maximal 6 Wörter lang sein!`;

export function buildLocalFallbackPlan(
  rawText: string,
  defaultProjectId: string
): StructuredAiResponse {
  const trimmed = rawText.trim();
  const isQuestion =
    trimmed.endsWith('?') ||
    /^(wie|was|wo|wann|warum|welche|welcher|welches|kannst du|weißt du)\b/i.test(trimmed);

  if (isQuestion) {
    return {
      isQuestion: true,
      directAnswer:
        'Hinweis (Offline-Modus aktiv): Für direkte KI-Fachantworten bitte in den Einstellungen unter „KI-Schnittstelle“ prüfen, ob dein Gemini API-Key aktiv ist.',
      summary: 'Frage erkannt (Offline-Modus)',
      actions: []
    };
  }

  const segments = trimmed
    .split(
      /;|\.\s+|\s+(?:außerdem|zusätzlich|und\s+dann\s+noch|und\s+ergänze|und\s+erstelle|und\s+füge|und\s+lege|und\s+notiere|und\s+packe|und\s+kaufe|und\s+brauche)\s+/i
    )
    .map((s) => s.trim())
    .filter(Boolean);

  const actions: StructuredAiActionPlan[] = segments.map((seg) => {
    const lower = seg.toLowerCase();
    let targetProjectId = defaultProjectId || 'proj-foodtruck';

    if (
      /(baustelle\s*bäckerei|backstube.*umbau|umbau.*bäckerei|decke\s+spachteln|tiefgrund|lüftungsrohr|abluft|wickelfalz|trockenbau|fliesen|wände\s+streichen|baustelle)/i.test(
        lower
      )
    ) {
      targetProjectId = 'proj-baeckerei';
    } else if (
      /(pizza|bandit|anhänger|tsa|auszug|saladette|ofen|gas|sauerteig|mehl|dinkel|teig|teigballen|backen|event|stand|waschbecken|eurobox)/i.test(
        lower
      )
    ) {
      targetProjectId = 'proj-foodtruck';
    } else if (/(smart\s*home|zigbee|proxmox|home\s*assistant|sensor|vlan|router)/i.test(lower)) {
      targetProjectId = 'proj-smarthome';
    } else if (/(gewohnheit|spaziergang|routine|mobilität|training|sport|wasser\s+trinken)/i.test(lower)) {
      targetProjectId = 'proj-gewohnheiten';
    } else if (/(privat|alltag|haushalt|steuer|auto|wochenende|familie|urlaub|einkaufen\s+für\s+zuhause)/i.test(lower)) {
      targetProjectId = 'proj-alltag';
    }

    let actionType: AiActionType = 'ADD_TASK';
    if (
      /(einkauf|kaufe|besorgen|bestellen|brauche\s+noch|säcke|paar|rollen|set|pakete|kartusche|schrauben|winkel|baumarkt|amazon)/i.test(
        lower
      )
    ) {
      actionType = 'ADD_CART_ITEM';
    } else if (/(erklärung|anleitung|rezept|ablauf|schritt\s+für\s+schritt|zuerst.*dann)/i.test(lower)) {
      actionType = 'UPDATE_EXPLANATION';
    } else if (/(allgemeine\s+info|maß\s+ist|maße|notiere\s+info|merke\s+dir|daten:)/i.test(lower)) {
      actionType = 'ADD_INFO';
    } else if (/(erledigt|abgehakt|ist\s+fertig|habe\s+ich\s+gemacht)/i.test(lower)) {
      actionType = 'CHECK_OFF_TASK';
    }

    const cleanTitle = seg
      .replace(/^(packe|ergänze|erstelle|füge|lege|notiere|ich\s+muss\s+noch|wir\s+müssen\s+noch|bitte)\s+/i, '')
      .replace(
        /bei der bäckerei|auf der baustelle|in der bäckerei|bei pizza bandit|beim foodtruck|bei smart home|im alltag|privat|bei gewohnheiten|in den einkaufswagen|unter allgemeine infos/gi,
        ''
      )
      .split(/[:–-]/)[0]
      .trim();

    const shortCheckableTitle = enforceMaxSixWords(cleanTitle, 'Neuer Sprach-Eintrag');
    const colonParts = seg.split(':');
    const detailedExplanation =
      colonParts.length > 1 ? colonParts.slice(1).join(':').trim() : seg;
    const qtyMatch = seg.match(
      /(\d+\s*(?:Säcke|Paar|Pakete|Kartons|Rollen|Set|Stück|Kartuschen|kg|g|m|cm|mm|L|Liter))/i
    );

    return {
      actionType,
      targetProjectId,
      shortCheckableTitle,
      detailedExplanation,
      quantityOrMeasure: qtyMatch ? qtyMatch[1] : '1x',
      estimatedPrice: '',
      changeFooterNote: 'Per Sprache einsortiert (Offline)',
      estimatedMinutes: 25,
      priority: /(dringend|wichtig|sofort|gas|sicherheit|heute)/i.test(lower) ? 'Hoch' : 'Mittel'
    };
  });

  return {
    isQuestion: false,
    summary: `${actions.length} Punkt(e) lokal erkannt und zugeordnet.`,
    actions
  };
}

export async function routeVoiceCommand(
  rawText: string,
  apiKey: string,
  defaultProjectId: string
): Promise<{ plan: StructuredAiResponse; engine: string }> {
  const cleanKey = apiKey ? apiKey.trim() : '';

  if (cleanKey) {
    try {
      const result = await callGeminiWithAutoFallback(cleanKey, 'sort', {
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }]
        },
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Aktuell geöffnetes Standard-Projekt: "${defaultProjectId}".\nEingesprochener Text des Nutzers:\n"${rawText}"`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.15,
          responseMimeType: 'application/json',
          responseSchema: AI_ROUTER_RESPONSE_SCHEMA
        }
      });

      if (!result.ok) {
        const fallback = buildLocalFallbackPlan(rawText, defaultProjectId);
        return {
          plan: {
            ...fallback,
            summary: `${fallback.summary} (Hinweis: API meldete "${result.errorMessage}")`
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
              shortCheckableTitle: enforceMaxSixWords(act.shortCheckableTitle, 'Neuer KI-Punkt'),
              detailedExplanation: act.detailedExplanation || rawText,
              quantityOrMeasure: act.quantityOrMeasure || '1x',
              estimatedPrice: act.estimatedPrice || '',
              changeFooterNote: enforceMaxSixWords(
                act.changeFooterNote || `Per ${result.usedModel} einsortiert`,
                'Per Gemini KI einsortiert'
              ),
              estimatedMinutes: Number(act.estimatedMinutes) || 25,
              priority: act.priority || 'Mittel'
            }))
          : [];

        return {
          plan: {
            isQuestion: Boolean(parsed.isQuestion),
            directAnswer: parsed.directAnswer || '',
            summary:
              parsed.summary ||
              `${sanitizedActions.length} Aktion(en) durch ${result.usedModel} einsortiert.`,
            actions: sanitizedActions
          },
          engine: `${result.usedModel}`
        };
      }
    } catch (err: any) {
      console.warn('[NexusFlow AI-Router] Fehler:', err);
    }
  }

  return {
    plan: buildLocalFallbackPlan(rawText, defaultProjectId),
    engine: cleanKey ? 'Lokaler Fallback (Verbindungsfehler)' : 'Lokaler Offline-Sortierer (Kein API-Key)'
  };
}

export async function askQuickAssistantQuestion(
  question: string,
  projectName: string,
  apiKey: string,
  attachment: Attachment | null
): Promise<string> {
  const cleanKey = apiKey ? apiKey.trim() : '';

  if (cleanKey) {
    try {
      const parts: any[] = [
        {
          text: `Du bist der leitende Fach- und Praxis-Assistent für das Projekt "${projectName}". Antworte präzise, fundiert und handwerklich direkt auf folgende Frage:\n${question}`
        }
      ];

      if (attachment && attachment.dataUrl && attachment.dataUrl.startsWith('data:image/')) {
        const [meta, base64Data] = attachment.dataUrl.split(',');
        const mimeMatch = meta.match(/data:(.*?);base64/);
        if (base64Data) {
          parts.push({
            inlineData: {
              mimeType: mimeMatch ? mimeMatch[1] : 'image/jpeg',
              data: base64Data
            }
          });
        }
      }

      const result = await callGeminiWithAutoFallback(cleanKey, 'qa', {
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: 0.25 }
      });

      if (result.ok) {
        const reply = result.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (reply) return `[Modell: ${result.usedModel}]\n${reply.trim()}`;
      } else {
        return `⚠️ Gemini API-Fehler: ${result.errorMessage || 'Bitte API-Key prüfen.'}`;
      }
    } catch (err: any) {
      return `⚠️ Verbindungsfehler zur Gemini API: ${err?.message || 'Bitte Internetverbindung prüfen.'}`;
    }
  }

  return [
    `⚠️ Kein aktiver Gemini API-Key gefunden (${projectName}):`,
    `• Deine Frage: „${question}“`,
    '• Bitte hinterlege in den Einstellungen unter „KI-Schnittstelle“ deinen Schlüssel.'
  ].join('\n');
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
          ? ` | Höchste verfügbare Modelle in deinem Account: ${availableModels.slice(0, 5).join(', ')}`
          : '';
      return {
        ok: true,
        message: `Verbindung steht! Aktives Modell: "${result.usedModel}"${topList}`,
        availableModels
      };
    }
    return {
      ok: false,
      message: `API-Fehler: ${result.errorMessage || 'Key ungültig oder gesperrt.'}`,
      availableModels
    };
  } catch (e: any) {
    return { ok: false, message: `Netzwerkfehler: ${e?.message || 'Keine Verbindung.'}` };
  }
}
