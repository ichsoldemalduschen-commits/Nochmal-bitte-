import {
  CartItem,
  ForemanProposal,
  ForemanProposalAction,
  KnowledgeItem,
  Project,
  TaskItem
} from '../types';
import { formatNow } from './storage';

const STOP_WORDS = new Set([
  'abnahme',
  'alles',
  'andere',
  'anhang',
  'anschließen',
  'arbeit',
  'arbeiten',
  'artikel',
  'aufgabe',
  'aufgaben',
  'außen',
  'bauen',
  'beide',
  'beim',
  'beleg',
  'bereich',
  'besorgen',
  'bestellen',
  'bitte',
  'brauchen',
  'check',
  'dabei',
  'dafür',
  'damit',
  'danach',
  'daten',
  'deinen',
  'dieser',
  'dieses',
  'durch',
  'einbau',
  'einfach',
  'einkauf',
  'einmal',
  'eintrag',
  'erledigt',
  'erste',
  'etwas',
  'fertig',
  'fragen',
  'gegen',
  'gesamt',
  'haben',
  'halter',
  'heute',
  'hinweis',
  'immer',
  'innen',
  'kaufen',
  'klären',
  'klein',
  'kosten',
  'lassen',
  'machen',
  'manuell',
  'messen',
  'mitte',
  'montage',
  'montieren',
  'morgen',
  'nachher',
  'neben',
  'nicht',
  'nötig',
  'offen',
  'paket',
  'passen',
  'planen',
  'preis',
  'projekt',
  'prüfen',
  'prüfung',
  'punkt',
  'regeln',
  'reihe',
  'setzen',
  'sicher',
  'siehe',
  'sollte',
  'später',
  'standard',
  'stück',
  'system',
  'teile',
  'thema',
  'unten',
  'unter',
  'verbauen',
  'vorbereiten',
  'vorne',
  'weiter',
  'werden',
  'wieder',
  'wissen',
  'wurde',
  'zwischen'
]);

const CANONICAL_UNITS: Record<string, string> = {
  cm: 'cm',
  mm: 'mm',
  m: 'm',
  kg: 'kg',
  v: 'V',
  w: 'W',
  kw: 'kW',
  a: 'A',
  l: 'L'
};

export interface ExtractedMeasure {
  value: number;
  unit: string;
  raw: string;
}

interface KeywordToken {
  raw: string;
  norm: string;
}

function toSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

/**
 * Normalisiert einen Einkaufsartikel-Namen zur Dublettenerkennung:
 * Kleinschreibung, Mengen-Präfixe und Sonderzeichen entfernen.
 */
export function normalizeCartTitleForDedupe(title: string): string {
  let cleaned = String(title || '').trim().toLowerCase();
  // Wiederholte führende Mengen-Präfixe entfernen (z. B. "2x ", "10 Stk. ", "1 Set - ")
  cleaned = cleaned.replace(
    /^(?:\d+(?:[.,]\d+)?\s*(?:x|stk\.?|stück|st\.?|sets?|paar|packung(?:en)?|pkg\.?|liter|l|kg|g|ml|m|cm|mm)?(?:\s+|[-:/]+))+/i,
    ''
  );
  // Nachgestellte Klammer-Mengen wie "(2x)" entfernen
  cleaned = cleaned.replace(/\(\s*\d+\s*x\s*\)/gi, ' ');
  cleaned = cleaned
    .replace(/[^a-z0-9äöüß]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned;
}

/**
 * Extrahiert einfache physische Maße/Werte mit Einheit (cm, mm, m, kg, V, W, kW, A, L).
 */
export function extractMeasuresWithUnits(text: string): ExtractedMeasure[] {
  const src = String(text || '');
  if (!src) return [];
  const regex =
    /(?:^|[\s(/,;:-])(\d+(?:[.,]\d+)?)\s*(kW|cm|mm|kg|m|V|W|A|L)(?=$|[\s)/,;:.!?-])/gi;
  const results: ExtractedMeasure[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(src)) !== null) {
    const numRaw = match[1];
    const unitRaw = match[2];
    const value = Number.parseFloat(numRaw.replace(',', '.'));
    const unit = CANONICAL_UNITS[unitRaw.toLowerCase()] || unitRaw;
    if (Number.isFinite(value) && unit) {
      results.push({
        value,
        unit,
        raw: `${numRaw} ${unit}`
      });
    }
  }
  return results;
}

