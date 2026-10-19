/**
 * Seed Déjà Vu through the REAL capture pipeline (redact -> Groq structure -> embed -> insert).
 *
 *   npm run seed                              # posts the 18 SAMPLE incidents (flagged sample=true)
 *   npm run seed -- --file seed/my-incidents.md   # posts YOUR dictated incidents (one per blank-line-separated paragraph)
 *   npm run seed -- --dry-run [--file ...]    # no network: shows the local redaction + structuring result
 *
 * Env: SUPABASE_URL + SUPABASE_ANON_KEY (or the VITE_ equivalents). Reads .env if present.
 */
import { existsSync, readFileSync } from 'node:fs';
import { SEED_INCIDENTS } from '../src/data/seed.ts';
import { redact } from '../src/lib/redact.ts';
import { structureLocally } from '../src/lib/structure.ts';

if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const args = process.argv.slice(2);
const dry = args.includes('--dry-run');
const fileIdx = args.indexOf('--file');
const file = fileIdx >= 0 ? args[fileIdx + 1] : undefined;

function loadUserIncidents(path: string): string[] {
  return readFileSync(path, 'utf8')
    .split(/\n\s*\n/)
    .map((p) => p.replace(/^#.*$/gm, '').replace(/^\s*[-*\d.]+\s+/gm, '').trim())
    .filter((p) => p.length > 15);
}

const items: Array<{ transcript: string; sample: boolean }> = file
  ? loadUserIncidents(file).map((t) => ({ transcript: t, sample: false }))
  : SEED_INCIDENTS.map((s) => ({ transcript: s.transcript, sample: true }));

const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

async function main() {
  console.log(`${items.length} incident(s) from ${file ?? 'built-in SAMPLE data'}${dry ? ' (dry run)' : ''}\n`);
  if (dry) {
    for (const { transcript } of items) {
      const { text, findings } = redact(transcript);
      console.log(JSON.stringify({ redactions: findings, ...structureLocally(text) }, null, 2));
    }
    return;
  }
  if (!url || !key) {
    console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY (see .env.example), or use --dry-run.');
    process.exit(1);
  }
  let ok = 0;
  for (const [i, it] of items.entries()) {
    const r = await fetch(`${url}/functions/v1/capture`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript: it.transcript, sample: it.sample }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      ok++;
      console.log(`✓ [${i + 1}/${items.length}] ${j.session?.symptom}  (${j.structuredBy})`);
    } else {
      console.error(`✗ [${i + 1}/${items.length}] ${r.status} ${j.error ?? ''}`);
    }
    await new Promise((res) => setTimeout(res, 400)); // stay friendly with Groq free-tier rate limits
  }
  console.log(`\nDone: ${ok}/${items.length} captured.`);
}

main();
