import React, { useState } from 'react';
import { Brain, CheckCircle2, Key, Loader2, Plus, Trash2, Volume2, WifiOff, Zap } from 'lucide-react';
import { AiVoiceSettings, BanditUserPreferences, THEME, VoiceProvider } from '../../types';
import {
  getPreferredModelMode,
  setPreferredModelMode,
  stopAllSpeech,
  testGeminiApiKey,
  testGiselaVoice
} from '../../services/aiRouter';
import {
  getActiveAiMode,
  getAutoModeDetection,
  getAzureSpeechKey,
  getAzureSpeechRegion,
  getContinuousListening,
  getTtsEnabled,
  getVoiceProvider,
  saveActiveAiMode,
  saveAutoModeDetection,
  saveAzureSpeechKey,
  saveAzureSpeechRegion,
  saveContinuousListening,
  saveTtsEnabled,
  saveVoiceProvider
} from '../../services/storage';
import { ZentraleAccordion, ZentraleToggleRow } from './ZentralePrimitives';

interface AiAndVoiceSectionProps {
  isOpen: boolean;
  onToggle: () => void;
  userApiKey: string;
  onChangeApiKey: (key: string) => void;
  aiVoiceSettings?: AiVoiceSettings;
  onUpdateAiVoiceSettings?: (patch: Partial<AiVoiceSettings>) => void;
  prefs: BanditUserPreferences;
  onUpdatePrefs: (patch: Partial<BanditUserPreferences>) => void;
  onNotify: (msg: string) => void;
}

/**
 * Bereich 3 der Zentrale: Gemini API-Key, Modellwahl, KI-Antwortstil, Quick-Commands & Azure-Stimme „Gisela“.
 */
