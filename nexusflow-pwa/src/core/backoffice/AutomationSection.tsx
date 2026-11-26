import React, { useState } from 'react';
import { Bell, BrainCircuit, Receipt, Scale, Sparkles, Webhook } from 'lucide-react';
import { BanditUserPreferences, THEME } from '../../types';
import { requestPushNotificationPermission } from '../../services/cloudSyncAndPush';
import {
  AutoAuditSettings,
  loadAuditSettings,
  saveAuditSettings
} from '../../services/deepResearchAndScanner';
import { ZentraleAccordion, ZentraleToggleRow } from './ZentralePrimitives';

interface AutomationSectionProps {
  isOpen: boolean;
  onToggle: () => void;
  remindersEnabled: boolean;
  onToggleRemindersEnabled?: (enabled: boolean) => void;
  prefs: BanditUserPreferences;
  onUpdatePrefs: (patch: Partial<BanditUserPreferences>) => void;
  haWebhookUrl?: string;
  haEmbedUrl?: string;
  onChangeHaWebhook?: (url: string) => void;
  onChangeHaEmbed?: (url: string) => void;
  onNotify: (msg: string) => void;
}

/**
 * Bereich 4 der Zentrale: Proaktive Erinnerungen, Push-Freigabe, Vorschriften-Wächter & Smart Home.
 */
