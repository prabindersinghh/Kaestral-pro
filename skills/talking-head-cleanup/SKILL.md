---
name: Talking-head cleanup
description: The standard creator pass, as one ordered pipeline — fillers, silence jump-cuts, breaths, framing, captions, light grade — with sensible defaults.
---

# Talking-head cleanup

Follow the `build-in-kaestral` house rule. This is the bread-and-butter pass that turns a raw
face-to-camera recording into a clean, publishable talking head. Run the stages IN ORDER — each
depends on the previous one's timeline state.

## Stage 0 — Perceive
`get_timeline` → `get_transcript` (the word map; also skim for content problems worth flagging) →
`analyze_audio` (silence ranges) → `see_video` mode:"interval" (framing, exposure, background).

## Stage 1 — Filler purge (`remove_words`)
- Targets: um, uh, er, "like" (the verbal tic only — NOT "I like this"), "you know", "sort of",
  "basically" (when sentence-initial), restarted sentences (cut the false start, keep the retake).
- Read each candidate IN CONTEXT from the transcript before cutting — meaning-bearing instances stay.
- `cutAggressiveness`: "balanced" default; "tight" for fast-paced shorts; "loose" for relaxed
  long-form.
- Expect to remove 4–10% of duration on an average unscripted take.

## Stage 2 — Silence jump-cuts
`ripple_delete_ranges` every silence ≥0.6s (from Stage 0's ranges), EXCEPT: one deliberate pause
before the key line (emphasis — `sound-design`), and pauses that carry a visible reaction. After
this pass the cuts read as intentional jump-cut rhythm (`retention-editing` §toolkit).

## Stage 3 — Breaths
Loud inhales at cut points survive Stages 1–2 because they're short. Where the waveform/transcript
shows a gasp right at a jump cut: extend the cut by 3–5 frames (`ripple_delete_ranges` the breath
frames). Don't chase every breath — only the ones cuts made prominent. (There is no de-breath
audio filter; removal is by cutting frames, honestly stated.)

## Stage 4 — Framing correction
- Center-crop and size for the target aspect: `apply_layout` full+fill, then `set_clip_properties`
  transform so eyes sit ~1/3 from the top; headroom small; face 25–40% of frame height (9:16).
- Fix a static off-center camera with one transform for the whole clip. Alternate a 1.0 and a
  ~1.1-scale framing across jump cuts for the classic two-shot feel (per-segment transforms after
  splits).

## Stage 5 — Captions
`add_captions` wordsPerCaption 3 (2 for very fast speech), styled per `caption-styles` (word-pop
default), lower-middle for 9:16 / lower-third for 16:9. Spot-check 3 random captions against the
audio for sync.

## Stage 6 — Light grade
Defaults that flatter webcam/phone footage: `apply_color`
{exposure: +0.2–0.4, contrast: 1.05–1.08, saturation: 1.05–1.1, temperature: toward 6500 if the
source reads cold/green}. If a `brand-kit` grade preset exists, use it instead. Restraint: a
cleanup grade should be invisible (`color-storytelling` on when to go further).

## Stage 7 — Verify + export
`get_timeline` sanity (no zero-length clips, captions don't overlap), preview the first 5s and one
mid-section, then `export_project` per `platform-delivery` settings. Report to the user: duration
before → after, fillers removed, cuts made.

## Failure modes
- **Stages out of order** — captioning before cutting orphans captions mid-air; grade-first wastes
  a pass when framing changes exposure needs. The order is the skill.
- **Over-tight Stage 1+2** — a human breathes; keep the deliberate pauses or it reads robotic.
- **Cutting "like" blindly** — half of them are the verb. Context first.
- **The invisible-work trap** — cleanup looks like "nothing happened"; the before/after numbers in
  the report are how the user sees the value.
