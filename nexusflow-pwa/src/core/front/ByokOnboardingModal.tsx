import React, { useEffect, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  Eye,
  EyeOff,
  Key,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { NEUTRAL_BRAND_META } from '../../config/brandConfig';
import { DESIGN_TOKENS } from '../../config/designTokens';

export interface ByokOnboardingResult {
  applyNeutralStarter: boolean;
  geminiApiKey: string;
  azureSpeechKey: string;
  azureSpeechRegion: string;
  thumbHubPosition: 'left' | 'center' | 'right';
  companionStartExpanded: boolean;
}

export interface ByokOnboardingModalProps {
  open: boolean;
  starterProfile: 'bandit' | 'neutral';
  hasExistingNonNeutralProjects: boolean;
  initialGeminiKey: string;
  initialAzureKey: string;
  initialAzureRegion: string;
  initialThumbHubPosition: 'left' | 'center' | 'right';
  initialCompanionStartExpanded: boolean;
  onSkip: () => void;
  onComplete: (result: ByokOnboardingResult) => void;
}

/**
 * Ruhiger 3-Schritte-Erststart-Assistent für das Open-Source-/BYOK-Profil.
 */
export const ByokOnboardingModal: React.FC<ByokOnboardingModalProps> = ({
  open,
  starterProfile,
  hasExistingNonNeutralProjects,
  initialGeminiKey,
  initialAzureKey,
  initialAzureRegion,
  initialThumbHubPosition,
  initialCompanionStartExpanded,
  onSkip,
  onComplete
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [profileChoice, setProfileChoice] = useState<'neutral' | 'keep'>('keep');
  const [neutralSwitchConfirmed, setNeutralSwitchConfirmed] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState(initialGeminiKey);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [azureOpen, setAzureOpen] = useState(false);
  const [azureSpeechKey, setAzureSpeechKey] = useState(initialAzureKey);
  const [showAzureKey, setShowAzureKey] = useState(false);
  const [azureSpeechRegion, setAzureSpeechRegion] = useState(
    initialAzureRegion || 'germanywestcentral'
  );
  const [thumbHubPosition, setThumbHubPosition] = useState<'left' | 'center' | 'right'>(
    initialThumbHubPosition
  );
  const [companionStartExpanded, setCompanionStartExpanded] = useState(
    initialCompanionStartExpanded
  );

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setProfileChoice(hasExistingNonNeutralProjects ? 'keep' : 'neutral');
    setNeutralSwitchConfirmed(false);
    setGeminiApiKey(initialGeminiKey);
    setShowGeminiKey(false);
    setAzureOpen(false);
    setAzureSpeechKey(initialAzureKey);
    setShowAzureKey(false);
    setAzureSpeechRegion(initialAzureRegion || 'germanywestcentral');
    setThumbHubPosition(initialThumbHubPosition);
    setCompanionStartExpanded(initialCompanionStartExpanded);
  }, [
    open,
    hasExistingNonNeutralProjects,
    initialGeminiKey,
    initialAzureKey,
    initialAzureRegion,
    initialThumbHubPosition,
    initialCompanionStartExpanded
  ]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onSkip();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onSkip]);

  if (!open) return null;

  const requiresNeutralConfirmation =
    hasExistingNonNeutralProjects && profileChoice === 'neutral';
  const canProceedFromStep1 = !requiresNeutralConfirmation || neutralSwitchConfirmed;

  const handleFinish = () => {
    const applyNeutralStarter =
      profileChoice === 'neutral' &&
      (!hasExistingNonNeutralProjects || neutralSwitchConfirmed);
    onComplete({
      applyNeutralStarter,
      geminiApiKey: geminiApiKey.trim(),
      azureSpeechKey: azureSpeechKey.trim(),
      azureSpeechRegion: azureSpeechRegion.trim() || 'germanywestcentral',
      thumbHubPosition,
      companionStartExpanded
    });
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Erststart-Assistent"
        data-testid="byok-onboarding-modal"
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl border shadow-2xl p-4 sm:p-5 space-y-4 bandit-reveal"
        style={{
          backgroundColor: DESIGN_TOKENS.surface,
          borderColor: DESIGN_TOKENS.borderSubtle,
          color: DESIGN_TOKENS.textPrimary
        }}
      >
        {/* ── Kopfzeile: Fortschritt + Überspringen ── */}
        <div className="flex items-center justify-between gap-2 flex-wrap border-b border-white/5 pb-3">
          <div className="min-w-0 flex-1 space-y-0.5">
            <div
              data-testid="onboarding-step-indicator"
              className="text-xs font-mono font-semibold text-[#94A3B8]"
            >
              Schritt {step} von 3
            </div>
            <div className="text-base font-bold text-[#F1F5F9] leading-snug break-words">
              {starterProfile === 'neutral' ? NEUTRAL_BRAND_META.appName : 'Erststart & BYOK'}
            </div>
            <div className="text-xs text-[#94A3B8] leading-snug break-words">
              {NEUTRAL_BRAND_META.subtitle}
            </div>
          </div>

          <button
            type="button"
            data-testid="onboarding-skip-btn"
            onClick={onSkip}
            className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold text-[#94A3B8] hover:text-[#F1F5F9] bg-[#111317] border border-white/10 shrink-0 cursor-pointer bandit-pressable"
          >
            Überspringen
          </button>
        </div>

        {/* ── Schritt 1 – Profil & Ruhe ── */}
        {step === 1 && (
          <div className="space-y-3" data-testid="onboarding-step-1">
            <div
              className="p-3.5 rounded-2xl border space-y-1.5"
              style={{
                backgroundColor: DESIGN_TOKENS.canvas,
                borderColor: DESIGN_TOKENS.borderSubtle
              }}
            >
              <div className="text-xs font-bold text-[#14B8A6] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Profil &amp; Ruhe (BYOK)</span>
              </div>
              <p className="text-xs text-[#F1F5F9] leading-relaxed break-words">
                100 % lokal auf deinem Gerät – deine Daten &amp; API-Keys verlassen deinen Browser
                nur direkt an deine gewählte KI.
              </p>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                data-testid="onboarding-profile-neutral"
                onClick={() => setProfileChoice('neutral')}
                className={`w-full min-h-[44px] p-3.5 rounded-2xl border text-left transition cursor-pointer flex flex-wrap items-start justify-between gap-2 bandit-pressable ${
                  profileChoice === 'neutral'
                    ? 'bg-[#0D9488]/20 border-[#14B8A6]'
                    : 'bg-[#111317] border-white/10 hover:border-white/20'
                }`}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="text-sm font-bold text-[#F1F5F9] leading-snug break-words">
                    Neutrales Starter-Profil (Arbeit &amp; Privat)
                  </div>
                  <div className="text-xs text-[#94A3B8] leading-snug break-words">
                    2 ruhige Beispiel-Projekte ohne persönliche Vorbelegungen.
                  </div>
                </div>
                {profileChoice === 'neutral' && (
                  <span className="min-h-[28px] px-2.5 py-1 rounded-lg bg-[#0D9488] text-white text-xs font-bold inline-flex items-center gap-1 shrink-0">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>Gewählt</span>
                  </span>
                )}
              </button>

              <button
                type="button"
                data-testid="onboarding-profile-keep"
                onClick={() => {
                  setProfileChoice('keep');
                  setNeutralSwitchConfirmed(false);
                }}
                className={`w-full min-h-[44px] p-3.5 rounded-2xl border text-left transition cursor-pointer flex flex-wrap items-start justify-between gap-2 bandit-pressable ${
                  profileChoice === 'keep'
                    ? 'bg-[#0D9488]/20 border-[#14B8A6]'
                    : 'bg-[#111317] border-white/10 hover:border-white/20'
                }`}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="text-sm font-bold text-[#F1F5F9] leading-snug break-words">
                    Aktuelle Projekte behalten
                  </div>
                  <div className="text-xs text-[#94A3B8] leading-snug break-words">
                    Vorhandene Projekte, Aufgaben und Listen bleiben unverändert (null Datenverlust).
                  </div>
                </div>
                {profileChoice === 'keep' && (
                  <span className="min-h-[28px] px-2.5 py-1 rounded-lg bg-[#0D9488] text-white text-xs font-bold inline-flex items-center gap-1 shrink-0">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>Standard</span>
                  </span>
                )}
              </button>
            </div>

            {requiresNeutralConfirmation && (
              <div
                role="alert"
                className="p-3.5 rounded-2xl border space-y-2.5"
                style={{
                  backgroundColor: 'rgba(229,169,60,0.10)',
                  borderColor: 'rgba(229,169,60,0.35)'
                }}
              >
                <p className="text-xs font-semibold text-[#E5A93C] leading-snug break-words">
                  Hinweis: Beim Abschluss werden deine aktuellen Projekte durch das neutrale
                  Starter-Profil (Arbeit &amp; Privat) ersetzt.
                </p>
                <button
                  type="button"
                  data-testid="onboarding-confirm-neutral-switch"
                  onClick={() => setNeutralSwitchConfirmed((v) => !v)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border flex items-center justify-between gap-2 text-left cursor-pointer bandit-pressable"
                  style={{
                    backgroundColor: neutralSwitchConfirmed ? DESIGN_TOKENS.accentHoney : '#111317',
                    color: neutralSwitchConfirmed ? '#111317' : DESIGN_TOKENS.accentHoney,
                    borderColor: 'rgba(229,169,60,0.5)'
                  }}
                >
                  <span className="break-words">
                    Ja, bewusst auf neutrales Starter-Profil wechseln
                  </span>
                  {neutralSwitchConfirmed && <Check className="w-4 h-4 shrink-0" />}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Schritt 2 – Eigene API-Keys (BYOK, optional) ── */}
        {step === 2 && (
          <div className="space-y-3" data-testid="onboarding-step-2">
            <div className="space-y-1.5">
              <label
                htmlFor="onboarding-gemini-key"
                className="text-xs font-bold text-[#F1F5F9] flex items-center gap-2"
              >
                <Key className="w-4 h-4 text-[#14B8A6] shrink-0" />
                <span>Gemini API-Key (optional)</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="onboarding-gemini-key"
                  data-testid="onboarding-gemini-key-input"
                  type={showGeminiKey ? 'text' : 'password'}
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  autoComplete="off"
                  className="flex-1 min-w-0 min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-mono bg-[#111317] text-[#F1F5F9] border border-white/10 focus:outline-none focus:border-[#14B8A6]"
                />
                <button
                  type="button"
                  onClick={() => setShowGeminiKey((v) => !v)}
                  aria-label={showGeminiKey ? 'Gemini API-Key verbergen' : 'Gemini API-Key anzeigen'}
                  className="min-h-[44px] min-w-[44px] rounded-xl bg-[#111317] text-[#94A3B8] hover:text-[#F1F5F9] border border-white/10 flex items-center justify-center shrink-0 cursor-pointer bandit-pressable"
                >
                  {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 min-h-[44px] text-xs font-semibold text-[#14B8A6] hover:underline break-words"
              >
                <span>Eigenen Key bei Google AI Studio holen</span>
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              </a>
            </div>

            {/* Progressive Disclosure: Azure Speech Key & Region standardmäßig zugeklappt */}
            <div className="rounded-2xl bg-[#111317] border border-white/10 overflow-hidden">
              <button
                type="button"
                aria-expanded={azureOpen}
                data-testid="onboarding-azure-toggle"
                onClick={() => setAzureOpen((v) => !v)}
                className="w-full min-h-[44px] px-3.5 py-2.5 flex items-center justify-between gap-2 text-left cursor-pointer"
              >
                <span className="text-xs font-bold text-[#F1F5F9] min-w-0 break-words">
                  Azure Speech Key &amp; Region (für Stimme „Gisela“, optional)
                </span>
                {azureOpen ? (
                  <ChevronUp className="w-4 h-4 text-[#94A3B8] shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[#94A3B8] shrink-0" />
                )}
              </button>

              {azureOpen && (
                <div className="px-3.5 pb-3.5 pt-2 border-t border-white/5 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <input
                      type={showAzureKey ? 'text' : 'password'}
                      value={azureSpeechKey}
                      onChange={(e) => setAzureSpeechKey(e.target.value)}
                      placeholder="Azure Speech Key..."
                      aria-label="Azure Speech Key"
                      className="flex-1 min-w-0 min-h-[44px] px-3 py-2 rounded-xl text-xs font-mono bg-[#191C22] text-[#F1F5F9] border border-white/10 focus:outline-none focus:border-[#14B8A6]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAzureKey((v) => !v)}
                      aria-label={showAzureKey ? 'Azure Key verbergen' : 'Azure Key anzeigen'}
                      className="min-h-[44px] min-w-[44px] rounded-xl bg-[#191C22] text-[#94A3B8] hover:text-[#F1F5F9] border border-white/10 flex items-center justify-center shrink-0 cursor-pointer"
                    >
                      {showAzureKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={azureSpeechRegion}
                    onChange={(e) => setAzureSpeechRegion(e.target.value)}
                    placeholder="Azure Region (z. B. germanywestcentral)"
                    aria-label="Azure Region"
                    className="w-full min-w-0 min-h-[44px] px-3 py-2 rounded-xl text-xs font-mono bg-[#191C22] text-[#F1F5F9] border border-white/10 focus:outline-none focus:border-[#14B8A6]"
                  />
                </div>
              )}
            </div>

            {/* Ruhiger Honig-Gold-Hinweis */}
            <div
              className="p-3.5 rounded-2xl border text-xs font-medium leading-relaxed break-words"
              style={{
                backgroundColor: 'rgba(229,169,60,0.10)',
                borderColor: 'rgba(229,169,60,0.25)',
                color: DESIGN_TOKENS.accentHoney
              }}
            >
              Auch ohne Key nutzbar – Spracheingabe &amp; lokale Listen laufen sofort offline.
            </div>
          </div>
        )}

        {/* ── Schritt 3 – Einhand-Bedienung & Start ── */}
        {step === 3 && (
          <div className="space-y-4" data-testid="onboarding-step-3">
            <div className="space-y-2">
              <div className="text-xs font-bold text-[#F1F5F9]">
                Parkplatz fürs Sechseck (Einhand-Bedienung):
              </div>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { id: 'left', label: 'Links' },
                    { id: 'center', label: 'Mitte' },
                    { id: 'right', label: 'Rechts' }
                  ] as const
                ).map((pos) => {
                  const active = thumbHubPosition === pos.id;
                  return (
                    <button
                      type="button"
                      key={pos.id}
                      data-testid={`onboarding-pos-${pos.id}`}
                      onClick={() => setThumbHubPosition(pos.id)}
                      className={`flex-1 min-w-[90px] min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer bandit-pressable ${
                        active
                          ? 'bg-[#0D9488] text-white border-[#14B8A6]'
                          : 'bg-[#111317] text-[#94A3B8] border-white/10 hover:text-[#F1F5F9]'
                      }`}
                    >
                      {pos.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold text-[#F1F5F9] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#14B8A6] shrink-0" />
                <span>Begleiter-Start beim Tippen:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  data-testid="onboarding-companion-compact"
                  onClick={() => setCompanionStartExpanded(false)}
                  className={`flex-1 min-w-[140px] min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer bandit-pressable ${
                    !companionStartExpanded
                      ? 'bg-[#0D9488] text-white border-[#14B8A6]'
                      : 'bg-[#111317] text-[#94A3B8] border-white/10 hover:text-[#F1F5F9]'
                  }`}
                >
                  Kompakt Stufe 1
                </button>
                <button
                  type="button"
                  data-testid="onboarding-companion-expanded"
                  onClick={() => setCompanionStartExpanded(true)}
                  className={`flex-1 min-w-[140px] min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer bandit-pressable ${
                    companionStartExpanded
                      ? 'bg-[#0D9488] text-white border-[#14B8A6]'
                      : 'bg-[#111317] text-[#94A3B8] border-white/10 hover:text-[#F1F5F9]'
                  }`}
                >
                  Direkt Kontext-Chat Stufe 2
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Fußzeile: Navigation & Abschluss ── */}
        <div className="pt-2 border-t border-white/5 flex flex-wrap items-center justify-between gap-2">
          {step > 1 ? (
            <button
              key="onboarding-back"
              type="button"
              data-testid="onboarding-back-btn"
              onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
              className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold text-[#94A3B8] hover:text-[#F1F5F9] bg-[#111317] border border-white/10 inline-flex items-center gap-1.5 cursor-pointer bandit-pressable"
            >
              <ChevronLeft className="w-4 h-4 shrink-0" />
              <span>Zurück</span>
            </button>
          ) : (
            <span className="text-xs text-[#94A3B8]">Jederzeit in Bereich 5 änderbar</span>
          )}

          {step < 3 ? (
            <button
              key={`onboarding-next-step-${step}`}
              type="button"
              data-testid="onboarding-next-btn"
              disabled={step === 1 && !canProceedFromStep1}
              onClick={() => setStep((s) => (s === 1 ? 2 : 3))}
              className="min-h-[44px] px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#0D9488] disabled:opacity-45 disabled:cursor-not-allowed inline-flex items-center gap-1.5 ml-auto cursor-pointer bandit-pressable"
            >
              <span>Weiter</span>
              <ChevronRight className="w-4 h-4 shrink-0" />
            </button>
          ) : (
            <button
              key="onboarding-finish"
              type="button"
              data-testid="onboarding-finish-btn"
              onClick={handleFinish}
              className="flex-1 sm:flex-initial min-h-[46px] px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#0D9488] inline-flex items-center justify-center gap-1.5 ml-auto cursor-pointer bandit-pressable"
            >
              <span>Einrichtung abschließen ✓</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
