/**
 * gastroInventoryBridge.ts – Reine, testbare Logik für den Gastro-Lager- & Zutaten-Abgleich
 * zwischen POS-Clicker / Teigrechner und dem offenen Einkaufswagen.
 */

export interface GastroRestockSuggestion {
  id: string;
  title: string;
  quantity: string;
  reason: string;
  alreadyInCart: boolean;
}

const STOP_WORDS = new Set([
  'fuer',
  'oder',
  'inkl',
  'zum',
  'zur',
  'mit',
  'und',
  'aus',
  'der',
  'die',
  'das',
  'von',
  'tipo',
  'set',
  'stueck',
  'pack',
  'dose',
  'beutel',
  'karton',
  'pizza'
]);

/** Normalisiert Produkttitel für robusten Dubletten-Vergleich. */
export function normalizeCartComparisonText(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractSignificantTokens(normalized: string): string[] {
  return normalized
    .split(' ')
    .map((t) => t.trim())
    .filter((t) => t.length >= 4 && !STOP_WORDS.has(t));
}

function tokensMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const minLen = Math.min(a.length, b.length);
  if (minLen >= 6 && (a.startsWith(b) || b.startsWith(a))) return true;
  if (a.includes('mehl') && b.includes('mehl')) return true;
  if (a.includes('tomat') && b.includes('tomat')) return true;
  if (a.includes('karton') && b.includes('karton')) return true;
  return false;
}

/** Prüft, ob ein Artikel bereits (exakt oder sinngemäß) auf der offenen Einkaufsliste steht. */
export function isTitleInOpenCart(
  candidateTitle: string,
  existingOpenCartTitles: string[]
): boolean {
  const normCandidate = normalizeCartComparisonText(candidateTitle);
  if (!normCandidate) return false;
  const candidateTokens = extractSignificantTokens(normCandidate);

  for (const existing of existingOpenCartTitles) {
    const normExisting = normalizeCartComparisonText(existing);
    if (!normExisting) continue;

    if (normCandidate === normExisting) return true;
    if (
      normCandidate.length >= 5 &&
      normExisting.length >= 5 &&
      (normCandidate.includes(normExisting) || normExisting.includes(normCandidate))
    ) {
      return true;
    }

    const existingTokens = extractSignificantTokens(normExisting);
    let sharedCount = 0;
    for (const ct of candidateTokens) {
      if (existingTokens.some((et) => tokensMatch(ct, et))) {
        sharedCount += 1;
        if (ct.length >= 6 || existingTokens.some((et) => et.length >= 6 && tokensMatch(ct, et))) {
          return true;
        }
      }
    }
    if (sharedCount >= 2) return true;
  }

  return false;
}

/**
 * Berechnet aus verkauften Pizzen eine saubere Nachorder-Vorschlagsliste
 * ohne Dubletten gegenüber offenen Einkaufsartikeln.
 */
export function computePosRestockItems(
  totalPizzasSold: number,
  existingOpenCartTitles: string[]
): GastroRestockSuggestion[] {
  const sold = Math.max(0, Math.floor(Number(totalPizzasSold) || 0));
  if (sold <= 0) return [];

  const flourKg = Math.max(1, Math.ceil((sold * 160) / 1000));
  const fiorKg = Math.max(0.1, Number(((sold * 95) / 1000).toFixed(1))).toFixed(1);
  const sugoKg = Math.max(0.1, Number(((sold * 85) / 1000).toFixed(1))).toFixed(1);
  const reason = `POS-Verbrauch (${sold} Pizzen)`;

  const candidates = [
    {
      id: 'pos-restock-flour',
      title: 'Teigballen-Mehl (Pizzamehl Tipo 00)',
      quantity: `${flourKg} kg`,
      reason
    },
    {
      id: 'pos-restock-fior',
      title: 'Fior di Latte / Mozzarella',
      quantity: `${fiorKg} kg`,
      reason
    },
    {
      id: 'pos-restock-sugo',
      title: 'San-Marzano-Tomatensauce',
      quantity: `${sugoKg} kg`,
      reason
    },
    {
      id: 'pos-restock-boxes',
      title: 'Pizzakartons (32×32 cm)',
      quantity: `${sold} Stk.`,
      reason
    }
  ];

  return candidates.map((item) => ({
    ...item,
    alreadyInCart: isTitleInOpenCart(item.title, existingOpenCartTitles)
  }));
}

/**
 * Gleicht berechnete Teigrechner-Zutaten gegen offene Einkaufswagen-Artikel ab.
 */
export function computeDoughRestockItems(
  ingredients: Array<{ label: string; quantity: string }>,
  existingOpenCartTitles: string[]
): GastroRestockSuggestion[] {
  return ingredients
    .filter((item) => String(item.label || '').trim().length > 0)
    .map((item, idx) => {
      const cleanTitle = item.label.trim();
      const cleanQty = String(item.quantity || '1x').trim() || '1x';
      return {
        id: `dough-restock-${idx}`,
        title: cleanTitle,
        quantity: cleanQty,
        reason: 'Teigrechner-Abgleich',
        alreadyInCart: isTitleInOpenCart(cleanTitle, existingOpenCartTitles)
      };
    });
}
