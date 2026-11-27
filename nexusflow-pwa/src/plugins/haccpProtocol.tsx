import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Copy,
  Download,
  Flame,
  Thermometer,
  Trash2
} from 'lucide-react';
import { DESIGN_TOKENS } from '../config/designTokens';
import { HaccpLogEntry, PluginContextProps, THEME } from '../types';
import {
  formatNow,
  loadHaccpLogsAsync,
  saveHaccpLogs
} from '../services/storage';

const CHECK_ITEMS: Array<{
  key: keyof HaccpLogEntry['checks'];
  label: string;
  testId: string;
}> = [
  {
    key: 'surfacesSanitized',
    label: 'HPL-Arbeitsflächen desinfiziert',
    testId: 'haccp-check-surfaces'
  },
  {
    key: 'handwashReady',
    label: 'Handwaschplatz & Seife/Papier bereit',
    testId: 'haccp-check-handwash'
  },
  {
    key: 'coolingChainOk',
    label: 'Kühlkette geprüft',
    testId: 'haccp-check-cooling'
  },
  {
    key: 'endCleaningDone',
    label: 'Endreinigung erledigt',
    testId: 'haccp-check-cleaning'
  }
];

function parseOptionalTemp(raw: string): number | null {
  const clean = raw.trim().replace(',', '.');
  if (!clean) return null;
  const num = Number(clean);
  return Number.isFinite(num) ? num : null;
}

function formatGermanTemp(val?: number | null): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '';
  return String(val).replace('.', ',');
}