/**
 * Extrahiert Kern-Schlagworte (Wortlänge >= 5 Zeichen, ohne Stoppwörter).
 */
export function extractCoreKeywords(text: string): KeywordToken[] {
  const matches = String(text || '').match(/[a-zA-ZäöüÄÖÜß]{5,}/g) || [];
  const seen = new Set<string>();
  const tokens: KeywordToken[] = [];
  for (const raw of matches) {
    const lower = raw.toLowerCase();
    if (STOP_WORDS.has(lower)) continue;
    if (seen.has(lower)) continue;
    seen.add(lower);
    tokens.push({ raw, norm: lower });
  }
  return tokens;
}

function stripSimpleGermanPlural(word: string): string {
  if (word.length > 6 && word.endsWith('en')) return word.slice(0, -2);
  if (word.length > 5 && (word.endsWith('n') || word.endsWith('e') || word.endsWith('s'))) {
    return word.slice(0, -1);
  }
  return word;
}

function findSharedKeyword(a: KeywordToken[], b: KeywordToken[]): KeywordToken | null {
  for (const tokA of a) {
    const stemA = stripSimpleGermanPlural(tokA.norm);
    for (const tokB of b) {
      const stemB = stripSimpleGermanPlural(tokB.norm);
      if (tokA.norm === tokB.norm || stemA === stemB) {
        return tokA;
      }
      if (
        tokA.norm.length >= 6 &&
        tokB.norm.length >= 6 &&
        (tokA.norm.includes(tokB.norm) || tokB.norm.includes(tokA.norm))
      ) {
        return tokA.raw.length <= tokB.raw.length ? tokA : tokB;
      }
    }
  }
  return null;
}

function findDuplicateCartProposals(
  project: Project,
  dismissedSet: Set<string>,
  nowStr: string
): ForemanProposal[] {
  const openCart = (project.cart || []).filter((c) => !c.completed);
  const groups = new Map<string, CartItem[]>();

  for (const item of openCart) {
    const key = normalizeCartTitleForDedupe(item.title);
    if (!key || key.length < 2) continue;
    const list = groups.get(key) || [];
    list.push(item);
    groups.set(key, list);
  }

  const proposals: ForemanProposal[] = [];
  for (const [normKey, items] of groups.entries()) {
    if (items.length < 2) continue;
    const slugKey = toSlug(normKey) || 'item';
    const id = `thinker:dedupe-cart:${project.id}:${slugKey}`;
    if (dismissedSet.has(id)) continue;

    const primary = items[0];
    const duplicates = items.slice(1);
    const detailLines = items.map(
      (it, idx) =>
        `${idx === 0 ? 'Behalten' : 'Entfernen'}: ${it.title} (${it.quantity || '1x'})`
    );

    proposals.push({
      id,
      kind: 'thinker-contradiction',
      projectId: project.id,
      title: `Doppelter Einkaufsposten: ${primary.title}`,
      summary: `${items.length}× ähnlich im offenen Einkaufswagen gefunden.`,
      detail: detailLines.join('\n'),
      status: 'pending',
      createdAt: nowStr,
      actions: [
        {
          type: 'dedupe-cart',
          label: 'Doppelten Einkaufsposten bereinigen',
          projectId: project.id,
          payload: {
            title: primary.title,
            removeCartItemIds: duplicates.map((d) => d.id)
          }
        }
      ]
    });
  }

  return proposals;
}

function findKnowledgeMeasuresForKeyword(
  know: KnowledgeItem,
  keyword: KeywordToken
): ExtractedMeasure[] {
  const lines = [know.title, ...(know.content || '').split('\n')];
  const stem = stripSimpleGermanPlural(keyword.norm);
  const matchingLines = lines.filter((line) => {
    const lower = line.toLowerCase();
    return lower.includes(keyword.norm) || (stem.length >= 5 && lower.includes(stem));
  });

  const lineMeasures = matchingLines.flatMap((line) => extractMeasuresWithUnits(line));
  if (lineMeasures.length > 0) {
    return lineMeasures;
  }

  // Falls das Schlagwort im Titel steht, gesamten Wissenseintrag heranziehen
  const titleLower = (know.title || '').toLowerCase();
  if (titleLower.includes(keyword.norm) || (stem.length >= 5 && titleLower.includes(stem))) {
    return extractMeasuresWithUnits(`${know.title} ${know.content}`);
  }

  return [];
}

