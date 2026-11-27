import React, { useState } from 'react';
import { Brain, ChevronDown, ChevronUp, Compass, HeartHandshake } from 'lucide-react';
import { AmbientLightMode, BanditUserPreferences, DayBlockId, Project, SelfCheckEntry, THEME } from '../../types';
import { exportDayPlanIcs } from '../../services/exportBridge';
import { SelfCheckHistoryPanel } from '../../plugins/mindfulChecks';
import { ZentraleAccordion, ZentraleToggleRow } from './ZentralePrimitives';

interface FocusAndSmartphoneSectionProps {
  isOpen: boolean;
  onToggle: () => void;
  projects: Project[];
  selfChecks?: SelfCheckEntry[];
  prefs: BanditUserPreferences;
  onUpdatePrefs: (patch: Partial<BanditUserPreferences>) => void;
  ambientLightMode: AmbientLightMode;
  onChangeAmbientLightMode: (mode: AmbientLightMode) => void;
  thumbHubEnabled: boolean;
  thumbHubPosition: 'left' | 'center' | 'right';
  onToggleThumbHub?: (enabled: boolean) => void;
  onChangeThumbHubPosition?: (pos: 'left' | 'center' | 'right') => void;
  realityCheckEnabled?: boolean;
  onToggleRealityCheck?: () => void;
  onAssignDayBlock: (projectId: string, taskId: string, block: DayBlockId | null) => void;
  onAutoStructureDay: () => void;
  onOpenFlip7Cover: () => void;
  onOpenRealityModal?: () => void;
  onOpenSelfCheckModal?: () => void;
}

/**
 * Bereich 2 der Zentrale: ADHS-Helfer, Optik, Daumen-Steuerung, Tagesplaner & Cover-Display.
 */
