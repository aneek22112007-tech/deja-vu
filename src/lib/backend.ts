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

export function createSupabaseBackend(url: string, anonKey: string): Backend {
  const base = url.replace(/\/$/, '');
  const headers = { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' };
  const fn = async <T>(name: string, body: unknown): Promise<T> => {
    const r = await fetch(`${base}/functions/v1/${name}`, { method: 'POST', headers, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `${name} failed (${r.status})`);
    return j as T;
  };
  const cols = 'id,raw_transcript_redacted,symptom,hypotheses_tried,root_cause,fix,tags,status,created_at,updated_at,sample';
  return {
    kind: 'supabase',
    async list() {
      const r = await fetch(`${base}/rest/v1/sessions?select=${cols}&order=created_at.desc`, { headers });
      if (!r.ok) throw new Error(`list failed (${r.status})`);
      return (await r.json()) as Session[];
    },
    capture: (transcript, opts) => fn<CaptureResult>('capture', { transcript, status: opts?.status }),
    recall: (query) => fn<RecallResult>('recall', { query }),
    // Edits go through the capture function so the row is re-redacted and re-embedded server-side.
    update: async (id, patch) => (await fn<{ session: Session }>('capture', { id, patch })).session,
    async remove(id) {
      const r = await fetch(`${base}/rest/v1/sessions?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers });
      if (!r.ok) throw new Error(`delete failed (${r.status})`);
    },
  };
}

export function getBackend(): Backend {
  const url = import.meta.env?.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env?.VITE_SUPABASE_ANON_KEY as string | undefined;
  const forceDemo = typeof location !== 'undefined' && /[?&]demo=1\b/.test(location.search);
  if (url && key && !forceDemo) return createSupabaseBackend(url, key);
  return createLocalBackend();
}
