import React, { useState } from 'react';
import { Bell, Webhook } from 'lucide-react';
import { THEME } from '../../types';
import { requestPushNotificationPermission } from '../../services/cloudSyncAndPush';
import { ZentraleAccordion, ZentraleToggleRow } from './ZentralePrimitives';

interface AutomationSectionProps {
  isOpen: boolean;
  onToggle: () => void;
  remindersEnabled: boolean;
  onToggleRemindersEnabled?: (enabled: boolean) => void;
  onNotify: (msg: string) => void;
}

/**
 * Bereich 4 der Zentrale: Proaktive Erinnerungen, Push-Freigabe & Vorschau auf Vorarbeiter / Smart Home.
 */
export const AutomationSection: React.FC<AutomationSectionProps> = ({
  isOpen,
  onToggle,
  remindersEnabled,
  onToggleRemindersEnabled,
  onNotify
}) => {
  const [pushGranted, setPushGranted] = useState<boolean>(
    typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
  );

  const notificationStatusText =
    typeof Notification !== 'undefined'
      ? Notification.permission === 'granted'
        ? 'Desktop-Push erlaubt (granted)'
        : Notification.permission === 'denied'
          ? 'Desktop-Push blockiert (denied) – In-App-Banner aktiv'
          : 'Browser-Freigabe noch offen (default) – In-App-Banner aktiv'
      : 'Nur In-App-Banner';

  return (
    <ZentraleAccordion
      number={4}
      title="Erinnerungen, Vorarbeiter & Smart Home"
      subtitle="Proaktive Erinnerungen, Push-Freigabe & Automationen"
      statusText={remindersEnabled ? 'Aktiv' : 'Pausiert'}
      icon={<Bell className="w-5 h-5 text-[#E5A93C]" />}
      isOpen={isOpen}
      onToggle={onToggle}
    >
      {/* Proaktive Erinnerungen */}
      {onToggleRemindersEnabled && (
        <ZentraleToggleRow
          title="Proaktive Erinnerungen (Banner & Desktop)"
          description={`Status: ${notificationStatusText}`}
          checked={remindersEnabled}
          onToggle={() => onToggleRemindersEnabled(!remindersEnabled)}
          onLabel="Erinnerungen An"
          offLabel="Erinnerungen Aus"
          tone="honey"
          icon={<Bell className="w-4 h-4 text-[#E5A93C] shrink-0" />}
          testId="toggle-reminders-enabled"
        />
      )}

      {/* Browser-Push-Freigabe (390-px-Fix mit flex-wrap) */}
      <div className="p-3.5 rounded-2xl bg-[#242930] border border-white/5 flex items-center justify-between gap-2 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold text-[#F1F5F9]">
            Browser-Push-Benachrichtigungen
          </div>
          <div className="text-xs text-[#94A3B8] leading-snug">
            {pushGranted
              ? 'Freigabe erteilt – fällige Aufgaben melden sich direkt'
              : 'Freigeben, um Erinnerungen auch im Hintergrund zu erhalten'}
          </div>
        </div>
        <button
          type="button"
          onClick={async () => {
            const ok = await requestPushNotificationPermission();
            setPushGranted(ok);
            onNotify(
              ok
                ? 'Push-Benachrichtigungen sind aktiviert!'
                : 'Bitte Benachrichtigungen in den Browser-Einstellungen erlauben.'
            );
          }}
          className="min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs font-bold text-white shrink-0 active:scale-95 transition cursor-pointer"
          style={{
            backgroundColor: pushGranted ? THEME.accentPrimary : '#374151'
          }}
        >
          {pushGranted ? 'Push Aktiv' : 'Freigeben'}
        </button>
      </div>

      {/* Ruhige Status-Hinweiszeile für kommendes Update */}
      <div className="p-3.5 rounded-2xl bg-[#111317] border border-white/5 flex items-start gap-2.5">
        <Webhook className="w-4 h-4 text-[#94A3B8] shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-[#F1F5F9]">
            Vorarbeiter &amp; Smart Home
          </div>
          <div className="text-xs text-[#94A3B8] leading-snug mt-0.5">
            Proaktive Hintergrund-Routinen, Vorarbeiter-Briefings und Home-Assistant-Steuerung folgen im nächsten Ausbauschritt.
          </div>
        </div>
      </div>
    </ZentraleAccordion>
  );
};
