// POST /functions/v1/capture
//   { transcript: string, status?: 'open'|'resolved', sample?: boolean }   -> create a session
//   { id: string, patch: Partial<StructuredNote & {status}> }              -> edit + re-embed a session
// Pipeline: REDACT -> Groq structure (fallback: local heuristic) -> embed -> insert.
import { corsHeaders, json } from '../_shared/cors.ts';
import { redact } from '../_shared/redact.ts';
import { structureLocally } from '../_shared/structure.ts';
import type { Hypothesis, StructuredNote } from '../_shared/types.ts';
import { groqJSON } from '../_shared/groq.ts';
import { embed, sessionEmbeddingText } from '../_shared/embed.ts';
import { admin, SESSION_COLS } from '../_shared/db.ts';

const SYSTEM = `You turn a developer's messy, spoken debugging note into structured JSON.
The note was dictated by voice mid-debug: expect fillers, fragments, dashes, self-corrections.
Return ONLY a JSON object with exactly these keys:
{
  "symptom": string,            // what was observed, phrased so the same symptom is recognisable later (no cause in it)
  "hypotheses_tried": [ { "text": string, "ruled_out": boolean | null } ],  // things suspected/checked; ruled_out=true if they said it wasn't that
  "root_cause": string,         // the actual cause, "" if not found yet
  "fix": string,                // what fixed it, "" if not fixed yet
  "tags": string[]              // 2-6 short lowercase kebab-case tags (tech + category, e.g. "deploy","http-5xx","postgres")
}
Rules: never invent facts not in the note; keep each field concise (<= 25 words); keep redaction placeholders like [REDACTED_EMAIL] as-is.`;

const str = (v: unknown, max = 400) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function sanitize(raw: unknown, fallback: StructuredNote): StructuredNote {
  if (!raw || typeof raw !== 'object') return fallback;
  const o = raw as Record<string, unknown>;
  const hyps: Hypothesis[] = Array.isArray(o.hypotheses_tried)
    ? o.hypotheses_tried
        .map((h) => (typeof h === 'string' ? { text: h, ruled_out: null } : { text: str((h as Hypothesis)?.text), ruled_out: (h as Hypothesis)?.ruled_out ?? null }))
        .filter((h) => h.text)
        .slice(0, 10)
    : fallback.hypotheses_tried;
  const tags = Array.isArray(o.tags) ? o.tags.map((t) => str(t, 40).toLowerCase().replace(/\s+/g, '-')).filter(Boolean).slice(0, 8) : fallback.tags;
  return {
    symptom: str(o.symptom) || fallback.symptom,
    hypotheses_tried: hyps,
    root_cause: str(o.root_cause),
    fix: str(o.fix),
    tags: tags.length ? tags : fallback.tags,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  try {
    const body = await req.json();
    const db = admin();

    // ── edit existing session ──
    if (body.id && body.patch) {
      const { data: cur, error: e1 } = await db.from('sessions').select(SESSION_COLS).eq('id', body.id).single();
      if (e1 || !cur) return json({ error: 'session not found' }, 404);
      const p = body.patch as Record<string, unknown>;
      const next = { ...cur } as Record<string, unknown>;
      for (const k of ['symptom', 'root_cause', 'fix'] as const) if (typeof p[k] === 'string') next[k] = redact(p[k] as string).text;
      if (Array.isArray(p.hypotheses_tried)) next.hypotheses_tried = (p.hypotheses_tried as Hypothesis[]).map((h) => ({ ...h, text: redact(h.text).text }));
      if (Array.isArray(p.tags)) next.tags = p.tags;
      if (p.status === 'open' || p.status === 'resolved') next.status = p.status;
      const embedding = await embed(sessionEmbeddingText(next as unknown as StructuredNote));
      const { data, error } = await db
        .from('sessions')
        .update({ ...next, id: undefined, created_at: undefined, embedding, updated_at: new Date().toISOString() })
        .eq('id', body.id)
        .select(SESSION_COLS)
        .single();
      if (error) throw error;
      return json({ session: data });
    }

    // ── new session ──
    const transcript = str(body.transcript, 8000);
    if (!transcript) return json({ error: 'transcript is required' }, 400);

    // 1) redact FIRST. Nothing un-redacted ever reaches Groq, the embedder or the DB.
    const { text, findings } = redact(transcript);

    // 2) structure (Groq JSON mode, deterministic heuristic as fallback)
    const local = structureLocally(text);
    const llm = await groqJSON<unknown>(SYSTEM, text);
    const note = llm ? sanitize(llm, local) : local;
    // second redaction pass over the LLM output, belt and braces
    note.symptom = redact(note.symptom).text;
    note.root_cause = redact(note.root_cause).text;
    note.fix = redact(note.fix).text;

    // 3) embed
    const embedding = await embed(sessionEmbeddingText(note));

    // 4) store
    const status = body.status === 'open' || body.status === 'resolved' ? body.status : note.fix ? 'resolved' : 'open';
    const { data, error } = await db
      .from('sessions')
      .insert({ ...note, raw_transcript_redacted: text, status, sample: !!body.sample, embedding })
      .select(SESSION_COLS)
      .single();
    if (error) throw error;

    return json({ session: data, redactions: findings, structuredBy: llm ? 'groq' : 'local-heuristic' });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message ?? String(e) }, 500);
  }
});
