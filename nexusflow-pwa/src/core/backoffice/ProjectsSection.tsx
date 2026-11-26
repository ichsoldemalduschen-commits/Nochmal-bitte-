import React, { useState } from 'react';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Download,
  Plus,
  Puzzle,
  RefreshCw,
  Settings
} from 'lucide-react';
import { DomainType, Project } from '../../types';
import { DESIGN_TOKENS } from '../../config/designTokens';
import { PLUGIN_REGISTRY } from '../../plugins/registry';
import { downloadProjectJson } from '../../services/storage';
import { ZentraleAccordion, ZentraleToggleRow } from './ZentralePrimitives';

const COLOR_PRESETS = [
  { hex: DESIGN_TOKENS.projectPresets.pizzaBandit, label: 'Petrol' },
  { hex: DESIGN_TOKENS.projectPresets.backstube, label: 'Terrakotta' },
  { hex: DESIGN_TOKENS.projectPresets.privat, label: 'Rauch-Violett' },
  { hex: DESIGN_TOKENS.projectPresets.olive, label: 'Oliv-Moos' },
  { hex: DESIGN_TOKENS.projectPresets.sand, label: 'Kalk-Sand' }
];

interface ProjectsSectionProps {
  isOpen: boolean;
  onToggle: () => void;
  projects: Project[];
  onToggleArchiveProject: (projectId: string) => void;
  onUpdateProject?: (projectId: string, patch: Partial<Project>) => void;
  onTogglePluginForProject: (projectId: string, pluginId: string) => void;
  onToggleTabForProject?: (
    projectId: string,
    tab: 'tasks' | 'cart' | 'knowledge' | 'extras'
  ) => void;
  onUploadProjectLogo?: (projectId: string, file: File) => void;
  onResetProjectLogo?: (projectId: string) => void;
  onCreateProject?: (input: { name: string; subtitle?: string; domain: DomainType }) => void;
  onResetProjectStructure?: () => void;
  onNotify: (msg: string) => void;
}

/**
 * Bereich 1 der Zentrale: Projekte, Farben, Module, Plugins, Archiv & sicheres Stammdaten-Reset.
 */
