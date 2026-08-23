---
name: Batch variants
description: Produce many testable variants of one edit — hook, caption-style, length, and aspect variants — with a naming and tracking scheme.
---

# Batch variants

Follow the `build-in-kaestral` house rule. Variants exist for A/B testing: change ONE variable per
variant, keep everything else identical, and name things so results map back to the change.

## The master + the loop
1. Finish and approve the base edit. Save it: `export_project(mode:"kaestral",
   outputPath:".../<project>-MASTER.kaestral")`. The master is sacred — variants never overwrite it.
2. Per variant: make the ONE change → export video → revert (via recorded clipIds + `remove_clips`
   / `undo`, or re-open the MASTER). There is no in-session project-duplicate tool; the
   `.kaestral` export IS the duplicate mechanism — re-opening the master resets state exactly.
3. Track in a table you print for the user at the end: `variant id | variable | value | filename`.

## Naming scheme (encode the variable in the filename)
`<project>-H<hook#>-C<capstyle>-L<seconds>-<aspect>.mp4`
- `launch-H1-Cwordpop-L30-916.mp4` = hook 1, word-pop captions, 30s, 9:16.
- Change exactly one field between any two files you intend to compare.

## Variant axes (in order of measured impact)
### 1. Hook variants (highest leverage — test these first)
Same body, different first 1–3s. Build 2–4 using the `hook-engineering` taxonomy: e.g. H1 = bold
claim text hook, H2 = strongest visual moment cold-open (`see_video` to find it), H3 = question
hook. Implement by swapping only the opening: `split_clips` at the hook boundary, replace/reorder
with `move_clips`/`ripple_delete_ranges`, or swap the `add_texts` hook line.
### 2. Caption-style variants
Same cut, different look from `caption-styles`: word-pop vs karaoke highlight vs bold-boxed.
Restyle in place with `update_text` on the caption group (`captionGroupId`) — one call per style.
### 3. Length variants
L15 / L30 / L60 from the same material: cut DOWN from the longest. Use `retention-editing` to
choose what leaves; the 15s version keeps only hook → single proof → CTA.
### 4. Aspect variants
`set_project_settings` aspect (9:16 / 1:1 / 16:9), then RE-FRAME — don't just letterbox:
`apply_layout` full+fill for center-crop, `set_clip_properties` transform to keep subjects framed,
re-position captions per `platform-delivery` safe areas. Export per aspect.

## Budgeting honesty
Each variant is a real export (~minutes each). Quote the user the count before building: 3 hooks ×
2 caption styles = 6 exports, not "a few". If they ask for a full matrix (3×3×3), recommend
testing ONE axis at a time instead — a 27-file matrix with one variable confounded is 27 wasted
exports.

## Failure modes
- **Two variables changed between two files** → the test result means nothing. One change per pair.
- **Variants built off a drifting timeline** (each variant on top of the last) → always return to
  MASTER state between variants.
- **Unencoded filenames** (`final2-new.mp4`) → results can't map back. The scheme is mandatory.
- **Letterboxed "aspect variants"** → an aspect variant that isn't re-framed tests nothing except
  black bars.
