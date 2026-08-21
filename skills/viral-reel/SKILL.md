---
name: Viral-style reel
description: Turn raw footage into a punchy vertical (9:16) short — hook, jump cuts, zoom punches, trending captions, beat-aware rhythm. Use for "make this a viral reel / short".
---

# Viral-style reel

FIRST, follow the house rule in the `build-in-kaestral` skill: build everything ON the Kaestral timeline via tools (the user watches it happen), never render a standalone file, and finish with Kaestral's own Export. Every step below is a tool call — apply it, don't just describe it.

Your job: take what's on the timeline and turn it into a short-form vertical video that earns attention in the first 3 seconds and keeps it. Work in passes, visibly. Call `get_timeline` and `get_media` first so you know what you're working with.

## 0. Understand the footage FIRST (perception)
Don't edit blind. Before cutting, actually look and listen:
- **Watch it:** `see_video` on the hero clip(s) (mode:"scene" to see distinct moments, or "interval" for an overview). You get real frames — read the subject, the framing, the action, and pick the strongest visual moment for the hook.
- **Read it:** `get_transcript` on the spoken clip → word-level timestamps of everything said. Now you know the actual hook line, the payoff, and where the filler is — so cuts and captions land on real content, not guesses.
Use this understanding throughout: hook = the best moment you SAW or the best line you READ; captions = the real words; b-roll = illustrate what's actually said.

## 0.5 Long-form → ranked clip candidates (moment mining)
When the source is LONG (a podcast, lecture, stream, demo recording) and the ask is "make shorts
from this," don't scrub linearly — mine it:
1. **Segment:** `detect_scenes` on the source → its real cut boundaries. `analyze_audio` → beats +
   silence ranges. `get_transcript` → every word with timing. Segments = scene cuts intersected
   with sentence boundaries from the transcript.
2. **Rank each segment** on four signals, in this priority:
   - **Hook strength** — does its FIRST line/frame work with zero context? (a question, a bold
     claim, a number, a visible surprise). A great moment with a weak first line ranks below a good
     moment with a killer first line.
   - **Self-containment** — understandable without what came before; no dangling "so as I said."
   - **Emotional peak** — laughter, disbelief, a reveal, a mistake owned. `see_video` the segment
     (mode:"scene") to confirm the visual matches the transcript's promise.
   - **Length fit** — trims cleanly to 15–45s at a natural out-point (a landed punchline, a
     completed claim), not a mid-sentence cliff.
3. **Tell the user the top 3–5** with timestamps + the would-be hook line of each, then build the
   chosen one(s): `split_clips` at the segment bounds, `ripple_delete_ranges` for everything else,
   then continue from §1 below. If they say "just make the best one," build rank #1.

## 1. Set the frame (9:16)
- `set_project_settings` with `aspectRatio: "9:16"` and `quality: "1080p"`. This is the single most important framing move for reels.
- If a clip is landscape and now letterboxed, reframe it: `apply_layout` with `full` + `fill` so it covers the vertical frame (center-crop), or use `set_clip_properties` to scale/position the subject into frame. Keep faces/subjects in the upper-middle third.

## 2. Land the hook (first 3 seconds)
The opening 3s decides retention. Do at least one of:
- **Cold open on the strongest moment.** Find the most visually or verbally striking beat and move it to frame 0 with `move_clips` (or `split_clips` + `ripple_delete_ranges` to cut the slow lead-in). Never open on dead air or "hey guys."
- **Hook text.** `add_texts` a short, punchy line (3–6 words, e.g. "watch this till the end") at the top third, style it bold with a background box (see the `caption-styles` skill), animation `popIn` or `wordPop`. Keep it on screen ~1.5–2s.
- **Punch-in on the hook.** A subtle scale from 1.0→1.08 over the first ~10 frames (`set_keyframes` on `scale`) adds energy.

## 3. Tighten the pace (jump cuts on pauses)
Short-form lives on tight cuts — remove every pause, filler, and dead beat.
- **Auto jump-cut-on-pause:** call `analyze_audio` on the talking clip — it returns `silenceRanges` (dead-air, in project frames). Feed those ranges to `ripple_delete_ranges` to delete the pauses and close the gaps in sync. This is the highest-ROI edit for talking-head footage.
- Aim for a new visual event every ~1.5–3s: a cut, a zoom, a caption change, or a b-roll cutaway. If a clip runs longer than ~3s with no change, add one.
- **Word-level cuts:** with a transcript from step 0, cut specific filler words ("um", "uh", false starts, tangents) with `remove_words` (by transcript index) — it ripple-deletes the exact word ranges and closes the gaps, the word-accurate version of pause cutting.

## 4. Add energy (zoom punches + retime + motion)
- **Zoom punch** on emphasis: `set_keyframes` on `scale` from 1.0 to ~1.12 over 3–5 frames with `interpolationOut: "smooth"` (eases like a pro, not mechanical), then ease back. Punch in on reveals, punchlines, and the hook.
- **Speed / retime:** `set_clip_properties` with `speed` — <1 for slow-mo on a peak moment (e.g. 0.5), >1 to blast through a slow stretch (e.g. 1.5–2). Both render in the export (video + pitch-corrected audio). Speed-ramp by splitting the clip and setting different speeds per segment.
- **Ken Burns** on stills/b-roll: keyframe `scale` and `position` (smooth) for a slow drift so nothing sits static.
- **Beat rhythm:** if there's music, run the `beat-sync-cutting` skill so cuts and punches land on the beat (uses `analyze_audio`).

## 5. Captions (retention driver)
Most short-form is watched muted — captions are non-negotiable.
- Follow the `caption-styles` skill. Use `add_texts` with a bold style + background box, animation `wordReveal` or `highlightPop`, placed in the lower-middle (safe above the UI). Keep 2–5 words per screen.
- If the user gives the spoken text (or a transcript), lay captions in sync. If not, add key call-out phrases at the moments that matter.

## 6. Transitions + polish
- Between hard cuts of the SAME scene, keep it a straight cut (that's the short-form default — don't over-transition).
- Between SECTIONS, a quick cross-dissolve or a `generate_motion` "Transition" stinger works. Auto-insert dissolves at cuts via the timeline's transitions action if the whole thing should feel smoother.
- Grade for punch: `apply_color` a touch of contrast + saturation + a warm or cool push to unify the look (see `creative-director`). Extract the footage palette first with `extract_palette` so captions/graphics match.

## 7. Outro / loop
- End on a clear payoff or a loop-back to the hook. A short outro card (`generate_title`) with a CTA ("follow for part 2") works. Keep it under ~1.5s.

## 8. Export from Kaestral
- Render the finished reel with `export_project(mode:"video")` — this renders the CURRENT TIMELINE you just built, through Kaestral. Do NOT render a separate file with ffmpeg. If the user would rather export themselves, tell them to press Export in the app.

## Checklist before you finish
- [ ] 9:16, subject in frame, no letterboxing
- [ ] A real hook in the first 3s (visual + text)
- [ ] No dead air; a change at least every ~3s
- [ ] At least one zoom punch on an emphasis beat
- [ ] Captions present, styled, readable muted
- [ ] Cohesive grade; graphics match the palette
- [ ] Clean payoff/outro
- [ ] Everything is ON the timeline; final render via export_project(mode:"video")

Tell the user which of these you applied and which need input from them (e.g. the spoken transcript for word-accurate caption timing).
