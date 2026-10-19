import { useEffect, useMemo, useRef, useState } from 'react';
import { buildSeedSessions } from '../lib/backend';
import { recallLocal } from '../lib/match';
import type { RecallResult } from '../lib/types';

/** A *real* recall running on the sample memory with the in-browser engine — not a video. */
const QUERIES = [
  'getting 502 bad gateway right after we deployed',
  'users keep getting logged out on safari',
  'websocket disconnects every minute',
  'bluetooth printer prints mirrored receipts',
];

export function RecallMock({ reduced }: { reduced: boolean }) {
  const sessions = useMemo(() => buildSeedSessions(Date.parse('2026-10-19T00:00:00Z')), []);
  const [qi, setQi] = useState(0);
  const [typed, setTyped] = useState('');
  const [res, setRes] = useState<RecallResult | null>(null);
  const [visible, setVisible] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.25 });
    if (box.current) io.observe(box.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const q = QUERIES[qi];
    if (reduced) {
      setTyped(q);
      setRes(recallLocal(q, sessions));
      return;
    }
    if (!visible) return;
    let i = 0;
    setRes(null);
    setTyped('');
    const timers: number[] = [];
    const type = window.setInterval(() => {
      i++;
      setTyped(q.slice(0, i));
      if (i >= q.length) {
        window.clearInterval(type);
        timers.push(window.setTimeout(() => setRes(recallLocal(q, sessions)), 350));
        timers.push(window.setTimeout(() => setQi((x) => (x + 1) % QUERIES.length), 5200));
      }
    }, 34);
    return () => {
      window.clearInterval(type);
      timers.forEach(clearTimeout);
    };
  }, [qi, visible, reduced, sessions]);

  const top = res?.matches.slice(0, 3) ?? [];
  return (
    <div ref={box} className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0b0d12]/90 shadow-2xl shadow-violet-950/40 backdrop-blur-xl">
      <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-3 font-mono text-[11px] text-slate-500">déjà-vu · recall · live in your browser</span>
        <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] text-emerald-400/80"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />real engine</span>
      </div>
      <div className="p-5">
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/40 px-4 py-3 font-mono text-sm text-slate-200">
          <span className="text-violet-400">❯</span>
          <span className="min-h-[1.25rem] flex-1">{typed}<span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-violet-400" /></span>
          <span className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-500">⏎</span>
        </div>

        <div className="mt-4 min-h-[232px]">
          {res && res.matched && (
            <div className="space-y-3 animate-fadeUp">
              <p className="text-[15px] leading-relaxed text-slate-200">
                <span className="mr-1">🔁</span>
                <b className="text-white">You've hit this {res.hitCount === 1 ? 'once' : res.hitCount === 2 ? 'twice' : `${res.hitCount}×`}.</b>{' '}
                Most likely cause: <span className="text-violet-200">{res.likelyCause}</span>. Fix that worked:{' '}
                <span className="text-emerald-300">{res.fixThatWorked}</span>.
              </p>
              {top.map((m, i) => (
                <div key={m.session.id} className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
                  <span className="font-mono text-[10px] text-slate-600">#{i + 1}</span>
                  <span className="flex-1 truncate text-sm text-slate-300">{m.session.symptom}</span>
                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-400 transition-[width] duration-1000 ease-out"
                      style={{ width: `${Math.round(m.similarity * 100)}%` }}
                    />
                  </div>
                  <span className="w-9 text-right font-mono text-xs text-slate-400">{Math.round(m.similarity * 100)}%</span>
                </div>
              ))}
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-600">
                {res.confidence} confidence · threshold {Math.round(res.threshold * 100)}%
              </div>
            </div>
          )}
          {res && !res.matched && (
            <div className="grid h-[232px] place-items-center rounded-xl border border-dashed border-amber-500/25 bg-amber-500/[0.03] text-center animate-fadeUp">
              <div>
                <div className="text-2xl">🫥</div>
                <p className="mt-2 font-medium text-amber-200">No match — filing this for future you.</p>
                <p className="mt-1 text-xs text-slate-500">Nothing above the {Math.round(res.threshold * 100)}% threshold. It refuses to guess.</p>
                <span className="mt-3 inline-block rounded-full border border-amber-500/30 px-3 py-1 font-mono text-[10px] text-amber-300">saved as open session</span>
              </div>
            </div>
          )}
          {!res && (
            <div className="grid h-[232px] place-items-center font-mono text-xs text-slate-600">searching every past session by meaning…</div>
          )}
        </div>
      </div>
    </div>
  );
}