export const AiAndVoiceSection: React.FC<AiAndVoiceSectionProps> = ({
  isOpen,
  onToggle,
  userApiKey,
  onChangeApiKey,
  aiVoiceSettings,
  onUpdateAiVoiceSettings,
  prefs,
  onUpdatePrefs,
  onNotify
}) => {
  const currentAiSettings: AiVoiceSettings = aiVoiceSettings || {
    ttsEnabled: getTtsEnabled(),
    voiceProvider: getVoiceProvider(),
    azureSpeechKey: getAzureSpeechKey(),
    azureSpeechRegion: getAzureSpeechRegion(),
    preferredModelMode: getPreferredModelMode(),
    activeAiMode: getActiveAiMode(),
    continuousListening: getContinuousListening(),
    autoModeDetection: getAutoModeDetection()
  };

  const onUpdateAiSettings = (patch: Partial<AiVoiceSettings>) => {
    if (patch.ttsEnabled === false) {
      stopAllSpeech();
    }
    if (onUpdateAiVoiceSettings) {
      onUpdateAiVoiceSettings(patch);
      return;
    }
    if (patch.ttsEnabled !== undefined) saveTtsEnabled(patch.ttsEnabled);
    if (patch.voiceProvider !== undefined) saveVoiceProvider(patch.voiceProvider);
    if (patch.azureSpeechKey !== undefined) saveAzureSpeechKey(patch.azureSpeechKey);
    if (patch.azureSpeechRegion !== undefined) saveAzureSpeechRegion(patch.azureSpeechRegion);
    if (patch.preferredModelMode !== undefined) setPreferredModelMode(patch.preferredModelMode);
    if (patch.activeAiMode !== undefined) saveActiveAiMode(patch.activeAiMode);
    if (patch.continuousListening !== undefined)
      saveContinuousListening(patch.continuousListening);
    if (patch.autoModeDetection !== undefined) saveAutoModeDetection(patch.autoModeDetection);
  };
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [apiTestStatus, setApiTestStatus] = useState<{
    loading: boolean;
    ok?: boolean;
    text?: string;
  }>({ loading: false });
  const [giselaTesting, setGiselaTesting] = useState(false);
  const [giselaTestStatus, setGiselaTestStatus] = useState<{
    ok: boolean;
    engine: 'azure-gisela' | 'browser-fallback';
    message: string;
  } | null>(null);
  const [newQuickCmd, setNewQuickCmd] = useState('');

  const handleTestKey = async () => {
    setApiTestStatus({ loading: true });
    const res = await testGeminiApiKey(userApiKey);
    if (res.availableModels) setAvailableModels(res.availableModels);
    setApiTestStatus({ loading: false, ok: res.ok, text: res.message });
  };

  const handleTestGiselaVoice = async () => {
    setGiselaTesting(true);
    setGiselaTestStatus(null);
    try {
      const res = await testGiselaVoice(
        currentAiSettings.azureSpeechKey,
        currentAiSettings.azureSpeechRegion
      );
      setGiselaTestStatus(res);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unbekannt';
      setGiselaTestStatus({
        ok: false,
        engine: 'browser-fallback',
        message: `Fehler beim Test: ${msg}`
      });
    } finally {
      setGiselaTesting(false);
    }
  };

  const statusText = !currentAiSettings.ttsEnabled
    ? 'Stumm'
    : currentAiSettings.voiceProvider === 'azure-gisela'
      ? 'Gisela'
      : 'Browser';

  return (
    <ZentraleAccordion
      number={3}
      title={'KI & Stimme „Gisela"'}
      subtitle="Gemini API-Key, Modellwahl, KI-Stil & Azure Neural TTS"
      statusText={statusText}
      icon={<Key className="w-5 h-5 text-[#14B8A6]" />}
      isOpen={isOpen}
      onToggle={onToggle}
    >
      {/* Gemini API-Key & Modell */}
      <div className="space-y-3">
        <input
          type="password"
          value={userApiKey}
          onChange={(e) => onChangeApiKey(e.target.value)}
          placeholder="Gemini API-Key eintragen (AIzaSy...)"
          className="w-full min-w-0 min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-mono bg-[#181A1B] text-white border border-white/10"
        />

        <select
          value={currentAiSettings.preferredModelMode}
          onChange={(e) => {
            const nextMode = e.target.value;
            const patch: Partial<AiVoiceSettings> = { preferredModelMode: nextMode };
            if (nextMode === 'ALWAYS_PRO') patch.activeAiMode = 'research';
            else if (nextMode === 'ALWAYS_FLASH') patch.activeAiMode = 'flash';
            onUpdateAiSettings(patch);
          }}
          aria-label="Intelligenz-Modus wählen"
          className="w-full min-w-0 min-h-[44px] px-3.5 py-2 rounded-xl text-xs bg-[#181A1B] text-white border border-white/10"
        >
          <option value="SMART_PRO">
            Smart-Mix (Flash für Sortierung + Höchstes Pro-Modell für Fragen/Fotos)
          </option>
          <option value="ALWAYS_PRO">
            Immer höchstes Pro-Modell nutzen (Maximale Intelligenz)
          </option>
          <option value="ALWAYS_FLASH">
            Immer Flash nutzen (Maximale Geschwindigkeit)
          </option>
          {availableModels.map((m) => (
            <option key={m} value={m}>
              Direktwahl: {m}
            </option>
          ))}
        </select>

        {/* Direkter Start-Modus (activeAiMode) */}
        <div className="space-y-1.5">
          <label className="text-xs text-[#94A3B8] block font-medium">
            Direkter Start-Modus im Begleiter:
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { id: 'flash', label: 'Sprech (Flash)', icon: Zap },
                { id: 'research', label: 'Research (Pro)', icon: Brain }
              ] as const
            ).map(({ id, label, icon: Icon }) => {
              const isSelected = currentAiSettings.activeAiMode === id;
              return (
                <button
                  type="button"
                  key={id}
                  data-testid={`active-ai-mode-${id}`}
                  onClick={() => {
                    onUpdateAiSettings({ activeAiMode: id });
                    onNotify(
                      id === 'flash'
                        ? 'Start-Modus auf ⚡ Sprech (Flash) gesetzt.'
                        : 'Start-Modus auf 🧠 Research (Pro) gesetzt.'
                    );
                  }}
                  className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer ${
                    isSelected
                      ? 'bg-[#0A9396] text-white border-[#14B8A6]'
                      : 'bg-[#181A1B] text-[#94A3B8] border-white/10 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="break-words">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          disabled={apiTestStatus.loading}
          onClick={handleTestKey}
          className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 active:scale-95 transition cursor-pointer"
          style={{ backgroundColor: THEME.accentPrimary }}
        >
          {apiTestStatus.loading ? (
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>Verbindung testen &amp; Modelle laden</span>
        </button>

        {apiTestStatus.text && (
          <div
            className={`p-3 rounded-2xl text-xs border break-words ${
              apiTestStatus.ok
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-[#E5A93C]/10 border-[#E5A93C]/30 text-[#E5A93C]'
            }`}
          >
            {apiTestStatus.text}
          </div>
        )}
      </div>

      {/* Persönlicher KI-Antwortstil & Quick-Commands (umgezogen aus Bereich 2) */}
      <div className="p-3.5 rounded-2xl bg-[#242930] border border-white/5 space-y-3">
        <div className="space-y-1.5">
          <label className="text-xs text-[#94A3B8] block font-medium">
            Persönlicher KI-Antwortstil:
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'short', label: 'Kommando-Kurz' },
              { id: 'partner', label: 'Fach-Partner' },
              { id: 'coach', label: 'Fokus-Coach' }
            ].map((t) => (
              <button
                type="button"
                key={t.id}
                onClick={() =>
                  onUpdatePrefs({ aiTone: t.id as BanditUserPreferences['aiTone'] })
                }
                className={`flex-1 min-w-[100px] min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border transition active:scale-95 cursor-pointer ${
                  prefs.aiTone === t.id
                    ? 'text-white border-white/30'
                    : 'bg-[#181A1B] text-[#94A3B8] border-white/10 hover:text-white'
                }`}
                style={prefs.aiTone === t.id ? { backgroundColor: THEME.accentPrimary } : {}}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5 pt-1 border-t border-white/5">
          <label className="text-xs text-[#94A3B8] block font-medium">
            Eigene 1-Tipp-Schnellbefehle im KI-Fenster:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newQuickCmd}
              onChange={(e) => setNewQuickCmd(e.target.value)}
              placeholder="Neuer Schnellbefehl..."
              className="flex-1 min-w-0 min-h-[44px] px-3 py-2 rounded-xl text-xs bg-[#181A1B] text-white border border-white/10"
            />
            <button
              type="button"
              onClick={() => {
                if (!newQuickCmd.trim()) return;
                onUpdatePrefs({
                  quickCommands: [...prefs.quickCommands, newQuickCmd.trim()]
                });
                setNewQuickCmd('');
              }}
              className="min-h-[44px] min-w-[44px] px-3.5 py-1.5 rounded-xl text-xs font-bold text-white flex items-center justify-center active:scale-95 transition shrink-0 cursor-pointer"
              style={{ backgroundColor: THEME.accentPrimary }}
              aria-label="Schnellbefehl hinzufügen"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-1">
            {prefs.quickCommands.map((cmd, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-xl bg-[#181A1B] border border-white/5 flex items-center justify-between gap-2 text-xs text-white"
              >
                <span className="min-w-0 flex-1 break-words">{cmd}</span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdatePrefs({
                      quickCommands: prefs.quickCommands.filter((_, i) => i !== idx)
                    })
                  }
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#94A3B8] hover:text-[#E5A93C] shrink-0 cursor-pointer"
                  aria-label="Löschen"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* STIMME GISELA (AZURE NEURAL TTS) */}
      <div className="p-3.5 rounded-2xl bg-[#242930] border border-white/5 space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-xs font-bold text-white flex items-center gap-2 min-w-0">
            <Volume2 className="w-4 h-4 text-[#14B8A6] shrink-0" />
            <span className="break-words">Stimme „Gisela" (Microsoft Azure Neural TTS)</span>
          </div>
          <button
            type="button"
            aria-label="Sprachausgabe umschalten"
            onClick={() => {
              const nextTts = !currentAiSettings.ttsEnabled;
              onUpdateAiSettings({ ttsEnabled: nextTts });
              onNotify(nextTts ? 'Sprachausgabe aktiviert.' : 'Sprachausgabe stummgeschaltet.');
            }}
            className={`min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs font-bold border transition shrink-0 active:scale-95 cursor-pointer ${
              currentAiSettings.ttsEnabled
                ? 'bg-[#0A9396] text-white border-[#14B8A6]'
                : 'bg-[#181A1B] text-[#94A3B8] border-white/10'
            }`}
          >
            {currentAiSettings.ttsEnabled ? 'Stimme An' : 'Stumm'}
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-[#94A3B8] block font-medium">
            Aktive Stimme / TTS-Provider:
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { id: 'azure-gisela', label: 'Gisela (Azure Neural)' },
                { id: 'browser', label: 'Browser-Stimme' }
              ] as Array<{ id: VoiceProvider; label: string }>
            ).map((opt) => (
              <button
                type="button"
                key={opt.id}
                onClick={() => {
                  onUpdateAiSettings({ voiceProvider: opt.id });
                  onNotify(
                    opt.id === 'azure-gisela'
                      ? 'Stimme auf Gisela (Azure Neural) gesetzt.'
                      : 'Stimme auf Browser-Sprachausgabe gesetzt.'
                  );
                }}
                className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border transition active:scale-95 cursor-pointer ${
                  currentAiSettings.voiceProvider === opt.id
                    ? 'bg-[#0A9396] text-white border-[#14B8A6]'
                    : 'bg-[#181A1B] text-[#94A3B8] border-white/10 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <input
            type="password"
            value={currentAiSettings.azureSpeechKey}
            onChange={(e) => onUpdateAiSettings({ azureSpeechKey: e.target.value })}
            placeholder="Azure Speech API-Key (optional)..."
            className="w-full min-w-0 min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-mono bg-[#181A1B] text-white border border-white/10"
          />
          <input
            type="text"
            value={currentAiSettings.azureSpeechRegion}
            onChange={(e) => onUpdateAiSettings({ azureSpeechRegion: e.target.value })}
            placeholder="Azure Region (z. B. germanywestcentral oder westeurope)"
            className="w-full min-w-0 min-h-[44px] px-3.5 py-2 rounded-xl text-xs bg-[#181A1B] text-white border border-white/10"
          />
          <button
            type="button"
            disabled={giselaTesting}
            onClick={handleTestGiselaVoice}
            className="w-full min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 active:scale-95 transition cursor-pointer"
            style={{ backgroundColor: THEME.accentPrimary }}
          >
            {giselaTesting ? (
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            ) : (
              <Volume2 className="w-4 h-4 shrink-0" />
            )}
            <span>Stimme Gisela testen</span>
          </button>
          {giselaTestStatus && (
            <div
              className={`p-3 rounded-2xl text-xs border break-words ${
                giselaTestStatus.engine === 'azure-gisela'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-[#E5A93C]/10 border-[#E5A93C]/30 text-[#E5A93C]'
              }`}
            >
              {giselaTestStatus.message}
            </div>
          )}
        </div>

        {/* Durchgehendes Gespräch */}
        <div className="pt-2 border-t border-white/5">
          <ZentraleToggleRow
            title="Durchgehendes Gespräch (Auto-Re-Listen)"
            description="Hört nach Giselas Antwort automatisch wieder zu (Stopp per „Danke, reicht“)"
            checked={!!currentAiSettings.continuousListening}
            onToggle={() => {
              const next = !currentAiSettings.continuousListening;
              onUpdateAiSettings({ continuousListening: next });
              onNotify(
                next
                  ? 'Durchgehendes Gespräch (Auto-Re-Listen) aktiviert.'
                  : 'Durchgehendes Gespräch deaktiviert.'
              );
            }}
            onLabel="Aktiv"
            offLabel="Aus"
            ariaLabel="Durchgehendes Gespräch umschalten"
            containerClassName="py-1"
          />
        </div>

        {/* Automatische Gesprächsmodus-Erkennung */}
        <div className="pt-2 border-t border-white/5">
          <ZentraleToggleRow
            title="Automatische Gesprächsmodus-Erkennung (Quick / Sammel / Dialog)"
            description="Passt Denkpause (2,0s / 3,5s / 5,5s) und Nachhören unsichtbar an"
            checked={currentAiSettings.autoModeDetection !== false}
            onToggle={() => {
              const next = !(currentAiSettings.autoModeDetection !== false);
              onUpdateAiSettings({ autoModeDetection: next });
              onNotify(
                next
                  ? 'Automatische Gesprächsmodus-Erkennung aktiviert.'
                  : 'Automatische Gesprächsmodus-Erkennung deaktiviert (5,5s Standard-Puffer).'
              );
            }}
            onLabel="Aktiv"
            offLabel="Aus"
            ariaLabel="Automatische Gesprächsmodus-Erkennung umschalten"
            testId="toggle-auto-mode-detection"
            containerClassName="py-1"
          />
        </div>

        {/* Offline-Audio-Puffer (Funkloch-Memo) */}
        <div className="pt-2 border-t border-white/5">
          <ZentraleToggleRow
            title="Offline-Audio-Puffer (Funkloch-Memo)"
            description="Speichert Sprachmemos bei fehlendem Netz lokal in IndexedDB zur späteren Auswertung."
            checked={prefs.offlineAudioBufferEnabled !== false}
            onToggle={() => {
              const next = !(prefs.offlineAudioBufferEnabled !== false);
              onUpdatePrefs({ offlineAudioBufferEnabled: next });
              onNotify(
                next
                  ? 'Offline-Audio-Puffer (Funkloch-Memo) aktiviert.'
                  : 'Offline-Audio-Puffer ausgeblendet.'
              );
            }}
            onLabel="An"
            offLabel="Aus"
            tone="honey"
            icon={<WifiOff className="w-4 h-4 text-[#E5A93C] shrink-0" />}
            ariaLabel="Offline-Audio-Puffer umschalten"
            testId="toggle-offline-audio-buffer"
            containerClassName="py-1"
          />
        </div>
      </div>

      {/* BEGLEITER-OBERFLÄCHE (Stetiger Begleiter v2) */}
      <div className="p-3.5 rounded-2xl bg-[#242930] border border-white/5 space-y-2.5">
        <div className="text-xs font-bold text-[#F1F5F9]">Begleiter-Oberfläche</div>

        <ZentraleToggleRow
          title="Nachrichten-Werkzeuge (Kopieren, Neu verarbeiten & Export)"
          description="Zeigt Kopieren, Bearbeiten, Neu verarbeiten, Pro-Neulauf und Chat-Export (.md/.txt/Wissen)."
          checked={prefs.companionMessageToolsEnabled !== false}
          onToggle={() => {
            const next = !(prefs.companionMessageToolsEnabled !== false);
            onUpdatePrefs({ companionMessageToolsEnabled: next });
            onNotify(
              next
                ? 'Nachrichten-Werkzeuge & Export aktiviert.'
                : 'Nachrichten-Werkzeuge ausgeblendet.'
            );
          }}
          onLabel="An"
          offLabel="Aus"
          testId="toggle-companion-tools"
          containerClassName="py-1"
        />

        <div className="pt-2 border-t border-white/5">
          <ZentraleToggleRow
            title="Quick-Command-Chips im leeren Chat"
            description="Zeigt Schnellbefehle solange noch keine Nachricht im aktuellen Chat steht."
            checked={prefs.companionQuickChipsEnabled !== false}
            onToggle={() => {
              const next = !(prefs.companionQuickChipsEnabled !== false);
              onUpdatePrefs({ companionQuickChipsEnabled: next });
              onNotify(
                next
                  ? 'Quick-Command-Chips im leeren Chat aktiviert.'
                  : 'Quick-Command-Chips ausgeblendet.'
              );
            }}
            onLabel="An"
            offLabel="Aus"
            testId="toggle-companion-quick-chips"
            containerClassName="py-1"
          />
        </div>

        <div className="pt-2 border-t border-white/5">
          <ZentraleToggleRow
            title="Direkt im vollen Kontext-Chat (Stufe 2) starten"
            description="Öffnet beim Tipp auf das Sechseck direkt das volle Kontextfenster statt Stufe 1."
            checked={Boolean(prefs.companionStartExpanded)}
            onToggle={() => {
              const next = !prefs.companionStartExpanded;
              onUpdatePrefs({ companionStartExpanded: next });
              onNotify(
                next
                  ? 'Begleiter startet direkt in Stufe 2.'
                  : 'Begleiter startet kompakt in Stufe 1.'
              );
            }}
            onLabel="An"
            offLabel="Aus"
            testId="toggle-companion-start-expanded"
            containerClassName="py-1"
          />
        </div>
      </div>
    </ZentraleAccordion>
  );
};
