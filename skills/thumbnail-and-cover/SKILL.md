---
name: Thumbnail & cover
description: Choose and build the cover frame — candidate selection via see_video, framing and legibility rules, text overlay, and honest export paths.
---

# Thumbnail & cover

Follow the `build-in-kaestral` house rule. The cover is judged at postage-stamp size in a feed —
design for 20% scale, verify at 100%.

## 1. Find candidate frames
`see_video` on the hero clip, mode:"interval" for an overview then mode:"scene" for distinct
moments. You SEE real frames — judge them. A strong cover frame has:
- A face mid-expression (peak emotion beats neutral by a wide margin) or a clear subject-action.
- Subject occupying 40–70% of frame, off-center (rule-of-thirds), eyes in the top half.
- Clean separation from background (contrast, not clutter). Motion-blurred frames lose at small size.
Shortlist 2–3 timestamped candidates and tell the user which you'd pick and why.

## 2. Compose the cover ON the timeline
Two honest paths — pick by whether the cover uses a footage frame:

**A. Footage-frame cover:** isolate the chosen frame's clip segment (`split_clips` around it),
place at frame 0, then build the overlay on top:
- Text: 3–5 words MAX via `add_texts` — 100–140px at 1080p, bold, boxed (`backgroundColor`) or
  heavy outline; placed AWAY from the subject's face; never subtitle-position.
- Punch the grade for feed contrast: `apply_color` {contrast: 1.12, saturation: 1.15} on the cover
  segment only — covers run hotter than the video.
- Optional brand accent bar/logo per `brand-kit` (small; the face and words sell, not the logo).

**B. Designed cover (no footage):** one `compose_motion` beat — solid/glow background with brand
accent, display text at `style.size` 0.12–0.16, optional screenMock of the product. This is fully
in-tool and renders crisp at any size.

## 3. Getting the still OUT — the honest part
Kaestral has **no single-image export tool** today (a `render_frame` tool is on the roadmap). Say
this plainly. The working paths:
- Export the 1–2s cover segment as video (`export_project(mode:"video")`, trimmed timeline) and
  take the frame in any player's frame-step + screenshot — pixel-identical to the render.
- Platforms that accept a video's own frame as cover (TikTok/Reels/Shorts): put the composed cover
  as the FIRST 1–2 frames of the actual video (or select the in-video frame at publish time) — no
  file needed at all. For loop-friendliness trade-offs see `retention-editing` §endings.
Do NOT screenshot the preview at panel resolution as a deliverable — it's not export-quality.

## 4. Legibility checklist (at 20% zoom, mentally or by resize)
- [ ] Words readable? (If not: fewer, bigger words.)
- [ ] Subject identifiable? (If not: tighter crop — `set_clip_properties` transform.)
- [ ] Would it read next to 8 competing thumbnails? (Contrast + one focal point.)
- [ ] Cover message ≠ title text verbatim (they appear together; duplicate = wasted surface).

## Failure modes
- **Whole-sentence covers** — 8 words at thumb size = zero words. 3–5.
- **Random-frame covers** — an unchosen frame is almost always eyes-half-closed. Choose with
  `see_video`, on purpose.
- **Text over the face** — the two focal points cancel; place text in the frame's quiet zone.
- **Implying a still-export tool exists** — it doesn't yet; give the user the honest paths above.
