import React, { useState } from 'react';
import { Maximize2, Minus, ShoppingCart, X } from 'lucide-react';
import { CartItem, Project } from '../../types';
import { ThemeColors } from './FrontHeader';
import { CartView } from './CartView';

export interface FloatingCartOverlayProps {
  open: boolean;
  onClose: () => void;
  onSwitchToFullScreen: () => void;
  activeProject: Project;
  allProjects: Project[];
  themeColors: ThemeColors;
  highlightedItemId?: string | null;
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
  onRegisterUndo?: (action: { message: string; undo: () => void }) => void;
  onConfigMissing?: (msg: string) => void;
}

export const FloatingCartOverlay: React.FC<FloatingCartOverlayProps> = ({
  open,
  onClose,
  onSwitchToFullScreen,
  activeProject,
  allProjects,
  themeColors,
  highlightedItemId,
  onToggleCartItem,
  onDeleteCartItem,
  onAddCartItems,
  onUpdateCartItem,
  onMoveCartItem,
  onConfirmRedDot,
  onOpenSettings,
  onNotify,
  onRegisterUndo,
  onConfigMissing
}) => {
  const [isParkedAsPill, setIsParkedAsPill] = useState(false);
  const [localSearch] = useState('');

  if (!open) return null;

  const openCount = (allProjects.length > 0 ? allProjects : [activeProject])
    .filter((p) => !p.archived)
    .flatMap((p) => p.cart || [])
    .filter((c) => !c.completed).length;

  if (isParkedAsPill) {
    return (
      <div className="fixed top-14 right-3 z-[45] pointer-events-auto animate-fadeIn">
        <button
          type="button"
          onClick={() => setIsParkedAsPill(false)}
          className="min-h-[44px] px-3.5 py-2 rounded-full border shadow-2xl flex items-center gap-2 active:scale-95 transition cursor-pointer select-none"
          style={{
            backgroundColor: '#191C22',
            borderColor: `${themeColors.highlight}55`,
            boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 12px ${themeColors.glow}`
          }}
          aria-label="Einkaufswagen Pill wiederherstellen"
        >
          <ShoppingCart className="w-4 h-4" style={{ color: themeColors.highlight }} />
          <span className="text-xs font-bold text-white font-mono">
            🛒 {openCount} offen
          </span>
        </button>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Schwebender Einkaufswagen"
      className="fixed inset-0 z-[45] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-[2px]"
    >
      {/* Klick außerhalb schließt */}
      <div
        className="absolute inset-0 cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="relative w-full max-w-[480px] h-[75vh] max-h-[660px] rounded-[26px] border border-white/10 shadow-2xl flex flex-col overflow-hidden animate-fadeIn"
        style={{
          backgroundColor: 'rgba(25, 28, 34, 0.94)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(255, 255, 255, 0.03)'
        }}
      >
        {/* Kopfzeile mit 3 ruhigen Kontrollen (44×44 px) */}
        <div className="p-3 border-b border-white/10 flex items-center justify-between gap-2 shrink-0 bg-[#14171D]/80">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border"
              style={{
                backgroundColor: `${themeColors.primary}22`,
                borderColor: `${themeColors.highlight}44`
              }}
            >
              <ShoppingCart className="w-4 h-4" style={{ color: themeColors.highlight }} />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-extrabold uppercase tracking-wider text-white truncate">
                Einkauf (Schwebend)
              </div>
              <div className="text-[11px] text-[#94A3B8] truncate">
                {activeProject.name}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* 1. — (Minimieren/Parken als Pill) */}
            <button
              type="button"
              onClick={() => setIsParkedAsPill(true)}
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-[#242930] hover:bg-[#2A3038] text-[#9CA3AF] hover:text-white border border-white/5 flex items-center justify-center active:scale-95 transition cursor-pointer"
              title="Als Pill parken"
              aria-label="Einkaufswagen minimieren"
            >
              <Minus className="w-4 h-4" />
            </button>

            {/* 2. ⤢ (Vollbild umschalten) */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onSwitchToFullScreen();
              }}
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-[#242930] hover:bg-[#2A3038] text-[#9CA3AF] hover:text-white border border-white/5 flex items-center justify-center active:scale-95 transition cursor-pointer"
              title="In Vollbild öffnen"
              aria-label="Einkaufswagen Vollbild"
            >
              <Maximize2 className="w-4 h-4" />
            </button>

            {/* 3. ✕ (Schließen) */}
            <button
              type="button"
              onClick={onClose}
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-[#242930] hover:bg-[#2A3038] text-[#9CA3AF] hover:text-white border border-white/5 flex items-center justify-center active:scale-95 transition cursor-pointer"
              title="Schließen"
              aria-label="Einkaufswagen schließen"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Inhalt: Reale CartView ohne Duplikation */}
        <div className="flex-1 overflow-y-auto p-3">
          <CartView
            activeProject={activeProject}
            allProjects={allProjects}
            themeColors={themeColors}
            searchQuery={localSearch}
            highlightedItemId={highlightedItemId || null}
            onToggleCartItem={onToggleCartItem}
            onDeleteCartItem={onDeleteCartItem}
            onAddCartItems={onAddCartItems}
            onUpdateCartItem={onUpdateCartItem}
            onMoveCartItem={onMoveCartItem}
            onConfirmRedDot={onConfirmRedDot}
            onOpenSettings={onOpenSettings}
            onNotify={onNotify}
            onRegisterUndo={onRegisterUndo}
            onConfigMissing={onConfigMissing}
          />
        </div>
      </div>
    </div>
  );
};
