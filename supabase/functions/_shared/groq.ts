// Groq (OpenAI-compatible) JSON-mode helper. Free tier is plenty for a personal tool.
export const GROQ_MODEL = Deno.env.get('GROQ_MODEL') ?? 'openai/gpt-oss-120b';

export async function groqJSON<T>(system: string, user: string): Promise<T | null> {
  const key = Deno.env.get('GROQ_API_KEY');
  if (!key) return null; // caller falls back to the deterministic local path
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!r.ok) {
    console.error('groq error', r.status, await r.text());
    return null;
  }
  const j = await r.json();
  try {
    return JSON.parse(j.choices?.[0]?.message?.content ?? 'null') as T;
  } catch {
    return null;
  }
}