export const ProjectsSection: React.FC<ProjectsSectionProps> = ({
  isOpen,
  onToggle,
  projects,
  onToggleArchiveProject,
  onUpdateProject,
  onTogglePluginForProject,
  onToggleTabForProject,
  onUploadProjectLogo,
  onResetProjectLogo,
  onCreateProject,
  onResetProjectStructure,
  onNotify
}) => {
  const [expandedProjectIds, setExpandedProjectIds] = useState<Record<string, boolean>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSubtitle, setNewSubtitle] = useState('');
  const [newDomain, setNewDomain] = useState<DomainType>('business');
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  const activeProjects = projects.filter((p) => !p.archived);

  const toggleProjectExpand = (id: string) => {
    setExpandedProjectIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleProjectLogoUpload = (projectId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement | null;
      const file = target?.files?.[0];
      if (file && onUploadProjectLogo) {
        onUploadProjectLogo(projectId, file);
      }
    };
    input.click();
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newName.trim();
    if (!clean || !onCreateProject) return;
    onCreateProject({
      name: clean,
      subtitle: newSubtitle.trim() || undefined,
      domain: newDomain
    });
    setNewName('');
    setNewSubtitle('');
    setNewDomain('business');
    setCreateOpen(false);
  };

  return (
    <ZentraleAccordion
      number={1}
      title="Projekte & Werkzeuge"
      subtitle={`${projects.length} Projekte · Module, Farben & Export`}
      statusText={`${activeProjects.length} aktiv`}
      icon={<Settings className="w-5 h-5 text-[#14B8A6]" />}
      isOpen={isOpen}
      onToggle={onToggle}
    >
      {/* ── Neues Projekt anlegen (aufklappbar) ── */}
      {onCreateProject && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setCreateOpen((v) => !v)}
            className="w-full min-h-[44px] px-3.5 py-2 rounded-2xl text-xs font-bold text-[#F1F5F9] bg-[#242930] hover:bg-[#2A3038] border border-white/10 flex items-center justify-center gap-2 active:scale-95 transition cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#14B8A6]" />
            <span>+ Neues Projekt</span>
          </button>

          {createOpen && (
            <form
              onSubmit={handleCreateSubmit}
              className="p-3.5 rounded-2xl bg-[#111317] border border-white/10 space-y-2.5 animate-fadeIn"
            >
              <div className="text-xs font-bold text-[#F1F5F9]">Neues Projekt anlegen</div>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Projektname..."
                className="w-full min-w-0 min-h-[44px] px-3.5 py-2 rounded-xl text-xs bg-[#181A1B] text-[#F1F5F9] border border-white/10 focus:outline-none focus:border-[#14B8A6]"
              />
              <input
                type="text"
                value={newSubtitle}
                onChange={(e) => setNewSubtitle(e.target.value)}
                placeholder="Kurzbeschreibung (optional)..."
                className="w-full min-w-0 min-h-[44px] px-3.5 py-2 rounded-xl text-xs bg-[#181A1B] text-[#F1F5F9] border border-white/10 focus:outline-none focus:border-[#14B8A6]"
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNewDomain('business')}
                  className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    newDomain === 'business'
                      ? 'bg-[#0A9396] text-white border-[#14B8A6]'
                      : 'bg-[#181A1B] text-[#94A3B8] border-white/10'
                  }`}
                >
                  Business
                </button>
                <button
                  type="button"
                  onClick={() => setNewDomain('private')}
                  className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    newDomain === 'private'
                      ? 'bg-[#8B7EC8] text-white border-[#A79AE0]'
                      : 'bg-[#181A1B] text-[#94A3B8] border-white/10'
                  }`}
                >
                  Privat
                </button>
              </div>
              <div className="flex flex-wrap gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold text-[#94A3B8] bg-[#181A1B] border border-white/10 cursor-pointer"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={!newName.trim()}
                  className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#0D9488] disabled:opacity-50 cursor-pointer"
                >
                  Anlegen
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ── Projekt-Liste ── */}
      <div className="space-y-3">
        {projects.map((proj) => {
          const currentTabs = proj.enabledTabs || ['tasks', 'cart', 'knowledge', 'extras'];
          const isExpanded = !!expandedProjectIds[proj.id];
          const isPrivate = proj.domain === 'private';
          const isPermanent = proj.lifecycle !== 'project';
          const modules: Array<{
            id: 'tasks' | 'cart' | 'knowledge' | 'extras';
            label: string;
          }> = [
            { id: 'tasks', label: 'Tasks' },
            { id: 'cart', label: 'Einkauf' },
            { id: 'knowledge', label: 'Wissen' },
            { id: 'extras', label: 'Extras' }
          ];

          return (
            <div
              key={proj.id}
              className={`rounded-2xl border transition-all overflow-hidden ${
                proj.archived
                  ? 'bg-[#181A1B]/70 border-white/5 opacity-85'
                  : 'bg-[#111317] border-white/10'
              }`}
            >
              {/* Projekt Kopfzeile: Farbpunkt + voller Name + Pfeil */}
              <button
                type="button"
                onClick={() => toggleProjectExpand(proj.id)}
                className="w-full min-h-[52px] p-3.5 flex items-center justify-between gap-3 text-left active:bg-white/5 transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/20"
                    style={{ backgroundColor: proj.accentColor || '#14B8A6' }}
                  />
                  <span className="text-sm font-bold text-[#F1F5F9] break-words min-w-0">
                    {proj.name}
                    {proj.archived && (
                      <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-[#E5A93C]/20 text-[#E5A93C] font-semibold border border-[#E5A93C]/30">
                        Archiviert
                      </span>
                    )}
                  </span>
                </div>
                <div className="shrink-0">
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-[#94A3B8]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#94A3B8]" />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="px-3.5 pb-4 pt-3 border-t border-white/5 space-y-3 text-xs animate-fadeIn">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded font-semibold ${
                        isPermanent
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : 'bg-[#E5A93C]/15 text-[#E5A93C]'
                      }`}
                    >
                      {isPermanent ? 'Dauer-Begleiter' : 'Projekt'}
                    </span>
                    <span className="text-[#94A3B8]">•</span>
                    <span
                      className={`px-2 py-0.5 rounded font-semibold ${
                        isPrivate
                          ? 'bg-purple-500/15 text-purple-300'
                          : 'bg-teal-500/15 text-teal-300'
                      }`}
                    >
                      {isPrivate ? 'Privat' : 'Business'}
                    </span>
                  </div>

                  {/* Bild tauschen */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleProjectLogoUpload(proj.id)}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-2 active:scale-95 transition border border-white/10 bg-[#242930] hover:bg-[#2A3038] cursor-pointer"
                    >
                      <Camera className="w-4 h-4 text-[#14B8A6]" />
                      <span>Bild ändern</span>
                    </button>
                    {onResetProjectLogo && (
                      <button
                        type="button"
                        onClick={() => onResetProjectLogo(proj.id)}
                        className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold text-[#94A3B8] hover:text-white bg-[#242930] border border-white/5 active:scale-95 transition cursor-pointer"
                      >
                        Standard-Logo
                      </button>
                    )}
                  </div>

                  {/* Name bearbeiten */}
                  <div className="space-y-1">
                    <label className="text-[#94A3B8] font-medium block">Projekt-Name:</label>
                    <input
                      type="text"
                      value={proj.name}
                      onChange={(e) => onUpdateProject?.(proj.id, { name: e.target.value })}
                      className="w-full min-w-0 min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#181A1B] text-white border border-white/10 focus:outline-none focus:border-[#14B8A6]"
                    />
                  </div>

                  {/* Farbe bearbeiten */}
                  <div className="space-y-1">
                    <label className="text-[#94A3B8] font-medium block">Akzentfarbe:</label>
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="text"
                        value={proj.accentColor || '#14B8A6'}
                        onChange={(e) =>
                          onUpdateProject?.(proj.id, { accentColor: e.target.value })
                        }
                        className="flex-1 min-w-0 min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-mono bg-[#181A1B] text-white border border-white/10 focus:outline-none focus:border-[#14B8A6]"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      {COLOR_PRESETS.map((c) => (
                        <button
                          type="button"
                          key={c.hex}
                          onClick={() => onUpdateProject?.(proj.id, { accentColor: c.hex })}
                          className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center bg-[#181A1B] border border-white/10 active:scale-95 transition cursor-pointer"
                          title={`${c.label} ${c.hex}`}
                          aria-label={`${c.label} ${c.hex}`}
                        >
                          <span
                            className="w-5 h-5 rounded-full border border-white/30"
                            style={{ backgroundColor: c.hex }}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Lifecycle */}
                  <div className="space-y-1">
                    <label className="text-[#94A3B8] font-medium block">
                      Lebenszyklus (Dauer-Begleiter vs. Projekt):
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateProject?.(proj.id, { lifecycle: 'permanent' })
                        }
                        className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border transition active:scale-95 cursor-pointer ${
                          isPermanent
                            ? 'bg-[#0A9396] text-white border-[#14B8A6]'
                            : 'bg-[#181A1B] text-[#94A3B8] border-white/10 hover:text-white'
                        }`}
                      >
                        Dauer-Begleiter (permanent)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateProject?.(proj.id, { lifecycle: 'project' })
                        }
                        className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border transition active:scale-95 cursor-pointer ${
                          !isPermanent
                            ? 'bg-[#D97706] text-white border-[#F59E0B]'
                            : 'bg-[#181A1B] text-[#94A3B8] border-white/10 hover:text-white'
                        }`}
                      >
                        Austausch-Projekt (project)
                      </button>
                    </div>
                  </div>

                  {/* Domain */}
                  <div className="space-y-1">
                    <label className="text-[#94A3B8] font-medium block">
                      Bereich (Geschäftlich vs. Privat):
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateProject?.(proj.id, {
                            domain: 'business',
                            businessDomain: 'business'
                          })
                        }
                        className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border transition active:scale-95 cursor-pointer ${
                          !isPrivate
                            ? 'bg-[#0A9396] text-white border-[#14B8A6]'
                            : 'bg-[#181A1B] text-[#94A3B8] border-white/10 hover:text-white'
                        }`}
                      >
                        Business (Gewerblich)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateProject?.(proj.id, {
                            domain: 'private',
                            businessDomain: 'private'
                          })
                        }
                        className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border transition active:scale-95 cursor-pointer ${
                          isPrivate
                            ? 'bg-[#4F46E5] text-white border-[#818CF8]'
                            : 'bg-[#181A1B] text-[#94A3B8] border-white/10 hover:text-white'
                        }`}
                      >
                        Privat (Persönlich)
                      </button>
                    </div>
                  </div>

                  {/* Aktive Module (390-px-Fix: grid-cols-2 statt grid-cols-4) */}
                  <div className="space-y-1">
                    <label className="text-[#94A3B8] font-medium block">
                      Aktive Modul-Bereiche ({currentTabs.length} / 4 aktiv):
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {modules.map((m) => {
                        const isEnabled = currentTabs.includes(m.id);
                        return (
                          <button
                            type="button"
                            key={m.id}
                            onClick={() => onToggleTabForProject?.(proj.id, m.id)}
                            className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border flex items-center justify-center transition active:scale-95 cursor-pointer ${
                              isEnabled
                                ? 'bg-[#0A9396] text-white border-[#14B8A6]'
                                : 'bg-[#181A1B] text-[#94A3B8] border-white/10 hover:text-white'
                            }`}
                          >
                            {m.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Gesamt-Übersicht */}
                  <ZentraleToggleRow
                    title="Gesamt-Übersicht"
                    description={
                      proj.overviewEnabled !== false
                        ? 'Im Menü aktiv (alle Bereiche gemeinsam)'
                        : 'Ausgeblendet (nur gezielte Einzelbereiche)'
                    }
                    checked={proj.overviewEnabled !== false}
                    onToggle={() =>
                      onUpdateProject?.(proj.id, {
                        overviewEnabled: !(proj.overviewEnabled !== false)
                      })
                    }
                    onLabel="Aktiviert"
                    offLabel="Deaktiviert"
                    ariaLabel="Gesamt-Übersicht für dieses Projekt umschalten"
                    containerClassName="p-3 rounded-2xl bg-[#181A1B] border border-white/5"
                  />

                  {/* Vorschriften-Wächter */}
                  <ZentraleToggleRow
                    title="Vorschriften-Wächter (⚖️) im Fächer anzeigen"
                    description={
                      proj.legalWatchEnabled !== false
                        ? 'Im Daumen-Fächer aktiv'
                        : 'Ausgeblendet (geschlossene Schublade)'
                    }
                    checked={proj.legalWatchEnabled !== false}
                    onToggle={() =>
                      onUpdateProject?.(proj.id, {
                        legalWatchEnabled: !(proj.legalWatchEnabled !== false)
                      })
                    }
                    onLabel="An"
                    offLabel="Aus"
                    containerClassName="p-3 rounded-2xl bg-[#181A1B] border border-white/5"
                  />

                  {/* Einzel-JSON-Export & Archivieren */}
                  <div className="flex gap-2 flex-wrap pt-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadProjectJson(proj);
                        onNotify(`Projekt "${proj.name}" als JSON heruntergeladen.`);
                      }}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#242930] hover:bg-[#2A3038] text-white border border-white/10 flex items-center gap-1.5 active:scale-95 transition cursor-pointer"
                      title="Einzelnes Projekt als JSON sichern"
                    >
                      <Download className="w-3.5 h-3.5 text-[#14B8A6]" />
                      <span>JSON</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleArchiveProject(proj.id);
                      }}
                      className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold border active:scale-95 transition cursor-pointer ${
                        proj.archived
                          ? 'bg-[#0A9396] text-white border-[#14B8A6]'
                          : 'bg-[#242930] text-[#94A3B8] hover:text-white border-white/10'
                      }`}
                    >
                      {proj.archived ? 'Reaktivieren' : 'Archivieren'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Plugins pro Projekt ── */}
      {PLUGIN_REGISTRY.map((plugin) => (
        <div
          key={plugin.id}
          className="p-3 rounded-2xl bg-[#242930] border border-white/5 space-y-2"
        >
          <div className="text-xs font-bold text-white flex items-center gap-1.5">
            <Puzzle className="w-4 h-4 text-[#14B8A6] shrink-0" />
            <span className="break-words">{plugin.name}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {activeProjects.map((proj) => {
              const enabled = (proj.enabledPlugins || []).includes(plugin.id);
              return (
                <button
                  type="button"
                  key={proj.id}
                  onClick={() => onTogglePluginForProject(proj.id, plugin.id)}
                  className={`min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-bold border transition active:scale-95 cursor-pointer ${
                    enabled
                      ? 'bg-[#0A9396] text-white border-[#14B8A6]'
                      : 'bg-[#181A1B] text-[#94A3B8] border-white/10 hover:text-white'
                  }`}
                >
                  {proj.name}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* ── 2-Stufen-Datenverlust-Schutz für Projekt-Stammdaten aktualisieren ── */}
      {onResetProjectStructure && (
        <div className="space-y-2 pt-1">
          {!confirmResetOpen ? (
            <button
              type="button"
              onClick={() => setConfirmResetOpen(true)}
              className="w-full min-h-[44px] py-2 px-3 rounded-xl text-xs font-bold bg-[#E5A93C] text-[#111317] flex items-center justify-center gap-2 active:scale-95 transition cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 shrink-0" />
              <span>Projekt-Stammdaten aktualisieren</span>
            </button>
          ) : (
            <div
              role="alert"
              className="p-3.5 rounded-2xl border border-[#E5A93C]/40 bg-[#E5A93C]/10 space-y-3 animate-fadeIn"
            >
              <div className="text-xs font-semibold text-[#E5A93C] leading-snug">
                Setzt alle Projekte auf Werkszustand zurück – wirklich ausführen?
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmResetOpen(false)}
                  className="flex-1 min-w-[110px] min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold bg-[#181A1B] text-[#F1F5F9] border border-white/15 active:scale-95 transition cursor-pointer"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmResetOpen(false);
                    onResetProjectStructure();
                  }}
                  className="flex-1 min-w-[130px] min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold bg-[#E5A93C] text-[#111317] active:scale-95 transition cursor-pointer"
                >
                  Ja, zurücksetzen
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </ZentraleAccordion>
  );
};
