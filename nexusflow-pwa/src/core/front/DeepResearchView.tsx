import React, { useEffect, useState } from 'react';
import {
  BookOpenCheck,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  FileCheck2,
  ListTodo,
  Loader2,
  Plus,
  RefreshCw,
  Scale,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2
} from 'lucide-react';
import { ForemanProposal, KnowledgeKind, PriorityType, Project } from '../../types';
import {
  runDeepResearchWithCitations,
  loadAuditWatchlist,
  saveAuditWatchlist,
  AuditWatchlistItem
} from '../../services/deepResearchAndScanner';
import {
  SavedDossierItem,
  loadSavedDossiers,
  saveSavedDossiers,
  loadUserPrefs,
  loadForemanProposals,
  saveForemanProposals,
  formatNow
} from '../../services/storage';
import { buildProposalFromResearchResult } from '../../services/silentThinker';
import { triggerHapticFeedback } from '../../services/aiRouter';
import { ThemeColors } from './FrontHeader';
import { ZentraleSectionId } from '../BackofficeWorkspace';

interface DeepResearchViewProps {
  activeProject: Project;
  allProjects: Project[];
  themeColors: ThemeColors;
  userApiKey?: string;
  murmurAutopilotEnabled?: boolean;
  onParkForemanProposal?: (proposal: ForemanProposal) => void;
  onSaveDossierToProject?: (
    projectId: string,
    title: string,
    markdownContent: string,
    followUpTasks: string[]
  ) => void;
  onAddTask: (
    projectId: string,
    title: string,
    priority?: PriorityType,
    estimatedMinutes?: number
  ) => void;
  onAddKnowledge?: (
    projectId: string,
    kind: KnowledgeKind,
    title: string,
    content: string,
    attachments?: any[]
  ) => void;
  onOpenSettings?: (section?: ZentraleSectionId) => void;
  onNotify: (msg: string) => void;
}

