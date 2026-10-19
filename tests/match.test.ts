import { describe, expect, it } from 'vitest';
import { cosine, embed, EMBED_DIMS } from '../src/lib/embed';
import { confidenceFor, LOCAL_MATCH_THRESHOLD, rankSessions, recallLocal } from '../src/lib/match';
import { buildSeedSessions, createLocalBackend } from '../src/lib/backend';
import { SAMPLE_SYMPTOMS } from '../src/data/seed';
import { structureLocally } from '../src/lib/structure';

const seeds = buildSeedSessions(Date.parse('2026-10-19T00:00:00Z'));

describe('embedding + cosine', () => {
  it('produces normalised 384-dim deterministic vectors', () => {
    const a = embed('502 bad gateway after deploy');
    expect(a).toHaveLength(EMBED_DIMS);
    expect(cosine(a, a)).toBeCloseTo(1, 6);
    expect(embed('502 bad gateway after deploy')).toEqual(a);
  });
  it('is robust to synonyms (bad gateway == 502, release == deploy)', () => {
    expect(cosine(embed('502s after deploy'), embed('bad gateway after the release'))).toBeGreaterThan(0.6);
  });
  it('handles zero / mismatched vectors safely', () => {
    expect(cosine([], [])).toBe(0);
    expect(cosine([0, 0], [0, 0])).toBe(0);
    expect(cosine([1, 0], [1, 0, 0])).toBe(0);
  });
});

describe('threshold + confidence', () => {
  it('maps similarity to confidence bands', () => {
    const t = 0.25;
    expect(confidenceFor(0.2, t)).toBe('none');
    expect(confidenceFor(0.26, t)).toBe('low');
    expect(confidenceFor(0.4, t)).toBe('medium');
    expect(confidenceFor(0.7, t)).toBe('high');
  });
  it('rankSessions drops everything below the hard threshold and sorts desc', () => {
    const q = embed('websocket disconnects every minute');
    const all = rankSessions(q, seeds, -1, 50);
    const above = rankSessions(q, seeds, LOCAL_MATCH_THRESHOLD, 50);
    expect(all.length).toBe(seeds.length);
    expect(above.length).toBeLessThan(all.length);
    expect(above.every((m) => m.similarity >= LOCAL_MATCH_THRESHOLD)).toBe(true);
    for (let i = 1; i < above.length; i++) expect(above[i - 1].similarity).toBeGreaterThanOrEqual(above[i].similarity);
  });
});

describe('recall over sample data', () => {
  for (const chip of SAMPLE_SYMPTOMS) {
    it(`chip "${chip.label}" ${chip.expectMatch ? 'matches' : 'gracefully does not match'}`, () => {
      const r = recallLocal(chip.query, seeds);
      expect(r.matched).toBe(chip.expectMatch);
      if (!chip.expectMatch) expect(r.explanation).toMatch(/^No match — filing this for future you/);
    });
  }
  it('the 502 symptom is recognised as a repeat (hit twice) with the stale-env-var fix', () => {
    const r = recallLocal('getting 502 bad gateway right after we deployed', seeds);
    expect(r.hitCount).toBe(2);
    expect(r.explanation).toMatch(/You've hit this twice/);
    expect(r.likelyCause?.toLowerCase()).toContain('environment variable');
    expect(r.fixThatWorked?.toLowerCase()).toContain('restart');
  });
  it('unrelated queries stay below threshold', () => {
    for (const q of ['how do I center a div', 'my cat is sick', 'kafka consumer lag growing']) expect(recallLocal(q, seeds).matched).toBe(false);
  });
});

describe('structuring heuristic', () => {
  it('structures the canonical spoken note', () => {
    const n = structureLocally("ok, 502s after deploy — thought it was the LB, wasn't — stale env var, restarted worker, fixed.");
    expect(n.symptom).toBe('502s after deploy');
    expect(n.hypotheses_tried).toEqual([{ text: 'the LB', ruled_out: true }]);
    expect(n.root_cause).toBe('Stale env var');
    expect(n.fix).toBe('Restarted worker');
    expect(n.tags).toContain('deploy');
  });
  it('leaves root_cause/fix empty for an unsolved symptom', () => {
    const n = structureLocally('Postgres CPU pegged at 100 percent every night at 2am');
    expect(n.fix).toBe('');
    expect(n.root_cause).toBe('');
  });
});

describe('local backend end-to-end (capture -> recall -> no-match -> file open -> resolve)', () => {
  const mem = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
  };
  it('works', async () => {
    const b = createLocalBackend(mem());
    expect((await b.list()).length).toBe(18);

    const cap = await b.capture('Image uploads fail with 413 on prod. Thought S3 policy, nope. Turns out nginx client_max_body_size was 1m. Bumped it to 20m, fixed. login was dev@example.com password=hunter22');
    expect(cap.session.raw_transcript_redacted).not.toContain('hunter22');
    expect(cap.session.raw_transcript_redacted).not.toContain('dev@example.com');
    expect(cap.session.status).toBe('resolved');

    const hit = await b.recall('uploads failing with 413 request entity too large');
    expect(hit.matched).toBe(true);
    expect(hit.matches[0].session.id).toBe(cap.session.id);

    const miss = await b.recall('bluetooth printer prints mirrored receipts');
    expect(miss.matched).toBe(false);
    const filed = await b.capture(miss.query, { status: 'open' });
    expect(filed.session.status).toBe('open');

    await b.update(filed.session.id, { root_cause: 'printer driver DPI setting', fix: 'switched driver to portrait mode', status: 'resolved' });
    const again = await b.recall('bluetooth printer prints mirrored receipts');
    expect(again.matched).toBe(true);
    expect(again.fixThatWorked).toContain('portrait');

    await b.remove(filed.session.id);
    expect((await b.list()).length).toBe(19);
  });
});
