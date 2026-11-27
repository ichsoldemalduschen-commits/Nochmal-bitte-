import React, { useState } from 'react';
import { ChevronDown, ChevronUp, History } from 'lucide-react';
import { ChangeLogEntry } from '../../types';
import { DESIGN_TOKENS } from '../../config/designTokens';

interface ChangeLogAccordionProps {
  itemId: string;
  entries?: ChangeLogEntry[];
}

function formatChangeLogTimestamp(isoOrRaw: string): string {
  const parsed = Date.parse(isoOrRaw);
  if (!Number.isFinite(parsed)) {
    return isoOrRaw;
  }
  const d = new Date(parsed);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}.${mm}. ${hh}:${min}`;
}

/**
 * Ruhige, standardmäßig zugeklappte Änderungs-Chronologie (max. 10 Einträge) für Tasks & Wissen.
 */
export const ChangeLogAccordion: React.FC<ChangeLogAccordionProps> = ({ itemId, entries }) => {
  const [open, setOpen] = useState(false);

  if (!Array.isArray(entries) || entries.length === 0) {
    return null;
  }

  const newestFirst = [...entries].reverse();

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{
        backgroundColor: DESIGN_TOKENS.surface,
        borderColor: DESIGN_TOKENS.borderSubtle
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        data-testid={`changelog-toggle-${itemId}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="w-full min-h-[44px] px-3 py-2 flex items-center justify-between gap-2 text-left active:bg-white/5 transition cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          <History className="w-4 h-4 text-[#94A3B8] shrink-0" />
          <span className="text-xs font-semibold text-[#94A3B8]">
            Chronologie ({entries.length})
          </span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-[#94A3B8] shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[#94A3B8] shrink-0" />
        )}
      </button>

      {open && (
        <div
          data-testid={`changelog-list-${itemId}`}
          className="px-3 pb-3 pt-2 border-t border-white/5 space-y-1.5"
        >
          {newestFirst.map((entry, idx) => {
            const isAi = entry.actor === 'ai';
            return (
              <div
                key={`${entry.at}-${idx}`}
                className="flex items-start justify-between gap-2 text-xs leading-snug"
              >
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <span
                    className={`px-1.5 py-0.5 rounded font-semibold shrink-0 ${
                      isAi
                        ? 'text-[#E5A93C] bg-[#E5A93C]/10 border border-[#E5A93C]/25'
                        : 'text-[#14B8A6] bg-[#14B8A6]/10 border border-[#14B8A6]/25'
                    }`}
                  >
                    {isAi ? 'KI' : 'Du'}
                  </span>
                  <span className="text-[#F1F5F9] break-words min-w-0">{entry.summary}</span>
                </div>
                <span className="text-xs font-mono text-[#94A3B8] shrink-0">
                  {formatChangeLogTimestamp(entry.at)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
