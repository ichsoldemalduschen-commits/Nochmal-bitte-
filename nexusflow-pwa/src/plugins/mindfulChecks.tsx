import React, { useState } from 'react';
import { Check, Compass, HeartHandshake, Shuffle, X } from 'lucide-react';
import { SelfCheckEntry, THEME } from '../types';
import { formatNow } from '../services/storage';

const REALITY_CHECK_POOL = [
  {
    id: 'rc-1',
    category: 'Vorbereitung & Fokus',
    questions: [
      'Habe ich für den nächsten Baugruppen- oder Back-Schritt alle Maße und Werkzeuge griffbereit?',
      'Fehlt Material, das sofort in den Einkaufswagen gehört?',
      'Sind kritische Maße oder Anschlüsse vor Ort schon als Foto unter „Infos“ gesichert?'
    ]
  },
  {
    id: 'rc-2',
    category: 'Prozess & Timing',
    questions: [
      'Läuft gerade eine Aufheiz-, Gare- oder Ruhezeit, für die ein Timer sinnvoll ist?',
      'Arbeite ich am wichtigsten Engpass oder verzettele ich mich in Feindetails?',
      'Kann ich einen losen Gedanken kurz per Alt + S diktieren, um den Kopf frei zu halten?'
    ]
  },
  {
    id: 'rc-3',
    category: 'Qualität & Energie',
    questions: [
      'Sind geänderte Mengen oder Rezepturen in den Arbeitserklärungen vermerkt?',
      'Gibt es rote 6px KI-Punkte, die ich kurz prüfen und antippen möchte?',
      'Wie ist mein eigener Energie-Stand – brauche ich 2 Minuten Pause oder Wasser?'
    ]
  }
];

const SELF_CHECK_OPTIONS = {
  energy: ['Leer', 'Körperlich müde', 'Ruhig', 'Ausgeglichen', 'Solide', 'Voller Tatendrang'],
  focus: ['Überladen', 'Unruhig', 'Sprunghaft', 'Entspannt', 'Klar', 'Fokussiert'],
  moodTags: [
    'Sachlich',
    'Gelassen',
    'Nachdenklich',
    'Zufrieden',
    'Unter Zeitdruck',
    'Neugierig',
    'Angespannt',
    'Dankbar',
    'Erleichtert'
  ]
};

