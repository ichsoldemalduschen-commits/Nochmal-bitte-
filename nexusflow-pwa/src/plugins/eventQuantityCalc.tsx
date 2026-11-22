/**
 * eventQuantityCalc.tsx – Besucher- & Teigballen-Kalkulator (Paket 3)
 *
 * Neu in Paket 3:
 * - ⚙-Einstell-Button (Progressive Disclosure, zugeklappt) oben rechts
 * - Standard-Vorgaben (Ballen-Gewicht, Hydration, Ballen/Eurobox) persistent in IndexedDB
 * - Alle bestehenden Berechnungen und der Einkaufswagen-Übertrag vollständig erhalten
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Calculator, Settings, ShoppingCart, Save, X } from 'lucide-react';
import { PluginContextProps, THEME } from '../types';
import {
  loadDoughCalcDefaults,
  saveDoughCalcDefaults,
  DEFAULT_DOUGH_CALC_DEFAULTS
} from '../services/storage';

export const EventQuantityCalcPlugin: React.FC<PluginContextProps> = ({
  onAddCartItems,
  onUpdateProjectMeta,
  onNotify
}) => {
  // ── Standard-Vorgaben aus IndexedDB ────────────────────────────────────────
  const [defaultsLoaded, setDefaultsLoaded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Settings-State (IDB-gespeicherte Vorgaben)
  const [settingBallWeight, setSettingBallWeight] = useState(
    String(DEFAULT_DOUGH_CALC_DEFAULTS.defaultBallWeightGrams)
  );
  const [settingHydration, setSettingHydration] = useState(
    String(DEFAULT_DOUGH_CALC_DEFAULTS.defaultHydrationPercent)
  );
  const [settingBallsPerBox, setSettingBallsPerBox] = useState(
    String(DEFAULT_DOUGH_CALC_DEFAULTS.defaultBallsPerBox)
  );

  // Berechnungs-State
  const [visitors, setVisitors] = useState('350');
  const [conversionPct, setConversionPct] = useState('35');
  const [ballWeightG, setBallWeightG] = useState('265');
  const [hydrationPct, setHydrationPct] = useState('68');
  const [safetyBufferPct, setSafetyBufferPct] = useState('12');

  // ── IDB laden ───────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const d = await loadDoughCalcDefaults();
      setSettingBallWeight(String(d.defaultBallWeightGrams));
      setSettingHydration(String(d.defaultHydrationPercent));
      setSettingBallsPerBox(String(d.defaultBallsPerBox));
      // Berechnungsfelder mit gespeicherten Vorgaben befüllen
      setBallWeightG(String(d.defaultBallWeightGrams));
      setHydrationPct(String(d.defaultHydrationPercent));
      setDefaultsLoaded(true);
    })();
  }, []);

  const handleSaveDefaults = () => {
    const payload = {
      defaultBallWeightGrams: Number(settingBallWeight) || 265,
      defaultHydrationPercent: Number(settingHydration) || 68,
      defaultBallsPerBox: Number(settingBallsPerBox) || 12
    };
    saveDoughCalcDefaults(payload).catch(() => {});
    // Berechnungsfelder synchronisieren
    setBallWeightG(String(payload.defaultBallWeightGrams));
    setHydrationPct(String(payload.defaultHydrationPercent));
    setSettingsOpen(false);
    onNotify('Teigrechner-Vorgaben gespeichert!');
  };

  // ── Berechnung (exakt wie bisher) ──────────────────────────────────────────
  const ballsPerBox = Number(settingBallsPerBox) || 12;

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
    const waterL = flourKg * hyd;
    const sugoKg = (targetBalls * 85) / 1000;
    const fiorDiLatteKg = (targetBalls * 95) / 1000;
    const euroBoxesNeeded = Math.ceil(targetBalls / ballsPerBox);

    return { targetBalls, flourKg, waterL, sugoKg, fiorDiLatteKg, euroBoxesNeeded };
  }, [visitors, conversionPct, ballWeightG, hydrationPct, safetyBufferPct, ballsPerBox]);

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
    <div className="p-3.5 rounded-xl border border-white/[0.04] bg-[#191C22] space-y-3">
      {/* ── Kopfzeile ── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Calculator className="w-4 h-4 shrink-0 text-[#14B8A6]" />
          <h4 className="text-xs sm:text-sm font-bold text-white leading-tight">
            Besucher- &amp; Teigballen-Kalkulator
          </h4>
        </div>
        <button
          type="button"
          aria-label={settingsOpen ? 'Teigrechner-Einstellungen schließen' : 'Teigrechner-Einstellungen öffnen'}
          onClick={() => setSettingsOpen((o) => !o)}
          className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border shrink-0 transition active:scale-95 ${
            settingsOpen
              ? 'bg-[#E5A93C]/20 border-[#E5A93C]/40 text-[#E5A93C]'
              : 'bg-[#111317] border-white/10 text-[#9CA3AF] hover:text-white'
          }`}
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* ── ⚙ Einstellungsbereich (Progressive Disclosure) ── */}
      {settingsOpen && (
        <div
          className="rounded-xl border border-white/[0.06] bg-[#111317] p-3 space-y-3"
          aria-label="Teigrechner Standard-Vorgaben"
        >
          <span className="text-xs font-semibold text-[#E5A93C]">Standard-Vorgaben</span>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-[#94A3B8] block mb-1">Ballen-Gewicht (g)</label>
              <input
                type="number"
                aria-label="Standard Teigballen-Gewicht in Gramm"
                value={settingBallWeight}
                onChange={(e) => setSettingBallWeight(e.target.value)}
                className="w-full min-h-[44px] px-2.5 rounded-lg text-xs font-mono bg-[#22262F] text-white border border-white/10"
              />
            </div>
            <div>
              <label className="text-xs text-[#94A3B8] block mb-1">Hydration (%)</label>
              <input
                type="number"
                aria-label="Standard Hydration in Prozent"
                value={settingHydration}
                onChange={(e) => setSettingHydration(e.target.value)}
                className="w-full min-h-[44px] px-2.5 rounded-lg text-xs font-mono bg-[#22262F] text-white border border-white/10"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-[#94A3B8] block mb-1">Ballen pro Eurobox</label>
              <input
                type="number"
                aria-label="Teigballen pro Eurobox"
                value={settingBallsPerBox}
                onChange={(e) => setSettingBallsPerBox(e.target.value)}
                className="w-full min-h-[44px] px-2.5 rounded-lg text-xs font-mono bg-[#22262F] text-white border border-white/10"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              aria-label="Teigrechner-Vorgaben speichern"
              onClick={handleSaveDefaults}
              className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold bg-[#0D9488] text-white hover:bg-[#14B8A6] transition"
            >
              <Save className="w-3.5 h-3.5" />
              Speichern & übernehmen
            </button>
            <button
              type="button"
              aria-label="Teigrechner-Einstellungen schließen"
              onClick={() => setSettingsOpen(false)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-xs bg-[#111317] text-[#94A3B8] hover:text-white border border-white/10 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Berechnungsfelder (exakt wie bisher) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
        <div>
          <label className="text-xs text-[#9CA3AF] block">Erw. Besucher</label>
          <input
            type="number"
            value={visitors}
            onChange={(e) => setVisitors(e.target.value)}
            className="w-full px-2 py-1.5 rounded bg-[#111317] text-white font-mono border border-white/10"
          />
        </div>
        <div>
          <label className="text-xs text-[#9CA3AF] block">Kaufquote (%)</label>
          <input
            type="number"
            value={conversionPct}
            onChange={(e) => setConversionPct(e.target.value)}
            className="w-full px-2 py-1.5 rounded bg-[#111317] text-white font-mono border border-white/10"
          />
        </div>
        <div>
          <label className="text-xs text-[#9CA3AF] block">Reserve (%)</label>
          <input
            type="number"
            value={safetyBufferPct}
            onChange={(e) => setSafetyBufferPct(e.target.value)}
            className="w-full px-2 py-1.5 rounded bg-[#111317] text-white font-mono border border-white/10"
          />
        </div>
        <div>
          <label className="text-xs text-[#9CA3AF] block">Ballen (g)</label>
          <input
            type="number"
            value={ballWeightG}
            onChange={(e) => setBallWeightG(e.target.value)}
            className="w-full px-2 py-1.5 rounded bg-[#111317] text-white font-mono border border-white/10"
          />
        </div>
        <div className="col-span-1 sm:col-span-2">
          <label className="text-xs text-[#9CA3AF] block">Hydration (%)</label>
          <input
            type="number"
            value={hydrationPct}
            onChange={(e) => setHydrationPct(e.target.value)}
            className="w-full px-2 py-1.5 rounded bg-[#111317] text-white font-mono border border-white/10"
          />
        </div>
      </div>

      {/* ── Ergebnis-Grid ── */}
      <div className="p-2.5 rounded-xl bg-[#111317] border border-white/10 grid grid-cols-3 gap-2 text-xs">
        <div>
          <span className="text-xs text-[#9CA3AF] block">Teigballen</span>
          <strong className="font-mono text-[#14B8A6]">{calc.targetBalls} Stk.</strong>
        </div>
        <div>
          <span className="text-xs text-[#9CA3AF] block">Mehl / Wasser</span>
          <strong className="font-mono text-white">
            {calc.flourKg.toFixed(1)} kg / {calc.waterL.toFixed(1)} L
          </strong>
        </div>
        <div>
          <span className="text-xs text-[#9CA3AF] block">TSA-Euroboxen</span>
          <strong className="font-mono text-[#14B8A6]">{calc.euroBoxesNeeded} Boxen</strong>
        </div>
        <div>
          <span className="text-xs text-[#9CA3AF] block">San Marzano</span>
          <strong className="font-mono text-white">{calc.sugoKg.toFixed(1)} kg</strong>
        </div>
        <div className="col-span-2">
          <span className="text-xs text-[#9CA3AF] block">Fior di Latte</span>
          <strong className="font-mono text-white">{calc.fiorDiLatteKg.toFixed(1)} kg</strong>
        </div>
      </div>

      {/* ── Einkaufswagen-Übertrag (exakt wie bisher) ── */}
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
