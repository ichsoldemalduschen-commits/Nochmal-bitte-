import React, { useMemo, useState } from 'react';
import { Calculator, ShoppingCart } from 'lucide-react';
import { PluginContextProps, THEME } from '../types';

export const EventQuantityCalcPlugin: React.FC<PluginContextProps> = ({
  onAddCartItems,
  onUpdateProjectMeta,
  onNotify
}) => {
  const [visitors, setVisitors] = useState('350');
  const [conversionPct, setConversionPct] = useState('35');
  const [ballWeightG, setBallWeightG] = useState('265');
  const [hydrationPct, setHydrationPct] = useState('68');
  const [safetyBufferPct, setSafetyBufferPct] = useState('12');

  const calc = useMemo(() => {
    const vis = Math.max(0, Number(visitors) || 0);
    const conv = Math.max(1, Number(conversionPct) || 0) / 100;
    const buffer = 1 + Math.max(0, Number(safetyBufferPct) || 0) / 100;
    const weight = Math.max(150, Number(ballWeightG) || 265);
    const hyd = Math.max(50, Number(hydrationPct) || 68) / 100;

    const targetBalls = Math.ceil(vis * conv * buffer);
    const totalDoughG = targetBalls * weight;
    // Mehl + Wasser (hyd) + Salz (2.8%) + Hefe (0.2%) = 1 + hyd + 0.03
    const flourKg = totalDoughG / (1 + hyd + 0.03) / 1000;
    const waterL = (flourKg * hyd);
    const sugoKg = (targetBalls * 85) / 1000;
    const fiorDiLatteKg = (targetBalls * 95) / 1000;
    const euroBoxesNeeded = Math.ceil(targetBalls / 12);

    return {
      targetBalls,
      flourKg,
      waterL,
      sugoKg,
      fiorDiLatteKg,
      euroBoxesNeeded
    };
  }, [visitors, conversionPct, ballWeightG, hydrationPct, safetyBufferPct]);

  const transferIngredientsToCart = () => {
    onAddCartItems([
      {
        title: 'Pizzamehl Caputo Cuoco / Tipo 00',
        quantity: `${Math.ceil(calc.flourKg)} kg`,
        reason: `Event-Kalkulator (${calc.targetBalls} Teigballen)`
      },
      {
        title: 'San Marzano Tomaten DOP für Sugo',
        quantity: `${calc.sugoKg.toFixed(1)} kg`,
        reason: `Event-Kalkulator (${calc.targetBalls} Pizzen)`
      },
      {
        title: 'Fior di Latte Mozzarella (Schnittfest)',
        quantity: `${calc.fiorDiLatteKg.toFixed(1)} kg`,
        reason: `Event-Kalkulator (${calc.targetBalls} Pizzen)`
      }
    ]);

    onUpdateProjectMeta({
      geplanteTeigballen: calc.targetBalls,
      benoetigteEuroboxen: calc.euroBoxesNeeded
    });

    onNotify(`${calc.targetBalls} Ballen berechnet & Rohstoffe in Einkaufswagen gelegt!`);
  };

  return (
    <div className="p-3.5 rounded-xl border border-white/10 bg-[#2F363D] space-y-3">
      <div className="flex items-center gap-2">
        <Calculator className="w-4 h-4 text-[#14B8A6]" />
        <h4 className="text-xs sm:text-sm font-bold text-white">
          Besucher- &amp; Teigballen-Kalkulator
        </h4>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
        <div>
          <label className="text-[10px] text-[#9CA3AF] block">Erw. Besucher</label>
          <input
            type="number"
            value={visitors}
            onChange={(e) => setVisitors(e.target.value)}
            className="w-full px-2 py-1.5 rounded bg-[#181A1B] text-white font-mono border border-white/10"
          />
        </div>
        <div>
          <label className="text-[10px] text-[#9CA3AF] block">Kaufquote (%)</label>
          <input
            type="number"
            value={conversionPct}
            onChange={(e) => setConversionPct(e.target.value)}
            className="w-full px-2 py-1.5 rounded bg-[#181A1B] text-white font-mono border border-white/10"
          />
        </div>
        <div>
          <label className="text-[10px] text-[#9CA3AF] block">Reserve (%)</label>
          <input
            type="number"
            value={safetyBufferPct}
            onChange={(e) => setSafetyBufferPct(e.target.value)}
            className="w-full px-2 py-1.5 rounded bg-[#181A1B] text-white font-mono border border-white/10"
          />
        </div>
        <div>
          <label className="text-[10px] text-[#9CA3AF] block">Ballen (g)</label>
          <input
            type="number"
            value={ballWeightG}
            onChange={(e) => setBallWeightG(e.target.value)}
            className="w-full px-2 py-1.5 rounded bg-[#181A1B] text-white font-mono border border-white/10"
          />
        </div>
        <div className="col-span-1 sm:col-span-2">
          <label className="text-[10px] text-[#9CA3AF] block">Hydration (%)</label>
          <input
            type="number"
            value={hydrationPct}
            onChange={(e) => setHydrationPct(e.target.value)}
            className="w-full px-2 py-1.5 rounded bg-[#181A1B] text-white font-mono border border-white/10"
          />
        </div>
      </div>

      <div className="p-2.5 rounded-xl bg-[#181A1B] border border-white/10 grid grid-cols-3 gap-2 text-xs">
        <div>
          <span className="text-[10px] text-[#9CA3AF] block">Teigballen</span>
          <strong className="font-mono text-[#14B8A6]">{calc.targetBalls} Stk.</strong>
        </div>
        <div>
          <span className="text-[10px] text-[#9CA3AF] block">Mehl / Wasser</span>
          <strong className="font-mono text-white">
            {calc.flourKg.toFixed(1)} kg / {calc.waterL.toFixed(1)} L
          </strong>
        </div>
        <div>
          <span className="text-[10px] text-[#9CA3AF] block">TSA-Euroboxen</span>
          <strong className="font-mono text-[#14B8A6]">{calc.euroBoxesNeeded} Boxen</strong>
        </div>
        <div>
          <span className="text-[10px] text-[#9CA3AF] block">San Marzano</span>
          <strong className="font-mono text-white">{calc.sugoKg.toFixed(1)} kg</strong>
        </div>
        <div className="col-span-2">
          <span className="text-[10px] text-[#9CA3AF] block">Fior di Latte</span>
          <strong className="font-mono text-white">{calc.fiorDiLatteKg.toFixed(1)} kg</strong>
        </div>
      </div>

      <button
        type="button"
        onClick={transferIngredientsToCart}
        className="w-full py-2 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 transition"
        style={{ backgroundColor: THEME.accentPrimary }}
      >
        <ShoppingCart className="w-3.5 h-3.5" />
        Mengen direkt in den Einkaufswagen übertragen
      </button>
    </div>
  );
};