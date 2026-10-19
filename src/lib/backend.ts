import type { CaptureResult, RecallResult, Session, StructuredNote } from './types';
import { redact } from './redact';
import { structureLocally } from './structure';
import { embed, sessionEmbeddingText } from './embed';
import { explainLocally, LOCAL_MATCH_THRESHOLD, rankSessions, recallLocal } from './match';
import { getEngine, MINILM_MATCH_THRESHOLD, neuralEmbed } from './neural';
import { SEED_INCIDENTS } from '../data/seed';

export interface Backend {
  kind: 'local' | 'supabase';
  list(): Promise<Session[]>;
  capture(transcript: string, opts?: { status?: 'open' | 'resolved' }): Promise<CaptureResult>;
  recall(query: string): Promise<RecallResult>;
  update(id: string, patch: Partial<StructuredNote> & { status?: Session['status'] }): Promise<Session>;
  remove(id: string): Promise<void>;
  reset?(): Promise<void>;
}

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

/* ───────────────────────── Local (Demo Mode) ───────────────────────── */

const LS_KEY = 'dejavu.sessions.v1';

export function buildSeedSessions(now = Date.now()): Session[] {
  return SEED_INCIDENTS.map((s) => {
    const base = {
      symptom: s.symptom,
      hypotheses_tried: s.hypotheses_tried,
      root_cause: s.root_cause,
      fix: s.fix,
      tags: s.tags,
    };
    return {
      id: uid(),
      ...base,
      raw_transcript_redacted: redact(s.transcript).text,
      status: 'resolved' as const,
      created_at: new Date(now - s.daysAgo * 86400000).toISOString(),
      sample: true,
      embedding: embed(sessionEmbeddingText(base)),
    };
  });
}

interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

const memoryKV = (): KV => {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
};

