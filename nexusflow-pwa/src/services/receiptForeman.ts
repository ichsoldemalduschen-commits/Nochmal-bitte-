import { Project, ScannedReceipt } from '../types';

export const RECEIPT_CATEGORIES = [
  'Material',
  'Lebensmittel',
  'Werkzeug',
  'Betrieb',
  'Sonstiges'
] as const;

export type ReceiptCategory = (typeof RECEIPT_CATEGORIES)[number];

export interface ReceiptPlausibilityResult {
  isDuplicate: boolean;
  duplicateOfId?: string;
  duplicateSummary?: string;
  warnings: string[];
  grossAmount: number;
  vatRate: number;
  netAmount: number;
  vatAmount: number;
  taxIsEstimated: boolean;
  suggestedCategory: string;
}

export interface CartReconcileMatch {
  cartItemId: string;
  projectId: string;
  projectName: string;
  projectColor: string;
  cartTitle: string;
  receiptItemLabel: string;
  receiptPrice?: string;
}

export interface TaxAdvisorMonthlySummary {
  monthKey: string;
  projectFilterId: string;
  count: number;
  totalGross: number;
  totalNet: number;
  totalVat: number;
  reconciledCount: number;
  availableMonths: string[];
  filteredReceipts: ScannedReceipt[];
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function formatEuroDe(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return safe.toFixed(2).replace('.', ',');
}

export function parseEuroAmount(raw: unknown): number {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? round2(raw) : 0;
  }
  const cleaned = String(raw ?? '')
    .replace(/EUR|€/gi, '')
    .replace(/\s+/g, '')
    .trim();
  if (!cleaned) return 0;

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  let normalized = cleaned;
  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      normalized = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = cleaned.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    normalized = cleaned.replace(',', '.');
  } else if (lastDot !== -1 && /^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    normalized = cleaned.replace(/\./g, '');
  }

  const parsed = Number.parseFloat(normalized.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? round2(parsed) : 0;
}

function foldUmlauts(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');
}

export function normalizeStoreName(storeName: string): string {
  return foldUmlauts(String(storeName || ''))
    .replace(/\b(gmbh|ug|ag|kg|ohg|mbh|co|inc|ltd)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function parseReceiptDate(dateStr: string): Date | null {
  const raw = String(dateStr || '').trim();
  if (!raw) return null;

  // ISO YYYY-MM-DD (optionally with time)
  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    }
  }

  // German DD.MM.YYYY or DD.MM.YY or DD/MM/YYYY
  const deMatch = raw.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})/);
  if (deMatch) {
    const d = Number(deMatch[1]);
    const m = Number(deMatch[2]);
    let y = Number(deMatch[3]);
    if (y < 100) y += 2000;
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    }
  }

  return null;
}

