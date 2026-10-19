/**
 * Local, zero-dependency, deterministic text embedder used in Demo Mode.
 *
 * Signed feature hashing (384 dims, same width as Supabase gte-small) over:
 *   - normalized unigrams (with a debugging-domain synonym/canonical map + light stemming)
 *   - bigrams
 *   - character trigrams (robust to typos / dictation slips)
 * Vectors are L2-normalised so cosine similarity == dot product.
 *
 * When Supabase is configured, the real neural embedding (gte-small or OpenAI) is
 * computed server-side in the edge function instead.
 */

export const EMBED_DIMS = 384;

// Phrase-level canonicalisation: spoken / alternative forms -> one canonical token.
const PHRASES: Array<[RegExp, string]> = [
  [/\bbad gateway\b/g, ' http502 '],
  [/\b502s?\b/g, ' http502 '],
  [/\bgateway time-?outs?\b/g, ' http504 '],
  [/\b504s?\b/g, ' http504 '],
  [/\b503s?\b|\bservice unavailable\b/g, ' http503 '],
  [/\b500s?\b|\binternal server errors?\b/g, ' http500 '],
  [/\b401s?\b|\bunauthori[sz]ed\b/g, ' http401 '],
  [/\b403s?\b|\bforbidden\b/g, ' http403 '],
  [/\b404s?\b|\bnot found\b/g, ' http404 '],
  [/\b413s?\b|\b(request |payload )?entity too large\b|\bpayload too large\b|\bbody (size )?too (large|big)\b/g, ' http413 '],
  [/\bupload(s|ed|ing)?\b/g, ' upload '],
  [/\b429s?\b|\btoo many requests\b|\brate[- ]?limit(ed|ing|s)?\b/g, ' ratelimit '],
  [/\bout of memory\b|\boom(-?killed)?\b|\bmemory leak(s)?\b/g, ' oom memory '],
  [/\benvironment variables?\b|\benv vars?\b|\benv\b|\.env\b/g, ' envvar '],
  [/\bload ?balancers?\b|\blb\b|\balb\b|\belb\b/g, ' loadbalancer '],
  [/\bk8s\b|\bkubernetes\b/g, ' kubernetes '],
  [/\bpostgres(ql)?\b|\bpsql\b|\bpg\b/g, ' postgres '],
  [/\bdeploy(s|ed|ing|ment|ments)?\b|\brelease(d|s)?\b|\bship(ped|ping)?\b|\brollout\b/g, ' deploy '],
  [/\btime ?outs?\b|\btimed out\b|\btiming out\b/g, ' timeout '],
  [/\bslow(ness|er|ly)?\b|\blatency\b|\bsluggish\b|\blaggy\b|\bp99\b|\bp95\b/g, ' latency '],
  [/\bcrash(es|ed|ing)?\b|\bcrashloop(backoff)?\b|\bkeeps? restarting\b/g, ' crash '],
  [/\bcerts?\b|\bcertificates?\b|\btls\b|\bssl\b|\bhttps handshake\b/g, ' tls '],
  [/\bcors\b|\bcross[- ]origin\b|\bpreflight\b/g, ' cors '],
  [/\blog ?in\b|\bsign ?in\b|\bauth(entication)?\b|\blogged out\b|\bsessions? expir(e|ed|ing)\b/g, ' auth '],
  [/\bdb\b|\bdatabase\b/g, ' database '],
  [/\bconn(ection)?s?\b|\bpool(s|ing)?\b/g, ' connection '],
  [/\bdns\b|\bname resolution\b|\bnxdomain\b/g, ' dns '],
  [/\bcache(d|s)?\b|\bcaching\b/g, ' cache '],
  [/\bcron( ?jobs?)?\b|\bscheduled jobs?\b/g, ' cron '],
  [/\bwebsockets?\b|\bws\b|\bsocket\b/g, ' websocket '],
  [/\btimezones?\b|\butc\b|\bdst\b|\bdaylight saving\b/g, ' timezone '],
  [/\bdisk (is )?full\b|\bno space left\b|\bdisk space\b/g, ' diskfull '],
  [/\bflaky\b|\bintermittent(ly)?\b|\brandomly\b|\bsometimes\b/g, ' intermittent '],
  [/\bci\b|\bpipeline\b|\bgithub actions\b|\bbuild (is )?failing\b/g, ' ci '],
  [/\bnpm\b|\byarn\b|\bpnpm\b|\bnode_modules\b|\blockfile\b|\bpackage-lock\b/g, ' dependency '],
  [/\bduplicate(d|s)?\b|\bdouble[- ]?(charged|processed|sent)\b|\btwice\b/g, ' duplicate '],
  [/\bblank (page|screen)\b|\bwhite screen\b|\bwhite page\b/g, ' blankscreen '],
  [/\bcpu (spike|at 100|pegged|maxed)\w*\b|\bhigh cpu\b/g, ' cpuspike '],
  [/\bdeadlocks?\b|\block wait\b/g, ' deadlock '],
  [/\bmigrations?\b/g, ' migration '],
  [/\bqueues?\b|\bworkers?\b|\bconsumers?\b|\bsidekiq\b|\bcelery\b|\bbullmq\b/g, ' worker queue '],
];

