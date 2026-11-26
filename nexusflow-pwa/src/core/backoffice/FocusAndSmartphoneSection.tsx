import React from 'react';
import { Brain, Compass, HeartHandshake } from 'lucide-react';
import { AmbientLightMode, DayBlockId, Project, THEME } from '../../types';
import { BanditUserPreferences } from '../../services/aiRouter';
import { exportDayPlanIcs } from '../../services/exportBridge';
import { ZentraleAccordion, ZentraleToggleRow } from './ZentralePrimitives';

interface FocusAndSmartphoneSectionProps {
  isOpen: boolean;
  onToggle: () => void;
  projects: Project[];
  prefs: BanditUserPreferences;
  onUpdatePrefs: (patch: Partial<BanditUserPreferences>) => void;
  ambientLightMode: AmbientLightMode;
  onChangeAmbientLightMode: (mode: AmbientLightMode) => void;
  thumbHubEnabled: boolean;
  thumbHubPosition: 'left' | 'center' | 'right';
  onToggleThumbHub?: (enabled: boolean) => void;
  onChangeThumbHubPosition?: (pos: 'left' | 'center' | 'right') => void;
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
  prefs,
  onUpdatePrefs,
  ambientLightMode,
  onChangeAmbientLightMode,
  thumbHubEnabled,
  thumbHubPosition,
  onToggleThumbHub,
  onChangeThumbHubPosition,
  onAssignDayBlock,
  onAutoStructureDay,
  onOpenFlip7Cover,
  onOpenRealityModal,
  onOpenSelfCheckModal
}) => {
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
                title: '4. Zeitblindheits-Puffer (+25 %) & Haptik-Impuls',
                desc: 'Rechnet 25 % Pufferzeit für Rüstwege ein und vibriert beim Abhaken'
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
            ].map((d) => (
              <button
                type="button"
                key={d.id}
                onClick={() => onUpdatePrefs({ uiDensity: d.id as BanditUserPreferences['uiDensity'] })}
                className={`flex-1 min-w-[104px] min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border transition active:scale-95 cursor-pointer ${
                  prefs.uiDensity === d.id
                    ? 'text-white border-white/30'
                    : 'bg-[#242930] text-[#94A3B8] border-white/5'
                }`}
                style={
                  prefs.uiDensity === d.id ? { backgroundColor: THEME.accentPrimary } : {}
                }
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

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
        <div className="grid grid-cols-2 gap-2">
          {onOpenRealityModal && (
            <button
              type="button"
              onClick={onOpenRealityModal}
              className="min-h-[44px] p-2.5 rounded-xl bg-[#242930] border border-white/5 text-xs font-bold text-white flex items-center justify-center gap-2 active:scale-95 transition cursor-pointer"
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
      </div>
    </ZentraleAccordion>
  );
};
