---
name: Text & typography
description: On-screen text beyond captions — hierarchy, per-platform safe areas, kinetic type patterns, readability over busy footage, and animation selection.
---

# Text & typography

Follow the `build-in-kaestral` house rule. Two text systems exist: timeline text (`add_texts` /
`update_text` — captions, hooks, lower-thirds, CTAs over footage) and composed type
(`compose_motion` text layers — designed title/type beats). Captions specifically belong to
`caption-styles`; this skill is everything else text.

## Hierarchy (one screen = one primary message)
Sizes at 1080p height (scale linearly):
- **Display / hook:** 96–140px, bold — 3–7 words, the thing being said.
- **Support line:** 44–64px — context under a display line, never simultaneous with captions.
- **Label / lower-third:** name 44–52px + role 30–36px (`brand-kit` §3 recipe).
- **CTA:** 56–72px, boxed.
Levels on screen at once: TWO max (display + support, or display + caption). Three = noise.
In `compose_motion`, hierarchy is `style.role` ("display" / "accent" / "muted") + `style.size`
(display ≈ 0.09–0.14 of height) — the engine's type system already encodes this; use roles rather
than inventing sizes.

## Safe areas per platform (keep text INSIDE these)
- **9:16 (Reels/TikTok/Shorts):** bottom ~18% (UI + captions bar), right ~12% (action rail), top
  ~8% — so text lives in x 0.06–0.88, y 0.10–0.80. Hooks top-third (`centerY ≈ 0.18–0.25`),
  captions lower-middle (`centerY ≈ 0.78–0.82`).
- **16:9 (YouTube):** 5% margins all around; lower-thirds at `centerY ≈ 0.82–0.86`.
- **1:1 (feed):** 6–8% margins; center-weighted compositions win.
Set positions via the `transform` fields on `add_texts` entries (`centerX`/`centerY`/`width`).

## Readability over busy footage (pick ONE armor)
1. **Boxed** — `backgroundColor` filled box: strongest, most branded (accent box + white text).
2. **Outlined** — `borderColor` thick contrasting outline: survives anything, energetic look.
3. **Dimmed stage** — darken the footage under the text instead: `apply_color` exposure −0.4 on
   that segment, or a `compose_motion` `spotlightDim` layer for designed beats.
Never bare thin text over moving footage. White text: on footage always with armor. Test the worst
frame, not the best (`see_video` the text's time range).

## Choosing the animation (timeline `add_texts` `animation`)
- `popIn` — hooks, CTAs: confident arrival. The default for statements.
- `slideUp` — lower-thirds, labels: informational, calm.
- `wordPop` / `wordReveal` — spoken-word sync (see `caption-styles`).
- `typewriter` — suspense/quote reveal; needs its full read time, don't rush it off.
- `fadeIn` — the quiet option for support lines.
Off is a choice too: a held static line reads authoritative.
In `compose_motion`, the entrance set is richer (spring / blurPushUp / wordStagger / kinetic /
edgeFlip…) — selection logic lives in `shot-recipes` (openers, emphasis) and `art-direction` §3
(the physics of each); reuse ONE entrance language per piece.

## Kinetic type patterns (composed beats)
For a type-driven beat, three reliable shapes from `shot-recipes`: **Word-stagger emphasis** (each
word lands on its own spring — 3–6 word lines) · **Kinetic slam** (one oversized word, once) ·
**Blur push-up hook** (energetic 9:16 opener). Pair a display line with ONE accent element
(`hairline` underline or `strikethrough`) — not both.

## Micro-rules that read as craft
- Sentence case beats ALL CAPS for >4 words; caps are for 1–3 word slams.
- Numbers as digits ("90 sec", not "ninety seconds").
- One font family per piece; weight and size carry hierarchy (`style.font` "mono" is the one
  deliberate exception for technical flavor — `shot-recipes` Typewriter terminal).
- Text enters AFTER its footage moment establishes (6–10 frames), exits BEFORE the cut (never let
  a cut decapitate a line mid-read).
- Read-time budget: ~0.35s per word + 0.5s buffer; a 5-word line needs ≥2.25s on screen.

## Failure modes
- **Three hierarchy levels at once** — the screen becomes a poster nobody reads.
- **Safe-area violations** — a CTA under the TikTok caption bar was never seen.
- **Animation soup** — popIn + typewriter + slideUp in one piece; pick a language.
- **Best-frame testing** — armor chosen on the calm frame fails on the busy one.
- **Caps-lock paragraphs** — shouting isn't hierarchy.
