import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Copy,
  Edit3,
  Plus,
  Settings,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
  VolumeX
} from 'lucide-react';
import {
  Attachment,
  KnowledgeItem,
  KnowledgeKind,
  Project
} from '../../types';
import { speakText, stopSpeaking, triggerHapticFeedback } from '../../services/aiRouter';
import { ThemeColors } from './FrontHeader';

interface KnowledgeViewProps {
  activeProject: Project;
  allProjects: Project[];
  themeColors: ThemeColors;
  searchQuery: string;
  highlightedItemId: string | null;
  userApiKey?: string;
  onAddKnowledge?: (
    projectId: string,
    kind: KnowledgeKind,
    title: string,
    content: string,
    attachments?: Attachment[]
  ) => void;
  onUpdateKnowledge?: (
    projectId: string,
    itemId: string,
    title: string,
    content: string
  ) => void;
  onDeleteKnowledge?: (projectId: string, knowledgeId: string) => void;
  onRestoreKnowledge?: (projectId: string, item: KnowledgeItem, insertIndex?: number) => void;
  onUploadKnowledgeAttachment?: (
    projectId: string,
    itemId: string,
    file: File
  ) => void;
  onAddExplanation: (projectId: string, title: string, steps: string) => void;
  onUpdateExplanation: (projectId: string, expId: string, title: string, steps: string) => void;
  onAddInfo: (projectId: string, title: string, content: string) => void;
  onUploadInfoAttachment: (projectId: string, infoId: string, file: File) => void;
  onPreviewAttachment: (att: Attachment) => void;
  onConfirmRedDot: (
    projectId: string,
    section: 'tasks' | 'explanations' | 'infos' | 'cart' | 'knowledge',
    itemId: string
  ) => void;
  onMoveKnowledge?: (fromProjectId: string, toProjectId: string, itemId: string) => void;
  onSetActiveAudioGuideExp: (exp: any) => void;
  onOpenSettings?: () => void;
  onAskAi?: (prompt: string) => void;
  onNotify: (msg: string) => void;
  onRegisterUndo?: (action: { message: string; undo: () => void }) => void;
  onConfigMissing?: (msg: string) => void;
}

