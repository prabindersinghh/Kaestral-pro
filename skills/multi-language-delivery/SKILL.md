---
name: Multi-language delivery
description: One edit → many language variants — transcript → translated caption sets → per-language exports, with naming conventions and a QA checklist.
---

# Multi-language delivery

Follow the `build-in-kaestral` house rule: every language variant is built ON the timeline and
exported with `export_project` — never assembled outside Kaestral.

One finished edit becomes N language deliverables. YOU are the translator (you're an LLM — no
external service needed); Kaestral gives you word timings, caption tools, and exports.

## The pipeline (per project, once)
1. **Lock picture first.** All cutting, grading, and motion is finished and approved BEFORE any
   language pass — a picture change after translation multiplies rework by N languages.
2. **Get the source transcript:** `get_transcript` on the spoken clip → word-level timings. This
   is the timing skeleton every language reuses.
3. **Save the master:** `export_project(mode:"kaestral", outputPath:".../Project-MASTER.kaestral")`
   so you can always return to the language-free state.

## Per language (repeat for each)
1. **Translate in caption-sized lines**, not sentence-by-sentence: translate the transcript into
   target-language lines of 2–5 words that each cover a source time window (use the source words'
   start/end frames of the window they replace). Translation rules:
   - Preserve MEANING per time window; never let a line outlive the moment it describes.
   - Keep on-screen numbers, names, and brand words unchanged.
   - Target-language lines run 20–40% longer in many languages (DE/FR/ES) — prefer shorter
     synonyms over smaller fonts.
2. **Build the caption set** with `add_texts` (one entry per translated line: `startFrame` /
   `durationFrames` from the source window, styled per `caption-styles`). `add_captions` only
   captions the SOURCE language — translated sets are authored via `add_texts`.
   Record the returned `clipIds` — that list IS the language set.
3. **QA pass** (checklist below), then **export**: `export_project(mode:"video",
   outputPath:".../<project>-<lang>.mp4")`, plus `mode:"srt"` for a matching subtitle sidecar.
4. **Clear the set** before the next language: `remove_clips` with that language's recorded
   clipIds (or re-open the MASTER `.kaestral`). There is no per-track mute tool, so languages are
   built one-at-a-time, not stacked muted — this is the honest workflow with today's tools.

## Naming convention (deliverables + timeline)
- Files: `<project>-v<edit-version>-<BCP47>.mp4` → `launch-v3-es-MX.mp4`, `launch-v3-hi.srt`.
- One language per export folder: `delivery/es-MX/`, `delivery/hi/`.
- In notes to the user, always state language + line count: "es-MX: 42 caption lines".

## QA checklist (run per language, before export)
- [ ] Every line ends before the next begins (no overlaps — `get_timeline` and scan the text track).
- [ ] No line shorter than 20 frames at 30fps (unreadable) or longer than ~5s (stale).
- [ ] Numbers/names/brand words identical to source.
- [ ] Text fits: longer languages may need `fontSize` a step down (60→54px at 1080p) — never below 44px.
- [ ] RTL languages (ar, he): set `alignment` appropriately and confirm rendering with a spot-check
      via the preview; flag to the user that RTL shaping should be eyeballed before publishing.
- [ ] Spot-translate-back 3 random lines to catch drift.

## Where dubbing slots in (Pro — not available today)
Audio dubbing (translated VO replacing/ducking the original) is a Pro-roadmap capability. Today's
honest offer: translated captions + SRT sidecars. When a user asks for dubbing, say it isn't
available yet and deliver the caption variant — do not fake it with unrelated TTS.

## Failure modes
- **Translating the transcript 1:1 into long sentences** → captions lag the speech. Translate into
  timed LINES from the start.
- **Stacking all languages on the timeline at once** → there is no track-mute tool; exports would
  show every language. One language per pass.
- **Editing picture after language passes** → every language is now mistimed. Lock picture first.
- **Silent font shrinking** below legibility to fit long lines — rewrite the line instead.
