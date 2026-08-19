# Kaestral — Future Ideas (post-1.0)

Deferred deliberately. Not in the 1.0 launch scope.

## render_frame / preview_timeline (post-launch — HIGH value)
A tool that reads back a **composited** timeline frame (grades, effects, text, motion all baked
together) as an image, so a connected LLM can self-critique its own finished work without a full
`export_project`. Surfaced by the tool-surface audit (`docs/superpowers/TOOL-SURFACE-AUDIT.md`,
top MISSING tool) and validated during the cold-subagent gate — the controller judged rendered
frames by eye; this tool would give the LLM that same self-critique loop. Ship after 1.0.

## Other audited MISSING tools (see TOOL-SURFACE-AUDIT.md)
- `measure_legibility` — safe-margin / text-contrast check (matters most for 9:16 social).
- `version_composition` / `duplicate_clip` — non-destructive A/B branching of a grade / caption
  style / motion composition.
- Remaining MISSING items and the 6 DEEPER-LATER handler-deepening items are catalogued in the
  audit doc.

## add_captions doc/handler mismatch
Being FIXED in the 1.0 launch pass (schema documented fields the handler never read). If any
residual deepening remains after the fix, track it here.

## Powers to absorb from studied OSS repos (recon 2026-08)
Six repos studied for capabilities Kaestral can absorb, ranked by fit-to-architecture × value.
Kaestral's thesis stays fixed (editor = hands, LLM = brain; validated data, no code-exec) — each
item below is absorbed AS a tool/skill/primitive, never as a bolted-on foreign pipeline.

1. **Viral-moment ranking** (from `JayWebtech/autoshorts` — same Tauri 2 + Rust + whisper + ffmpeg
   stack). Long-form → ranked 9:16 clip candidates: transcript + beat/silence + frame vision are
   all already Kaestral tools; the missing piece is the *ranking methodology* (hook strength,
   emotional peaks, self-contained arcs). Absorb as an extension of the viral-reel skill (teach the
   connected LLM to rank moments from get_transcript + analyze_audio + see_video output) + optionally
   a `detect_scenes` analysis tool. Low effort, high value.
2. **Shot-recipe library + sound design** (from `Vincentwei1021/video-shotcraft` — Remotion-based,
   agent-skill-shaped like our art-direction). Its 152 named "shot recipe cards" (purpose, energy,
   duration, params) are a motion GRAMMAR an agent composes from — a perfect companion to
   art-direction's principles. Also: beat-mapped SFX/BGM placement methodology + a categorized
   royalty-free SFX/BGM set — Kaestral currently has NO sound-design story for generated films.
   Absorb as a "shot-recipes" skill + a small bundled royalty-free audio set + skill guidance for
   beat-synced SFX placement. Medium effort, high value.
3. **CapCut/JianYing draft interchange** (from `renezander030/capcut-cli` — reads/writes local
   JianYing draft JSON, no API). `export_project mode:"capcut"` writing an editable CapCut draft
   would reach CapCut's enormous user base the way XMEML/FCPXML reach Premiere/Resolve. Its atomic
   draft-write + lint/repair pattern is also worth copying for our own .kaestral writes.
   Medium effort, high strategic value.
4. **Idea2Video / Script2Video pipeline shape** (from `hkuds/vimax` — Python multi-agent
   Director/Screenwriter/Producer). The pattern for the planned topic→short generator: idea →
   script → scene beats → per-shot assets → assembly, with a visual-consistency engine (reference
   images, character/camera continuity) across shots. Absorb the SHAPE as a Kaestral skill + one
   orchestrating MCP tool over existing tools (generate_video/compose_motion/add_clips/add_captions),
   not the Python stack. High effort; this is the "generative engine attached to the harness" road.
5. **Device mockups + 3D point-of-interest tilt + background presets** (from
   `CristianOlivera1/openvid`). Kaestral's screenMock primitive could gain browser/OS frame chrome
   (Safari/Chrome/Arc), a focus-tilt modifier (perspective tilt toward a point of interest — cousin
   of handheld/edgeFlip), and a background preset set. Low effort, medium value for SaaS demos.
6. **`opencut-app/opencut`** — mid-rewrite (Rust core, plugin-first, headless render API, MCP
   planned). Kaestral already HAS its headline ideas (MCP-native, headless renderCli). Watch for its
   plugin architecture; nothing to absorb yet.
