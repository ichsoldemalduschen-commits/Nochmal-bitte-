import React, { useState } from 'react';
import { Check, ChevronDown, ChevronUp, Clock, Sparkles, X } from 'lucide-react';
import { DESIGN_TOKENS } from '../../config/designTokens';
import { ForemanProposal } from '../../types';
import { triggerHapticFeedback } from '../../services/storage';

export interface ForemanInboxCardProps {
  proposals: ForemanProposal[];
  onAcceptProposal: (proposal: ForemanProposal) => void;
  onSnoozeProposal: (proposal: ForemanProposal) => void;
  onDismissProposal: (proposal: ForemanProposal) => void;
}

/**
 * Ruhiger Vorarbeiter-Posteingang mit standardmäßig zugeklappter Kopfzeile
 * und Ja / Später / Nein-Freigabekarten in Honig-Gold (#E5A93C).
 * Rendert null, wenn keine offenen Vorschläge vorliegen (100 % leere Bühne).
 */
export const ForemanInboxCard: React.FC<ForemanInboxCardProps> = ({
  proposals,
  onAcceptProposal,
  onSnoozeProposal,
  onDismissProposal
}) => {
  const [expanded, setExpanded] = useState(false);

  if (!proposals || proposals.length === 0) {
    return null;
  }

  const count = proposals.length;
  const headerLabel = count === 1 ? 'Vorschlag zur Freigabe' : 'Vorschläge zur Freigabe';

  return (
    <section
      aria-label="Vorarbeiter-Posteingang"
      data-testid="foreman-inbox-section"
      className="space-y-2.5"
    >
      {/* Schmale, standardmäßig zugeklappte Kopfzeile */}
      <button
        type="button"
        aria-expanded={expanded}
        data-testid="foreman-inbox-header"
        onClick={() => {
          triggerHapticFeedback(10);
          setExpanded((prev) => !prev);
        }}
        className="w-full min-h-[44px] px-3.5 py-2.5 pl-4 rounded-2xl border relative overflow-hidden flex items-center justify-between gap-2 text-left active:bg-white/5 transition cursor-pointer"
        style={{
          backgroundColor: DESIGN_TOKENS.surface,
          borderColor: expanded ? 'rgba(229,169,60,0.28)' : DESIGN_TOKENS.borderSubtle
        }}
      >
        <div
          className="absolute left-0 top-0 bottom-0 w-[3px]"
          style={{ backgroundColor: DESIGN_TOKENS.accentHoney }}
          aria-hidden="true"
        />

        <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
          <Sparkles className="w-4 h-4 text-[#E5A93C] shrink-0" />
          <span className="text-xs font-semibold text-[#F1F5F9]">Vorarbeiter</span>
          <span className="text-xs text-[#94A3B8]" aria-hidden="true">
            ·
          </span>
          <span
            className="text-xs font-mono font-bold text-[#E5A93C]"
            data-testid="foreman-inbox-count"
          >
            {count}
          </span>
          <span className="text-xs text-[#94A3B8] break-words">{headerLabel}</span>
        </div>

        <div className="shrink-0 text-[#94A3B8]">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Aufgeklappte ruhige Freigabekarten (Ja / Später / Nein) */}
      {expanded && (
        <div className="space-y-2.5" data-testid="foreman-inbox-list">
          {proposals.map((proposal) => {
            const kindLabel =
              proposal.kind === 'murmur-research' ? 'Nebenbei-Prüfung' : 'Stiller Mitdenker';

            return (
              <article
                key={proposal.id}
                data-testid={`foreman-proposal-card-${proposal.id}`}
                className="rounded-2xl border relative overflow-hidden p-3.5 pl-4 space-y-3"
                style={{
                  backgroundColor: DESIGN_TOKENS.surface,
                  borderColor: DESIGN_TOKENS.borderSubtle
                }}
              >
                <div
                  className="absolute left-0 top-0 bottom-0 w-[3px]"
                  style={{ backgroundColor: DESIGN_TOKENS.accentHoney }}
                  aria-hidden="true"
                />

                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-md border"
                      style={{
                        color: DESIGN_TOKENS.accentHoney,
                        backgroundColor: 'rgba(229,169,60,0.1)',
                        borderColor: 'rgba(229,169,60,0.25)'
                      }}
                    >
                      {kindLabel}
                    </span>
                    <span className="text-xs font-mono text-[#94A3B8]">{proposal.createdAt}</span>
                  </div>

                  <h4 className="text-base font-bold text-[#F1F5F9] leading-snug break-words">
                    {proposal.title}
                  </h4>

                  {proposal.summary && (
                    <p className="text-xs text-[#94A3B8] leading-relaxed break-words">
                      {proposal.summary}
                    </p>
                  )}

                  {proposal.detail && (
                    <div className="p-2.5 rounded-xl bg-[#111317] border border-white/5 text-xs text-[#F1F5F9] leading-relaxed whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                      {proposal.detail}
                    </div>
                  )}

                  {proposal.actions.length > 0 && (
                    <div className="space-y-1 pt-0.5">
                      {proposal.actions.map((act, idx) => (
                        <div
                          key={`${proposal.id}-act-${idx}`}
                          className="text-xs text-[#F1F5F9]/90 flex items-start gap-1.5 break-words"
                        >
                          <span className="text-[#E5A93C] shrink-0">→</span>
                          <span className="min-w-0 flex-1 break-words">{act.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Ruhige Ja / Später / Nein Aktionsleiste (min-h-[44px], flex-wrap) */}
                <div className="flex items-center gap-2 flex-wrap pt-0.5">
                  <button
                    type="button"
                    data-testid={`foreman-accept-${proposal.id}`}
                    onClick={() => {
                      triggerHapticFeedback([12, 24]);
                      onAcceptProposal(proposal);
                    }}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold text-[#111317] flex items-center justify-center gap-1.5 flex-1 min-w-[110px] active:scale-95 transition cursor-pointer"
                    style={{ backgroundColor: DESIGN_TOKENS.accentHoney }}
                  >
                    <Check className="w-4 h-4 shrink-0" />
                    <span>Ja</span>
                  </button>

                  <button
                    type="button"
                    data-testid={`foreman-snooze-${proposal.id}`}
                    onClick={() => {
                      triggerHapticFeedback(10);
                      onSnoozeProposal(proposal);
                    }}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#111317] hover:bg-[#22262F] text-[#F1F5F9] border border-white/10 flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
                  >
                    <Clock className="w-4 h-4 shrink-0 text-[#94A3B8]" />
                    <span>Später</span>
                  </button>

                  <button
                    type="button"
                    data-testid={`foreman-dismiss-${proposal.id}`}
                    onClick={() => {
                      triggerHapticFeedback(10);
                      onDismissProposal(proposal);
                    }}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#111317] hover:bg-[#22262F] text-[#94A3B8] hover:text-[#F1F5F9] border border-white/10 flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
                  >
                    <X className="w-4 h-4 shrink-0" />
                    <span>Nein</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
