import React, { useState } from 'react';
import { Database, Download, FileUp, Upload, X } from 'lucide-react';
import { AppStateSnapshot, EventSalesLog, Project, THEME } from '../../types';
import {
  STORAGE_KEYS,
  downloadFullBackupV2,
  getIdbItemSync,
  importFullBackupV2,
  importProjectJsonToTarget,
  saveIdbItem
} from '../../services/storage';
import { exportSalesLogsCsv } from '../../services/exportBridge';
import { CloudSyncPanel } from './CloudSyncPanel';
import { ZentraleAccordion } from './ZentralePrimitives';

interface BlueprintTemplate {
  id: string;
  name: string;
  tasks: string[];
  cart: string[];
}

interface SystemAndBackupSectionProps {
  isOpen: boolean;
  onToggle: () => void;
  projects: Project[];
  eventSalesLogs: EventSalesLog[];
  fullState?: AppStateSnapshot;
  onUpdateProject?: (projectId: string, patch: Partial<Project>) => void;
  onSaveScratchpadToProject: (projectId: string, title: string, content: string) => void;
  onImportFullBackup: (snapshot: AppStateSnapshot) => void;
  onReplaceFullStateFromCloud?: (snapshot: AppStateSnapshot) => void;
  onNotify: (msg: string) => void;
}

/**
 * Bereich 5 der Zentrale: Voll-Backup v2, Projekt-JSON-Import, CSV-Export, Cloud-Sync & Blueprints.
 */
