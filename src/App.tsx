import { useCallback, useEffect, useMemo, useState } from 'react';
import { Brain, Clock, Database, History, Mic, Target } from 'lucide-react';
import { getBackend } from './lib/backend';
import type { Session } from './lib/types';
import { computeStats } from './lib/stats';
import { Capture } from './components/Capture';
import { Recall } from './components/Recall';
import { Memory } from './components/Memory';

type Tab = 'capture' | 'recall' | 'memory';
const TABS: Array<{ id: Tab; label: string; icon: typeof Mic; hint: string }> = [
  { id: 'capture', label: 'Capture', icon: Mic, hint: 'speak a debugging note' },
  { id: 'recall', label: 'Recall', icon: Brain, hint: 'have I seen this?' },
  { id: 'memory', label: 'Memory', icon: History, hint: 'timeline' },
];
const readHash = (): Tab => {
  const h = location.hash.replace('#', '') as Tab;
  return TABS.some((t) => t.id === h) ? h : 'recall';
};

function Stat({ icon: Icon, label, value, tone = 'text-white' }: { icon: typeof Mic; label: string; value: string | number; tone?: string }) {
  return (
    <div className="panel flex items-center gap-3 px-4 py-3">
      <Icon className="h-4 w-4 text-slate-500" />
      <div>
        <div className={`font-mono text-lg font-semibold leading-none ${tone}`} data-testid={`stat-${label.replace(/\s/g, '-')}`}>{value}</div>
        <div className="mt-1 text-[11px] text-slate-500">{label}</div>
      </div>
    </div>
  );
}

export default function App() {
  const backend = useMemo(() => getBackend(), []);
  const [tab, setTab] = useState<Tab>(readHash());
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => {
    backend.list().then(setSessions, (e) => setLoadErr((e as Error).message));
    setTick((t) => t + 1);
  }, [backend]);

  useEffect(() => reload(), [reload]);
  useEffect(() => {
    const on = () => setTab(readHash());
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  const go = (t: Tab) => {
    location.hash = t;
    setTab(t);
  };
  const stats = useMemo(() => computeStats(sessions), [sessions, tick]);
  const isDemo = backend.kind === 'local';

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">
      <header className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 64 64" className="h-9 w-9" aria-hidden>
            <rect width="64" height="64" rx="14" fill="#10131a" />
            <circle cx="26" cy="32" r="13" fill="none" stroke="#a78bfa" strokeWidth="5" />
            <circle cx="38" cy="32" r="13" fill="none" stroke="#34d399" strokeWidth="5" opacity=".85" />
          </svg>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Déjà Vu</h1>
            <p className="text-xs text-slate-500">voice-first memory for debugging · stop re-solving solved bugs</p>
          </div>
        </div>
        <span
          data-testid="mode-badge"
          className={`ml-auto rounded-full border px-3 py-1 font-mono text-[11px] ${isDemo ? 'border-amber-500/30 bg-amber-500/10 text-amber-200' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'}`}
          title={isDemo ? 'No backend configured: everything runs in your browser (localStorage + local embeddings). Pre-seeded with sample incidents.' : 'Connected to Supabase (pgvector) + Groq'}
        >
          {isDemo ? '● demo mode · in-browser' : '● supabase + groq'}
        </span>
        <a className="text-slate-500 hover:text-white" href="https://github.com/aneek22112007-tech/deja-vu" target="_blank" rel="noreferrer" aria-label="GitHub"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden><path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z"/></svg></a>
      </header>

      {isDemo && (
        <div className="mt-4 rounded-xl border border-ink-700 bg-ink-900/60 px-4 py-2.5 text-xs text-slate-400">
          👋 <b className="text-slate-200">Judges:</b> no sign-in needed. Memory is pre-seeded with 18 <i>sample</i> incidents. Go to <b>Recall</b> and click a chip (one deliberately has no match), then <b>Capture</b> a new bug and recall it.
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat icon={Database} label="sessions saved" value={stats.sessions} />
        <Stat icon={Target} label="open" value={stats.open} tone="text-amber-300" />
        <Stat icon={Brain} label="recalls" value={stats.recalls} />
        <Stat icon={History} label="matches" value={stats.matches} tone="text-accent-soft" />
        <Stat icon={Clock} label="est hours saved" value={`${stats.hoursSaved}h`} tone="text-ok" />
      </div>

      <nav className="mt-6 flex gap-1 rounded-xl border border-ink-700 bg-ink-900/70 p-1">
        {TABS.map(({ id, label, icon: Icon, hint }) => (
          <button
            key={id}
            data-testid={`tab-${id}`}
            onClick={() => go(id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition ${tab === id ? 'bg-ink-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >
            <Icon className="h-4 w-4" /> {label} <span className="hidden text-xs font-normal text-slate-500 md:inline">· {hint}</span>
          </button>
        ))}
      </nav>

      {loadErr && <p className="mt-4 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">Backend error: {loadErr}. Add <code>?demo=1</code> to the URL to use in-browser demo mode.</p>}

      <main className="mt-6">
        {tab === 'capture' && <Capture backend={backend} onSaved={reload} />}
        {tab === 'recall' && <Recall backend={backend} onChange={reload} showSamples={isDemo || sessions.some((s) => s.sample)} />}
        {tab === 'memory' && <Memory backend={backend} sessions={sessions} reload={reload} />}
      </main>

      <footer className="mt-16 text-center text-xs text-slate-600">
        Built hands-free with Wispr Flow for the WeMakeDevs “No Hands” hackathon · Capture → Recall · your data stays {isDemo ? 'in this browser' : 'in your Supabase'}
      </footer>
    </div>
  );
}
