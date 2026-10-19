/**
 * ⚠️ SAMPLE DATA — NOT REAL INCIDENTS.
 *
 * These 18 incidents are realistic *examples* shipped so the Demo Mode works instantly for judges.
 * Replace them with your own real incidents dictated through Wispr Flow (see docs/SEED_TEMPLATE.md).
 * Every record is flagged `sample: true` and shown with a "sample" badge in the UI.
 */
import type { Hypothesis } from '../lib/types';

export interface SeedIncident {
  transcript: string;
  symptom: string;
  hypotheses_tried: Hypothesis[];
  root_cause: string;
  fix: string;
  tags: string[];
  daysAgo: number;
}

const h = (text: string, ruled_out: boolean | null = true): Hypothesis => ({ text, ruled_out });

export const SEED_INCIDENTS: SeedIncident[] = [
  {
    daysAgo: 212,
    transcript: "ok, 502s after deploy — thought it was the LB, wasn't — stale env var, restarted worker, fixed.",
    symptom: '502 Bad Gateway errors right after a deploy',
    hypotheses_tried: [h('Load balancer health checks misconfigured')],
    root_cause: 'Stale environment variable — worker processes kept the old env after deploy',
    fix: 'Restarted the worker processes so they picked up the new env vars',
    tags: ['deploy', 'http-5xx', 'config', 'load-balancer'],
  },
  {
    daysAgo: 96,
    transcript: "502s again after the Friday release. Checked nginx upstream config, fine. Again the API workers still had the old DATABASE_URL in their env. Restart workers, gone. Need to add a restart step to the deploy script.",
    symptom: '502s from nginx after a release',
    hypotheses_tried: [h('nginx upstream config')],
    root_cause: 'API workers still had the old DATABASE_URL — env not reloaded after deploy',
    fix: 'Restarted workers; added a worker restart step to the deploy script',
    tags: ['deploy', 'http-5xx', 'nginx', 'config'],
  },
  {
    daysAgo: 180,
    transcript: "Postgres CPU pegged at 100 percent every night around 2am. Thought it was the backup job, nope. Turned out an analytics cron was doing a sequential scan on events because the created_at index was missing. Added the index, CPU back to 10 percent.",
    symptom: 'Postgres CPU at 100% every night around 2am',
    hypotheses_tried: [h('Nightly backup job')],
    root_cause: 'Analytics cron doing a sequential scan on the events table — missing index on created_at',
    fix: 'Added an index on events(created_at); CPU dropped to ~10%',
    tags: ['database', 'performance', 'jobs'],
  },
  {
    daysAgo: 160,
    transcript: "Users randomly logged out on Safari only. Suspected JWT expiry too short, wasn't. Cookie was SameSite=None without the Secure flag so Safari dropped it. Set Secure on the session cookie, fixed.",
    symptom: 'Users randomly logged out, only on Safari',
    hypotheses_tried: [h('JWT expiry too short')],
    root_cause: 'Session cookie had SameSite=None without the Secure flag, so Safari dropped it',
    fix: 'Set the Secure flag on the session cookie',
    tags: ['auth', 'frontend'],
  },
  {
    daysAgo: 150,
    transcript: "CORS errors on the preflight only in staging. Thought the API gateway was stripping headers, wasn't. The allowed origins env var had a trailing slash. Removed the trailing slash, works.",
    symptom: 'CORS preflight failing only in staging',
    hypotheses_tried: [h('API gateway stripping CORS headers')],
    root_cause: 'ALLOWED_ORIGINS env var had a trailing slash so the origin never matched',
    fix: 'Removed the trailing slash from ALLOWED_ORIGINS',
    tags: ['cors', 'config'],
  },
  {
    daysAgo: 140,
    transcript: "Node service memory keeps growing until it gets OOM killed every 6 hours. Tried bumping the memory limit, just delayed it. Heap snapshot showed an in-memory cache Map with no eviction. Swapped it for an LRU with max 5000 entries, memory flat.",
    symptom: 'Node service memory grows until OOM-killed every ~6 hours',
    hypotheses_tried: [h('Container memory limit too low')],
    root_cause: 'Unbounded in-memory cache (a Map with no eviction)',
    fix: 'Replaced the Map with an LRU cache capped at 5000 entries',
    tags: ['memory', 'performance'],
  },
  {
    daysAgo: 132,
    transcript: "Stripe webhooks processed twice, customers double charged emails. Thought Stripe was retrying because of slow responses, partially. Real issue no idempotency check on event id. Stored processed event ids with a unique constraint, fixed.",
    symptom: 'Stripe webhooks processed twice — duplicate charge emails',
    hypotheses_tried: [h('Stripe retrying because of slow responses', null)],
    root_cause: 'No idempotency check on the webhook event id',
    fix: 'Stored processed event ids in a table with a unique constraint and skip duplicates',
    tags: ['webhooks', 'concurrency'],
  },
  {
    daysAgo: 120,
    transcript: "Pods in CrashLoopBackOff after the helm upgrade. Thought the image was bad, it ran fine locally. Liveness probe was hitting /health before the app finished migrations. Added a startup probe with a longer threshold, pods healthy.",
    symptom: 'Pods stuck in CrashLoopBackOff after a helm upgrade',
    hypotheses_tried: [h('Broken container image')],
    root_cause: 'Liveness probe killed the pod before startup migrations finished',
    fix: 'Added a startupProbe with a longer failureThreshold',
    tags: ['kubernetes', 'deploy'],
  },
  {
    daysAgo: 110,
    transcript: "Blank white screen in production but dev works fine. Checked the API, fine. It was the asset base path, the build was served from a sub path so the JS bundle 404ed. Set the vite base option, fixed.",
    symptom: 'Blank white screen in production, works in dev',
    hypotheses_tried: [h('API down')],
    root_cause: 'Wrong asset base path — app served from a sub-path so the JS bundle 404ed',
    fix: 'Set the Vite `base` option to the sub-path and rebuilt',
    tags: ['frontend', 'deploy'],
  },
  {
    daysAgo: 100,
    transcript: "Scheduled report emails going out an hour early since last week. Thought the cron server clock drifted, no. Daylight saving change, cron was in local time. Switched the scheduler to UTC.",
    symptom: 'Scheduled report emails sent an hour early',
    hypotheses_tried: [h('Server clock drift')],
    root_cause: 'Daylight saving time change — cron expressions were in local time',
    fix: 'Switched the scheduler and cron expressions to UTC',
    tags: ['time', 'jobs'],
  },
  {
    daysAgo: 88,
    transcript: "Intermittent connection refused to Redis from the API, maybe 1 percent of requests. Thought Redis was overloaded, CPU was low. Connection pool max was 10 and we were exhausting it under burst. Raised the pool size and added a timeout, errors gone.",
    symptom: 'Intermittent Redis connection errors on ~1% of requests',
    hypotheses_tried: [h('Redis overloaded')],
    root_cause: 'Client connection pool (max 10) exhausted under burst traffic',
    fix: 'Raised the pool size and added an acquire timeout',
    tags: ['redis', 'performance'],
  },
  {
    daysAgo: 75,
    transcript: "CI failing only on main, tests pass locally. Checked node version, same. The GitHub Actions cache restored a stale node_modules from an old lockfile. Keyed the cache on the lockfile hash, green.",
    symptom: 'CI failing on main while tests pass locally',
    hypotheses_tried: [h('Different Node version in CI')],
    root_cause: 'Actions cache restored a stale node_modules built from an old lockfile',
    fix: 'Keyed the CI cache on the lockfile hash',
    tags: ['ci', 'dependencies', 'cache'],
  },
  {
    daysAgo: 64,
    transcript: "SSL handshake errors for some customers, cert expired warnings. Thought the cert itself expired, it hadn't. Intermediate certificate missing from the chain on one load balancer. Uploaded the full chain bundle.",
    symptom: 'TLS handshake / certificate errors for some clients',
    hypotheses_tried: [h('Certificate expired')],
    root_cause: 'Intermediate certificate missing from the chain on one load balancer',
    fix: 'Uploaded the full-chain certificate bundle',
    tags: ['tls', 'load-balancer'],
  },
  {
    daysAgo: 52,
    transcript: "Disk full on the build server, builds failing with no space left on device. Thought it was logs, they were small. Docker images and dangling volumes ate 200 gigs. docker system prune and added a weekly prune cron.",
    symptom: 'Build server disk full — "no space left on device"',
    hypotheses_tried: [h('Log files growing')],
    root_cause: 'Old Docker images and dangling volumes (~200 GB)',
    fix: 'Ran docker system prune and added a weekly prune cron',
    tags: ['disk', 'docker', 'ci'],
  },
  {
    daysAgo: 40,
    transcript: "API p99 latency jumped from 200ms to 3 seconds after adding the comments feature. Thought the database was slow overall, it wasn't. N plus one queries loading authors per comment. Batched with a dataloader, p99 back to 250.",
    symptom: 'API p99 latency jumped to 3s after a new feature',
    hypotheses_tried: [h('Database slow overall')],
    root_cause: 'N+1 queries loading the author for every comment',
    fix: 'Batched author loading with a DataLoader',
    tags: ['performance', 'database'],
  },
  {
    daysAgo: 28,
    transcript: "WebSocket connections dropping every 60 seconds exactly. Thought the client heartbeat was broken, it wasn't. The load balancer idle timeout was 60 seconds. Raised the idle timeout and added server pings every 25 seconds.",
    symptom: 'WebSocket connections drop every 60 seconds',
    hypotheses_tried: [h('Client heartbeat broken')],
    root_cause: 'Load balancer idle timeout of 60s closing quiet connections',
    fix: 'Raised the LB idle timeout and added server pings every 25s',
    tags: ['websocket', 'load-balancer'],
  },
  {
    daysAgo: 15,
    transcript: "Getting 429 too many requests from the GitHub API in the sync job. Thought our token was revoked, no. Every worker was polling independently so we blew the rate limit. Moved to a single scheduler plus conditional requests with ETags.",
    symptom: '429 Too Many Requests from a third-party API in a sync job',
    hypotheses_tried: [h('API token revoked')],
    root_cause: 'Every worker polled independently and blew through the rate limit',
    fix: 'Single scheduler plus conditional requests (ETags)',
    tags: ['rate-limit', 'jobs'],
  },
  {
    daysAgo: 6,
    transcript: "Migration hung in production and locked the users table, site timed out. Thought the migration was just slow. It was waiting on a lock held by a long running analytics query. Killed the query, set lock_timeout on migrations, ran again.",
    symptom: 'Production migration hung and the site started timing out',
    hypotheses_tried: [h('Migration simply slow on a big table')],
    root_cause: 'ALTER TABLE waiting on a lock held by a long-running analytics query',
    fix: 'Killed the blocking query and set lock_timeout for migrations',
    tags: ['database', 'concurrency', 'deploy'],
  },
];

/** Symptom chips for the Recall screen. The last one intentionally has no match. */
export const SAMPLE_SYMPTOMS: Array<{ label: string; query: string; expectMatch: boolean }> = [
  { label: '502s after deploy', query: 'getting 502 bad gateway right after we deployed', expectMatch: true },
  { label: 'Safari logouts', query: 'users keep getting logged out on safari', expectMatch: true },
  { label: 'OOM every few hours', query: 'node process memory keeps climbing then gets oom killed', expectMatch: true },
  { label: 'WebSocket drops', query: 'websocket disconnects every minute', expectMatch: true },
  { label: 'CI red, local green', query: 'tests pass locally but ci pipeline is failing', expectMatch: true },
  { label: '🚫 no-match demo', query: 'bluetooth printer prints mirrored receipts in landscape', expectMatch: false },
];
