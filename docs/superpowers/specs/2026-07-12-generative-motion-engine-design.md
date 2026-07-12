# Kaestral Generative Motion Engine — Design Spec

**Date:** 2026-07-12
**Branch:** `main` (this is a v1 launch blocker, not deferred Pro work)
**Status:** Approved design → implementation

## Goal

Make Kaestral's **own agent brain** design **premium, bespoke** motion-graphics videos from scratch —
not pick from the 4 fixed Remotion templates — rendered to MP4 and placed on the timeline. Output must
match or beat the hand-authored `HeroDemo.tsx` / `CondenseReel.tsx` quality bar. User's mandate: the
product ships in days and must create high-quality video with **no help from me**, using its own
mechanism, not generic templates.

## Non-negotiables

- **Safe:** the agent NEVER writes executable code. It emits a validated declarative **SceneSpec**
  (JSON). A single trusted renderer interprets it. No `eval`, no arbitrary `.tsx`, no code-exec hole.
- **Robust:** invalid spec → precise validation error → agent retries. Render failure → fallback to
  the nearest built-in template + an honest note. A bad spec can never crash or hang the app.
- **Premium by construction:** brand tokens + deep primitives so output reads as *designed*, not
  *assembled*. The quality gate (below) enforces this with real rendered output the user judges.

## Architecture (approved)

```
Agent (Kaestral's brain)
   │  designs a video as a SceneSpec (JSON)
   ▼
compose_motion  (new MCP tool)  ──►  validate SceneSpec (closed-enum schema + clamps + token allowlist)
   │                                      │ invalid → clear error → agent retries
   ▼                                      │ valid
Generative.tsx  (ONE trusted component)   │
   │   interprets spec → primitives  ◄────┘   never eval'd; a fixed interpreter over bounded data
   ▼
render.mjs (existing pipeline) ──► MP4 ──► import + place on timeline
   │  on render failure → fallback to nearest built-in template + honest note
```

### Four isolated, independently-testable units

1. **SceneSpec schema + validator** — `src/gen/sceneSpec.ts`. Pure. The contract. Tested with plain JSON.
2. **Primitives library** — `remotion/src/primitives/`. Deep set of animated building blocks. Frame-tested.
3. **Generative composition (interpreter)** — `remotion/src/compositions/Generative.tsx`. Reads a
   SceneSpec, lays out beats → layers → animations via the primitive registry. No arbitrary code.
4. **`compose_motion` tool + executor wiring** — `src/mcp/toolDefs.ts` + `src/mcp/executor.ts`.
   Validate → render via `render.mjs` → import/place → template fallback on failure.

## SceneSpec shape (the contract)

