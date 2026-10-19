import type { Confidence, RecallMatch, RecallResult, Session } from './types';
import { cosine, embed } from './embed';

/** Hard cut-off for the local hashed embedder. Below this => graceful "no match". */
export const LOCAL_MATCH_THRESHOLD = 0.25;
/** Suggested thresholds for the neural embedders used server-side. */
export const GTE_SMALL_MATCH_THRESHOLD = 0.81;
export const OPENAI_MATCH_THRESHOLD = 0.45;

/** Estimated time a successful recall saves (hours). Conservative vs. the "4h/week" in the problem statement. */
export const HOURS_SAVED_PER_MATCH = 1.5;

export function confidenceFor(similarity: number, threshold: number): Confidence {
  if (similarity < threshold) return 'none';
  const span = 1 - threshold;
  const rel = (similarity - threshold) / span;
  if (rel >= 0.3) return 'high';
  if (rel >= 0.12) return 'medium';
  return 'low';
}

export function rankSessions(queryEmbedding: number[], sessions: Session[], threshold: number, count = 5): RecallMatch[] {
  return sessions
    .filter((s) => s.embedding?.length)
    .map((s) => ({ session: s, similarity: cosine(queryEmbedding, s.embedding!) }))
    .filter((m) => m.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, count);
}

/** Matches whose own similarity to the top match is high count as "the same problem again". */
export function countRepeats(matches: RecallMatch[], threshold: number): number {
  if (!matches.length) return 0;
  const top = matches[0];
  return matches.filter(
    (m) => m === top || (m.similarity >= threshold && cosine(m.session.embedding ?? [], top.session.embedding ?? []) >= Math.max(threshold, 0.35)),
  ).length;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function explainLocally(query: string, matches: RecallMatch[], threshold: number): RecallResult {
  if (!matches.length) {
    return {
      query,
      matches: [],
      matched: false,
      confidence: 'none',
      hitCount: 0,
      threshold,
      explainedBy: 'local',
      explanation: "No match — filing this for future you. You haven't solved anything like this before (or never wrote it down).",
    };
  }
  const top = matches[0];
  const hits = countRepeats(matches, threshold);
  const confidence = confidenceFor(top.similarity, threshold);
  const resolved = matches.find((m) => m.session.status === 'resolved' && m.session.fix) ?? top;
  const times = hits === 1 ? 'once' : hits === 2 ? 'twice' : `${hits} times`;
  const cause = resolved.session.root_cause || 'unknown (never recorded)';
  const fix = resolved.session.fix || 'none recorded yet — this one is still open';
  const ruledOut = resolved.session.hypotheses_tried.filter((h) => h.ruled_out).map((h) => h.text);
  const explanation =
    `You've hit this ${times}. Most likely cause: ${cause}. Fix that worked: ${fix}.` +
    (ruledOut.length ? ` Last time you ruled out: ${ruledOut.join(', ')} — skip those.` : '') +
    ` (closest match ${pct(top.similarity)}, ${confidence} confidence)`;
  return {
    query,
    matches,
    matched: true,
    confidence,
    hitCount: hits,
    likelyCause: cause,
    fixThatWorked: fix,
    threshold,
    explainedBy: 'local',
    explanation,
  };
}

export function recallLocal(query: string, sessions: Session[], threshold = LOCAL_MATCH_THRESHOLD, count = 5): RecallResult {
  const q = embed(query);
  return explainLocally(query, rankSessions(q, sessions, threshold, count), threshold);
}
