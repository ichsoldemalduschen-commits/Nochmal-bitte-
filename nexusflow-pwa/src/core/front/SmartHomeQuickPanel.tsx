import React, { useState } from 'react';
import { Power, Zap } from 'lucide-react';
import { DESIGN_TOKENS } from '../../config/designTokens';
import { SmartHomeSwitchItem } from '../../types';
import { triggerSmartHomeSwitch } from '../../services/smartHomeBridge';

export interface SmartHomeQuickPanelProps {
  smartHomeEnabled: boolean;
  switches: SmartHomeSwitchItem[];
  haWebhookUrl?: string;
  onSwitchTriggered: (switchId: string, triggeredAt: string) => void;
}

/**
 * Geschlossene Schublade für Live-Shelly- & Home-Assistant-Schnellschalter in ExtrasView.
 * Rendert strikt null, sobald smartHomeEnabled !== true.
 */
export const SmartHomeQuickPanel: React.FC<SmartHomeQuickPanelProps> = ({
  smartHomeEnabled,
  switches,
  haWebhookUrl,
  onSwitchTriggered
}) => {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (smartHomeEnabled !== true || switches.length === 0) {
    return null;
  }

  const handleTrigger = async (item: SmartHomeSwitchItem) => {
    setBusyId(item.id);
    const result = await triggerSmartHomeSwitch(item, haWebhookUrl);
    onSwitchTriggered(item.id, result.triggeredAt);
    setStatusMessage(`${item.label}: ${result.statusText}`);
    setBusyId(null);
  };

  return (
    <div
      data-testid="smart-home-quick-panel"
      className="p-3.5 rounded-3xl border bg-[#191C22] shadow-xl space-y-3"
      style={{ borderColor: DESIGN_TOKENS.borderSubtle }}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Zap className="w-4 h-4 shrink-0 text-[#E5A93C]" />
          <h4 className="text-base font-bold text-[#F1F5F9] leading-snug break-words">
            Werkstatt- &amp; TSA-Schnellschalter (Shelly / HA)
          </h4>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {switches.map((sw) => {
          const isBusy = busyId === sw.id;
          return (
            <button
              key={sw.id}
              type="button"
              disabled={isBusy}
              data-testid={`smart-home-switch-${sw.id}`}
              onClick={() => void handleTrigger(sw)}
              className="flex-1 min-w-[145px] min-h-[44px] px-3.5 py-2.5 rounded-2xl bg-[#111317] hover:bg-[#22262F] border border-white/10 text-left flex items-center justify-between gap-2 active:scale-95 transition cursor-pointer disabled:opacity-60"
            >
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-[#F1F5F9] break-words leading-snug">
                  {sw.label}
                </div>
                <div className="text-xs font-mono text-[#94A3B8] truncate">
                  {sw.lastTriggeredAt ? sw.lastTriggeredAt : sw.method}
                </div>
              </div>
              <Power className="w-4 h-4 shrink-0 text-[#14B8A6]" />
            </button>
          );
        })}
      </div>

      {statusMessage && (
        <div
          data-testid="smart-home-quick-status"
          className="text-xs font-medium text-[#E5A93C] leading-snug break-words"
        >
          {statusMessage}
        </div>
      )}
    </div>
  );
};