export const AutomationSection: React.FC<AutomationSectionProps> = ({
  isOpen,
  onToggle,
  remindersEnabled,
  onToggleRemindersEnabled,
  prefs,
  onUpdatePrefs,
  haWebhookUrl = '',
  haEmbedUrl = '',
  onChangeHaWebhook,
  onChangeHaEmbed,
  onNotify
}) => {
  const [pushGranted, setPushGranted] = useState<boolean>(
    typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
  );
  const [auditSettings, setAuditSettings] = useState<AutoAuditSettings>(loadAuditSettings);

  const notificationStatusText =
    typeof Notification !== 'undefined'
      ? Notification.permission === 'granted'
        ? 'Desktop-Push erlaubt (granted)'
        : Notification.permission === 'denied'
          ? 'Desktop-Push blockiert (denied) – In-App-Banner aktiv'
          : 'Browser-Freigabe noch offen (default) – In-App-Banner aktiv'
      : 'Nur In-App-Banner';

  const foremanEnabled = prefs.receiptForemanEnabled !== false;
  const sectionStatusText = `${remindersEnabled ? 'Aktiv' : 'Pausiert'} · ${
    foremanEnabled ? 'Vorarbeiter An' : 'Vorarbeiter Aus'
  }`;

  return (
    <ZentraleAccordion
      number={4}
      title="Erinnerungen, Vorarbeiter & Smart Home"
      subtitle="Proaktive Erinnerungen, Beleg-Vorarbeiter, Vorschriften & Smart Home"
      statusText={sectionStatusText}
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

      {/* System-Push zusätzlich zum In-App-Banner */}
      <ZentraleToggleRow
        title="System-Benachrichtigungen (Push) zusätzlich zum In-App-Banner"
        description={
          prefs.reminderSystemPushEnabled !== false
            ? 'Sendet bei Fälligkeit zusätzlich eine System-Notification'
            : 'Nur ruhiges Honig-Gold-In-App-Banner ohne System-Notification'
        }
        checked={prefs.reminderSystemPushEnabled !== false}
        onToggle={() => {
          const next = !(prefs.reminderSystemPushEnabled !== false);
          onUpdatePrefs({ reminderSystemPushEnabled: next });
          onNotify(
            next
              ? 'System-Benachrichtigungen für Erinnerungen aktiviert.'
              : 'Nur In-App-Banner für Erinnerungen aktiv.'
          );
        }}
        onLabel="An"
        offLabel="Aus"
        tone="honey"
        testId="toggle-reminder-system-push"
      />

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

      {/* Vorschriften-Wächter (AUDIT_SETTINGS) */}
      <ZentraleToggleRow
        title="Vorschriften-Wächter & Auto-Watchlist"
        description={
          auditSettings.weeklyAutoAuditEnabled
            ? 'Automatische Prüfung & Watchlist für kritische Normen aktiv'
            : 'Automatische Prüfungen & Watchlist-Erkennung pausiert'
        }
        checked={auditSettings.weeklyAutoAuditEnabled}
        onToggle={() => {
          const next: AutoAuditSettings = {
            ...auditSettings,
            weeklyAutoAuditEnabled: !auditSettings.weeklyAutoAuditEnabled
          };
          setAuditSettings(next);
          saveAuditSettings(next);
          onNotify(
            next.weeklyAutoAuditEnabled
              ? 'Vorschriften-Wächter Auto-Watchlist aktiviert.'
              : 'Vorschriften-Wächter Auto-Watchlist pausiert.'
          );
        }}
        onLabel="An"
        offLabel="Aus"
        icon={<Scale className="w-4 h-4 text-[#14B8A6] shrink-0" />}
        testId="toggle-audit-settings"
      />

      {/* Beleg- & Rechnungs-Vorarbeiter */}
      <ZentraleToggleRow
        title="Beleg- & Rechnungs-Vorarbeiter"
        description="Prüft Belege auf Dubletten/Lücken, schlägt Einkaufswagen-Abgleich per 1-Tipp vor und erstellt das Steuerberater-Monatspaket."
        checked={foremanEnabled}
        onToggle={() => {
          const next = !foremanEnabled;
          onUpdatePrefs({ receiptForemanEnabled: next });
          onNotify(
            next
              ? 'Beleg- & Rechnungs-Vorarbeiter aktiviert.'
              : 'Beleg- & Rechnungs-Vorarbeiter ausgeblendet.'
          );
        }}
        onLabel="An"
        offLabel="Aus"
        icon={<Receipt className="w-4 h-4 text-[#14B8A6] shrink-0" />}
        ariaLabel="Beleg- & Rechnungs-Vorarbeiter umschalten"
        testId="toggle-receipt-foreman"
      />

      {/* Stiller Mitdenker */}
      <ZentraleToggleRow
        title="Stiller Mitdenker (Widerspruchs-Wächter)"
        description="Erkennt im Hintergrund doppelte offene Einkäufe, Maß-/Technik-Widersprüche zwischen Aufgaben & Wissen sowie offene Einkäufe zu erledigten Aufgaben."
        checked={prefs.silentThinkerEnabled !== false}
        onToggle={() => {
          const next = !(prefs.silentThinkerEnabled !== false);
          onUpdatePrefs({ silentThinkerEnabled: next });
          onNotify(
            next
              ? 'Stiller Mitdenker aktiviert.'
              : 'Stiller Mitdenker ausgeblendet.'
          );
        }}
        onLabel="An"
        offLabel="Aus"
        tone="honey"
        icon={<BrainCircuit className="w-4 h-4 text-[#E5A93C] shrink-0" />}
        ariaLabel="Stillen Mitdenker umschalten"
        testId="toggle-silent-thinker"
      />

      {/* Nebenbei-Murmel-Autopilot */}
      <ZentraleToggleRow
        title="„Nebenbei-Murmel“-Autopilot (Hintergrund-Recherche)"
        description="Ermöglicht in Deep Research das asynchrone Prüfen im Hintergrund und legt Ergebnisse als ruhige Ja/Nein/Später-Freigabekarte ab."
        checked={prefs.murmurAutopilotEnabled !== false}
        onToggle={() => {
          const next = !(prefs.murmurAutopilotEnabled !== false);
          onUpdatePrefs({ murmurAutopilotEnabled: next });
          onNotify(
            next
              ? '„Nebenbei-Murmel“-Autopilot aktiviert.'
              : '„Nebenbei-Murmel“-Autopilot ausgeblendet.'
          );
        }}
        onLabel="An"
        offLabel="Aus"
        tone="honey"
        icon={<Sparkles className="w-4 h-4 text-[#E5A93C] shrink-0" />}
        ariaLabel="Nebenbei-Murmel-Autopilot umschalten"
        testId="toggle-murmur-autopilot"
      />

      {/* Smart Home / Home Assistant (Prinzip der geschlossenen Schublade) */}
      <div className="space-y-2.5">
        <ZentraleToggleRow
          title="Smart Home / Home Assistant"
          description={
            prefs.smartHomeEnabled === true
              ? 'Webhook- & Dashboard-URLs sichtbar und aktiv'
              : 'Geschlossene Schublade – Felder bei Bedarf einblenden'
          }
          checked={prefs.smartHomeEnabled === true}
          onToggle={() => {
            const next = !(prefs.smartHomeEnabled === true);
            onUpdatePrefs({ smartHomeEnabled: next });
            onNotify(
              next
                ? 'Smart-Home-Konfiguration eingeblendet.'
                : 'Smart-Home-Schublade geschlossen.'
            );
          }}
          onLabel="An"
          offLabel="Aus"
          icon={<Webhook className="w-4 h-4 text-[#14B8A6] shrink-0" />}
          testId="toggle-smart-home"
        />

        {prefs.smartHomeEnabled === true && (
          <div className="p-3.5 rounded-2xl bg-[#242930] border border-white/5 space-y-2.5 animate-fadeIn">
            <div className="space-y-1">
              <label className="text-xs text-[#94A3B8] block font-medium">
                Home-Assistant Webhook URL:
              </label>
              <input
                type="url"
                value={haWebhookUrl}
                onChange={(e) => onChangeHaWebhook?.(e.target.value)}
                placeholder="http://homeassistant.local:8123/api/webhook/..."
                data-testid="input-ha-webhook-url"
                className="w-full min-w-0 min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-mono bg-[#181A1B] text-[#F1F5F9] border border-white/10 focus:outline-none focus:border-[#14B8A6]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-[#94A3B8] block font-medium">
                Home-Assistant Dashboard / Embed URL:
              </label>
              <input
                type="url"
                value={haEmbedUrl}
                onChange={(e) => onChangeHaEmbed?.(e.target.value)}
                placeholder="http://homeassistant.local:8123/lovelace/0"
                data-testid="input-ha-embed-url"
                className="w-full min-w-0 min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-mono bg-[#181A1B] text-[#F1F5F9] border border-white/10 focus:outline-none focus:border-[#14B8A6]"
              />
            </div>
          </div>
        )}
      </div>
    </ZentraleAccordion>
  );
};