function escapeCsvCell(value: string): string {
  if (/[;"\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function buildHaccpCsv(entries: HaccpLogEntry[]): string {
  const header =
    'Datum;Zeit;Event;Kuehlung_C;Saladette_C;Warmwasser;Flaechen;Handwaschplatz;Kuehlkette;Endreinigung;Notiz';
  const rows = entries.map((e) =>
    [
      e.dateISO,
      e.timestamp,
      e.eventLabel,
      formatGermanTemp(e.fridgeTempC),
      formatGermanTemp(e.saladetteTempC),
      e.hotWaterOk ? 'OK' : 'Offen',
      e.checks.surfacesSanitized ? 'OK' : 'Offen',
      e.checks.handwashReady ? 'OK' : 'Offen',
      e.checks.coolingChainOk ? 'OK' : 'Offen',
      e.checks.endCleaningDone ? 'OK' : 'Offen',
      e.notes || ''
    ]
      .map((cell) => escapeCsvCell(String(cell)))
      .join(';')
  );
  return `\uFEFF${[header, ...rows].join('\r\n')}`;
}

function buildHaccpProofText(projectName: string, entries: HaccpLogEntry[]): string {
  const lines = entries.map((e) => {
    const temps = [
      e.fridgeTempC !== null && e.fridgeTempC !== undefined
        ? `Kühlung ${formatGermanTemp(e.fridgeTempC)} °C`
        : null,
      e.saladetteTempC !== null && e.saladetteTempC !== undefined
        ? `Saladette ${formatGermanTemp(e.saladetteTempC)} °C`
        : null
    ]
      .filter(Boolean)
      .join(' · ');
    const doneChecks = CHECK_ITEMS.filter((c) => e.checks[c.key]).length;
    return `• ${e.dateISO} (${e.timestamp}) – ${e.eventLabel}: ${temps || 'ohne Temp.'} · Warmwasser ${
      e.hotWaterOk ? 'OK' : 'Offen'
    } · Checks ${doneChecks}/4${e.notes ? ` · Notiz: ${e.notes}` : ''}`;
  });
  return `HACCP-Tagesnachweis (${projectName})\n${lines.join('\n')}`;
}

export const HaccpProtocolPlugin: React.FC<PluginContextProps> = ({
  project,
  onNotify
}) => {
  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [allLogs, setAllLogs] = useState<HaccpLogEntry[]>([]);
  const [eventLabel, setEventLabel] = useState(todayISO);
  const [fridgeTempInput, setFridgeTempInput] = useState('');
  const [saladetteTempInput, setSaladetteTempInput] = useState('');
  const [hotWaterOk, setHotWaterOk] = useState(false);
  const [checks, setChecks] = useState<HaccpLogEntry['checks']>({
    surfacesSanitized: false,
    handwashReady: false,
    coolingChainOk: false,
    endCleaningDone: false
  });
  const [notes, setNotes] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void loadHaccpLogsAsync().then((loaded) => {
      if (active) setAllLogs(loaded);
    });
    return () => {
      active = false;
    };
  }, []);

  const projectLogs = useMemo(
    () => allLogs.filter((entry) => entry.projectId === project.id),
    [allLogs, project.id]
  );

  const parsedFridge = parseOptionalTemp(fridgeTempInput);
  const parsedSaladette = parseOptionalTemp(saladetteTempInput);
  const isOverTargetTemp =
    (parsedFridge !== null && parsedFridge > 4) ||
    (parsedSaladette !== null && parsedSaladette > 7);

  const handleToggleCheck = (key: keyof HaccpLogEntry['checks']) => {
    setChecks((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCheckAllStandard = () => {
    setHotWaterOk(true);
    setChecks({
      surfacesSanitized: true,
      handwashReady: true,
      coolingChainOk: true,
      endCleaningDone: true
    });
    setStatusMessage('Alle Standard-Checks markiert.');
  };

  const handleSaveEntry = () => {
    const nowDateISO = new Date().toISOString().slice(0, 10);
    const newEntry: HaccpLogEntry = {
      id: `haccp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      projectId: project.id,
      dateISO: nowDateISO,
      timestamp: formatNow(),
      eventLabel: eventLabel.trim() || nowDateISO,
      fridgeTempC: parsedFridge,
      saladetteTempC: parsedSaladette,
      hotWaterOk,
      checks: { ...checks },
      ...(notes.trim() ? { notes: notes.trim() } : {})
    };
    const nextLogs = [newEntry, ...allLogs];
    setAllLogs(nextLogs);
    void saveHaccpLogs(nextLogs);
    setHistoryOpen(true);
    setNotes('');
    setStatusMessage('Tagesprotokoll in IndexedDB gesichert.');
    onNotify('HACCP-Tagesprotokoll gesichert.');
  };

  const handleDeleteEntry = (entryId: string) => {
    const nextLogs = allLogs.filter((item) => item.id !== entryId);
    setAllLogs(nextLogs);
    void saveHaccpLogs(nextLogs);
    onNotify('HACCP-Eintrag entfernt.');
  };

  const handleExportCsv = () => {
    if (projectLogs.length === 0) return;
    const csv = buildHaccpCsv(projectLogs);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `haccp-protokoll-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMessage('HACCP-CSV exportiert.');
    onNotify('HACCP-CSV heruntergeladen.');
  };

  const handleCopyProof = async () => {
    if (projectLogs.length === 0) return;
    const proofText = buildHaccpProofText(project.name, projectLogs);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(proofText);
      }
      setStatusMessage('Nachweis in Zwischenablage kopiert.');
      onNotify('HACCP-Nachweis kopiert.');
    } catch {
      setStatusMessage('Nachweis erstellt (Zwischenablage nicht verfügbar).');
    }
  };

  return (
    <div
      data-testid="haccp-protocol-plugin"
      className="p-3.5 rounded-xl border bg-[#191C22] space-y-3"
      style={{ borderColor: DESIGN_TOKENS.borderSubtle }}
    >
      {/* Kopfzeile */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <ClipboardCheck className="w-4 h-4 shrink-0 text-[#14B8A6]" />
          <h4 className="text-base font-bold text-[#F1F5F9] leading-snug break-words">
            1-Klick-HACCP-Protokoll
          </h4>
        </div>
        <span className="text-xs font-mono text-[#94A3B8] shrink-0">
          {projectLogs.length} {projectLogs.length === 1 ? 'Eintrag' : 'Einträge'}
        </span>
      </div>

      {/* Optionale Event-/Schicht-Bezeichnung */}
      <div className="space-y-1">
        <label className="text-xs text-[#94A3B8] block">Event / Schicht</label>
        <input
          type="text"
          data-testid="haccp-event-label"
          value={eventLabel}
          onChange={(e) => setEventLabel(e.target.value)}
          placeholder={todayISO}
          className="w-full min-w-0 min-h-[44px] px-3 py-2 rounded-xl text-xs bg-[#111317] text-[#F1F5F9] border border-white/10 focus:outline-none focus:border-[#14B8A6]"
        />
      </div>

      {/* Temperatur-Schnelleingabe */}
      <div className="p-3 rounded-xl bg-[#111317] border border-white/5 space-y-2.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#F1F5F9]">
          <Thermometer className="w-4 h-4 text-[#14B8A6] shrink-0" />
          <span>Temperatur-Kontrolle</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="min-w-0 space-y-1">
            <label className="text-xs text-[#94A3B8] block">
              Kühlung (°C, Soll ≤ 4 °C)
            </label>
            <input
              type="number"
              step="0.1"
              inputMode="decimal"
              data-testid="haccp-fridge-temp"
              value={fridgeTempInput}
              onChange={(e) => setFridgeTempInput(e.target.value)}
              placeholder="z. B. 3.5"
              className="w-full min-w-0 min-h-[44px] px-3 py-2 rounded-xl text-xs font-mono bg-[#191C22] text-[#F1F5F9] border border-white/10 focus:outline-none focus:border-[#14B8A6]"
            />
          </div>
          <div className="min-w-0 space-y-1">
            <label className="text-xs text-[#94A3B8] block">
              Saladette (°C, Soll ≤ 7 °C)
            </label>
            <input
              type="number"
              step="0.1"
              inputMode="decimal"
              data-testid="haccp-saladette-temp"
              value={saladetteTempInput}
              onChange={(e) => setSaladetteTempInput(e.target.value)}
              placeholder="z. B. 5.5"
              className="w-full min-w-0 min-h-[44px] px-3 py-2 rounded-xl text-xs font-mono bg-[#191C22] text-[#F1F5F9] border border-white/10 focus:outline-none focus:border-[#14B8A6]"
            />
          </div>
        </div>

        {/* Honig-Gold-Hinweis bei Überschreitung (kein Alarm-Rot!) */}
        {isOverTargetTemp && (
          <div
            data-testid="haccp-temp-warning"
            className="px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2"
            style={{
              backgroundColor: 'rgba(229,169,60,0.12)',
              borderColor: 'rgba(229,169,60,0.35)',
              color: DESIGN_TOKENS.accentHoney
            }}
          >
            <span>Temperatur prüfen – über Sollwert</span>
          </div>
        )}

        {/* 1-Tipp Warmwasser / Gas-Durchlauferhitzer OK */}
        <button
          type="button"
          data-testid="haccp-hotwater-toggle"
          onClick={() => setHotWaterOk((prev) => !prev)}
          className={`w-full min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold border flex items-center justify-between gap-2 transition active:scale-[0.99] cursor-pointer ${
            hotWaterOk
              ? 'bg-[#0D9488]/20 border-[#14B8A6]/60 text-[#F1F5F9]'
              : 'bg-[#191C22] border-white/10 text-[#94A3B8]'
          }`}
        >
          <span className="flex items-center gap-2 min-w-0 text-left break-words">
            <Flame className="w-4 h-4 shrink-0 text-[#E5A93C]" />
            <span>Warmwasser / Gas-Durchlauferhitzer OK</span>
          </span>
          <span className="shrink-0 font-mono font-bold">
            {hotWaterOk ? '✓ OK' : 'Offen'}
          </span>
        </button>
      </div>

      {/* 4 große 1-Klick-Hygiene-Häkchen */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs font-semibold text-[#94A3B8]">Hygiene-Checks</span>
          <button
            type="button"
            data-testid="haccp-check-all"
            onClick={handleCheckAllStandard}
            className="min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-bold border border-[#E5A93C]/35 bg-[#E5A93C]/15 text-[#E5A93C] flex items-center gap-1.5 active:scale-95 transition cursor-pointer"
          >
            <CheckCheck className="w-4 h-4 shrink-0" />
            <span>Alle Standard-Checks ✓</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {CHECK_ITEMS.map((item) => {
            const active = checks[item.key];
            return (
              <button
                key={item.key}
                type="button"
                data-testid={item.testId}
                onClick={() => handleToggleCheck(item.key)}
                className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold border flex items-center gap-2 text-left transition active:scale-[0.99] cursor-pointer ${
                  active
                    ? 'bg-[#0D9488]/20 border-[#14B8A6]/60 text-[#F1F5F9]'
                    : 'bg-[#111317] border-white/10 text-[#94A3B8]'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border ${
                    active
                      ? 'bg-[#14B8A6] border-[#14B8A6] text-[#111317]'
                      : 'bg-[#191C22] border-white/20 text-transparent'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                </span>
                <span className="min-w-0 break-words leading-snug">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Notiz + Sichern */}
      <input
        type="text"
        data-testid="haccp-notes-input"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Optionale Notiz (z. B. Reinigung / Maßnahme)..."
        className="w-full min-w-0 min-h-[44px] px-3 py-2 rounded-xl text-xs bg-[#111317] text-[#F1F5F9] border border-white/10 focus:outline-none focus:border-[#14B8A6]"
      />

      <button
        type="button"
        data-testid="haccp-save-btn"
        onClick={handleSaveEntry}
        className="w-full min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 shadow active:scale-[0.99] transition cursor-pointer"
        style={{ backgroundColor: THEME.accentPrimary }}
      >
        <ClipboardCheck className="w-4 h-4 shrink-0" />
        <span>Tagesprotokoll sichern</span>
      </button>

      {statusMessage && (
        <div className="text-xs font-medium text-[#E5A93C] px-1">{statusMessage}</div>
      )}

      {/* Verlauf (aufklappbar) & Nachweis-Export */}
      <div className="pt-1 border-t border-white/5 space-y-2">
        <button
          type="button"
          data-testid="haccp-history-toggle"
          aria-expanded={historyOpen}
          onClick={() => setHistoryOpen((o) => !o)}
          className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-[#111317] border border-white/10 flex items-center justify-between gap-2 text-xs font-semibold text-[#F1F5F9] cursor-pointer"
        >
          <span>Protokoll-Verlauf ({projectLogs.length})</span>
          {historyOpen ? (
            <ChevronUp className="w-4 h-4 text-[#94A3B8] shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#94A3B8] shrink-0" />
          )}
        </button>

        {projectLogs.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="haccp-export-csv"
              onClick={handleExportCsv}
              className="flex-1 min-w-[140px] min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold bg-[#22262F] hover:bg-[#2A2F3A] text-[#F1F5F9] border border-white/10 flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
            >
              <Download className="w-4 h-4 text-[#14B8A6] shrink-0" />
              <span>HACCP-CSV exportieren</span>
            </button>
            <button
              type="button"
              data-testid="haccp-copy-proof"
              onClick={handleCopyProof}
              className="flex-1 min-w-[140px] min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold bg-[#22262F] hover:bg-[#2A2F3A] text-[#F1F5F9] border border-white/10 flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
            >
              <Copy className="w-4 h-4 text-[#E5A93C] shrink-0" />
              <span>Nachweis kopieren</span>
            </button>
          </div>
        )}

        {historyOpen && (
          <div data-testid="haccp-history-list" className="space-y-2">
            {projectLogs.length === 0 ? (
              <div className="p-3 rounded-xl bg-[#111317] border border-white/5 text-xs text-[#94A3B8]">
                Noch keine Tagesprotokolle für dieses Projekt gespeichert.
              </div>
            ) : (
              projectLogs.map((entry) => {
                const doneCount = CHECK_ITEMS.filter((c) => entry.checks[c.key]).length;
                return (
                  <div
                    key={entry.id}
                    data-testid={`haccp-entry-${entry.id}`}
                    className="p-3 rounded-xl bg-[#111317] border border-white/10 flex items-start justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="text-xs font-bold text-[#F1F5F9] break-words">
                        {entry.eventLabel}
                      </div>
                      <div className="text-xs font-mono text-[#94A3B8] flex flex-wrap gap-x-2 gap-y-0.5">
                        <span>{entry.dateISO}</span>
                        <span>{entry.timestamp}</span>
                        {entry.fridgeTempC !== null && entry.fridgeTempC !== undefined && (
                          <span
                            className={
                              entry.fridgeTempC > 4 ? 'text-[#E5A93C]' : 'text-[#14B8A6]'
                            }
                          >
                            Kühlung: {formatGermanTemp(entry.fridgeTempC)} °C
                          </span>
                        )}
                        {entry.saladetteTempC !== null && entry.saladetteTempC !== undefined && (
                          <span
                            className={
                              entry.saladetteTempC > 7 ? 'text-[#E5A93C]' : 'text-[#14B8A6]'
                            }
                          >
                            Saladette: {formatGermanTemp(entry.saladetteTempC)} °C
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[#94A3B8]">
                        Warmwasser: {entry.hotWaterOk ? 'OK' : 'Offen'} · Hygiene: {doneCount}/4
                        {entry.notes ? ` · ${entry.notes}` : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label="Protokoll-Eintrag löschen"
                      onClick={() => handleDeleteEntry(entry.id)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-[#191C22] text-[#94A3B8] hover:text-[#E5A93C] border border-white/10 shrink-0 active:scale-95 transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};
