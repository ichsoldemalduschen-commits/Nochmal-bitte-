import React, { useEffect, useRef, useState } from 'react';
import { Eye, LayoutGrid, Mic, Scale, Send, Settings, ShoppingCart, X } from 'lucide-react';
import { Project, ProjectTabId } from '../../types';

export interface HexThumbHubProps {
  position?: 'left' | 'center' | 'right';
  activeProject?: Project;
  domainProjects: Project[];
  allProjects?: Project[];
  activeTab: ProjectTabId;
  onSelectProject: (id: string) => void;
  onChangeTab: (tab: ProjectTabId) => void;
  onOpenVoice: (stage?: 1 | 2, latchMode?: boolean) => void;
  onOpenDeepResearch: () => void;
  onOpenSingleFocus: (taskId?: string) => void;
  onOpenZentrale: () => void;
  onOpenFloatingCart?: () => void;
  isCompanionActive?: boolean;
  isFloatingCartOpen?: boolean;
  isFanOpen?: boolean;
  onToggleFan?: (open: boolean) => void;
  bottomAiText: string;
  onSetBottomAiText: (text: string) => void;
  onSubmitBottomAi: (e?: React.FormEvent) => void;
  themeColors: {
    primary: string;
    highlight: string;
    glow: string;
  };
}

