import { useEffect, useMemo, useRef, useState } from 'react';
import { redact } from '../lib/redact';

// Fake secrets, assembled at runtime so repo secret-scanners don't flag this demo string.
const FAKE_TOKEN = ['gh', 'p_', '8fK2mQ9xLp3RtYv7Wn5Zc1Hb4Jd6Gs0Ae2Uk'].join('');
const SAID = `502s again after deploy — DATABASE_URL was postgres://admin:hunter2@db.prod:5432/app, worker on 10.0.3.14 still had the old one. Pinged ops@acme.io, rotated token ${FAKE_TOKEN}. Restarted workers, fixed.`;

export function RedactionDemo({ reduced }: { reduced: boolean }) {
  const { text, findings } = useMemo(() => redact(SAID), []);
  const [on, setOn] = useState(reduced);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (reduced) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setTimeout(() => setOn(true), 500), { threshold: 0.5 });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, [reduced]);

  const parts = text.split(/(\[REDACTED[A-Z_]*\])/g);
  return (
    <div ref={ref} className="grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
        <div className="mb-3 font-mono text-[11px] uppercase tracking-wider text-slate-500">🎙 you said</div>
        <p className="font-mono text-[13px] leading-relaxed text-slate-300">{SAID}</p>
      </div>
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-5">
        {!reduced && <div className={`pointer-events-none absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-emerald-400/15 to-transparent ${on ? 'animate-scan' : 'opacity-0'}`} />}
        <div className="mb-3 font-mono text-[11px] uppercase tracking-wider text-emerald-500/80">🛡 what gets stored</div>
        <p className="font-mono text-[13px] leading-relaxed text-slate-300">
          {parts.map((p, i) =>
            p.startsWith('[REDACTED') ? (
              <span key={i} className={`rounded px-1 transition-all duration-700 ${on ? 'bg-emerald-400/15 text-emerald-300' : 'bg-transparent text-slate-300'}`}>
                {on ? p : '•'.repeat(8)}
              </span>
            ) : (
              <span key={i}>{p}</span>
            ),
          )}
        </p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {findings.map((f) => (
            <span key={f.type} className="rounded-full border border-emerald-500/20 px-2 py-0.5 font-mono text-[10px] text-emerald-300/80">
              {f.type.replace(/_/g, ' ')} ×{f.count}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
