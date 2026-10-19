// Embeddings for the edge functions.
//  - default: Supabase.ai built-in gte-small (384 dims, free, no API key)
//  - EMBEDDING_PROVIDER=openai: text-embedding-3-small truncated to 384 dims (needs OPENAI_API_KEY)

declare const Supabase: {
  ai: { Session: new (model: string) => { run(input: string, opts: { mean_pool: boolean; normalize: boolean }): Promise<number[]> } };
};

export const EMBEDDING_PROVIDER = (Deno.env.get('EMBEDDING_PROVIDER') ?? 'supabase').toLowerCase();

let gte: { run(input: string, opts: { mean_pool: boolean; normalize: boolean }): Promise<number[]> } | null = null;

export async function embed(text: string): Promise<number[]> {
  if (EMBEDDING_PROVIDER === 'openai') {
    const key = Deno.env.get('OPENAI_API_KEY');
    if (!key) throw new Error('EMBEDDING_PROVIDER=openai but OPENAI_API_KEY is not set');
    const r = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: text, dimensions: 384 }),
    });
    if (!r.ok) throw new Error(`OpenAI embeddings failed: ${r.status} ${await r.text()}`);
    const j = await r.json();
    return j.data[0].embedding as number[];
  }
  gte ??= new Supabase.ai.Session('gte-small');
  const out = await gte.run(text, { mean_pool: true, normalize: true });
  return Array.from(out);
}

/** Same weighting as the in-browser demo: symptom counts double (recall queries look like symptoms). */
export const sessionEmbeddingText = (s: { symptom: string; root_cause?: string; tags?: string[] }) =>
  [s.symptom, s.symptom, s.root_cause ?? '', (s.tags ?? []).join(' ')].join(' . ');

/** gte-small similarities are compressed into the high range, so its threshold is higher. Override with MATCH_THRESHOLD. */
export const DEFAULT_THRESHOLD = Number(Deno.env.get('MATCH_THRESHOLD') ?? (EMBEDDING_PROVIDER === 'openai' ? 0.45 : 0.82));