Beat-based timeline of layered elements. Every `element`, animation, camera, background, transition,
and style role is a **closed enum**; numbers are **clamped**; colors validated against a **brand-token
allowlist** + hex check. Unknown field → validation error. No free-form CSS, no code, no URLs
(media paths are validated to be inside the project's media set).

```jsonc
{
  "meta": { "aspect": "16:9" | "9:16" | "1:1", "fps": 30, "brand": "kaestral",
            "beatMarkers": [12, 30, 48]   // OPTIONAL frame indices from analyze_audio (beat-sync)
  },
  "beats": [
    {
      "durationInFrames": 75,                        // clamped 8..600
      "camera": { "move": "push-in"|"pan-left"|"pan-right"|"rack"|"parallax"|"none", "amount": 0.08 },
      "background": { "kind": "grid"|"glow"|"parallax"|"solid", "accent": "<brand token or allowed hex>" },
      "layers": [
        {
          "element": "text"|"video"|"image"|"screenMock"|"waveform"|"timeline"|"logo"
                   |"shape"|"hairline"|"barChart"|"lineChart"|"areaChart"|"counter"
                   |"captionKaraoke"|"particles"|"arrow"|"highlightBox"|"pointerLine"|"spotlightDim",
          "props": { /* element-specific, all bounded (see primitives) */ },
          "position": { "x": 0.5, "y": 0.5 },        // normalized 0..1, clamped
          "opacity": 1.0,                            // 0..1
          "blur": 0,                                 // px, clamped 0..24 (depth)
          "enter": { "anim": "spring"|"typewriter"|"wordReveal"|"kinetic"|"draw"|"fade"|"collapse",
                     "easing": "ease-out"|"spring"|"linear", "delay": 0, "from": "below"|"left"|"scale",
                     "snapToBeat": false },
          "exit":  { "anim": "fade"|"collapse"|"none", "at": 60 },
          "style": { "role": "display"|"accent"|"muted", "size": 0.09 }   // tokens, not raw CSS
        }
      ],
      "transitionOut": { "kind": "wipe"|"dissolve"|"push"|"glitch"|"cut", "accent": "<token>",
                         "snapToBeat": false }
    }
  ]
}
```

**Expressive room (all bounded):** per-layer `opacity`, `blur`, normalized `position`, per-animation
`easing`. **Beat-sync:** `meta.beatMarkers` + `snapToBeat` align animations/transitions to the music —
a differentiator, ~free since `analyze_audio` already exists.

## Primitives library (where v1 quality lives) — `remotion/src/primitives/`

Each is a small, focused, frame-testable component. All support `opacity`/`blur`/`position`/`easing`.

**Text (5 modes):** `Text` — spring, typewriter (+caret), wordReveal (staggered), kinetic (per-word
emphasis), karaoke (highlight on time/beat). Roles display/accent/muted; optional draw-in underline.

**Media (show the real product):**
- `Video` — a project clip playing inside a composed frame; device/browser chrome framing;
  scale/position/mask/corner-radius.
- `Image` — screenshot/logo with reveal + parallax drift.
- `ScreenMock` — a browser/app window frame (traffic-light chrome, URL bar) to drop a screenshot into.

**Callout / annotation (every "look here"):** `Arrow`, `HighlightBox`, `PointerLine`,
`SpotlightDim` (dim all but one region).

**Data (animated, count-up):** `BarChart`, `LineChart` (draw-on), `AreaChart` (fill sweep),
`Counter` (count-up). Staggered entrance, token colors, optional labels.

**Signal / editor motifs (instrument identity):** `Waveform` (filler-flag + collapse), `Timeline`
(ruler + growing tracks + sweeping playhead), `LogoMark` (three-bar mark assembling), `CaptionKaraoke`.

**Form & structure:** `Shape` (rect/pill/circle/line, spring/draw), `Hairline` (gold/white rules that
draw in), `Grid` (drifting), `GlowField` (kestrel-eye bloom).

**Atmosphere & motion:** `Particles` (drifting nodes + connecting lines — constellation motif),
transition primitives (wipe/dissolve/push/glitch/cut), `Camera` wrapper (push-in/pan/rack/parallax).

**Brand tokens (single source, `remotion/src/primitives/tokens.ts`):** black `#0b0a0d` · green
`#16b16a`/`#1fce7e` · gold hairline `rgba(201,162,39,.55)` · white hairline `rgba(255,255,255,.10)` ·
slate `#484852`/`#2b2931` · Geist / Geist-Mono type roles.

**Depth principle:** because every primitive honors `opacity`/`blur`/`position`/`easing`/camera, the
agent composes layered, camera-moved, beat-timed frames that read as designed. If a generated video
looks templated, that's the signal to enrich the primitive set — the quality gate enforces it.

## PixiJS — post-launch Pro enhancement (design for it now)

The renderer interprets the SceneSpec through a **primitive registry** (`element name → component`).
PixiJS-backed primitives (real GPU particles, shaders, scene-graph depth) later register under the
**same element names** with no schema change and no agent change — a drop-in upgrade, no rewrite.
**PixiJS integration will be added post-launch as a Pro enhancement, with proper testing** (it is NOT
on the v1 critical path). Recorded here and in the Pro-tier spec.

## MCP tool: `compose_motion`

- Input: a `SceneSpec` (validated). Optional `place` (default true), `durationSeconds` derived from beats.
- Flow: validate → `renderRemotion("Generative", { spec }, out, remotionDir)` → import asset → place on
  timeline. On validation error: return the precise message so the agent self-corrects. On render
  failure: fall back to a built-in template chosen by a simple deterministic rule — if the spec is
  chart-dominant → `DataViz`, logo-dominant → `LogoReveal`, else → `AnimatedIntro` (with the spec's
  first title/subtitle/accent) — and return an honest note that a fallback was used.
- Coexists with `generate_motion` (the 4 templates stay as the fallback + simple path).

## Error handling

- **Validation:** closed-enum + clamp + token allowlist in `sceneSpec.ts`; returns `{ ok:false, error }`
  with the exact offending path. Never throws into the render.
- **Render:** wrapped; timeout; failure → template fallback; the tool result always tells the truth
  about what was produced (generative vs fallback).
- **Media:** `video`/`image` paths validated to reference assets already in the project (no arbitrary FS).

## Testing

- **Unit (sceneSpec):** valid specs pass; malformed/out-of-range/unknown-enum/bad-color rejected with
  the right path; clamps applied.
- **Render (headless):** a representative SceneSpec renders to a non-blank MP4 of the expected dims/frames.
- **Primitive frame tests:** each primitive renders visibly at a sample frame (via `render.mjs` single-frame).
- **Fallback:** a spec that forces a render error returns the template fallback + honest note.

## Quality gate (user judges before ship — BLOCKING)

Kaestral itself (via `compose_motion`, agent-authored specs) generates **three real videos**:
1. **SaaS product demo** — ScreenMock/Video + callouts + text, showing a product.
2. **Data-story** — charts + counters + narrative text, beat-timed.
3. **Launch film** — cinematic text + logo + particles + camera moves.

I render them and **show the user the actual output**. They must **match or beat**
`HeroDemo`/`CondenseReel`. If any looks templated/generic, **enrich the primitives and re-generate**
until they don't. The user judges with their own eyes. **No mediocre output ships.**

## Housekeeping / notes

- **Stale branch:** `pro-tier-expansion` predates the rename + rebrand + hero work and is badly out of
  date. Do NOT build on it. Clean it up (delete or re-cut from `main`) before any Pro-tier work.
- Known Windows-build gaps to fix for v1 (separate from this engine): `resources/remotion/node_modules`
  must ship in the installer; `inspect_media`/`inspect_timeline`/transcription are stubbed.

## Out of scope (YAGNI for v1)

- Sandboxed raw-code generation (the hybrid's second path) — designed for, flag-gated, matured later.
- PixiJS/shaders/GPU particles — post-launch Pro, drop-in via the registry.
- No new MCP server; no `.palmier` format change; `generate_motion` templates stay.
