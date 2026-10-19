import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { redact, totalRedactions } from '../src/lib/redact';

const types = (s: string) => redact(s).findings.map((f) => f.type);

describe('redact', () => {
  it('leaves an ordinary debugging note untouched', () => {
    const note = "ok, 502s after deploy — thought it was the LB, wasn't — stale env var, restarted worker, fixed.";
    const r = redact(note);
    expect(r.text).toBe(note);
    expect(r.findings).toEqual([]);
  });

  it('redacts emails and IPv4 addresses, but not version numbers', () => {
    const r = redact('user dev@example.com hit 10.0.3.14 on node 18.17.1 and 999.1.1.1');
    expect(r.text).toContain('[REDACTED_EMAIL]');
    expect(r.text).toContain('[REDACTED_IP]');
    expect(r.text).not.toContain('dev@example.com');
    expect(r.text).not.toContain('10.0.3.14');
    expect(r.text).toContain('18.17.1');
    expect(r.text).toContain('999.1.1.1');
  });

  it('redacts AWS access keys and secrets', () => {
    const r = redact('creds AKIAIOSFODNN7EXAMPLE and aws_secret_access_key=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY');
    expect(r.text).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(r.text).not.toContain('wJalrXUtnFEMI');
    expect(types(r.text + '')).toEqual([]); // idempotent: already-redacted text has nothing left
    expect(r.findings.map((f) => f.type)).toEqual(expect.arrayContaining(['aws_access_key', 'aws_secret_key']));
  });

  it('redacts JWTs and bearer tokens', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    const r = redact(`token in header Authorization: Bearer abc123def456ghi789 and cookie ${jwt}`);
    expect(r.text).not.toContain(jwt);
    expect(r.text).not.toContain('abc123def456ghi789');
    expect(r.text).toContain('Bearer [REDACTED_TOKEN]');
  });

  it('redacts vendor API keys (OpenAI, Groq, GitHub, Slack, Stripe, Google)', () => {
    // Fake fixtures, assembled at runtime so secret scanners don't flag the test file.
    const j = (...p: string[]) => p.join('');
    const input = [
      j('sk-', 'proj-', 'abcdefghijklmnopqrstuvwxyz123456'),
      j('gsk', '_', 'abcdefghijklmnopqrstuvwxyz0123'),
      j('gh', 'p_', 'abcdefghijklmnopqrstuvwxyz0123456789'),
      j('xo', 'xb-', '1234567890-abcdefghij'),
      j('sk', '_live_', 'abcdefghijklmnop1234'),
      j('AI', 'zaSyA', '1234567890abcdefghijklmnopqrstuv'),
    ].join(' ');
    const r = redact(input);
    for (const secret of input.split(' ')) expect(r.text).not.toContain(secret);
    expect(totalRedactions(r.findings)).toBe(6);
  });

  it('strips credentials from connection strings but keeps the host', () => {
    const r = redact('DATABASE_URL was postgres://admin:s3cr3tP4ss@db.internal:5432/app');
    expect(r.text).not.toContain('s3cr3tP4ss');
    expect(r.text).not.toContain('admin:');
    expect(r.text).toContain('postgres://[REDACTED_CREDENTIALS]@db.internal:5432/app');
  });

  it('redacts key=value credential assignments and spoken passwords', () => {
    const r = redact('set DB_PASSWORD=hunter22 and api_key: "zzz999" — also the password is correcthorse');
    expect(r.text).not.toContain('hunter22');
    expect(r.text).not.toContain('zzz999');
    expect(r.text).not.toContain('correcthorse');
    expect(r.text).toContain('DB_PASSWORD=[REDACTED]');
  });

  it('redacts PEM private keys', () => {
    const r = redact('-----BEGIN RSA PRIVATE KEY-----\nMIIEow\nabc\n-----END RSA PRIVATE KEY----- oops');
    expect(r.text).toBe('[REDACTED_PRIVATE_KEY] oops');
  });

  it('redacts generic high-entropy secrets but keeps git SHAs', () => {
    const sha = '3f786850e387550fdab836ed7e6dc881de23001b';
    const r = redact(`commit ${sha} leaked Xy7Kq9Lm2Np4Rs6Tv8Wz0Ab3Cd5Ef7Gh9Jk`);
    expect(r.text).toContain(sha);
    expect(r.text).toContain('[REDACTED_SECRET]');
  });

  it('edge-function copy is identical to src/lib/redact.ts (run `npm run sync-shared`)', () => {
    for (const f of ['redact.ts', 'structure.ts', 'types.ts']) {
      expect(readFileSync(`supabase/functions/_shared/${f}`, 'utf8')).toBe(readFileSync(`src/lib/${f}`, 'utf8'));
    }
  });
});
