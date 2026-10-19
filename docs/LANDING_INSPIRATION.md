# Landing page — concept & inspiration

## The concept: a living "memory constellation"

The hero is a real-time three.js / react-three-fiber scene that *acts out the product*:

1. **Voice → waveform.** A glowing violet→emerald ribbon "speaks" every ~7 s (three layered Line2 ribbons, amplitude driven by a speech envelope) — that's Capture via Wispr Flow.
2. **Pulse → memory.** When the utterance ends, a light pulse with a particle trail arcs (quadratic Bézier) out of the waveform into the constellation.
3. **Recall = a node lights up.** Each of the 22 nodes is a past debugging session. The pulse lands on one, it flares emerald with an expanding ring, its edges light up — and its nearest neighbour lights at 60 % ("you've hit this *twice*").
4. **No-match.** Every 4th utterance is a novel bug: the pulse drifts into empty space, turns amber and fades — the graceful "No match — filing this for future you".
5. **Scroll = story.** Lenis smooth-scroll + GSAP ScrollTrigger drive the camera through five keyframes (hero → waveform close-up for *Capture* → orbit for *Structure* → into the cluster for *Recall* → pull-back for the CTA) while copy reveals with fade/rise/blur. Pointer adds gentle parallax.

Everything else on the page is *real product code running live*: the "Watch it recall" panel runs the actual recall engine on the sample memory; the privacy panel runs the actual `redact()`; the JSON in "How it works" is the actual `structureLocally()` output.

**Performance budget:** the 3D chunk (three + R3F + postprocessing) is lazy-loaded on `requestIdleCallback` after the text paints; an SVG constellation stands in until then (and permanently if WebGL is missing). DPR capped at 1.5 (1 on mobile), `PerformanceMonitor` drops DPR and bloom if FPS declines, bloom is off on mobile, `prefers-reduced-motion` renders a single static frame (`frameloop="demand"`), no Lenis, no reveals.

## Inspiration (researched Oct 2026)

| Reference | What we took from it |
|---|---|
| **[Tabasco — Hilo Studio](https://hilostudiolab.com/en/projects/tabasco)** (Awwwards Honorable Mention, Jul 2026) — R3F + GSAP ScrollTrigger + Lenis, "the scroll is the timeline" | The exact stack and the idea that scroll position *is* the narrative (Capture → Structure → Recall → No-match), with Lenis so the 3D never jumps. |
| **[TIDE — WebDev2026](https://github.com/jimbo111/WebDev2026)** (the "tide" scroll-driven three.js site) | One fixed WebGL canvas behind the whole page, glass info cards floating over it, depth/zone labels as eyebrows, DPR capped at 2 → we cap lower. |
| **[Memory Monitor](https://github.com/cdeust/memory-monitor)** & **[Digital Brain](https://github.com/SahilK-027/Digital-Brain)** — neural memory graphs with bloom, synaptic flow particles | Memories as glowing nodes with additive halos, k-nearest-neighbour "synapse" edges, bloom + vignette post-processing, ambient dust. |
| **[Mnemoverse spatial memory design language](https://mnemoverse.com/docs/vision/design-language)** | Every visual must *mean* a system concept: pulse = query embedding, lit node = nearest neighbour above threshold, amber fade = below threshold. |
| **[Linear](https://kage.design/designs/linear-landing-page)** / **[Raycast](https://kage.design/designs/raycast-landing-page)** landing analyses | Near-black canvas, one neo-grotesque (Inter) with tight −0.04em display tracking, hairline `white/8%` borders instead of shadows, colour as an event (violet/emerald only), white pill primary CTA, keycap motif (`fn` = Wispr), real product UI as the hero visual. |
| **[Awwwards — Arkade London audio-reactive art](https://www.awwwards.com/sites/arkade-london-audio-reactive-art)** (SOTD) | Waveform-reactive visuals: the ribbon amplitude is the "voice" that drives the scene. |
| Dribbble: "AI 3D Landing Page" shots (e.g. Pixelux by Orenji Studio) | Big two-line headline left, 3D object right, gradient-shimmer accent line, glowing primary button. |