function findMeasureConflictProposals(
  project: Project,
  dismissedSet: Set<string>,
  nowStr: string
): ForemanProposal[] {
  const openTasks = (project.tasks || []).filter((t) => !t.completed);
  const knowledgeItems = project.knowledge || [];
  if (openTasks.length === 0 || knowledgeItems.length === 0) return [];

  const proposals: ForemanProposal[] = [];
  const seenPairs = new Set<string>();

  for (const task of openTasks) {
    const taskText = [task.title, task.changeReason].filter(Boolean).join(' ');
    const taskMeasures = extractMeasuresWithUnits(taskText);
    if (taskMeasures.length === 0) continue;

    const taskKeywords = extractCoreKeywords(task.title);
    if (taskKeywords.length === 0) continue;

    for (const know of knowledgeItems) {
      const knowKeywords = extractCoreKeywords(`${know.title} ${know.content}`);
      const shared = findSharedKeyword(taskKeywords, knowKeywords);
      if (!shared) continue;

      const knowMeasures = findKnowledgeMeasuresForKeyword(know, shared);
      if (knowMeasures.length === 0) continue;

      // Einheitenweise vergleichen
      const units = Array.from(new Set(taskMeasures.map((m) => m.unit)));
      for (const unit of units) {
        const tUnitMeasures = taskMeasures.filter((m) => m.unit === unit);
        const kUnitMeasures = knowMeasures.filter((m) => m.unit === unit);
        if (tUnitMeasures.length === 0 || kUnitMeasures.length === 0) continue;

        const tPrimary = tUnitMeasures[0];
        const kPrimary = kUnitMeasures[0];

        const exactOverlap = tUnitMeasures.some((tm) =>
          kUnitMeasures.some((km) => Math.abs(tm.value - km.value) <= 0.001)
        );
        if (exactOverlap) continue;

        const pairKey = `${task.id}:${know.id}:${unit}`;
        if (seenPairs.has(pairKey)) continue;
        seenPairs.add(pairKey);

        const id = `thinker:measure-conflict:${project.id}:${toSlug(task.id)}:${toSlug(know.id)}:${unit}`;
        if (dismissedSet.has(id)) continue;

        proposals.push({
          id,
          kind: 'thinker-contradiction',
          projectId: project.id,
          title: `Maß-/Wert-Unterschied bei ${shared.raw} (${tPrimary.raw} vs. ${kPrimary.raw})`,
          summary: `Aufgabe nennt ${tPrimary.raw}, Wissen nennt ${kPrimary.raw}.`,
          detail: `Aufgabe: „${task.title}“ (${tPrimary.raw})\nWissen „${know.title}“: ${kPrimary.raw}`,
          status: 'pending',
          createdAt: nowStr,
          actions: [
            {
              type: 'add-task',
              label: 'Prüf-Aufgabe anlegen',
              projectId: project.id,
              payload: {
                title: `Maß prüfen: ${shared.raw} (${tPrimary.raw} vs. ${kPrimary.raw})`,
                notes: `Abgleich zwischen Aufgabe „${task.title}“ und Wissen „${know.title}“.`
              }
            }
          ]
        });
      }
    }
  }

  return proposals;
}