const STOPWORDS = new Set(
  (
    'a an the and or but so ok okay um uh like just then this that these those it its it\'s is was were be been being am are ' +
    'to of in on at for from by with without into onto about after before again over under up down out off ' +
    'i me my we our you your they them their he she his her what which who whom when where why how ' +
    'not no yes do does did done doing have has had having can could should would will shall may might must ' +
    'some any all every each very really actually basically literally there here also too only still even ' +
    'thought think thinking turned turns wasnt wasn\'t isnt isn\'t got get gets getting went go going thing things stuff ' +
    'fixed fix fixes fixing'
  ).split(/\s+/),
);

function stem(w: string): string {
  if (w.length <= 4 || /\d/.test(w)) return w;
  for (const suf of ['ing', 'edly', 'ed', 'ies', 'es', 's', 'ly']) {
    if (w.endsWith(suf) && w.length - suf.length >= 3) {
      const base = w.slice(0, -suf.length);
      return suf === 'ies' ? base + 'y' : base;
    }
  }
  return w;
}

export function normalize(text: string): string {
  let t = ` ${text.toLowerCase()} `;
  t = t.replace(/[’']/g, "'");
  for (const [re, rep] of PHRASES) t = t.replace(re, rep);
  return t;
}

export function tokenize(text: string): string[] {
  return normalize(text)
    .replace(/\[redacted[a-z_]*\]/g, ' ')
    .split(/[^a-z0-9']+/)
    .map((w) => w.replace(/'/g, ''))
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
    .map(stem);
}

// FNV-1a 32-bit
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function addFeature(vec: Float64Array, feature: string, weight: number) {
  const h = hash(feature);
  const idx = h % EMBED_DIMS;
  const sign = (h >>> 31) & 1 ? -1 : 1;
  vec[idx] += sign * weight;
}

export function embed(text: string): number[] {
  const vec = new Float64Array(EMBED_DIMS);
  const toks = tokenize(text);
  const seen = new Map<string, number>();
  toks.forEach((t) => seen.set(t, (seen.get(t) ?? 0) + 1));
  // sub-linear tf
  for (const [t, c] of seen) addFeature(vec, 'u:' + t, 1 + Math.log(c));
  for (let i = 0; i < toks.length - 1; i++) addFeature(vec, `b:${toks[i]}_${toks[i + 1]}`, 0.5);
  for (const t of seen.keys()) {
    if (t.length < 5) continue;
    const p = `#${t}#`;
    for (let i = 0; i < p.length - 2; i++) addFeature(vec, 'c:' + p.slice(i, i + 3), 0.12);
  }
  let norm = 0;
  for (let i = 0; i < EMBED_DIMS; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  return Array.from(vec, (v) => v / norm);
}

export function cosine(a: number[], b: number[]): number {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Text that represents a session in vector space. Symptom is weighted most (it is what recall queries look like). */
export function sessionEmbeddingText(s: { symptom: string; root_cause?: string; fix?: string; tags?: string[] }): string {
  return [s.symptom, s.symptom, s.root_cause ?? '', (s.tags ?? []).join(' ')].join(' . ');
}
