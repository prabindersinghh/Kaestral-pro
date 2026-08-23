---
name: Client review cut
description: Prepare a review deliverable — slate, watermark, compressed proxy export — and turn change requests into precise timeline edits.
---

# Client review cut

Follow the `build-in-kaestral` house rule. A review cut is a WORKING deliverable: watermarked,
cheap to send, easy to give notes on — and never mistaken for the final.

## 1. The slate (2–3s, first thing on the timeline)
Build with `compose_motion` (one beat, `background:{kind:"solid",accent:"#0b0a0d"}`) or two
`add_texts` entries on black:
- Line 1: `<Project> — REVIEW CUT v<N>` (64–80px, bold)
- Line 2: `<date> · not for publication` (36–44px, muted)
Insert at frame 0 with `insert_clips`/`add_texts` so the whole cut ripples right. Remove the slate
(one `ripple_delete_ranges`) only on final delivery.

## 2. Watermark
- Text watermark: `add_texts` with content `REVIEW — <client>` , 40–48px, white, NO background box,
  centered (`centerX 0.5, centerY 0.5`), running the full duration. Then set the clip's `opacity`
  to ~0.12–0.18 via `set_clip_properties` — visible on any footage, not obnoxious.
- Or logo watermark: the brand-kit logo asset, centered, `width` ≈ 0.35, opacity ≈ 0.10.
- The watermark sits on the TOPMOST track so nothing renders above it.

## 3. Timecode — what's honest today
There is **no running-timecode overlay tool** in Kaestral yet — a burned-in counting TC cannot be
built with existing tools (a text clip is static), so don't fake one. Give reviewers frame
addresses instead:
- Ask notes in `mm:ss` at the stated fps ("0:41 — trim the pause").
- For frame-accurate professional review, deliver `export_project(mode:"xml")` (Premiere) or
  `mode:"fcpxml"` (Resolve) alongside — their players show true TC.
Say this plainly to the user rather than implying TC burn-in exists.

## 4. Proxy export (small file, fast send)
`export_project(mode:"video", codec:"H.264", resolution:"720p", outputPath:".../<project>-review-v<N>.mp4")`
— 720p H.264 is the review sweet spot: small enough to message, sharp enough to judge cuts.
Name reviews `-review-v1`, `-review-v2`, …; the final drops the suffix entirely.

## 5. Change-request → timeline-edit workflow
Convert every note into ONE precise operation before touching anything, then execute in
REVERSE-CHRONOLOGICAL order (latest timestamps first) so earlier timestamps stay valid while you work:
- "cut the pause at 0:41" → frame = 41×fps → `ripple_delete_ranges` on that range.
- "tighten the intro" → `split_clips` at the keep-point + `ripple_delete_ranges` the front.
- "swap the second clip" → `remove_clips` + `add_clips`/`move_clips` at the same startFrame.
- "make the caption punchier" → `update_text` (content and/or style).
- "different music from 1:10" → `split_clips` the music clip there, `remove_clips` the tail,
  `add_clips` the new track section, level per `sound-design`.
After all notes: re-slate as v<N+1>, re-watermark check, re-export, and reply with a per-note
done/deferred list. If a note is ambiguous ("make it pop"), ask ONE clarifying question with two
concrete options rather than guessing.

## Failure modes
- **Shipping the watermark** — final export must remove slate + watermark clips (keep their
  clipIds recorded from creation so removal is one `remove_clips` call).
- **Applying notes top-down** — each edit shifts later timestamps; work bottom-up.
- **Full-res review files** — nobody downloads a 900 MB review; 720p proxy always.
- **Silent interpretation of vague notes** — one question with options beats a wrong v3.