export const KnowledgeView: React.FC<KnowledgeViewProps> = ({
  activeProject,
  allProjects,
  themeColors,
  searchQuery,
  highlightedItemId: _highlightedItemId,
  userApiKey,
  onAddKnowledge,
  onUpdateKnowledge,
  onDeleteKnowledge,
  onRestoreKnowledge,
  onUploadKnowledgeAttachment,
  onAddExplanation,
  onUpdateExplanation,
  onAddInfo,
  onUploadInfoAttachment,
  onPreviewAttachment,
  onConfirmRedDot,
  onMoveKnowledge,
  onSetActiveAudioGuideExp,
  onOpenSettings,
  onAskAi,
  onNotify,
  onRegisterUndo,
  onConfigMissing
}) => {
  const [knowledgeFilter, setKnowledgeFilter] = useState<'ALL' | 'explanation' | 'info'>('ALL');
  const [openKnowledge, setOpenKnowledge] = useState<Record<string, boolean>>({});
  const [speakingKnowledgeId, setSpeakingKnowledgeId] = useState<string | null>(null);
  const [isAddingKnowledge, setIsAddingKnowledge] = useState(false);
  const [newKnowledgeKind, setNewKnowledgeKind] = useState<KnowledgeKind>('explanation');
  const [newKnowledgeTitle, setNewKnowledgeTitle] = useState('');
  const [newKnowledgeContent, setNewKnowledgeContent] = useState('');
  const [editingKnowledgeId, setEditingKnowledgeId] = useState<string | null>(null);
  const [editKnowledgeTitle, setEditKnowledgeTitle] = useState('');
  const [editKnowledgeContent, setEditKnowledgeContent] = useState('');

  const projectKnowledge: KnowledgeItem[] = useMemo(() => {
    if (Array.isArray(activeProject.knowledge) && activeProject.knowledge.length > 0) {
      return activeProject.knowledge;
    }
    return [
      ...(activeProject.explanations || []).map((e) => ({
        id: e.id,
        kind: 'explanation' as const,
        title: e.title,
        content: e.stepsText || '',
        attachments: [],
        lastModified: e.lastModified,
        changeReason: e.changeReason,
        source: e.source,
        aiTouched: e.aiTouched,
        customMeta: e.customMeta
      })),
      ...(activeProject.infos || []).map((i) => ({
        id: i.id,
        kind: 'info' as const,
        title: i.title,
        content: i.content || '',
        attachments: i.attachments || [],
        lastModified: i.lastModified,
        changeReason: i.changeReason,
        source: i.source,
        aiTouched: i.aiTouched,
        customMeta: i.customMeta
      }))
    ];
  }, [activeProject]);

  const filteredKnowledge = useMemo(() => {
    return projectKnowledge.filter((k) => {
      if (knowledgeFilter !== 'ALL' && k.kind !== knowledgeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return k.title.toLowerCase().includes(q) || k.content.toLowerCase().includes(q);
      }
      return true;
    });
  }, [projectKnowledge, knowledgeFilter, searchQuery]);

  const handleSpeakKnowledge = (item: KnowledgeItem) => {
    if (speakingKnowledgeId === item.id) {
      stopSpeaking();
      setSpeakingKnowledgeId(null);
      return;
    }
    stopSpeaking();
    setSpeakingKnowledgeId(item.id);
    triggerHapticFeedback(12);
    speakText(`${item.title}.\n${item.content}`, () => {
      setSpeakingKnowledgeId(null);
    });
  };

  const handleAskAiClick = (item: KnowledgeItem) => {
    const prompt = `Wissenseintrag "${item.title}":\n${item.content}`;
    if (!userApiKey && !localStorage.getItem('nexusflow_gemini_api_key')) {
      onConfigMissing?.('Gemini API-Key fehlt. In der Zentrale unter System/KI hinterlegen.');
      return;
    }
    if (onAskAi) {
      onAskAi(prompt);
    } else {
      navigator.clipboard.writeText(prompt);
      onNotify('Wissen für KI-Assistenten kopiert.');
    }
  };

  const handleDeleteWithUndo = (item: KnowledgeItem) => {
    if (!onDeleteKnowledge) return;
    const itemIndex = projectKnowledge.findIndex((k) => k.id === item.id);
    const backupItem: KnowledgeItem = {
      ...item,
      attachments: item.attachments ? [...item.attachments] : [],
      customMeta: item.customMeta ? { ...item.customMeta } : {}
    };
    triggerHapticFeedback(15);
    onDeleteKnowledge(activeProject.id, item.id);
    setOpenKnowledge((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
    if (editingKnowledgeId === item.id) {
      setEditingKnowledgeId(null);
    }
    onRegisterUndo?.({
      message: 'Wissenseintrag gelöscht',
      undo: () => {
        if (onRestoreKnowledge) {
          onRestoreKnowledge(
            activeProject.id,
            backupItem,
            itemIndex >= 0 ? itemIndex : undefined
          );
        } else if (onAddKnowledge) {
          onAddKnowledge(
            activeProject.id,
            backupItem.kind,
            backupItem.title,
            backupItem.content,
            backupItem.attachments
          );
        }
        onNotify('Wissenseintrag wiederhergestellt.');
      }
    });
    onNotify('Wissenseintrag gelöscht.');
  };

  return (
    <section className="space-y-3.5">
      {/* Sektions-Kopf ohne äußeren Kasten */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2.5">
          <BookOpen
            className="w-5 h-5"
            style={{ color: themeColors.highlight }}
          />
          <h3 className="text-base font-bold text-[#F1F5F9] tracking-wide">
            Wissen
          </h3>
          <span className="text-xs font-semibold text-[#94A3B8] px-2 py-0.5 rounded-full bg-[#191C22] border border-white/5 font-mono">
            {projectKnowledge.length} Einträge
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsAddingKnowledge((v) => !v)}
          className={`min-h-[44px] min-w-[44px] px-3.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer ${
            isAddingKnowledge
              ? 'text-white border-white/30'
              : 'bg-[#191C22] hover:bg-[#22262F] text-white border-white/5'
          }`}
          style={isAddingKnowledge ? { backgroundColor: themeColors.primary } : {}}
          aria-label="Wissenseintrag hinzufügen"
          title="Wissenseintrag hinzufügen"
        >
          <Plus className="w-4 h-4 text-[#14B8A6]" />
          <span className="hidden sm:inline">Eintrag</span>
        </button>
      </div>

      {/* SCHNELLE FILTER-CHIPS: Alle / Abläufe / Infos */}
      <div className="flex items-center gap-2 pb-1 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setKnowledgeFilter('ALL')}
          className={`min-h-[44px] px-3.5 rounded-xl text-xs font-bold border shrink-0 transition active:scale-95 cursor-pointer ${
            knowledgeFilter === 'ALL'
              ? 'text-white border-white/20 shadow-sm'
              : 'bg-[#191C22] text-[#94A3B8] border-white/5 hover:text-white'
          }`}
          style={knowledgeFilter === 'ALL' ? { backgroundColor: themeColors.primary } : {}}
        >
          Alle ({projectKnowledge.length})
        </button>
        <button
          type="button"
          onClick={() =>
            setKnowledgeFilter((prev) => (prev === 'explanation' ? 'ALL' : 'explanation'))
          }
          className={`min-h-[44px] px-3.5 rounded-xl text-xs font-bold border shrink-0 transition active:scale-95 cursor-pointer ${
            knowledgeFilter === 'explanation'
              ? 'text-white border-white/20 shadow-sm'
              : 'bg-[#191C22] text-[#94A3B8] border-white/5 hover:text-white'
          }`}
          style={knowledgeFilter === 'explanation' ? { backgroundColor: themeColors.primary } : {}}
        >
          Abläufe ({projectKnowledge.filter((k) => k.kind === 'explanation').length})
        </button>
        <button
          type="button"
          onClick={() =>
            setKnowledgeFilter((prev) => (prev === 'info' ? 'ALL' : 'info'))
          }
          className={`min-h-[44px] px-3.5 rounded-xl text-xs font-bold border shrink-0 transition active:scale-95 cursor-pointer ${
            knowledgeFilter === 'info'
              ? 'text-white border-white/20 shadow-sm'
              : 'bg-[#191C22] text-[#94A3B8] border-white/5 hover:text-white'
          }`}
          style={knowledgeFilter === 'info' ? { backgroundColor: themeColors.primary } : {}}
        >
          Infos ({projectKnowledge.filter((k) => k.kind !== 'explanation').length})
        </button>
      </div>

      {/* PROGRESSIVE DISCLOSURE: Eingabeformular für Wissen */}
      {isAddingKnowledge && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newKnowledgeTitle.trim()) return;
            if (onAddKnowledge) {
              onAddKnowledge(
                activeProject.id,
                newKnowledgeKind,
                newKnowledgeTitle.trim(),
                newKnowledgeContent.trim()
              );
            } else if (newKnowledgeKind === 'explanation') {
              onAddExplanation(
                activeProject.id,
                newKnowledgeTitle.trim(),
                newKnowledgeContent.trim()
              );
            } else {
              onAddInfo(
                activeProject.id,
                newKnowledgeTitle.trim(),
                newKnowledgeContent.trim()
              );
            }
            setNewKnowledgeTitle('');
            setNewKnowledgeContent('');
            setIsAddingKnowledge(false);
            onNotify('Wissenseintrag gespeichert.');
          }}
          className="p-4 rounded-2xl bg-[#191C22] border border-white/10 space-y-3 shadow-lg"
        >
          <div className="grid grid-cols-2 gap-2 bg-[#111317] p-1 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => setNewKnowledgeKind('explanation')}
              className={`min-h-[44px] rounded-lg text-xs font-bold transition cursor-pointer ${
                newKnowledgeKind === 'explanation'
                  ? 'text-white shadow'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
              style={newKnowledgeKind === 'explanation' ? { backgroundColor: themeColors.primary } : {}}
            >
              Ablauf / Checkliste
            </button>
            <button
              type="button"
              onClick={() => setNewKnowledgeKind('info')}
              className={`min-h-[44px] rounded-lg text-xs font-bold transition cursor-pointer ${
                newKnowledgeKind === 'info'
                  ? 'text-white shadow'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
              style={newKnowledgeKind === 'info' ? { backgroundColor: themeColors.primary } : {}}
            >
              Info / Maße / Notiz
            </button>
          </div>

          <input
            type="text"
            autoFocus
            value={newKnowledgeTitle}
            onChange={(e) => setNewKnowledgeTitle(e.target.value)}
            placeholder={
              newKnowledgeKind === 'explanation'
                ? 'Titel des Ablaufs (z. B. Ofen einbrennen)...'
                : 'Titel der Info / Maße (z. B. Gasanschluss-Maße)...'
            }
            className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-sm bg-[#111317] text-[#F1F5F9] border border-white/10 placeholder-[#94A3B8] focus:outline-none focus:border-white/20"
          />
          <textarea
            rows={4}
            value={newKnowledgeContent}
            onChange={(e) => setNewKnowledgeContent(e.target.value)}
            placeholder={
              newKnowledgeKind === 'explanation'
                ? 'Einzelschritte (Zeile für Zeile notieren)...'
                : 'Details, technische Daten, Notizen...'
            }
            className="w-full p-3.5 rounded-xl text-sm bg-[#111317] text-[#F1F5F9] border border-white/10 placeholder-[#94A3B8] focus:outline-none focus:border-white/20"
          />
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setIsAddingKnowledge(false);
                setNewKnowledgeTitle('');
                setNewKnowledgeContent('');
              }}
              className="min-h-[44px] px-4 rounded-xl text-xs font-semibold text-[#94A3B8] hover:text-white transition cursor-pointer"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={!newKnowledgeTitle.trim()}
              className="min-h-[44px] px-5 rounded-xl text-xs font-bold text-white shadow-md active:scale-95 transition disabled:opacity-40 cursor-pointer"
              style={{ backgroundColor: themeColors.primary }}
            >
              Speichern
            </button>
          </div>
        </form>
      )}

      {/* WISSENS-LISTE: Karten direkt auf dem Canvas */}
      <div className="space-y-2.5">
        {filteredKnowledge.map((item) => {
          const isOpen = !!openKnowledge[item.id];
          const isEditing = editingKnowledgeId === item.id;
          const isSpeaking = speakingKnowledgeId === item.id;

          return (
            <div
              key={item.id}
              id={`item-card-${item.id}`}
              className="rounded-2xl border transition-all duration-300 overflow-hidden shadow-sm"
              style={{
                backgroundColor: '#191C22',
                borderColor: 'rgba(255,255,255,0.04)'
              }}
            >
              {/* Karten-Ruhezustand */}
              <div
                onClick={() =>
                  setOpenKnowledge((p) => ({ ...p, [item.id]: !p[item.id] }))
                }
                className="p-4 flex items-center justify-between gap-3 cursor-pointer select-none"
              >
                <div className="min-w-0 flex-1 flex items-start gap-2.5">
                  {/* Warmes Honig-Gold #E5A93C für KI-Hinweis */}
                  {item.aiTouched && (
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 bg-[#E5A93C]"
                      title="Automatisch von KI bearbeitet"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                        {item.kind === 'explanation' ? '• Ablauf' : '• Info'}
                      </span>
                      {item.attachments && item.attachments.length > 0 && (
                        <span className="text-xs text-[#14B8A6] font-medium font-mono">
                          ({item.attachments.length} Anhang{item.attachments.length > 1 ? 'e' : ''})
                        </span>
                      )}
                    </div>
                    <h4 className="text-base font-semibold text-[#F1F5F9] leading-snug break-words">
                      {item.title}
                    </h4>
                  </div>
                </div>

                <div className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[#94A3B8] shrink-0">
                  {isOpen ? (
                    <ChevronUp className="w-5 h-5" />
                  ) : (
                    <ChevronDown className="w-5 h-5" />
                  )}
                </div>
              </div>

              {/* Aufgeklappter Zustand */}
              {isOpen && (
                <div className="px-4 pb-4 pt-2 border-t border-white/5 space-y-3 bg-[#111317]/80 animate-fadeIn">
                  {isEditing ? (
                    <div className="space-y-3 pt-2">
                      <input
                        type="text"
                        value={editKnowledgeTitle}
                        onChange={(e) => setEditKnowledgeTitle(e.target.value)}
                        className="w-full min-h-[44px] px-3.5 py-2 rounded-xl text-sm bg-[#191C22] text-[#F1F5F9] border border-white/10"
                      />
                      <textarea
                        rows={5}
                        value={editKnowledgeContent}
                        onChange={(e) => setEditKnowledgeContent(e.target.value)}
                        className="w-full p-3 rounded-xl text-sm bg-[#191C22] text-[#F1F5F9] border border-white/10 font-mono"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingKnowledgeId(null)}
                          className="min-h-[44px] px-4 rounded-xl text-xs font-semibold text-[#94A3B8] hover:text-white cursor-pointer"
                        >
                          Abbrechen
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!editKnowledgeTitle.trim()) return;
                            if (onUpdateKnowledge) {
                              onUpdateKnowledge(
                                activeProject.id,
                                item.id,
                                editKnowledgeTitle.trim(),
                                editKnowledgeContent
                              );
                              onNotify('Wissenseintrag aktualisiert.');
                            } else if (item.kind === 'explanation') {
                              onUpdateExplanation(
                                activeProject.id,
                                item.id,
                                editKnowledgeTitle.trim(),
                                editKnowledgeContent
                              );
                              onNotify('Wissenseintrag aktualisiert.');
                            }
                            setEditingKnowledgeId(null);
                          }}
                          className="min-h-[44px] px-5 rounded-xl text-xs font-bold text-white shadow-md cursor-pointer"
                          style={{ backgroundColor: themeColors.primary }}
                        >
                          Speichern
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="text-sm text-[#F1F5F9] leading-relaxed whitespace-pre-line py-2">
                        {item.content}
                      </div>

                      {/* KI-Bestätigung falls aiTouched in Honig-Gold */}
                      {item.aiTouched && (
                        <div className="p-3 rounded-xl bg-[#E5A93C]/10 border border-[#E5A93C]/30 flex items-center justify-between gap-2">
                          <span className="text-xs text-[#E5A93C] font-medium">
                            KI-Änderung prüfen: {item.changeReason || 'KI-Zuordnung'}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              onConfirmRedDot(
                                activeProject.id,
                                'knowledge',
                                item.id
                              )
                            }
                            className="min-h-[44px] px-3.5 rounded-lg bg-[#E5A93C] text-[#111317] text-xs font-bold hover:bg-[#E5A93C]/90 transition cursor-pointer"
                          >
                            Bestätigen
                          </button>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-white/5 flex-wrap gap-2">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (item.kind === 'explanation') {
                                onSetActiveAudioGuideExp(item);
                              } else {
                                handleSpeakKnowledge(item);
                              }
                            }}
                            className={`min-h-[44px] px-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 border border-white/5 active:scale-95 transition cursor-pointer ${
                              isSpeaking
                                ? 'text-white border-white/20 animate-pulse'
                                : 'bg-[#191C22] hover:bg-[#22262F] text-[#14B8A6] hover:text-white'
                            }`}
                            style={isSpeaking ? { backgroundColor: themeColors.primary } : {}}
                            title={
                              item.kind === 'explanation'
                                ? 'Freihändigen Audio-Guide starten'
                                : isSpeaking
                                ? 'Vorlesen anhalten'
                                : 'Text flüssig vorlesen'
                            }
                          >
                            {isSpeaking ? (
                              <>
                                <VolumeX className="w-4 h-4" />
                                <span>Stopp</span>
                              </>
                            ) : (
                              <>
                                <Volume2 className="w-4 h-4" />
                                <span>{item.kind === 'explanation' ? 'Audio-Guide' : 'Vorlesen'}</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(`${item.title}\n\n${item.content}`);
                              triggerHapticFeedback(10);
                              onNotify('Wissenseintrag in die Zwischenablage kopiert.');
                            }}
                            className="min-h-[44px] px-3.5 rounded-xl bg-[#191C22] hover:bg-[#22262F] text-[#F1F5F9] hover:text-[#14B8A6] text-xs font-semibold flex items-center gap-2 border border-white/5 active:scale-95 transition cursor-pointer"
                          >
                            <Copy className="w-4 h-4 text-[#14B8A6]" />
                            <span>Kopieren</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingKnowledgeId(item.id);
                              setEditKnowledgeTitle(item.title);
                              setEditKnowledgeContent(item.content);
                            }}
                            className="min-h-[44px] px-3.5 rounded-xl bg-[#191C22] hover:bg-[#22262F] text-[#94A3B8] hover:text-white text-xs font-semibold flex items-center gap-2 border border-white/5 active:scale-95 transition cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                            <span>Bearbeiten</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAskAiClick(item);
                            }}
                            className="min-h-[44px] px-3.5 rounded-xl bg-[#191C22] hover:bg-[#22262F] text-[#14B8A6] hover:text-white text-xs font-semibold flex items-center gap-2 border border-white/5 active:scale-95 transition cursor-pointer"
                            title="Diesen Eintrag direkt an die KI übergeben"
                          >
                            <Sparkles className="w-4 h-4" />
                            <span>KI fragen</span>
                          </button>

                          {onDeleteKnowledge && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteWithUndo(item);
                              }}
                              className="min-h-[44px] px-3.5 rounded-xl text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 flex items-center gap-2 active:scale-95 transition cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4 shrink-0" />
                              <span>Löschen</span>
                            </button>
                          )}
                        </div>

                        <label
                          className="cursor-pointer min-h-[44px] px-4 rounded-xl text-xs font-bold text-white flex items-center gap-2 shadow-sm active:scale-95 transition"
                          style={{ backgroundColor: themeColors.primary }}
                        >
                          <Upload className="w-4 h-4" />
                          <span>Foto / PDF anhängen</span>
                          <input
                            type="file"
                            accept="image/*,.pdf,.txt,.md"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) {
                                if (onUploadKnowledgeAttachment) {
                                  onUploadKnowledgeAttachment(activeProject.id, item.id, f);
                                } else {
                                  onUploadInfoAttachment(activeProject.id, item.id, f);
                                }
                              }
                              e.target.value = '';
                            }}
                          />
                        </label>
                      </div>

                      {/* In anderes Projekt verschieben */}
                      {allProjects.filter((p) => !p.archived && p.id !== activeProject.id).length > 0 && (
                        <div className="pt-2 border-t border-white/5">
                          <select
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) {
                                onMoveKnowledge?.(activeProject.id, e.target.value, item.id);
                              }
                            }}
                            className="w-full min-h-[44px] px-3.5 py-2 rounded-xl text-xs bg-[#111317] text-[#F1F5F9] border border-white/10 focus:outline-none focus:border-[#14B8A6] cursor-pointer"
                          >
                            <option value="" disabled>
                              In anderes Projekt verschieben...
                            </option>
                            {allProjects
                              .filter((p) => !p.archived && p.id !== activeProject.id)
                              .map((p) => (
                                <option key={p.id} value={p.id}>
                                  Verschieben nach: {p.name}
                                </option>
                              ))}
                          </select>
                        </div>
                      )}

                      {/* Anhänge-Liste */}
                      {item.attachments &&
                        item.attachments.map((att) => (
                          <div
                            key={att.id}
                            onClick={() => onPreviewAttachment(att)}
                            className="min-h-[48px] p-3 rounded-xl bg-[#191C22] hover:bg-[#22262F] border border-white/5 flex items-center justify-between text-xs cursor-pointer active:scale-[0.99] transition"
                          >
                            <span className="text-[#F1F5F9] font-medium truncate">
                              {att.name}
                            </span>
                            <span className="text-xs font-semibold text-[#14B8A6] ml-2 shrink-0 font-mono">
                              Öffnen / Maß-Pin ({att.size})
                            </span>
                          </div>
                        ))}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* BEREICHS-EINSTELLUNGEN */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => onOpenSettings?.()}
          className="w-full min-h-[44px] py-2.5 px-4 rounded-xl text-xs font-semibold text-[#94A3B8] hover:text-white bg-[#191C22]/60 hover:bg-[#191C22] border border-white/5 flex items-center justify-center gap-2 active:scale-95 transition cursor-pointer"
        >
          <Settings className="w-4 h-4 text-[#14B8A6]" />
          <span>Wissen-Einstellungen &amp; Sprachausgabe</span>
        </button>
      </div>
    </section>
  );
};
