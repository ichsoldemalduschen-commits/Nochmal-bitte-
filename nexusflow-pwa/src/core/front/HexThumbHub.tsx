import React, { useEffect, useRef, useState } from 'react';
import { Mic, Scale, Send, Eye, Settings, X } from 'lucide-react';
import { Project, ProjectTabId } from '../../types';

export interface HexThumbHubProps {
  position?: 'left' | 'center' | 'right';
  activeProject?: Project;
  domainProjects: Project[];
  allProjects?: Project[];
  activeTab: ProjectTabId;
  onSelectProject: (id: string) => void;
  onChangeTab: (tab: ProjectTabId) => void;
  onOpenVoice: (latchMode?: boolean) => void;
  onOpenDeepResearch: () => void;
  onOpenSingleFocus: (taskId?: string) => void;
  onOpenZentrale: () => void;
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
  bottomAiText,
  onSetBottomAiText,
  onSubmitBottomAi,
  themeColors
}) => {
  const [isFanOpen, setIsFanOpen] = useState(false);
  const [isScrolledDown, setIsScrolledDown] = useState(false);
  const [isBreathing, setIsBreathing] = useState(false);

  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didHoldRef = useRef(false);
  const lastScrollYRef = useRef(0);

  // Scroll-Erkennung: Bei Nach-unten-Scrollen leicht kompakter/transparenter werden
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

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only primary button
    if (e.button !== 0) return;
    setIsScrolledDown(false);
    didHoldRef.current = false;

    holdTimerRef.current = setTimeout(() => {
      didHoldRef.current = true;
      try {
        navigator.vibrate?.(20);
      } catch {
        // ignore
      }
      setIsBreathing(true);
      setTimeout(() => setIsBreathing(false), 600);
      onOpenVoice(true); // Direkt Sprechen im Einrast-Modus
    }, 350);
  };

  const handlePointerUp = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (!didHoldRef.current) {
      // Kurzer Tipp -> Fächer umschalten
      try {
        navigator.vibrate?.(15);
      } catch {
        // ignore
      }
      setIsFanOpen((prev) => !prev);
    }
    didHoldRef.current = false;
  };

  const handlePointerCancel = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    didHoldRef.current = false;
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

  // Tabs mit deutschen Labels
  const tabDefs: Array<{ id: ProjectTabId; label: string }> = [
    { id: 'tasks', label: 'Aufgaben' },
    { id: 'cart', label: 'Einkauf' },
    { id: 'knowledge', label: 'Wissen' },
    ...(enabledTabs.includes('extras') ? [{ id: 'extras' as ProjectTabId, label: 'Extras' }] : [])
  ];

  return (
    <>
      {/* ── Backdrop-Blur bei geöffnetem Fächer (kein Blur auf scrollende Listen-Karten) ── */}
      {isFanOpen && (
        <div
          className="fixed inset-0 bg-[#0B0D11]/80 backdrop-blur-md z-40 transition-opacity duration-240 cursor-pointer"
          style={{ transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)' }}
          onClick={() => setIsFanOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Ergonomischer Daumen-Fächer (Kompakt über dem Sechseck) ── */}
      {isFanOpen && (
        <div
          role="region"
          aria-label="Daumen-Fächer"
          className={`fixed z-40 bottom-[max(5.5rem,calc(env(safe-area-inset-bottom)+4.5rem))] ${fanAlignmentClasses} w-[calc(100vw-2rem)] max-w-[360px] animate-fadeIn`}
          style={{ transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)' }}
        >
          <div
            className="w-full rounded-3xl border border-white/10 p-3.5 shadow-2xl space-y-3"
            style={{
              backgroundColor: '#191C22',
              boxShadow: '0 12px 40px rgba(0,0,0,0.7), 0 0 20px rgba(255,255,255,0.03)'
            }}
          >
            {/* 1. Sprechen-Direktknopf */}
            <button
              type="button"
              onClick={() => {
                setIsFanOpen(false);
                onOpenVoice(false);
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

            {/* 4. Werkzeuge: 1-Fokus, Vorschriften-Wächter (wenn legalWatchEnabled), Zentrale */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] px-0.5">
                Werkzeuge
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setIsFanOpen(false);
                    onOpenSingleFocus();
                  }}
                  className="flex-1 min-h-[44px] min-w-[90px] px-3 py-2 rounded-xl text-xs font-semibold bg-[#111317] hover:bg-[#22262F] text-[#F1F5F9] border border-white/5 flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
                  title="1-Fokus-Modus öffnen"
                >
                  <Eye className="w-4 h-4 text-[#14B8A6] shrink-0" />
                  <span>1-Fokus</span>
                </button>

                {/* Vorschriften-Wächter (⚖️) – NUR gerendert wenn legalWatchEnabled beim aktuellen Projekt aktiv ist */}
                {activeProject?.legalWatchEnabled !== false && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsFanOpen(false);
                      onOpenDeepResearch();
                    }}
                    className="flex-1 min-h-[44px] min-w-[90px] px-3 py-2 rounded-xl text-xs font-semibold bg-[#111317] hover:bg-[#22262F] text-[#F1F5F9] border border-white/5 flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
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
                  className="flex-1 min-h-[44px] min-w-[90px] px-3 py-2 rounded-xl text-xs font-semibold bg-[#111317] hover:bg-[#22262F] text-[#F1F5F9] border border-white/5 flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
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

      {/* ── Matt-dunkles Sechseck (~64×64 px) im unteren Daumenbogen ── */}
      <div
        className={`fixed z-40 bottom-[max(1rem,env(safe-area-inset-bottom))] ${positionClasses} pointer-events-auto`}
      >
        <button
          type="button"
          aria-label="Daumen-Steuerung"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          className={`w-16 h-16 min-w-[64px] min-h-[64px] rounded-2xl flex items-center justify-center relative cursor-pointer select-none touch-manipulation active:scale-95 ${
            isScrolledDown && !isFanOpen ? 'scale-90 opacity-80' : 'scale-100 opacity-100'
          } ${isBreathing ? 'animate-pulse' : ''} transition-all duration-300`}
          style={{
            filter: `drop-shadow(0 4px 14px ${isFanOpen ? themeColors.primary : themeColors.glow})`
          }}
        >
          {/* Klares SVG-Hexagon mit sanft abgerundeten Ecken */}
          <svg
            width="64"
            height="64"
            viewBox="0 0 64 64"
            className="absolute inset-0 w-full h-full pointer-events-none"
          >
            <path
              d="M32 5 L56 18.85 L56 45.15 L32 59 L8 45.15 L8 18.85 Z"
              fill="#191C22"
              stroke={isFanOpen ? themeColors.highlight : `${themeColors.primary}99`}
              strokeWidth="2"
              strokeLinejoin="round"
            />
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
