import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Mic,
  MicOff,
  RotateCcw,
  Volume2,
  X
} from 'lucide-react';
import { ExplanationItem, THEME } from '../types';
import { speakText, triggerHapticFeedback } from '../services/aiRouter';

interface StepByStepAudioGuideProps {
  explanation: ExplanationItem | null;
  accentColor: string;
  onClose: () => void;
}

/**
 * Update 5: Freihändiger Vorlesemodus (Step-by-Step Audio-Guide)
 * Liest Arbeitserklärungen Schritt für Schritt vor und hört auf Sprachkommandos
 * wie "Weiter", "Nächster Schritt", "Wiederholen", "Zurück", "Stopp".
 */
export const StepByStepAudioGuide: React.FC<StepByStepAudioGuideProps> = ({
  explanation,
  accentColor,
  onClose
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [voiceControlActive, setVoiceControlActive] = useState(true);
  const [lastHeardCommand, setLastHeardCommand] = useState('');
  const recognitionRef = useRef<any>(null);

  const steps = React.useMemo(() => {
    if (!explanation) return [];
    const lines = explanation.stepsText
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);
    return lines.length > 0 ? lines : [explanation.stepsText];
  }, [explanation]);

  const readStepAloud = (idx: number) => {
    if (!steps[idx]) return;
    triggerHapticFeedback(15);
    speakText(`Schritt ${idx + 1} von ${steps.length}: ${steps[idx]}`);
  };

  useEffect(() => {
    if (!explanation || steps.length === 0) return;
    readStepAloud(currentIndex);
  }, [currentIndex, explanation]);

  useEffect(() => {
    if (!explanation || !voiceControlActive) return;

    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) return;

    let active = true;
    const rec = new SpeechRec();
    rec.lang = 'de-DE';
    rec.continuous = true;
    rec.interimResults = false;

    rec.onresult = (ev: any) => {
      const lastResult = ev.results[ev.results.length - 1];
      const phrase = String(lastResult?.[0]?.transcript || '')
        .toLowerCase()
        .trim();
      if (!phrase) return;
      setLastHeardCommand(phrase);

      if (/(weiter|nächster|ok|erledigt|fertig)/i.test(phrase)) {
        setCurrentIndex((prev) => {
          const next = Math.min(steps.length - 1, prev + 1);
          return next;
        });
      } else if (/(zurück|vorheriger)/i.test(phrase)) {
        setCurrentIndex((prev) => Math.max(0, prev - 1));
      } else if (/(wiederholen|nochmal|bitte\s+wiederholen)/i.test(phrase)) {
        readStepAloud(currentIndex);
      } else if (/(stopp|beenden|schließen)/i.test(phrase)) {
        onClose();
      }
    };

    rec.onend = () => {
      if (active && voiceControlActive) {
        try {
          rec.start();
        } catch {
          // ignore
        }
      }
    };

    try {
      rec.start();
      recognitionRef.current = rec;
    } catch {
      // ignore
    }

    return () => {
      active = false;
      try {
        rec.onend = null;
        rec.stop();
      } catch {
        // ignore
      }
    };
  }, [explanation, voiceControlActive, steps.length, currentIndex]);

  if (!explanation) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div
        className="w-full max-w-md rounded-3xl border border-white/15 p-5 space-y-5 shadow-2xl"
        style={{ backgroundColor: THEME.bgCard }}
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#14B8A6]">
              Freihändiger Vorlesemodus (Audio-Guide)
            </div>
            <h3 className="text-sm font-bold text-white truncate max-w-[260px]">
              {explanation.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                window.speechSynthesis.cancel();
              }
              onClose();
            }}
            className="p-2 rounded-xl bg-[#181A1B] text-[#9CA3AF] hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Fortschrittsanzeige */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-bold text-[#9CA3AF]">
            <span>
              Schritt {currentIndex + 1} von {steps.length}
            </span>
            <span>{Math.round(((currentIndex + 1) / steps.length) * 100)} %</span>
          </div>
          <div className="w-full h-2 bg-[#181A1B] rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-300 rounded-full"
              style={{
                width: `${((currentIndex + 1) / steps.length) * 100}%`,
                backgroundColor: accentColor
              }}
            />
          </div>
        </div>

        {/* Großes Schritt-Display für Baustelle / Backstube */}
        <div className="p-5 rounded-2xl bg-[#181A1B] border border-white/10 min-h-[150px] flex items-center justify-center text-center">
          <p className="text-base sm:text-lg font-bold text-white leading-relaxed">
            {steps[currentIndex]}
          </p>
        </div>

        {/* Sprachsteuerungs-Hinweis */}
        <div className="p-3 rounded-xl bg-[#24292E] border border-white/10 flex items-center justify-between gap-2">
          <div className="text-[11px] text-[#9CA3AF]">
            Sprachbefehle: <strong className="text-white">„Weiter“</strong>,{' '}
            <strong className="text-white">„Wiederholen“</strong>,{' '}
            <strong className="text-white">„Zurück“</strong>
            {lastHeardCommand && (
              <div className="text-[10px] text-[#14B8A6] mt-0.5">
                Erkannt: „{lastHeardCommand}“
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setVoiceControlActive((v) => !v)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
              voiceControlActive
                ? 'bg-[#0A9396] text-white'
                : 'bg-[#181A1B] text-[#9CA3AF]'
            }`}
          >
            {voiceControlActive ? (
              <Mic className="w-3.5 h-3.5 animate-pulse" />
            ) : (
              <MicOff className="w-3.5 h-3.5" />
            )}
            <span>{voiceControlActive ? 'Hört zu' : 'Aus'}</span>
          </button>
        </div>

        {/* Große Handschuh-Buttons */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            className="py-3 rounded-xl bg-[#181A1B] text-white text-xs font-bold border border-white/10 disabled:opacity-40 flex items-center justify-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Zurück</span>
          </button>

          <button
            type="button"
            onClick={() => readStepAloud(currentIndex)}
            className="py-3 rounded-xl bg-[#181A1B] text-[#14B8A6] text-xs font-bold border border-white/10 flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Nochmal</span>
          </button>

          <button
            type="button"
            disabled={currentIndex >= steps.length - 1}
            onClick={() => setCurrentIndex((i) => Math.min(steps.length - 1, i + 1))}
            className="py-3 rounded-xl text-white text-xs font-bold disabled:opacity-40 flex items-center justify-center gap-1"
            style={{ backgroundColor: accentColor }}
          >
            <span>Weiter</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
