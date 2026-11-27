import React from 'react';
import { DESIGN_TOKENS } from '../../config/designTokens';

export interface VoiceWaveformBarsProps {
  color?: string;
  organicMotion?: boolean;
}

const BAR_CONFIG = [
  { heightClass: 'h-2.5', delayMs: 0, durationMs: 1150 },
  { heightClass: 'h-3.5', delayMs: 180, durationMs: 1350 },
  { heightClass: 'h-3', delayMs: 360, durationMs: 1220 },
  { heightClass: 'h-2.5', delayMs: 540, durationMs: 1450 }
] as const;

/**
 * Ruhige, rein dekorative 4-Balken-Stimmwelle für den aktiven Zuhör-Zustand.
 */
export const VoiceWaveformBars: React.FC<VoiceWaveformBarsProps> = ({
  color = DESIGN_TOKENS.accentHoney,
  organicMotion = true
}) => (
  <span
    aria-hidden="true"
    data-testid="voice-waveform-bars"
    className="inline-flex items-end gap-[3px] h-3.5 shrink-0"
  >
    {BAR_CONFIG.map((bar, idx) => (
      <span
        key={idx}
        className={`w-[3px] rounded-full ${bar.heightClass} ${
          organicMotion ? 'bandit-voice-wave-bar' : ''
        }`}
        style={{
          backgroundColor: color,
          ...(organicMotion
            ? {
                animationDelay: `${bar.delayMs}ms`,
                animationDuration: `${bar.durationMs}ms`
              }
            : { opacity: 0.85 })
        }}
      />
    ))}
  </span>
);
