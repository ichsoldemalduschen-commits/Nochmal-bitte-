import React, { useMemo, useState } from 'react';
import {
  Check,
  Edit3,
  MoreHorizontal,
  Plus,
  Scale,
  Settings,
  ShoppingCart,
  Trash2
} from 'lucide-react';
import { CartItem, Project, THEME } from '../../types';
import { BRAND_CONFIG } from '../../config/brandConfig';
import { ProcurementCheckPanel } from '../../plugins/procurementCheck';
import { triggerHapticFeedback } from '../../services/aiRouter';
import { ThemeColors } from './FrontHeader';

interface CartViewProps {
  activeProject: Project;
  allProjects: Project[];
  themeColors: ThemeColors;
  searchQuery: string;
  highlightedItemId: string | null;
  onToggleCartItem: (projectId: string, cartId: string) => void;
  onDeleteCartItem: (projectId: string, cartId: string) => void;
  onAddCartItems: (
    projectId: string,
    items: Array<{ title: string; quantity: string; price?: string; reason?: string }>
  ) => void;
  onUpdateCartItem?: (projectId: string, cartId: string, patch: Partial<CartItem>) => void;
  onMoveCartItem?: (fromProjectId: string, toProjectId: string, cartId: string) => void;
  onConfirmRedDot: (
    projectId: string,
    section: 'tasks' | 'explanations' | 'infos' | 'cart' | 'knowledge',
    itemId: string
  ) => void;
  onOpenSettings?: () => void;
  onNotify: (msg: string) => void;
}

