# Dictating your 15–20 real incidents (seed data)

The app ships with 18 **sample** incidents so the demo works on first load. For the submission (and for it to actually be *your* memory), replace them with real bugs you've fixed — dictated, not typed.

## 1. Brain-dump the list (2 min)
Hold the Wispr key and list every bug you can remember fixing in the last year — just titles. Scan: on-call pages, your git log (`git log --author=you --grep=fix`), closed tickets, “ugh” Slack threads.

## 2. Dictate each one (≈1 min each)
Open `seed/my-incidents.md` (copy from `seed/my-incidents.example.md`). For each incident, hold the Wispr key and talk naturally, roughly in this order — **one paragraph per incident, blank line between them**:

> **What I saw** → **what I thought it was** (and that it wasn't) → **what it actually was** → **what fixed it**

Example (spoken, messy is good):
> ok so signup emails stopped arriving for gmail users — thought SendGrid was down, nope, status page green — turned out the SPF record didn't include the new mail provider, added the include in DNS, delivered within the hour.

Tips
- Say the *symptom the way you'd search for it later* (“502s after deploy”, not “the Tuesday thing”).
- Always mention what you **ruled out** — that's the part that saves the most time.
- Don't worry about secrets: the redaction pass strips keys, tokens, passwords, emails, IPs and connection-string credentials before storage. (Still, avoid reading real production secrets aloud.)
- Unsolved mystery? Dictate it anyway without a fix — it's stored as **open**.

## 3. Load them

**Supabase mode** (real pipeline: redact → Groq → embed → insert):
```bash
npm run seed -- --dry-run --file seed/my-incidents.md   # preview locally
npm run seed -- --file seed/my-incidents.md
```
Then delete the sample rows: `delete from sessions where sample = true;` in the Supabase SQL editor.

**Demo mode / live site:** paste each paragraph into **Capture** (or dictate it there directly — great B-roll for the video). To make your incidents the *default* demo data, replace the entries in `src/data/seed.ts` (keep the shape: `transcript, symptom, hypotheses_tried, root_cause, fix, tags, daysAgo`), set the file header to say they're real, and update `SAMPLE_SYMPTOMS` chips to symptoms that match your bugs (keep one no-match chip). Run `npm test` — the chip tests will tell you if a chip stopped matching.

## 4. Live captures
During the challenge, capture 2–3 bugs *as they happen* with Wispr. Mention them in the write-up and, ideally, in the video.