export function createLocalBackend(storage?: KV): Backend {
  const kv: KV = storage ?? (typeof localStorage !== 'undefined' ? localStorage : memoryKV());

  const load = (): Session[] => {
    const raw = kv.getItem(LS_KEY);
    if (raw) {
      try {
        return JSON.parse(raw) as Session[];
      } catch {
        /* fall through and reseed */
      }
    }
    const seeded = buildSeedSessions();
    kv.setItem(LS_KEY, JSON.stringify(seeded));
    return seeded;
  };
  const save = (s: Session[]) => kv.setItem(LS_KEY, JSON.stringify(s));

  return {
    kind: 'local',
    async list() {
      return load().sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
    async capture(transcript, opts) {
      const { text, findings } = redact(transcript); // redaction FIRST — nothing un-redacted is ever stored
      const note = structureLocally(text);
      const status = opts?.status ?? (note.fix ? 'resolved' : 'open');
      const session: Session = {
        id: uid(),
        ...note,
        raw_transcript_redacted: text,
        status,
        created_at: new Date().toISOString(),
        embedding: embed(sessionEmbeddingText(note)),
      };
      save([session, ...load()]);
      return { session, redactions: findings, structuredBy: 'local-heuristic' };
    },
    async recall(query) {
      const q = redact(query).text;
      if (typeof window !== 'undefined' && getEngine() === 'neural') {
        // Optional: in-browser MiniLM. Session vectors are computed on the fly and cached in memory.
        const qe = await neuralEmbed(q);
        const sessions = await Promise.all(load().map(async (s) => ({ ...s, embedding: await neuralEmbed(sessionEmbeddingText(s)) })));
        return { ...explainLocally(q, rankSessions(qe, sessions, MINILM_MATCH_THRESHOLD), MINILM_MATCH_THRESHOLD), engine: 'minilm-l6 (in-browser)' };
      }
      return { ...recallLocal(q, load(), LOCAL_MATCH_THRESHOLD), engine: 'lexical-hash' };
    },
    async update(id, patch) {
      const all = load();
      const i = all.findIndex((s) => s.id === id);
      if (i < 0) throw new Error('Session not found');
      const clean = { ...patch };
      for (const k of ['symptom', 'root_cause', 'fix'] as const) if (typeof clean[k] === 'string') clean[k] = redact(clean[k]!).text;
      const next: Session = { ...all[i], ...clean, updated_at: new Date().toISOString() };
      next.embedding = embed(sessionEmbeddingText(next));
      all[i] = next;
      save(all);
      return next;
    },
    async remove(id) {
      save(load().filter((s) => s.id !== id));
    },
    async reset() {
      kv.removeItem(LS_KEY);
      load();
    },
  };
}

/* ───────────────────────── Supabase ───────────────────────── */

export class HttpError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export function createSupabaseBackend(url: string, anonKey: string, timeoutMs = 25000): Backend {
  const base = url.replace(/\/$/, '');
  const headers = { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' };
  const signal = () => (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(timeoutMs) : undefined);
  const fn = async <T>(name: string, body: unknown): Promise<T> => {
    const r = await fetch(`${base}/functions/v1/${name}`, { method: 'POST', headers, body: JSON.stringify(body), signal: signal() });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new HttpError(j.error || `${name} failed (${r.status})`, r.status);
    return j as T;
  };
  const cols = 'id,raw_transcript_redacted,symptom,hypotheses_tried,root_cause,fix,tags,status,created_at,updated_at,sample';
  return {
    kind: 'supabase',
    async list() {
      const r = await fetch(`${base}/rest/v1/sessions?select=${cols}&order=created_at.desc`, { headers, signal: signal() });
      if (!r.ok) throw new HttpError(`list failed (${r.status})`, r.status);
      return (await r.json()) as Session[];
    },
    capture: (transcript, opts) => fn<CaptureResult>('capture', { transcript, status: opts?.status }),
    recall: (query) => fn<RecallResult>('recall', { query }),
    // Edits go through the capture function so the row is re-redacted and re-embedded server-side.
    update: async (id, patch) => (await fn<{ session: Session }>('capture', { id, patch })).session,
    async remove(id) {
      const r = await fetch(`${base}/rest/v1/sessions?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers, signal: signal() });
      if (!r.ok) throw new HttpError(`delete failed (${r.status})`, r.status);
    },
  };
}

/* ───────────── Auto: live Supabase when reachable, in-browser demo otherwise ───────────── */

export type Mode = 'connecting' | 'live' | 'demo' | 'fallback';
export interface AutoBackend extends Backend {
  readonly mode: Mode;
  ready: Promise<Mode>;
  /** Calls fn with the current mode right away, then on every change. */
  subscribe(fn: (m: Mode) => void): () => void;
}

/** Network failure, timeout or 5xx => the backend is "unreachable" and we fall back to demo mode. */
export const isUnreachable = (e: unknown) =>
  e instanceof TypeError || (e instanceof Error && (e.name === 'AbortError' || e.name === 'TimeoutError')) || (e instanceof HttpError && (e.status >= 500 || e.status === 0));

export function createAutoBackend(opts: { url?: string; anonKey?: string; forceDemo?: boolean; storage?: Parameters<typeof createLocalBackend>[0]; probeTimeoutMs?: number } = {}): AutoBackend {
  const local = createLocalBackend(opts.storage);
  const listeners = new Set<(m: Mode) => void>();
  let mode: Mode = opts.url && opts.anonKey && !opts.forceDemo ? 'connecting' : 'demo';
  const set = (m: Mode) => {
    if (m === mode) return;
    mode = m;
    listeners.forEach((f) => f(m));
  };
  const remote = mode === 'connecting' ? createSupabaseBackend(opts.url!, opts.anonKey!) : null;

  const ready: Promise<Mode> = remote
    ? (async () => {
        try {
          const base = opts.url!.replace(/\/$/, '');
          const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
          const t = setTimeout(() => ctl?.abort(), opts.probeTimeoutMs ?? 6000);
          const r = await fetch(`${base}/rest/v1/sessions?select=id&limit=1`, {
            headers: { apikey: opts.anonKey!, Authorization: `Bearer ${opts.anonKey}` },
            signal: ctl?.signal,
          });
          clearTimeout(t);
          set(r.ok ? 'live' : 'fallback');
        } catch {
          set('fallback');
        }
        return mode;
      })()
    : Promise.resolve(mode);

  const call = async <K extends 'list' | 'capture' | 'recall' | 'update' | 'remove'>(name: K, ...args: Parameters<Backend[K]>): Promise<Awaited<ReturnType<Backend[K]>>> => {
    await ready;
    if (mode === 'live' && remote) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return await (remote[name] as any)(...args);
      } catch (e) {
        if (!isUnreachable(e)) throw e;
        console.warn('[déjà vu] live backend unreachable, falling back to in-browser demo mode:', (e as Error).message);
        set('fallback');
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (local[name] as any)(...args);
  };

  return {
    get kind() {
      return mode === 'live' ? 'supabase' : 'local';
    },
    get mode() {
      return mode;
    },
    ready,
    subscribe(fn) {
      listeners.add(fn);
      fn(mode); // sync immediately: the probe may already have settled before the subscriber mounted
      return () => listeners.delete(fn);
    },
    list: () => call('list'),
    capture: (t, o) => call('capture', t, o),
    recall: (q) => call('recall', q),
    update: (id, p) => call('update', id, p),
    remove: (id) => call('remove', id),
    reset: () => local.reset!(),
  };
}

export function getBackend(): AutoBackend {
  const url = import.meta.env?.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY as string | undefined;
  const forceDemo = typeof location !== 'undefined' && /[?&]demo=1\b/.test(location.search);
  return createAutoBackend({ url, anonKey, forceDemo });
}

/** Recall UI: show the top match plus only matches within this similarity of it. */
export const CLOSE_MATCH_WINDOW = 0.05;
export function splitMatches<T extends { similarity: number }>(matches: T[], window = CLOSE_MATCH_WINDOW) {
  if (!matches.length) return { shown: [] as T[], hidden: [] as T[] };
  const top = matches[0].similarity;
  return { shown: matches.filter((m) => m.similarity >= top - window), hidden: matches.filter((m) => m.similarity < top - window) };
}