export const FocusAndSmartphoneSection: React.FC<FocusAndSmartphoneSectionProps> = ({
  isOpen,
  onToggle,
  projects,
  selfChecks = [],
  prefs,
  onUpdatePrefs,
  ambientLightMode,
  onChangeAmbientLightMode,
  thumbHubEnabled,
  thumbHubPosition,
  onToggleThumbHub,
  onChangeThumbHubPosition,
  realityCheckEnabled = true,
  onToggleRealityCheck,
  onAssignDayBlock,
  onAutoStructureDay,
  onOpenFlip7Cover,
  onOpenRealityModal,
  onOpenSelfCheckModal
}) => {
  const [historyOpen, setHistoryOpen] = useState(false);
  const activeProjects = projects.filter((p) => !p.archived);
  const allOpenTasks = activeProjects.flatMap((p) =>
    p.tasks.filter((t) => !t.completed).map((t) => ({ project: p, task: t }))
  );

  return (
    <ZentraleAccordion
      number={2}
      title="Fokus, Bedienung & Smartphone"
      subtitle="ADHS, Optik, Daumen-Steuerung, Tagesplaner & Cover-Display"
      statusText={prefs.adhdMasterEnabled ? 'ADHS aktiv' : 'Standard'}
      icon={<Brain className="w-5 h-5 text-[#14B8A6]" />}
      badge={
        prefs.adhdMasterEnabled ? (
          <span
            className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"
            title="ADHS-Helfer aktiv"
          />
        ) : undefined
      }
      isOpen={isOpen}
      onToggle={onToggle}
    >
      {/* ── ADHS & Fokus ── */}
      <div className="space-y-3">
        <div className="text-xs font-extrabold uppercase tracking-wider text-[#94A3B8] px-1 pt-1">
          ADHS- &amp; Fokus-Unterstützung
        </div>

        <ZentraleToggleRow
          title="ADHS-Unterstützung insgesamt"
          description="Hauptschalter für alle 4 Hintergrund-Helfer"
          checked={prefs.adhdMasterEnabled}
          onToggle={() => onUpdatePrefs({ adhdMasterEnabled: !prefs.adhdMasterEnabled })}
          onLabel="Eingeschaltet"
          offLabel="Ausgeschaltet"
        />

        {prefs.adhdMasterEnabled && (
          <div className="space-y-2 pt-1">
            {[
              {
                key: 'adhdFocusAnchor' as const,
                title: '1. „Wo war ich gerade?"-Anker (Roter Faden)',
                desc: 'Pinnt die aktuell bearbeitete Aufgabe dauerhaft oben an'
              },
              {
                key: 'adhdSingleTaskMode' as const,
                title: '2. „1-Fokus-Blende" gegen Aufgaben-Paralyse',
                desc: 'Schalter in den Tasks, der nur den nächsten einzelnen Punkt zeigt'
              },
              {
                key: 'adhdTwoMinuteStarter' as const,
                title: '3. Automatischer „2-Minuten-Einstieg" durch KI',
                desc: 'KI ergänzt bei neuen Aufgaben sofort den ersten kleinen Handgriff'
              },
              {
                key: 'adhdTimeBufferAndHaptics' as const,
                title: '4. Zeitblindheits-Puffer (+25 %)',
                desc: 'Rechnet 25 % Pufferzeit für Rüstwege ein (Vibration separat steuerbar)'
              }
            ].map((item) => (
              <ZentraleToggleRow
                key={item.key}
                title={item.title}
                description={item.desc}
                checked={!!prefs[item.key]}
                onToggle={() => onUpdatePrefs({ [item.key]: !prefs[item.key] })}
                onLabel="An"
                offLabel="Aus"
                containerClassName="p-3 rounded-2xl bg-[#242930] border border-white/5"
              />
            ))}
          </div>
        )}

        <ZentraleToggleRow
          title="Antriebs-Würfel („Schweinehund-Pool“)"
          description="Markiert Hürden-Aufgaben und bietet im 1-Fokus-Modus den schuldfreien Würfel zum Weiterdrehen."
          checked={prefs.driveDiceEnabled !== false}
          onToggle={() =>
            onUpdatePrefs({ driveDiceEnabled: !(prefs.driveDiceEnabled !== false) })
          }
          onLabel="An"
          offLabel="Aus"
          tone="honey"
          testId="toggle-drive-dice"
        />

        <ZentraleToggleRow
          title="Energie-gekoppelter Tagesplaner (Akku-Filter)"
          description="Filtert Aufgaben nach aktuellem Energielevel (Niedrig / Mittel / Hoch)."
          checked={prefs.energyPlannerEnabled !== false}
          onToggle={() =>
            onUpdatePrefs({ energyPlannerEnabled: !(prefs.energyPlannerEnabled !== false) })
          }
          onLabel="An"
          offLabel="Aus"
          testId="toggle-energy-planner"
        />

        <ZentraleToggleRow
          title="Erweiterte Task-Felder (Priorität, Dauer & Tagesblock)"
          description="Zeigt beim Bearbeiten und Anlegen von Aufgaben Chips für Priorität, Minuten und Tagesblock."
          checked={prefs.taskExtendedMetaEnabled !== false}
          onToggle={() =>
            onUpdatePrefs({
              taskExtendedMetaEnabled: !(prefs.taskExtendedMetaEnabled !== false)
            })
          }
          onLabel="An"
          offLabel="Aus"
          testId="toggle-task-extended-meta"
        />

        <ZentraleToggleRow
          title="„Jetzt-Vorbühne“ (A+C-Modus über Aufgabenliste)"
          description="Zeigt oben eine einzelne Fokus-Aufgabe zum Durchblättern und klappt die restliche Liste darunter ruhig ein."
          checked={prefs.nowStageEnabled === true}
          onToggle={() =>
            onUpdatePrefs({
              nowStageEnabled: !(prefs.nowStageEnabled === true)
            })
          }
          onLabel="An"
          offLabel="Aus"
          tone="honey"
          testId="toggle-now-stage"
        />
      </div>

      {/* ── Optik & Darstellung ── */}
      <div className="space-y-3">
        <div className="text-xs font-extrabold uppercase tracking-wider text-[#94A3B8] px-1 pt-1">
          Optik &amp; Darstellung
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-[#94A3B8] block font-medium">
            Darstellungs-Dichte (Touch- &amp; Textgröße):
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'compact', label: 'Kompakt' },
              { id: 'standard', label: 'Standard' },
              { id: 'large', label: 'Groß (Baustelle)' }
            ].map((d) => {
              const isSelected = (prefs.uiDensity || 'standard') === d.id;
              return (
                <button
                  type="button"
                  key={d.id}
                  data-testid={`ui-density-${d.id}`}
                  onClick={() => onUpdatePrefs({ uiDensity: d.id as BanditUserPreferences['uiDensity'] })}
                  className={`flex-1 min-w-[104px] min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border transition active:scale-95 cursor-pointer ${
                    isSelected
                      ? 'text-white border-white/30'
                      : 'bg-[#242930] text-[#94A3B8] border-white/5'
                  }`}
                  style={
                    isSelected ? { backgroundColor: THEME.accentPrimary } : {}
                  }
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>

        <ZentraleToggleRow
          title="Organische Begleiter-Animation"
          description="Puls-Ringe & sanfte Bewegung beim Zuhören und Öffnen"
          checked={prefs.organicMotion !== false}
          onToggle={() => onUpdatePrefs({ organicMotion: !(prefs.organicMotion !== false) })}
          onLabel="An"
          offLabel="Aus"
          testId="toggle-organic-motion"
        />

        <div className="p-3.5 rounded-2xl bg-[#242930] border border-white/5 space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="text-xs text-white font-bold">
              Organische Hintergrundbeleuchtung
            </div>
            <span className="text-xs text-[#94A3B8] font-mono">
              {ambientLightMode === 'off'
                ? 'Aus'
                : ambientLightMode === 'static'
                  ? 'Statisch'
                  : 'Schimmern'}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'off' as const, label: 'Aus', ariaLabel: 'Hintergrundbeleuchtung Aus' },
              {
                id: 'static' as const,
                label: 'Statisch',
                ariaLabel: 'Hintergrundbeleuchtung Statisch'
              },
              {
                id: 'shimmer' as const,
                label: 'Schimmern',
                ariaLabel: 'Hintergrundbeleuchtung Sanftes Schimmern'
              }
            ].map((m) => (
              <button
                type="button"
                key={m.id}
                aria-label={m.ariaLabel}
                onClick={() => onChangeAmbientLightMode(m.id)}
                className={`flex-1 min-w-[88px] min-h-[44px] px-2.5 py-2 rounded-xl text-xs font-bold border transition active:scale-95 cursor-pointer ${
                  ambientLightMode === m.id
                    ? 'bg-[#0A9396] text-white border-[#14B8A6]'
                    : 'bg-[#181A1B] text-[#94A3B8] border-white/10 hover:text-white'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="text-xs text-[#94A3B8] leading-snug">
            {ambientLightMode === 'off' &&
              'Komplett ruhiger #111317-Hintergrund ohne Beleuchtung.'}
            {ambientLightMode === 'static' &&
              'Sehr dezenter Grundschimmer (~8–10 % Deckkraft) ohne Bewegung.'}
            {ambientLightMode === 'shimmer' &&
              'Sanft weichgezeichnete Farbflächen im ruhigen GPU-Schimmern (18–22s Zyklus).'}
          </div>
        </div>
      </div>

      {/* ── Einhand-Bedienung & Daumen-Steuerung ── */}
      <div className="space-y-3">
        <div className="text-xs font-extrabold uppercase tracking-wider text-[#94A3B8] px-1 pt-1">
          Einhand-Bedienung &amp; Daumen-Steuerung
        </div>

        <ZentraleToggleRow
          title="Sechskant-Daumenmodul (Einhand-Steuerung)"
          description="Ergonomischer Sechskant mit Daumen-Fächer statt klassischer unterer Leiste"
          checked={thumbHubEnabled}
          onToggle={() => onToggleThumbHub?.(!thumbHubEnabled)}
          onLabel="Eingeschaltet"
          offLabel="Ausgeschaltet"
          ariaLabel="Sechskant-Daumenmodul umschalten"
        />

        {thumbHubEnabled && (
          <div className="space-y-1.5 p-3.5 rounded-2xl bg-[#242930] border border-white/5">
            <label className="text-xs text-[#94A3B8] block font-medium">
              Parkplatz für Einhand-Bedienung:
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'left', label: 'Links' },
                { id: 'center', label: 'Mitte' },
                { id: 'right', label: 'Rechts' }
              ].map((pos) => (
                <button
                  type="button"
                  key={pos.id}
                  onClick={() =>
                    onChangeThumbHubPosition?.(pos.id as 'left' | 'center' | 'right')
                  }
                  className={`min-h-[44px] py-2 rounded-xl text-xs font-bold border transition active:scale-95 cursor-pointer ${
                    thumbHubPosition === pos.id
                      ? 'text-white border-white/30'
                      : 'bg-[#181A1B] text-[#94A3B8] border-white/5 hover:text-white'
                  }`}
                  style={
                    thumbHubPosition === pos.id
                      ? { backgroundColor: THEME.accentPrimary }
                      : {}
                  }
                >
                  {pos.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <ZentraleToggleRow
          title="Haptik / Vibration"
          description="Kurzer Vibrations-Impuls bei Aktionen (entkoppelt vom +25 %-Zeitpuffer)"
          checked={prefs.hapticsEnabled !== false}
          onToggle={() => onUpdatePrefs({ hapticsEnabled: !(prefs.hapticsEnabled !== false) })}
          onLabel="An"
          offLabel="Aus"
          testId="toggle-haptics-enabled"
        />

        <div className="p-3.5 rounded-2xl bg-[#242930] border border-white/5 space-y-2">
          <label className="text-xs text-[#94A3B8] block font-medium">
            Einkaufswagen-Startmodus:
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'floating' as const, label: 'Schwebend (Overlay)' },
              { id: 'tab' as const, label: 'Vollbild-Tab' }
            ].map((modeOpt) => {
              const isSelected = (prefs.cartOpenMode || 'floating') === modeOpt.id;
              return (
                <button
                  type="button"
                  key={modeOpt.id}
                  data-testid={`cart-open-mode-${modeOpt.id}`}
                  onClick={() => onUpdatePrefs({ cartOpenMode: modeOpt.id })}
                  className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border transition active:scale-95 cursor-pointer ${
                    isSelected
                      ? 'text-white border-white/30'
                      : 'bg-[#181A1B] text-[#94A3B8] border-white/10 hover:text-white'
                  }`}
                  style={isSelected ? { backgroundColor: THEME.accentPrimary } : {}}
                >
                  {modeOpt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Tagesplaner & Kalender-Export (390-px-Fix) ── */}
      <div className="space-y-3">
        <div className="text-xs font-extrabold uppercase tracking-wider text-[#94A3B8] px-1 pt-1">
          Tagesplaner &amp; Kalender-Export ({allOpenTasks.length} offen)
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onAutoStructureDay}
            className="flex-1 min-w-[170px] min-h-[44px] py-2 px-3.5 rounded-xl text-xs font-bold text-white active:scale-95 transition cursor-pointer"
            style={{ backgroundColor: THEME.accentPrimary }}
          >
            Tag automatisch strukturieren
          </button>
          <button
            type="button"
            onClick={() => exportDayPlanIcs(projects)}
            className="min-h-[44px] py-2 px-4 rounded-xl text-xs font-semibold bg-[#242930] text-white border border-white/10 active:scale-95 transition cursor-pointer"
          >
            .ics Export
          </button>
        </div>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {allOpenTasks.map(({ project, task }) => (
            <div
              key={task.id}
              className="p-3 rounded-2xl bg-[#242930] border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div className="min-w-0 flex-1">
                <div className="text-xs text-[#14B8A6] font-bold break-words">
                  {project.name}
                </div>
                <div className="text-xs text-white font-medium break-words">
                  {task.title}
                </div>
              </div>
              <select
                value={task.dayBlock || ''}
                onChange={(e) =>
                  onAssignDayBlock(
                    project.id,
                    task.id,
                    (e.target.value || null) as DayBlockId | null
                  )
                }
                aria-label={`Tagesblock für ${task.title}`}
                className="w-full sm:w-auto min-h-[44px] px-3 py-1.5 rounded-xl text-xs bg-[#181A1B] text-white border border-white/10 shrink-0"
              >
                <option value="">Kein Block</option>
                <option value="morning">Morgen</option>
                <option value="focus">Fokus</option>
                <option value="errands">Besorgung</option>
                <option value="evening">Abend</option>
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* ── Frontdisplay & Checks ── */}
      <div className="space-y-3">
        <div className="text-xs font-extrabold uppercase tracking-wider text-[#94A3B8] px-1 pt-1">
          Flip-7-Cover-Display &amp; Selbst-Checks
        </div>
        <button
          type="button"
          onClick={onOpenFlip7Cover}
          className="w-full min-h-[44px] py-2.5 rounded-xl text-xs font-bold text-white active:scale-95 transition cursor-pointer"
          style={{ backgroundColor: THEME.accentPrimary }}
        >
          Frontdisplay-Kompaktansicht öffnen
        </button>

        <ZentraleToggleRow
          title="Flip-7 Auto-Erkennung"
          description="Erkennt schmales Cover-Display automatisch beim Zuklappen (?mode=cover bleibt immer aktiv)"
          checked={prefs.flipCoverAutoDetect !== false}
          onToggle={() =>
            onUpdatePrefs({ flipCoverAutoDetect: !(prefs.flipCoverAutoDetect !== false) })
          }
          onLabel="An"
          offLabel="Aus"
          testId="toggle-flip-cover-auto-detect"
        />

        <ZentraleToggleRow
          title="Werkstatt-Wachbleib-Modus (Screen Wake Lock)"
          description="Hält das Smartphone-Display beim aktiven Sprechen und Zuhören automatisch wach"
          checked={prefs.wakeLockEnabled !== false}
          onToggle={() =>
            onUpdatePrefs({ wakeLockEnabled: !(prefs.wakeLockEnabled !== false) })
          }
          onLabel="An"
          offLabel="Aus"
          testId="toggle-wake-lock"
        />

        <ZentraleToggleRow
          title="Geteilte Inhalte annehmen (Teilen → BANDIT.OS)"
          description="Übernimmt geteilte Texte oder Links aus anderen Apps direkt in das Eingabefeld"
          checked={prefs.shareTargetEnabled !== false}
          onToggle={() =>
            onUpdatePrefs({ shareTargetEnabled: !(prefs.shareTargetEnabled !== false) })
          }
          onLabel="An"
          offLabel="Aus"
          testId="toggle-share-target"
        />

        <ZentraleToggleRow
          title="Homescreen-Schnellstarts (?action=…)"
          description="Aktiviert Direktstarts über das App-Icon für Sprechen, Beleg-Scan und Einkauf"
          checked={prefs.appShortcutsEnabled !== false}
          onToggle={() =>
            onUpdatePrefs({ appShortcutsEnabled: !(prefs.appShortcutsEnabled !== false) })
          }
          onLabel="An"
          offLabel="Aus"
          testId="toggle-app-shortcuts"
        />

        {onToggleRealityCheck && (
          <ZentraleToggleRow
            title="Reality-Check aktivieren"
            description="3-Fragen-Fokus-Impuls im Alltag griffbereit halten"
            checked={realityCheckEnabled}
            onToggle={onToggleRealityCheck}
            onLabel="An"
            offLabel="Aus"
            testId="toggle-reality-check"
          />
        )}

        <div className="grid grid-cols-2 gap-2">
          {onOpenRealityModal && (
            <button
              type="button"
              disabled={!realityCheckEnabled}
              onClick={onOpenRealityModal}
              className="min-h-[44px] p-2.5 rounded-xl bg-[#242930] border border-white/5 text-xs font-bold text-white flex items-center justify-center gap-2 active:scale-95 transition cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
            >
              <Compass className="w-4 h-4 text-[#14B8A6] shrink-0" />
              <span>Reality-Check</span>
            </button>
          )}
          {onOpenSelfCheckModal && (
            <button
              type="button"
              onClick={onOpenSelfCheckModal}
              className="min-h-[44px] p-2.5 rounded-xl bg-[#242930] border border-white/5 text-xs font-bold text-white flex items-center justify-center gap-2 active:scale-95 transition cursor-pointer"
            >
              <HeartHandshake className="w-4 h-4 text-[#14B8A6] shrink-0" />
              <span>Selbst-Check</span>
            </button>
          )}
        </div>

        {/* Standardmäßig zugeklappte Unterkarte für Selbst-Check-Verlauf */}
        <div className="rounded-2xl bg-[#242930] border border-white/5 overflow-hidden">
          <button
            type="button"
            aria-expanded={historyOpen}
            data-testid="toggle-selfcheck-history"
            onClick={() => setHistoryOpen((v) => !v)}
            className="w-full min-h-[44px] px-3.5 py-2.5 flex items-center justify-between gap-2 text-left active:bg-white/5 transition cursor-pointer"
          >
            <span className="text-xs font-bold text-[#F1F5F9]">Selbst-Check-Verlauf</span>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-mono text-[#94A3B8]">
                {selfChecks.length} {selfChecks.length === 1 ? 'Eintrag' : 'Einträge'}
              </span>
              {historyOpen ? (
                <ChevronUp className="w-4 h-4 text-[#94A3B8]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[#94A3B8]" />
              )}
            </div>
          </button>
          {historyOpen && (
            <div className="px-3.5 pb-3.5 pt-2 border-t border-white/5">
              {selfChecks.length === 0 ? (
                <p className="text-xs text-[#94A3B8]">
                  Noch keine Selbst-Checks gespeichert.
                </p>
              ) : (
                <SelfCheckHistoryPanel entries={selfChecks} />
              )}
            </div>
          )}
        </div>
      </div>
    </ZentraleAccordion>
  );
};
