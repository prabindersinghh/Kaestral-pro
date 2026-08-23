---
name: Retention editing
description: Pacing for watch-through — cut cadence targets, micro-cuts up top, dead-air removal, emphasis punches, loop-friendly endings, and what to cut when it drags.
---

# Retention editing

Follow the `build-in-kaestral` house rule. Retention is pacing engineering: something must CHANGE
on screen before attention decays. The hook gets people in (`hook-engineering`); this skill keeps
them.

## Cadence targets (visual change per time — a cut, punch-in, text change, or B-roll counts)
- **Seconds 0–3:** change every 0.8–1.5s (2–3 micro-events inside the hook).
- **Seconds 3–15:** every 1.5–3s.
- **Beyond 15s:** every 2–4s talking-head; long-form explainers can breathe to 5–8s once trust is
  earned.
- Audit: `get_timeline` → walk clip/text boundaries; any gap over target = insert a change (punch,
  B-roll, caption emphasis) or cut the segment.

## The toolkit (cheapest change first)
1. **Dead-air removal** — `analyze_audio` silence ranges → `ripple_delete_ranges` every ≥0.6s
   pause (keep one deliberate pause per emotional beat — see `sound-design` on silence).
2. **Filler purge** — `remove_words` on um/uh/like/"you know" (`talking-head-cleanup` has the pass).
3. **Zoom punch on emphasis** — on key words (find them in the transcript): `set_keyframes` scale
   1.0→1.08–1.12 over 6–10 frames, hold, cut back at the next sentence — or a hard punch-in via
   `set_clip_properties` scale on a split segment. 2–4 per 30s; every sentence punched = none are.
4. **Jump-cut rhythm** — after silence removal, consecutive same-framing segments read as
   deliberate jump cuts; alternate wide/punched framings so cuts land visibly.
5. **Caption pulse** — word-timed captions ARE cadence (`caption-styles` word-pop); a caption
   style change (color/box) marks a section turn.
6. **B-roll relief** — cover a long explanation's middle with related footage (`broll-planner`);
   return to the face for the conclusion.

## What to cut when a section drags (in order)
1. The setup for a point that's understandable without it ("so basically, what happened was").
2. Repetition — the second phrasing of the same idea (keep the punchier one; transcript makes
   twins easy to spot).
3. Caveats and hedges ("obviously this depends") — one caveat max, at the end.
4. The middle of any list longer than three.
If it still drags: the section order is wrong — move the payoff earlier (`move_clips`), or the
section doesn't belong in this video.

## Endings (the last 2 seconds decide the loop)
- End INSIDE the last sentence's energy — cut within ~10 frames of the final word, never let the
  speaker deflate ("so… yeah").
- Loop-friendly: end on framing/motion that flows into the opening frame so autoplay-loop re-hooks
  (check first/last frames via the preview or `see_video`).
- CTA: one, short, spoken over action — not a 5s dead outro card. On 9:16, a text CTA in the last
  1.5s (`add_texts`) is enough.

## Worked example
A 42s clip retains badly. `get_timeline` audit: seconds 8–19 is ONE static clip, no text events.
Transcript shows the segment makes one point with two phrasings. Fix: `ripple_delete_ranges` the
second phrasing (−4s) → punch-in keyframe on the key phrase at ~10s → B-roll insert over ~12–15s →
caption color flips to accent on the section's key word. The 8–19 desert is now four changes; the
clip is 38s and faster where it sagged.

## Failure modes
- **Cutting on the clock, not the content** — cadence targets guide WHERE to look; every cut still
  needs a reason (a word, a beat, a reveal).
- **Punch inflation** — zoom on everything reads as noise in minutes.
- **Deleting every pause** — breathless robot pacing; deliberate pauses are emphasis
  (`sound-design`).
- **The trailing outro** — 5 seconds of "thanks for watching" is where retention graphs die; end
  hot.
