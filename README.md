<div align="center">

<img src="docs/screenshots/landing-hero.jpg" alt="Déjà Vu landing page — a 3D memory constellation" width="100%" />

# Déjà Vu 🔁

**You've fixed this before. Déjà Vu remembers how.**
A voice-first memory for debugging — speak what you see while you debug; it remembers every session and stops you re-solving bugs you already solved.

[![Live demo](https://img.shields.io/badge/live%20demo-open-8b5cf6?style=for-the-badge)](https://aneek22112007-tech.github.io/deja-vu/)
[![App](https://img.shields.io/badge/app-try%20recall-34d399?style=for-the-badge)](https://aneek22112007-tech.github.io/deja-vu/#/app/recall)

![Tests](https://img.shields.io/badge/tests-33%20passing-34d399)
![Backend](https://img.shields.io/badge/backend-Supabase%20pgvector%20%2B%20Groq-3ecf8e)
![Embeddings](https://img.shields.io/badge/embeddings-gte--small%20384d-a78bfa)
![3D](https://img.shields.io/badge/landing-three.js%20%2B%20R3F-black)
![Voice](https://img.shields.io/badge/built%20with-Wispr%20Flow-8b5cf6)
![License](https://img.shields.io/badge/license-MIT-slate)

Built for the [WeMakeDevs × Wispr Flow “No Hands” hackathon](https://www.wemakedevs.org/wispr) — Builders track.

</div>

**Links:** [Landing page](https://aneek22112007-tech.github.io/deja-vu/) (3D scroll story) · [App → Recall](https://aneek22112007-tech.github.io/deja-vu/#/app/recall) (no sign-in) · `?demo=1` forces the in-browser demo.

The live site talks to a **real Supabase + Groq backend** (badge: `● Live: Supabase + Groq`). If that backend is unreachable — network error, timeout or 5xx — the app **automatically falls back** to the fully in-browser demo (badge: `● Demo mode`), so judges can always use it.

| Recall on the live backend | Graceful no-match | Mobile |
|---|---|---|
| ![recall](docs/screenshots/app-recall-live.png) | ![no match](docs/screenshots/app-recall-nomatch.png) | <img src="docs/screenshots/mobile-hero.png" width="220"/> |

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
  UI -->|VITE_SUPABASE_URL + ANON_KEY<br/>auto-fallback to demo if unreachable| CAP & REC
  subgraph Supabase
    CAP["Edge fn: capture"] -->|1 redact| CAP2["2 Groq gpt-oss-120b<br/>JSON mode structuring"] -->|3| EMB["Supabase.ai gte-small<br/>(384-d, free) — or OpenAI"] -->|4 insert| DB[("Postgres + pgvector<br/>sessions.embedding vector(384)<br/>HNSW index")]
    REC["Edge fn: recall"] -->|redact + embed| RPC["match_sessions(query_embedding,<br/>match_threshold 0.81, match_count)"] --> DB
    RPC --> EXP["Groq gpt-oss-120b: explain match<br/>hit count · cause · fix"]
    EXP -->|hit_count = 0| NM["strict gate → graceful no-match"]
  end
```

**Zero AWS. Zero cost:** Supabase free tier (Postgres + pgvector + Edge Functions + built-in `gte-small` embeddings) and the Groq free API. No OpenAI key needed.

### Redaction (runs before anything is structured, embedded or stored)
API keys (OpenAI `sk-`, Groq `gsk_`, Stripe, Google `AIza`), GitHub/Slack tokens, AWS access keys + secrets, JWTs, `Bearer`/`Basic` tokens, PEM private keys, `password=…`/`api_key: …` assignments, spoken secrets (*“the password is …”*), emails, IPv4/IPv6, connection-string credentials (`postgres://user:pass@host` → `postgres://[REDACTED_CREDENTIALS]@host`) and generic high-entropy strings (git SHAs are preserved). Groq output is redacted a second time. See [`src/lib/redact.ts`](src/lib/redact.ts) and its tests.

### Matching
- **Supabase mode:** `gte-small` cosine similarity via pgvector, hard threshold (default **0.81**, `MATCH_THRESHOLD` to tune; 0.45 for OpenAI), then Groq (`openai/gpt-oss-120b`) explains with a strict “never invent a fix” prompt and a hit count.
- **Strict LLM gate:** if vectors pass the threshold but Groq judges that *none* of the candidates is the same problem (e.g. a different bug in the same tech area), recall returns a graceful **no-match** instead of a wrong answer.
- **Recall UI** shows the top match plus only matches within **0.05** similarity of it; weaker ones are collapsed behind a toggle.
- **Demo mode:** two engines, switchable on the Recall screen:
  - `lexical` *(default, instant, zero download)* — 384-dim signed feature hashing over unigrams, bigrams and char-trigrams with a debugging synonym map (`bad gateway`≡`502`, `release`≡`deploy`, `OOM`≡`out of memory`…). Threshold **0.25**.
  - `neural` — `all-MiniLM-L6-v2` running in the browser via transformers.js (~23 MB, lazy-loaded from a CDN). Threshold **0.45**.
- Confidence bands are relative to the threshold (`high` / `medium` / `low`), always shown with the raw similarity.

---

## The landing page

![The memory constellation in motion](docs/screenshots/landing-hero.gif)

A scroll-driven three.js / react-three-fiber **memory constellation** that acts out the product: a voice waveform speaks, fires a pulse into a cloud of past sessions and lights up the nearest memory (and its repeat neighbour — “you've hit this twice”); every 4th utterance is a new bug, so the pulse fades out amber — the graceful no-match. Lenis + GSAP ScrollTrigger fly the camera through Capture → Structure → Recall → No-match. Bloom via postprocessing. The “Watch it recall” panel, the redaction panel and the JSON in “How it works” run the **real** engine code in the browser.

Performance: the 3D chunk is lazy-loaded on idle behind an SVG stand-in, DPR capped (1.5 desktop / 1 mobile), `PerformanceMonitor` drops DPR + bloom on slow devices, bloom off on mobile, `prefers-reduced-motion` renders one static frame with no smooth-scroll. Concept + references: [`docs/LANDING_INSPIRATION.md`](docs/LANDING_INSPIRATION.md).

| How it works (sticky scroll) | Live recall panel | Privacy / redaction |
|---|---|---|
| ![how](docs/screenshots/landing-how.jpg) | ![live](docs/screenshots/landing-live-recall.jpg) | ![privacy](docs/screenshots/landing-privacy.jpg) |

### App niceties
First-visit onboarding (3 guided steps), empty states, and keyboard shortcuts: <kbd>Alt</kbd>+<kbd>M</kbd> start/stop dictation · <kbd>/</kbd> focus input · <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> switch tabs · <kbd>?</kbd> shortcut sheet · <kbd>⌘/Ctrl</kbd>+<kbd>↵</kbd> save capture. Wispr Flow's hold-key dictation works in every input.

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
   npx supabase secrets set GROQ_MODEL=openai/gpt-oss-120b MATCH_THRESHOLD=0.81
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
| Edge functions | `GROQ_MODEL` | no | default `openai/gpt-oss-120b` |
| Edge functions | `EMBEDDING_PROVIDER` | no | `supabase` (default, gte-small, free) or `openai` |
| Edge functions | `OPENAI_API_KEY` | only if `openai` | uses `text-embedding-3-small` with `dimensions: 384` |
| Edge functions | `MATCH_THRESHOLD` | no | default 0.81 (gte-small) / 0.45 (openai) |
| Edge functions | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | auto | injected by Supabase; **never** put the service role key in the frontend |

### Security model (read this)
Déjà Vu is a **single-user personal tool**. For the hackathon demo, RLS is **enabled** but the `anon` role may `select`/`update`/`delete` rows so the static site works without sign-in; inserts and re-embeds happen only in the edge functions (service role), *after* redaction. Anyone with your project URL + anon key can read your sessions — for real use, add Supabase Auth, a `user_id` column, and `using (auth.uid() = user_id)` policies. The public GitHub Pages site uses the anon key against the live demo project (sample data only); never put real secrets in it, and never ship the service-role key to the frontend.

## Deploy

- **GitHub Pages (this repo):** the live site is the static build on the `gh-pages` branch, built with `npm run build:pages` (`base=/deja-vu/`) and a local, git-ignored `.env.production` holding `VITE_SUPABASE_URL` + the anon key (public by design). Without that file the build is pure Demo Mode. To automate with Actions, copy [`docs/github-pages-workflow.yml`](docs/github-pages-workflow.yml) to `.github/workflows/pages.yml` and set Pages → Source → *GitHub Actions*.
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
  lib/backend.ts       Backend interface: local (localStorage) | supabase | auto (live w/ fallback)
  landing/             3D landing page (Scene.tsx = R3F constellation, Lenis + GSAP)
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
