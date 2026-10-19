/**
 * OPTIONAL in-browser neural embeddings for Demo Mode: all-MiniLM-L6-v2 (384 dims) via transformers.js.
 * Loaded lazily from a CDN only when the user switches the engine to "neural" (~23 MB, cached by the browser).
 * The default lexical engine (embed.ts) needs no download at all.
 */
const TRANSFORMERS_CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js';
export const MINILM_MATCH_THRESHOLD = 0.45;

type Extractor = (t: string, o: { pooling: 'mean'; normalize: boolean }) => Promise<{ data: Float32Array }>;
let extractor: Promise<Extractor> | null = null;
const cache = new Map<string, number[]>();

export function loadNeural(onProgress?: (pct: number) => void): Promise<Extractor> {
  extractor ??= (async () => {
    const mod = await import(/* @vite-ignore */ TRANSFORMERS_CDN);
    return (await mod.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      dtype: 'q8',
      progress_callback: (p: { status: string; progress?: number }) => p.status === 'progress' && p.progress != null && onProgress?.(p.progress),
    })) as Extractor;
  })().catch((e) => {
    extractor = null;
    throw e;
  });
  return extractor;
}

export async function neuralEmbed(text: string): Promise<number[]> {
  const hit = cache.get(text);
  if (hit) return hit;
  const ext = await loadNeural();
  const out = Array.from((await ext(text, { pooling: 'mean', normalize: true })).data);
  cache.set(text, out);
  return out;
}

export type Engine = 'lexical' | 'neural';
const KEY = 'dejavu.engine';
export const getEngine = (): Engine => {
  try {
    return localStorage.getItem(KEY) === 'neural' ? 'neural' : 'lexical';
  } catch {
    return 'lexical';
  }
};
export const setEngine = (e: Engine) => {
  try {
    localStorage.setItem(KEY, e);
  } catch {
    /* ignore */
  }
};
