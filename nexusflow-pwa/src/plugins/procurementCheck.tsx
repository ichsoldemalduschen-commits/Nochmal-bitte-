import React from 'react';
import { ExternalLink, Lightbulb, Store } from 'lucide-react';
import { ProcurementCheckData } from '../types';

export function buildProcurementCheck(
  title = '',
  customCheck?: ProcurementCheckData
): ProcurementCheckData {
  if (customCheck?.ideas && customCheck?.regionalVsOnline && customCheck?.searchTerm) {
    return customCheck;
  }

  const cleanSearch = title
    .replace(/\([^)]*\)/g, '')
    .replace(/\d+\s*(?:Säcke|Paar|Kartons|Stück|Packungen|Pakete|Set|x|kg|m|mm|L)\b/gi, '')
    .trim();
  const searchTerm = cleanSearch || title || 'Werkstatt Bedarf';
  const lower = title.toLowerCase();

  if (/(gas|propan|regler|schlauch|kabel|cee|verteiler)/i.test(lower)) {
    return {
      ideas:
        'Gewerbe-Ausführung mit DVGW-/VDE-Prüfzeichen wählen (+ Pflicht für gewerbliche Abnahmen & hohe Hitzebeständigkeit).',
      regionalVsOnline:
        '🏪 Regional im Baumarkt (Bauhaus/Hornbach) direkt prüfen & sofort mitnehmen; Spezial-Gewerberegler (BGV D34) online gegenprüfen.',
      searchTerm
    };
  }

  if (/(auszug|schwerlast|shelly|eurobox|knopfzelle|cr2032|leinen)/i.test(lower)) {
    return {
      ideas:
        'Industrie-/Gastronorm-Qualität mit Rastfunktion bzw. Staffelpack wählen (+ exakte Passform für den TSA-Ausbau, deutlich günstiger pro Stück).',
      regionalVsOnline:
        '📦 Online bestellen – Schwerlastauszüge mit Verriegelung, Shelly-Aktoren und lebensmittelechte Pizzaballen-Boxen sind online bis zu 40 % günstiger.',
      searchTerm
    };
  }

  return {
    ideas:
      'Option A: Gewerbe-/Edelstahlausführung (CNS 1.4301) für Dauerbelastung. Option B: Standard-Ausführung für schnellen Austausch.',
    regionalVsOnline:
      '⚖️ Bei heutigem Einbau lokal im Baumarkt holen; für geplante Baugruppen vorab Preise vergleichen.',
    searchTerm
  };
}

export const ProcurementCheckPanel: React.FC<{
  title: string;
  customCheck?: ProcurementCheckData;
}> = ({ title, customCheck }) => {
  const proc = buildProcurementCheck(title, customCheck);
  const encoded = encodeURIComponent(proc.searchTerm);

  const openSearch = (baseUrl: string) => {
    window.open(baseUrl + encoded, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="px-3 pb-3 pt-2 border-t border-white/10 bg-[#181A1B]/85 space-y-2.5 text-xs">
      <div className="flex items-start gap-2">
        <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <span className="text-xs font-bold uppercase text-[#14B8A6] block">
            Ausführungsideen &amp; Abwägung
          </span>
          <p className="text-xs text-[#F8F9FA]/90 leading-relaxed break-words">{proc.ideas}</p>
        </div>
      </div>

      <div className="flex items-start gap-2">
        <Store className="w-3.5 h-3.5 text-[#14B8A6] shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <span className="text-xs font-bold uppercase text-[#14B8A6] block">
            Regional vs. Online
          </span>
          <p className="text-xs text-[#F8F9FA]/90 leading-relaxed break-words">{proc.regionalVsOnline}</p>
        </div>
      </div>

      <div className="pt-1 border-t border-white/10">
        <span className="text-xs font-bold uppercase text-[#9CA3AF] block mb-1.5 break-words">
          1-Klick-Preisvergleich („{proc.searchTerm}“):
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => openSearch('https://www.bauhaus.info/suche/produkte?text=')}
            className="min-w-0 py-1.5 px-1.5 rounded-lg bg-[#24292E] hover:bg-[#0A9396] text-white font-semibold text-xs flex items-center justify-center gap-1 border border-white/10 transition"
          >
            <span className="truncate">Bauhaus</span>
            <ExternalLink className="w-3 h-3 shrink-0" />
          </button>
          <button
            type="button"
            onClick={() => openSearch('https://www.hornbach.de/s/')}
            className="min-w-0 py-1.5 px-1.5 rounded-lg bg-[#24292E] hover:bg-[#0A9396] text-white font-semibold text-xs flex items-center justify-center gap-1 border border-white/10 transition"
          >
            <span className="truncate">Hornbach</span>
            <ExternalLink className="w-3 h-3 shrink-0" />
          </button>
          <button
            type="button"
            onClick={() => openSearch('https://www.amazon.de/s?k=')}
            className="min-w-0 py-1.5 px-1.5 rounded-lg bg-[#24292E] hover:bg-[#0A9396] text-white font-semibold text-xs flex items-center justify-center gap-1 border border-white/10 transition"
          >
            <span className="truncate">Amazon</span>
            <ExternalLink className="w-3 h-3 shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
};