export const DeepResearchView: React.FC<DeepResearchViewProps> = ({
  activeProject,
  allProjects,
  themeColors,
  userApiKey = '',
  murmurAutopilotEnabled: murmurAutopilotEnabledProp,
  onParkForemanProposal,
  onSaveDossierToProject,
  onAddTask,
  onAddKnowledge,
  onOpenSettings,
  onNotify
}) => {
  const [dossiers, setDossiers] = useState<SavedDossierItem[]>(() => loadSavedDossiers());
  const [watchlist, setWatchlist] = useState<AuditWatchlistItem[]>(() => loadAuditWatchlist(allProjects));
  const [selectedProjectId, setSelectedProjectId] = useState<string>(activeProject.id);
  const [searchTopic, setSearchTopic] = useState('');
  const [researchDepth, setResearchDepth] = useState<'quick' | 'full_dossier'>('full_dossier');
  const [isResearching, setIsResearching] = useState(false);
  const [expandedDossierIds, setExpandedDossierIds] = useState<Record<string, boolean>>({});
  const [addedTaskKeys, setAddedTaskKeys] = useState<Record<string, boolean>>({});
  const [parkedDossierIds, setParkedDossierIds] = useState<Record<string, boolean>>({});
  const [murmurNotice, setMurmurNotice] = useState<string | null>(null);
  const [localMurmurEnabled, setLocalMurmurEnabled] = useState<boolean>(
    () => loadUserPrefs().murmurAutopilotEnabled !== false
  );

  useEffect(() => {
    const onPrefsUpdated = (ev: Event) => {
      const detail = (ev as CustomEvent)?.detail;
      if (detail && typeof detail.murmurAutopilotEnabled === 'boolean') {
        setLocalMurmurEnabled(detail.murmurAutopilotEnabled);
      }
    };
    window.addEventListener('banditos:prefs-updated', onPrefsUpdated);
    return () => window.removeEventListener('banditos:prefs-updated', onPrefsUpdated);
  }, []);

  const murmurEnabled =
    typeof murmurAutopilotEnabledProp === 'boolean'
      ? murmurAutopilotEnabledProp
      : localMurmurEnabled;

  useEffect(() => {
    setSelectedProjectId(activeProject.id);
  }, [activeProject.id]);

  const toggleExpand = (id: string) => {
    triggerHapticFeedback(10);
    setExpandedDossierIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleStartResearch = async (topicToRun?: string, watchItemId?: string) => {
    const topic = (topicToRun || searchTopic).trim();
    if (!topic || isResearching) return;

    const targetProj = allProjects.find((p) => p.id === selectedProjectId) || activeProject;
    setIsResearching(true);
    triggerHapticFeedback(20);

    try {
      const res = await runDeepResearchWithCitations(
        topic,
        targetProj.name,
        userApiKey,
        researchDepth
      );

      const newDossier: SavedDossierItem = {
        id: `dossier-${Date.now()}`,
        projectId: targetProj.id,
        projectName: targetProj.name,
        title: res.title,
        markdownContent: res.markdownDossier,
        sources: res.sources || [],
        followUpTasks: res.followUpTasks || [],
        createdAt: formatNow(),
        modelUsed: res.modelUsed
      };

      const updated = [newDossier, ...dossiers];
      setDossiers(updated);
      saveSavedDossiers(updated);

      // Auto-expand the newly created dossier
      setExpandedDossierIds((prev) => ({ ...prev, [newDossier.id]: true }));

      // Save dossier to project knowledge if callback exists
      onSaveDossierToProject?.(
        targetProj.id,
        res.title,
        res.markdownDossier,
        res.followUpTasks
      );

      // If triggered from watchlist, mark as completed
      if (watchItemId) {
        const nextWatch = watchlist.map((w) =>
          w.id === watchItemId ? { ...w, completed: true } : w
        );
        setWatchlist(nextWatch);
        saveAuditWatchlist(nextWatch);
      }

      setSearchTopic('');
      setIsResearching(false);
      onNotify(`Dossier zu "${topic.slice(0, 28)}" erstellt & abgelegt!`);
    } catch (err: any) {
      setIsResearching(false);
      onNotify(`Fehler bei Deep Research: ${err?.message || 'Unbekannt'}`);
    }
  };

  const handleDeleteDossier = (dossierId: string) => {
    triggerHapticFeedback(15);
    const updated = dossiers.filter((d) => d.id !== dossierId);
    setDossiers(updated);
    saveSavedDossiers(updated);
    onNotify('Dossier entfernt.');
  };

  const handleAdoptTodo = (dossier: SavedDossierItem, todo: string, idx: number) => {
    const key = `${dossier.id}_${idx}`;
    if (addedTaskKeys[key]) return;
    triggerHapticFeedback([15, 30]);

    onAddTask(dossier.projectId, todo, 'Hoch', 30);
    setAddedTaskKeys((prev) => ({ ...prev, [key]: true }));
    onNotify('Aufgabe ins Projekt übernommen!');
  };

  const handleSaveToKnowledge = (dossier: SavedDossierItem) => {
    triggerHapticFeedback(20);
    if (onAddKnowledge) {
      onAddKnowledge(
        dossier.projectId,
        'reference',
        dossier.title,
        dossier.markdownContent
      );
      onNotify(`Unter Wissen von "${dossier.projectName}" gesichert.`);
    }
  };

  const persistProposal = async (proposal: ForemanProposal) => {
    if (onParkForemanProposal) {
      onParkForemanProposal(proposal);
      return;
    }
    const existing = loadForemanProposals();
    await saveForemanProposals([proposal, ...existing.filter((p) => p.id !== proposal.id)]);
  };

  const handleStartMurmurResearch = () => {
    if (!murmurEnabled) return;
    const topic = searchTopic.trim();
    if (!topic) return;

    const targetProj = allProjects.find((p) => p.id === selectedProjectId) || activeProject;
    const depthSnapshot = researchDepth;
    const apiKeySnapshot = userApiKey;

    triggerHapticFeedback(15);
    setSearchTopic('');
    const noticeMsg = 'Vorarbeiter prüft im Hintergrund – du kannst einfach weiterarbeiten';
    setMurmurNotice(noticeMsg);
    onNotify(noticeMsg);

    void (async () => {
      try {
        const res = await runDeepResearchWithCitations(
          topic,
          targetProj.name,
          apiKeySnapshot,
          depthSnapshot
        );
        const proposal = buildProposalFromResearchResult({
          projectId: targetProj.id,
          projectName: targetProj.name,
          title: res.title,
          markdownContent: res.markdownDossier,
          followUpTasks: res.followUpTasks || [],
          sourcesCount: res.sources?.length || 0,
          modelUsed: res.modelUsed
        });
        await persistProposal(proposal);
      } catch {
        // Stille Fehlerbehandlung im Hintergrund-Modus
      }
    })();
  };

  const handleParkDossierAsProposal = (dossier: SavedDossierItem) => {
    if (!murmurEnabled) return;
    triggerHapticFeedback(15);
    const proposal = buildProposalFromResearchResult({
      id: `murmur-dossier:${dossier.projectId}:${dossier.id}`,
      projectId: dossier.projectId,
      projectName: dossier.projectName,
      title: dossier.title,
      markdownContent: dossier.markdownContent,
      followUpTasks: dossier.followUpTasks || [],
      sourcesCount: dossier.sources?.length || 0,
      modelUsed: dossier.modelUsed || 'Dossier'
    });
    void persistProposal(proposal);
    setParkedDossierIds((prev) => ({ ...prev, [dossier.id]: true }));
    onNotify('Als Freigabe-Vorschlag für den Vorarbeiter geparkt.');
  };

  const activeProjects = allProjects.filter((p) => !p.archived);
  const openWatchlistItems = watchlist.filter((w) => !w.completed);

  return (
    <section className="space-y-4">
      {/* Sektions-Kopfzeile */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2.5 min-w-0">
          <BookOpenCheck className="w-5 h-5 shrink-0" style={{ color: themeColors.highlight }} />
          <div>
            <h3 className="text-base font-bold text-[#F1F5F9] tracking-wide">
              Deep Research
            </h3>
            <p className="text-xs text-[#94A3B8]">
              Rechts-, Normen-, Bau- &amp; Hygiene-Dossiers mit Belegen
            </p>
          </div>
        </div>
        <span className="text-xs font-semibold text-[#94A3B8] px-2.5 py-1 rounded-full bg-[#191C22] border border-white/5 font-mono shrink-0">
          {dossiers.length} Dossiers
        </span>
      </div>

      {/* HONIG-GOLD-HINWEIS BEI FEHLENDEM GEMINI-KEY */}
      {!userApiKey?.trim() && (
        <div
          role="alert"
          className="p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs"
          style={{
            backgroundColor: '#191C22',
            borderColor: 'rgba(229,169,60,0.35)'
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <Sparkles className="w-4 h-4 text-[#E5A93C] shrink-0" />
            <span className="text-[#F1F5F9]">
              Kein aktiver Gemini API-Key hinterlegt. Live-Web-Recherche erfordert einen Key.
            </span>
          </div>
          <button
            type="button"
            onClick={() => onOpenSettings?.('ai')}
            className="min-h-[44px] px-3.5 rounded-xl font-bold text-[#111317] shrink-0 active:scale-95 transition cursor-pointer flex items-center justify-center shadow-sm"
            style={{ backgroundColor: '#E5A93C' }}
          >
            Zentrale (KI)
          </button>
        </div>
      )}

      {/* KOMPAKTER SUCH- & RECHERCHE-BEREICH */}
      <div
        className="p-4 rounded-3xl border space-y-3 shadow-md"
        style={{
          backgroundColor: '#191C22',
          borderColor: 'rgba(255,255,255,0.04)'
        }}
      >
        <div className="space-y-1">
          <label className="text-xs font-semibold text-[#94A3B8] block">
            Prüfgegenstand oder juristische/technische Frage:
          </label>
          <textarea
            rows={2}
            value={searchTopic}
            onChange={(e) => setSearchTopic(e.target.value)}
            placeholder="z. B. 'DVGW G 607 Gasanlagenprüfung, DIN-Normen oder Abnahme-Vorschriften'..."
            className="w-full min-h-[52px] p-3 rounded-2xl text-xs bg-[#111317] text-[#F1F5F9] border border-white/10 placeholder-[#94A3B8] focus:outline-none focus:border-white/20"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs text-[#94A3B8] block">Ziel-Projekt:</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold bg-[#111317] text-[#F1F5F9] border border-white/10 cursor-pointer"
            >
              {activeProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-[#94A3B8] block">Recherche-Tiefe:</label>
            <select
              value={researchDepth}
              onChange={(e) => setResearchDepth(e.target.value as any)}
              className="w-full min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold bg-[#111317] text-[#F1F5F9] border border-white/10 cursor-pointer"
            >
              <option value="full_dossier">Voll-Dossier (Gesetze, Zitate &amp; To-dos)</option>
              <option value="quick">Kompakter Schnell-Beleg</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isResearching || !searchTopic.trim()}
            onClick={() => handleStartResearch()}
            className="flex-1 min-w-[180px] min-h-[48px] px-4 py-3 rounded-2xl text-xs font-bold text-white flex items-center justify-center gap-2 disabled:opacity-40 active:scale-98 transition shadow-sm cursor-pointer"
            style={{ backgroundColor: themeColors.primary }}
          >
            {isResearching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>Recherchiere deutsche Gesetze &amp; Normen...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4 shrink-0" />
                <span>Tiefenrecherche jetzt starten</span>
              </>
            )}
          </button>

          {murmurEnabled && (
            <button
              type="button"
              data-testid="btn-murmur-research"
              disabled={!searchTopic.trim()}
              onClick={handleStartMurmurResearch}
              className="min-h-[48px] px-4 py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-40 active:scale-95 transition cursor-pointer border"
              style={{
                backgroundColor: '#111317',
                color: '#E5A93C',
                borderColor: 'rgba(229,169,60,0.35)'
              }}
            >
              <Clock className="w-4 h-4 shrink-0" />
              <span>Nebenbei prüfen</span>
            </button>
          )}
        </div>

        {murmurEnabled && murmurNotice && (
          <div
            role="status"
            data-testid="murmur-background-notice"
            className="p-3 rounded-2xl border flex items-center gap-2.5 text-xs text-[#F1F5F9]"
            style={{
              backgroundColor: '#111317',
              borderColor: 'rgba(229,169,60,0.35)'
            }}
          >
            <Sparkles className="w-4 h-4 text-[#E5A93C] shrink-0" />
            <span className="min-w-0 flex-1 break-words">{murmurNotice}</span>
          </div>
        )}
      </div>

      {/* AUTO-AUDIT WÄCHTERLISTE (falls offene kritische Punkte vorliegen) */}
      {openWatchlistItems.length > 0 && (
        <div
          className="p-3.5 rounded-2xl border space-y-2.5"
          style={{
            backgroundColor: '#191C22',
            borderColor: 'rgba(255,255,255,0.04)'
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-[#E5A93C]" />
              <span>Erkannte kritische Punkte ({openWatchlistItems.length} offen):</span>
            </div>
          </div>
          <div className="space-y-1.5">
            {openWatchlistItems.slice(0, 3).map((item) => (
              <div
                key={item.id}
                className="p-2.5 rounded-xl bg-[#111317] border border-white/5 flex items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[#F1F5F9] font-medium truncate">{item.topic}</div>
                  <div className="text-xs text-[#94A3B8] truncate">
                    {item.projectName} • {item.detectedReason}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isResearching}
                  onClick={() => handleStartResearch(item.topic, item.id)}
                  className="min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-bold text-[#14B8A6] bg-[#14B8A6]/10 hover:bg-[#14B8A6]/20 border border-[#14B8A6]/30 flex items-center gap-1.5 active:scale-95 transition shrink-0 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Prüfen</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RUHIGE KARTEN-LISTE DER ERSTELLTEN DOSSIERS */}
      {dossiers.length === 0 ? (
        <div
          className="p-8 rounded-3xl border text-center space-y-2 shadow-sm"
          style={{
            backgroundColor: '#191C22',
            borderColor: 'rgba(255,255,255,0.04)'
          }}
        >
          <Scale className="w-8 h-8 text-[#94A3B8] mx-auto opacity-50" />
          <div className="text-sm font-bold text-[#F1F5F9]">Noch keine Recherche-Dossiers</div>
          <p className="text-xs text-[#94A3B8] max-w-xs mx-auto">
            Gib eine Prüffrage zu Vorschriften, Baugruppen oder Abnahmen ein. Die KI erstellt ein
            gerichtsfestes Dossier mit Gesetzeszitaten und To-dos für die Behördenabnahme.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {dossiers.map((dos) => {
            const isExpanded = !!expandedDossierIds[dos.id];
            const targetProj = allProjects.find((p) => p.id === dos.projectId) || activeProject;
            const projColor =
              (targetProj.customMeta?.customAccentColor as string) ||
              targetProj.accentColor ||
              themeColors.primary;

            return (
              <div
                key={dos.id}
                className="rounded-2xl border relative overflow-hidden transition-all shadow-sm"
                style={{
                  backgroundColor: '#191C22',
                  borderColor: isExpanded ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)'
                }}
              >
                {/* 3-px Projektfarbstreifen links */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-[3px]"
                  style={{ backgroundColor: projColor }}
                  aria-hidden="true"
                />

                {/* Ziffern & Titel-Zeile (In-Place Aufklappen, Titel voll mehrzeilig!) */}
                <button
                  type="button"
                  onClick={() => toggleExpand(dos.id)}
                  className="w-full min-h-[52px] p-3.5 pl-4 flex items-start justify-between gap-3 text-left active:bg-white/5 transition cursor-pointer"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <h4 className="text-base font-bold text-[#F1F5F9] leading-snug break-words">
                      {dos.title}
                    </h4>
                    <div className="flex items-center gap-2 flex-wrap pt-0.5">
                      <span className="text-xs px-2 py-0.5 rounded-md bg-white/5 text-[#94A3B8] font-medium">
                        {dos.projectName}
                      </span>
                      <span className="font-mono text-xs text-[#94A3B8]">
                        {dos.createdAt}
                      </span>
                      {dos.sources && dos.sources.length > 0 && (
                        <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-white/5 text-[#14B8A6] font-semibold">
                          {dos.sources.length} {dos.sources.length === 1 ? 'Quelle' : 'Quellen'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 pt-1">
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-[#94A3B8]" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#94A3B8]" />
                    )}
                  </div>
                </button>

                {/* AUFGEKLAPPTER DOSSIER-INHALT */}
                {isExpanded && (
                  <div className="px-3.5 pb-3.5 pt-2 border-t border-white/5 space-y-3.5 bg-[#111317]/60">
                    {/* Markdown Dossier Fließtext */}
                    <div className="p-3.5 rounded-xl bg-[#191C22] border border-white/5 space-y-2 text-xs text-[#F1F5F9] leading-relaxed max-h-[50vh] overflow-y-auto whitespace-pre-wrap select-text">
                      {dos.markdownContent}
                    </div>

                    {/* Quellen-Links */}
                    {dos.sources && dos.sources.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-xs font-semibold text-[#94A3B8] px-0.5">
                          Verifizierte Quellen:
                        </div>
                        <div className="space-y-1">
                          {dos.sources.map((src, sIdx) => (
                            <a
                              key={sIdx}
                              href={src.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="min-h-[44px] px-3 py-2 rounded-xl bg-[#191C22] hover:bg-[#22262F] border border-white/5 flex items-center justify-between gap-2 text-xs text-[#14B8A6] transition"
                            >
                              <span className="truncate">{src.title || src.url}</span>
                              <ExternalLink className="w-3.5 h-3.5 shrink-0 text-[#94A3B8]" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Abgeleitete To-dos mit 1-Tipp Übernahme */}
                    {dos.followUpTasks && dos.followUpTasks.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-xs font-semibold text-[#94A3B8] px-0.5">
                          Abgeleitete Prüf-Aufgaben für die Endabnahme:
                        </div>
                        <div className="space-y-1.5">
                          {dos.followUpTasks.map((todo, tIdx) => {
                            const isAdded = !!addedTaskKeys[`${dos.id}_${tIdx}`];
                            return (
                              <div
                                key={tIdx}
                                className="min-h-[44px] p-2.5 rounded-xl bg-[#191C22] border border-white/5 flex items-center justify-between gap-2 text-xs"
                              >
                                <span className="text-[#F1F5F9] flex-1 min-w-0 break-words">
                                  {todo}
                                </span>
                                <button
                                  type="button"
                                  disabled={isAdded}
                                  onClick={() => handleAdoptTodo(dos, todo, tIdx)}
                                  className={`min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 shrink-0 active:scale-95 cursor-pointer ${
                                    isAdded
                                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                      : 'bg-[#242930] hover:bg-[#2A3038] text-white border-white/10'
                                  }`}
                                >
                                  {isAdded ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                                      <span>Übernommen</span>
                                    </>
                                  ) : (
                                    <>
                                      <Plus className="w-3.5 h-3.5 text-[#14B8A6]" />
                                      <span>Als Task</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Aktionsleiste */}
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      <button
                        type="button"
                        onClick={() => handleSaveToKnowledge(dos)}
                        className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 active:scale-95 transition shadow-sm cursor-pointer"
                        style={{ backgroundColor: themeColors.primary }}
                      >
                        <FileCheck2 className="w-4 h-4 shrink-0" />
                        <span>Unter Wissen sichern</span>
                      </button>

                      {murmurEnabled && (
                        <button
                          type="button"
                          data-testid={`btn-park-dossier-${dos.id}`}
                          disabled={!!parkedDossierIds[dos.id]}
                          onClick={() => handleParkDossierAsProposal(dos)}
                          className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer border disabled:opacity-60"
                          style={{
                            backgroundColor: '#111317',
                            color: '#E5A93C',
                            borderColor: 'rgba(229,169,60,0.35)'
                          }}
                        >
                          <Sparkles className="w-4 h-4 shrink-0" />
                          <span>
                            {parkedDossierIds[dos.id]
                              ? 'Als Vorschlag geparkt'
                              : 'Als Freigabe-Vorschlag parken'}
                          </span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDeleteDossier(dos.id)}
                        className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
                        title="Dossier löschen"
                      >
                        <Trash2 className="w-4 h-4 shrink-0" />
                        <span>Löschen</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
