import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAutoBackend, splitMatches } from '../src/lib/backend';

const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
};

afterEach(() => vi.unstubAllGlobals());

describe('auto backend (live Supabase with in-browser fallback)', () => {
  it('is demo mode when no backend is configured', async () => {
    const b = createAutoBackend({ storage: mem() });
    expect(await b.ready).toBe('demo');
    expect(b.kind).toBe('local');
    expect((await b.recall('getting 502 bad gateway right after we deployed')).matched).toBe(true);
  });

  it('falls back to demo mode when the backend is unreachable at startup', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const b = createAutoBackend({ url: 'https://x.supabase.co', anonKey: 'anon', storage: mem() });
    expect(b.mode).toBe('connecting');
    expect(await b.ready).toBe('fallback');
    const r = await b.recall('users keep getting logged out on safari');
    expect(r.matched).toBe(true);
    expect(r.explainedBy).toBe('local');
  });

  it('uses the live backend when reachable, and falls back mid-session on a 5xx', async () => {
    const live = { query: 'q', matches: [], matched: false, confidence: 'none', hitCount: 0, threshold: 0.81, explainedBy: 'groq', explanation: 'No match' };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('[]', { status: 200 })) // probe
      .mockResolvedValueOnce(new Response(JSON.stringify(live), { status: 200 })) // recall #1
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'boom' }), { status: 503 })); // recall #2
    vi.stubGlobal('fetch', fetchMock);
    const b = createAutoBackend({ url: 'https://x.supabase.co', anonKey: 'anon', storage: mem() });
    expect(await b.ready).toBe('live');
    expect(b.kind).toBe('supabase');
    expect((await b.recall('anything')).explainedBy).toBe('groq');
    const r2 = await b.recall('getting 502 bad gateway right after we deployed');
    expect(b.mode).toBe('fallback');
    expect(r2.explainedBy).toBe('local');
    expect(r2.matched).toBe(true);
  });

  it('does not hide real 4xx errors behind the fallback', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('[]', { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'query is required' }), { status: 400 }));
    vi.stubGlobal('fetch', fetchMock);
    const b = createAutoBackend({ url: 'https://x.supabase.co', anonKey: 'anon', storage: mem() });
    await b.ready;
    await expect(b.recall('')).rejects.toThrow('query is required');
    expect(b.mode).toBe('live');
  });
});

describe('splitMatches (top match + matches within 0.05)', () => {
  it('keeps only close matches visible', () => {
    const { shown, hidden } = splitMatches([{ similarity: 0.896 }, { similarity: 0.862 }, { similarity: 0.813 }]);
    expect(shown.map((m) => m.similarity)).toEqual([0.896, 0.862]);
    expect(hidden.map((m) => m.similarity)).toEqual([0.813]);
  });
  it('handles empty input', () => {
    expect(splitMatches([])).toEqual({ shown: [], hidden: [] });
  });
});
