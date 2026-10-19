import { useCallback, useEffect, useRef, useState } from 'react';

/* Minimal typings for the Web Speech API (not in lib.dom for all TS versions). */
type SR = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

const getSR = (): (new () => SR) | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

/**
 * Browser dictation fallback. Wispr Flow users don't need this at all: Wispr types straight into
 * the focused textarea. This is for judges / anyone without Wispr installed.
 */
export function useSpeech(onText: (finalText: string) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SR | null>(null);
  const cb = useRef(onText);
  cb.current = onText;
  const supported = !!getSR();

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = getSR();
    if (!Ctor) {
      setError('Browser dictation not supported here — use Wispr Flow (hold your key and talk) or type.');
      return;
    }
    setError(null);
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || 'en-US';
    rec.onresult = (e) => {
      let inter = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) cb.current(r[0].transcript.trim());
        else inter += r[0].transcript;
      }
      setInterim(inter);
    };
    rec.onerror = (e) => setError(e.error === 'not-allowed' ? 'Microphone permission denied.' : `Dictation error: ${e.error}`);
    rec.onend = () => {
      setListening(false);
      setInterim('');
    };
    recRef.current = rec;
    rec.start();
    setListening(true);
  }, []);

  useEffect(() => () => recRef.current?.stop(), []);

  return { listening, interim, error, supported, start, stop, toggle: () => (listening ? stop() : start()) };
}
