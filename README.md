# Déjà Vu 🔁 — voice-first memory for debugging

> **I speak what I'm seeing while I debug. Déjà Vu remembers every session forever and stops me from re-solving problems I already solved.**

**Live demo (no sign-in, works in 1 minute):** https://aneek22112007-tech.github.io/deja-vu/
Built for the [WeMakeDevs × Wispr Flow “No Hands” hackathon](https://www.wemakedevs.org/wispr) — Builders track.

![Recall: you've hit this twice](docs/screenshots/recall-match.png)

---

## The problem

Every week I lose 4+ hours re-debugging issues I've already fixed. The knowledge of *how* a bug was actually solved lives in dead Slack threads, closed tickets, or my own fading memory. Meeting-note tools capture what was said in meetings; AI assistants write new code; **nothing remembers the reasoning trail of my own past debugging sessions** — what I tried, what failed, what finally worked. When the same symptom reappears three months later, I start from zero.

**Who it's for:** me — a developer on frequent on-call rotations — and every engineer who has said *“I feel like we've fixed this before.”* Zoomed out, it's an institutional-memory problem wearing a personal-tool costume: teams lose this knowledge permanently when people leave.

## What it does — one loop: Capture → Recall

| Mode | What you do | What Déjà Vu does |
|---|---|---|
| **🎙 Capture** | Hold your Wispr Flow key mid-debug and mutter: *“ok, 502s after deploy — thought it was the LB, wasn't — stale env var, restarted worker, fixed.”* | **Redacts secrets first** → structures it into `{symptom, hypotheses_tried[], root_cause, fix, tags[], timestamp}` → embeds it → stores it. |
| **🧠 Recall** | Speak or type a symptom: *“getting 502s right after we deployed”* | Vector similarity over every past session + an LLM layer: *“You've hit this twice. Most likely cause: stale env var after deploy. Fix that worked: restart worker. Last time you ruled out: the load balancer.”* — with similarity score + confidence. |
| **🫥 No match** | Symptom you've never seen | Below a **hard similarity threshold** it refuses to guess: *“No match — filing this for future you.”* One click files it as an **open** session you resolve later — so next time it matches. |
| **🗂 Memory** | Browse the timeline | View, edit, delete, mark resolved/open. Stats: sessions saved, recalls, matches, estimated hours saved. |

### Why it's different
Pieces, Copilot and mem.ai store code snippets and chat threads. **Nobody stores the spoken reasoning of debugging itself** — including the hypotheses that *didn't* pan out — and matches new symptoms against it.

### Non-goals (scope lock)
No IDE plugin · no auto-fix agent · no Slack integration · no external search. Two weeks, one loop.

---

## Architecture

```mermaid
flowchart LR
  subgraph Browser["Static frontend (Vite + React + TS + Tailwind)"]
    W["🎙 Wispr Flow<br/>(hold-key dictation into any textbox)"] --> UI
    M["Web Speech API mic<br/>(fallback for judges)"] --> UI
    UI["Capture / Recall / Memory"]
    UI -->|no env vars| DEMO
    subgraph DEMO["Demo Mode — 100% in-browser"]
      R1["redact()"] --> S1["structureLocally()<br/>deterministic heuristic"] --> E1["embed()<br/>384-d hashed n-grams<br/>or MiniLM via transformers.js"] --> LS[("localStorage")]
    end
  end
  UI -->|VITE_SUPABASE_URL + ANON_KEY| CAP & REC
  subgraph Supabase
    CAP["Edge fn: capture"] -->|1 redact| CAP2["2 Groq llama-3.3-70b<br/>JSON mode structuring"] -->|3| EMB["Supabase.ai gte-small<br/>(384-d, free) — or OpenAI"] -->|4 insert| DB[("Postgres + pgvector<br/>sessions.embedding vector(384)<br/>HNSW index")]
    REC["Edge fn: recall"] -->|redact + embed| RPC["match_sessions(query_embedding,<br/>match_threshold, match_count)"] --> DB
    RPC --> EXP["Groq: explain match<br/>hit count · cause · fix"]
  end
```

**Zero AWS. Zero cost:** Supabase free tier (Postgres + pgvector + Edge Functions + built-in `gte-small` embeddings) and the Groq free API. No OpenAI key needed.

### Redaction (runs before anything is structured, embedded or stored)
API keys (OpenAI `sk-`, Groq `gsk_`, Stripe, Google `AIza`), GitHub/Slack tokens, AWS access keys + secrets, JWTs, `Bearer`/`Basic` tokens, PEM private keys, `password=…`/`api_key: …` assignments, spoken secrets (*“the password is …”*), emails, IPv4/IPv6, connection-string credentials (`postgres://user:pass@host` → `postgres://[REDACTED_CREDENTIALS]@host`) and generic high-entropy strings (git SHAs are preserved). Groq output is redacted a second time. See [`src/lib/redact.ts`](src/lib/redact.ts) and its tests.

### Matching
- **Supabase mode:** `gte-small` cosine similarity via pgvector, hard threshold (default **0.82**, `MATCH_THRESHOLD` to tune; 0.45 for OpenAI), then Groq explains with a strict “never invent a fix” prompt and a hit count.
- **Demo mode:** two engines, switchable on the Recall screen:
  - `lexical` *(default, instant, zero download)* — 384-dim signed feature hashing over unigrams, bigrams and char-trigrams with a debugging synonym map (`bad gateway`≡`502`, `release`≡`deploy`, `OOM`≡`out of memory`…). Threshold **0.25**.
  - `neural` — `all-MiniLM-L6-v2` running in the browser via transformers.js (~23 MB, lazy-loaded from a CDN). Threshold **0.45**.
- Confidence bands are relative to the threshold (`high` / `medium` / `low`), always shown with the raw similarity.

---

## Quick start (Demo Mode — no keys)

```bash
git clone https://github.com/aneek22112007-tech/deja-vu && cd deja-vu
npm install
npm run dev        # http://localhost:5173  — demo mode, pre-seeded with SAMPLE incidents
npm test           # vitest: redaction, similarity/threshold, structuring, end-to-end local flow
npm run build      # production build -> dist/
```

> ⚠️ The 18 pre-seeded incidents in [`src/data/seed.ts`](src/data/seed.ts) are **sample data**, flagged `sample: true` and badged “sample” in the UI. Replace them with your own — see [`docs/SEED_TEMPLATE.md`](docs/SEED_TEMPLATE.md).

Add `?demo=1` to any URL to force Demo Mode even when Supabase is configured.

## Full setup (Supabase + Groq)

1. **Create a Supabase project** (free) → copy the *Project URL* and *anon / publishable key* (Settings → API).
2. **Get a Groq key** (free) at https://console.groq.com/keys.
3. **Install the Supabase CLI** and link:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push                                   # runs supabase/migrations/*.sql
   npx supabase secrets set GROQ_API_KEY=gsk_...          # required for LLM structuring/explanations
   # optional:
   npx supabase secrets set GROQ_MODEL=llama-3.3-70b-versatile MATCH_THRESHOLD=0.82
   npx supabase functions deploy capture
   npx supabase functions deploy recall
   ```
4. **Frontend env** — copy `.env.example` → `.env`:
   ```bash
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon or publishable key>
   ```
5. **Seed** through the real pipeline: `npm run seed` (samples) or `npm run seed -- --file seed/my-incidents.md` (yours). `npm run seed -- --dry-run` shows redaction + structuring without touching the network.

### Environment variables

| Where | Variable | Required | Notes |
|---|---|---|---|
| Frontend (Vite) | `VITE_SUPABASE_URL` | for Supabase mode | Absent ⇒ Demo Mode |
| Frontend (Vite) | `VITE_SUPABASE_ANON_KEY` | for Supabase mode | anon/publishable key — public by design |
| Seed script | `SUPABASE_URL`, `SUPABASE_ANON_KEY` | for `npm run seed` | falls back to the `VITE_` versions |
| Edge functions | `GROQ_API_KEY` | recommended | without it, functions fall back to the local heuristic / template explanation |
| Edge functions | `GROQ_MODEL` | no | default `llama-3.3-70b-versatile` |
| Edge functions | `EMBEDDING_PROVIDER` | no | `supabase` (default, gte-small, free) or `openai` |
| Edge functions | `OPENAI_API_KEY` | only if `openai` | uses `text-embedding-3-small` with `dimensions: 384` |
| Edge functions | `MATCH_THRESHOLD` | no | default 0.82 (gte-small) / 0.45 (openai) |
| Edge functions | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | auto | injected by Supabase; **never** put the service role key in the frontend |

### Security model (read this)
Déjà Vu is a **single-user personal tool**. For the hackathon demo, RLS is **enabled** but the `anon` role may `select`/`update`/`delete` rows so the static site works without sign-in; inserts and re-embeds happen only in the edge functions (service role), *after* redaction. Anyone with your project URL + anon key can read your sessions — for real use, add Supabase Auth, a `user_id` column, and `using (auth.uid() = user_id)` policies. The public GitHub Pages demo runs in Demo Mode, so it never touches a database.

## Deploy

- **GitHub Pages (this repo):** the live demo is the static Demo-Mode build on the `gh-pages` branch. `npm run build:pages` builds with `base=/deja-vu/`. To automate with Actions, copy [`docs/github-pages-workflow.yml`](docs/github-pages-workflow.yml) to `.github/workflows/pages.yml` and set Pages → Source → *GitHub Actions*.
- **Vercel:** import the repo → framework *Vite* → build `npm run build`, output `dist` → add `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (or leave empty for Demo Mode).
- **Netlify:** build `npm run build`, publish `dist` (a `netlify.toml` is included).

## Project layout

```
src/
  lib/redact.ts        secret redaction (shared with edge functions)
  lib/structure.ts     deterministic spoken-note → JSON heuristic (shared)
  lib/embed.ts         384-d hashed n-gram embedder + cosine
  lib/neural.ts        optional in-browser MiniLM (transformers.js)
  lib/match.ts         threshold, confidence, ranking, local explanation
  lib/backend.ts       Backend interface: local (localStorage) | supabase
  components/          Capture, Recall, Memory, UI bits
  data/seed.ts         SAMPLE incidents + recall chips
supabase/
  migrations/          sessions table, HNSW index, match_sessions RPC, RLS
  functions/capture    redact → Groq structure → embed → insert (and edit/re-embed)
  functions/recall     redact → embed → match_sessions → Groq explanation
scripts/seed.ts        seed via the capture pipeline
tests/                 vitest
docs/                  DEMO_SCRIPT.md · SUBMISSION.md · SEED_TEMPLATE.md
```

## How Wispr Flow was used

> ✍️ **TODO (Aneek): fill this in with what you actually dictated.** Draft from the plan:

Product requirements, all LLM prompts, edge cases, the structured-note schema, the seed data (my real bugs, spoken from memory), docs, commit notes and the demo script were dictated through Wispr Flow. The product's own input is my voice: every Capture in the demo is a Wispr hold-key dictation straight into the textbox.

- [ ] Real incidents dictated: __ / 15–20
- [ ] Live captures recorded during the challenge: __
- [ ] Prompts dictated: capture structuring, recall explanation
- [ ] Wispr usage card screenshot: `docs/wispr-usage.png`

## License
MIT © Aneek Das
