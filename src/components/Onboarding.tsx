import { Brain, History, Mic, X } from 'lucide-react';
import type { ReactNode } from 'react';

type Tab = 'capture' | 'recall' | 'memory';

export const Kbd = ({ children }: { children: ReactNode }) => (
  <kbd className="mx-0.5 inline-grid min-w-[1.4rem] place-items-center rounded border border-ink-500 bg-ink-800 px-1 py-px font-mono text-[10px] text-slate-300 shadow-[0_1px_0_rgba(255,255,255,0.08)]">
    {children}
  </kbd>
);

export function Onboarding({ isDemo, onDone, go }: { isDemo: boolean; onDone: () => void; go: (t: Tab) => void }) {
  const steps = [
    { icon: Brain, t: 'Recall', d: 'Click a symptom chip — e.g. “502s after deploy”. You’ll get the past cause, the fix and what you ruled out.', tab: 'recall' as Tab },
    { icon: Mic, t: 'Capture', d: 'Hold your Wispr Flow key (or press Alt+M) and ramble about a bug. Secrets get redacted, then it’s structured.', tab: 'capture' as Tab },
    { icon: History, t: 'No match?', d: 'Try the 🚫 chip. Below the threshold it won’t guess — file it as open and resolve it later in Memory.', tab: 'memory' as Tab },
  ];
  return (
    <section data-testid="onboarding" className="relative mt-4 overflow-hidden rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-950/50 via-ink-900/80 to-emerald-950/20 p-5 animate-fadeUp">
      <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-violet-500/20 blur-3xl" />
      <button className="absolute right-3 top-3 rounded-md p-1 text-slate-500 hover:bg-ink-800 hover:text-white" onClick={onDone} aria-label="Dismiss welcome">
        <X className="h-4 w-4" />
      </button>
      <div className="relative">
        <h2 className="text-base font-semibold text-white">Welcome to Déjà Vu 👋</h2>
        <p className="mt-1 text-sm text-slate-400">
          {isDemo ? 'No sign-in, no keys — this demo runs entirely in your browser with 18 sample incidents. ' : 'No sign-in — you’re on the live Supabase + Groq backend, pre-seeded with 18 sample incidents. '}
          Three things to try (about a minute):
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {steps.map((s, i) => (
            <button key={s.t} onClick={() => go(s.tab)} className="group rounded-xl border border-ink-600/80 bg-ink-950/50 p-4 text-left transition hover:border-violet-400/40">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-violet-300/70">0{i + 1}</span>
                <s.icon className="h-4 w-4 text-violet-200" />
                <span className="font-medium text-white">{s.t}</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-400 group-hover:text-slate-300">{s.d}</p>
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
          <span><Kbd>Alt</Kbd>+<Kbd>M</Kbd> dictate</span>
          <span><Kbd>/</Kbd> focus input</span>
          <span><Kbd>1</Kbd><Kbd>2</Kbd><Kbd>3</Kbd> switch tabs</span>
          <span><Kbd>?</Kbd> all shortcuts</span>
          <button className="btn-primary ml-auto py-1.5 text-xs" onClick={onDone} data-testid="onboarding-done">Got it</button>
        </div>
      </div>
    </section>
  );
}

export function ShortcutHelp({ onClose }: { onClose: () => void }) {
  const rows: Array<[ReactNode, string]> = [
    [<><Kbd>Alt</Kbd>+<Kbd>M</Kbd></>, 'Start / stop browser dictation'],
    [<Kbd>fn</Kbd>, 'Wispr Flow: hold & talk into any focused box'],
    [<Kbd>/</Kbd>, 'Focus the input'],
    [<><Kbd>⌘</Kbd>/<Kbd>Ctrl</Kbd>+<Kbd>↵</Kbd></>, 'Save a capture'],
    [<Kbd>↵</Kbd>, 'Run recall'],
    [<><Kbd>1</Kbd><Kbd>2</Kbd><Kbd>3</Kbd></>, 'Capture · Recall · Memory'],
    [<Kbd>Esc</Kbd>, 'Close this'],
  ];
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal aria-label="Keyboard shortcuts">
      <div className="panel w-full max-w-sm p-5 animate-fadeUp" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-white">Keyboard shortcuts</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <ul className="space-y-2.5 text-sm">
          {rows.map(([k, d], i) => (
            <li key={i} className="flex items-center justify-between gap-4">
              <span className="text-slate-400">{d}</span>
              <span className="shrink-0">{k}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
