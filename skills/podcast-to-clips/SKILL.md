---
name: Podcast → clips
description: Turn a long recording into a publishable set of 9:16 clips — segmentation, ranking, speaker framing, captions, and per-clip export, procedurally.
---

# Podcast → clips

Follow the `build-in-kaestral` house rule. This is the PRODUCTION pipeline for long-form → a
publishable clip SET. The ranking rubric lives in `viral-reel` §0.5 — this skill is the procedure
around it (segmentation → selection → build → deliver), so read both; don't restate one inside the
other.

## Stage 1 — Perceive the whole recording (before any cut)
1. `import_media` the recording · `get_timeline` for state.
2. `get_transcript` on it → every word with frame timings. Skim for: repeated themes, laughter,
   "so here's the thing…" pivots, numbers, stories with beginnings.
3. `detect_scenes` (threshold 0.2–0.3 for multicam podcasts — camera switches score lower than
   hard cuts) → the recording's real visual boundaries.
4. `analyze_audio` → silence ranges (pause map) + energy.
5. `see_video` mode:"scene" → confirm what the moments LOOK like (two-shot? screen share? B-roll?).

## Stage 2 — Segment & select
- Candidate boundaries = sentence starts (from transcript) that sit within ~1s of a scene cut or a
  ≥0.7s silence. A clip must START on a sentence start; it may end only at a landed point (punchline,
  completed claim, laugh).
- Target 15–45s per clip; 20–35s is the sweet spot.
- Rank candidates with the `viral-reel` §0.5 rubric (hook strength → self-containment → emotional
  peak → length fit). Present the top N (user's ask, default 5) as:
  `#rank | mm:ss–mm:ss | the would-be hook line | why it works` — get one approval, then build all.

## Stage 3 — Build each clip (repeat per clip)
1. **Isolate:** `split_clips` at clip start and end → `ripple_delete_ranges` everything else
   (track mode). Confirm with `get_timeline` that only the clip remains, starting at frame 0.
2. **Frame for 9:16:** `set_project_settings` aspect 9:16 →
   - Single speaker: `apply_layout` full+fill (center crop), then nudge with
     `set_clip_properties` transform so the face sits in the upper-middle third (use `see_video`
     on the segment to check framing — there is no auto face-tracking; framing is a judged
     transform, and for a static podcast camera one transform per speaker-segment is enough).
   - Two speakers alternating: `split_clips` at speaker turns (transcript tells you where), then
     per-segment transforms to frame whoever talks; or `apply_layout` top_bottom for a
     both-on-screen look.
3. **Tighten:** `remove_words` for fillers (see `talking-head-cleanup`), `ripple_delete_ranges`
   on any ≥0.7s silence inside the clip.
4. **Hook the top:** the clip's first line must work context-free; if the natural first line is
   weak, cold-open on the strongest sentence (`move_clips`) and add a 1-line text hook
   (`hook-engineering`).
5. **Captions:** `add_captions` wordsPerCaption 3, styled per `caption-styles` (word-pop or
   karaoke), lower-middle for 9:16.
6. **Grade + brand:** one light `apply_color` pass; logo bug + end card if a `brand-kit` exists.
7. **Export:** `export_project(mode:"video", resolution:"1080p",
   outputPath:".../clips/<show>-e<ep>-c<rank>-<slug>.mp4")` and `mode:"srt"` alongside.
8. **Reset for the next clip:** re-open the saved master `.kaestral` (export it once before
   Stage 3) — clip builds are destructive by design.

## Delivery
A set, not files: `clips/` folder, ranked filenames, plus a one-line-per-clip summary to the user
(`c1 — the pricing mistake story, 28s, hook: "We lost $40k on…"`). Offer `batch-variants` on the
best performer once results come in.

## Failure modes
- **Clips that start mid-context** ("…and that's why he left") — unrankable retention killer; the
  sentence-start rule is absolute.
- **One transform for a two-speaker clip** — half the clip frames the silent person. Split at turns.
- **Building clips in transcript order** instead of rank order — if time runs out, the best clips
  must already exist.
- **Skipping the master save** — after clip 1's ripple-deletes the recording is gone from the
  timeline; without the `.kaestral` master you re-import and re-perceive everything.