export const CartView: React.FC<CartViewProps> = ({
  activeProject,
  allProjects,
  themeColors,
  searchQuery,
  highlightedItemId,
  onToggleCartItem,
  onDeleteCartItem,
  onAddCartItems,
  onUpdateCartItem,
  onMoveCartItem,
  onConfirmRedDot,
  onOpenSettings,
  onNotify
}) => {
  const [isAddingCart, setIsAddingCart] = useState(false);
  const [newCartTitle, setNewCartTitle] = useState('');
  const [newCartQty, setNewCartQty] = useState('1x');
  const [newCartPrice, setNewCartPrice] = useState('');
  const [globalCartMode, setGlobalCartMode] = useState(true);
  const [cartProjectFilter, setCartProjectFilter] = useState<string>('ALL');
  const [cartCategoryFilter, setCartCategoryFilter] = useState<'ALL' | 'open' | 'completed'>('ALL');
  const [editingCartId, setEditingCartId] = useState<string | null>(null);
  const [editCartTitle, setEditCartTitle] = useState('');
  const [editCartQty, setEditCartQty] = useState('');
  const [editCartPrice, setEditCartPrice] = useState('');
  const [openProcurements, setOpenProcurements] = useState<Record<string, boolean>>({});
  const [expandedActionCards, setExpandedActionCards] = useState<Record<string, boolean>>({});

  const toggleActionCard = (id: string) => {
    triggerHapticFeedback(10);
    setExpandedActionCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const displayedCart = useMemo(() => {
    let items: Array<CartItem & { originProjectId: string; originProjectName: string }>;

    if (globalCartMode && allProjects.length > 0) {
      items = allProjects
        .filter((p) => !p.archived)
        .flatMap((p) =>
          p.cart.map((c) => ({
            ...c,
            originProjectId: p.id,
            originProjectName: p.name
          }))
        );
    } else if (activeProject) {
      items = [...activeProject.cart].map((c) => ({
        ...c,
        originProjectId: activeProject.id,
        originProjectName: activeProject.name
      }));
    } else {
      items = [];
    }

    return items
      .filter((c) => {
        if (cartProjectFilter !== 'ALL' && c.originProjectId !== cartProjectFilter) {
          return false;
        }
        if (cartCategoryFilter === 'open' && c.completed) return false;
        if (cartCategoryFilter === 'completed' && !c.completed) return false;
        if (searchQuery.trim() && !c.title.toLowerCase().includes(searchQuery.toLowerCase())) {
          return false;
        }
        return true;
      })
      .sort((a, b) => Number(a.completed) - Number(b.completed));
  }, [activeProject, allProjects, globalCartMode, cartProjectFilter, cartCategoryFilter, searchQuery]);

  return (
    <section
      className="rounded-3xl border border-white/5 p-5 space-y-4 shadow-xl transition-all"
      style={{ backgroundColor: '#1C2026' }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <ShoppingCart
            className="w-5 h-5"
            style={{ color: themeColors.highlight }}
          />
          <h3 className="text-base font-bold text-white tracking-wide">
            Einkaufswagen
          </h3>
          <span className="text-xs font-semibold text-[#9CA3AF] px-2 py-0.5 rounded-full bg-[#242930]">
            {displayedCart.filter((c) => !c.completed).length} offen
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsAddingCart((v) => !v)}
          className={`w-11 h-11 min-h-[44px] min-w-[44px] rounded-2xl border flex items-center justify-center transition active:scale-95 ${
            isAddingCart
              ? 'text-white border-white/30'
              : 'bg-[#242930] hover:bg-[#2A3038] text-white border-white/5'
          }`}
          style={isAddingCart ? { backgroundColor: themeColors.primary } : {}}
          aria-label="Artikel hinzufügen"
          title="Artikel hinzufügen"
        >
          <Plus className="w-5 h-5 text-[#14B8A6]" />
        </button>
      </div>

      {/* EINZIGE KLARE ANGEPINNTE FILTER-LEISTE */}
      <div className="sticky top-0 z-20 py-2.5 -mx-2 px-2 bg-[#1C2026]/95 backdrop-blur-md rounded-2xl border border-white/5 space-y-2">
        {/* Projekt-Filter-Chips */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
          <button
            type="button"
            onClick={() => setCartProjectFilter('ALL')}
            className={`min-h-[44px] px-3.5 rounded-xl text-xs font-bold border shrink-0 transition active:scale-95 cursor-pointer ${
              cartProjectFilter === 'ALL'
                ? 'bg-[#0A9396] text-white border-[#14B8A6] shadow-sm'
                : 'bg-[#242930] text-[#9CA3AF] border-white/5 hover:text-white'
            }`}
          >
            Alle (
            {
              allProjects
                .flatMap((p) => (p.archived ? [] : p.cart))
                .filter((c) => !c.completed).length
            }
            )
          </button>

          {allProjects
            .filter((p) => !p.archived)
            .map((proj) => {
              const isActive = cartProjectFilter === proj.id;
              const openCount = proj.cart.filter((c) => !c.completed).length;
              const pColor =
                (proj.customMeta?.customAccentColor as string) ||
                proj.accentColor ||
                BRAND_CONFIG.projects[proj.id]?.accentColor ||
                '#0A9396';

              return (
                <button
                  key={proj.id}
                  type="button"
                  onClick={() =>
                    setCartProjectFilter((prev) => (prev === proj.id ? 'ALL' : proj.id))
                  }
                  className={`min-h-[44px] px-3.5 rounded-xl text-xs font-bold border shrink-0 flex items-center gap-1.5 transition active:scale-95 cursor-pointer ${
                    isActive
                      ? 'text-white border-white/30 shadow-sm'
                      : 'bg-[#242930] text-[#9CA3AF] border-white/5 hover:text-white'
                  }`}
                  style={isActive ? { backgroundColor: pColor } : {}}
                >
                  <span className="truncate max-w-[140px]">{proj.name}</span>
                  <span className="font-mono text-xs px-1.5 py-0.5 rounded-md bg-black/30">
                    {openCount}
                  </span>
                </button>
              );
            })}
        </div>

        {/* Status-Umschalter: sauber und kompakt ohne doppelte Labels */}
        <div className="flex items-center gap-2 pt-1 border-t border-white/5">
          {(['ALL', 'open', 'completed'] as const).map((status) => {
            const isSelected = cartCategoryFilter === status;
            const label =
              status === 'ALL'
                ? `Alle (${displayedCart.length})`
                : status === 'open'
                ? `Offen (${displayedCart.filter((c) => !c.completed).length})`
                : `Erledigt (${displayedCart.filter((c) => c.completed).length})`;
            return (
              <button
                key={status}
                type="button"
                onClick={() => setCartCategoryFilter(status)}
                className={`min-h-[44px] px-3.5 rounded-xl text-xs font-semibold transition active:scale-95 cursor-pointer ${
                  isSelected
                    ? 'bg-white/10 text-white border border-white/20'
                    : 'text-[#9CA3AF] hover:text-white'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* PROGRESSIVE DISCLOSURE: Eingabeformular für Einkaufswagen */}
      {isAddingCart && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newCartTitle.trim()) return;
            const targetProjectId =
              cartProjectFilter !== 'ALL' ? cartProjectFilter : activeProject.id;
            onAddCartItems(targetProjectId, [
              {
                title: newCartTitle.trim(),
                quantity: newCartQty.trim() || '1x',
                price: newCartPrice.trim()
              }
            ]);
            setNewCartTitle('');
            setNewCartQty('1x');
            setNewCartPrice('');
            setIsAddingCart(false);
            onNotify('Artikel zum Einkaufswagen hinzugefügt.');
          }}
          className="p-4 rounded-2xl bg-[#242930] border border-white/10 space-y-3 shadow-inner"
        >
          <input
            type="text"
            autoFocus
            value={newCartTitle}
            onChange={(e) => setNewCartTitle(e.target.value)}
            placeholder="Material / Artikel beschreiben..."
            className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-sm bg-[#1C2026] text-white border border-white/10 placeholder-[#9CA3AF] focus:outline-none focus:border-white/20"
          />
          <div className="flex gap-2">
            <input
              type="text"
              value={newCartQty}
              onChange={(e) => setNewCartQty(e.target.value)}
              placeholder="Menge (z.B. 2x, 50kg)"
              className="w-36 min-h-[44px] px-3.5 py-2.5 rounded-xl text-sm bg-[#1C2026] text-white border border-white/10 placeholder-[#9CA3AF] focus:outline-none focus:border-white/20"
            />
            <input
              type="text"
              value={newCartPrice}
              onChange={(e) => setNewCartPrice(e.target.value)}
              placeholder="Preis (opt., z.B. 45 €)"
              className="flex-1 min-w-0 min-h-[44px] px-3.5 py-2.5 rounded-xl text-sm bg-[#1C2026] text-white border border-white/10 placeholder-[#9CA3AF] focus:outline-none focus:border-white/20"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setIsAddingCart(false);
                setNewCartTitle('');
                setNewCartQty('1x');
                setNewCartPrice('');
              }}
              className="min-h-[44px] px-4 rounded-xl text-xs font-semibold text-[#9CA3AF] hover:text-white transition"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={!newCartTitle.trim()}
              className="min-h-[44px] px-5 rounded-xl text-xs font-bold text-white shadow-md active:scale-95 transition disabled:opacity-40"
              style={{ backgroundColor: themeColors.primary }}
            >
              Speichern
            </button>
          </div>
        </form>
      )}

      {/* Einkaufswagen-Liste */}
      <div className="space-y-2">
        {displayedCart.map((item) => {
          const isProcOpen = !!openProcurements[item.id];
          const isTrayOpen = !!expandedActionCards[item.id];
          const originProject = allProjects.find((p) => p.id === item.originProjectId) || activeProject;
          const projColor =
            (originProject?.customMeta?.customAccentColor as string) ||
            originProject?.accentColor ||
            BRAND_CONFIG.projects[item.originProjectId]?.accentColor ||
            themeColors.primary;
          const formattedPrice = item.price
            ? item.price.includes('€')
              ? item.price
              : `${item.price} €`
            : null;

          return (
            <div
              key={`${item.originProjectId}-${item.id}`}
              id={`item-card-${item.id}`}
              className={`rounded-2xl border transition-all duration-200 overflow-hidden shadow-sm ${
                item.completed ? 'opacity-70' : ''
              }`}
              style={{
                backgroundColor: '#242930',
                borderColor: 'rgba(255,255,255,0.05)',
                borderLeft: `3px solid ${projColor}`
              }}
            >
              {/* Karten-Ruhezustand */}
              <div className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {/* Große Touch-Fläche (>= 44px) für Checkbox */}
                  <button
                    type="button"
                    onClick={() => {
                      triggerHapticFeedback(15);
                      onToggleCartItem(item.originProjectId, item.id);
                    }}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2 shrink-0 cursor-pointer"
                    aria-label={item.completed ? 'Als offen markieren' : 'Als besorgt markieren'}
                  >
                    <div
                      className="w-5 h-5 rounded-md flex items-center justify-center border transition-all active:scale-90"
                      style={{
                        backgroundColor: item.completed
                          ? `${themeColors.primary}33`
                          : 'rgba(28,32,38,0.8)',
                        borderColor: item.completed ? themeColors.highlight : '#6B7280'
                      }}
                    >
                      {item.completed && (
                        <Check className="w-3.5 h-3.5 text-white stroke-[2.5]" />
                      )}
                    </div>
                  </button>

                  {/* Titel & Metadaten (Kein Durchstreichen für Maße/Mengen!) */}
                  <div
                    onClick={() => toggleActionCard(item.id)}
                    className="flex-1 min-w-0 cursor-pointer select-none"
                  >
                    <span
                      className={`text-base font-semibold leading-snug block break-words ${
                        item.completed ? 'text-white/70' : 'text-white'
                      }`}
                    >
                      {item.title}
                    </span>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span
                        className="text-xs font-semibold"
                        style={{ color: themeColors.highlight }}
                      >
                        Menge: {item.quantity}
                      </span>

                      {formattedPrice && (
                        <span className="text-xs font-mono font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                          {formattedPrice}
                        </span>
                      )}

                      {item.aiTouched && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-red-300 bg-red-500/20 px-2 py-0.5 rounded-md border border-red-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                          KI-Artikel
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Konsolidierter ••• Trigger */}
                <button
                  type="button"
                  onClick={() => toggleActionCard(item.id)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2 rounded-xl text-[#9CA3AF] hover:text-white hover:bg-white/5 active:scale-95 transition cursor-pointer shrink-0"
                  aria-label="Aktionsmenü öffnen"
                >
                  <MoreHorizontal className="w-5 h-5" />
                </button>
              </div>

              {/* Ausklappbare Aktionsleiste */}
              {isTrayOpen && (
                <div className="px-4 pb-4 pt-3 border-t border-white/5 space-y-2.5 bg-[#1C2026]/80 animate-fadeIn">
                  {/* Inline-Bearbeitung für den Artikel */}
                  {editingCartId === item.id ? (
                    <div className="p-3 rounded-2xl bg-[#242930] border border-white/10 space-y-2.5">
                      <div className="text-xs font-bold text-white">Artikel bearbeiten</div>
                      <input
                        type="text"
                        value={editCartTitle}
                        onChange={(e) => setEditCartTitle(e.target.value)}
                        className="w-full min-h-[44px] px-3.5 py-2 rounded-xl text-sm bg-[#1C2026] text-white border border-white/10 focus:outline-none focus:border-[#14B8A6]"
                      />
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editCartQty}
                          onChange={(e) => setEditCartQty(e.target.value)}
                          placeholder="Menge (z. B. 2x)"
                          className="w-36 min-h-[44px] px-3.5 py-2 rounded-xl text-xs bg-[#1C2026] text-white border border-white/10 focus:outline-none focus:border-[#14B8A6]"
                        />
                        <input
                          type="text"
                          value={editCartPrice}
                          onChange={(e) => setEditCartPrice(e.target.value)}
                          placeholder="Preis (opt., z. B. 25 €)"
                          className="flex-1 min-w-0 min-h-[44px] px-3.5 py-2 rounded-xl text-xs bg-[#1C2026] text-white border border-white/10 focus:outline-none focus:border-[#14B8A6]"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setEditingCartId(null)}
                          className="min-h-[44px] px-4 rounded-xl text-xs font-semibold text-[#9CA3AF] hover:text-white"
                        >
                          Abbrechen
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!editCartTitle.trim()) return;
                            onUpdateCartItem?.(item.originProjectId, item.id, {
                              title: editCartTitle.trim(),
                              quantity: editCartQty.trim() || '1x',
                              price: editCartPrice.trim()
                            });
                            setEditingCartId(null);
                            onNotify('Artikel aktualisiert.');
                          }}
                          className="min-h-[44px] px-4 rounded-xl text-xs font-bold text-white shadow-md active:scale-95 transition"
                          style={{ backgroundColor: themeColors.primary }}
                        >
                          Speichern
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {item.aiTouched && (
                    <button
                      type="button"
                      onClick={() => {
                        onConfirmRedDot(item.originProjectId, 'cart', item.id);
                        toggleActionCard(item.id);
                      }}
                      className="w-full min-h-[44px] px-4 rounded-xl text-xs font-bold bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/30 flex items-center justify-center gap-2 active:scale-95 transition"
                    >
                      <span className="w-2 h-2 rounded-full bg-red-400" />
                      <span>KI-Änderung bestätigen</span>
                    </button>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Artikel bearbeiten */}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCartId(item.id);
                        setEditCartTitle(item.title);
                        setEditCartQty(item.quantity || '1x');
                        setEditCartPrice(item.price || '');
                      }}
                      className="min-h-[44px] px-3.5 rounded-xl text-xs font-semibold bg-[#242930] hover:bg-[#2A3038] text-white hover:text-[#14B8A6] border border-white/5 flex items-center justify-center gap-2 active:scale-95 transition"
                    >
                      <Edit3 className="w-4 h-4 text-[#14B8A6]" />
                      <span>Bearbeiten</span>
                    </button>

                    {/* Beschaffungs-Check / Preisvergleich: Nur wenn unvollständig */}
                    {!item.completed && (
                      <button
                        type="button"
                        onClick={() =>
                          setOpenProcurements((p) => ({
                            ...p,
                            [item.id]: !p[item.id]
                          }))
                        }
                        className={`flex-1 min-w-0 min-h-[44px] px-3.5 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 active:scale-95 transition ${
                          isProcOpen
                            ? 'text-white border-white/30'
                            : 'bg-[#242930] hover:bg-[#2A3038] text-white border-white/5'
                        }`}
                        style={
                          isProcOpen ? { backgroundColor: themeColors.primary } : {}
                        }
                      >
                        <Scale className="w-4 h-4 text-[#14B8A6]" />
                        <span>{isProcOpen ? 'Vergleich schließen' : 'Beschaffungs-Check'}</span>
                      </button>
                    )}

                    {/* Löschen */}
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteCartItem(item.originProjectId, item.id);
                        onNotify('Artikel entfernt.');
                      }}
                      className="min-h-[44px] px-4 rounded-xl text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 flex items-center justify-center gap-2 active:scale-95 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Löschen</span>
                    </button>
                  </div>

                  {/* In anderes Projekt verschieben */}
                  {allProjects.filter((p) => !p.archived && p.id !== item.originProjectId).length > 0 && (
                    <div className="pt-1.5 border-t border-white/5">
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) {
                            onMoveCartItem?.(item.originProjectId, e.target.value, item.id);
                            toggleActionCard(item.id);
                          }
                        }}
                        className="w-full min-h-[44px] px-3.5 py-2 rounded-xl text-xs bg-[#181A1B] text-white border border-white/10 focus:outline-none focus:border-[#14B8A6] cursor-pointer"
                      >
                        <option value="" disabled>
                          In anderes Projekt verschieben...
                        </option>
                        {allProjects
                          .filter((p) => !p.archived && p.id !== item.originProjectId)
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              Verschieben nach: {p.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Beschaffungs-Check Panel */}
              {isProcOpen && (
                <div className="border-t border-white/5 bg-[#1C2026]">
                  <ProcurementCheckPanel
                    title={item.title}
                    customCheck={item.procurementCheck}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* BEREICHS-EINSTELLUNGEN */}
      <div className="pt-2 border-t border-white/5">
        <button
          type="button"
          onClick={() => onOpenSettings?.()}
          className="w-full min-h-[44px] py-2.5 px-4 rounded-xl text-xs font-semibold text-[#9CA3AF] hover:text-white bg-[#242930]/60 hover:bg-[#242930] border border-white/5 flex items-center justify-center gap-2 active:scale-95 transition cursor-pointer"
        >
          <Settings className="w-4 h-4 text-[#14B8A6]" />
          <span>Einkauf-Einstellungen &amp; Beschaffung</span>
        </button>
      </div>
    </section>
  );
};
