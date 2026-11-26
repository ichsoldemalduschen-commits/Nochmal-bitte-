import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { DESIGN_TOKENS } from '../../config/designTokens';

interface ZentraleAccordionProps {
  number: number | string;
  title: string;
  subtitle?: string;
  statusText?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

/**
 * Einheitliche Akkordeon-Karte für die 5 Überbereiche der BANDIT.OS Zentrale.
 */
export const ZentraleAccordion: React.FC<ZentraleAccordionProps> = ({
  number,
  title,
  subtitle,
  statusText,
  icon,
  badge,
  isOpen,
  onToggle,
  children
}) => (
  <div
    className="rounded-3xl border overflow-hidden shadow-md"
    style={{
      backgroundColor: DESIGN_TOKENS.surface,
      borderColor: DESIGN_TOKENS.borderSubtle
    }}
  >
    <button
      type="button"
      aria-expanded={isOpen}
      onClick={onToggle}
      className="w-full min-h-[56px] p-4 flex items-center justify-between gap-2 text-left active:bg-white/5 transition cursor-pointer"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {icon && <span className="shrink-0">{icon}</span>}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-[#F1F5F9] flex items-center gap-2 flex-wrap">
            <span className="break-words">
              {number}. {title}
            </span>
            {badge}
          </div>
          {subtitle && (
            <div className="text-xs text-[#94A3B8] leading-snug break-words">{subtitle}</div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-1">
        {statusText && (
          <span className="text-xs font-mono text-[#94A3B8]">{statusText}</span>
        )}
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-[#94A3B8]" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[#94A3B8]" />
        )}
      </div>
    </button>

    {isOpen && (
      <div className="px-4 pb-4 pt-2 border-t border-white/5 space-y-4 bg-[#191C22]/70">
        {children}
      </div>
    )}
  </div>
);

interface ZentraleToggleRowProps {
  title: string;
  description?: string;
  checked: boolean;
  onToggle: () => void;
  onLabel?: string;
  offLabel?: string;
  tone?: 'petrol' | 'honey';
  icon?: React.ReactNode;
  ariaLabel?: string;
  testId?: string;
  containerClassName?: string;
}

/**
 * Einheitliche Ein/Aus-Schalter-Zeile mit >= 44 px Touch-Fläche und 390-px-Flex-Wrap-Hygiene.
 */
export const ZentraleToggleRow: React.FC<ZentraleToggleRowProps> = ({
  title,
  description,
  checked,
  onToggle,
  onLabel = 'An',
  offLabel = 'Aus',
  tone = 'petrol',
  icon,
  ariaLabel,
  testId,
  containerClassName = 'p-3.5 rounded-2xl bg-[#242930] border border-white/5'
}) => {
  const activeBg =
    tone === 'honey' ? DESIGN_TOKENS.accentHoney : DESIGN_TOKENS.projectPresets.pizzaBandit;
  const activeText = tone === 'honey' ? '#111317' : '#F1F5F9';

  return (
    <div className={`${containerClassName} flex items-center justify-between gap-3 flex-wrap`}>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-bold text-[#F1F5F9] flex items-center gap-2">
          {icon}
          <span className="break-words">{title}</span>
        </div>
        {description && (
          <div className="text-xs text-[#94A3B8] leading-snug break-words mt-0.5">
            {description}
          </div>
        )}
      </div>
      <button
        type="button"
        aria-label={ariaLabel || title}
        data-testid={testId}
        onClick={onToggle}
        className="min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs font-bold border transition shrink-0 active:scale-95 cursor-pointer"
        style={{
          backgroundColor: checked ? activeBg : '#181A1B',
          color: checked ? activeText : DESIGN_TOKENS.textMeta,
          borderColor: checked
            ? tone === 'honey'
              ? 'rgba(229,169,60,0.6)'
              : '#14B8A6'
            : 'rgba(255,255,255,0.1)'
        }}
      >
        {checked ? onLabel : offLabel}
      </button>
    </div>
  );
};

/**
 * Immer sichtbare Fußzeile der Zentrale mit Build-Stempel und Reload-Aktion.
 */
export const ZentraleFooter: React.FC = () => {
  const buildTimestamp =
    typeof __BUILD_TIMESTAMP__ !== 'undefined' ? __BUILD_TIMESTAMP__ : 'dev';
  const buildCommit =
    typeof __BUILD_COMMIT__ !== 'undefined' ? __BUILD_COMMIT__ : 'local';

  const handleReload = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .getRegistration()
        .then((reg) => {
          if (reg) {
            reg
              .update()
              .then(() => window.location.reload())
              .catch(() => window.location.reload());
          } else {
            window.location.reload();
          }
        })
        .catch(() => window.location.reload());
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="mt-6 px-4 pb-4 flex items-center justify-between gap-3 flex-wrap">
      <span className="text-xs text-[#94A3B8]/70 font-mono min-w-0 flex-1 break-all">
        Build {buildTimestamp} · {buildCommit}
      </span>
      <button
        type="button"
        onClick={handleReload}
        className="min-h-[44px] px-3.5 rounded-xl text-xs font-semibold text-[#94A3B8] hover:text-white bg-[#242930] hover:bg-[#2A3038] border border-white/5 active:scale-95 transition shrink-0 cursor-pointer"
      >
        Neu laden
      </button>
    </div>
  );
};
