// POST /functions/v1/recall  { query: string, threshold?: number, count?: number }
// Pipeline: redact -> embed -> match_sessions (pgvector, hard threshold) -> Groq explanation.
import { corsHeaders, json } from '../_shared/cors.ts';
import { redact } from '../_shared/redact.ts';
import { groqJSON } from '../_shared/groq.ts';
import { DEFAULT_THRESHOLD, EMBEDDING_PROVIDER, embed } from '../_shared/embed.ts';

const ENGINE = EMBEDDING_PROVIDER === 'openai' ? 'openai text-embedding-3-small' : 'supabase gte-small';
import { admin } from '../_shared/db.ts';

type Row = {
  id: string; symptom: string; root_cause: string; fix: string; status: string; created_at: string;
  hypotheses_tried: { text: string; ruled_out: boolean | null }[]; tags: string[]; similarity: number;
  raw_transcript_redacted: string; sample: boolean;
};

const SYSTEM = `You are Déjà Vu, a developer's memory of their own past debugging sessions.
Given a NEW symptom and the PAST sessions that matched it (with cosine similarity), answer as JSON:
{
  "hit_count": number,        // how many past sessions are genuinely the SAME problem (0..n). Be strict.
  "likely_cause": string,     // most likely cause, taken from past sessions only
  "fix_that_worked": string,  // the fix that worked last time, taken from past sessions only
  "explanation": string       // 1-3 sentences, second person, start with "You've hit this once/twice/N times." mention hypotheses that were ruled out so they can skip them.
}
Never invent causes or fixes that are not in the past sessions. If none is really the same problem, set hit_count to 0.`;

function confidenceFor(sim: number, threshold: number) {
  if (sim < threshold) return 'none';
  const rel = (sim - threshold) / (1 - threshold);
  return rel >= 0.3 ? 'high' : rel >= 0.12 ? 'medium' : 'low';
}

const NO_MATCH = "No match — filing this for future you. You haven't solved anything like this before (or never wrote it down).";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  try {
    const body = await req.json();
    const query = redact(String(body.query ?? '').slice(0, 2000)).text.trim();
    if (!query) return json({ error: 'query is required' }, 400);
    const threshold = typeof body.threshold === 'number' ? body.threshold : DEFAULT_THRESHOLD;
    const count = Math.min(Number(body.count) || 5, 10);

    const embedding = await embed(query);
    const { data, error } = await admin().rpc('match_sessions', { query_embedding: embedding, match_threshold: threshold, match_count: count });
    if (error) throw error;
    const rows = (data ?? []) as Row[];
    const matches = rows.map(({ similarity, ...session }) => ({ session, similarity }));

    if (!rows.length) {
      return json({ query, matches: [], matched: false, confidence: 'none', hitCount: 0, threshold, explainedBy: 'local', engine: ENGINE, explanation: NO_MATCH });
    }

    const top = rows[0];
    const best = rows.find((r) => r.status === 'resolved' && r.fix) ?? top;
    const confidence = confidenceFor(top.similarity, threshold);

    const llm = await groqJSON<{ hit_count: number; likely_cause: string; fix_that_worked: string; explanation: string }>(
      SYSTEM,
      JSON.stringify({
        new_symptom: query,
        past_sessions: rows.map((r) => ({
          similarity: +r.similarity.toFixed(3), date: r.created_at.slice(0, 10), symptom: r.symptom,
          hypotheses_tried: r.hypotheses_tried, root_cause: r.root_cause, fix: r.fix, status: r.status,
        })),
      }),
    );

    // Deterministic fallback: count close neighbours of the top hit.
    const fallbackHits = rows.filter((r) => r.similarity >= Math.max(threshold, top.similarity - 0.06)).length;
    const hitCount = llm && Number.isFinite(llm.hit_count) ? Math.max(1, Math.min(rows.length, Math.round(llm.hit_count))) : fallbackHits;
    const times = hitCount === 1 ? 'once' : hitCount === 2 ? 'twice' : `${hitCount} times`;
    const ruledOut = best.hypotheses_tried.filter((h) => h.ruled_out).map((h) => h.text);
    const fallback =
      `You've hit this ${times}. Most likely cause: ${best.root_cause || 'unknown'}. Fix that worked: ${best.fix || 'none recorded yet'}.` +
      (ruledOut.length ? ` Last time you ruled out: ${ruledOut.join(', ')}.` : '');

    return json({
      query,
      matches,
      matched: true,
      confidence,
      hitCount,
      likelyCause: llm?.likely_cause || best.root_cause,
      fixThatWorked: llm?.fix_that_worked || best.fix,
      explanation: `${llm?.explanation || fallback} (closest match ${Math.round(top.similarity * 100)}%, ${confidence} confidence)`,
      threshold,
      explainedBy: llm ? 'groq' : 'local',
      engine: ENGINE,
    });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message ?? String(e) }, 500);
  }
});
