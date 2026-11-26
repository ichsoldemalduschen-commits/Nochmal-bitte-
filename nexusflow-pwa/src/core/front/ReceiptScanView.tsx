import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  FileSpreadsheet,
  Loader2,
  Receipt,
  ShoppingCart,
  Sparkles,
  Trash2
} from 'lucide-react';
import { Project } from '../../types';
import { scanReceiptImageWithGemini } from '../../services/deepResearchAndScanner';
import {
  SavedScannedReceipt,
  loadScannedReceipts,
  loadScannedReceiptsAsync,
  loadUserPrefs,
  saveScannedReceipts,
  formatNow
} from '../../services/storage';
import {
  CartReconcileMatch,
  RECEIPT_CATEGORIES,
  ReceiptPlausibilityResult,
  buildTaxAdvisorMonthlySummary,
  checkReceiptPlausibilityAndDuplicates,
  exportReceiptsToGermanCsv,
  findCartMatchesForReceipt,
  formatEuroDe,
  formatMonthLabel,
  formatTaxAdvisorSummaryText,
  toMonthKey
} from '../../services/receiptForeman';
import { triggerHapticFeedback } from '../../services/aiRouter';
import { DESIGN_TOKENS } from '../../config/designTokens';
import { ThemeColors } from './FrontHeader';
import { ZentraleSectionId } from '../BackofficeWorkspace';

interface ReceiptScanViewProps {
  activeProject: Project;
  allProjects: Project[];
  themeColors: ThemeColors;
  userApiKey?: string;
  receiptForemanEnabled?: boolean;
  onReconcileReceiptWithCart: (
    projectId: string,
    storeName: string,
    purchaseDate: string,
    totalAmount: string,
    items: Array<{ title: string; quantity: string; price: string }>
  ) => void;
  onReconcileCartItems?: (
    matches: CartReconcileMatch[],
    receipt: SavedScannedReceipt
  ) => void;
  onUpdateReceipt?: (receipt: SavedScannedReceipt) => void;
  onOpenSettings?: (section?: ZentraleSectionId) => void;
  onNotify: (msg: string) => void;
}

