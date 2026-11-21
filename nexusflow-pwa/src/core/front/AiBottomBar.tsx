import React from 'react';
import { Mic, Scale, Send } from 'lucide-react';

interface AiBottomBarProps {
  bottomAiText: string;
  onSetBottomAiText: (text: string) => void;
  onSubmit: (e?: React.FormEvent) => void;
  onOpenDeepResearch: () => void;
  onOpenVoice: () => void;
  activeVisualTheme: {
    primary: string;
    highlight: string;
    glow: string;
  };
}

export const AiBottomBar: React.FC<AiBottomBarProps> = ({
  bottomAiText,
  onSetBottomAiText,
  onSubmit,
  onOpenDeepResearch,
  onOpenVoice,
  activeVisualTheme
}) => {
  return (
    <div className="fixed bottom-3 inset-x-0 z-40 pointer-events-none">
      <div className="max-w-[440px] mx-auto px-3">
        <form
          onSubmit={onSubmit}
          className="pointer-events-auto rounded-3xl border border-white/10 p-1.5 shadow-2xl flex items-center gap-1.5"
          style={{ backgroundColor: '#1C2026' }}
        >
          <div className="flex-1 relative flex items-center min-h-[44px]">
            <input
              type="text"
              value={bottomAiText}
              onChange={(e) => onSetBottomAiText(e.target.value)}
              placeholder="Frag mich oder sprich…"
              className="w-full min-h-[44px] pl-3.5 pr-2 py-2 rounded-2xl bg-[#242930] text-xs text-white placeholder-[#9CA3AF] border border-white/5 focus:outline-none focus:border-[#14B8A6]/60 transition"
            />
          </div>

          <button
            type="button"
            onClick={onOpenDeepResearch}
            aria-label="Deep Research &amp; Cloud"
            title="Deep Research, Scanner &amp; Cloud"
            className="min-h-[44px] min-w-[44px] w-11 h-11 rounded-2xl bg-[#242930] hover:bg-[#2A3038] text-[#14B8A6] hover:text-white border border-white/5 flex items-center justify-center shrink-0 active:scale-95 transition"
          >
            <Scale className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              if (bottomAiText.trim()) {
                onSubmit();
              } else {
                onOpenVoice();
              }
            }}
            aria-label={bottomAiText.trim() ? 'Befehl senden' : 'Sofort sprechen'}
            className="min-h-[44px] min-w-[44px] px-3.5 py-2.5 rounded-2xl text-white font-bold text-xs flex items-center justify-center gap-1.5 shrink-0 active:scale-95 transition shadow-lg"
            style={{
              backgroundColor: activeVisualTheme.primary,
              boxShadow: `0 4px 16px ${activeVisualTheme.glow}`
            }}
          >
            {bottomAiText.trim() ? (
              <>
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Senden</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                <span>Sprechen</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
