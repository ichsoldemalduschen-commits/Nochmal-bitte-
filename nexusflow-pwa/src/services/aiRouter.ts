import { AiActionType, Attachment, PriorityType } from '../types';

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
}

export const AI_ROUTER_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING' },
    actions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          actionType: {
            type: 'STRING',
            enum: ['ADD_TASK', 'ADD_CART_ITEM', 'UPDATE_EXPLANATION', 'ADD_INFO', 'CHECK_OFF_TASK']
          },
          targetProjectId: {
            type: 'STRING',
            enum: ['proj-baeckerei', 'proj-foodtruck', 'proj-smarthome', 'proj-gewohnheiten', 'proj-alltag']
          },
          shortCheckableTitle: {
            type: 'STRING',
            description: 'Maximal 6 Woerter fuer kompakte Checklisten.'
          },
          detailedExplanation: {
            type: 'STRING',
            description: 'Ausfuehrliche Details, Masse, Mengen oder Schritte.'
          },
          quantityOrMeasure: { type: 'STRING' },
          estimatedPrice: { type: 'STRING' },
          changeFooterNote: { type: 'STRING' },
          estimatedMinutes: { type: 'NUMBER' },
          priority: { type: 'STRING', enum: ['Hoch', 'Mittel', 'Niedrig'] }
        },
        required: [
          'actionType',
          'targetProjectId',
          'shortCheckableTitle',
          'detailedExplanation',
          'changeFooterNote'
        ]
      }
    }
  },
  required: ['summary', 'actions']
};

export const DEMO_VOICE_COMMANDS = [
  {
    id: 'demo-tsa-1',
    label: 'Pizza Bandit TSA-Ausbau + Bäckerei + Smart Home',
    text: 'Lege bei Pizza Bandit 2 Paar Schwerlastauszüge 130kg für den Auszugtisch in den Einkaufswagen; ergänze bei der Bäckerei die Aufgabe Schwadenapparat Düsen prüfen; und notiere bei Smart Home unter Allgemeine Infos: Shelly Plus 2PM für Anhänger-Blaulicht getestet.'
  },
  {
    id: 'demo-tsa-2',
    label: 'Gas- & Hygiene-Material + Dinkel-Ablauf',
    text: 'Packe bei Pizza Bandit 1 Set Gewerbe-Gasdruckregler 50 mbar mit Schlauchbruchsicherung in den Einkaufswagen; und ergänze in der Bäckerei eine Arbeitserklärung Dinkel-Quellstück: 1. Schrot 1:1,5 mit kochendem Wasser übergießen, 2. Vier Stunden quellen lassen, 3. Auf 18 Grad kühlen.'
  },
  {
    id: 'demo-tsa-3',
    label: 'Event-Vorbereitung + Ruhige Abendroutine',
    text: 'Erstelle bei Pizza Bandit den Task Euroboxen für 160 Teigballen desinfizieren; und füge bei Gewohnheiten die Aufgabe 15 Minuten Abendspaziergang ohne Bildschirm hinzu.'
  }
];

export const enforceMaxSixWords = (str: string, fallback = 'Neuer Eintrag'): string => {
  if (!str || typeof str !== 'string') return fallback;
  const words = str.trim().replace(/\s+/g, ' ').split(' ');
  return words.length <= 6 ? words.join(' ') : words.slice(0, 6).join(' ');
};

