import { Mic, MicOff } from 'lucide-react';
import type { Confidence, Hypothesis, Session } from '../lib/types';

export function MicButton({ listening, onClick, size = 'lg', disabled }: { listening: boolean; onClick: () => void; size?: 'lg' | 'sm'; disabled?: boolean }) {
  const dim = size === 'lg' ? 'h-20 w-20' : 'h-11 w-11';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={listening ? 'Stop dictation' : 'Start dictation'}
      title={listening ? 'Stop dictation' : 'Dictate (browser mic). With Wispr Flow just hold your key and talk into the box.'}
      className={`relative ${dim} shrink-0 rounded-full grid place-items-center transition ${
        listening ? 'bg-red-500 text-white shadow-lg shadow-red-900/50' : 'bg-gradient-to-br from-violet-500 to-violet-700 text-white shadow-lg shadow-violet-900/40 hover:scale-105'
      } disabled:opacity-40`}
    >
      {listening && <span className="absolute inset-0 rounded-full bg-red-500/60 animate-pulseRing" />}
      {listening ? <MicOff className={size === 'lg' ? 'h-8 w-8' : 'h-5 w-5'} /> : <Mic className={size === 'lg' ? 'h-8 w-8' : 'h-5 w-5'} />}
    </button>
  );
}

export function SimilarityBar({ value, threshold }: { value: number; threshold: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  const color = value >= threshold + (1 - threshold) * 0.3 ? 'bg-ok' : value >= threshold ? 'bg-warn' : 'bg-bad';
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-1.5 w-28 overflow-hidden rounded-full bg-ink-700">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
        <div className="absolute top-0 h-full w-px bg-white/50" style={{ left: `${threshold * 100}%` }} title="threshold" />
      </div>
      <span className="font-mono text-xs text-slate-400">{pct}%</span>
    </div>
  );
}

const confStyles: Record<Confidence, string> = {
  high: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  medium: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  low: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  none: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
};
export const ConfidenceBadge = ({ c }: { c: Confidence }) => (
  <span className={`rounded-full border px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide ${confStyles[c]}`}>{c === 'none' ? 'no match' : `${c} confidence`}</span>
);

export const StatusBadge = ({ s }: { s: Session['status'] }) =>
  s === 'resolved' ? (
    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] text-emerald-300">resolved</span>
  ) : (
    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-[11px] text-amber-300">open</span>
  );

export function Hypotheses({ items }: { items: Hypothesis[] }) {
  if (!items.length) return <span className="text-slate-600">—</span>;
  return (
    <ul className="space-y-1">
      {items.map((h, i) => (
        <li key={i} className="flex items-start gap-2 text-sm">
          <span className={`mt-0.5 font-mono text-xs ${h.ruled_out === true ? 'text-red-400' : h.ruled_out === false ? 'text-emerald-400' : 'text-slate-500'}`}>
            {h.ruled_out === true ? '✗' : h.ruled_out === false ? '✓' : '?'}
          </span>
          <span className={h.ruled_out === true ? 'text-slate-400 line-through decoration-red-500/40' : 'text-slate-300'}>{h.text}</span>
        </li>
      ))}
    </ul>
  );
}

export function SessionFields({ s }: { s: Session }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-[140px_1fr]">
      <dt className="label pt-0.5">symptom</dt>
      <dd className="text-slate-100">{s.symptom}</dd>
      <dt className="label pt-0.5">hypotheses tried</dt>
      <dd><Hypotheses items={s.hypotheses_tried} /></dd>
      <dt className="label pt-0.5">root cause</dt>
      <dd className="text-slate-200">{s.root_cause || <span className="text-slate-600">unknown yet</span>}</dd>
      <dt className="label pt-0.5">fix</dt>
      <dd className="text-emerald-200">{s.fix || <span className="text-slate-600">not fixed yet</span>}</dd>
      <dt className="label pt-0.5">tags</dt>
      <dd className="flex flex-wrap gap-1">{s.tags.length ? s.tags.map((t) => <span key={t} className="tag">#{t}</span>) : <span className="text-slate-600">—</span>}</dd>
    </dl>
  );
}

export const timeAgo = (iso: string) => {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return 'just now';
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  if (d < 86400 * 30) return `${Math.floor(d / 86400)}d ago`;
  if (d < 86400 * 365) return `${Math.floor(d / (86400 * 30))}mo ago`;
  return `${Math.floor(d / (86400 * 365))}y ago`;
};
