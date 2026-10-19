import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { ArrowRight, Brain, Check, Github, Lock, Mic, ShieldCheck, Sparkles, X } from './icons';
import { scrollState } from './scrollState';
import { RecallMock } from './RecallMock';
import { RedactionDemo } from './RedactionDemo';
import { structureLocally } from '../lib/structure';
import { recallLocal } from '../lib/match';
import { buildSeedSessions } from '../lib/backend';
import { Logo } from '../components/Logo';

gsap.registerPlugin(ScrollTrigger);
const Scene = lazy(() => import('./Scene'));

const REPO = 'https://github.com/aneek22112007-tech/deja-vu';
const APP = '#/app/recall';
const EXAMPLE = "ok, 502s after deploy — thought it was the LB, wasn't — stale env var, restarted worker, fixed.";

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

function useEnv() {
  return useMemo(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mobile = window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
    return { reduced, mobile, webgl: hasWebGL() };
  }, []);
}

/* ───────────── small building blocks ───────────── */
const Eyebrow = ({ children }: { children: ReactNode }) => (
  <div data-reveal className="mb-4 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-violet-300/80">
    <span className="h-px w-6 bg-gradient-to-r from-transparent to-violet-400/70" />
    {children}
  </div>
);
const H2 = ({ children }: { children: ReactNode }) => (
  <h2 data-reveal className="max-w-3xl text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.035em] text-white md:text-6xl">
    {children}
  </h2>
);
const Lead = ({ children }: { children: ReactNode }) => (
  <p data-reveal className="mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-slate-400">
    {children}
  </p>
);
const Section = ({ id, children, className = '' }: { id?: string; children: ReactNode; className?: string }) => (
  <section id={id} className={`relative mx-auto max-w-6xl px-6 py-28 md:py-40 ${className}`}>
    {children}
  </section>
);
const Key = ({ children, pressed }: { children: ReactNode; pressed?: boolean }) => (
  <kbd
    className={`inline-grid min-w-[2.6rem] place-items-center rounded-lg border px-2.5 py-1.5 font-mono text-xs transition ${
      pressed
        ? 'translate-y-[2px] border-violet-400/60 bg-violet-500/20 text-violet-100 shadow-[0_0_24px_rgba(167,139,250,0.45)]'
        : 'border-white/15 bg-white/[0.04] text-slate-300 shadow-[0_2px_0_rgba(255,255,255,0.08)]'
    }`}
  >
    {children}
  </kbd>
);

function Waveform({ active = true, bars = 36 }: { active?: boolean; bars?: number }) {
  return (
    <div className="flex h-14 items-center gap-[3px]" aria-hidden>
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-gradient-to-t from-violet-500 to-emerald-300"
          style={{
            height: active ? `${18 + Math.abs(Math.sin(i * 0.7)) * 80}%` : '12%',
            animation: active ? `wave 1.${(i % 9) + 1}s ease-in-out ${(i % 7) * 0.08}s infinite alternate` : undefined,
            opacity: 0.35 + Math.abs(Math.sin(i * 0.33)) * 0.65,
          }}
        />
      ))}
    </div>
  );
}

