import React, { useState } from 'react';
import {
  Bell,
  BookOpenCheck,
  Cloud,
  FileCheck2,
  Loader2,
  Plus,
  Receipt,
  RefreshCw,
  Scale,
  Search,
  ShieldAlert,
  Trash2,
  Upload,
  X
} from 'lucide-react';
import { AppStateSnapshot, Project, THEME } from '../types';
import {
  AuditWatchlistItem,
  AutoAuditSettings,
  loadAuditSettings,
  loadAuditWatchlist,
  runDeepResearchWithCitations,
  saveAuditSettings,
  saveAuditWatchlist,
  scanReceiptImageWithGemini
} from '../services/deepResearchAndScanner';
import {
  CloudSyncConfig,
  loadCloudConfig,
  pullStateFromCloud,
  pushStateToCloud,
  requestPushNotificationPermission,
  saveCloudConfig
} from '../services/cloudSyncAndPush';

interface DeepResearchAndAuditModalProps {
  open: boolean;
  projects: Project[];
  activeProject?: Project;
  userApiKey: string;
  fullState: AppStateSnapshot;
  onClose: () => void;
  onSaveDossierToProject: (
    projectId: string,
    title: string,
    markdownContent: string,
    followUpTasks: string[]
  ) => void;
  onReconcileReceiptWithCart: (
    projectId: string,
    storeName: string,
    purchaseDate: string,
    totalAmount: string,
    items: Array<{ title: string; quantity: string; price: string }>
  ) => void;
  onReplaceFullStateFromCloud: (newState: AppStateSnapshot) => void;
  onNotify: (msg: string) => void;
}

