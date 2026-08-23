---
name: Color storytelling
description: Grading with intent — shot matching, mood via temperature and curves, palette-driven grades from extract_palette, LUT discipline, and over-grading failures.
---

# Color storytelling

Follow the `build-in-kaestral` house rule: every grade is `apply_color` on timeline clips —
visible in the preview, rendered by `export_project`. `creative-director` owns the whole-look
brief (palette → grade → type together); THIS skill is the grading craft itself, in depth.

## The order of operations (always this sequence)
1. **Correct** (make shots true): exposure → temperature/tint → contrast. Neutral skin, blacks
   that aren't milky, whites that aren't clipped.
2. **Match** (make shots agree): shot-to-shot, §below.
3. **Grade** (make it mean something): the look — wheels, curves, saturation choices, LUT.
Correcting through a look is guesswork; looks stack on truth.

## Shot matching (the professional tell)
Pick the best-exposed clip as the REFERENCE. For each other clip, compare against it (judge in the
preview; `inspect_color`/`see_video` frames help you compare states):
- Brightness gap → `exposure` (±0.1–0.3 steps).
- Warmth gap → `temperature` (phone clips often need +300–600K toward warm; overcast footage
  reads blue).
- Density gap → `contrast` (1.02–1.08 nudges).
Match BEFORE the look pass; a look applied to unmatched shots amplifies their disagreement.
Mixed sources (webcam + phone + screen recording) always need matching — screen recordings should
stay UNGRADED (UI colors are content; grading them lies about the product).

## Mood — what the controls MEAN
- **Temperature:** warm (+) = intimate, nostalgic, human; cool (−) = clinical, tense, tech.
  A story can ARC: cold problem → warm resolution (grade per-section after `split_clips`).
- **Contrast + blacks (`blacks`/`whites`, curves):** crushed blacks + high contrast = drama,
  grit; lifted blacks (faded film) = calm, memory, premium-soft. `masterCurve` gentle S
  ([[0,0],[0.25,0.22],[0.75,0.78],[1,1]]) = filmic snap; lifted toe ([[0,0.06],…]) = the fade.
- **Saturation vs vibrance:** `vibrance` boosts quiet colors while protecting skin — prefer it
  (+0.1–0.2) over raw `saturation` for "richer"; drop saturation 0.85–0.95 for somber weight.
- **Wheels (`shadowsHue/Amount`, `midsHue`, `highsHue`):** the cinematic complement — shadows
  toward teal (hue ≈ 200, amount 0.05–0.12) + highlights toward warm (hue ≈ 40, amount
  0.04–0.10) flatters skin against cool backgrounds. Amounts above ~0.15 read as an Instagram
  filter, on purpose or not.
- **Hue curves (`hueCurves.targets`):** surgical single-color moves — e.g. calm a neon-green exit
  sign ({targetHue: 120, satScale: 0.6}) or push brand-blue purer without touching skin.

## Palette-driven grading (on-brand color)
`extract_palette` on the brand's hero asset/logo → take the dominant accent's HUE and push the
grade's supporting tones toward it: accent-hued shadows via the wheels (shadowsHue ≈ accent hue,
amount 0.06–0.1), or a hueCurves nudge of the footage's nearest hue toward the brand hue. The
brand should live in the image's undertones, not as a colored wash over faces. Motion beats stay
exactly on-palette automatically via `meta.palette` — grade footage TOWARD what the graphics
already are, so cuts between footage and graphics feel like one world.

## LUT discipline (`lut: {path, strength}`)
A user-supplied LUT is a LOOK, not a correction: correct + match FIRST, then apply at
`strength` 0.4–0.7 — full strength assumes the LUT's authoring conditions, which your footage
never matches. One LUT per piece; LUT + heavy wheels together double-season the same dish.

## Worked example (mixed-source product story, warm-brand)
Reference = the A-cam interview. Phone B-roll: +0.2 exposure, +400K, contrast 1.05 to match.
Screen captures: untouched. Look pass on footage only: vibrance +0.15, shadows toward teal 0.07,
highlights toward warm 0.06, gentle S masterCurve. Brand tie-in: shadowsHue set to the brand
palette's deep tone from `extract_palette`. Result: one world, warm where the brand is warm,
product UI truthful.

## Failure modes
- **Grading before matching** — the look amplifies every mismatch.
- **Orange-teal at amount 0.2+** — the 2012 filter. Halve it.
- **Graded screen recordings** — you just changed the product's colors in a product video.
- **Skin as collateral** — every global move lands on faces first; check a face frame after each
  step (vibrance and wheels are the safer tools near skin).
- **LUT at 1.0 as a fix** — a LUT never corrects; it stylizes whatever truth or lie is beneath it.
