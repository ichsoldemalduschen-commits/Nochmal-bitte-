import React, { useState } from 'react';
import { CheckCircle2, Flame, Minus, Plus, RotateCcw } from 'lucide-react';
import { PluginContextProps, PosSoldVariety, THEME } from '../types';
import { formatNow } from '../services/storage';

const DEFAULT_VARIETIES: PosSoldVariety[] = [
  { id: 'v-marg', name: 'Margherita DOP', unitPrice: 11.5, unitCost: 2.65, count: 0 },
  { id: 'v-diav', name: 'Diavola Piccante', unitPrice: 13.5, unitCost: 3.35, count: 0 },
  { id: 'v-pros', name: 'Prosciutto & Funghi', unitPrice: 13.0, unitCost: 3.2, count: 0 },
  { id: 'v-band', name: 'Bandit Special', unitPrice: 14.5, unitCost: 3.85, count: 0 }
];

export const PosTapClickerPlugin: React.FC<PluginContextProps> = ({
  project,
  onUpdateProjectMeta,
  onRecordEventSale,
  onNotify
}) => {
  const [eventName, setEventName] = useState('Streetfood Einsatz');
  const [varieties, setVarieties] = useState<PosSoldVariety[]>(DEFAULT_VARIETIES);
  const [tipFund, setTipFund] = useState<number>(0);

  const totalPizzas = varieties.reduce((acc, v) => acc + v.count, 0);
  const grossRevenue = varieties.reduce((acc, v) => acc + v.count * v.unitPrice, 0);
  const cogsTotal = varieties.reduce((acc, v) => acc + v.count * v.unitCost, 0);
  const grossProfit = grossRevenue - cogsTotal;

  const updateCount = (id: string, delta: number) => {
    setVarieties((prev) =>
      prev.map((v) => (v.id === id ? { ...v, count: Math.max(0, v.count + delta) } : v))
    );
  };

  const handleCheckoutEvent = () => {
    if (totalPizzas === 0 && tipFund === 0) {
      onNotify('Noch keine Verkäufe oder Trinkgelder gezählt.');
      return;
    }

    const previousFund = Number(project.customMeta?.feuerwehrautoFondsGesamt || 0);
    const updatedFund = Number((previousFund + tipFund).toFixed(2));

    onRecordEventSale({
      id: `sale-${Date.now()}`,
      timestamp: formatNow(),
      eventName: eventName.trim() || 'Pizza Bandit Event',
      projectId: project.id,
      totalPizzas,
      grossRevenue,
      cogsTotal,
      grossProfit,
      firetruckTipFund: tipFund,
      items: varieties
    });

    onUpdateProjectMeta({
      letztesEventUmsatz: grossRevenue.toFixed(2),
      feuerwehrautoFondsGesamt: updatedFund
    });

    setVarieties(DEFAULT_VARIETIES);
    setTipFund(0);
    onNotify('Event-Abrechnung in Backoffice-Auswertung gespeichert!');
  };

  return (
    <div className="p-3.5 rounded-xl border border-white/10 bg-[#2F363D] space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-[#14B8A6]" />
          <h4 className="text-xs sm:text-sm font-bold text-white">
            Live-Verkaufs-Clicker (POS)
          </h4>
        </div>
        <button
          type="button"
          onClick={() => {
            setVarieties(DEFAULT_VARIETIES);
            setTipFund(0);
          }}
          className="text-[10px] px-2 py-1 rounded bg-[#181A1B] text-[#9CA3AF] hover:text-white flex items-center gap-1"
        >
          <RotateCcw className="w-3 h-3" />
          Nullen
        </button>
      </div>

      <input
        type="text"
        value={eventName}
        onChange={(e) => setEventName(e.target.value)}
        placeholder="Event-Bezeichnung (z. B. Hafenmarkt)..."
        className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-[#181A1B] text-white border border-white/10"
      />

      {/* 4 große Touch-Buttons für den Einhand-Verkauf */}
      <div className="grid grid-cols-2 gap-2">
        {varieties.map((v) => (
          <div
            key={v.id}
            className="p-2.5 rounded-xl bg-[#181A1B] border border-white/10 flex flex-col justify-between gap-2"
          >
            <div>
              <span className="text-xs font-bold text-white block truncate">{v.name}</span>
              <span className="text-[10px] font-mono text-[#9CA3AF]">
                VK {v.unitPrice.toFixed(2)} € • WE {v.unitCost.toFixed(2)} €
              </span>
            </div>

            <div className="flex items-center justify-between gap-1 pt-1">
              <button
                type="button"
                onClick={() => updateCount(v.id, -1)}
                className="w-11 h-11 rounded-lg bg-[#24292E] text-[#9CA3AF] hover:text-white flex items-center justify-center border border-white/10 active:scale-95 transition"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="text-base font-mono font-bold text-[#14B8A6]">{v.count}</span>
              <button
                type="button"
                onClick={() => updateCount(v.id, 1)}
                className="px-3 h-11 rounded-lg text-white font-bold text-xs flex items-center gap-1 shadow active:scale-95 transition"
                style={{ backgroundColor: THEME.accentPrimary }}
              >
                <Plus className="w-4 h-4" />1
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Feuerwehrauto-Fonds Trinkgeld-Zähler */}
      <div className="p-2.5 rounded-xl bg-[#181A1B] border border-red-500/30 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-[#F8F9FA]">? Feuerwehrauto-Fonds (Trinkgeld)</span>
          <span className="font-mono font-bold text-[#14B8A6]">{tipFund.toFixed(2)} €</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {[1, 2, 5].map((amt) => (
            <button
              key={amt}
              type="button"
              onClick={() => setTipFund((t) => Number((t + amt).toFixed(2)))}
              className="py-1.5 rounded-lg text-xs font-bold bg-[#24292E] hover:bg-[#0A9396] text-white border border-white/10 transition"
            >
              +{amt} €
            </button>
          ))}
          <button
            type="button"
            onClick={() => setTipFund((t) => Math.max(0, Number((t - 1).toFixed(2))))}
            className="py-1.5 rounded-lg text-xs bg-[#24292E] text-[#9CA3AF] hover:text-white border border-white/10"
          >
            -1 €
          </button>
        </div>
        <div className="text-[10px] text-[#9CA3AF]">
          Gesamtstand Fonds bisher:{' '}
          <strong className="text-white font-mono">
            {Number(project.customMeta?.feuerwehrautoFondsGesamt || 0).toFixed(2)} €
          </strong>
        </div>
      </div>

      {/* Live-Summenzeile + 1-Klick-Abschluss */}
      <div className="p-2.5 rounded-xl bg-[#181A1B] border border-white/10 grid grid-cols-3 gap-2 text-center">
        <div>
          <span className="text-[10px] text-[#9CA3AF] block">Pizzen</span>
          <strong className="text-xs font-mono text-white">{totalPizzas} Stk.</strong>
        </div>
        <div>
          <span className="text-[10px] text-[#9CA3AF] block">Umsatz</span>
          <strong className="text-xs font-mono text-[#14B8A6]">{grossRevenue.toFixed(2)} €</strong>
        </div>
        <div>
          <span className="text-[10px] text-[#9CA3AF] block">Rohertrag</span>
          <strong className="text-xs font-mono text-emerald-400">
            {grossProfit.toFixed(2)} €
          </strong>
        </div>
      </div>

      <button
        type="button"
        onClick={handleCheckoutEvent}
        className="w-full py-2.5 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 shadow-lg transition active:scale-98"
        style={{ backgroundColor: THEME.accentPrimary }}
      >
        <CheckCircle2 className="w-4 h-4" />
        1-Klick Event-Abschluss in Backoffice buchen
      </button>
    </div>
  );
};