# Déjà Vu — demo video script (≤ 2:00)

**Setup before recording:** Wispr Flow running · app open on the live URL (or Supabase-backed build) · Recall tab · browser zoom 110% · notifications off. Record screen + mic. Everything typed on screen is **dictated via Wispr Flow** — keep the Wispr indicator visible.

| Time | On screen | Voice-over (say it, don't read it) |
|---|---|---|
| **0:00–0:12** | Title card / app header | “Every week I lose four hours re-debugging bugs I've *already fixed*. The fix lives in a dead Slack thread or my fading memory. Déjà Vu is a voice-first memory for debugging.” |
| **0:12–0:40** | **Capture** tab. Hold Wispr key, dictate into the box: *“ok, image uploads failing with 413 on prod — thought it was the S3 bucket policy, nope — nginx client max body size was one meg, bumped it to twenty, fixed. Test login was dev at example dot com.”* → **Remember this** | “Mid-debug I just hold my Wispr key and mutter. Déjà Vu redacts secrets first — see, the email is gone — then structures it: symptom, what I tried and ruled out, root cause, fix, tags. Then it's embedded.” |
| **0:40–1:05** | **Recall** tab. Click chip **“502s after deploy”** | “Three months later: 502s after a deploy. Instead of starting from zero…” *(result appears)* “…‘You've hit this **twice**. Most likely cause: stale env var. Fix that worked: restart the workers. Last time you ruled out the load balancer — skip it.’ With the similarity score and confidence.” |
| **1:05–1:20** | Hold Wispr key in Recall box: *“file uploads return 413 entity too large”* → Recall | “And the thing I captured thirty seconds ago is already recallable.” |
| **1:20–1:38** | Click chip **🚫 no-match demo** → **File as open session** | “The important part: it doesn't hallucinate. Below a hard similarity threshold it says ‘No match — filing this for future you’, and one click saves it as an open session I resolve later.” |
| **1:38–1:50** | **Memory** tab, expand an item, show stats strip | “Everything lives on a timeline — edit, resolve, delete — and it tracks recalls, matches and hours saved.” |
| **1:50–2:00** | README architecture diagram / Wispr usage card | “Supabase pgvector, Groq, free embeddings, zero AWS. The requirements, prompts, seed bugs and this script were all dictated with Wispr Flow. Stop re-solving solved bugs.” |

**Tips**
- Do one dry run; keep total under 1:55 to be safe.
- If using the Supabase build, the badge shows `● Live: Supabase + Groq` and results say `explained by groq` — show that for 1 second.
- If anything is slow, cut during edit; don't narrate the wait.
