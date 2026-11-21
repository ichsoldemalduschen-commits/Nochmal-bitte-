import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Edit3,
  Plus,
  Upload,
  Volume2,
  VolumeX
} from 'lucide-react';
import {
  Attachment,
  KnowledgeItem,
  KnowledgeKind,
  Project,
  THEME
} from '../../types';
import { speakText, stopSpeaking, triggerHapticFeedback } from '../../services/aiRouter';
import { ThemeColors } from './FrontHeader';

interface KnowledgeViewProps {
  activeProject: Project;
  allProjects: Project[];
  themeColors: ThemeColors;
  searchQuery: string;
  highlightedItemId: string | null;
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
  onNotify: (msg: string) => void;
}

export const KnowledgeView: React.FC<KnowledgeViewProps> = ({
  activeProject,
  allProjects,
  themeColors,
  searchQuery,
  highlightedItemId,
  onAddKnowledge,
  onUpdateKnowledge,
  onUploadKnowledgeAttachment,
  onAddExplanation,
  onUpdateExplanation,
  onAddInfo,
  onUploadInfoAttachment,
  onPreviewAttachment,
  onConfirmRedDot,
  onMoveKnowledge,
  onSetActiveAudioGuideExp,
  onNotify
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

  return (
    <section
      className="rounded-3xl border border-white/5 p-5 space-y-4 shadow-xl transition-all"
      style={{ backgroundColor: '#1C2026' }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <BookOpen
            className="w-5 h-5"
            style={{ color: themeColors.highlight }}
          />
          <h3 className="text-base font-bold text-white tracking-wide">
            Wissen
          </h3>
          <span className="text-xs font-semibold text-[#9CA3AF] px-2 py-0.5 rounded-full bg-[#242930]">
            {projectKnowledge.length} Einträge
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsAddingKnowledge((v) => !v)}
          className={`min-h-[44px] min-w-[44px] px-3.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition active:scale-95 ${
            isAddingKnowledge
              ? 'text-white border-white/30'
              : 'bg-[#242930] hover:bg-[#2A3038] text-white border-white/5'
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
          className={`min-h-[44px] px-3.5 rounded-xl text-xs font-bold border shrink-0 transition active:scale-95 ${
            knowledgeFilter === 'ALL'
              ? 'bg-[#0A9396] text-white border-[#14B8A6] shadow-sm'
              : 'bg-[#242930] text-[#9CA3AF] border-white/5 hover:text-white'
          }`}
        >
          Alle ({projectKnowledge.length})
        </button>
        <button
          type="button"
          onClick={() =>
            setKnowledgeFilter((prev) => (prev === 'explanation' ? 'ALL' : 'explanation'))
          }
          className={`min-h-[44px] px-3.5 rounded-xl text-xs font-bold border shrink-0 transition active:scale-95 ${
            knowledgeFilter === 'explanation'
              ? 'bg-[#0A9396] text-white border-[#14B8A6] shadow-sm'
              : 'bg-[#242930] text-[#9CA3AF] border-white/5 hover:text-white'
          }`}
        >
          Abläufe ({projectKnowledge.filter((k) => k.kind === 'explanation').length})
        </button>
        <button
          type="button"
          onClick={() =>
            setKnowledgeFilter((prev) => (prev === 'info' ? 'ALL' : 'info'))
          }
          className={`min-h-[44px] px-3.5 rounded-xl text-xs font-bold border shrink-0 transition active:scale-95 ${
            knowledgeFilter === 'info'
              ? 'bg-[#0A9396] text-white border-[#14B8A6] shadow-sm'
              : 'bg-[#242930] text-[#9CA3AF] border-white/5 hover:text-white'
          }`}
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
          className="p-4 rounded-2xl bg-[#242930] border border-white/10 space-y-3 shadow-inner"
        >
          {/* Segmented Control: Ablauf vs. Info */}
          <div className="grid grid-cols-2 gap-2 bg-[#1C2026] p-1 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => setNewKnowledgeKind('explanation')}
              className={`min-h-[44px] rounded-lg text-xs font-bold transition ${
                newKnowledgeKind === 'explanation'
                  ? 'bg-[#0A9396] text-white shadow'
                  : 'text-[#9CA3AF] hover:text-white'
              }`}
            >
              Ablauf / Checkliste
            </button>
            <button
              type="button"
              onClick={() => setNewKnowledgeKind('info')}
              className={`min-h-[44px] rounded-lg text-xs font-bold transition ${
                newKnowledgeKind === 'info'
                  ? 'bg-[#0A9396] text-white shadow'
                  : 'text-[#9CA3AF] hover:text-white'
              }`}
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
            className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-sm bg-[#1C2026] text-white border border-white/10 placeholder-[#9CA3AF] focus:outline-none focus:border-white/20"
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
            className="w-full p-3.5 rounded-xl text-sm bg-[#1C2026] text-white border border-white/10 placeholder-[#9CA3AF] focus:outline-none focus:border-white/20"
          />
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setIsAddingKnowledge(false);
                setNewKnowledgeTitle('');
                setNewKnowledgeContent('');
              }}
              className="min-h-[44px] px-4 rounded-xl text-xs font-semibold text-[#9CA3AF] hover:text-white transition"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={!newKnowledgeTitle.trim()}
              className="min-h-[44px] px-5 rounded-xl text-xs font-bold text-white shadow-md active:scale-95 transition disabled:opacity-40"
              style={{ backgroundColor: themeColors.primary }}
            >
              Speichern
            </button>
          </div>
        </form>
      )}

      {/* WISSENS-LISTE */}
      <div className="space-y-2">
        {filteredKnowledge.map((item) => {
          const isOpen = !!openKnowledge[item.id];
          const isEditing = editingKnowledgeId === item.id;
          const isSpeaking = speakingKnowledgeId === item.id;

          return (
            <div
              key={item.id}
              id={`item-card-${item.id}`}
              className="rounded-2xl border border-white/5 overflow-hidden transition-all shadow-sm"
              style={{ backgroundColor: '#242930' }}
            >
              {/* Karten-Ruhezustand */}
              <div
                onClick={() =>
                  setOpenKnowledge((p) => ({ ...p, [item.id]: !p[item.id] }))
                }
                className="p-4 flex items-center justify-between gap-3 cursor-pointer select-none"
              >
                <div className="min-w-0 flex-1 flex items-center gap-2.5">
                  {/* Roter KI-Punkt */}
                  {item.aiTouched && (
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: THEME.aiRedDot }}
                      title="Automatisch von KI bearbeitet"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                          item.kind === 'explanation'
                            ? 'bg-[#14B8A6]/20 text-[#14B8A6]'
                            : 'bg-indigo-500/20 text-indigo-300'
                        }`}
                      >
                        {item.kind === 'explanation' ? 'Ablauf' : 'Info'}
                      </span>
                      <span className="text-base font-semibold text-white truncate">
                        {item.title}
                      </span>
                    </div>
                    {item.attachments && item.attachments.length > 0 && (
                      <span className="text-xs font-medium text-[#14B8A6] mt-0.5 inline-block">
                        {item.attachments.length} Anhang
                        {item.attachments.length > 1 ? 'änge' : ''}
                      </span>
                    )}
                  </div>
                </div>

                {/* EINHEITLICHER VORLESE-BUTTON AN EXAKT DERSELBEN STELLE */}
                <div className="flex items-center gap-1 shrink-0">
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
                    className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border transition active:scale-95 ${
                      isSpeaking
                        ? 'bg-[#0A9396] text-white border-[#14B8A6] animate-pulse'
                        : 'bg-[#1C2026] text-[#14B8A6] border-white/10 hover:border-[#14B8A6]/40 hover:text-white'
                    }`}
                    title={
                      item.kind === 'explanation'
                        ? 'Freihändigen Audio-Guide starten'
                        : isSpeaking
                        ? 'Vorlesen anhalten'
                        : 'Text flüssig vorlesen'
                    }
                    aria-label="Vorlesen"
                  >
                    {isSpeaking ? (
                      <VolumeX className="w-5 h-5" />
                    ) : (
                      <Volume2 className="w-5 h-5" />
                    )}
                  </button>

                  <div className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[#9CA3AF]">
                    {isOpen ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </div>
                </div>
              </div>

              {/* Aufgeklappter Zustand */}
              {isOpen && (
                <div className="px-4 pb-4 pt-2 border-t border-white/5 space-y-3 bg-[#1C2026]/70 animate-fadeIn">
                  {isEditing ? (
                    <div className="space-y-3 pt-2">
                      <input
                        type="text"
                        value={editKnowledgeTitle}
                        onChange={(e) => setEditKnowledgeTitle(e.target.value)}
                        className="w-full min-h-[44px] px-3.5 py-2 rounded-xl text-sm bg-[#242930] text-white border border-white/10"
                      />
                      <textarea
                        rows={5}
                        value={editKnowledgeContent}
                        onChange={(e) => setEditKnowledgeContent(e.target.value)}
                        className="w-full p-3 rounded-xl text-sm bg-[#242930] text-white border border-white/10 font-mono"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingKnowledgeId(null)}
                          className="min-h-[44px] px-4 rounded-xl text-xs font-semibold text-[#9CA3AF] hover:text-white"
                        >
                          Abbrechen
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (onUpdateKnowledge) {
                              onUpdateKnowledge(
                                activeProject.id,
                                item.id,
                                editKnowledgeTitle,
                                editKnowledgeContent
                              );
                            } else if (item.kind === 'explanation') {
                              onUpdateExplanation(
                                activeProject.id,
                                item.id,
                                editKnowledgeTitle,
                                editKnowledgeContent
                              );
                            } else {
                              onAddInfo(
                                activeProject.id,
                                editKnowledgeTitle,
                                editKnowledgeContent
                              );
                            }
                            setEditingKnowledgeId(null);
                            onNotify('Wissenseintrag aktualisiert.');
                          }}
                          className="min-h-[44px] px-5 rounded-xl text-xs font-bold text-white shadow-md"
                          style={{ backgroundColor: themeColors.primary }}
                        >
                          Speichern
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="text-sm text-[#F8F9FA] leading-relaxed whitespace-pre-line py-2">
                        {item.content}
                      </div>

                      {/* KI-Bestätigung falls aiTouched */}
                      {item.aiTouched && (
                        <div className="p-2.5 rounded-xl bg-red-950/30 border border-red-500/30 flex items-center justify-between">
                          <span className="text-xs text-red-200">
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
                            className="min-h-[44px] px-3 rounded-lg bg-red-500/20 text-red-200 text-xs font-bold hover:bg-red-500/30 transition"
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
                            className={`min-h-[44px] px-4 rounded-xl text-xs font-semibold flex items-center gap-2 border border-white/5 active:scale-95 transition ${
                              isSpeaking
                                ? 'bg-[#0A9396] text-white border-[#14B8A6] animate-pulse'
                                : 'bg-[#242930] hover:bg-[#2A3038] text-[#14B8A6] hover:text-white'
                            }`}
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
                              setEditingKnowledgeId(item.id);
                              setEditKnowledgeTitle(item.title);
                              setEditKnowledgeContent(item.content);
                            }}
                            className="min-h-[44px] px-4 rounded-xl bg-[#242930] hover:bg-[#2A3038] text-[#9CA3AF] hover:text-white text-xs font-semibold flex items-center gap-2 border border-white/5 active:scale-95 transition"
                          >
                            <Edit3 className="w-4 h-4" />
                            <span>Bearbeiten</span>
                          </button>
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
                            className="w-full min-h-[44px] px-3.5 py-2 rounded-xl text-xs bg-[#181A1B] text-white border border-white/10 focus:outline-none focus:border-[#14B8A6] cursor-pointer"
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
                            className="min-h-[48px] p-3 rounded-xl bg-[#242930] hover:bg-[#2A3038] border border-white/5 flex items-center justify-between text-xs cursor-pointer active:scale-[0.99] transition"
                          >
                            <span className="text-white font-medium truncate">
                              {att.name}
                            </span>
                            <span className="text-xs font-semibold text-[#14B8A6] ml-2 shrink-0">
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
    </section>
  );
};
