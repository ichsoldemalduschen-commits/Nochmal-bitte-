import React, { useRef, useState } from 'react';
import { HelpCircle, Loader2, Mic, MicOff, Sparkles, Upload, X } from 'lucide-react';
import { Attachment, THEME } from '../types';
import { DEMO_VOICE_COMMANDS } from '../services/aiRouter';

interface VoiceModalProps {
  open: boolean;
  activeProjectName: string;
  onClose: () => void;
  onDistributeCommand: (text: string, attachment: Attachment | null) => Promise<void>;
  onAskQuickQuestion: (
    text: string,
    attachment: Attachment | null
  ) => Promise<{ answer: string }>;
  onSaveAnswerToInfos: (question: string, answer: string, attachment: Attachment | null) => void;
}

export const VoiceModal: React.FC<VoiceModalProps> = ({
  open,
  activeProjectName,
  onClose,
  onDistributeCommand,
  onAskQuickQuestion,
  onSaveAnswerToInfos
}) => {
  const [mode, setMode] = useState<'distribute' | 'question'>('distribute');
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [speechNotice, setSpeechNotice] = useState('');
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [qaReply, setQaReply] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  if (!open) return null;

  const toggleMic = () => {
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
      return;
    }

    setSpeechNotice('');
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRec) {
      setSpeechNotice('Web Speech API im aktuellen Browser nicht verfügbar – nutze Texteingabe oder Demo-Befehle.');
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.lang = 'de-DE';
      rec.continuous = true;
      rec.interimResults = true;
      rec.onstart = () => setIsListening(true);
      rec.onresult = (ev: any) => {
        let chunk = '';
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          if (ev.results[i].isFinal) {
            chunk += ev.results[i][0].transcript + ' ';
          }
        }
        if (chunk.trim()) {
          setTranscript((prev) => (prev ? `${prev.trim()} ${chunk.trim()}` : chunk.trim()));
        }
      };
      rec.onerror = () => {
        setIsListening(false);
        setSpeechNotice('Mikrofonzugriff blockiert – wähle unten einen Demo-Befehl oder tippe direkt.');
      };
      rec.onend = () => setIsListening(false);
      recognitionRef.current = rec;
      rec.start();
    } catch {
      setIsListening(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const sizeKB = `${Math.max(1, Math.round(file.size / 1024))} KB`;
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isText = file.type.startsWith('text/') || /\.(txt|md|json|csv)$/i.test(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const res = ev.target?.result;
      setAttachment({
        id: `att-voice-${Date.now()}`,
        name: file.name,
        type: isImage ? 'image' : isPdf ? 'pdf' : 'text',
        mimeType: file.type || 'application/octet-stream',
        size: sizeKB,
        dataUrl: isImage || isPdf ? String(res) : null,
        textContent: isText ? String(res) : null
      });
    };

    if (isText && !isImage && !isPdf) reader.readAsText(file);
    else reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleExecute = async () => {
    if (!transcript.trim()) return;
    setIsProcessing(true);
    if (mode === 'distribute') {
      await onDistributeCommand(transcript.trim(), attachment);
      setTranscript('');
      setAttachment(null);
      setIsProcessing(false);
      onClose();
    } else {
      const res = await onAskQuickQuestion(transcript.trim(), attachment);
      setQaReply(res.answer);
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div
        className="max-w-lg w-full rounded-2xl border border-white/15 overflow-hidden shadow-2xl"
        style={{ backgroundColor: THEME.bgCard }}
      >
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white"
              style={{ backgroundColor: THEME.accentPrimary }}
            >
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Sprach- &amp; KI-Zentrale</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#2F363D] text-[#14B8A6]">
                  Alt + S
                </span>
              </div>
              <p className="text-[11px] text-[#9CA3AF]">
                Verteilt Aufträge projektübergreifend &amp; speichert Anhänge lokal in IndexedDB.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-[#9CA3AF] hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3.5 max-h-[82vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#181A1B] border border-white/10">
            <button
              type="button"
              onClick={() => {
                setMode('distribute');
                setQaReply(null);
              }}
              className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                mode === 'distribute'
                  ? 'bg-[#0A9396] text-white shadow'
                  : 'text-[#9CA3AF] hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Verteilen &amp; Einsortieren
            </button>
            <button
              type="button"
              onClick={() => setMode('question')}
              className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                mode === 'question'
                  ? 'bg-[#0A9396] text-white shadow'
                  : 'text-[#9CA3AF] hover:text-white'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              Schnell-Frage / Foto
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={toggleMic}
              className="flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-2"
              style={{ backgroundColor: isListening ? '#DC2626' : THEME.accentPrimary }}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              {isListening ? 'Aufnahme stoppen' : 'Live-Mikrofon starten (de-DE)'}
            </button>

            <label
              className="cursor-pointer py-2.5 px-3 rounded-xl text-xs font-medium border border-white/15 flex items-center justify-center gap-1.5 text-white"
              style={{ backgroundColor: THEME.bgSub }}
            >
              <Upload className="w-3.5 h-3.5 text-[#14B8A6]" />
              <span className="truncate max-w-[140px]">
                {attachment ? attachment.name : 'Foto / PDF / Text'}
              </span>
              <input
                type="file"
                accept="image/*,.pdf,.txt,.md"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          </div>

          {speechNotice && (
            <p className="text-[11px] text-[#14B8A6] bg-[#181A1B] p-2 rounded-lg border border-[#14B8A6]/30">
              {speechNotice}
            </p>
          )}

          {mode === 'distribute' && (
            <div className="p-2.5 rounded-xl bg-[#181A1B] border border-white/10 space-y-1.5">
              <span className="text-[10px] font-bold text-[#14B8A6] uppercase block">
                1-Klick Demo-Sprachbefehle:
              </span>
              {DEMO_VOICE_COMMANDS.map((cmd) => (
                <button
                  key={cmd.id}
                  type="button"
                  onClick={() => setTranscript(cmd.text)}
                  className="w-full text-left p-2 rounded-lg bg-[#24292E] hover:border-[#14B8A6] border border-white/10 transition"
                >
                  <div className="text-[11px] font-bold text-[#14B8A6]">{cmd.label}</div>
                  <div className="text-[10px] text-[#9CA3AF] truncate mt-0.5">„{cmd.text}“</div>
                </button>
              ))}
            </div>
          )}

          <textarea
            rows={3}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Sprich oder tippe deinen Kombi-Befehl oder deine Praxis-Frage ein..."
            className="w-full p-3 rounded-xl text-xs bg-[#181A1B] text-white border border-white/15 focus:outline-none focus:border-[#14B8A6]"
          />

          {qaReply && (
            <div className="p-3 rounded-xl bg-[#181A1B] border border-[#14B8A6] space-y-2">
              <div className="text-xs whitespace-pre-line text-white leading-relaxed">
                {qaReply}
              </div>
              <button
                type="button"
                onClick={() => {
                  onSaveAnswerToInfos(transcript, qaReply, attachment);
                  setQaReply(null);
                  setTranscript('');
                  setAttachment(null);
                  onClose();
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                style={{ backgroundColor: THEME.accentPrimary }}
              >
                In „{activeProjectName} – Allgemeine Infos“ speichern
              </button>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
            <button onClick={onClose} className="px-3 py-1.5 text-xs text-[#9CA3AF]">
              Schließen
            </button>
            <button
              onClick={handleExecute}
              disabled={!transcript.trim() || isProcessing}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 disabled:opacity-40"
              style={{ backgroundColor: THEME.accentPrimary }}
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>{mode === 'distribute' ? 'Jetzt einsortieren' : 'Frage auswerten'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};