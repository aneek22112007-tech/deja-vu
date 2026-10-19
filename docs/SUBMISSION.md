# Submission draft — WeMakeDevs × Wispr Flow “No Hands” (Builders track)

> Deadline: **30 Oct 2026, 11:59 PM IST**. Required: working project link · ≤2 min demo video · Wispr usage card · short write-up.

**Project name:** Déjà Vu
**One-liner:** A voice-first personal memory for debugging. I speak what I'm seeing while I debug; Déjà Vu remembers every session forever and stops me from re-solving problems I already solved.
**Working link:** https://aneek22112007-tech.github.io/deja-vu/ (no sign-in; Demo Mode runs fully in the browser)
**Repo:** https://github.com/aneek22112007-tech/deja-vu
**Demo video:** _<paste link>_
**Wispr usage card:** _<attach screenshot>_

---

### Problem (in my own work)
Every week I lose 4+ hours re-debugging issues I've already fixed. How a bug was *actually* solved lives in dead Slack threads, closed tickets, or my own fading memory. Meeting-note tools capture meetings; AI assistants write new code; nothing remembers the reasoning trail of my own past debugging sessions — what I tried, what failed, what finally worked. When the same symptom reappears three months later, I start from zero.

### Who it's for
Me — a developer on frequent on-call rotations — and every engineer who has said “I feel like we've fixed this before.” It's an institutional-memory problem wearing a personal-tool costume: teams lose this knowledge permanently when people leave.

### What I built
- **Capture:** hold the Wispr key mid-debug and mutter (“502s after deploy — thought it was the LB, wasn't — stale env var, restarted worker, fixed”). Déjà Vu redacts secrets first, structures it into `{symptom, hypotheses_tried, root_cause, fix, tags, timestamp}` with Groq (llama-3.3-70b, JSON mode), embeds it (Supabase gte-small, 384-d) and stores it in Postgres + pgvector.
- **Recall:** speak or type a symptom. pgvector similarity + an LLM layer answer: “You've hit this twice. Most likely cause: stale env var after deploy. Fix that worked: restart worker” — with similarity score and confidence. Below a hard threshold: “No match — filing this for future you,” and one click files it as an open session.
- **Memory timeline** with edit/resolve/delete and stats (sessions, recalls, matches, est. hours saved).
- **Judge-friendly Demo Mode:** with no backend configured it runs 100% in-browser (localStorage, local structuring heuristic, local embeddings — instant lexical or neural MiniLM via transformers.js).

### Why it's different
Existing memory tools (Pieces, Copilot, mem.ai) store code snippets and chats. Déjà Vu stores the **spoken reasoning of debugging** — including the dead ends — and matches new symptoms against it. Deliberately outside saturated categories (meeting summarizers, CRM follow-ups, email triage).

### How Wispr Flow was used  ✍️ *(edit to match reality before submitting)*
Wispr is both how I built it and how the product is used:
- **Building:** product requirements, every LLM prompt (structuring + match explanation), edge cases, the structured-note schema, docs, commit notes and this demo script were dictated with Wispr Flow.
- **Data:** my __ real past incidents were dictated from memory as messy spoken notes and seeded through the real capture pipeline (`npm run seed -- --file seed/my-incidents.md`).
- **Product input:** Capture and Recall take Wispr hold-key dictation straight into the textbox — the product's own input is my voice. (A browser mic button exists only as a fallback for judges without Wispr.)

### Stack
Wispr Flow · Vite + React + TypeScript + Tailwind · Supabase (Postgres + pgvector + Edge Functions + built-in gte-small embeddings) · Groq free API (llama-3.3-70b-versatile) · optional OpenAI text-embedding-3-small · transformers.js for the in-browser demo. Zero AWS, zero cost.

### Scope lock / non-goals
No IDE plugin · no auto-fix agent · no Slack integration · no external search. One loop: Capture → Recall.

### Risks & mitigations
- Cold start → Capture works from day one; Recall pre-seeded with real bugs.
- Wrong matches → hard similarity threshold + confidence score + graceful no-match filing.
- Privacy → redaction pass before anything is structured, embedded or stored (and a second pass over LLM output).
- “Memory tools exist” → we store spoken debugging *reasoning*, not snippets/chats.
