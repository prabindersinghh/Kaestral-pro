---
name: Brand kit
description: Apply one consistent brand system across a project — palette, type scale, logo placement, lower-thirds, and a reusable grade preset.
---

# Brand kit

Follow the `build-in-kaestral` house rule. A brand kit is a DECISION SET you establish once per
client/project and then apply mechanically to every clip — consistency is the whole product here.

## 1. Establish the kit (once per client)
Ask for brand hexes/logo/font if they exist. If not, derive:
- **Palette:** `extract_palette` on the client's hero footage or logo (`mediaRef`) → pick ONE
  primary accent + ONE neutral. Two accents max, ever (`creative-director` has the reasoning).
- **Type scale at 1080p** (scale linearly for other heights):
  display/hook 96–120px · section title 64–80px · captions 60–72px · lower-third name 44–52px,
  role 30–36px. Bold for display and captions; regular for roles.
- **Logo:** `import_media` the logo file once; note its `assetId` in your working notes.
- **Grade preset:** a named `apply_color` recipe (see §5).
Write the kit as a short block you re-state at the top of every session for this client:
`BRAND: accent #16b16a · neutral #eaeaef · logo <assetId> · grade "clean-lift"`.

## 2. Logo placement + safe margins
- Place via `add_clips` (the logo asset on a top video track) + `set_clip_properties` transform.
- Corner bug: `width` ≈ 0.10–0.14 of frame; margins ≈ 5% from edges → top-right =
  `centerX 0.88, centerY 0.10` (16:9) / `centerX 0.85, centerY 0.07` (9:16 — clear of platform UI).
- Opacity 0.85–1.0 for a bug; full opacity only on the end card.
- The logo runs the FULL duration of content beats, disappears during the hook (first 2–3s — the
  hook needs every pixel), returns on the end card centered at `width` 0.3–0.4.

## 3. Lower-third recipe (name + role)
Two `add_texts` entries, left-aligned, both with the brand accent:
- Name: 44–52px bold, `backgroundColor` = accent (boxed), `animation:"slideUp"`.
- Role: 30–36px regular, `color` = neutral, `animation:"slideUp"`, starts 6–8 frames after the name.
- Position lower-left: name `transform.centerX ≈ 0.22, centerY ≈ 0.82`; role directly under
  (`centerY ≈ 0.87`). Hold 3–5s, then both exit; never leave a lower-third up through a cut to a
  different person.

## 4. Motion graphics on-brand
Any `compose_motion` beat: set `meta.palette` to the brand colors (orbs, shine, strikethrough all
tint from it) and pass `background.accent` = the primary accent. Title cards use the type scale
above via `style.size` (display ≈ 0.09–0.11 of height). See `shot-recipes` for the shot library.

## 5. Grade preset (write it down, reuse verbatim)
A preset is just a REPEATABLE `apply_color` call. Example "clean-lift":
`{exposure: 0.3, contrast: 1.06, saturation: 1.08, temperature: 6600}` — apply to every footage
clip (`clipIds` = all video clips from `get_timeline`), never to logo/text/motion clips. For
per-shot matching on top of the preset, see `color-storytelling`.

## 6. Apply-to-a-new-clip checklist
- [ ] Grade preset applied to all footage clips
- [ ] Captions styled with kit type scale + accent (see `caption-styles`)
- [ ] Logo bug placed per §2, absent during hook, end card present
- [ ] Any motion beat uses `meta.palette` + brand accent
- [ ] Lower-thirds only via the §3 recipe

## Failure modes
- **Per-clip drift** — eyeballing sizes/colors per clip. The kit exists so you DON'T decide twice;
  re-state the kit block, apply verbatim.
- **Three-plus accents** — reads unbranded. Two max.
- **Logo over the hook** — the first seconds sell the video, not the logo.
- **Grading the graphics** — apply_color on text/motion clips shifts brand colors; grade footage only.
