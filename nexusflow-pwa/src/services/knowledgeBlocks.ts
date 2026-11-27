import { KnowledgeItem } from '../types';

/**
 * Zerlegt strukturierte Wissens- und Ablauf-Einträge in einzeln vorlesbare Punkte.
 * Gibt nur dann Punkte zurück, wenn mindestens 2 erkennbare Einzelpunkte vorliegen.
 */
export function extractKnowledgeBlocks(
  item: Pick<KnowledgeItem, 'content' | 'stepsText'> & { steps?: string[] }
): string[] {
  if (Array.isArray(item.steps)) {
    const cleanSteps = item.steps.map((s) => String(s || '').trim()).filter(Boolean);
    if (cleanSteps.length >= 2) return cleanSteps;
  }

  const raw = (item.content || item.stepsText || '').trim();
  if (!raw) return [];

  const nonEmptyLines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const markerRegex = /^(?:\d+[.)]\s+|[-*•]\s+)/;
  const markerCount = nonEmptyLines.filter((line) => markerRegex.test(line)).length;

  if (nonEmptyLines.length >= 2 && markerCount >= 2) {
    const grouped: string[] = [];
    for (const line of nonEmptyLines) {
      if (markerRegex.test(line) || grouped.length === 0) {
        grouped.push(line);
      } else {
        grouped[grouped.length - 1] = `${grouped[grouped.length - 1]} ${line}`;
      }
    }
    if (grouped.length >= 2) return grouped;
  }

  const paragraphs = raw
    .split(/\r?\n\s*\r?\n+/)
    .map((p) => p.replace(/\r?\n+/g, ' ').trim())
    .filter(Boolean);
  if (paragraphs.length >= 2) {
    return paragraphs;
  }

  if (nonEmptyLines.length >= 2) {
    return nonEmptyLines;
  }

  return [];
}