export function buildLocalFallbackPlan(
  rawText: string,
  defaultProjectId: string
): StructuredAiResponse {
  const segments = rawText
    .split(/;|\s+(?:außerdem|zusätzlich|und\s+ergänze|und\s+erstelle|und\s+füge|und\s+lege|und\s+notiere|und\s+packe)\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);

  const actions: StructuredAiActionPlan[] = segments.map((seg) => {
    const lower = seg.toLowerCase();
    let targetProjectId = defaultProjectId || 'proj-foodtruck';

    if (/(bäckerei|sauerteig|mehl|dinkel|schwaden|backstube)/i.test(lower)) {
      targetProjectId = 'proj-baeckerei';
    } else if (/(pizza|bandit|anhänger|tsa|auszug|saladette|shelly.*blaulicht|eurobox|gas|ofen)/i.test(lower)) {
      targetProjectId = 'proj-foodtruck';
    } else if (/(smart home|zigbee|proxmox|home assistant|sensor|vlan|shelly)/i.test(lower)) {
      targetProjectId = 'proj-smarthome';
    } else if (/(gewohnheit|spaziergang|routine|mobilität|wasser)/i.test(lower)) {
      targetProjectId = 'proj-gewohnheiten';
    } else if (/(alltag|haushalt|steuer|winterreifen|siebträger)/i.test(lower)) {
      targetProjectId = 'proj-alltag';
    }

    let actionType: AiActionType = 'ADD_TASK';
    if (/(einkaufswagen|kaufe|säcke|paar|rollen|set|pakete|bestell)/i.test(lower)) {
      actionType = 'ADD_CART_ITEM';
    } else if (/(arbeitserklärung|quellstück|1\.|ablauf)/i.test(lower)) {
      actionType = 'UPDATE_EXPLANATION';
    } else if (/(allgemeine info|hinweis:|notiere.*info|firmware)/i.test(lower)) {
      actionType = 'ADD_INFO';
    }

    const cleanTitle = seg
      .replace(/^(packe|ergänze|erstelle|füge|lege|notiere)\s+/i, '')
      .replace(
        /bei der bäckerei|in der bäckerei|bei pizza bandit|bei smart home|im alltag|bei gewohnheiten|in den einkaufswagen|unter allgemeine infos/gi,
        ''
      )
      .split(/[:–-]/)[0]
      .trim();

    const shortCheckableTitle = enforceMaxSixWords(cleanTitle, 'Neuer KI-Punkt');
    const colonParts = seg.split(':');
    const detailedExplanation =
      colonParts.length > 1 ? colonParts.slice(1).join(':').trim() : seg;
    const qtyMatch = seg.match(/(\d+\s*(?:Säcke|Paar|Pakete|Kartons|Rollen|Set|Stück|kg|m|L))/i);

    return {
      actionType,
      targetProjectId,
      shortCheckableTitle,
      detailedExplanation,
      quantityOrMeasure: qtyMatch ? qtyMatch[1] : '1x',
      estimatedPrice: '',
      changeFooterNote: 'Per KI-Sprachbefehl einsortiert',
      estimatedMinutes: 25,
      priority: /(dringend|gas|sicherheit|bremse)/i.test(lower) ? 'Hoch' : 'Mittel'
    };
  });

  return {
    summary: `${actions.length} Aktion(en) erkannt und zugeordnet.`,
    actions
  };
}

export async function routeVoiceCommand(
  rawText: string,
  apiKey: string,
  defaultProjectId: string
): Promise<{ plan: StructuredAiResponse; engine: string }> {
  if (apiKey.trim()) {
    try {
      const endpoint =
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' +
        encodeURIComponent(apiKey.trim());

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: rawText }] }],
          systemInstruction: {
            parts: [
              {
                text: 'Zerlege den Sprachbefehl in präzise Einzelaktionen für proj-baeckerei, proj-foodtruck, proj-smarthome, proj-gewohnheiten oder proj-alltag. shortCheckableTitle strikt maximal 6 Wörter!'
              }
            ]
          },
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: AI_ROUTER_RESPONSE_SCHEMA
          }
        })
      });

      if (res.ok) {
        const data = await res.json();
        const jsonText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (jsonText) {
          const parsed = JSON.parse(jsonText) as StructuredAiResponse;
          if (parsed?.actions?.length > 0) {
            return { plan: parsed, engine: 'Gemini 2.5 Flash (JSON-Schema)' };
          }
        }
      }
    } catch {
      // Automatischer Fallback auf lokalen Parser
    }
  }

  return {
    plan: buildLocalFallbackPlan(rawText, defaultProjectId),
    engine: 'Lokaler Offline-Schema-Router'
  };
}

export async function askQuickAssistantQuestion(
  question: string,
  projectName: string,
  apiKey: string,
  attachment: Attachment | null
): Promise<string> {
  if (apiKey.trim()) {
    try {
      const endpoint =
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' +
        encodeURIComponent(apiKey.trim());

      const parts: Array<Record<string, unknown>> = [
        {
          text: `Beantworte diese Praxis-Frage kompakt, technisch präzise und stichpunktartig für das Projekt "${projectName}": ${question}`
        }
      ];

      if (attachment?.type === 'image' && attachment.dataUrl?.startsWith('data:image/')) {
        parts.push({
          inlineData: {
            mimeType: attachment.mimeType || 'image/png',
            data: attachment.dataUrl.split(',')[1]
          }
        });
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts }] })
      });

      if (res.ok) {
        const data = await res.json();
        const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (reply) return reply;
      }
    } catch {
      // Fallback unten
    }
  }

  return [
    `Praxis-Kurzcheck (${projectName}):`,
    `• Anfrage: „${question}“`,
    '• Prüfe im Reiter „Allgemeine Infos“ die hinterlegten Einbaumaße, Anschlusswerte und Schaltpläne.',
    '• Falls Material benötigt wird: Im Reiter „Einkaufswagen“ liefert der Beschaffungs-Check sofort den Vergleich Baumarkt vs. Online.'
  ].join('\n');
}