function findCompletedTaskOpenCartProposals(
  project: Project,
  dismissedSet: Set<string>,
  nowStr: string
): ForemanProposal[] {
  const completedTasks = (project.tasks || []).filter((t) => t.completed);
  const openCart = (project.cart || []).filter((c) => !c.completed);
  if (completedTasks.length === 0 || openCart.length === 0) return [];

  const proposals: ForemanProposal[] = [];

  for (const cartItem of openCart) {
    const cartKeywords = extractCoreKeywords(cartItem.title);
    if (cartKeywords.length === 0) continue;

    let matchedTask: TaskItem | null = null;
    let matchedKeyword: KeywordToken | null = null;

    for (const task of completedTasks) {
      const taskKeywords = extractCoreKeywords(task.title);
      const shared = findSharedKeyword(cartKeywords, taskKeywords);
      if (shared) {
        matchedTask = task;
        matchedKeyword = shared;
        break;
      }
    }

    if (!matchedTask || !matchedKeyword) continue;

    const id = `thinker:cart-task:${project.id}:${cartItem.id}`;
    if (dismissedSet.has(id)) continue;

    proposals.push({
      id,
      kind: 'thinker-contradiction',
      projectId: project.id,
      title: `Erledigte Aufgabe vs. offener Einkauf: ${cartItem.title}`,
      summary: `Aufgabe „${matchedTask.title}“ ist bereits erledigt – Einkaufsposten noch offen.`,
      detail: `Stichwort: ${matchedKeyword.raw} · Menge: ${cartItem.quantity || '1x'}`,
      status: 'pending',
      createdAt: nowStr,
      actions: [
        {
          type: 'mark-cart-bought',
          label: 'Einkaufsposten ebenfalls abhaken',
          projectId: project.id,
          payload: {
            title: cartItem.title,
            cartItemId: cartItem.id
          }
        }
      ]
    });
  }

  return proposals;
}

/**
 * Reine, deterministische Konsistenzprüfung für das aktive Projekt (maximal 3 priorisierte Hinweise).
 */
export function analyzeProjectConsistency(
  project: Project,
  dismissedIds: string[] = []
): ForemanProposal[] {
  if (!project) return [];
  const dismissedSet = new Set(dismissedIds);
  const nowStr = formatNow();

  const measureConflicts = findMeasureConflictProposals(project, dismissedSet, nowStr);
  const duplicateCarts = findDuplicateCartProposals(project, dismissedSet, nowStr);
  const completedTaskCarts = findCompletedTaskOpenCartProposals(project, dismissedSet, nowStr);

  return [...measureConflicts, ...duplicateCarts, ...completedTaskCarts].slice(0, 3);
}

const CART_ACTION_HINT_REGEX =
  /\b(kaufen|bestellen|besorgen|nachbestellen|material|regler|dichtung|schraube|schrauben|sensor|filter|batterie|kabel|ventil)\b/i;

/**
 * Wandelt ein Deep-Research-Ergebnis in einen ruhigen Ja/Nein/Später-Freigabevorschlag um.
 */
export function buildProposalFromResearchResult(params: {
  id?: string;
  projectId: string;
  projectName: string;
  title: string;
  markdownContent: string;
  followUpTasks?: string[];
  sourcesCount?: number;
  modelUsed?: string;
  createdAt?: string;
}): ForemanProposal {
  const {
    id,
    projectId,
    projectName,
    title,
    markdownContent,
    followUpTasks = [],
    sourcesCount = 0,
    modelUsed = 'Recherche',
    createdAt
  } = params;

  const actions: ForemanProposalAction[] = [];

  for (const todo of followUpTasks.slice(0, 3)) {
    const clean = todo.trim();
    if (!clean) continue;
    if (CART_ACTION_HINT_REGEX.test(clean)) {
      actions.push({
        type: 'add-cart',
        label: `Einkauf: ${clean}`,
        projectId,
        payload: {
          title: clean,
          quantity: '1x',
          notes: `Aus Hintergrund-Recherche „${title}“`
        }
      });
    } else {
      actions.push({
        type: 'add-task',
        label: `Aufgabe: ${clean}`,
        projectId,
        payload: {
          title: clean,
          notes: `Aus Hintergrund-Recherche „${title}“`
        }
      });
    }
  }

  actions.push({
    type: 'add-knowledge',
    label: 'Als Wissens-Karte sichern',
    projectId,
    payload: {
      title,
      content: markdownContent,
      notes: `Deep-Research-Beleg (${modelUsed})`
    }
  });

  const sourcesInfo = sourcesCount > 0 ? ` · ${sourcesCount} Quellen` : '';
  const excerptLines = markdownContent
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .slice(0, 4)
    .join('\n');

  return {
    id: id || `murmur:${projectId}:${Date.now()}`,
    kind: 'murmur-research',
    projectId,
    title,
    summary: `Hintergrund-Prüfung für ${projectName} bereit (${modelUsed}${sourcesInfo}).`,
    detail: excerptLines || undefined,
    status: 'pending',
    createdAt: createdAt || formatNow(),
    actions
  };
}