/* ───────────── How-it-works visuals (real outputs, computed in-browser) ───────────── */
function StepVisual({ step }: { step: number }) {
  const structured = useMemo(() => structureLocally(EXAMPLE), []);
  const recall = useMemo(() => recallLocal('getting 502 bad gateway right after we deployed', buildSeedSessions(Date.parse('2026-10-19T00:00:00Z'))), []);
  const card = 'rounded-2xl border border-white/10 bg-[#0b0d12]/85 p-6 backdrop-blur-xl shadow-2xl shadow-black/40';
  if (step === 0)
    return (
      <div className={card}>
        <div className="mb-5 flex items-center gap-3 text-sm text-slate-400">
          <Key pressed>fn</Key> <span>hold Wispr Flow &amp; talk, mid-debug</span>
        </div>
        <Waveform />
        <p className="mt-5 break-words font-mono text-sm leading-relaxed text-slate-300">“{EXAMPLE}”</p>
      </div>
    );
  if (step === 1)
    return (
      <div className={card}>
        <div className="mb-3 flex items-center gap-2 font-mono text-[11px] text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> redacted → structured → embedded (384-d)
        </div>
        <pre className="overflow-x-auto font-mono text-[12.5px] leading-relaxed">
          <span className="text-slate-500">{'{'}</span>
          {'\n'}  <span className="text-violet-300">"symptom"</span>: <span className="text-slate-100">"{structured.symptom}"</span>,
          {'\n'}  <span className="text-violet-300">"hypotheses_tried"</span>: [{'{'} <span className="text-slate-100">"text"</span>: <span className="text-red-300 line-through decoration-red-400/50">"{structured.hypotheses_tried[0]?.text}"</span>, <span className="text-slate-100">"ruled_out"</span>: <span className="text-amber-300">true</span> {'}'}],
          {'\n'}  <span className="text-violet-300">"root_cause"</span>: <span className="text-slate-100">"{structured.root_cause}"</span>,
          {'\n'}  <span className="text-violet-300">"fix"</span>: <span className="text-emerald-300">"{structured.fix}"</span>,
          {'\n'}  <span className="text-violet-300">"tags"</span>: [{structured.tags.slice(0, 4).map((t) => `"${t}"`).join(', ')}]
          {'\n'}<span className="text-slate-500">{'}'}</span>
        </pre>
      </div>
    );
  if (step === 2)
    return (
      <div className={card}>
        <p className="text-[15px] leading-relaxed text-slate-200">
          🔁 <b className="text-white">You've hit this twice.</b> Most likely cause: <span className="text-violet-200">stale env var after deploy</span>. Fix that worked:{' '}
          <span className="text-emerald-300">restart the workers</span>. Last time you ruled out the load balancer — skip it.
        </p>
        <div className="mt-5 space-y-2">
          {recall.matches.slice(0, 3).map((m) => (
            <div key={m.session.id} className="flex items-center gap-3">
              <span className="flex-1 truncate text-sm text-slate-400">{m.session.symptom}</span>
              <div className="h-1.5 w-28 overflow-hidden rounded-full bg-white/5">
                <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-400" style={{ width: `${Math.round(m.similarity * 100)}%` }} />
              </div>
              <span className="w-9 text-right font-mono text-xs text-slate-500">{Math.round(m.similarity * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
    );
  return (
    <div className={`${card} border-amber-500/20 text-center`}>
      <div className="text-3xl">🫥</div>
      <p className="mt-3 text-lg font-medium text-amber-200">No match — filing this for future you.</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">Below the hard similarity threshold it refuses to guess. One click files it as an <b className="text-slate-300">open</b> session; resolve it later and next time it matches.</p>
    </div>
  );
}

const STEPS = [
  { k: '01', title: 'Capture', icon: Mic, body: 'Hold the Wispr key mid-debug and mutter what you see, what you tried, what worked. Messy is fine — that is the point.' },
  { k: '02', title: 'Redact + structure', icon: ShieldCheck, body: 'Secrets are stripped first. Then Groq (gpt-oss-120b, JSON mode) turns rambling into symptom → hypotheses → root cause → fix, and it is embedded into pgvector.' },
  { k: '03', title: 'Recall', icon: Brain, body: 'Months later, describe the symptom. Vector similarity finds your past sessions; an LLM layer tells you how often you hit it, the likely cause, the fix that worked and the dead ends to skip.' },
  { k: '04', title: 'Graceful no-match', icon: Sparkles, body: 'Below a hard threshold it stays quiet instead of hallucinating — and files the new symptom for future you.' },
];

function HowItWorks({ mobile }: { mobile: boolean }) {
  const [step, setStep] = useState(0);
  const refs = useRef<Array<HTMLDivElement | null>>([]);
  useEffect(() => {
    if (mobile) return;
    const triggers = refs.current.map((el, i) =>
      ScrollTrigger.create({ trigger: el, start: 'top 55%', end: 'bottom 55%', onToggle: (s) => s.isActive && setStep(i) }),
    );
    return () => triggers.forEach((t) => t.kill());
  }, [mobile]);
  return (
    <Section id="how">
      <Eyebrow>How it works</Eyebrow>
      <H2>One loop. Capture → Recall.</H2>
      <Lead>No IDE plugin, no auto-fix agent, no Slack bot. Just the part every other tool forgets: the reasoning trail of your own debugging.</Lead>
      <div className="mt-16 grid gap-10 md:grid-cols-2 md:gap-16 [&>*]:min-w-0">
        <div className="space-y-6 md:space-y-[38vh] md:pb-[20vh]">
          {STEPS.map((s, i) => (
            <div key={s.k} ref={(el) => (refs.current[i] = el)} className={`transition-opacity duration-500 ${mobile || step === i ? 'opacity-100' : 'opacity-35'}`}>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-violet-300/70">{s.k}</span>
                <span className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.03]">
                  <s.icon className="h-4 w-4 text-violet-200" />
                </span>
                <h3 className="text-2xl font-semibold tracking-tight text-white">{s.title}</h3>
              </div>
              <p className="mt-3 max-w-md leading-relaxed text-slate-400">{s.body}</p>
              {mobile && (
                <div className="mt-5">
                  <StepVisual step={i} />
                </div>
              )}
            </div>
          ))}
        </div>
        {!mobile && (
          <div className="relative">
            <div className="sticky top-[22vh]">
              <div key={step} className="animate-fadeUp">
                <StepVisual step={step} />
              </div>
              <div className="mt-5 flex gap-1.5">
                {STEPS.map((_, i) => (
                  <span key={i} className={`h-1 rounded-full transition-all duration-500 ${i === step ? 'w-10 bg-violet-400' : 'w-4 bg-white/10'}`} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}

/* ───────────── comparison ───────────── */
const ROWS: Array<[string, boolean[]]> = [
  ['Stores code snippets / chats', [true, true, true, false]],
  ['Stores the spoken reasoning of a debug session', [false, false, false, true]],
  ['Remembers the dead ends (ruled-out hypotheses)', [false, false, false, true]],
  ['Matches a new symptom against past fixes', [false, false, false, true]],
  ['Refuses to guess below a similarity threshold', [false, false, false, true]],
  ['Voice-first capture, mid-debug', [false, false, false, true]],
];
const COLS = ['Pieces', 'Copilot', 'mem.ai', 'Déjà Vu'];

/* ───────────── page ───────────── */
export default function Landing() {
  const env = useEnv();
  const [show3D, setShow3D] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const lenisRef = useRef<Lenis | null>(null);

  // Defer the 3D bundle until the page is idle so text paints first (LCP).
  useEffect(() => {
    if (!env.webgl) return;
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    const id = w.requestIdleCallback ? w.requestIdleCallback(() => setShow3D(true), { timeout: 1200 }) : window.setTimeout(() => setShow3D(true), 300);
    return () => clearTimeout(id);
  }, [env.webgl]);

  // Lenis smooth scroll + GSAP ScrollTrigger + scroll/pointer → 3D camera
  useEffect(() => {
    document.title = 'Déjà Vu — you’ve fixed this before. Voice-first memory for debugging.';
    const onScrollProgress = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      scrollState.progress = max > 0 ? scrollY / max : 0;
      setScrolled(scrollY > 24);
      const dim = document.querySelector<HTMLElement>('[data-dim]');
      if (dim) dim.style.opacity = String(Math.min(0.58, Math.max(0, (scrollY / innerHeight - 0.3) * 0.8)));
    };
    let lenis: Lenis | null = null;
    const tick = (time: number) => lenis?.raf(time * 1000);
    if (!env.reduced) {
      lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
      lenisRef.current = lenis;
      lenis.on('scroll', () => {
        ScrollTrigger.update();
        onScrollProgress();
      });
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
    }
    addEventListener('scroll', onScrollProgress, { passive: true });
    const onPointer = (e: PointerEvent) => {
      scrollState.pointerX = (e.clientX / innerWidth) * 2 - 1;
      scrollState.pointerY = -((e.clientY / innerHeight) * 2 - 1);
    };
    addEventListener('pointermove', onPointer, { passive: true });

    const ctx = gsap.context(() => {
      if (env.reduced) return;
      gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
        gsap.fromTo(el, { autoAlpha: 0, y: 28, filter: 'blur(6px)' }, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%' } });
      });
      gsap.from('[data-hero] > *', { autoAlpha: 0, y: 24, duration: 1, ease: 'power3.out', stagger: 0.09, delay: 0.1 });
      gsap.utils.toArray<HTMLElement>('[data-count]').forEach((el) => {
        const end = Number(el.dataset.count);
        const o = { v: 0 };
        gsap.to(o, { v: end, duration: 1.6, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 85%' }, onUpdate: () => (el.textContent = String(Math.round(o.v))) });
      });
      // hero fades + scales away as the camera dives in
      gsap.to('[data-hero]', { autoAlpha: 0, y: -60, scale: 0.97, ease: 'none', scrollTrigger: { trigger: '[data-hero-wrap]', start: 'top top', end: 'bottom 30%', scrub: true } });
    }, root);

    return () => {
      ctx.revert();
      if (lenis) {
        gsap.ticker.remove(tick);
        lenis.destroy();
      }
      lenisRef.current = null;
      removeEventListener('scroll', onScrollProgress);
      removeEventListener('pointermove', onPointer);
      scrollState.progress = 0;
    };
  }, [env.reduced]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (lenisRef.current) lenisRef.current.scrollTo(el, { offset: -40 });
    else el.scrollIntoView({ behavior: env.reduced ? 'auto' : 'smooth' });
  };

  return (
    <div ref={root} className="relative min-h-screen overflow-x-clip bg-[#06070a] text-slate-200 selection:bg-violet-500/30">
      {/* fixed 3D backdrop */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_700px_at_50%_-10%,rgba(124,58,237,0.22),transparent_60%),radial-gradient(900px_600px_at_90%_30%,rgba(52,211,153,0.08),transparent_60%)]" />
        {show3D ? (
          <Suspense fallback={null}>
            <Scene mobile={env.mobile} reducedMotion={env.reduced} />
          </Suspense>
        ) : (
          <StaticConstellation />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0%,transparent_55%,rgba(6,7,10,0.65)_100%)]" />
        <div className="absolute inset-0 hidden bg-[linear-gradient(to_right,rgba(6,7,10,0.75)_0%,rgba(6,7,10,0.35)_40%,transparent_65%)] md:block" />
        <div className="absolute inset-0 bg-[#06070a]/45 md:hidden" />
        {/* dims the scene once you leave the hero so long-form copy stays readable */}
        <div data-dim className="absolute inset-0 bg-[#06070a] opacity-0" />
        <div className="noise absolute inset-0 opacity-[0.035]" />
      </div>

      {/* nav */}
      <header className={`fixed inset-x-0 top-0 z-30 transition-all duration-300 ${scrolled ? 'border-b border-white/[0.06] bg-[#06070a]/70 backdrop-blur-xl' : ''}`}>
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
          <a href="#/" className="flex items-center gap-2.5" aria-label="Déjà Vu home">
            <Logo className="h-7 w-7" />
            <span className="font-semibold tracking-tight text-white">Déjà Vu</span>
          </a>
          <nav className="hidden items-center gap-6 text-sm text-slate-400 md:flex">
            {[
              ['how', 'How it works'],
              ['live', 'Live recall'],
              ['why', 'Why different'],
              ['privacy', 'Privacy'],
              ['voice', 'Built by voice'],
            ].map(([id, label]) => (
              <button key={id} onClick={() => scrollTo(id)} className="transition hover:text-white">
                {label}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <a href={REPO} target="_blank" rel="noreferrer" className="hidden text-slate-400 transition hover:text-white sm:block" aria-label="GitHub repository">
              <Github className="h-5 w-5" />
            </a>
            <a href={APP} className="group inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-violet-100">
              Open the app <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </a>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* HERO */}
        <div data-hero-wrap className="relative flex min-h-[100svh] items-center">
          <div data-hero className="mx-auto w-full max-w-6xl px-6 pb-24 pt-32">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-400 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" /> WeMakeDevs × Wispr Flow · “No Hands” hackathon
            </div>
            <h1 className="mt-7 max-w-4xl text-balance text-[3.1rem] font-semibold leading-[0.98] tracking-[-0.045em] text-white sm:text-7xl md:text-[5.6rem]">
              You've fixed this before.
              <br />
              <span className="animate-shimmer bg-[linear-gradient(90deg,#c4b5fd,#34d399,#a78bfa,#c4b5fd)] bg-[length:200%_auto] bg-clip-text text-transparent">Déjà Vu remembers how.</span>
            </h1>
            <p className="mt-7 max-w-xl text-pretty text-lg leading-relaxed text-slate-400 md:text-xl">
              A voice-first memory for debugging. Speak what you're seeing while you debug — Déjà Vu remembers every session and stops you re-solving problems you already solved.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <a href={APP} data-testid="cta-demo" className="group relative inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-violet-600 px-6 py-3.5 font-medium text-white shadow-[0_0_40px_rgba(139,92,246,0.45)] transition hover:shadow-[0_0_60px_rgba(139,92,246,0.65)]">
                Try the live demo <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </a>
              <a href={REPO} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.03] px-6 py-3.5 font-medium text-slate-200 backdrop-blur transition hover:border-white/25 hover:bg-white/[0.06]">
                <Github className="h-4 w-4" /> Star on GitHub
              </a>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] text-slate-500">
              <span>✓ no sign-in</span>
              <span>✓ live Supabase + Groq backend</span>
              <span>✓ auto-falls back to an in-browser demo</span>
            </div>
          </div>
          <button onClick={() => scrollTo('problem')} className="absolute bottom-8 left-1/2 -translate-x-1/2 font-mono text-[10px] uppercase tracking-[0.3em] text-slate-600 transition hover:text-slate-300">
            scroll
            <span className="mx-auto mt-2 block h-8 w-px animate-pulse bg-gradient-to-b from-slate-500 to-transparent" />
          </button>
        </div>

        {/* PROBLEM */}
        <Section id="problem">
          <Eyebrow>The problem</Eyebrow>
          <blockquote data-reveal className="max-w-4xl text-balance text-4xl font-medium leading-[1.1] tracking-[-0.03em] text-white md:text-6xl">
            “I feel like we've <span className="italic text-violet-200">fixed this before</span>.”
          </blockquote>
          <Lead>
            How a bug was <i>actually</i> solved lives in dead Slack threads, closed tickets and fading memory. Meeting tools capture meetings. AI assistants write new code. Nothing remembers the reasoning trail of your own debugging — so three months later, you start from zero.
          </Lead>
          <div className="mt-14 grid gap-4 sm:grid-cols-3">
            {[
              { n: 4, s: '+ hrs', l: 'lost every week re-debugging solved issues' },
              { n: 3, s: ' months', l: 'later the same symptom is back — and you start from zero' },
              { n: 0, s: ' tools', l: 'that remember what you tried, what failed and what worked' },
            ].map((x) => (
              <div key={x.l} data-reveal className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 backdrop-blur-md">
                <div className="text-5xl font-semibold tracking-tight text-white">
                  <span data-count={x.n}>{x.n}</span>
                  <span className="text-2xl text-slate-500">{x.s}</span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">{x.l}</p>
              </div>
            ))}
          </div>
        </Section>

        <HowItWorks mobile={env.mobile} />

        {/* LIVE */}
        <Section id="live">
          <div className="grid items-center gap-12 md:grid-cols-[1fr_1.15fr] [&>*]:min-w-0">
            <div>
              <Eyebrow>Live, not a video</Eyebrow>
              <H2>Watch it recall.</H2>
              <Lead>This panel runs the real recall engine on the sample memory, right here in your browser. Three past bugs come back with their fix — the fourth is new, so it says so.</Lead>
              <a data-reveal href={APP} className="group mt-8 inline-flex items-center gap-2 text-violet-200 transition hover:text-white">
                Try your own symptom <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </a>
            </div>
            <div data-reveal>
              <RecallMock reduced={env.reduced} />
            </div>
          </div>
        </Section>

        {/* WHY DIFFERENT */}
        <Section id="why">
          <Eyebrow>Why it's different</Eyebrow>
          <H2>Other tools remember code. Déjà Vu remembers reasoning.</H2>
          <Lead>Pieces, Copilot and mem.ai store snippets and chat threads. Nobody stores the spoken reasoning of debugging itself — including the dead ends — and matches new symptoms against it.</Lead>
          <div data-reveal className="mt-12 overflow-x-auto rounded-2xl border border-white/[0.07] bg-[#0b0d12]/70 backdrop-blur-xl">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="px-5 py-4 font-normal text-slate-500" />
                  {COLS.map((c, i) => (
                    <th key={c} className={`px-5 py-4 text-center font-medium ${i === 3 ? 'text-violet-200' : 'text-slate-400'}`}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map(([label, v]) => (
                  <tr key={label} className="border-b border-white/[0.04] last:border-0">
                    <td className="px-5 py-3.5 text-slate-300">{label}</td>
                    {v.map((ok, i) => (
                      <td key={i} className={`px-5 py-3.5 text-center ${i === 3 ? 'bg-violet-500/[0.06]' : ''}`}>
                        {ok ? <Check className={`mx-auto h-4 w-4 ${i === 3 ? 'text-emerald-300' : 'text-slate-400'}`} /> : <X className="mx-auto h-4 w-4 text-slate-700" />}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 font-mono text-[11px] text-slate-600">Positioning based on each product's public description; Déjà Vu is deliberately outside meeting summarizers, CRM follow-ups and email triage.</p>
        </Section>

        {/* PRIVACY */}
        <Section id="privacy">
          <Eyebrow>Privacy by default</Eyebrow>
          <H2>You'll say secrets out loud. They never get stored.</H2>
          <Lead>
            A redaction pass runs <b className="text-slate-200">before</b> anything is structured, embedded or saved: API keys, GitHub/Slack/AWS tokens, JWTs, bearer tokens, passwords, connection-string credentials, emails and IPs. The LLM output is redacted a second time. This is the real function, running live:
          </Lead>
          <div data-reveal className="mt-12">
            <RedactionDemo reduced={env.reduced} />
          </div>
        </Section>

        {/* STACK */}
        <Section id="stack">
          <Eyebrow>Stack</Eyebrow>
          <H2>Zero AWS. Zero cost. Real vectors.</H2>
          <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Wispr Flow', 'voice input — hold-key dictation into any textbox'],
              ['Supabase pgvector', 'Postgres + HNSW index + match_sessions RPC'],
              ['Groq · gpt-oss-120b', 'JSON-mode structuring + match explanation'],
              ['gte-small embeddings', 'built into Supabase Edge Functions — no OpenAI key'],
              ['Edge Functions (Deno)', 'capture: redact → structure → embed → insert'],
              ['React + Vite + Tailwind', 'static site, deploys anywhere'],
              ['transformers.js', 'in-browser MiniLM for the keyless demo'],
              ['three.js + R3F', 'this memory constellation you are scrolling through'],
            ].map(([t, d]) => (
              <div key={t} data-reveal className="group rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 backdrop-blur-md transition hover:border-violet-400/30 hover:bg-violet-500/[0.04]">
                <div className="font-medium text-white">{t}</div>
                <div className="mt-1.5 text-sm leading-relaxed text-slate-500 group-hover:text-slate-400">{d}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* VOICE */}
        <Section id="voice">
          <div data-reveal className="relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-gradient-to-br from-violet-950/50 via-[#0b0d12]/80 to-emerald-950/30 p-8 backdrop-blur-xl md:p-14">
            <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-violet-500/20 blur-3xl" />
            <Eyebrow>No hands</Eyebrow>
            <h2 className="max-w-3xl text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.035em] text-white md:text-5xl">Built entirely by voice with Wispr Flow.</h2>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-400">
              Requirements, every prompt, edge cases, the note schema, the seed bugs, docs, commit notes and the demo script were dictated. And the product's own input is a voice: hold the key, talk, done.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Key pressed>fn</Key>
                <span className="text-slate-500">+</span>
                <span className="text-sm text-slate-400">talk</span>
              </div>
              <Waveform bars={28} />
            </div>
          </div>
        </Section>

        {/* CTA */}
        <Section className="text-center">
          <h2 data-reveal className="mx-auto max-w-3xl text-balance text-5xl font-semibold leading-[1.02] tracking-[-0.04em] text-white md:text-7xl">
            Stop re-solving <span className="text-violet-200">solved</span> bugs.
          </h2>
          <p data-reveal className="mx-auto mt-6 max-w-lg text-lg text-slate-400">Open the demo, click a symptom, and watch it remember. No sign-in, nothing to install.</p>
          <div data-reveal className="mt-10 flex flex-wrap justify-center gap-3">
            <a href={APP} className="group inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 font-medium text-black transition hover:bg-violet-100">
              Try the live demo <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </a>
            <a href={REPO} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-white/12 px-7 py-3.5 font-medium text-slate-200 transition hover:border-white/25">
              <Github className="h-4 w-4" /> Source on GitHub
            </a>
          </div>
        </Section>

        <footer className="relative border-t border-white/[0.06] bg-[#06070a]/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-8 text-sm text-slate-500">
            <Logo className="h-5 w-5" />
            <span>Déjà Vu · voice-first memory for debugging</span>
            <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> demo data stays in your browser</span>
            <span className="ml-auto">
              Built by <a className="text-slate-300 hover:text-white" href="https://github.com/aneek22112007-tech">Aneek Das</a> with Wispr Flow · MIT
            </span>
          </div>
        </footer>
      </main>
    </div>
  );
}

/** Lightweight SVG stand-in shown before the 3D chunk loads, or when WebGL is unavailable. */
function StaticConstellation() {
  const pts = useMemo(() => {
    const out: Array<[number, number, number]> = [];
    for (let i = 0; i < 22; i++) {
      const a = i * 2.39996;
      const r = 18 + (i % 5) * 5;
      out.push([50 + Math.cos(a) * r * 1.3, 46 + Math.sin(a) * r * 0.55, i % 3 === 0 ? 1 : 0]);
    }
    return out;
  }, []);
  return (
    <svg className="absolute inset-0 h-full w-full opacity-70" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden>
      {pts.map(([x, y], i) => {
        const [x2, y2] = pts[(i + 3) % pts.length];
        return <line key={`l${i}`} x1={x} y1={y} x2={x2} y2={y2} stroke="#a78bfa" strokeOpacity="0.12" strokeWidth="0.08" />;
      })}
      {pts.map(([x, y, g], i) => (
        <circle key={i} cx={x} cy={y} r={g ? 0.55 : 0.35} fill={g ? '#34d399' : '#a78bfa'} opacity={0.8} />
      ))}
    </svg>
  );
}