export const DeepResearchAndAuditModal: React.FC<DeepResearchAndAuditModalProps> = ({
  open,
  projects,
  activeProject,
  userApiKey,
  fullState,
  onClose,
  onSaveDossierToProject,
  onReconcileReceiptWithCart,
  onReplaceFullStateFromCloud,
  onNotify
}) => {
  const [activeSection, setActiveSection] = useState<
    'research' | 'receipt' | 'cloud_push'
  >('research');

  const [targetProjectId, setTargetProjectId] = useState<string>(
    activeProject?.id || projects[0]?.id || 'proj-foodtruck'
  );
  const [researchQuery, setResearchQuery] = useState('');
  const [researchDepth, setResearchDepth] = useState<'quick' | 'full_dossier'>(
    'full_dossier'
  );
  const [isResearching, setIsResearching] = useState(false);
  const [lastDossierPreview, setLastDossierPreview] = useState<{
    title: string;
    content: string;
  } | null>(null);

  const [watchlist, setWatchlist] = useState<AuditWatchlistItem[]>(() =>
    loadAuditWatchlist(projects)
  );
  const [auditSettings, setAuditSettings] = useState<AutoAuditSettings>(
    loadAuditSettings
  );

  // Kassenbon-Scanner State
  const [isScanningReceipt, setIsScanningReceipt] = useState(false);

  // Cloud & Push State
  const [cloudCfg, setCloudCfg] = useState<CloudSyncConfig>(loadCloudConfig);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [pushGranted, setPushGranted] = useState<boolean>(
    typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
  );

  if (!open) return null;

  const activeProjects = projects.filter((p) => !p.archived);
  const selectedProj =
    activeProjects.find((p) => p.id === targetProjectId) || activeProjects[0];

  const handleRunDeepResearch = async (topicToRun: string, watchItemId?: string) => {
    if (!topicToRun.trim() || !selectedProj || isResearching) return;
    setIsResearching(true);
    setLastDossierPreview(null);

    const res = await runDeepResearchWithCitations(
      topicToRun.trim(),
      selectedProj.name,
      userApiKey,
      researchDepth
    );

    onSaveDossierToProject(
      selectedProj.id,
      res.title,
      res.markdownDossier,
      res.followUpTasks
    );

    if (watchItemId) {
      const updated = watchlist.map((w) =>
        w.id === watchItemId ? { ...w, completed: true } : w
      );
      setWatchlist(updated);
      saveAuditWatchlist(updated);
    }

    const nextSettings = {
      ...auditSettings,
      lastRunIso: new Date().toLocaleString('de-DE')
    };
    setAuditSettings(nextSettings);
    saveAuditSettings(nextSettings);

    setLastDossierPreview({ title: res.title, content: res.markdownDossier });
    setIsResearching(false);
    setResearchQuery('');
    onNotify(`Deep-Research Dossier unter "${selectedProj.name} -> Infos" abgelegt!`);
  };

  const handleRunWeeklyBatchAudit = async () => {
    const openItems = watchlist.filter((w) => !w.completed);
    if (openItems.length === 0) {
      onNotify('Alle Punkte auf der Auto-Audit-Wächterliste sind bereits geprüft.');
      return;
    }
    await handleRunDeepResearch(openItems[0].topic, openItems[0].id);
  };

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProj) return;
    setIsScanningReceipt(true);

    const scan = await scanReceiptImageWithGemini(file, userApiKey);
    setIsScanningReceipt(false);
    e.target.value = '';

    if (!scan.ok || !scan.result) {
      onNotify(scan.error || 'Beleg konnte nicht gelesen werden.');
      return;
    }

    onReconcileReceiptWithCart(
      selectedProj.id,
      scan.result.storeName,
      scan.result.purchaseDate,
      scan.result.totalAmount,
      scan.result.items
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-2 sm:p-4">
      <div
        className="w-full max-w-lg max-h-[90vh] rounded-3xl border border-white/15 shadow-2xl flex flex-col overflow-hidden"
        style={{ backgroundColor: THEME.bgMain }}
      >
        {/* Kopfzeile */}
        <div
          className="px-4 py-3.5 border-b border-white/10 flex items-center justify-between"
          style={{ backgroundColor: THEME.bgCard }}
        >
          <div>
            <div className="text-xs font-extrabold uppercase tracking-wider text-white">
              BANDIT.OS Deep Research, Scanner &amp; Cloud
            </div>
            <div className="text-[10px] text-[#9CA3AF]">
              Rechtssichere Beleg-Dossiers, Kassenbon-Scanner &amp; Echtzeit-Sync
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-[#181A1B] text-[#9CA3AF] hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 3 Bereichs-Schalter */}
        <div
          className="grid grid-cols-3 p-1.5 border-b border-white/10 gap-1"
          style={{ backgroundColor: '#181A1B' }}
        >
          <button
            type="button"
            onClick={() => setActiveSection('research')}
            className={`py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 ${
              activeSection === 'research'
                ? 'bg-[#0A9396] text-white'
                : 'text-[#9CA3AF] hover:text-white'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Deep Research</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('receipt')}
            className={`py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 ${
              activeSection === 'receipt'
                ? 'bg-[#0A9396] text-white'
                : 'text-[#9CA3AF] hover:text-white'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Beleg-Scanner</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('cloud_push')}
            className={`py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 ${
              activeSection === 'cloud_push'
                ? 'bg-[#0A9396] text-white'
                : 'text-[#9CA3AF] hover:text-white'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>Cloud &amp; Push</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Ziel-Projekt Auswahl */}
          <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#24292E] border border-white/10">
            <span className="text-xs font-bold text-[#9CA3AF]">Ziel-Projekt:</span>
            <select
              value={targetProjectId}
              onChange={(e) => setTargetProjectId(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#181A1B] text-white border border-white/15"
            >
              {activeProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* TAB 1: KOMBINIERTER DEEP RESEARCH & AUTO-AUDIT */}
          {activeSection === 'research' && (
            <div className="space-y-4">
              {/* Modus B: Direkte On-Demand Tiefenrecherche */}
              <div
                className="p-3.5 rounded-2xl border border-white/10 space-y-2.5"
                style={{ backgroundColor: THEME.bgCard }}
              >
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <Search className="w-4 h-4 text-[#14B8A6]" />
                  <span>Gezieltes Rechts- &amp; Normen-Dossier anfertigen (On-Demand)</span>
                </div>
                <textarea
                  rows={2}
                  value={researchQuery}
                  onChange={(e) => setResearchQuery(e.target.value)}
                  placeholder="Frage oder kritischen Prüfpunkt eingeben (z. B. 'Vorgaben für 50 mbar Gasanlage und Hitzeschutz im Verkaufsanhänger mit Zitaten')..."
                  className="w-full p-2.5 rounded-xl text-xs bg-[#181A1B] text-white border border-white/15 focus:outline-none focus:border-[#14B8A6]"
                />
                <div className="flex items-center justify-between gap-2">
                  <select
                    value={researchDepth}
                    onChange={(e) => setResearchDepth(e.target.value as any)}
                    className="px-2.5 py-2 rounded-xl text-[11px] bg-[#181A1B] text-white border border-white/10"
                  >
                    <option value="full_dossier">
                      Voll-Dossier (Gesetze, Zitate, Links &amp; To-dos)
                    </option>
                    <option value="quick">Kompakter Schnell-Beleg</option>
                  </select>

                  <button
                    type="button"
                    disabled={isResearching || !researchQuery.trim()}
                    onClick={() => handleRunDeepResearch(researchQuery)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 disabled:opacity-40"
                    style={{ backgroundColor: THEME.accentPrimary }}
                  >
                    {isResearching ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <BookOpenCheck className="w-4 h-4" />
                    )}
                    <span>Jetzt recherchieren</span>
                  </button>
                </div>
              </div>

              {/* Modus A: Automatischer Wochen-Prüflauf (Auto-Audit Wächterliste) */}
              <div
                className="p-3.5 rounded-2xl border border-white/10 space-y-3"
                style={{ backgroundColor: THEME.bgCard }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-[#F59E0B]" />
                      <span>Wöchentlicher Auto-Audit &amp; Kritische Prüfliste</span>
                    </div>
                    <div className="text-[10px] text-[#9CA3AF]">
                      Sammelt unter der Woche kritische Bau-/Rechtspunkte{' '}
                      {auditSettings.lastRunIso
                        ? `• Letzter Lauf: ${auditSettings.lastRunIso}`
                        : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = {
                        ...auditSettings,
                        weeklyAutoAuditEnabled: !auditSettings.weeklyAutoAuditEnabled
                      };
                      setAuditSettings(next);
                      saveAuditSettings(next);
                    }}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-white"
                    style={{
                      backgroundColor: auditSettings.weeklyAutoAuditEnabled
                        ? THEME.accentPrimary
                        : '#374151'
                    }}
                  >
                    {auditSettings.weeklyAutoAuditEnabled ? 'Auto-Audit An' : 'Aus'}
                  </button>
                </div>

                <button
                  type="button"
                  disabled={isResearching}
                  onClick={handleRunWeeklyBatchAudit}
                  className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-[#181A1B] text-[#14B8A6] border border-[#14B8A6]/40 flex items-center justify-center gap-1.5"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${isResearching ? 'animate-spin' : ''}`}
                  />
                  <span>Nächsten offenen Punkt der Wochenliste sofort ausfertigen</span>
                </button>

                <div className="space-y-2">
                  {watchlist.map((item) => (
                    <div
                      key={item.id}
                      className={`p-2.5 rounded-xl bg-[#181A1B] border border-white/10 space-y-1.5 ${
                        item.completed ? 'opacity-60' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] text-[#9CA3AF]">
                        <span className="font-bold text-[#14B8A6]">
                          {item.projectName}
                        </span>
                        <span>{item.detectedReason}</span>
                      </div>
                      <p className="text-xs font-semibold text-white leading-snug">
                        {item.topic}
                      </p>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-[#9CA3AF]">
                          {item.completed ? '✓ Dossier unter Infos abgelegt' : 'Offen'}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={isResearching}
                            onClick={() => {
                              setTargetProjectId(item.projectId);
                              void handleRunDeepResearch(item.topic, item.id);
                            }}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-white"
                            style={{ backgroundColor: THEME.accentPrimary }}
                          >
                            Prüfen &amp; Belege holen
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const next = watchlist.filter((w) => w.id !== item.id);
                              setWatchlist(next);
                              saveAuditWatchlist(next);
                            }}
                            className="p-1 text-[#9CA3AF] hover:text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {lastDossierPreview && (
                <div className="p-3.5 rounded-2xl bg-[#181A1B] border border-[#14B8A6] space-y-2">
                  <div className="text-xs font-bold text-[#14B8A6] flex items-center gap-1.5">
                    <FileCheck2 className="w-4 h-4" />
                    <span>Fertiges Dossier (unter Projekt-Infos gespeichert):</span>
                  </div>
                  <div className="text-xs text-white whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed">
                    {lastDossierPreview.content}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2 (UPDATE 4): KASSENBON- & RECHNUNGS-SCANNER */}
          {activeSection === 'receipt' && (
            <div
              className="p-4 rounded-2xl border border-white/10 space-y-3 text-center"
              style={{ backgroundColor: THEME.bgCard }}
            >
              <Receipt className="w-8 h-8 text-[#14B8A6] mx-auto" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">
                  Kassenbon- &amp; Baumarkt-Rechnungs-Scanner
                </h3>
                <p className="text-xs text-[#9CA3AF] leading-relaxed">
                  Fotografiere einen Beleg (z. B. Bauhaus, Hornbach, Großhandel). Die KI liest alle
                  Artikel und Preise aus, hakt passende Punkte im Einkaufswagen von{' '}
                  <strong className="text-white">{selectedProj?.name}</strong> automatisch ab und
                  speichert die Abrechnung unter Infos.
                </p>
              </div>

              <label
                className="w-full py-3 px-4 rounded-2xl text-xs font-bold text-white flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                style={{ backgroundColor: THEME.accentPrimary }}
              >
                {isScanningReceipt ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Beleg wird analysiert &amp; mit Einkaufswagen abgeglichen...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Beleg-Foto aufnehmen oder auswählen</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  disabled={isScanningReceipt}
                  className="hidden"
                  onChange={handleReceiptUpload}
                />
              </label>
            </div>
          )}

          {/* TAB 3 (UPDATE 1 & 3): ECHTZEIT-CLOUD-SYNC & PUSH-ERINNERUNGEN */}
          {activeSection === 'cloud_push' && (
            <div className="space-y-3">
              <div
                className="p-3.5 rounded-2xl border border-white/10 space-y-3"
                style={{ backgroundColor: THEME.bgCard }}
              >
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-[#14B8A6]" />
                  <span>Echtzeit-Cloud-Sync (Handy &lt;-&gt; PC Backoffice)</span>
                </div>
                <input
                  type="text"
                  value={cloudCfg.endpointUrl}
                  onChange={(e) => {
                    const next = { ...cloudCfg, endpointUrl: e.target.value };
                    setCloudCfg(next);
                    saveCloudConfig(next);
                  }}
                  placeholder="Cloud-REST-URL (z. B. Firebase Realtime DB .json oder Supabase URL)..."
                  className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-[#181A1B] text-white border border-white/15"
                />
                <input
                  type="password"
                  value={cloudCfg.apiKeyOrToken}
                  onChange={(e) => {
                    const next = { ...cloudCfg, apiKeyOrToken: e.target.value };
                    setCloudCfg(next);
                    saveCloudConfig(next);
                  }}
                  placeholder="Optionaler Cloud-API-Key / Bearer-Token..."
                  className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-[#181A1B] text-white border border-white/15"
                />

                <div className="flex items-center justify-between p-2 rounded-xl bg-[#181A1B]">
                  <span className="text-xs text-white">
                    Automatisch bei jeder Änderung synchronisieren
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const next = {
                        ...cloudCfg,
                        enabled: !cloudCfg.enabled,
                        autoSyncOnChange: !cloudCfg.enabled
                      };
                      setCloudCfg(next);
                      saveCloudConfig(next);
                    }}
                    className="px-3 py-1 rounded-lg text-xs font-bold text-white"
                    style={{
                      backgroundColor: cloudCfg.enabled ? THEME.accentPrimary : '#374151'
                    }}
                  >
                    {cloudCfg.enabled ? 'Aktiv' : 'Aus'}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isSyncingCloud}
                    onClick={async () => {
                      setIsSyncingCloud(true);
                      const res = await pushStateToCloud(fullState);
                      setIsSyncingCloud(false);
                      setCloudCfg(loadCloudConfig());
                      onNotify(res.message);
                    }}
                    className="py-2.5 rounded-xl text-xs font-bold text-white"
                    style={{ backgroundColor: THEME.accentPrimary }}
                  >
                    Stand in Cloud senden
                  </button>
                  <button
                    type="button"
                    disabled={isSyncingCloud}
                    onClick={async () => {
                      setIsSyncingCloud(true);
                      const res = await pullStateFromCloud();
                      setIsSyncingCloud(false);
                      setCloudCfg(loadCloudConfig());
                      if (res.ok && res.snapshot) {
                        onReplaceFullStateFromCloud(res.snapshot);
                      }
                      onNotify(res.message);
                    }}
                    className="py-2.5 rounded-xl text-xs font-bold bg-[#181A1B] text-[#14B8A6] border border-[#14B8A6]/40"
                  >
                    Stand aus Cloud laden
                  </button>
                </div>
                {cloudCfg.lastSyncedAt && (
                  <div className="text-[10px] text-[#9CA3AF] text-center">
                    Zuletzt synchronisiert: {cloudCfg.lastSyncedAt}
                  </div>
                )}
              </div>

              {/* Push-Benachrichtigungen */}
              <div
                className="p-3.5 rounded-2xl border border-white/10 flex items-center justify-between"
                style={{ backgroundColor: THEME.bgCard }}
              >
                <div className="flex items-center gap-2.5">
                  <Bell className="w-4 h-4 text-[#14B8A6]" />
                  <div>
                    <div className="text-xs font-bold text-white">
                      Native Smartphone Push-Erinnerungen
                    </div>
                    <div className="text-[10px] text-[#9CA3AF]">
                      Meldet fällige Aufgaben-Zeiten direkt auf dem Sperrbildschirm
                    </div>
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
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-white"
                  style={{
                    backgroundColor: pushGranted ? THEME.accentPrimary : '#374151'
                  }}
                >
                  {pushGranted ? 'Aktiv' : 'Freigeben'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
