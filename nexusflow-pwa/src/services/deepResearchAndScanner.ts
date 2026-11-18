import { Project } from '../types';
import { compressImageFile } from './aiRouter';

const AUDIT_WATCHLIST_KEY = 'banditos_auto_audit_watchlist_v4';
const AUDIT_SETTINGS_KEY = 'banditos_auto_audit_settings_v4';

export interface AuditWatchlistItem {
  id: string;
  projectId: string;
  projectName: string;
  topic: string;
  detectedReason: string;
  createdAt: string;
  completed: boolean;
}

export interface AutoAuditSettings {
  weeklyAutoAuditEnabled: boolean;
  lastRunIso: string | null;
}

export interface ScannedReceiptItem {
  title: string;
  quantity: string;
  price: string;
}

export interface ScannedReceiptResult {
  storeName: string;
  purchaseDate: string;
  totalAmount: string;
  items: ScannedReceiptItem[];
  summary: string;
}

export interface DeepResearchResult {
  title: string;
  markdownDossier: string;
  sources: Array<{ title: string; url: string }>;
  followUpTasks: string[];
  modelUsed: string;
}

export function loadAuditSettings(): AutoAuditSettings {
  try {
    const raw = localStorage.getItem(AUDIT_SETTINGS_KEY);
    return raw
      ? JSON.parse(raw)
      : { weeklyAutoAuditEnabled: true, lastRunIso: null };
  } catch {
    return { weeklyAutoAuditEnabled: true, lastRunIso: null };
  }
}