export const HexThumbHub: React.FC<HexThumbHubProps> = ({
  position = 'center',
  activeProject,
  domainProjects,
  allProjects = [],
  activeTab,
  onSelectProject,
  onChangeTab,
  onOpenVoice,
  onOpenDeepResearch,
  onOpenSingleFocus,
  onOpenZentrale,
  onOpenFloatingCart,
  isCompanionActive = false,
  isFloatingCartOpen = false,
  isFanOpen: controlledFanOpen,
  onToggleFan,
  bottomAiText,
  onSetBottomAiText,
  onSubmitBottomAi,
  themeColors
}) => {
  const [internalFanOpen, setInternalFanOpen] = useState(false);
  const isFanOpen = controlledFanOpen !== undefined ? controlledFanOpen : internalFanOpen;
  const setIsFanOpen = (open: boolean) => {
    if (onToggleFan) {
      onToggleFan(open);
    } else {
      setInternalFanOpen(open);
    }
  };
  const [isScrolledDown, setIsScrolledDown] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [pulseRings, setPulseRings] = useState<number[]>([]);

  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const didTriggerGestureRef = useRef(false);
  const lastScrollYRef = useRef(0);

  // Scroll-Erkennung: Bei Nach-unten-Scrollen dezent kompakter
  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      if (currentY > lastScrollYRef.current + 12 && currentY > 60) {
        setIsScrolledDown(true);
      } else if (currentY < lastScrollYRef.current - 10 || currentY <= 20) {
        setIsScrolledDown(false);
      }
      lastScrollYRef.current = currentY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const clearHoldState = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    setHoldProgress(0);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    setIsScrolledDown(false);
    didTriggerGestureRef.current = false;
    pointerStartRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };

    clearHoldState();

    // Fortschritt der Honig-Gold Ladekontur über 320ms berechnen
    const startTime = Date.now();
    holdIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, (elapsed / 320) * 100);
      setHoldProgress(progress);
    }, 20);

    // 320ms Halte-Timer -> Schnellauswahl-Kontextmenü öffnen
    holdTimerRef.current = setTimeout(() => {
      didTriggerGestureRef.current = true;
      clearHoldState();
      try {
        navigator.vibrate?.(20);
      } catch {
        // ignore
      }
      setIsFanOpen(true);
    }, 320);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!pointerStartRef.current || didTriggerGestureRef.current) return;
    const deltaY = pointerStartRef.current.y - e.clientY; // Wisch nach oben
    if (deltaY > 30) {
      didTriggerGestureRef.current = true;
      clearHoldState();
      try {
        navigator.vibrate?.(20);
      } catch {
        // ignore
      }
      setIsFanOpen(true);
    }
  };

  const handlePointerUp = () => {
    const wasGesture = didTriggerGestureRef.current;
    clearHoldState();

    if (!wasGesture && pointerStartRef.current) {
      if (isFanOpen) {
        setIsFanOpen(false);
      } else {
        // 1× kurzer Tipp -> 0 ms Latenz für die KI (Stufe 1 aufwecken)
        try {
          navigator.vibrate?.(15);
        } catch {
          // ignore
        }
        setPulseRings([Date.now(), Date.now() + 90]);
        setTimeout(() => setPulseRings([]), 500);
        onOpenVoice(1);
      }
    }
    pointerStartRef.current = null;
    didTriggerGestureRef.current = false;
  };

  const handlePointerCancel = () => {
    clearHoldState();
    pointerStartRef.current = null;
    didTriggerGestureRef.current = false;
  };

  // Positionierung nach thumbHubPosition
  const positionClasses = {
    left: 'left-5',
    center: 'left-1/2 -translate-x-1/2',
    right: 'right-5'
  }[position];

  const fanAlignmentClasses = {
    left: 'left-4 items-start',
    center: 'left-1/2 -translate-x-1/2 items-center',
    right: 'right-4 items-end'
  }[position];

  const projectsToDisplay = domainProjects.length > 0 ? domainProjects : allProjects.filter((p) => !p.archived);
  const enabledTabs = activeProject?.enabledTabs || ['tasks', 'cart', 'knowledge', 'extras'];

  const tabDefs: Array<{ id: ProjectTabId; label: string }> = [
    { id: 'tasks', label: 'Aufgaben' },
    { id: 'cart', label: 'Einkauf' },
    { id: 'knowledge', label: 'Wissen' },
    ...(enabledTabs.includes('extras') ? [{ id: 'extras' as ProjectTabId, label: 'Extras' }] : [])
  ];

  return (
    <>
      {/* ── Backdrop-Blur bei geöffneter Schnellauswahl ── */}
      {isFanOpen && (
        <div
          className="fixed inset-0 bg-[#0B0D11]/80 backdrop-blur-md z-40 transition-opacity duration-240 cursor-pointer"
          style={{ transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)' }}
          onClick={() => setIsFanOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Ergonomisches Schnellauswahl-Menü (Daumen-Fächer) ── */}
      {isFanOpen && (
        <div
          role="region"
          aria-label="Daumen-Fächer"
          className={`fixed z-40 bottom-[max(5.8rem,calc(env(safe-area-inset-bottom)+4.8rem))] ${fanAlignmentClasses} w-[calc(100vw-2rem)] max-w-[360px] animate-fadeIn`}
          style={{ transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)' }}
        >
          <div
            className="w-full rounded-3xl border border-white/10 p-3.5 shadow-2xl space-y-3"
            style={{
              backgroundColor: '#191C22',
              boxShadow: '0 12px 40px rgba(0,0,0,0.7), 0 0 20px rgba(255,255,255,0.03)'
            }}
          >
            {/* 1. Sprechen-Direktknopf (weckt Begleiter in Stufe 1) */}
            <button
              type="button"
              onClick={() => {
                setIsFanOpen(false);
                onOpenVoice(1);
              }}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-2xl text-white font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition shadow-lg cursor-pointer"
              style={{
                backgroundColor: themeColors.primary,
                boxShadow: `0 4px 16px ${themeColors.glow}`
              }}
              aria-label="Sofort sprechen"
            >
              <Mic className="w-4 h-4 text-white" />
              <span>Sofort sprechen (Zuhör-Modus)</span>
            </button>

            {/* 2. Projektwechsel */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] px-0.5">
                Projekte
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
                {projectsToDisplay.map((p) => {
                  const isActive = p.id === activeProject?.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        onSelectProject(p.id);
                        setIsFanOpen(false);
                      }}
                      className={`min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 border transition shrink-0 active:scale-95 cursor-pointer ${
                        isActive
                          ? 'bg-white/10 text-white border-white/30'
                          : 'bg-[#111317] text-[#94A3B8] border-white/5 hover:text-white'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: p.accentColor || themeColors.primary }}
                      />
                      <span className="truncate max-w-[130px]">{p.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Bereichswechsel */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] px-0.5">
                Bereiche
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {tabDefs.slice(0, 3).map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        onChangeTab(tab.id);
                        setIsFanOpen(false);
                      }}
                      className={`min-h-[44px] px-2 py-1.5 rounded-xl text-xs font-bold border flex items-center justify-center transition active:scale-95 cursor-pointer ${
                        isActive
                          ? 'text-white border-white/30'
                          : 'bg-[#111317] text-[#94A3B8] border-white/5 hover:text-white'
                      }`}
                      style={isActive ? { backgroundColor: themeColors.primary } : {}}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
              {tabDefs.length > 3 && (
                <div className="pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      onChangeTab('extras');
                      setIsFanOpen(false);
                    }}
                    className={`w-full min-h-[44px] px-2 py-1.5 rounded-xl text-xs font-bold border flex items-center justify-center transition active:scale-95 cursor-pointer ${
                      activeTab === 'extras'
                        ? 'text-white border-white/30'
                        : 'bg-[#111317] text-[#94A3B8] border-white/5 hover:text-white'
                    }`}
                    style={activeTab === 'extras' ? { backgroundColor: themeColors.primary } : {}}
                  >
                    Extras &amp; Plugins
                  </button>
                </div>
              )}
            </div>

            {/* 4. Werkzeuge: 1-Fokus, Einkauf (Schwebend), Vorschriften-Wächter (wenn legalWatchEnabled), Zentrale */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] px-0.5">
                Werkzeuge
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsFanOpen(false);
                    onOpenSingleFocus();
                  }}
                  className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold bg-[#111317] hover:bg-[#22262F] text-[#F1F5F9] border border-white/5 flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
                  title="1-Fokus-Modus öffnen"
                >
                  <Eye className="w-4 h-4 text-[#14B8A6] shrink-0" />
                  <span>1-Fokus</span>
                </button>

                {/* Neuer Schnell-Einstieg: Einkauf (Schwebend) */}
                <button
                  type="button"
                  onClick={() => {
                    setIsFanOpen(false);
                    if (onOpenFloatingCart) {
                      onOpenFloatingCart();
                    } else {
                      onChangeTab('cart');
                    }
                  }}
                  className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold bg-[#111317] hover:bg-[#22262F] text-[#F1F5F9] border border-white/5 flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
                  title="Einkaufswagen schwebend öffnen"
                >
                  <ShoppingCart className="w-4 h-4 text-[#14B8A6] shrink-0" />
                  <span className="truncate">Einkauf (Schwebend)</span>
                </button>

                {/* Vorschriften-Wächter (⚖️) – NUR sichtbar wenn legalWatchEnabled aktiv ist */}
                {activeProject?.legalWatchEnabled !== false && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsFanOpen(false);
                      onOpenDeepResearch();
                    }}
                    className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold bg-[#111317] hover:bg-[#22262F] text-[#F1F5F9] border border-white/5 flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
                    title="Vorschriften-Wächter &amp; Deep Research"
                  >
                    <Scale className="w-4 h-4 text-[#14B8A6] shrink-0" />
                    <span>Wächter ⚖️</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setIsFanOpen(false);
                    onOpenZentrale();
                  }}
                  className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold bg-[#111317] hover:bg-[#22262F] text-[#F1F5F9] border border-white/5 flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
                  title="Zentrale öffnen"
                >
                  <Settings className="w-4 h-4 text-[#94A3B8] shrink-0" />
                  <span>Zentrale</span>
                </button>
              </div>
            </div>

            {/* 5. „⌨ Kurz tippen…“ (Lautlos-Ausweg) */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!bottomAiText.trim()) return;
                onSubmitBottomAi(e);
                setIsFanOpen(false);
              }}
              className="pt-1.5 border-t border-white/5 flex items-center gap-1.5"
            >
              <input
                type="text"
                value={bottomAiText}
                onChange={(e) => onSetBottomAiText(e.target.value)}
                placeholder="⌨ Kurz tippen…"
                className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl bg-[#111317] text-xs text-white placeholder-[#94A3B8] border border-white/10 focus:outline-none focus:border-[#14B8A6]/60 transition"
              />
              <button
                type="submit"
                disabled={!bottomAiText.trim()}
                className="min-h-[44px] min-w-[44px] px-3 py-2 rounded-xl text-xs font-bold text-white flex items-center justify-center shrink-0 disabled:opacity-35 active:scale-95 transition cursor-pointer"
                style={{ backgroundColor: themeColors.primary }}
                aria-label="Befehl senden"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Stufe 0 – Präsenter Sechseck-Anker (~72×72 px) mit doppelter Kontur ── */}
      <div
        className={`fixed z-40 bottom-[max(1rem,env(safe-area-inset-bottom))] ${positionClasses} pointer-events-auto transition-all duration-300 ${
          isCompanionActive && !isFanOpen
            ? 'opacity-0 pointer-events-none scale-75'
            : isFloatingCartOpen
            ? 'scale-90 opacity-40 pointer-events-none'
            : isScrolledDown && !isFanOpen
            ? 'scale-90 opacity-80'
            : 'scale-100 opacity-100'
        }`}
      >
        <button
          type="button"
          aria-label="Daumen-Steuerung"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          className="w-[72px] h-[72px] min-w-[72px] min-h-[72px] rounded-2xl flex items-center justify-center relative cursor-pointer select-none touch-none active:scale-95 transition-all duration-300 hex-companion-breathing"
          style={
            {
              '--hex-glow': themeColors.glow,
              boxShadow: `0 8px 28px rgba(0,0,0,0.7), 0 0 20px ${themeColors.glow}`
            } as React.CSSProperties
          }
        >
          {/* Konzentrische Klick-Puls-Lichtringe */}
          {pulseRings.map((id, index) => (
            <span
              key={id}
              className="absolute inset-0 rounded-2xl border-2 pointer-events-none hex-pulse-ring-anim"
              style={{
                borderColor: themeColors.highlight,
                animationDelay: `${index * 80}ms`
              }}
            />
          ))}

          {/* SVG-Hexagon mit doppelter Kontur: Außen Projektfarbe, Innen feines Weiß */}
          <svg
            width="72"
            height="72"
            viewBox="0 0 72 72"
            className="absolute inset-0 w-full h-full pointer-events-none"
          >
            {/* Äußerer Rand in Projektfarbe */}
            <path
              d="M36 6 L63 21.6 L63 50.4 L36 66 L9 50.4 L9 21.6 Z"
              fill="#14171D"
              stroke={isFanOpen ? themeColors.highlight : themeColors.primary}
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            {/* Feiner heller Innenrand für Tiefenwirkung */}
            <path
              d="M36 9.5 L60 23.5 L60 48.5 L36 62.5 L12 48.5 L12 23.5 Z"
              fill="none"
              stroke="rgba(255, 255, 255, 0.22)"
              strokeWidth="1"
              strokeLinejoin="round"
            />
            {/* Lade-Kontur in Honig-Gold (#E5A93C) beim Halten */}
            {holdProgress > 0 && (
              <path
                d="M36 6 L63 21.6 L63 50.4 L36 66 L9 50.4 L9 21.6 Z"
                fill="none"
                stroke="#E5A93C"
                strokeWidth="3.5"
                strokeDasharray="210"
                strokeDashoffset={210 - (210 * holdProgress) / 100}
                strokeLinecap="round"
              />
            )}
          </svg>

          {/* Icon im Zentrum */}
          <div className="relative z-10 flex items-center justify-center pointer-events-none">
            {isFanOpen ? (
              <X className="w-6 h-6 text-white stroke-[2.2]" />
            ) : (
              <Mic
                className="w-6 h-6 stroke-[2.2]"
                style={{ color: themeColors.highlight }}
              />
            )}
          </div>
        </button>
      </div>
    </>
  );
};