export const RealityCheckModal: React.FC<{
  open: boolean;
  onClose: () => void;
}> = ({ open, onClose }) => {
  const [setIdx, setSetIdx] = useState(0);
  const [checkedMap, setCheckedMap] = useState<Record<number, boolean>>({});

  if (!open) return null;
  const current = REALITY_CHECK_POOL[setIdx];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="max-w-md w-full rounded-2xl border border-[#14B8A6]/50 overflow-hidden shadow-2xl"
        style={{ backgroundColor: THEME.bgCard }}
      >
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Compass className="w-5 h-5 text-[#14B8A6]" />
            <div>
              <h3 className="text-sm font-bold text-white">Reality-Check Impuls (3 Fragen)</h3>
              <p className="text-[11px] text-[#9CA3AF]">Fokus: {current.category}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-[#9CA3AF] hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {current.questions.map((q, idx) => {
            const checked = !!checkedMap[idx];
            return (
              <div
                key={idx}
                onClick={() => setCheckedMap((p) => ({ ...p, [idx]: !p[idx] }))}
                className="p-3 rounded-xl border border-white/10 flex items-start gap-3 cursor-pointer hover:border-[#14B8A6]"
                style={{ backgroundColor: THEME.bgSub }}
              >
                <div
                  className="mt-0.5 w-5 h-5 rounded flex items-center justify-center border shrink-0"
                  style={{
                    backgroundColor: checked ? THEME.accentPrimary : 'transparent',
                    borderColor: checked ? THEME.accentHighlight : '#9CA3AF'
                  }}
                >
                  {checked && <Check className="w-3.5 h-3.5 text-white" />}
                </div>
                <span className="text-xs text-[#F8F9FA] leading-relaxed">{q}</span>
              </div>
            );
          })}

          <div className="flex items-center justify-between pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={() => {
                setSetIdx((setIdx + 1) % REALITY_CHECK_POOL.length);
                setCheckedMap({});
              }}
              className="px-3 py-1.5 rounded-lg text-xs bg-[#2F363D] text-[#14B8A6] flex items-center gap-1.5"
            >
              <Shuffle className="w-3.5 h-3.5" />
              Nächster Impuls
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white"
              style={{ backgroundColor: THEME.accentPrimary }}
            >
              Weiterarbeiten
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const SelfCheckModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onSave: (entry: SelfCheckEntry) => void;
}> = ({ open, onClose, onSave }) => {
  const [energy, setEnergy] = useState('Solide');
  const [focus, setFocus] = useState('Klar');
  const [moodTags, setMoodTags] = useState<string[]>(['Sachlich']);
  const [note, setNote] = useState('');

  if (!open) return null;

  const toggleTag = (tag: string) => {
    setMoodTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: `sc-${Date.now()}`,
      timestamp: formatNow(),
      energy,
      focus,
      moodTags: moodTags.length > 0 ? moodTags : ['Neutral'],
      note: note.trim() || 'Kein Freitext hinterlegt.',
      customMeta: {}
    });
    setNote('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="max-w-md w-full rounded-2xl border border-white/15 overflow-hidden shadow-2xl"
        style={{ backgroundColor: THEME.bgCard }}
      >
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <HeartHandshake className="w-5 h-5 text-[#14B8A6]" />
            <div>
              <h3 className="text-sm font-bold text-white">Wertfreier 10-Sekunden Selbst-Check</h3>
              <p className="text-[11px] text-[#9CA3AF]">Zustand ohne Bewertung festhalten</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-[#9CA3AF] hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-white mb-1.5">
              1. Energie- &amp; Körpergefühl:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {SELF_CHECK_OPTIONS.energy.map((opt) => (
                <button
                  type="button"
                  key={opt}
                  onClick={() => setEnergy(opt)}
                  className={`px-2.5 py-1 rounded-lg text-xs border transition ${
                    energy === opt
                      ? 'bg-[#0A9396] text-white border-[#14B8A6]'
                      : 'bg-[#181A1B] text-[#9CA3AF] border-white/10'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-white mb-1.5">
              2. Kopf &amp; Fokus:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {SELF_CHECK_OPTIONS.focus.map((opt) => (
                <button
                  type="button"
                  key={opt}
                  onClick={() => setFocus(opt)}
                  className={`px-2.5 py-1 rounded-lg text-xs border transition ${
                    focus === opt
                      ? 'bg-[#0A9396] text-white border-[#14B8A6]'
                      : 'bg-[#181A1B] text-[#9CA3AF] border-white/10'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-white mb-1.5">
              3. Aktuelle Stimmung:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {SELF_CHECK_OPTIONS.moodTags.map((tag) => {
                const active = moodTags.includes(tag);
                return (
                  <button
                    type="button"
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-2 py-1 rounded-lg text-xs border transition ${
                      active
                        ? 'bg-[#2F363D] text-[#14B8A6] border-[#14B8A6]'
                        : 'bg-[#181A1B] text-[#9CA3AF] border-white/10'
                    }`}
                  >
                    #{tag}
                  </button>
                );
              })}
            </div>
          </div>

          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Kurze Notiz zum Moment (optional)..."
            className="w-full px-3 py-2 rounded-lg text-xs bg-[#181A1B] text-white border border-white/10"
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs text-[#9CA3AF]">
              Abbrechen
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white"
              style={{ backgroundColor: THEME.accentPrimary }}
            >
              Wertfrei speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const SelfCheckHistoryPanel: React.FC<{ entries: SelfCheckEntry[] }> = ({ entries }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
    {entries.map((sc) => (
      <div
        key={sc.id}
        className="p-4 rounded-xl border border-white/10 space-y-2"
        style={{ backgroundColor: THEME.bgSub }}
      >
        <div className="flex items-center justify-between text-xs text-[#9CA3AF]">
          <span className="font-mono text-[#14B8A6]">{sc.timestamp}</span>
          <div className="flex gap-1">
            {sc.moodTags.map((m) => (
              <span key={m} className="text-[10px] px-1.5 py-0.5 rounded bg-[#181A1B] text-[#9CA3AF]">
                #{m}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="px-2.5 py-1 rounded-lg text-xs bg-[#181A1B] text-white">
            Energie: <strong className="text-[#14B8A6]">{sc.energy}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-lg text-xs bg-[#181A1B] text-white">
            Fokus: <strong className="text-[#14B8A6]">{sc.focus}</strong>
          </span>
        </div>
        <p className="text-xs text-[#F8F9FA] leading-relaxed">{sc.note}</p>
      </div>
    ))}
  </div>
);