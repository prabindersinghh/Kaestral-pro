# Kaestral — Complete Feature Reference

Every capability in Kaestral as of v1.0.5, in detail. The one idea behind all of it: **the editor is
the hands, the AI is the brain.** Kaestral exposes a real editor as 52 validated MCP tools; a
connected LLM (Claude Code, Cursor, Claude Desktop, or the in-app chat) perceives your footage and
operates those tools. Everything the AI emits is validated data — never executed code.

---

## 1. The desktop editor (Windows 10/11)

**Shell & lifecycle**
- Tauri 2 (Rust) native shell, NSIS installer — bundles Node, FFmpeg/ffprobe, whisper, and the
  motion-render workspace, so a fresh machine needs zero dependencies.
- **Signed auto-updates** (from v1.0.5): releases are signed with a minisign key; the app verifies
  every update against the public key baked into it, checking the GitHub releases manifest.
- Robust engine lifecycle: the editing engine starts with the app (HTTP on 127.0.0.1:19789),
  is killed on app exit, and stale engines from older versions are swept at startup.
- Unsaved-changes close guard · first-run onboarding (welcome → sample project → example prompts →
  connect an AI) · keyboard-shortcuts cheat sheet · humanized error messages (never a stack trace).

**Timeline**
- Multi-track (video / audio / text zones), ruler + playhead, frame-accurate scrubbing.
- Drag with snapping, split, ripple-delete (single-range and multi-range), overwrite placement,
  move across tracks, contiguous-chain ripple on speed changes.
- **Linked A/V clips**: video with audio auto-creates a linked pair that splits, moves, and ripples
  together — verified to stay in sync even when the partner track is not sync-locked.