export function saveAuditSettings(settings: AutoAuditSettings): void {
  try {
    localStorage.setItem(AUDIT_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

export function loadAuditWatchlist(projects: Project[]): AuditWatchlistItem[] {
  try {
    const raw = localStorage.getItem(AUDIT_WATCHLIST_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore
  }

  // Initial-Wächterliste aus deinen echten kritischen Projektpunkten
  const defaults: AuditWatchlistItem[] = [
    {
      id: 'watch-gas-g607',
      projectId: 'proj-foodtruck',
      projectName: 'Pizza Bandit (Foodtruck)',
      topic:
        'Gewerbliche Flüssiggasanlage 50 mbar im Verkaufsanhänger & Hitzeschutz an der Hecktür (DVGW G 607 / DGUV Vorschrift 79)',
      detectedReason: 'Kritischer Sicherheits- & Abnahmepunkt (Gas / Ofen)',
      createdAt: new Date().toLocaleDateString('de-DE'),
      completed: false
    },
    {
      id: 'watch-hygiene-lmhv',
      projectId: 'proj-foodtruck',
      projectName: 'Pizza Bandit (Foodtruck)',
      topic:
        'Berührungslose Handwaschgelegenheit (Knie-/Fußtaster), Warmwasser & Frisch-/Abwassertrennung im mobilen Foodstand nach LMHV und DIN 10500',
      detectedReason: 'Lebensmittelüberwachung / HACCP-Abnahme',
      createdAt: new Date().toLocaleDateString('de-DE'),
      completed: false
    },
    {
      id: 'watch-lueftung-backstube',
      projectId: 'proj-baeckerei',
      projectName: 'Baustelle Bäckerei (Umbau)',
      topic:
        'Be- und Entlüftung, Brandschutzklappen und Feuchtraum-Deckenbeschichtung einer 150 m² gewerblichen Backstube (ASR A3.6 / VDI 2052 / Baurecht)',
      detectedReason: 'Baurecht & Brandschutz Backstube',
      createdAt: new Date().toLocaleDateString('de-DE'),
      completed: false
    }
  ];
  saveAuditWatchlist(defaults);
  return defaults;
}

export function saveAuditWatchlist(list: AuditWatchlistItem[]): void {
  try {
    localStorage.setItem(AUDIT_WATCHLIST_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

/**
 * Prüft automatisch neue Eingaben auf rechtlich/technisch kritische Schlagworte
 * und setzt sie still auf die Auto-Audit-Warteliste.
 */
export function inspectAndQueueCriticalTopic(
  text: string,
  projectId: string,
  projectName: string,
  allProjects: Project[]
): void {
  const criticalRegex =
    /(gas|mbar|duomatic|abnahme|tüv|dguv|g\s*607|hygiene|gesundheitsamt|lmhv|waschbecken|abwasser|frischwasser|kühlkette|brandschutz|lüftung|abluft|baustrom|fi-schalter|zulassung|behörde|vorschrift|norm)/i;
  if (!criticalRegex.test(text)) return;

  const list = loadAuditWatchlist(allProjects);
  const exists = list.some(
    (item) => item.topic.toLowerCase() === text.trim().toLowerCase()
  );
  if (exists) return;

  const newItem: AuditWatchlistItem = {
    id: `watch-${Date.now()}`,
    projectId,
    projectName,
    topic: text.trim(),
    detectedReason: 'Automatisch als abnahme-/rechtsrelevant erkannt',
    createdAt: new Date().toLocaleDateString('de-DE'),
    completed: false
  };
  saveAuditWatchlist([newItem, ...list]);
}

/**
 * Kombiniertes Deep-Research- & Auto-Audit-Modul mit Google Search Grounding
 */
export async function runDeepResearchWithCitations(
  topic: string,
  projectName: string,
  apiKey: string,
  depth: 'quick' | 'full_dossier' = 'full_dossier'
): Promise<DeepResearchResult> {
  const cleanKey = apiKey.trim();
  const nowStr = new Date().toLocaleString('de-DE');

  if (!cleanKey) {
    return {
      title: `Prüfprotokoll (Offline-Entwurf): ${topic.slice(0, 42)}`,
      markdownDossier: [
        `# RECHTS- & NORMEN-PRÜFPROTOKOLL (${nowStr})`,
        `**Projekt:** ${projectName}`,
        `**Prüfgegenstand:** ${topic}`,
        '',
        '> Hinweis: Kein aktiver Gemini API-Key hinterlegt. Bitte in den Einstellungen deinen Google AI Studio Key eintragen, um Live-Web-Recherchen mit echten Gesetzes-Zitaten und Quellenlinks durchzuführen.',
        '',
        '## Vorbereitete Prüfpunkte für deine Abnahme:',
        '- Einschlägige DIN- / DVGW- / DGUV- und LMHV-Vorgaben vor Endmontage gegenprüfen.',
        '- Prüfbescheinigungen und Hersteller-Datenblätter unter Projekt-Infos als PDF hinterlegen.'
      ].join('\n'),
      sources: [],
      followUpTasks: [`Abnahme-Nachweise für "${topic.slice(0, 30)}" prüfen`],
      modelUsed: 'Offline-Vorlage'
    };
  }

  const candidateModels = [
    'gemini-3.8-pro',
    'gemini-3.8-flash',
    'gemini-3.5-pro',
    'gemini-3.5-flash'
  ];

  const prompt = `Du bist ein juristisch und ingenieurtechnisch präziser Deep-Research-Prüfer für das deutsche Handwerks-, Bau-, Gastronomie- und Fahrzeugrecht.
Erstelle für das Projekt "${projectName}" zum Thema:
"${topic}"

ein ${
    depth === 'full_dossier'
      ? 'umfassendes, abnahmefähiges Rechts-, Normen- und Praxis-Dossier'
      : 'kompaktes Prüfprotokoll mit den wichtigsten Belegen'
  }.

STRIKTE ANFORDERUNGEN:
1. Nutze die Google-Suche, um echte deutsche Gesetze, Verordnungen (z. B. LMHV, Verordnung (EG) Nr. 852/2004, ArbStättV, ASR), technische Regeln (z. B. DVGW Arbeitsblatt G 607, DGUV Vorschrift 79, DIN 10500, VDI 2052) und Behördenleitfäden heranzuziehen.
2. Gliedere das Protokoll exakt in diese 4 Abschnitte (ohne Emojis, klare Fachsprache):
   - ABSCHNITT 1: Kritische Prüfpunkte & Risikobewertung
   - ABSCHNITT 2: Gesetzliche & Technische Belege (Nenne konkrete Paragraphen/Norm-Nummern und füge wörtliche Kern-Zitate in Anführungszeichen ein)
   - ABSCHNITT 3: Praktische Umsetzung & Behörden-Abnahme (Worauf achtet der Prüfer vor Ort konkret?)
   - ABSCHNITT 4: Abgeleitete To-dos (Schreibe am Ende 2 bis 4 kurze, abhakbare Aufgaben-Zeilen im Format "TODO: [Maximal 6 Wörter]")`;

  let lastError = 'Unbekannter Fehler';

  for (const model of candidateModels) {
    try {
      const endpoint =
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=` +
        encodeURIComponent(cleanKey);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          tools: [{ googleSearch: {} }],
          generationConfig: {
            temperature: 0.15
          }
        })
      });

      if (!res.ok) {
        if (res.status === 404) continue;
        // Falls das Modell kein googleSearch-Tool im aktuellen Tarif akzeptiert, zweiter Versuch ohne Tool-Parameter
        const retryRes = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.15 }
          })
        });
        if (!retryRes.ok) {
          const errJson = await retryRes.json().catch(() => ({}));
          lastError = errJson?.error?.message || `HTTP ${retryRes.status}`;
          continue;
        }
        const retryData = await retryRes.json();
        const text =
          retryData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return parseResearchOutput(topic, text, [], model);
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Extrahiere verifizierte Web-Quellen aus dem Google Search Grounding
      const chunks =
        data?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources: Array<{ title: string; url: string }> = [];
      for (const ch of chunks) {
        if (ch?.web?.uri) {
          sources.push({
            title: ch.web.title || ch.web.uri,
            url: ch.web.uri
          });
        }
      }

      return parseResearchOutput(topic, text, sources, model);
    } catch (e: any) {
      lastError = e?.message || 'Netzwerkfehler';
    }
  }

  return {
    title: `Fehler bei Deep Research: ${topic.slice(0, 30)}`,
    markdownDossier: `Deep Research konnte nicht abgeschlossen werden: ${lastError}`,
    sources: [],
    followUpTasks: [],
    modelUsed: 'Fehler'
  };
}

function parseResearchOutput(
  topic: string,
  rawText: string,
  sources: Array<{ title: string; url: string }>,
  modelUsed: string
): DeepResearchResult {
  const todoLines = rawText
    .split('\n')
    .filter((line) => /TODO:/i.test(line))
    .map((line) =>
      line
        .replace(/^.*TODO:\s*/i, '')
        .replace(/[*#-]/g, '')
        .trim()
    )
    .filter(Boolean);

  const sourceBlock =
    sources.length > 0
      ? '\n\n---\n### VERIFIZIERTE QUELLEN & BELEGE:\n' +
        sources.map((s, i) => `${i + 1}. ${s.title} – ${s.url}`).join('\n')
      : '';

  return {
    title: `Deep-Research Beleg: ${topic.slice(0, 48)}`,
    markdownDossier: `${rawText.trim()}${sourceBlock}`,
    sources,
    followUpTasks: todoLines.slice(0, 4),
    modelUsed
  };
}

/**
 * Update 4: Kassenbon- & Rechnungs-Scanner (Vision-KI)
 */
const RECEIPT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    storeName: { type: 'STRING', description: 'Name des Händlers oder Baumarkts' },
    purchaseDate: { type: 'STRING', description: 'Kaufdatum auf dem Beleg' },
    totalAmount: { type: 'STRING', description: 'Gesamtbetrag in Euro, z. B. "84.50"' },
    summary: { type: 'STRING', description: 'Kurze Zusammenfassung des Belegs' },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: {
            type: 'STRING',
            description: 'Klare Artikelbezeichnung (max. 6 Wörter)'
          },
          quantity: { type: 'STRING', description: 'Menge, z. B. "2x" oder "1 Set"' },
          price: { type: 'STRING', description: 'Einzel- oder Positionspreis in Euro' }
        },
        required: ['title', 'quantity', 'price']
      }
    }
  },
  required: ['storeName', 'purchaseDate', 'totalAmount', 'summary', 'items']
};

export async function scanReceiptImageWithGemini(
  file: File,
  apiKey: string
): Promise<{ ok: boolean; result?: ScannedReceiptResult; error?: string }> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    return {
      ok: false,
      error: 'Bitte zuerst in den Einstellungen deinen Gemini API-Key hinterlegen.'
    };
  }

  try {
    const { dataUrl } = await compressImageFile(file);
    const [meta, base64Data] = dataUrl.split(',');
    const mimeMatch = meta.match(/data:(.*?);base64/);

    const candidateModels = ['gemini-3.8-flash', 'gemini-3.8-pro', 'gemini-3.5-flash'];
    for (const model of candidateModels) {
      const endpoint =
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=` +
        encodeURIComponent(cleanKey);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: 'Analysiere diesen Kassenbon oder diese Rechnung. Extrahiere Händler, Datum, Gesamtsumme und alle gekauften Einzelpositionen mit klarer Bezeichnung, Menge und Preis in Euro.'
                },
                {
                  inlineData: {
                    mimeType: mimeMatch ? mimeMatch[1] : 'image/jpeg',
                    data: base64Data
                  }
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
            responseSchema: RECEIPT_SCHEMA
          }
        })
      });

      if (!res.ok) {
        if (res.status === 404) continue;
        const err = await res.json().catch(() => ({}));
        return {
          ok: false,
          error: err?.error?.message || `API-Fehler (${res.status})`
        };
      }

      const data = await res.json();
      const rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawJson) {
        const parsed = JSON.parse(rawJson) as ScannedReceiptResult;
        return { ok: true, result: parsed };
      }
    }

    return { ok: false, error: 'Kein passendes Vision-Modell verfügbar.' };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Fehler beim Scannen des Belegs.' };
  }
}
