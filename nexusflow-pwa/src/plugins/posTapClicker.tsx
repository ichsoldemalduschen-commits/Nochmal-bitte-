/**
 * posTapClicker.tsx – POS Live-Verkaufs-Clicker (Paket 3)
 *
 * Neu in Paket 3:
 * - 3 Standard-Slots aus IndexedDB-Pizza-Katalog (statt 4 hart verdrahteter Sorten)
 * - ⚙-Einstell-Button (Progressive Disclosure, zugeklappt)
 *   Tab 1: Aktive Zähler-Slots (Katalog-Dropdown, lokale Überschreibung, Speichern/Zurücksetzen)
 *   Tab 2: Pizza-Katalog Stammdaten (CRUD)
 * - isLocallyOverridden-Indikator (Honig-Gold)
 * - Alle bestehenden Features (Live-Zählen, Trinkgeld-Fonds, Abrechnung, Reset) vollständig erhalten
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Flame,
  Minus,
  Plus,
  RotateCcw,
  Settings,
  ShoppingCart,
  X,
  Save,
  Undo2,
  Trash2,
  PlusCircle
} from 'lucide-react';
import { PluginContextProps, PosPizzaSlot, PizzaCatalogItem, THEME } from '../types';
import { computePosRestockItems } from '../services/gastroInventoryBridge';
import {
  formatNow,
  loadPizzaCatalog,
  savePizzaCatalog,
  loadPosSlots,
  savePosSlots,
  buildDefaultPosSlots,
  DEFAULT_PIZZA_CATALOG
} from '../services/storage';

type SettingsTab = 'slots' | 'catalog';

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────

export const PosTapClickerPlugin: React.FC<PluginContextProps> = ({
  project,
  onUpdateProjectMeta,
  onAddCartItems,
  onRecordEventSale,
  onNotify,
  gastroCartBridgeEnabled,
  openCartTitles,
  onAddRestockItemsToCart
}) => {
  // ── Kern-State ──────────────────────────────────────────────────────────────
  const [eventName, setEventName] = useState('Streetfood Einsatz');
  const [tipFund, setTipFund] = useState<number>(0);
  const [catalog, setCatalog] = useState<PizzaCatalogItem[]>(DEFAULT_PIZZA_CATALOG);
  const [slots, setSlots] = useState<PosPizzaSlot[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>('slots');
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [restockOpen, setRestockOpen] = useState(false);
  const [deselectedRestockIds, setDeselectedRestockIds] = useState<Record<string, boolean>>({});
  const [restockConfirmation, setRestockConfirmation] = useState<string | null>(null);

  // ── Katalog-Edit-State ──────────────────────────────────────────────────────
  const [editingCatalogId, setEditingCatalogId] = useState<string | null>(null);
  const [catalogEditTitle, setCatalogEditTitle] = useState('');
  const [catalogEditPrice, setCatalogEditPrice] = useState('');
  const [catalogEditScope, setCatalogEditScope] = useState('');
  const [catalogEditDough, setCatalogEditDough] = useState('');
  const [catalogEditCost, setCatalogEditCost] = useState('');

  // ── IDB laden ───────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const cat = await loadPizzaCatalog();
      setCatalog(cat);
      const sl = await loadPosSlots(cat);
      setSlots(sl);
      setCatalogLoaded(true);
    })();
  }, []);

  // ── Slots in IDB persistieren (ohne Zählerstände) ──────────────────────────
  const persistSlots = useCallback((newSlots: PosPizzaSlot[]) => {
    savePosSlots(newSlots).catch(() => {});
  }, []);

  // ── Berechnungen ────────────────────────────────────────────────────────────
  const totalPizzas = slots.reduce((acc, s) => acc + s.count, 0);
  const grossRevenue = slots.reduce((acc, s) => acc + s.count * s.price, 0);
  const cogsTotal = slots.reduce((acc, s) => acc + s.count * s.unitCost, 0);
  const grossProfit = grossRevenue - cogsTotal;

  const restockSuggestions = useMemo(
    () => computePosRestockItems(totalPizzas, openCartTitles || []),
    [totalPizzas, openCartTitles]
  );

  const selectedRestockItems = restockSuggestions.filter(
    (item) => !item.alreadyInCart && !deselectedRestockIds[item.id]
  );

  const handleToggleRestockItem = (id: string) => {
    setDeselectedRestockIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSubmitPosRestock = () => {
    if (selectedRestockItems.length === 0) {
      onNotify('Keine neuen Nachorder-Artikel ausgewählt.');
      return;
    }
    const addFn = onAddRestockItemsToCart || onAddCartItems;
    addFn(
      selectedRestockItems.map((item) => ({
        title: item.title,
        quantity: item.quantity,
        reason: item.reason
      }))
    );
    const msg = `${selectedRestockItems.length} Verbrauchsartikel auf Einkaufsliste gelegt.`;
    setRestockConfirmation(msg);
    onNotify(msg);
  };

  // ── Zähler-Aktionen ─────────────────────────────────────────────────────────
  const updateCount = (slotId: string, delta: number) => {
    setSlots((prev) =>
      prev.map((s) => (s.slotId === slotId ? { ...s, count: Math.max(0, s.count + delta) } : s))
    );
  };

  const handleReset = () => {
    setSlots((prev) => prev.map((s) => ({ ...s, count: 0 })));
    setTipFund(0);
  };

  // ── Event-Abrechnung ────────────────────────────────────────────────────────
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
      items: slots.map((s) => ({
        id: s.slotId,
        name: s.title,
        unitPrice: s.price,
        unitCost: s.unitCost,
        count: s.count
      }))
    });

    onUpdateProjectMeta({
      letztesEventUmsatz: grossRevenue.toFixed(2),
      feuerwehrautoFondsGesamt: updatedFund
    });

    setSlots((prev) => prev.map((s) => ({ ...s, count: 0 })));
    setTipFund(0);
    onNotify('Event-Abrechnung in Backoffice-Auswertung gespeichert!');
  };

  // ── Slot-Einstellungen ──────────────────────────────────────────────────────
  const handleSlotCatalogChange = (slotId: string, catalogId: string) => {
    const item = catalog.find((c) => c.id === catalogId);
    if (!item) return;
    setSlots((prev) => {
      const updated = prev.map((s) =>
        s.slotId === slotId
          ? {
              ...s,
              catalogId: item.id,
              title: item.title,
              price: item.price,
              portionScope: item.portionScope,
              unitCost: item.unitCost ?? 2.5,
              isLocallyOverridden: false
            }
          : s
      );
      persistSlots(updated);
      return updated;
    });
  };

  const handleSlotLocalEdit = (slotId: string, field: 'title' | 'price' | 'portionScope', value: string) => {
    setSlots((prev) => {
      const updated = prev.map((s) => {
        if (s.slotId !== slotId) return s;
        const patch: Partial<PosPizzaSlot> = { isLocallyOverridden: true };
        if (field === 'title') patch.title = value;
        if (field === 'price') patch.price = Number(value) || s.price;
        if (field === 'portionScope') patch.portionScope = value;
        return { ...s, ...patch };
      });
      persistSlots(updated);
      return updated;
    });
  };

  const handleSlotReset = (slotId: string) => {
    setSlots((prev) => {
      const updated = prev.map((s) => {
        if (s.slotId !== slotId) return s;
        const origin = catalog.find((c) => c.id === s.catalogId);
        if (!origin) return { ...s, isLocallyOverridden: false };
        return {
          ...s,
          title: origin.title,
          price: origin.price,
          portionScope: origin.portionScope,
          unitCost: origin.unitCost ?? 2.5,
          isLocallyOverridden: false
        };
      });
      persistSlots(updated);
      return updated;
    });
  };

  const handleSlotSaveToCatalog = (slotId: string) => {
    const slot = slots.find((s) => s.slotId === slotId);
    if (!slot) return;
    if (slot.catalogId) {
      // Bestehenden Eintrag aktualisieren
      const updatedCatalog = catalog.map((c) =>
        c.id === slot.catalogId
          ? { ...c, title: slot.title, price: slot.price, portionScope: slot.portionScope }
          : c
      );
      setCatalog(updatedCatalog);
      savePizzaCatalog(updatedCatalog).catch(() => {});
    } else {
      // Neuen Eintrag anlegen
      const newItem: PizzaCatalogItem = {
        id: `cat-${genId()}`,
        title: slot.title,
        price: slot.price,
        portionScope: slot.portionScope,
        unitCost: slot.unitCost
      };
      const updatedCatalog = [...catalog, newItem];
      setCatalog(updatedCatalog);
      savePizzaCatalog(updatedCatalog).catch(() => {});
      // Slot mit neuer catalogId verknüpfen
      setSlots((prev) => {
        const updated = prev.map((s) =>
          s.slotId === slotId ? { ...s, catalogId: newItem.id, isLocallyOverridden: false } : s
        );
        persistSlots(updated);
        return updated;
      });
      return;
    }
    setSlots((prev) => {
      const updated = prev.map((s) =>
        s.slotId === slotId ? { ...s, isLocallyOverridden: false } : s
      );
      persistSlots(updated);
      return updated;
    });
    onNotify('Sorte im Katalog aktualisiert!');
  };

  const handleAddSlot = () => {
    const first = catalog[0];
    const newSlot: PosPizzaSlot = {
      slotId: `slot-${genId()}`,
      catalogId: first?.id ?? null,
      title: first?.title ?? 'Neue Sorte',
      price: first?.price ?? 12.0,
      portionScope: first?.portionScope ?? 'Ø 30 cm',
      unitCost: first?.unitCost ?? 2.5,
      count: 0,
      isLocallyOverridden: false
    };
    setSlots((prev) => {
      const updated = [...prev, newSlot];
      persistSlots(updated);
      return updated;
    });
  };

  const handleRemoveSlot = (slotId: string) => {
    if (slots.length <= 1) return;
    setSlots((prev) => {
      const updated = prev.filter((s) => s.slotId !== slotId);
      persistSlots(updated);
      return updated;
    });
  };

  // ── Katalog-Stammdaten-CRUD ─────────────────────────────────────────────────
  const startCatalogEdit = (item: PizzaCatalogItem) => {
    setEditingCatalogId(item.id);
    setCatalogEditTitle(item.title);
    setCatalogEditPrice(String(item.price));
    setCatalogEditScope(item.portionScope);
    setCatalogEditDough(String(item.doughWeightGrams ?? ''));
    setCatalogEditCost(String(item.unitCost ?? ''));
  };

  const startCatalogNew = () => {
    setEditingCatalogId('__new__');
    setCatalogEditTitle('');
    setCatalogEditPrice('');
    setCatalogEditScope('');
    setCatalogEditDough('');
    setCatalogEditCost('');
  };

  const commitCatalogEdit = () => {
    if (!catalogEditTitle.trim()) return;
    if (editingCatalogId === '__new__') {
      const newItem: PizzaCatalogItem = {
        id: `cat-${genId()}`,
        title: catalogEditTitle.trim(),
        price: Number(catalogEditPrice) || 0,
        portionScope: catalogEditScope.trim(),
        doughWeightGrams: catalogEditDough ? Number(catalogEditDough) : undefined,
        unitCost: catalogEditCost ? Number(catalogEditCost) : undefined
      };
      const updated = [...catalog, newItem];
      setCatalog(updated);
      savePizzaCatalog(updated).catch(() => {});
    } else {
      const updated = catalog.map((c) =>
        c.id === editingCatalogId
          ? {
              ...c,
              title: catalogEditTitle.trim(),
              price: Number(catalogEditPrice) || c.price,
              portionScope: catalogEditScope.trim(),
              doughWeightGrams: catalogEditDough ? Number(catalogEditDough) : c.doughWeightGrams,
              unitCost: catalogEditCost ? Number(catalogEditCost) : c.unitCost
            }
          : c
      );
      setCatalog(updated);
      savePizzaCatalog(updated).catch(() => {});
    }
    setEditingCatalogId(null);
  };

  const handleDeleteCatalogItem = (itemId: string) => {
    const updated = catalog.filter((c) => c.id !== itemId);
    setCatalog(updated);
    savePizzaCatalog(updated).catch(() => {});
    // Slots, die diese Sorte nutzen: catalogId auf null setzen
    setSlots((prev) => {
      const updatedSlots = prev.map((s) =>
        s.catalogId === itemId ? { ...s, catalogId: null, isLocallyOverridden: true } : s
      );
      persistSlots(updatedSlots);
      return updatedSlots;
    });
  };

  // ─────────────────────────────────────────────────────────────────────────────
  if (!catalogLoaded) {
    return (
      <div className="p-3.5 rounded-xl border border-white/10 bg-[#191C22] text-xs text-[#94A3B8]">
        Lade Pizza-Katalog…
      </div>
    );
  }

  return (
    <div className="p-3.5 rounded-xl border border-white/[0.04] bg-[#191C22] space-y-3">
      {/* ── Kopfzeile ── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Flame className="w-4 h-4 shrink-0 text-[#14B8A6]" />
          <h4 className="text-sm font-bold text-white leading-tight">
            Live-Verkaufs-Clicker (POS)
          </h4>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            aria-label="Zähler nullen"
            onClick={handleReset}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-[#111317] text-[#9CA3AF] hover:text-white border border-white/10 active:scale-95 transition"
            title="Alle Zähler auf 0"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            aria-label={settingsOpen ? 'Einstellungen schließen' : 'Einstellungen öffnen'}
            onClick={() => setSettingsOpen((o) => !o)}
            className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border transition active:scale-95 ${
              settingsOpen
                ? 'bg-[#E5A93C]/20 border-[#E5A93C]/40 text-[#E5A93C]'
                : 'bg-[#111317] border-white/10 text-[#9CA3AF] hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── ⚙ Einstellungsbereich (Progressive Disclosure) ── */}
      {settingsOpen && (
        <div className="rounded-xl border border-white/[0.06] bg-[#111317] space-y-3 p-3">
          {/* Tab-Leiste */}
          <div className="flex gap-1 p-0.5 bg-[#22262F] rounded-lg">
            {(['slots', 'catalog'] as SettingsTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                aria-label={tab === 'slots' ? 'Aktive Zähler-Slots' : 'Pizza-Katalog'}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 min-h-[44px] rounded-md text-xs font-semibold transition ${
                  activeTab === tab
                    ? 'bg-[#191C22] text-white shadow'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                {tab === 'slots' ? 'Aktive Slots' : 'Pizza-Katalog'}
              </button>
            ))}
          </div>

          {/* ── Tab 1: Aktive Zähler-Slots ── */}
          {activeTab === 'slots' && (
            <div className="space-y-3" aria-label="Aktive Zähler-Slots Einstellungen">
              {slots.map((slot) => (
                <SlotSettingsCard
                  key={slot.slotId}
                  slot={slot}
                  catalog={catalog}
                  canRemove={slots.length > 1}
                  onCatalogChange={(catalogId) => handleSlotCatalogChange(slot.slotId, catalogId)}
                  onLocalEdit={(field, value) => handleSlotLocalEdit(slot.slotId, field, value)}
                  onReset={() => handleSlotReset(slot.slotId)}
                  onSaveToCatalog={() => handleSlotSaveToCatalog(slot.slotId)}
                  onRemove={() => handleRemoveSlot(slot.slotId)}
                />
              ))}
              <button
                type="button"
                aria-label="Weiteren Pizza-Slot hinzufügen"
                onClick={handleAddSlot}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 text-xs text-[#94A3B8] hover:text-white hover:border-white/40 transition"
              >
                <PlusCircle className="w-4 h-4" />
                Weiteren Pizza-Slot hinzufügen
              </button>
            </div>
          )}

          {/* ── Tab 2: Pizza-Katalog Stammdaten ── */}
          {activeTab === 'catalog' && (
            <div className="space-y-2" aria-label="Pizza-Katalog Stammdaten">
              {catalog.map((item) => (
                <div key={item.id}>
                  {editingCatalogId === item.id ? (
                    <CatalogEditForm
                      title={catalogEditTitle}
                      price={catalogEditPrice}
                      scope={catalogEditScope}
                      dough={catalogEditDough}
                      cost={catalogEditCost}
                      onTitleChange={setCatalogEditTitle}
                      onPriceChange={setCatalogEditPrice}
                      onScopeChange={setCatalogEditScope}
                      onDoughChange={setCatalogEditDough}
                      onCostChange={setCatalogEditCost}
                      onSave={commitCatalogEdit}
                      onCancel={() => setEditingCatalogId(null)}
                    />
                  ) : (
                    <div className="flex items-start gap-2 p-2.5 rounded-xl bg-[#22262F] border border-white/[0.06]">
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-semibold text-white block">{item.title}</span>
                        <span className="text-xs font-mono text-[#E5A93C]">
                          {item.price.toFixed(2)} €
                        </span>
                        <span className="text-xs text-[#94A3B8] ml-2">{item.portionScope}</span>
                        {item.doughWeightGrams && (
                          <span className="text-xs text-[#94A3B8] ml-2 font-mono">
                            · {item.doughWeightGrams}g
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          type="button"
                          aria-label={`Sorte ${item.title} bearbeiten`}
                          onClick={() => startCatalogEdit(item)}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-[#111317] text-[#94A3B8] hover:text-white border border-white/10 transition"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Sorte ${item.title} löschen`}
                          onClick={() => handleDeleteCatalogItem(item.id)}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-[#111317] text-[#94A3B8] hover:text-[#E5A93C] border border-white/10 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {editingCatalogId === '__new__' ? (
                <CatalogEditForm
                  title={catalogEditTitle}
                  price={catalogEditPrice}
                  scope={catalogEditScope}
                  dough={catalogEditDough}
                  cost={catalogEditCost}
                  onTitleChange={setCatalogEditTitle}
                  onPriceChange={setCatalogEditPrice}
                  onScopeChange={setCatalogEditScope}
                  onDoughChange={setCatalogEditDough}
                  onCostChange={setCatalogEditCost}
                  onSave={commitCatalogEdit}
                  onCancel={() => setEditingCatalogId(null)}
                  isNew
                />
              ) : (
                <button
                  type="button"
                  aria-label="Neue Sorte anlegen"
                  onClick={startCatalogNew}
                  className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 text-xs text-[#94A3B8] hover:text-white hover:border-white/40 transition"
                >
                  <PlusCircle className="w-4 h-4" />
                  Neue Sorte anlegen
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Event-Name ── */}
      <input
        type="text"
        value={eventName}
        onChange={(e) => setEventName(e.target.value)}
        placeholder="Event-Bezeichnung (z. B. Hafenmarkt)..."
        className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-[#111317] text-white border border-white/10"
      />

      {/* ── Pizza-Slots ── */}
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: slots.length === 1 ? '1fr' : 'repeat(2, 1fr)' }}
        aria-label="POS Pizza-Slots"
      >
        {slots.map((slot) => (
          <div
            key={slot.slotId}
            className="p-2.5 rounded-xl bg-[#111317] border border-white/10 flex flex-col justify-between gap-2 min-w-0"
            data-testid={`pos-slot-${slot.slotId}`}
          >
            <div className="min-w-0">
              <span className="text-xs font-bold text-white block leading-snug break-words">
                {slot.title}
              </span>
              <span className="text-xs text-[#94A3B8] block leading-tight break-words">
                {slot.portionScope}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span className="text-xs font-mono font-bold text-[#E5A93C]">
                  {slot.price.toFixed(2)} €
                </span>
                {slot.isLocallyOverridden && (
                  <span
                    className="text-[11px] text-[#E5A93C] border border-[#E5A93C]/30 rounded px-1 leading-4"
                    title="Lokal fürs Event angepasst"
                    aria-label="Event-Anpassung aktiv"
                  >
                    Event-Anpassung
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-1">
              <button
                type="button"
                aria-label={`${slot.title} minus`}
                onClick={() => updateCount(slot.slotId, -1)}
                className="w-11 h-11 min-h-[44px] min-w-[44px] rounded-lg bg-[#191C22] text-[#9CA3AF] hover:text-white flex items-center justify-center border border-white/10 active:scale-95 transition"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="text-base font-mono font-bold text-[#14B8A6]">{slot.count}</span>
              <button
                type="button"
                aria-label={`${slot.title} plus`}
                onClick={() => updateCount(slot.slotId, 1)}
                className="px-3 h-11 min-h-[44px] rounded-lg text-white font-bold text-xs flex items-center gap-1 shadow active:scale-95 transition"
                style={{ backgroundColor: THEME.accentPrimary }}
              >
                <Plus className="w-4 h-4" />1
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ── Feuerwehrauto-Fonds (Trinkgeld) ── */}
      <div className="p-2.5 rounded-xl bg-[#111317] border border-[#E5A93C]/20 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-[#F1F5F9]">🚒 Feuerwehrauto-Fonds (Trinkgeld)</span>
          <span className="font-mono font-bold text-[#14B8A6]">{tipFund.toFixed(2)} €</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {[1, 2, 5].map((amt) => (
            <button
              key={amt}
              type="button"
              aria-label={`${amt} Euro Trinkgeld hinzufügen`}
              onClick={() => setTipFund((t) => Number((t + amt).toFixed(2)))}
              className="min-h-[44px] rounded-lg text-xs font-bold bg-[#191C22] hover:bg-[#0A9396] text-white border border-white/10 transition"
            >
              +{amt} €
            </button>
          ))}
          <button
            type="button"
            aria-label="1 Euro Trinkgeld abziehen"
            onClick={() => setTipFund((t) => Math.max(0, Number((t - 1).toFixed(2))))}
            className="min-h-[44px] rounded-lg text-xs bg-[#191C22] text-[#9CA3AF] hover:text-white border border-white/10"
          >
            -1 €
          </button>
        </div>
        <div className="text-xs text-[#94A3B8]">
          Gesamtstand Fonds bisher:{' '}
          <strong className="text-white font-mono">
            {Number(project.customMeta?.feuerwehrautoFondsGesamt || 0).toFixed(2)} €
          </strong>
        </div>
      </div>

      {/* ── Live-Summenzeile ── */}
      <div className="p-2.5 rounded-xl bg-[#111317] border border-white/10 grid grid-cols-3 gap-2 text-center">
        <div>
          <span className="text-xs text-[#94A3B8] block">Pizzen</span>
          <strong className="text-xs font-mono text-white">{totalPizzas} Stk.</strong>
        </div>
        <div>
          <span className="text-xs text-[#94A3B8] block">Umsatz</span>
          <strong className="text-xs font-mono text-[#14B8A6]">{grossRevenue.toFixed(2)} €</strong>
        </div>
        <div>
          <span className="text-xs text-[#94A3B8] block">Rohertrag</span>
          <strong className="text-xs font-mono text-emerald-400">{grossProfit.toFixed(2)} €</strong>
        </div>
      </div>

      {/* ── 1-Klick Abschluss ── */}
      <button
        type="button"
        onClick={handleCheckoutEvent}
        className="w-full py-2.5 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 shadow-lg transition active:scale-98"
        style={{ backgroundColor: THEME.accentPrimary }}
      >
        <CheckCircle2 className="w-4 h-4" />
        1-Klick Event-Abschluss in Backoffice buchen
      </button>

      {/* ── Gastro-Einkaufswagen-Brücke (Verbrauch nachordern) ── */}
      {gastroCartBridgeEnabled !== false && (
        <div
          data-testid="pos-restock-bridge"
          className="rounded-xl border border-white/10 bg-[#111317] overflow-hidden"
        >
          <button
            type="button"
            data-testid="pos-restock-toggle"
            aria-expanded={restockOpen}
            onClick={() => setRestockOpen((o) => !o)}
            className="w-full min-h-[44px] px-3 py-2 flex items-center justify-between gap-2 text-xs font-semibold text-[#F1F5F9] cursor-pointer"
          >
            <span className="flex items-center gap-2 min-w-0">
              <ShoppingCart className="w-4 h-4 text-[#E5A93C] shrink-0" />
              <span className="break-words text-left">Verbrauch nachordern (Einkaufswagen)</span>
            </span>
            <span className="flex items-center gap-1.5 shrink-0 font-mono text-[#94A3B8]">
              <span>
                {totalPizzas > 0
                  ? `${restockSuggestions.filter((r) => !r.alreadyInCart).length} offen`
                  : 'ab 1 Pizza'}
              </span>
              {restockOpen ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </span>
          </button>

          {restockOpen && (
            <div className="px-3 pb-3 pt-1 border-t border-white/5 space-y-2">
              {totalPizzas === 0 ? (
                <p className="text-xs text-[#94A3B8] leading-snug">
                  Ab 1 gezählter Pizza werden Mehl, Mozzarella, Tomatensauce und Kartons automatisch berechnet.
                </p>
              ) : (
                <>
                  <div className="space-y-1.5">
                    {restockSuggestions.map((item) => {
                      const checked = !item.alreadyInCart && !deselectedRestockIds[item.id];
                      return (
                        <button
                          key={item.id}
                          type="button"
                          disabled={item.alreadyInCart}
                          data-testid={`pos-restock-item-${item.id}`}
                          onClick={() => handleToggleRestockItem(item.id)}
                          className={`w-full min-h-[44px] px-2.5 py-2 rounded-lg border flex items-center justify-between gap-2 text-left transition ${
                            item.alreadyInCart
                              ? 'bg-[#191C22]/60 border-white/5 opacity-75 cursor-default'
                              : checked
                                ? 'bg-[#191C22] border-[#14B8A6]/50 text-[#F1F5F9] cursor-pointer'
                                : 'bg-[#191C22] border-white/10 text-[#94A3B8] cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span
                              className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border ${
                                item.alreadyInCart
                                  ? 'bg-[#22262F] border-white/10 text-[#94A3B8]'
                                  : checked
                                    ? 'bg-[#14B8A6] border-[#14B8A6] text-[#111317]'
                                    : 'bg-[#111317] border-white/20 text-transparent'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </span>
                            <span className="text-xs font-medium break-words min-w-0">
                              {item.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                            <span className="text-xs font-mono text-[#E5A93C]">
                              {item.quantity}
                            </span>
                            {item.alreadyInCart && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-[#22262F] text-[#94A3B8]">
                                Bereits im Wagen
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    data-testid="pos-restock-submit"
                    disabled={selectedRestockItems.length === 0}
                    onClick={handleSubmitPosRestock}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold text-[#111317] disabled:opacity-50 flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
                    style={{ backgroundColor: '#E5A93C' }}
                  >
                    <ShoppingCart className="w-4 h-4 shrink-0" />
                    <span>Ausgewählte auf Einkaufsliste</span>
                  </button>

                  {restockConfirmation && (
                    <div
                      data-testid="pos-restock-confirmation"
                      className="text-xs font-medium text-[#E5A93C] leading-snug"
                    >
                      {restockConfirmation}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── SlotSettingsCard ──────────────────────────────────────────────────────────

interface SlotSettingsCardProps {
  slot: PosPizzaSlot;
  catalog: PizzaCatalogItem[];
  canRemove: boolean;
  onCatalogChange: (catalogId: string) => void;
  onLocalEdit: (field: 'title' | 'price' | 'portionScope', value: string) => void;
  onReset: () => void;
  onSaveToCatalog: () => void;
  onRemove: () => void;
}

const SlotSettingsCard: React.FC<SlotSettingsCardProps> = ({
  slot,
  catalog,
  canRemove,
  onCatalogChange,
  onLocalEdit,
  onReset,
  onSaveToCatalog,
  onRemove
}) => {
  return (
    <div className="p-2.5 rounded-xl bg-[#22262F] border border-white/[0.06] space-y-2">
      {/* Slot-Bezeichnung + Löschen */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-[#94A3B8]">Slot</span>
        {canRemove && (
          <button
            type="button"
            aria-label={`Slot ${slot.title} entfernen`}
            onClick={onRemove}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#94A3B8] hover:text-[#E5A93C] rounded-lg border border-white/10 bg-[#111317] transition"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Katalog-Dropdown */}
      <div>
        <label className="text-xs text-[#94A3B8] block mb-1">Sorte aus Katalog</label>
        <select
          aria-label="Sorte aus Katalog wählen"
          value={slot.catalogId ?? ''}
          onChange={(e) => onCatalogChange(e.target.value)}
          className="w-full min-h-[44px] px-2.5 rounded-lg text-xs bg-[#111317] text-white border border-white/10"
        >
          <option value="" disabled>
            – Sorte wählen –
          </option>
          {catalog.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title} · {item.price.toFixed(2)} € · {item.portionScope}
            </option>
          ))}
        </select>
      </div>

      {/* Lokale Felder */}
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <label className="text-xs text-[#94A3B8] block mb-1">Titel (lokal)</label>
          <input
            type="text"
            aria-label="Slot-Titel lokal bearbeiten"
            value={slot.title}
            onChange={(e) => onLocalEdit('title', e.target.value)}
            className="w-full min-h-[44px] px-2.5 rounded-lg text-xs bg-[#111317] text-white border border-white/10"
          />
        </div>
        <div>
          <label className="text-xs text-[#94A3B8] block mb-1">Preis (€)</label>
          <input
            type="number"
            step="0.5"
            aria-label="Slot-Preis lokal bearbeiten"
            value={slot.price}
            onChange={(e) => onLocalEdit('price', e.target.value)}
            className="w-full min-h-[44px] px-2.5 rounded-lg text-xs font-mono bg-[#111317] text-[#E5A93C] border border-white/10"
          />
        </div>
        <div>
          <label className="text-xs text-[#94A3B8] block mb-1">Umfang / Größe</label>
          <input
            type="text"
            aria-label="Slot-Umfang lokal bearbeiten"
            value={slot.portionScope}
            onChange={(e) => onLocalEdit('portionScope', e.target.value)}
            className="w-full min-h-[44px] px-2.5 rounded-lg text-xs bg-[#111317] text-white border border-white/10"
          />
        </div>
      </div>

      {/* Aktionen nur wenn lokal angepasst */}
      {slot.isLocallyOverridden && (
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            aria-label="Slot-Änderungen in Katalog speichern"
            onClick={onSaveToCatalog}
            className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold bg-[#E5A93C]/20 text-[#E5A93C] border border-[#E5A93C]/30 hover:bg-[#E5A93C]/30 transition"
          >
            <Save className="w-3.5 h-3.5" />
            In Katalog speichern
          </button>
          <button
            type="button"
            aria-label="Slot auf Katalog-Werte zurücksetzen"
            onClick={onReset}
            className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold bg-[#111317] text-[#94A3B8] hover:text-white border border-white/10 transition"
          >
            <Undo2 className="w-3.5 h-3.5" />
            Zurücksetzen
          </button>
        </div>
      )}
    </div>
  );
};

// ── CatalogEditForm ───────────────────────────────────────────────────────────

interface CatalogEditFormProps {
  title: string;
  price: string;
  scope: string;
  dough: string;
  cost: string;
  isNew?: boolean;
  onTitleChange: (v: string) => void;
  onPriceChange: (v: string) => void;
  onScopeChange: (v: string) => void;
  onDoughChange: (v: string) => void;
  onCostChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

const CatalogEditForm: React.FC<CatalogEditFormProps> = ({
  title, price, scope, dough, cost, isNew,
  onTitleChange, onPriceChange, onScopeChange, onDoughChange, onCostChange,
  onSave, onCancel
}) => (
  <div className="p-2.5 rounded-xl bg-[#22262F] border border-[#E5A93C]/30 space-y-2">
    <span className="text-xs font-semibold text-[#E5A93C]">
      {isNew ? 'Neue Sorte anlegen' : 'Sorte bearbeiten'}
    </span>
    <input
      type="text"
      placeholder="Titel"
      aria-label="Katalog-Titel"
      value={title}
      onChange={(e) => onTitleChange(e.target.value)}
      className="w-full min-h-[44px] px-2.5 rounded-lg text-xs bg-[#111317] text-white border border-white/10"
    />
    <div className="grid grid-cols-2 gap-2">
      <input
        type="number"
        step="0.5"
        placeholder="Preis €"
        aria-label="Katalog-Preis"
        value={price}
        onChange={(e) => onPriceChange(e.target.value)}
        className="w-full min-h-[44px] px-2.5 rounded-lg text-xs font-mono bg-[#111317] text-[#E5A93C] border border-white/10"
      />
      <input
        type="number"
        step="0.1"
        placeholder="WE €"
        aria-label="Wareneinsatz"
        value={cost}
        onChange={(e) => onCostChange(e.target.value)}
        className="w-full min-h-[44px] px-2.5 rounded-lg text-xs font-mono bg-[#111317] text-[#94A3B8] border border-white/10"
      />
      <input
        type="text"
        placeholder="Umfang z. B. Ø 30 cm"
        aria-label="Umfang / Portionsgröße"
        value={scope}
        onChange={(e) => onScopeChange(e.target.value)}
        className="w-full min-h-[44px] px-2.5 rounded-lg text-xs bg-[#111317] text-white border border-white/10"
      />
      <input
        type="number"
        placeholder="Teiggewicht g"
        aria-label="Teiggewicht in Gramm"
        value={dough}
        onChange={(e) => onDoughChange(e.target.value)}
        className="w-full min-h-[44px] px-2.5 rounded-lg text-xs font-mono bg-[#111317] text-white border border-white/10"
      />
    </div>
    <div className="flex gap-2">
      <button
        type="button"
        aria-label="Katalog-Eintrag speichern"
        onClick={onSave}
        className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold bg-[#0D9488] text-white hover:bg-[#14B8A6] transition"
      >
        <Save className="w-3.5 h-3.5" />
        Speichern
      </button>
      <button
        type="button"
        aria-label="Bearbeitung abbrechen"
        onClick={onCancel}
        className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 rounded-lg text-xs bg-[#111317] text-[#94A3B8] hover:text-white border border-white/10 transition"
      >
        <X className="w-3.5 h-3.5" />
        Abbrechen
      </button>
    </div>
  </div>
);