export const ReceiptScanView: React.FC<ReceiptScanViewProps> = ({
  activeProject,
  allProjects,
  themeColors,
  userApiKey = '',
  receiptForemanEnabled: receiptForemanEnabledProp,
  onReconcileReceiptWithCart,
  onReconcileCartItems,
  onUpdateReceipt,
  onOpenSettings,
  onNotify
}) => {
  const [receipts, setReceipts] = useState<SavedScannedReceipt[]>(() => loadScannedReceipts());
  const [selectedProjectId, setSelectedProjectId] = useState<string>(activeProject.id);
  const [isScanning, setIsScanning] = useState(false);
  const [expandedReceiptIds, setExpandedReceiptIds] = useState<Record<string, boolean>>({});
  const [prefsForemanEnabled, setPrefsForemanEnabled] = useState<boolean>(
    () => loadUserPrefs().receiptForemanEnabled !== false
  );

  // Vorarbeiter-State
  const [pendingReview, setPendingReview] = useState<{
    receipt: SavedScannedReceipt;
    check: ReceiptPlausibilityResult;
  } | null>(null);
  const [taxPackageOpen, setTaxPackageOpen] = useState(true);
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [selectedMatchIds, setSelectedMatchIds] = useState<Record<string, boolean>>({});
  const [preferredReconcileReceiptId, setPreferredReconcileReceiptId] = useState<string | null>(null);

  const foremanEnabled =
    typeof receiptForemanEnabledProp === 'boolean'
      ? receiptForemanEnabledProp
      : prefsForemanEnabled;

  useEffect(() => {
    setSelectedProjectId(activeProject.id);
  }, [activeProject.id]);

  useEffect(() => {
    let cancelled = false;
    void loadScannedReceiptsAsync().then((loaded) => {
      if (!cancelled) {
        setReceipts(loaded);
      }
    });
    const onPrefsUpdated = (ev: Event) => {
      const detail = (ev as CustomEvent)?.detail;
      if (detail && typeof detail.receiptForemanEnabled === 'boolean') {
        setPrefsForemanEnabled(detail.receiptForemanEnabled);
      }
    };
    window.addEventListener('banditos:prefs-updated', onPrefsUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener('banditos:prefs-updated', onPrefsUpdated);
    };
  }, []);

  const activeProjects = useMemo(() => allProjects.filter((p) => !p.archived), [allProjects]);

  const plausibilityById = useMemo(() => {
    const map = new Map<string, ReceiptPlausibilityResult>();
    for (const r of receipts) {
      map.set(r.id, checkReceiptPlausibilityAndDuplicates(r, receipts));
    }
    return map;
  }, [receipts]);

  const flaggedReceipts = useMemo(
    () =>
      receipts.filter((r) => {
        const res = plausibilityById.get(r.id);
        return Boolean(res && (res.isDuplicate || res.warnings.length > 0));
      }),
    [receipts, plausibilityById]
  );

  const taxSummary = useMemo(
    () => buildTaxAdvisorMonthlySummary(receipts, allProjects, monthFilter, projectFilter),
    [receipts, allProjects, monthFilter, projectFilter]
  );

  const reconcileCandidates = useMemo(() => {
    if (!foremanEnabled) return [];
    const list: Array<{ receipt: SavedScannedReceipt; matches: CartReconcileMatch[] }> = [];
    for (const r of receipts) {
      if (r.reconciledAt || r.reconciled) continue;
      const matches = findCartMatchesForReceipt(r, allProjects, r.projectId || activeProject.id);
      if (matches.length > 0) {
        list.push({ receipt: r, matches });
      }
    }
    return list;
  }, [foremanEnabled, receipts, allProjects, activeProject.id]);

  const activeReconcileCandidate = useMemo(() => {
    if (reconcileCandidates.length === 0) return null;
    if (preferredReconcileReceiptId) {
      const found = reconcileCandidates.find((c) => c.receipt.id === preferredReconcileReceiptId);
      if (found) return found;
    }
    return reconcileCandidates[0];
  }, [reconcileCandidates, preferredReconcileReceiptId]);

  useEffect(() => {
    if (!activeReconcileCandidate) {
      setSelectedMatchIds({});
      return;
    }
    const next: Record<string, boolean> = {};
    for (const m of activeReconcileCandidate.matches) {
      next[m.cartItemId] = true;
    }
    setSelectedMatchIds(next);
  }, [activeReconcileCandidate?.receipt.id, activeReconcileCandidate?.matches.length]);

  const toggleExpand = (id: string) => {
    triggerHapticFeedback(10);
    setExpandedReceiptIds((prev) => ({ ...prev, [id]: !prev[id] }));
    setPreferredReconcileReceiptId(id);
  };

  const persistReceipts = (updated: SavedScannedReceipt[]) => {
    setReceipts(updated);
    saveScannedReceipts(updated);
  };

  const commitReceipt = (receiptToSave: SavedScannedReceipt, runLegacyAutoReconcile: boolean) => {
    const updated = [receiptToSave, ...receipts];
    persistReceipts(updated);
    setExpandedReceiptIds((prev) => ({ ...prev, [receiptToSave.id]: true }));
    setPreferredReconcileReceiptId(receiptToSave.id);

    const monthKey = toMonthKey(receiptToSave.purchaseDate);
    if (monthKey && monthFilter !== 'all' && monthKey !== monthFilter) {
      setMonthFilter('all');
    }

    if (runLegacyAutoReconcile) {
      onReconcileReceiptWithCart(
        receiptToSave.projectId || activeProject.id,
        receiptToSave.storeName,
        receiptToSave.purchaseDate,
        receiptToSave.totalAmount,
        receiptToSave.items
      );
      onNotify(`Beleg "${receiptToSave.storeName}" erfasst & abgeglichen!`);
    } else {
      onNotify(`Beleg "${receiptToSave.storeName}" gespeichert.`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const targetProj = allProjects.find((p) => p.id === selectedProjectId) || activeProject;
    setIsScanning(true);
    triggerHapticFeedback(15);

    try {
      const scan = await scanReceiptImageWithGemini(file, userApiKey);
      setIsScanning(false);
      e.target.value = '';

      if (!scan.ok || !scan.result) {
        onNotify(scan.error || 'Beleg konnte nicht gelesen werden.');
        return;
      }

      const res = scan.result;
      const candidateBase: SavedScannedReceipt = {
        id: `rcpt-${Date.now()}`,
        projectId: targetProj.id,
        projectName: targetProj.name,
        storeName: res.storeName || '',
        purchaseDate: res.purchaseDate || new Date().toLocaleDateString('de-DE'),
        totalAmount: res.totalAmount || '0,00',
        items: (res.items || []).map((it) => ({
          title: it.title,
          quantity: it.quantity || '1x',
          price: it.price || ''
        })),
        createdAt: formatNow(),
        reconciled: false,
        ...(typeof res.netAmount === 'number' ? { netAmount: res.netAmount } : {}),
        ...(typeof res.vatAmount === 'number' ? { vatAmount: res.vatAmount } : {}),
        ...(typeof res.vatRate === 'number' ? { vatRate: res.vatRate } : {}),
        ...(res.category ? { category: res.category } : {})
      };

      const check = checkReceiptPlausibilityAndDuplicates(candidateBase, receipts);
      const enrichedCandidate: SavedScannedReceipt = {
        ...candidateBase,
        vatRate: candidateBase.vatRate ?? check.vatRate,
        netAmount: candidateBase.netAmount ?? check.netAmount,
        vatAmount: candidateBase.vatAmount ?? check.vatAmount,
        category: candidateBase.category || check.suggestedCategory
      };

      if (foremanEnabled && (check.isDuplicate || check.warnings.length > 0)) {
        setPendingReview({ receipt: enrichedCandidate, check });
        onNotify('Vorarbeiter bittet um kurze Beleg-Prüfung.');
        return;
      }

      commitReceipt(enrichedCandidate, !foremanEnabled);
    } catch (err: any) {
      setIsScanning(false);
      onNotify(`Fehler beim Beleg-Scan: ${err?.message || 'Unbekannt'}`);
    }
  };

  const handleConfirmPendingReview = () => {
    if (!pendingReview) return;
    triggerHapticFeedback(15);
    const toSave = pendingReview.receipt;
    setPendingReview(null);
    commitReceipt(toSave, false);
  };

  const handleDiscardPendingReview = () => {
    triggerHapticFeedback(10);
    setPendingReview(null);
    onNotify('Beleg-Entwurf verworfen.');
  };

  const handleUpdateSavedReceipt = (receiptId: string, patch: Partial<SavedScannedReceipt>) => {
    const updated = receipts.map((r) => {
      if (r.id !== receiptId) return r;
      const merged: SavedScannedReceipt = { ...r, ...patch };
      if (patch.vatRate !== undefined) {
        const recalc = checkReceiptPlausibilityAndDuplicates(
          { ...merged, netAmount: undefined, vatAmount: undefined },
          []
        );
        merged.netAmount = recalc.netAmount;
        merged.vatAmount = recalc.vatAmount;
      }
      onUpdateReceipt?.(merged);
      return merged;
    });
    persistReceipts(updated);
  };

  const handleDeleteReceipt = (receiptId: string) => {
    triggerHapticFeedback(15);
    const updated = receipts.filter((r) => r.id !== receiptId);
    persistReceipts(updated);
    onNotify('Beleg entfernt.');
  };

  const handleReconcileAgain = (receipt: SavedScannedReceipt) => {
    triggerHapticFeedback(20);
    onReconcileReceiptWithCart(
      receipt.projectId || activeProject.id,
      receipt.storeName,
      receipt.purchaseDate,
      receipt.totalAmount,
      receipt.items
    );
    const nowIso = new Date().toISOString();
    const updated = receipts.map((r) =>
      r.id === receipt.id
        ? { ...r, reconciled: true, reconciledAt: nowIso }
        : r
    );
    persistReceipts(updated);
    onNotify(`Beleg mit "${receipt.projectName || activeProject.name}" abgeglichen.`);
  };

  const handleExecuteForemanReconcile = () => {
    if (!activeReconcileCandidate) return;
    const chosen = activeReconcileCandidate.matches.filter(
      (m) => selectedMatchIds[m.cartItemId] !== false
    );
    if (chosen.length === 0) {
      onNotify('Bitte mindestens einen Artikel auswählen.');
      return;
    }

    triggerHapticFeedback(20);
    const targetReceipt = activeReconcileCandidate.receipt;

    if (onReconcileCartItems) {
      onReconcileCartItems(chosen, targetReceipt);
    } else {
      const byProject = new Map<string, CartReconcileMatch[]>();
      for (const m of chosen) {
        const list = byProject.get(m.projectId) || [];
        list.push(m);
        byProject.set(m.projectId, list);
      }
      for (const [projId, list] of byProject.entries()) {
        onReconcileReceiptWithCart(
          projId,
          targetReceipt.storeName,
          targetReceipt.purchaseDate,
          targetReceipt.totalAmount,
          list.map((m) => ({
            title: m.cartTitle,
            quantity: '1x',
            price: m.receiptPrice || ''
          }))
        );
      }
    }

    const nowIso = new Date().toISOString();
    const updated = receipts.map((r) => {
      if (r.id !== targetReceipt.id) return r;
      const nextReceipt: SavedScannedReceipt = {
        ...r,
        reconciled: true,
        reconciledAt: nowIso,
        reconciledCount: chosen.length
      };
      onUpdateReceipt?.(nextReceipt);
      return nextReceipt;
    });
    persistReceipts(updated);
  };

  const handleDownloadCsv = () => {
    triggerHapticFeedback(14);
    const csvContent = exportReceiptsToGermanCsv(receipts, allProjects, monthFilter, projectFilter);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const suffix = monthFilter === 'all' ? 'alle' : monthFilter;
    link.download = `banditos-belege-${suffix}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    onNotify(`CSV-Monatspaket (${taxSummary.count} Belege) geladen.`);
  };

  const handleCopySummary = async () => {
    triggerHapticFeedback(12);
    const summaryText = formatTaxAdvisorSummaryText(
      receipts,
      allProjects,
      monthFilter,
      projectFilter
    );
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(summaryText);
      }
      setCopiedSummary(true);
      window.setTimeout(() => setCopiedSummary(false), 2200);
      onNotify('Steuerberater-Übersicht kopiert.');
    } catch {
      onNotify('Zwischenablage nicht verfügbar – CSV-Export nutzen.');
    }
  };

  const selectedReconcileCount = activeReconcileCandidate
    ? activeReconcileCandidate.matches.filter((m) => selectedMatchIds[m.cartItemId] !== false).length
    : 0;

  return (
    <section className="space-y-4">
      {/* Sektions-Kopfzeile */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2.5 min-w-0">
          <Receipt className="w-5 h-5 shrink-0" style={{ color: themeColors.highlight }} />
          <div className="min-w-0">
            <h3 className="text-base font-bold text-[#F1F5F9] tracking-wide">
              Beleg-Scan
            </h3>
            <p className="text-xs text-[#94A3B8]">
              Kassenbons, Baumarkt- &amp; Großhandel-Belege
            </p>
          </div>
        </div>
        <span className="text-xs font-semibold text-[#94A3B8] px-2.5 py-1 rounded-full bg-[#191C22] border border-white/5 font-mono shrink-0">
          {receipts.length} erfasst
        </span>
      </div>

      {/* VORARBEITER 3: STEUERBERATER-MONATSPAKET */}
      {foremanEnabled && (
        <div
          data-testid="tax-advisor-package-card"
          className="rounded-3xl border overflow-hidden shadow-md"
          style={{
            backgroundColor: DESIGN_TOKENS.surface,
            borderColor: DESIGN_TOKENS.borderSubtle
          }}
        >
          <button
            type="button"
            aria-expanded={taxPackageOpen}
            onClick={() => {
              triggerHapticFeedback(10);
              setTaxPackageOpen((o) => !o);
            }}
            className="w-full min-h-[52px] px-4 py-3 flex items-center justify-between gap-2 text-left active:bg-white/5 transition cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <FileSpreadsheet className="w-5 h-5 text-[#14B8A6] shrink-0" />
              <div className="min-w-0">
                <div className="text-base font-bold text-[#F1F5F9] break-words">
                  Steuerberater-Monatspaket
                </div>
                <div className="text-xs text-[#94A3B8]">
                  DATEV-/Excel-CSV, Monatsfilter &amp; Netto/MwSt-Übersicht
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-mono text-[#14B8A6]">
                {formatEuroDe(taxSummary.totalGross)} €
              </span>
              {taxPackageOpen ? (
                <ChevronUp className="w-4 h-4 text-[#94A3B8]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[#94A3B8]" />
              )}
            </div>
          </button>

          {taxPackageOpen && (
            <div className="px-4 pb-4 pt-2 border-t border-white/5 space-y-3 bg-[#111317]/40">
              {/* Filterzeile */}
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  aria-label="Monat filtern"
                  data-testid="select-tax-month"
                  value={monthFilter}
                  onChange={(e) => setMonthFilter(e.target.value)}
                  className="min-h-[44px] min-w-0 flex-1 px-3 py-2 rounded-xl text-xs font-bold bg-[#111317] text-[#F1F5F9] border border-white/10 focus:outline-none focus:border-[#14B8A6] cursor-pointer"
                >
                  <option value="all">Alle Monate</option>
                  {taxSummary.availableMonths.map((mk) => (
                    <option key={mk} value={mk}>
                      {formatMonthLabel(mk)}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Projekt filtern"
                  data-testid="select-tax-project"
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                  className="min-h-[44px] min-w-0 flex-1 px-3 py-2 rounded-xl text-xs font-bold bg-[#111317] text-[#F1F5F9] border border-white/10 focus:outline-none focus:border-[#14B8A6] cursor-pointer"
                >
                  <option value="all">Alle Projekte</option>
                  {activeProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* JetBrains Mono Kennzahlen */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-2xl bg-[#191C22] border border-white/5 min-w-0">
                  <div className="text-xs text-[#94A3B8]">Belege</div>
                  <div
                    data-testid="tax-summary-count"
                    className="text-sm font-mono font-bold text-[#F1F5F9]"
                  >
                    {taxSummary.count}
                  </div>
                </div>
                <div className="p-2.5 rounded-2xl bg-[#191C22] border border-white/5 min-w-0">
                  <div className="text-xs text-[#94A3B8]">Netto</div>
                  <div
                    data-testid="tax-summary-net"
                    className="text-sm font-mono font-bold text-[#F1F5F9]"
                  >
                    {formatEuroDe(taxSummary.totalNet)} €
                  </div>
                </div>
                <div className="p-2.5 rounded-2xl bg-[#191C22] border border-white/5 min-w-0">
                  <div className="text-xs text-[#94A3B8]">MwSt</div>
                  <div
                    data-testid="tax-summary-vat"
                    className="text-sm font-mono font-bold text-[#94A3B8]"
                  >
                    {formatEuroDe(taxSummary.totalVat)} €
                  </div>
                </div>
                <div className="p-2.5 rounded-2xl bg-[#191C22] border border-white/5 min-w-0">
                  <div className="text-xs text-[#94A3B8]">Brutto</div>
                  <div
                    data-testid="tax-summary-gross"
                    className="text-sm font-mono font-bold text-[#14B8A6]"
                  >
                    {formatEuroDe(taxSummary.totalGross)} €
                  </div>
                </div>
              </div>

              {/* Export & Kopieren Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  data-testid="btn-download-tax-csv"
                  onClick={handleDownloadCsv}
                  className="flex-1 min-w-0 min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 active:scale-95 transition shadow-sm cursor-pointer"
                  style={{ backgroundColor: themeColors.primary }}
                >
                  <Download className="w-4 h-4 shrink-0" />
                  <span>CSV-Monatspaket laden</span>
                </button>

                <button
                  type="button"
                  data-testid="btn-copy-tax-summary"
                  onClick={handleCopySummary}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold text-[#F1F5F9] bg-[#191C22] hover:bg-[#22262F] border border-white/10 flex items-center justify-center gap-2 active:scale-95 transition cursor-pointer"
                >
                  {copiedSummary ? (
                    <Check className="w-4 h-4 text-[#14B8A6] shrink-0" />
                  ) : (
                    <Copy className="w-4 h-4 text-[#94A3B8] shrink-0" />
                  )}
                  <span>{copiedSummary ? 'Kopiert ✓' : 'Übersicht kopieren'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* HONIG-GOLD-HINWEIS BEI FEHLENDEM GEMINI-KEY */}
      {!userApiKey?.trim() && (
        <div
          role="alert"
          className="p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs"
          style={{
            backgroundColor: '#191C22',
            borderColor: 'rgba(229,169,60,0.35)'
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <Sparkles className="w-4 h-4 text-[#E5A93C] shrink-0" />
            <span className="text-[#F1F5F9]">
              Kein aktiver Gemini API-Key hinterlegt. Zum automatischen Scannen bitte eintragen.
            </span>
          </div>
          <button
            type="button"
            onClick={() => onOpenSettings?.('ai')}
            className="min-h-[44px] px-3.5 rounded-xl font-bold text-[#111317] shrink-0 active:scale-95 transition cursor-pointer flex items-center justify-center shadow-sm"
            style={{ backgroundColor: '#E5A93C' }}
          >
            Zentrale (KI)
          </button>
        </div>
      )}

      {/* KOMPAKTER AUSLÖSE-BEREICH ZUM FOTOGRAFIEREN / HOCHLADEN */}
      <div
        className="p-4 rounded-3xl border space-y-3.5 shadow-md"
        style={{
          backgroundColor: '#191C22',
          borderColor: 'rgba(255,255,255,0.04)'
        }}
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <label className="text-xs font-semibold text-[#94A3B8]">Ziel-Projekt für Abrechnung:</label>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-bold bg-[#111317] text-[#F1F5F9] border border-white/10 focus:outline-none focus:border-white/20 cursor-pointer"
          >
            {activeProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <label
          className={`w-full min-h-[52px] px-4 py-3 rounded-2xl border border-dashed flex items-center justify-center gap-2.5 text-xs font-bold transition active:scale-98 cursor-pointer shadow-sm ${
            isScanning
              ? 'bg-[#111317] text-[#94A3B8] border-white/20 cursor-not-allowed'
              : 'bg-[#14B8A6]/10 hover:bg-[#14B8A6]/15 text-[#14B8A6] border-[#14B8A6]/40'
          }`}
        >
          {isScanning ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin text-[#14B8A6] shrink-0" />
              <span>Beleg wird durch KI analysiert &amp; Positionen erkannt...</span>
            </>
          ) : (
            <>
              <Camera className="w-5 h-5 shrink-0" />
              <span>Beleg fotografieren, Bild oder PDF hochladen</span>
            </>
          )}
          <input
            type="file"
            accept="image/*,application/pdf"
            disabled={isScanning}
            className="hidden"
            onChange={handleFileUpload}
          />
        </label>
      </div>

      {/* VORARBEITER 1A: AKTUELLER SCAN DUBLETTEN- & PLAUSIBILITÄTS-CHECK */}
      {foremanEnabled && pendingReview && (
        <div
          role="alert"
          data-testid="receipt-pending-review"
          className="p-4 rounded-3xl border space-y-3 shadow-md"
          style={{
            backgroundColor: '#191C22',
            borderColor: 'rgba(229,169,60,0.45)'
          }}
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-[#E5A93C] shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="text-base font-bold text-[#F1F5F9]">
                Vorarbeiter: Bitte kurz gegenprüfen
              </div>
              {pendingReview.check.isDuplicate && pendingReview.check.duplicateSummary && (
                <div className="text-xs font-medium text-[#E5A93C]">
                  {pendingReview.check.duplicateSummary}
                </div>
              )}
              {pendingReview.check.warnings.map((w, idx) => (
                <div key={idx} className="text-xs text-[#E5A93C]">
                  • {w}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              aria-label="Projekt zuordnen"
              value={pendingReview.receipt.projectId}
              onChange={(e) => {
                const proj = activeProjects.find((p) => p.id === e.target.value);
                setPendingReview((prev) =>
                  prev
                    ? {
                        ...prev,
                        receipt: {
                          ...prev.receipt,
                          projectId: e.target.value,
                          projectName: proj?.name || prev.receipt.projectName
                        }
                      }
                    : null
                );
              }}
              className="min-h-[44px] min-w-0 flex-1 px-3 py-2 rounded-xl text-xs font-bold bg-[#111317] text-[#F1F5F9] border border-white/10"
            >
              {activeProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Kategorie wählen"
              value={pendingReview.receipt.category || pendingReview.check.suggestedCategory}
              onChange={(e) =>
                setPendingReview((prev) =>
                  prev
                    ? { ...prev, receipt: { ...prev.receipt, category: e.target.value } }
                    : null
                )
              }
              className="min-h-[44px] min-w-0 flex-1 px-3 py-2 rounded-xl text-xs font-bold bg-[#111317] text-[#F1F5F9] border border-white/10"
            >
              {RECEIPT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <select
              aria-label="MwSt-Satz wählen"
              value={String(pendingReview.receipt.vatRate ?? pendingReview.check.vatRate)}
              onChange={(e) => {
                const nextRate = Number(e.target.value);
                setPendingReview((prev) => {
                  if (!prev) return null;
                  const recalc = checkReceiptPlausibilityAndDuplicates(
                    { ...prev.receipt, vatRate: nextRate, netAmount: undefined, vatAmount: undefined },
                    receipts
                  );
                  return {
                    receipt: {
                      ...prev.receipt,
                      vatRate: nextRate,
                      netAmount: recalc.netAmount,
                      vatAmount: recalc.vatAmount
                    },
                    check: recalc
                  };
                });
              }}
              className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-mono font-bold bg-[#111317] text-[#F1F5F9] border border-white/10"
            >
              <option value="19">19 % MwSt</option>
              <option value="7">7 % MwSt</option>
              <option value="0">0 % MwSt</option>
            </select>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleConfirmPendingReview}
              className="flex-1 min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold text-[#111317] active:scale-95 transition cursor-pointer"
              style={{ backgroundColor: '#E5A93C' }}
            >
              Trotzdem sichern
            </button>
            <button
              type="button"
              onClick={handleDiscardPendingReview}
              className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold text-[#94A3B8] hover:text-[#F1F5F9] bg-[#111317] border border-white/10 active:scale-95 transition cursor-pointer"
            >
              Verwerfen
            </button>
          </div>
        </div>
      )}

      {/* VORARBEITER 1B: DUBLETTEN- & PLAUSIBILITÄTS-HINWEIS FÜR GESPEICHERTE BELEGE */}
      {foremanEnabled && flaggedReceipts.length > 0 && (
        <div
          role="status"
          data-testid="receipt-duplicate-banner"
          className="p-3.5 rounded-2xl border space-y-2"
          style={{
            backgroundColor: '#191C22',
            borderColor: 'rgba(229,169,60,0.4)'
          }}
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-[#E5A93C] shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="text-xs font-bold text-[#E5A93C]">
                Vorarbeiter: {flaggedReceipts.length}{' '}
                {flaggedReceipts.length === 1 ? 'Beleg mit Hinweis' : 'Belege mit Hinweisen'}
              </div>
              {flaggedReceipts.slice(0, 2).map((fr) => {
                const res = plausibilityById.get(fr.id);
                if (!res) return null;
                return (
                  <div key={fr.id} className="text-xs text-[#F1F5F9] leading-snug">
                    {res.isDuplicate && res.duplicateSummary
                      ? res.duplicateSummary
                      : `${fr.storeName || 'Beleg'}: ${res.warnings[0] || 'Prüfen'}`}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* VORARBEITER 2: 1-TIPP-EINKAUFSWAGEN-ABGLEICH */}
      {foremanEnabled && activeReconcileCandidate && (
        <div
          data-testid="foreman-cart-reconcile-card"
          className="p-4 rounded-3xl border space-y-3 shadow-md"
          style={{
            backgroundColor: '#191C22',
            borderColor: 'rgba(20,184,166,0.3)'
          }}
        >
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              <ShoppingCart className="w-5 h-5 text-[#14B8A6] shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-base font-bold text-[#F1F5F9] break-words">
                  Vorarbeiter: {activeReconcileCandidate.matches.length} offene Artikel im Einkaufswagen gefunden
                </div>
                <div className="text-xs text-[#94A3B8] font-mono mt-0.5">
                  Beleg: {activeReconcileCandidate.receipt.storeName || 'Händler'} ·{' '}
                  {activeReconcileCandidate.receipt.purchaseDate}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {activeReconcileCandidate.matches.map((match) => {
              const checked = selectedMatchIds[match.cartItemId] !== false;
              return (
                <button
                  key={match.cartItemId}
                  type="button"
                  onClick={() => {
                    triggerHapticFeedback(10);
                    setSelectedMatchIds((prev) => ({
                      ...prev,
                      [match.cartItemId]: !(prev[match.cartItemId] !== false)
                    }));
                  }}
                  className="w-full min-h-[44px] p-2.5 pl-3.5 rounded-2xl border relative overflow-hidden flex items-center justify-between gap-3 text-left transition active:scale-[0.99] cursor-pointer"
                  style={{
                    backgroundColor: '#111317',
                    borderColor: checked ? 'rgba(20,184,166,0.45)' : 'rgba(255,255,255,0.06)'
                  }}
                >
                  <div
                    className="absolute left-0 top-0 bottom-0 w-[3px]"
                    style={{ backgroundColor: match.projectColor }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="text-xs font-bold text-[#F1F5F9] break-words">
                      {match.cartTitle}
                    </div>
                    <div className="text-xs text-[#94A3B8] flex items-center gap-1.5 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded bg-white/5 text-[#F1F5F9]">
                        {match.projectName}
                      </span>
                      <span className="break-words">← {match.receiptItemLabel}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {match.receiptPrice && (
                      <span className="text-xs font-mono text-[#14B8A6]">
                        {match.receiptPrice} €
                      </span>
                    )}
                    <span
                      className="w-6 h-6 rounded-lg border flex items-center justify-center"
                      style={{
                        backgroundColor: checked ? '#0D9488' : '#191C22',
                        borderColor: checked ? '#14B8A6' : 'rgba(255,255,255,0.15)'
                      }}
                    >
                      {checked && <Check className="w-3.5 h-3.5 text-white" />}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            data-testid="btn-reconcile-selected-cart"
            onClick={handleExecuteForemanReconcile}
            disabled={selectedReconcileCount === 0}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 active:scale-95 transition shadow-sm cursor-pointer disabled:opacity-40"
            style={{ backgroundColor: themeColors.primary }}
          >
            <Check className="w-4 h-4 shrink-0" />
            <span>Ausgewählte abhaken ✓ ({selectedReconcileCount})</span>
          </button>
        </div>
      )}

      {/* LISTE DER ERFASSTEN BELEGE ALS FLACHE KARTEN */}
      {receipts.length === 0 ? (
        <div
          className="p-8 rounded-3xl border text-center space-y-2 shadow-sm"
          style={{
            backgroundColor: '#191C22',
            borderColor: 'rgba(255,255,255,0.04)'
          }}
        >
          <Receipt className="w-8 h-8 text-[#94A3B8] mx-auto opacity-50" />
          <div className="text-base font-bold text-[#F1F5F9]">Noch keine Belege erfasst</div>
          <p className="text-xs text-[#94A3B8] max-w-xs mx-auto">
            Fotografiere Kassenbons von Baumarkt, Großhandel oder Supermarkt. Die Positionen werden
            automatisch extrahiert und mit deinem Einkaufswagen abgeglichen.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {receipts.map((rcpt) => {
            const isExpanded = !!expandedReceiptIds[rcpt.id];
            const targetProj = allProjects.find((p) => p.id === rcpt.projectId) || activeProject;
            const projColor =
              (targetProj?.customMeta?.customAccentColor as string) ||
              targetProj?.accentColor ||
              themeColors.primary;
            const check = plausibilityById.get(rcpt.id);
            const hasWarning = foremanEnabled && Boolean(check && (check.isDuplicate || check.warnings.length > 0));

            return (
              <div
                key={rcpt.id}
                data-testid={`receipt-card-${rcpt.id}`}
                className="rounded-2xl border relative overflow-hidden transition-all shadow-sm"
                style={{
                  backgroundColor: '#191C22',
                  borderColor: hasWarning
                    ? 'rgba(229,169,60,0.35)'
                    : isExpanded
                      ? 'rgba(255,255,255,0.1)'
                      : 'rgba(255,255,255,0.04)'
                }}
              >
                {/* 3-px Projektfarbstreifen links */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-[3px]"
                  style={{ backgroundColor: projColor }}
                  aria-hidden="true"
                />

                {/* Ziffern & Titel-Zeile (In-Place Aufklappen) */}
                <button
                  type="button"
                  onClick={() => toggleExpand(rcpt.id)}
                  className="w-full min-h-[52px] p-3.5 pl-4 flex items-center justify-between gap-3 text-left active:bg-white/5 transition cursor-pointer"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-bold text-[#F1F5F9] break-words">
                        {rcpt.storeName || 'Ohne Händler'}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-md bg-white/5 text-[#94A3B8] font-medium">
                        {targetProj?.name || rcpt.projectName || 'Ohne Projekt'}
                      </span>
                      {hasWarning && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-md font-bold"
                          style={{
                            backgroundColor: 'rgba(229,169,60,0.16)',
                            color: '#E5A93C'
                          }}
                        >
                          {check?.isDuplicate ? 'Dubletten-Hinweis' : 'Prüfen'}
                        </span>
                      )}
                      {foremanEnabled && (rcpt.reconciledAt || rcpt.reconciled) && (
                        <span className="text-xs px-2 py-0.5 rounded-md bg-[#14B8A6]/15 text-[#14B8A6] font-medium">
                          Abgeglichen ✓
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#94A3B8] font-mono mt-0.5">
                      {rcpt.purchaseDate || 'ohne Datum'} • {rcpt.items.length} Positionen
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="font-mono text-sm font-bold text-[#14B8A6]">
                      {check ? formatEuroDe(check.grossAmount) : rcpt.totalAmount} €
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-[#94A3B8]" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#94A3B8]" />
                    )}
                  </div>
                </button>

                {/* AUFGEKLAPPTE BELEG-DETAILS & POSITIONEN */}
                {isExpanded && (
                  <div className="px-3.5 pb-3.5 pt-2 border-t border-white/5 space-y-3 bg-[#111317]/60">
                    {hasWarning && check && (
                      <div
                        className="p-2.5 rounded-xl border text-xs space-y-1"
                        style={{
                          backgroundColor: '#191C22',
                          borderColor: 'rgba(229,169,60,0.35)',
                          color: '#E5A93C'
                        }}
                      >
                        {check.isDuplicate && check.duplicateSummary && (
                          <div>{check.duplicateSummary}</div>
                        )}
                        {check.warnings.map((w, idx) => (
                          <div key={idx}>• {w}</div>
                        ))}
                      </div>
                    )}

                    {foremanEnabled && check && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <select
                            aria-label="Beleg-Projekt ändern"
                            value={rcpt.projectId}
                            onChange={(e) => {
                              const nextProj = activeProjects.find((p) => p.id === e.target.value);
                              handleUpdateSavedReceipt(rcpt.id, {
                                projectId: e.target.value,
                                projectName: nextProj?.name || rcpt.projectName
                              });
                            }}
                            className="min-h-[44px] min-w-0 flex-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#191C22] text-[#F1F5F9] border border-white/10"
                          >
                            {activeProjects.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>

                          <select
                            aria-label="Beleg-Kategorie ändern"
                            value={rcpt.category || check.suggestedCategory}
                            onChange={(e) =>
                              handleUpdateSavedReceipt(rcpt.id, { category: e.target.value })
                            }
                            className="min-h-[44px] min-w-0 flex-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#191C22] text-[#F1F5F9] border border-white/10"
                          >
                            {RECEIPT_CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>

                          <select
                            aria-label="Beleg-MwSt ändern"
                            value={String(rcpt.vatRate ?? check.vatRate)}
                            onChange={(e) =>
                              handleUpdateSavedReceipt(rcpt.id, { vatRate: Number(e.target.value) })
                            }
                            className="min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-[#191C22] text-[#F1F5F9] border border-white/10"
                          >
                            <option value="19">19 %</option>
                            <option value="7">7 %</option>
                            <option value="0">0 %</option>
                          </select>
                        </div>

                        <div className="text-xs font-mono text-[#94A3B8] px-0.5 flex items-center gap-2 flex-wrap">
                          <span>Netto {formatEuroDe(check.netAmount)} €</span>
                          <span>·</span>
                          <span>
                            MwSt ({check.vatRate}%) {formatEuroDe(check.vatAmount)} €
                          </span>
                          {check.taxIsEstimated && <span>(berechnet)</span>}
                        </div>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <div className="text-xs font-semibold text-[#94A3B8] px-0.5">
                        Erkannte Positionen:
                      </div>
                      <div className="space-y-1 rounded-xl bg-[#191C22] p-2 border border-white/5">
                        {rcpt.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between gap-2 text-xs py-1 px-1.5 rounded hover:bg-white/5 border-b border-white/5 last:border-b-0"
                          >
                            <span className="text-[#F1F5F9] break-words flex-1 min-w-0">
                              {item.title}
                            </span>
                            <span className="font-mono text-[#94A3B8] shrink-0">
                              {item.quantity}
                            </span>
                            {item.price && (
                              <span className="font-mono text-[#14B8A6] font-semibold shrink-0">
                                {item.price} €
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Aktionen für den Beleg */}
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      <button
                        type="button"
                        onClick={() => handleReconcileAgain(rcpt)}
                        className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 active:scale-95 transition shadow-sm cursor-pointer"
                        style={{ backgroundColor: themeColors.primary }}
                      >
                        <ShoppingCart className="w-4 h-4 shrink-0" />
                        <span>Mit Einkaufswagen abgleichen</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteReceipt(rcpt.id)}
                        className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold text-[#94A3B8] hover:text-[#F1F5F9] bg-[#191C22] border border-white/10 flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
                        title="Beleg löschen"
                      >
                        <Trash2 className="w-4 h-4 shrink-0" />
                        <span>Löschen</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
