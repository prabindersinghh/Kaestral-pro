# Topic → short video (idea-to-timeline pipeline)

Turn a TOPIC or SCRIPT into a complete, **editable** short on the Kaestral timeline. You are the
director, screenwriter, and producer in one; Kaestral's tools are your crew. The deliverable is a
project the user can still tweak clip-by-clip — never a black-box render.

FIRST: the `build-in-kaestral` house rule applies — every asset lands on the timeline via tools;
export only via `export_project`. Read `shot-recipes` for the shot vocabulary and `art-direction`
if any beat uses `compose_motion`.

## 0. Intake (ask ONLY what's missing)
Need: topic or script · target duration (default 20–30s) · aspect (default 9:16) · brand
(logo/colors, optional) · language. If the user gave a topic only, YOU write the script (§1). If
they gave a script, use it verbatim — trim only with permission.

## 1. Script (topic mode)
Write it yourself — you are the LLM; no external service needed. Rules for a short that retains:
- Hook line FIRST (a question, bold claim, or number — no wind-up), one idea per sentence,
  a concrete payoff, an imperative CTA last.
- Budget ~2.3 words/sec of target duration (a 24s short ≈ 55 words). Read it back to the user in
  one message with the beat split below — they approve script + structure in one round-trip.

## 2. Beat the script
Split into scene-sized beats (one idea each, 2–5s at the words/sec budget). For each beat decide
its VISUAL from what's actually available:
- **User footage/images** — `get_media`/`search_media`; `see_video` anything unfamiliar first.
- **Hosted generation** — `list_models`; if a generation backend is configured, `generate_video` /
  `generate_image` per beat (they auto-import + place). If NOT configured, say so plainly and use:
- **Composed motion** — `compose_motion` beats (a shot-recipe per script beat: counter for a stat,
  splitLayout for a compare, kinetic/blurPushUp for the hook line). This path ALWAYS works — a
  full text+motion short with zero footage is a legitimate, premium result.
- **URL footage** — only if the user names a source: `import_from_url` (their yt-dlp; license is
  their call — remind them once).

## 3. Voiceover & timing
- If the user provides/records a VO file: `import_media` → `get_transcript` on it → the word
  timings BECOME the beat timings (retime beats to the spoken pace, not the plan).
- No VO: time beats by the words/sec budget and carry the script as on-screen text instead.
  (On-device TTS is on the roadmap — do NOT fake it with an external service.)
- Music: if the user provides a track, `import_media` + `analyze_audio` → put its beats in
  `meta.beatMarkers` / snap cuts to them (`beat-sync-cutting` skill). Duck it under VO with
  `set_clip_properties` volume.

## 4. Assemble on the timeline (visibly, beat by beat)
`set_project_settings` (aspect + 1080p) → place each beat's visual in order (`add_clips` /
generated assets / `compose_motion` clips) → `add_captions` from the VO transcript (word-accurate,
styled per `caption-styles`) or `add_texts` for script-on-screen → logo: `import_media` the brand
image + `add_clips` on a top track, `set_clip_properties` transform to a corner (~0.12 width,
x/y ≈ 0.08/0.92 by eye) → grade for cohesion (`creative-director`: extract_palette from the hero
visual → apply_color across clips).

## 5. Quality gate, then export
Walk the finished timeline against the `art-direction` failure modes (§9): no dead air, hook lands
inside 3s, captions from word one, one accent language, every beat resolves. Fix what fails. Then
`export_project` — and tell the user what they can still tweak (any clip, any caption, any grade:
it's all on their timeline).

## Honesty rules
- No generation backend → say it, offer the compose_motion path; never pretend footage exists.
- Never fetch stock media from services the user hasn't configured; never invent licenses.
- The user approves the script BEFORE you assemble — one approval, then build without pausing.