export function toMonthKey(dateStr: string): string | null {
  const dt = parseReceiptDate(dateStr);
  if (!dt) return null;
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function formatMonthLabel(monthKey: string): string {
  if (!monthKey || monthKey === 'all') return 'Alle Monate';
  const match = monthKey.match(/^(\d{4})-(\d{2})$/);
  if (!match) return monthKey;
  return `${match[2]}.${match[1]}`;
}

function areDatesWithinOneDay(dateA: string, dateB: string): boolean {
  const parsedA = parseReceiptDate(dateA);
  const parsedB = parseReceiptDate(dateB);
  if (parsedA && parsedB) {
    const diffMs = Math.abs(parsedA.getTime() - parsedB.getTime());
    return diffMs <= 24 * 60 * 60 * 1000 + 1000;
  }
  const cleanA = String(dateA || '').trim().toLowerCase();
  const cleanB = String(dateB || '').trim().toLowerCase();
  return Boolean(cleanA && cleanB && cleanA === cleanB);
}

function areStoresSimilar(storeA: string, storeB: string): boolean {
  const normA = normalizeStoreName(storeA);
  const normB = normalizeStoreName(storeB);
  if (!normA || !normB) return false;
  if (normA === normB) return true;
  if (normA.length >= 3 && normB.length >= 3) {
    return normA.includes(normB) || normB.includes(normA);
  }
  return false;
}

export function inferReceiptCategory(receipt: Pick<ScannedReceipt, 'storeName' | 'items' | 'category'>): string {
  if (receipt.category && receipt.category.trim()) {
    return receipt.category.trim();
  }
  const combined = foldUmlauts(
    [receipt.storeName || '', ...(receipt.items || []).map((it) => it.title || '')].join(' ')
  );

  if (
    /(metro|selgros|rewe|edeka|aldi|lidl|kaufland|netto|penny|tegut|alnatura|baeckerei|mehl|mozzarella|kaese|tomate|hefe|olivenoel|salame|salami|teig|pizza|lebensmittel|getraenk)/.test(
      combined
    )
  ) {
    return 'Lebensmittel';
  }
  if (
    /(bohrer|saege|schrauber|flex|makita|bosch|dewalt|zange|hammer|werkzeug|messgeraet|schluessel)/.test(
      combined
    )
  ) {
    return 'Werkzeug';
  }
  if (
    /(bauhaus|obi|hornbach|toom|hellweg|hagebau|wuerth|silikon|schraube|holz|rohr|kabel|fliese|moertel|kleber|farbe|lack|dichtung|schlauch|material)/.test(
      combined
    )
  ) {
    return 'Material';
  }
  if (
    /(aral|shell|esso|total|jet|tankstelle|diesel|benzin|strom|telekom|vodafone|gas|versicherung|porto|dhl|buero)/.test(
      combined
    )
  ) {
    return 'Betrieb';
  }
  return 'Sonstiges';
}

export function checkReceiptPlausibilityAndDuplicates(
  candidate: ScannedReceipt,
  existingReceipts: ScannedReceipt[]
): ReceiptPlausibilityResult {
  const warnings: string[] = [];
  const grossAmount = parseEuroAmount(candidate.totalAmount);
  const suggestedCategory = inferReceiptCategory(candidate);

  const vatRate =
    typeof candidate.vatRate === 'number' && Number.isFinite(candidate.vatRate) && candidate.vatRate >= 0
      ? candidate.vatRate
      : suggestedCategory === 'Lebensmittel'
        ? 7
        : 19;

  const hasExplicitNet =
    typeof candidate.netAmount === 'number' && Number.isFinite(candidate.netAmount) && candidate.netAmount >= 0;
  const hasExplicitVat =
    typeof candidate.vatAmount === 'number' && Number.isFinite(candidate.vatAmount) && candidate.vatAmount >= 0;

  let netAmount: number;
  let vatAmount: number;
  let taxIsEstimated: boolean;

  if (hasExplicitNet && hasExplicitVat) {
    netAmount = round2(candidate.netAmount!);
    vatAmount = round2(candidate.vatAmount!);
    taxIsEstimated = false;
    if (grossAmount > 0 && Math.abs(netAmount + vatAmount - grossAmount) > 0.05) {
      warnings.push(
        `Netto (${formatEuroDe(netAmount)} €) + MwSt (${formatEuroDe(vatAmount)} €) weicht vom Brutto (${formatEuroDe(grossAmount)} €) ab.`
      );
    }
  } else {
    netAmount = grossAmount > 0 ? round2(grossAmount / (1 + vatRate / 100)) : 0;
    vatAmount = grossAmount > 0 ? round2(grossAmount - netAmount) : 0;
    taxIsEstimated = true;
  }

  if (!String(candidate.storeName || '').trim()) {
    warnings.push('Händlername fehlt.');
  }
  if (!String(candidate.purchaseDate || '').trim()) {
    warnings.push('Kaufdatum fehlt.');
  }
  if (grossAmount <= 0) {
    warnings.push('Bruttobetrag fehlt oder ist ≤ 0,00 €.');
  }

  let isDuplicate = false;
  let duplicateOfId: string | undefined;
  let duplicateSummary: string | undefined;

  for (const existing of existingReceipts) {
    if (!existing || existing.id === candidate.id) continue;
    if (!areStoresSimilar(candidate.storeName, existing.storeName)) continue;
    if (!areDatesWithinOneDay(candidate.purchaseDate, existing.purchaseDate)) continue;

    const existingGross = parseEuroAmount(existing.totalAmount);
    if (Math.abs(grossAmount - existingGross) <= 0.02) {
      isDuplicate = true;
      duplicateOfId = existing.id;
      duplicateSummary = `Möglicher Doppel-Beleg: ${existing.storeName || 'Händler'} vom ${existing.purchaseDate || 'unbekannt'} (${formatEuroDe(existingGross)} €)`;
      break;
    }
  }

  return {
    isDuplicate,
    duplicateOfId,
    duplicateSummary,
    warnings,
    grossAmount,
    vatRate,
    netAmount,
    vatAmount,
    taxIsEstimated,
    suggestedCategory
  };
}

const MATCH_STOPWORDS = new Set([
  'fuer',
  'und',
  'oder',
  'mit',
  'ohne',
  'aus',
  'von',
  'der',
  'die',
  'das',
  'ein',
  'eine',
  'weiss',
  'schwarz',
  'grau',
  'blau',
  'rot',
  'gruen',
  'gelb',
  'braun',
  'gross',
  'klein',
  'lang',
  'kurz',
  'neu',
  'pro',
  'bauhaus',
  'hornbach',
  'toom',
  'metro',
  'rewe',
  'edeka',
  'aldi',
  'lidl',
  'obi'
]);

function normalizeMatchTokens(raw: string): { phrase: string; tokens: string[] } {
  const withoutMeasures = foldUmlauts(String(raw || ''))
    .replace(
      /\b\d+([.,]\d+)?\s*(x|stk|st|stueck|g|kg|mg|ml|l|cl|m|cm|mm|set|pack|pck|pkt|dose|tuben?|sack|karton|rolle|flasche)\b/gi,
      ' '
    )
    .replace(/\b\d+([.,]\d+)?\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const tokens = withoutMeasures
    .split(/\s+/)
    .filter((t) => t.length >= 4 && !MATCH_STOPWORDS.has(t));

  return {
    phrase: withoutMeasures,
    tokens
  };
}

function hasStemOrSubstringOverlap(tokenA: string, tokenB: string): boolean {
  if (tokenA === tokenB) return true;
  if (tokenA.includes(tokenB) || tokenB.includes(tokenA)) return true;

  // Prefix / Wortstamm >= 4 Zeichen prüfen (z. B. Silikon / Silikonkartusche oder Schraube / Schrauben)
  const shorter = tokenA.length <= tokenB.length ? tokenA : tokenB;
  const longer = tokenA.length <= tokenB.length ? tokenB : tokenA;
  if (shorter.length < 4) return false;

  for (let i = 0; i <= shorter.length - 4; i++) {
    const sub = shorter.slice(i, i + 4);
    if (longer.includes(sub)) {
      return true;
    }
  }
  return false;
}

function doReceiptAndCartTextsMatch(receiptTitle: string, cartTitle: string): boolean {
  const rNorm = normalizeMatchTokens(receiptTitle);
  const cNorm = normalizeMatchTokens(cartTitle);

  if (!rNorm.phrase || !cNorm.phrase) return false;
  if (rNorm.phrase === cNorm.phrase) return true;

  if (
    rNorm.phrase.length >= 4 &&
    cNorm.phrase.length >= 4 &&
    (rNorm.phrase.includes(cNorm.phrase) || cNorm.phrase.includes(rNorm.phrase))
  ) {
    return true;
  }

  for (const rTok of rNorm.tokens) {
    for (const cTok of cNorm.tokens) {
      if (hasStemOrSubstringOverlap(rTok, cTok)) {
        return true;
      }
    }
  }

  return false;
}

export function findCartMatchesForReceipt(
  receipt: ScannedReceipt,
  projects: Project[],
  preferredProjectId?: string
): CartReconcileMatch[] {
  const activeProjects = projects.filter((p) => !p.archived);
  const targetId = preferredProjectId || receipt.projectId;

  const orderedProjects = [
    ...activeProjects.filter((p) => p.id === targetId),
    ...activeProjects.filter((p) => p.id !== targetId)
  ];

  const matches: CartReconcileMatch[] = [];
  const matchedCartItemIds = new Set<string>();

  for (const proj of orderedProjects) {
    const projColor =
      (proj.customMeta?.customAccentColor as string | undefined) ||
      proj.accentColor ||
      '#0D9488';

    for (const cartItem of proj.cart || []) {
      if (cartItem.completed || matchedCartItemIds.has(cartItem.id)) continue;

      const matchedReceiptItem = (receipt.items || []).find((rcptItem) =>
        doReceiptAndCartTextsMatch(rcptItem.title, cartItem.title)
      );

      if (matchedReceiptItem) {
        matchedCartItemIds.add(cartItem.id);
        matches.push({
          cartItemId: cartItem.id,
          projectId: proj.id,
          projectName: proj.name,
          projectColor: projColor,
          cartTitle: cartItem.title,
          receiptItemLabel: matchedReceiptItem.title,
          receiptPrice: matchedReceiptItem.price ? String(matchedReceiptItem.price) : undefined
        });
      }
    }
  }

  return matches;
}

function filterReceipts(
  receipts: ScannedReceipt[],
  monthKey: string,
  projectFilterId: string
): ScannedReceipt[] {
  return receipts.filter((r) => {
    if (projectFilterId && projectFilterId !== 'all' && r.projectId !== projectFilterId) {
      return false;
    }
    if (monthKey && monthKey !== 'all') {
      const rMonth = toMonthKey(r.purchaseDate);
      if (rMonth !== monthKey) return false;
    }
    return true;
  });
}

export function buildTaxAdvisorMonthlySummary(
  receipts: ScannedReceipt[],
  _projects: Project[],
  monthKey: string,
  projectFilterId: string
): TaxAdvisorMonthlySummary {
  const monthSet = new Set<string>();
  for (const r of receipts) {
    const mk = toMonthKey(r.purchaseDate);
    if (mk) monthSet.add(mk);
  }
  const availableMonths = Array.from(monthSet).sort((a, b) => b.localeCompare(a));

  const filtered = filterReceipts(receipts, monthKey, projectFilterId);

  let totalGross = 0;
  let totalNet = 0;
  let totalVat = 0;
  let reconciledCount = 0;

  for (const r of filtered) {
    const check = checkReceiptPlausibilityAndDuplicates(r, []);
    totalGross = round2(totalGross + check.grossAmount);
    totalNet = round2(totalNet + check.netAmount);
    totalVat = round2(totalVat + check.vatAmount);
    if (r.reconciledAt || r.reconciled) {
      reconciledCount += 1;
    }
  }

  return {
    monthKey,
    projectFilterId,
    count: filtered.length,
    totalGross,
    totalNet,
    totalVat,
    reconciledCount,
    availableMonths,
    filteredReceipts: filtered
  };
}

function escapeCsvField(val: string): string {
  const str = String(val ?? '').replace(/\r?\n/g, ' ').trim();
  if (str.includes(';') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportReceiptsToGermanCsv(
  receipts: ScannedReceipt[],
  projects: Project[],
  monthKey: string,
  projectFilterId: string
): string {
  const filtered = filterReceipts(receipts, monthKey, projectFilterId);
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  const header =
    'Datum;Projekt;Bereich;Haendler;Kategorie;Netto_EUR;MwSt_EUR;Brutto_EUR;Abgeglichen;ID';

  const rows = filtered.map((r) => {
    const proj = r.projectId ? projectMap.get(r.projectId) : undefined;
    const projectName = proj?.name || r.projectName || 'Nicht zugeordnet';
    const domainVal = proj?.businessDomain || proj?.domain || 'business';
    const domainLabel = domainVal === 'private' ? 'Privat' : 'Betrieb';
    const check = checkReceiptPlausibilityAndDuplicates(r, []);

    return [
      escapeCsvField(r.purchaseDate || ''),
      escapeCsvField(projectName),
      escapeCsvField(domainLabel),
      escapeCsvField(r.storeName || ''),
      escapeCsvField(check.suggestedCategory),
      formatEuroDe(check.netAmount),
      formatEuroDe(check.vatAmount),
      formatEuroDe(check.grossAmount),
      r.reconciledAt || r.reconciled ? 'Ja' : 'Nein',
      escapeCsvField(r.id)
    ].join(';');
  });

  return '\uFEFF' + [header, ...rows].join('\r\n');
}

export function formatTaxAdvisorSummaryText(
  receipts: ScannedReceipt[],
  projects: Project[],
  monthKey: string,
  projectFilterId: string
): string {
  const summary = buildTaxAdvisorMonthlySummary(receipts, projects, monthKey, projectFilterId);
  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const projectLabel =
    projectFilterId === 'all'
      ? 'Alle Projekte'
      : projectMap.get(projectFilterId)?.name || projectFilterId;

  const lines: string[] = [
    `BANDIT.OS Steuerberater-Monatspaket (${formatMonthLabel(monthKey)} | ${projectLabel})`,
    `Belege: ${summary.count} (davon ${summary.reconciledCount} abgeglichen)`,
    `Netto: ${formatEuroDe(summary.totalNet)} €`,
    `MwSt: ${formatEuroDe(summary.totalVat)} €`,
    `Brutto: ${formatEuroDe(summary.totalGross)} €`
  ];

  if (summary.filteredReceipts.length > 0) {
    lines.push('');
    lines.push('Einzelbelege:');
    for (const r of summary.filteredReceipts) {
      const proj = r.projectId ? projectMap.get(r.projectId) : undefined;
      const check = checkReceiptPlausibilityAndDuplicates(r, []);
      lines.push(
        `- ${r.purchaseDate || 'ohne Datum'} | ${r.storeName || 'Händler'} | ${proj?.name || r.projectName || 'Ohne Projekt'} | ${check.suggestedCategory} | ${formatEuroDe(check.grossAmount)} € (MwSt ${check.vatRate}%)`
      );
    }
  }

  return lines.join('\n');
}
