import { useEffect, useState } from 'react';
import { Archive, Brain, Search } from 'lucide-react';
import { splitMatches, type Backend } from '../lib/backend';
import type { RecallResult } from '../lib/types';
import { SAMPLE_SYMPTOMS } from '../data/seed';
import { useSpeech } from '../lib/useSpeech';
import { recordRecall } from '../lib/stats';
import { getEngine, loadNeural, setEngine, type Engine } from '../lib/neural';
import { ConfidenceBadge, Hypotheses, MicButton, SimilarityBar, StatusBadge, timeAgo } from './ui';

export function Recall({ backend, onChange, showSamples }: { backend: Backend; onChange: () => void; showSamples: boolean }) {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<RecallResult | null>(null);
  const [filed, setFiled] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const speech = useSpeech((t) => setQ((p) => (p ? p.trimEnd() + ' ' : '') + t));
  useEffect(() => {
    const on = () => speech.toggle();
    addEventListener('dejavu:toggle-mic', on);
    return () => removeEventListener('dejavu:toggle-mic', on);
  }, [speech]);
  const [engine, setEng] = useState<Engine>(getEngine());
  const [modelState, setModelState] = useState<string | null>(null);

  const chooseEngine = async (e: Engine) => {
    if (e === 'neural') {
      setModelState('downloading MiniLM… 0%');
      try {
        await loadNeural((p) => setModelState(`downloading MiniLM… ${Math.round(p)}%`));
        setModelState(null);
      } catch (err) {
        setModelState(`couldn't load the neural model (${(err as Error).message}). Staying on lexical.`);
        return;
      }
    } else setModelState(null);
    setEngine(e);
    setEng(e);
  };

  const run = async (query = q) => {
    if (!query.trim()) return;
    speech.stop();
    setQ(query);
    setBusy(true);
    setErr(null);
    setFiled(false);
    setShowAll(false);
    try {
      const r = await backend.recall(query);
      setRes(r);
      recordRecall(r.matched);
      onChange();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const fileIt = async () => {
    if (!res) return;
    await backend.capture(res.query, { status: 'open' });
    setFiled(true);
    onChange();
  };

  return (
    <div className="space-y-6">
      <section className="panel p-6">
        <h2 className="text-lg font-semibold text-white">Have I seen this before?</h2>
        <p className="mt-1 text-sm text-slate-400">Describe the symptom — speak it or type it. Déjà Vu searches every past session by meaning, not keywords.</p>
        <div className="mt-4 flex flex-wrap items-center gap-3 sm:flex-nowrap">
          <div className="relative w-full flex-1 sm:w-auto">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              data-testid="recall-input"
              autoFocus
              value={q + (speech.interim ? ' ' + speech.interim : '')}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && run()}
              placeholder="e.g. getting 502s right after we deployed"
              className="field pl-11"
            />
          </div>
          <MicButton size="sm" listening={speech.listening} onClick={speech.toggle} />
          <button data-testid="recall-go" className="btn-primary h-11" onClick={() => run()} disabled={busy || !q.trim()}>
            <Brain className="h-4 w-4" /> {busy ? 'Recalling…' : 'Recall'}
          </button>
        </div>
        {speech.error && <p className="mt-2 text-xs text-amber-300">{speech.error}</p>}
        {showSamples && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="label mr-1">try:</span>
            {SAMPLE_SYMPTOMS.map((s) => (
              <button key={s.label} className="chip" data-testid={`chip-${s.expectMatch ? 'match' : 'nomatch'}`} onClick={() => run(s.query)}>
                {s.label}
              </button>
            ))}
          </div>
        )}
        {backend.kind === 'local' && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink-700 pt-4 text-xs text-slate-500">
            <span className="label">engine:</span>
            <div className="flex rounded-lg border border-ink-600 p-0.5">
              {(['lexical', 'neural'] as const).map((e) => (
                <button key={e} data-testid={`engine-${e}`} onClick={() => chooseEngine(e)} className={`rounded-md px-2.5 py-1 font-mono ${engine === e ? 'bg-ink-700 text-white' : 'text-slate-400 hover:text-white'}`}>
                  {e === 'lexical' ? 'lexical · instant' : 'neural MiniLM · in-browser'}
                </button>
              ))}
            </div>
            <span>{modelState ?? (engine === 'neural' ? 'all-MiniLM-L6-v2 running locally via transformers.js' : 'hashed n-gram vectors + dev-synonym map, zero download')}</span>
          </div>
        )}
        {err && <p className="mt-3 text-sm text-red-300">{err}</p>}
      </section>

      {!res && !busy && (
        <section className="panel grid place-items-center px-6 py-14 text-center" data-testid="recall-empty">
          <div className="relative mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-ink-600 bg-ink-850">
            <Brain className="h-6 w-6 text-accent" />
            <span className="absolute -right-1 -top-1 h-3 w-3 animate-ping rounded-full bg-accent/50" />
          </div>
          <h3 className="font-medium text-white">Ask your past self</h3>
          <p className="mt-1 max-w-md text-sm text-slate-400">Describe what you're seeing right now — “pods crashlooping after helm upgrade”, “emails sent an hour early”… Déjà Vu searches every session you've ever captured.</p>
          <p className="mt-4 font-mono text-[11px] text-slate-600">press <span className="text-slate-400">/</span> to type · <span className="text-slate-400">Alt+M</span> to speak · hold <span className="text-slate-400">fn</span> for Wispr</p>
        </section>
      )}

      {res && (
        <section className="animate-fadeUp space-y-4" data-testid="recall-result" data-matched={res.matched}>
          {res.matched ? (
            <div className="panel border-violet-500/30 bg-gradient-to-br from-violet-950/40 to-ink-900 p-6">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-2xl">🔁</span>
                <h3 className="text-lg font-semibold text-white">Déjà vu — you've solved this {res.hitCount === 1 ? 'once' : res.hitCount === 2 ? 'twice' : `${res.hitCount}×`} before</h3>
                <ConfidenceBadge c={res.confidence} />
                <span className="tag">explained by {res.explainedBy}</span>
                {res.engine && <span className="tag">{res.engine}</span>}
              </div>
              <p className="text-[15px] leading-relaxed text-slate-200" data-testid="recall-explanation">{res.explanation}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-ink-700 bg-ink-950/50 p-4">
                  <div className="label mb-1">most likely cause</div>
                  <div className="text-slate-100">{res.likelyCause}</div>
                </div>
                <div className="rounded-xl border border-emerald-600/30 bg-emerald-950/20 p-4">
                  <div className="label mb-1 !text-emerald-500/80">fix that worked</div>
                  <div className="text-emerald-100">{res.fixThatWorked}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="panel p-6 text-center">
              <div className="text-3xl">🫥</div>
              <h3 className="mt-2 text-lg font-semibold text-white" data-testid="nomatch-title">No match — filing this for future you.</h3>
              <p className="mt-1 text-sm text-slate-400">
                Nothing in memory is above the {Math.round(res.threshold * 100)}% similarity threshold. Rather than guess, Déjà Vu stays quiet.
              </p>
              <button data-testid="file-open" className="btn-primary mt-4" onClick={fileIt} disabled={filed}>
                <Archive className="h-4 w-4" /> {filed ? 'Filed as an open session ✓' : 'File as open session'}
              </button>
              {filed && <p className="mt-2 text-xs text-slate-500">Resolve it later from Memory once you've found the fix — next time it'll match.</p>}
            </div>
          )}

          {(() => {
            const { shown, hidden } = splitMatches(res.matches);
            return [...shown, ...(showAll ? hidden : [])];
          })().map((m, i) => (
            <article key={m.session.id} className="panel p-5" data-testid="match-card">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <span className="font-mono text-xs text-slate-500">#{i + 1}</span>
                <SimilarityBar value={m.similarity} threshold={res.threshold} />
                <StatusBadge s={m.session.status} />
                {m.session.sample && <span className="tag">sample</span>}
                <span className="ml-auto font-mono text-xs text-slate-500">{timeAgo(m.session.created_at)}</span>
              </div>
              <h4 className="font-medium text-white">{m.session.symptom}</h4>
              <div className="mt-3 grid gap-4 text-sm sm:grid-cols-3">
                <div>
                  <div className="label mb-1">tried</div>
                  <Hypotheses items={m.session.hypotheses_tried} />
                </div>
                <div>
                  <div className="label mb-1">root cause</div>
                  <div className="text-slate-300">{m.session.root_cause || '—'}</div>
                </div>
                <div>
                  <div className="label mb-1">fix</div>
                  <div className="text-emerald-200">{m.session.fix || '—'}</div>
                </div>
              </div>
            </article>
          ))}
          {(() => {
            const { hidden } = splitMatches(res.matches);
            return hidden.length > 0 ? (
              <button className="chip mx-auto" data-testid="toggle-weaker" onClick={() => setShowAll((v) => !v)}>
                {showAll ? 'hide weaker matches' : `+${hidden.length} weaker match${hidden.length > 1 ? 'es' : ''} (more than 5 pts below the top)`}
              </button>
            ) : null;
          })()}
        </section>
      )}
    </div>
  );
}