export const SystemAndBackupSection: React.FC<SystemAndBackupSectionProps> = ({
  isOpen,
  onToggle,
  projects,
  eventSalesLogs,
  fullState,
  onUpdateProject,
  onSaveScratchpadToProject,
  onImportFullBackup,
  onReplaceFullStateFromCloud,
  onNotify
}) => {
  const activeProjects = projects.filter((p) => !p.archived);

  const [blueprints, setBlueprints] = useState<BlueprintTemplate[]>(() =>
    getIdbItemSync<BlueprintTemplate[]>(STORAGE_KEYS.BLUEPRINTS, [
      {
        id: 'bp-event',
        name: 'Standard-Event Vor-Ort-Checkliste (Pizza Bandit)',
        tasks: [
          '[Vorbereitung] Gasflaschen (2x 11kg) + 50 mbar Regler prüfen',
          '[Vorbereitung] Frischwasser- & Abwasserkanister einsetzen',
          '[Vorbereitung] Euroboxen mit Teigballen verladen',
          '[Vor Ort] Saladette-Lift auf 92 cm Arbeitshöhe arretieren'
        ],
        cart: ['Einweghandschuhe Nitril', 'Pizzakartons / Servietten']
      }
    ])
  );
  const [selectedBlueprintProjectId, setSelectedBlueprintProjectId] = useState(
    projects[0]?.id || 'proj-foodtruck'
  );
  const [newBlueprintName, setNewBlueprintName] = useState('');

  const [backupReceipt, setBackupReceipt] = useState<{
    type: 'export' | 'import';
    projectCount: number;
    taskCount: number;
    cartCount: number;
    knowledgeCount: number;
    pizzaVarietyCount?: number;
    warnings?: string[];
    timestamp: string;
  } | null>(null);

  const handleSaveCurrentProjectAsBlueprint = () => {
    const proj = projects.find((p) => p.id === selectedBlueprintProjectId);
    if (!proj) return;
    const bp: BlueprintTemplate = {
      id: `bp-${Date.now()}`,
      name: newBlueprintName.trim() || `Vorlage: ${proj.name}`,
      tasks: proj.tasks.map((t) => t.title),
      cart: proj.cart.map((c) => c.title)
    };
    const next = [bp, ...blueprints];
    setBlueprints(next);
    saveIdbItem(STORAGE_KEYS.BLUEPRINTS, next);
    setNewBlueprintName('');
    onNotify(`Vorlage "${bp.name}" im Tresor gespeichert.`);
  };

  const handleBackupUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const raw = JSON.parse(text);
      if (!raw || typeof raw !== 'object') {
        onNotify('Ungültige JSON-Backup-Datei.');
        return;
      }
      const { snapshot, result } = await importFullBackupV2(
        raw,
        fullState || ({} as AppStateSnapshot)
      );
      onImportFullBackup(snapshot);
      setBackupReceipt({
        type: 'import',
        projectCount: result.projectCount,
        taskCount: result.taskCount,
        cartCount: result.cartCount,
        knowledgeCount: result.knowledgeCount,
        pizzaVarietyCount: result.pizzaVarietyCount,
        warnings: result.warnings,
        timestamp: new Date().toLocaleTimeString('de-DE', {
          hour: '2-digit',
          minute: '2-digit'
        })
      });
      onNotify(
        `Backup wiederhergestellt: ${result.projectCount} Projekte, ${result.taskCount} Aufgaben.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ungültiges Format';
      onNotify(`Backup-Fehler: ${msg}`);
    }
    e.target.value = '';
  };

  const handleProjectJsonUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const raw = JSON.parse(text);
      const targetProj = activeProjects[0] || projects[0];
      if (!targetProj) {
        onNotify('Kein Zielprojekt vorhanden.');
        return;
      }
      const { updatedProject, result } = importProjectJsonToTarget(raw, targetProj);
      onUpdateProject?.(targetProj.id, {
        tasks: updatedProject.tasks,
        cart: updatedProject.cart,
        knowledge: updatedProject.knowledge
      });
      onNotify(
        `Projekt-Import: ${result.addedTasks} Aufgaben, ${result.addedCart} Einkäufe, ${result.addedKnowledge} Wissens-Einträge an "${targetProj.name}" angehängt.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ungültiges JSON-Format';
      onNotify(`Projekt-Import-Fehler: ${msg}`);
    }
    e.target.value = '';
  };

  return (
    <ZentraleAccordion
      number={5}
      title="Daten, Backup & System"
      subtitle="Import/Export, Vorlagen-Tresor & Cloud-Sync"
      statusText="Backup v2"
      icon={<Database className="w-5 h-5 text-[#14B8A6]" />}
      isOpen={isOpen}
      onToggle={onToggle}
    >
      {/* ── Backup, Export & Import ── */}
      <div className="space-y-3">
        <div className="text-xs font-extrabold uppercase tracking-wider text-[#94A3B8] px-1 pt-1">
          Backup, Export &amp; Import
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={async () => {
              if (!fullState) {
                onNotify('Kein Status vorhanden.');
                return;
              }
              const backup = await downloadFullBackupV2(fullState);
              setBackupReceipt({
                type: 'export',
                projectCount: backup.appState.projects.length,
                taskCount: backup.appState.projects.reduce(
                  (n, p) => n + (p.tasks?.length || 0),
                  0
                ),
                cartCount: backup.appState.projects.reduce(
                  (n, p) => n + (p.cart?.length || 0),
                  0
                ),
                knowledgeCount: backup.appState.projects.reduce(
                  (n, p) => n + (p.knowledge?.length || 0),
                  0
                ),
                pizzaVarietyCount: Array.isArray(backup.pizzaCatalog)
                  ? backup.pizzaCatalog.length
                  : 0,
                timestamp: new Date().toLocaleTimeString('de-DE', {
                  hour: '2-digit',
                  minute: '2-digit'
                })
              });
              onNotify('Vollständiges Backup gespeichert (v2).');
            }}
            className="flex-1 min-w-[140px] min-h-[44px] py-2 px-3 rounded-xl text-xs font-semibold bg-[#242930] text-white border border-white/10 flex items-center justify-center gap-2 active:scale-95 transition cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#14B8A6] shrink-0" />
            <span>Backup speichern</span>
          </button>
          <label className="flex-1 min-w-[140px] min-h-[44px] cursor-pointer py-2 px-3 rounded-xl text-xs font-semibold bg-[#242930] text-[#14B8A6] border border-[#14B8A6]/40 flex items-center justify-center gap-2 active:scale-95 transition">
            <Upload className="w-4 h-4 shrink-0" />
            <span>Backup laden</span>
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleBackupUpload}
            />
          </label>
        </div>

        <label className="w-full min-h-[44px] cursor-pointer py-2 px-3 rounded-xl text-xs font-semibold bg-[#242930] text-[#E5A93C] border border-[#E5A93C]/40 flex items-center justify-center gap-2 active:scale-95 transition">
          <FileUp className="w-4 h-4 shrink-0" />
          <span>Projekt importieren</span>
          <input
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleProjectJsonUpload}
          />
        </label>

        {eventSalesLogs.length > 0 && (
          <button
            type="button"
            onClick={() => exportSalesLogsCsv(eventSalesLogs)}
            className="w-full min-h-[44px] py-2 px-3 rounded-xl text-xs font-semibold bg-[#242930] text-[#14B8A6] border border-white/10 active:scale-95 transition cursor-pointer"
          >
            POS-Abrechnungen als CSV exportieren ({eventSalesLogs.length})
          </button>
        )}

        {backupReceipt && (
          <div className="p-3.5 rounded-2xl bg-[#242930] border border-[#E5A93C]/30 space-y-2 animate-fadeIn">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-bold text-[#E5A93C] min-w-0 break-words">
                {backupReceipt.type === 'export'
                  ? '✓ Backup gespeichert'
                  : '✓ Backup wiederhergestellt'}{' '}
                · {backupReceipt.timestamp}
              </div>
              <button
                type="button"
                onClick={() => setBackupReceipt(null)}
                className="min-h-[44px] min-w-[44px] rounded-xl bg-transparent text-[#94A3B8] hover:text-white flex items-center justify-center transition shrink-0 cursor-pointer"
                aria-label="Quittung schließen"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <div className="bg-[#111317] rounded-xl p-2 text-center">
                <div className="text-[#F1F5F9] font-mono font-bold text-base">
                  {backupReceipt.projectCount}
                </div>
                <div className="text-[#94A3B8]">Projekte</div>
              </div>
              <div className="bg-[#111317] rounded-xl p-2 text-center">
                <div className="text-[#F1F5F9] font-mono font-bold text-base">
                  {backupReceipt.taskCount}
                </div>
                <div className="text-[#94A3B8]">Aufgaben</div>
              </div>
              <div className="bg-[#111317] rounded-xl p-2 text-center">
                <div className="text-[#F1F5F9] font-mono font-bold text-base">
                  {backupReceipt.cartCount}
                </div>
                <div className="text-[#94A3B8]">Einkäufe</div>
              </div>
              <div className="bg-[#111317] rounded-xl p-2 text-center">
                <div className="text-[#F1F5F9] font-mono font-bold text-base">
                  {backupReceipt.knowledgeCount}
                </div>
                <div className="text-[#94A3B8]">Wissen</div>
              </div>
              {(backupReceipt.pizzaVarietyCount ?? 0) > 0 && (
                <div className="col-span-2 bg-[#111317] rounded-xl p-2 text-center">
                  <div className="text-[#F1F5F9] font-mono font-bold text-base">
                    {backupReceipt.pizzaVarietyCount}
                  </div>
                  <div className="text-[#94A3B8]">Pizza-Sorten (Katalog)</div>
                </div>
              )}
            </div>
            {backupReceipt.warnings && backupReceipt.warnings.length > 0 && (
              <div className="text-xs text-[#E5A93C]/80 space-y-0.5">
                {backupReceipt.warnings.map((w, i) => (
                  <div key={i}>⚠ {w}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Cloud-Synchronisation & Push-Zentrale (gemeinsame Komponente) ── */}
      <div className="space-y-3">
        <div className="text-xs font-extrabold uppercase tracking-wider text-[#94A3B8] px-1 pt-1">
          Cloud-Synchronisation &amp; Push-Zentrale
        </div>
        <CloudSyncPanel
          fullState={fullState}
          onReplaceFullStateFromCloud={onReplaceFullStateFromCloud}
          onNotify={onNotify}
        />
      </div>

      {/* ── Vorlagen-Tresor (Blueprints) ── */}
      <div className="space-y-3">
        <div className="text-xs font-extrabold uppercase tracking-wider text-[#94A3B8] px-1 pt-1">
          Vorlagen-Tresor (Blueprints)
        </div>
        <div className="p-3.5 rounded-2xl bg-[#242930] border border-white/5 space-y-2.5">
          <div className="text-xs font-bold text-white">
            Aktuelles Projekt als wiederverwendbare Vorlage sichern
          </div>
          <select
            value={selectedBlueprintProjectId}
            onChange={(e) => setSelectedBlueprintProjectId(e.target.value)}
            className="w-full min-w-0 min-h-[44px] px-3 py-2 rounded-xl text-xs bg-[#181A1B] text-white border border-white/10"
          >
            {activeProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={newBlueprintName}
              onChange={(e) => setNewBlueprintName(e.target.value)}
              placeholder="Name der Vorlage (z. B. Sommer-Event Packliste)..."
              className="flex-1 min-w-0 min-h-[44px] px-3.5 py-2 rounded-xl text-xs bg-[#181A1B] text-white border border-white/10"
            />
            <button
              type="button"
              onClick={handleSaveCurrentProjectAsBlueprint}
              className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold text-white transition active:scale-95 shrink-0 cursor-pointer"
              style={{ backgroundColor: THEME.accentPrimary }}
            >
              Sichern
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          {blueprints.map((bp) => (
            <div
              key={bp.id}
              className="p-3 rounded-2xl bg-[#242930] border border-white/5 flex items-center justify-between gap-2"
            >
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-white break-words">{bp.name}</div>
                <div className="text-xs text-[#94A3B8]">
                  {bp.tasks.length} Tasks • {bp.cart.length} Einkaufs-Artikel
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onSaveScratchpadToProject(
                    selectedBlueprintProjectId,
                    bp.name,
                    `Checklisten-Vorlage:\n${bp.tasks.map((t) => `- ${t}`).join('\n')}`
                  );
                  onNotify(`Vorlage "${bp.name}" in Projekt-Infos hinterlegt.`);
                }}
                className="min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs font-bold text-white shrink-0 active:scale-95 transition cursor-pointer"
                style={{ backgroundColor: THEME.accentPrimary }}
              >
                Einspielen
              </button>
            </div>
          ))}
        </div>
      </div>
    </ZentraleAccordion>
  );
};