- Sync-locked tracks (ripple operations shift them together; refusal with a clear reason when a
  locked follower can't absorb a shift).
- **Keyframes** on animatable properties (opacity, scale, volume, …) with interpolation modes;
  keyframes rescale correctly through clip-speed changes.
- Per-clip: speed/retime, trim in/out, volume, opacity, **16 blend modes**, transform
  (position/scale/rotation/flip), crop, effect stack.
- Undo/redo as discrete, named steps (the AI gets its own assistant-scoped undo).

**Preview**
- Frame-accurate composited canvas preview of the full stack: transforms, crops, blend modes,
  effects, text/captions, keyframed values — what you see is what exports.
- Audio waveforms on audio clips.

**Media library**
- Import via file picker, drag-drop, or URL. Folders (create/rename/move/delete), asset
  rename/delete, search.
- Media provenance survives save/load: generation inputs, import inputs, and cached remote URLs
  round-trip losslessly through the `.kaestral` project format.

**Project format**
- `.kaestral` package: timeline + media manifest, lossless round-trip, clean "Corrupt project"
  errors on damaged files (the app opens with an empty project rather than dying).

---

## 2. The MCP server — 52 tools

Two transports, one engine: **stdio** (`npx kaestral` — what `claude mcp add kaestral -- npx
kaestral` uses; zero config) and **HTTP** (`127.0.0.1:19789/mcp` — what the desktop app uses
internally, so AI edits appear live in the window). A one-click **`.mcpb`** installs it as a Claude
Desktop connector. Every connecting agent receives the server's working rules and the full skills
catalog in the MCP handshake.

**Read / inspect (6):** `get_timeline` · `get_media` · `inspect_media` · `get_transcript`
(with start/end-frame windowing) · `inspect_timeline` · `search_media`

**Timeline editing (13):** `add_clips` (auto linked-audio, duration derived from source when
omitted) · `insert_clips` (ripple) · `remove_clips` · `remove_tracks` · `move_clips` ·
`apply_layout` · `set_clip_properties` · `set_keyframes` · `split_clips` (by clip or whole-track
frames) · `ripple_delete_ranges` (track mode or clip mode, frames or seconds) · `remove_words` ·
`sync_audio` · `undo`

**Text & captions (3):** `add_texts` (full typography: font, size, bold/italic, color, alignment,
outline, background box, animation preset, transform) · `update_text` (by clip ids **or a whole
caption group at once**) · `add_captions`

**Color & effects (3):** `apply_color` · `apply_effect` · `inspect_color`

**Media library (8):** `import_media` · `list_folders` · `create_folder` · `move_to_folder` ·
`rename_media` · `rename_folder` · `delete_media` · `delete_folder`

**Project (3):** `export_project` · `set_project_settings` (fps, dimensions, aspect presets
16:9 / 9:16 / 1:1 / 4:3 / 2.4:1 / 9:14) · `list_models`

**Generation (4):** `generate_video` · `generate_image` · `generate_audio` · `upscale_media` —
run on hosted providers (Fal/Replicate) with the user's own key; honest signed-out responses
otherwise.

**Skills (2):** `list_skills` · `read_skill`

**Motion graphics (3):** `generate_title` (local canvas titles — always works) ·
`generate_motion` (template motion) · `compose_motion` (the generative engine, below)

**Analysis & perception (6):** `analyze_audio` · `extract_palette` · `match_motion` ·
`detect_scenes` · `import_from_url` · `see_video`

**Reliability guarantees of the tool surface**
- No phantom successes: a mutation that changed nothing (bad track index, unknown clip id) returns
  an error, never a fake "done".
- Exports report `missingMedia` with a degraded status when any clip couldn't be decoded — a
  "successful" file of placeholder tiles is never reported as clean.
- `overwrite:false` protects existing files on export.
- Every tool answers minimal/invalid arguments with a clean, actionable error (audited live:
  52/52, no crashes, no hangs, no leaked stack traces).

---

## 3. Perception (all on-device — nothing is uploaded)

- **Word-level transcription** — whisper.cpp, on-device; word timings in ms and frames;
  language-aware (BCP-47 hint switches to the multilingual model); per-media caching.
- **Frame vision** (`see_video`) — returns real labeled frames so the AI *sees* footage: subject,
  framing, best moments; interval mode (overview) or scene mode (distinct shots).
- **Beat & silence detection** (`analyze_audio`) — tempo, beat/onset frames, and dead-air ranges
  for rhythm cuts and jump-cuts; safe on hours-long audio.
- **Palette extraction** (`extract_palette`) — dominant colors (median-cut) for a whole clip or a
  time window; used for on-brand grades and motion palettes.
- **Scene-cut detection** (`detect_scenes`) — the exact cut points of a clip with a 0–1
  cut-hardness score each, at project fps; the segmentation backbone for moment mining.
- **Reference-motion extraction** (`match_motion`) — turns a reference clip into a MotionSpec:
  beat boundaries, a per-beat palette, and a per-beat camera class (static / push-in / pull-back /
  pan + direction) via coarse optical flow — so a film can be timed to a reference's rhythm.

---

## 4. Word-level editing

- **Captions on the word**: transcript-timed caption clips, chunked (configurable words per
  caption), overlap-clamped so consecutive captions never overwrite each other, grouped under a
  shared caption-group id (restyle the whole run with one call).
- Caption styling: typography, colors, outline, background box; animation presets — fadeIn, popIn,
  slideUp, typewriter, wordReveal, wordSlide, wordPop, wordCycle, highlightPop, highlightBlock;
  karaoke-style active-word highlight color.
- **Filler-word removal** (`remove_words`): cut spoken words by transcript index or span, with
  tight / balanced / loose padding around each cut.
- Silence jump-cuts via detected dead-air ranges + ripple delete.
- **Long-form → shorts (moment mining)**: segment a long recording by its real cuts ∩ sentence
  boundaries, rank segments by hook strength, self-containment, emotional peak, and length fit,
  then build the chosen clips as 9:16 shorts — methodology shipped in the viral-reel skill.

---

## 5. The generative motion engine (`compose_motion`)

A validated, declarative **SceneSpec** (beats → layers → elements) interpreted by a Remotion
renderer. Closed enums, clamped numbers, bounded arrays, fail-loud errors naming the exact path —
and never any code execution.

**24 elements:** text · textOnPath · video · image · screenMock (**browser / phone / plain device
frames** — traffic-lights + URL bar, or a phone body with dynamic-island pill) · waveform ·
timeline · logo · shape · hairline · barChart · lineChart · areaChart · counter · captionKaraoke ·
particles · arrow · highlightBox · pointerLine · spotlightDim · splitLayout · gridLayout/filmstrip
· countdown · strikethrough

**Entrances (11):** spring (from below/left/scale, tunable damping/mass/stiffness) · typewriter ·
wordReveal · wordStagger (true per-word springs) · kinetic · draw · fade · collapse · maskReveal ·
edgeFlip (3D card flip) · blurPushUp (blur+translate overshoot)
**Exits:** fade · collapse · glitch · edgeFlip — all implemented and rendered.

**Motion craft surface:** custom cubic-bezier easing · per-property `animate` tweens (position,
opacity, scale, blur, rotation — each on its own timeline, with conflict detection against
entrances) · explicit `hold` windows · authorable beat `outFade` · camera moves (push-in,
pan-left/right, rack, parallax) with easing · Ken Burns (push/drift/zoom) · masks (iris/left/up) ·
depth planes with parallax + rack focus · motion blur with ghost trail · lighting sweep ·
transitions (wipe, dissolve, push, glitch, rgbSplit, cut, whip) with overlap frames and
beat-snapping (`meta.beatMarkers`).

**Cinematic Reel pack (9:16):** global handheld camera idle · whip-pan transition · edge-flip
cards · live-breathe card idle · blur push-up text · strikethrough emphasis · ambient palette
orbs · card shine sweep — all colored by `meta.palette` (your brand colors).

**Quality mechanisms:** validation crashes are impossible by construction (zero-duration tweens and
fractional durations are clamped; oversized specs rejected); the render bundle cache is
content-hashed so engine fixes actually reach users; the installer re-mirrors composition source on
every launch.

---

## 6. Skills — 11 editing playbooks the AI reads

Auto-advertised to every connected agent; loaded on demand with `read_skill`.

1. **build-in-kaestral** — the house rule: build on the timeline, visibly; export only through Kaestral.
2. **art-direction** — the master motion-designer playbook: decision process, optical composition,
   rhythm, restraint, transition craft, the physics of premium motion, worked examples, failure
   modes, and reference-matching with `match_motion`.
3. **shot-recipes** — a ~26-shot compositional grammar (openers, product/UI, data & proof,
   emphasis, transitions, atmosphere, closers), every card mapped to exact SceneSpec fields, plus
   film-level composition patterns.
4. **topic-to-short** — idea/script → approved script → scene beats → honestly-sourced visuals →
   VO-timed assembly → captions → brand → grade → quality gate → export; always an editable
   timeline, never a black-box render.
5. **viral-reel** — raw footage → 9:16 short: hook in 3s, jump cuts, zoom punches, captions —
   including the long-form moment-mining and ranking method.
6. **beat-sync-cutting** — cuts and punches locked to detected beats.
7. **creative-director** — palette → grade → type for a cohesive, on-brand look.
8. **caption-styles** — caption typography and animation recipes.
9. **broll-planner** — planning b-roll against the spoken script.
10. **platform-delivery** — per-platform framing/duration/export choices.
11. **promo-ad** — hook, benefit beats, CTA structure for promos.

---

## 7. Color & effects

- **Color grading:** exposure · contrast · saturation · vibrance · temperature + tint ·
  highlights/shadows · blacks/whites · 3-way wheels (lift/gamma/gain with hue+amount) · RGB +
  master curves · **hue curves** (per-hue shift/sat/lum targets) · LUTs with strength.
- **Effects:** gaussian blur · sharpen · noise reduction · motion blur · chroma key · clarity ·
  grain · vignette · glow — merged by type, rendered in a fixed canonical order.

## 8. Layouts

Named multi-clip layouts with a cover-crop solver (fill or fit, with anchor bias): full ·
side-by-side · top/bottom · four PiP corners · 2×2 grid · main+sidebar · three-up. The solver
guarantees slot-filling without stretching.

## 9. Import & export

- **Import:** local files (video/image/audio with ffprobe metadata), drag-drop, or any URL via
  `import_from_url` (user's yt-dlp).
- **Video export:** H.264 / H.265 / ProRes · 720p→4K or match-timeline · audio mixdown with
  speed-chained atempo, keyframed volume envelopes, and fades.
- **Interchange:** Premiere (XMEML) · DaVinci Resolve / FCP (FCPXML) · **SubRip captions (SRT)** ·
  `.kaestral` project package.

## 10. Trust & verification

- **310 automated tests** across every pipeline stage (validator, interpreter renders with pixel
  proofs, MCP contract, engine mutations, project round-trip, color, audio, layout, exports).
- The MCP tool names/schemas are a frozen contract enforced by tests; the server version is
  single-sourced from package.json and asserted dynamically.
- Release verification is done **in the packaged, installed app** — including a full editing
  session (import → cut → captions → grade → motion → export in three codecs and three aspect
  ratios) driven over the live engine.
- Local-first is a hard invariant: transcription, vision, beats, palette, rendering, export — all
  on-device. The only outbound traffic is your own AI prompts (your key) and the optional waitlist
  email.
