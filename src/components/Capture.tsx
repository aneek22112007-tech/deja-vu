import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Sparkles, Wand2 } from 'lucide-react';
import type { Backend } from '../lib/backend';
import type { CaptureResult } from '../lib/types';
import { useSpeech } from '../lib/useSpeech';
import { MicButton, SessionFields, StatusBadge } from './ui';

const EXAMPLES = [
  "ok, 502s after deploy — thought it was the LB, wasn't — stale env var, restarted worker, fixed.",
  'Image uploads failing with 413 on prod only. Thought it was the S3 bucket policy, nope. Turns out nginx client_max_body_size was 1m. Bumped it to 20m, fixed. Oh and the test login was dev@example.com password=hunter22 from 10.0.3.14',
  'Dashboard shows yesterday’s numbers until hard refresh. Suspected the API cache, wasn’t it. Root cause was the CDN caching index.html for 24h. Set cache-control no-cache on index.html, fixed.',
];

export function Capture({ backend, onSaved }: { backend: Backend; onSaved: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CaptureResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const speech = useSpeech((t) => setText((prev) => (prev ? prev.trimEnd() + ' ' : '') + t));
  useEffect(() => {
    const on = () => speech.toggle();
    addEventListener('dejavu:toggle-mic', on);
    return () => removeEventListener('dejavu:toggle-mic', on);
  }, [speech]);

  const save = async () => {
    if (!text.trim()) return;
    speech.stop();
    setBusy(true);
    setErr(null);
    try {
      const r = await backend.capture(text);
      setResult(r);
      setText('');
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const redCount = result?.redactions.reduce((n, f) => n + f.count, 0) ?? 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      <section className="panel p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Capture a debugging session</h2>
            <p className="mt-1 text-sm text-slate-400">
              Mid-debug, <span className="text-accent-soft">hold your Wispr Flow key</span> and mutter what you see, what you tried, what worked. Messy is fine.
            </p>
          </div>
          <MicButton listening={speech.listening} onClick={speech.toggle} />
        </div>
        <textarea
          ref={ta}
          data-testid="capture-input"
          autoFocus
          value={text + (speech.interim ? (text ? ' ' : '') + speech.interim : '')}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && save()}
          rows={7}
          placeholder={'“ok, 502s after deploy — thought it was the LB, wasn\'t — stale env var, restarted worker, fixed.”'}
          className="field resize-y font-mono text-sm leading-relaxed"
        />
        {speech.listening && <p className="mt-2 font-mono text-xs text-red-300">● listening… click the mic again to stop</p>}
        {speech.error && <p className="mt-2 text-xs text-amber-300">{speech.error}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button data-testid="capture-save" className="btn-primary" onClick={save} disabled={busy || !text.trim()}>
            <Sparkles className="h-4 w-4" /> {busy ? 'Structuring…' : 'Remember this'}
          </button>
          <span className="font-mono text-[11px] text-slate-600">⌘/Ctrl + Enter</span>
          <div className="ml-auto flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex, i) => (
              <button key={i} className="chip" onClick={() => { setText(ex); ta.current?.focus(); }} title={ex}>
                <Wand2 className="h-3 w-3" /> example {i + 1}
              </button>
            ))}
          </div>
        </div>
        {err && <p className="mt-3 text-sm text-red-300">{err}</p>}
        <div className="mt-6 flex items-start gap-2 rounded-xl border border-ink-700 bg-ink-950/50 p-3 text-xs text-slate-400">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ok" />
          <span>A redaction pass strips API keys, tokens, JWTs, AWS keys, passwords, emails, IPs and connection-string credentials <b>before</b> anything is structured, embedded or stored.</span>
        </div>
      </section>

      <section className="panel p-6" data-testid="capture-result">
        {!result ? (
          <div className="grid h-full place-items-center py-10 text-center">
            <div>
              <div className="mx-auto mb-3 h-12 w-12 rounded-2xl border border-ink-600 bg-ink-850 grid place-items-center font-mono text-accent">{'{ }'}</div>
              <p className="text-sm text-slate-400">Your note becomes <span className="font-mono text-slate-300">{'{symptom, hypotheses_tried, root_cause, fix, tags}'}</span></p>
              <p className="mt-1 text-xs text-slate-600">…then gets embedded so future-you can find it by symptom.</p>
            </div>
          </div>
        ) : (
          <div className="animate-fadeUp space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-white">Saved to memory</h3>
              <StatusBadge s={result.session.status} />
              <span className="tag">structured by {result.structuredBy}</span>
              <span className={`tag ${redCount ? '!text-amber-300' : ''}`} data-testid="redaction-count">🛡 {redCount} redacted</span>
            </div>
            <SessionFields s={result.session} />
            {redCount > 0 && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200">
                Redacted: {result.redactions.map((f) => `${f.type.replace(/_/g, ' ')} ×${f.count}`).join(', ')}
              </div>
            )}
            <details className="text-xs text-slate-500">
              <summary className="cursor-pointer select-none">stored transcript (redacted)</summary>
              <p className="mt-2 whitespace-pre-wrap rounded-lg bg-ink-950 p-3 font-mono text-slate-400">{result.session.raw_transcript_redacted}</p>
            </details>
          </div>
        )}
      </section>
    </div>
  );
}
