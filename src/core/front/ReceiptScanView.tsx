import React, { useEffect, useState } from 'react';
import {
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Plus,
  Receipt,
  ShoppingCart,
  Sparkles,
  Trash2,
  Upload
} from 'lucide-react';
import { Project } from '../../types';
import { scanReceiptImageWithGemini } from '../../services/deepResearchAndScanner';
import {
  SavedScannedReceipt,
  loadScannedReceipts,
  saveScannedReceipts,
  formatNow
} from '../../services/storage';
import { triggerHapticFeedback } from '../../services/aiRouter';
import { ThemeColors } from './FrontHeader';
import { ZentraleSectionId } from '../BackofficeWorkspace';

interface ReceiptScanViewProps {
  activeProject: Project;
  allProjects: Project[];
  themeColors: ThemeColors;
  userApiKey?: string;
  onReconcileReceiptWithCart: (
    projectId: string,
    storeName: string,
    purchaseDate: string,
    totalAmount: string,
    items: Array<{ title: string; quantity: string; price: string }>
  ) => void;
  onOpenSettings?: (section?: ZentraleSectionId) => void;
  onNotify: (msg: string) => void;
}

export const ReceiptScanView: React.FC<ReceiptScanViewProps> = ({
  activeProject,
  allProjects,
  themeColors,
  userApiKey = '',
  onReconcileReceiptWithCart,
  onOpenSettings,
  onNotify
}) => {
  const [receipts, setReceipts] = useState<SavedScannedReceipt[]>(() => loadScannedReceipts());
  const [selectedProjectId, setSelectedProjectId] = useState<string>(activeProject.id);
  const [isScanning, setIsScanning] = useState(false);
  const [expandedReceiptIds, setExpandedReceiptIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setSelectedProjectId(activeProject.id);
  }, [activeProject.id]);

  const toggleExpand = (id: string) => {
    triggerHapticFeedback(10);
    setExpandedReceiptIds((prev) => ({ ...prev, [id]: !prev[id] }));
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
      const newReceipt: SavedScannedReceipt = {
        id: `rcpt-${Date.now()}`,
        projectId: targetProj.id,
        projectName: targetProj.name,
        storeName: res.storeName || 'Händler',
        purchaseDate: res.purchaseDate || new Date().toLocaleDateString('de-DE'),
        totalAmount: res.totalAmount || '0,00',
        items: res.items.map((it) => ({
          title: it.title,
          quantity: it.quantity || '1x',
          price: it.price || ''
        })),
        createdAt: formatNow(),
        reconciled: false
      };

      const updated = [newReceipt, ...receipts];
      setReceipts(updated);
      saveScannedReceipts(updated);

      // Auto-expand the newly scanned receipt
      setExpandedReceiptIds((prev) => ({ ...prev, [newReceipt.id]: true }));

      // Automatically reconcile with target project cart
      onReconcileReceiptWithCart(
        targetProj.id,
        newReceipt.storeName,
        newReceipt.purchaseDate,
        newReceipt.totalAmount,
        newReceipt.items
      );
      onNotify(`Beleg "${newReceipt.storeName}" erfasst & abgeglichen!`);
    } catch (err: any) {
      setIsScanning(false);
      onNotify(`Fehler beim Beleg-Scan: ${err?.message || 'Unbekannt'}`);
    }
  };

  const handleDeleteReceipt = (receiptId: string) => {
    triggerHapticFeedback(15);
    const updated = receipts.filter((r) => r.id !== receiptId);
    setReceipts(updated);
    saveScannedReceipts(updated);
    onNotify('Beleg entfernt.');
  };

  const handleReconcileAgain = (receipt: SavedScannedReceipt) => {
    triggerHapticFeedback(20);
    onReconcileReceiptWithCart(
      receipt.projectId,
      receipt.storeName,
      receipt.purchaseDate,
      receipt.totalAmount,
      receipt.items
    );
    const updated = receipts.map((r) => (r.id === receipt.id ? { ...r, reconciled: true } : r));
    setReceipts(updated);
    saveScannedReceipts(updated);
    onNotify(`Beleg mit "${receipt.projectName}" abgeglichen.`);
  };

  const activeProjects = allProjects.filter((p) => !p.archived);

  return (
    <section className="space-y-4">
      {/* Sektions-Kopfzeile */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2.5 min-w-0">
          <Receipt className="w-5 h-5 shrink-0" style={{ color: themeColors.highlight }} />
          <div>
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
              <span className="truncate">Beleg wird durch KI analysiert &amp; Positionen erkannt...</span>
            </>
          ) : (
            <>
              <Camera className="w-5 h-5 shrink-0" />
              <span>Beleg fotografieren oder Bild hochladen</span>
            </>
          )}
          <input
            type="file"
            accept="image/*"
            disabled={isScanning}
            className="hidden"
            onChange={handleFileUpload}
          />
        </label>
      </div>

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
          <div className="text-sm font-bold text-[#F1F5F9]">Noch keine Belege erfasst</div>
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
              (targetProj.customMeta?.customAccentColor as string) ||
              targetProj.accentColor ||
              themeColors.primary;

            return (
              <div
                key={rcpt.id}
                className="rounded-2xl border relative overflow-hidden transition-all shadow-sm"
                style={{
                  backgroundColor: '#191C22',
                  borderColor: isExpanded ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)'
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
                      <span className="text-sm font-bold text-[#F1F5F9] truncate">
                        {rcpt.storeName}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/5 text-[#94A3B8] font-medium">
                        {rcpt.projectName}
                      </span>
                    </div>
                    <div className="text-xs text-[#94A3B8] font-mono mt-0.5">
                      {rcpt.purchaseDate} • {rcpt.items.length} Positionen
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="font-mono text-sm font-bold text-[#14B8A6]">
                      {rcpt.totalAmount} €
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
                            <span className="text-[#F1F5F9] truncate flex-1 min-w-0">
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
                        className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
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
