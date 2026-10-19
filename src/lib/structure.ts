/**
 * Deterministic local structuring heuristic (Demo Mode / Groq fallback).
 * Turns a messy spoken debugging note into {symptom, hypotheses_tried, root_cause, fix, tags}.
 *
 *   "ok, 502s after deploy — thought it was the LB, wasn't — stale env var, restarted worker, fixed."
 *   -> symptom: "502s after deploy"
 *      hypotheses_tried: [{ text: "the LB", ruled_out: true }]
 *      root_cause: "stale env var"
 *      fix: "restarted worker"
 */
import type { Hypothesis, StructuredNote } from './types.ts';

const FILLER = /^(?:ok(?:ay)?|so|um+|uh+|alright|right|well|hmm+|yeah|anyway|and|then|basically|like|also|but)\b[\s,]*/i;

const HYPOTHESIS_RE =
  /^(?:i\s+)?(?:first\s+|initially\s+|originally\s+)?(?:thought|think|suspected|assumed|figured|guessed|blamed|tried|checked|looked at|ruled out|maybe|might be|could be|considered|was sure|bet it was)\b\s*(?:it\s+was\s+|it's\s+|that\s+it\s+was\s+|the\s+problem\s+was\s+)?/i;

const NEGATION_RE =
  /^(?:it\s+)?(?:wasn'?t(?:\s+it|\s+that)?|was\s+not(?:\s+it)?|nope|not\s+it|not\s+that|no(?:\s+luck)?|didn'?t\s+help|didn'?t\s+work|red\s+herring|dead\s+end|false\s+alarm|ruled\s+(?:it\s+)?out)\.?$/i;

const DONE_RE = /^(?:and\s+)?(?:that\s+)?(?:fixed(?:\s+it)?|solved(?:\s+it)?|resolved|works(?:\s+now)?|working(?:\s+now)?|all\s+good|done|green(?:\s+again)?|back\s+to\s+normal|problem\s+solved)\.?!?$/i;

const CAUSE_RE =
  /^(?:turns?\s+out(?:\s+it\s+was)?|turned\s+out(?:\s+(?:it\s+was|to\s+be))?|root\s+cause(?:\s+was|:)?|real\s+(?:cause|issue|problem)(?:\s+was)?|actual(?:ly)?(?:\s+it\s+was)?|it\s+was\s+actually|the\s+(?:culprit|issue|problem|cause)\s+was|caused\s+by|because(?:\s+of)?|due\s+to|it\s+was|was)\b[\s:]*/i;

const FIX_RE =
  /^(?:(?:the\s+)?fix(?:ed\s+(?:it\s+)?by|\s+was|:)?|solved\s+(?:it\s+)?by|resolved\s+(?:it\s+)?by|so\s+i|i)?\s*(restart(?:ed|ing)?|roll(?:ed)?\s*back|revert(?:ed)?|bump(?:ed)?|increas(?:ed|e)|decreas(?:ed|e)|rais(?:ed|e)|lower(?:ed)?|patch(?:ed)?|add(?:ed)?|remov(?:ed|e)|delet(?:ed|e)|clear(?:ed)?|flush(?:ed)?|purg(?:ed|e)|upgrad(?:ed|e)|downgrad(?:ed|e)|pin(?:ned)?|set|chang(?:ed|e)|updat(?:ed|e)|renew(?:ed)?|rotat(?:ed|e)|regenerat(?:ed|e)|redeploy(?:ed)?|re-?ran|rebuil[dt]|reinstall(?:ed)?|switch(?:ed)?|mov(?:ed|e)|wrap(?:ped)?|enabl(?:ed|e)|disabl(?:ed|e)|turn(?:ed)?\s+(?:on|off)|kill(?:ed)?|scal(?:ed|e)(?:\s+up|\s+down)?|reindex(?:ed)?|vacuum(?:ed)?|migrat(?:ed|e)|configur(?:ed|e)|whitelist(?:ed)?|allowlist(?:ed)?|corrected|fixed|replaced|cleaned|cached|added|wrote|moved|used|made|gave)\b/i;

const TAG_DICT: Array<[RegExp, string]> = [
  [/\bdeploy|release|rollout|ship/i, 'deploy'],
  [/\b50[0-9]s?\b|bad gateway|gateway/i, 'http-5xx'],
  [/\b4[0-2][0-9]s?\b|unauthori[sz]ed|forbidden|too large/i, 'http-4xx'],
  [/upload|multipart|file size|body size|client_max_body_size/i, 'uploads'],
  [/\bnginx\b/i, 'nginx'],
  [/load ?balancer|\blb\b|\balb\b|\belb\b/i, 'load-balancer'],
  [/\bk8s\b|kubernetes|\bpods?\b|helm|kubectl/i, 'kubernetes'],
  [/docker|container|\bimage (build|tag|pull|registry)|\bdocker image/i, 'docker'],
  [/postgres|\bpg\b|psql|database|\bdb\b|sql|migration|index/i, 'database'],
  [/redis/i, 'redis'],
  [/cache|stale|cdn|cloudflare/i, 'cache'],
  [/env(ironment)? ?var|\.env\b|config|secret/i, 'config'],
  [/\bdns\b|nxdomain|resolv/i, 'dns'],
  [/memory|\boom\b|leak|heap/i, 'memory'],
  [/cpu|latency|slow|timeout|p99|perf/i, 'performance'],
  [/\bcors\b|preflight|cross-origin/i, 'cors'],
  [/\bauth|log(ged)? ?(in|out)\b|sign ?in|\bjwt\b|oauth|session cookie|cookie|token expir/i, 'auth'],
  [/\bssl\b|\btls\b|cert/i, 'tls'],
  [/worker|queue|job|cron|consumer/i, 'jobs'],
  [/timezone|\butc\b|\bdst\b|date|clock/i, 'time'],
  [/\bnpm\b|yarn|pnpm|dependenc|package|lockfile|version/i, 'dependencies'],
  [/\bci\b|pipeline|github actions|build/i, 'ci'],
  [/react|hydration|frontend|browser|css|safari|chrome/i, 'frontend'],
  [/websocket|socket/i, 'websocket'],
  [/disk|inode|space left|volume/i, 'disk'],
  [/webhook|stripe|payment/i, 'webhooks'],
  [/rate ?limit|429|throttl/i, 'rate-limit'],
  [/race condition|concurren|deadlock|\block(s|ed|ing)?\b|mutex/i, 'concurrency'],
];

function clean(s: string): string {
  let out = s.trim();
  let prev = '';
  while (prev !== out) {
    prev = out;
    out = out.replace(FILLER, '').trim();
  }
  return out.replace(/^[,;:.\-–—\s]+|[,;:.\-–—\s]+$/g, '').trim();
}

export function splitClauses(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/\s*(?:—|–|\s-\s|;|\.\s|\.$|,|\bthen\b|\bbut\b|\band then\b|\bafter that\b|\bso then\b|\bin the end\b|\bfinally\b|\beventually\b)\s*/i)
    .map(clean)
    .filter(Boolean);
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function extractTags(text: string): string[] {
  const tags = TAG_DICT.filter(([re]) => re.test(text)).map(([, t]) => t);
  return Array.from(new Set(tags)).slice(0, 6);
}

export function structureLocally(transcript: string): StructuredNote {
  const clauses = splitClauses(transcript);
  const symptomParts: string[] = [];
  const hypotheses: Hypothesis[] = [];
  const causeParts: string[] = [];
  const fixParts: string[] = [];
  const unclassified: string[] = [];
  let phase: 'symptom' | 'investigating' = 'symptom';

  for (const c of clauses) {
    if (NEGATION_RE.test(c)) {
      const last = hypotheses[hypotheses.length - 1];
      if (last) last.ruled_out = true;
      phase = 'investigating';
      continue;
    }
    if (DONE_RE.test(c)) continue;

    const hyp = c.match(HYPOTHESIS_RE);
    if (hyp) {
      let h = clean(c.slice(hyp[0].length));
      let ruledOut: boolean | null = null;
      const inlineNeg = h.match(/\s*(?:,|—|-)?\s*(?:but\s+)?(?:it\s+)?(?:wasn'?t|was\s+not|nope|didn'?t\s+help)\b.*$/i);
      if (inlineNeg) {
        h = clean(h.slice(0, inlineNeg.index));
        ruledOut = true;
      }
      if (h) hypotheses.push({ text: h, ruled_out: ruledOut });
      phase = 'investigating';
      continue;
    }

    const fixM = c.match(FIX_RE);
    if (fixM && (phase === 'investigating' || symptomParts.length > 0)) {
      const f = clean(c.replace(/^(?:(?:the\s+)?fix(?:ed\s+(?:it\s+)?by|\s+was|:)?|solved\s+(?:it\s+)?by|resolved\s+(?:it\s+)?by|so\s+i|i)\s+/i, ''));
      fixParts.push(f.replace(/[,\s]*(?:and\s+)?(?:that\s+)?(?:(?:fixed|solved)\s+it|it\s+works(?:\s+now)?|it'?s\s+(?:fine|good)(?:\s+now)?|we'?re\s+good)\.?$/i, ''));
      phase = 'investigating';
      continue;
    }

    const causeM = c.match(CAUSE_RE);
    if (causeM && phase === 'investigating') {
      const rest = clean(c.slice(causeM[0].length));
      if (rest) causeParts.push(rest);
      continue;
    }
    if (/^(?:turns?\s+out|turned\s+out|root\s+cause|the\s+(?:culprit|issue|problem)\s+was|caused\s+by)/i.test(c)) {
      const rest = clean(c.slice((causeM?.[0] ?? '').length));
      if (rest) causeParts.push(rest);
      phase = 'investigating';
      continue;
    }

    if (phase === 'symptom') symptomParts.push(c);
    else unclassified.push(c);
  }

  // Unclassified clauses after investigation started are usually the root cause (spoken tersely).
  if (!causeParts.length && unclassified.length) causeParts.push(unclassified.shift()!);
  // If a hypothesis was NOT ruled out and there's still no cause, it probably was the cause.
  if (!causeParts.length) {
    const confirmed = [...hypotheses].reverse().find((h) => h.ruled_out !== true);
    if (confirmed && fixParts.length) {
      confirmed.ruled_out = false;
      causeParts.push(confirmed.text);
    }
  }
  if (!symptomParts.length && clauses.length) symptomParts.push(clauses[0]);

  const symptom = cap(symptomParts.join(', '));
  const root_cause = cap([...causeParts].join('; '));
  const fix = cap(fixParts.join(', then '));
  return {
    symptom: symptom || cap(clean(transcript)).slice(0, 160),
    hypotheses_tried: hypotheses.map((h) => ({ ...h, text: h.text })),
    root_cause,
    fix,
    tags: extractTags(transcript),
  };
}
