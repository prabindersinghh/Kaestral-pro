# Kaestral Pro Tier Expansion — Design Spec

**Date:** 2026-07-12
**Branch:** `pro-tier-expansion` (main stays the shippable v1 — do not destabilize)
**Status:** Approved design → implementation

## Goal

Expand Kaestral's **Pro tier** (hidden behind the existing `genDevMode` flag) with five
subsystems. The **free tier keeps its 3 headline features unchanged**. Reimplement from ideas —
never copy GPL/AGPL source. Every subsystem extends an existing seam; nothing greenfield.

## Non-negotiable licensing rule (protects the paid tier)

- **No GPL/AGPL/LGPL source enters Kaestral, ever.** For GPL projects: study what they do and
  where they fall short, reimplement in our own code from first principles / published algorithms,
  and improve on it.
- **Permissive (MIT/Apache/BSD) may be used directly**, with attribution in `NOTICE.md`.
- An **adversarial license audit** runs at the end and must confirm the Pro tier is airtight.

**"Bundle" defined:** bundling a local engine (Real-ESRGAN, Piper) means shipping it as an
*optional local backend the app shells out to when present*, with a hosted BYOK fallback and a clear
"install this engine" message when absent — never a hard build/test/runtime dependency. Unit tests
stub the engine; the real binary/weights are a user-side install documented in the guide.

## Build priority (locked by CTO)

Things the user can test locally at no cost come first; cloud/key-dependent last:
**(a)** advanced captions + PixiJS motion graphics → **(b)** dubbing/translation (India play) →
**(c)** upscaling → **(d)** GPU generation.

## Existing seams this builds on (verified in code)

- `src/gen/hosted.ts` — `GenProvider = "fal" | "replicate" | "gcp-ltx"`, a `MODELS` map, `runFal` /
  `runReplicate` / `runGcpLtx`, `falInput()` per-model input shaping, `findMediaUrl()`.
- `src/gen/gcp.ts` — GPU VM lifecycle (start/stop/health). `src/gen/download.ts` — url→file.
- `src/mcp/toolDefs.ts` — `generate_video` / `generate_image` / `generate_audio` /
  `upscale_media` / `generate_title` / `generate_motion` tool defs; executed in `src/mcp/executor.ts`.
- `src/compositor/textAnimator.ts` — the existing text/caption animation compositor.
- `src/audio/transcribe.ts` — whisper with **word-level timing** (already have it).
- `remotion/src/` — `Root.tsx`, `compositions/`, `index.ts` (motion graphics).
- `src/state/store.ts` — `genDevMode` Pro flag, `enableGenDev()`, `openGenerate()` (no-op unless flag).

---

## Subsystem (a1): Advanced captions — animated / karaoke / per-word

**Runs locally. No cost. Strengthens the free/headline caption feature.**

- We already have word-level whisper timestamps. Add caption **render styles** to
  `src/compositor/textAnimator.ts` (+ helpers in `src/compositor/`):
  - `karaoke` — each word's fill lights up exactly on its whisper timestamp (true word-sync).
  - `word-pop` — per-word pop/scale-in on its start time.
  - `highlight` — active word boxed/colored, rest dimmed.
  - `typewriter` — characters revealed over the segment.
  - `bounce` / `word-reveal` — word-by-word entrance.
- Expose via `add_captions` gaining a `style` param (default = current behavior, so free tier is
  untouched). Update the `caption-styles` skill to teach the new styles.
- **Original vs stronger:** VideoCaptioner (GPL — ideas only) styles subtitles but has no true
  word-synced karaoke fill bound to per-word timestamps. Ours renders on the exact word boundary
  from our own whisper timing data. No GPL code touched.
- **Verify:** headless render (`renderToStaticMarkup` / node-canvas frame render) of each style;
  assert the active word changes at the right frame for its timestamp.

## Subsystem (a2): PixiJS (MIT) → richer motion graphics + templates

**Runs locally. No cost. Directly strengthens headline feature #3 (SaaS/product/story videos).**

- New `remotion/src/pixi/` layer: PixiJS-driven Remotion compositions — particles, shader
  transitions, richer scene animation, cinematic transitions.
- Four templates wired into `generate_motion` (motion `kind`): **product-demo**,
  **feature-walkthrough**, **data-story**, **launch-video**. Each takes a small prop schema
  (title, bullets/steps, data points, brand color).
- PixiJS is **MIT → used directly**, attributed in NOTICE. **Graphite (GPL) studied for ideas only.**
- **Original vs stronger:** our current motion graphics are Remotion primitives; PixiJS adds a real
  GPU-accelerated 2D scene graph (particles/shaders) most editors don't expose from a sentence.
- **Verify:** render each template to frames locally; assert non-blank output + template prop wiring.

## Subsystem (b): Translation + dubbing — flagship Pro, Hindi/Indian-first

**Pipeline over the whisper transcript. Piper local TTS runs on the user's hardware.**

- New `src/gen/dub.ts`:
  1. `translate_captions` tool — translate the whisper transcript to a target language (BYOK
     translation API), lay captions in that language. (Text path — locally verifiable.)
  2. `dub_video` tool — translate → **Piper (MIT) local TTS** (Hindi + Indian-regional voices) →
     time-align synthesized speech to segments → mux/duck under (or replace) original audio.
  - Optional **hosted BYOK voice** (ElevenLabs/Fal) as a higher-quality fallback.
- **Piper (MIT)** bundled as the default TTS engine (local, offline, CPU-fast, Indian-language
  voices). **VideoLingo (Apache-2.0)** used properly with NOTICE attribution for the pipeline shape.
- **Prioritize Hindi + Indian regional languages** (large underserved market) in voice/model defaults.
- **Original vs stronger:** VideoLingo is a script pipeline; ours is a first-class editor tool that
  dubs onto the timeline with ducking + segment alignment, Indian-language-first.
- **Verify:** `translate_captions` end-to-end locally (mock/real translation); Piper synth of a short
  Hindi line locally; assert aligned audio track added to the project.

## Subsystem (c): Upscaling — Real-ESRGAN (BSD) + optical-flow temporal pass

**Wired into existing `upscale_media`. Local engine + hosted BYOK fallback.**

- New `src/gen/upscale.ts`:
  1. Per-frame **Real-ESRGAN (BSD-3)** upscale (bundled local engine; hosted BYOK fallback).
  2. **Temporal consistency pass** — estimate optical flow between adjacent frames (FFmpeg
     `minterpolate`/`mestimate` or a light flow) and warp-blend to suppress inter-frame flicker.
- **Original vs stronger:** video2x is **AGPL (studied only, never touched)**, per-frame, and
  flickers on motion. Ours is BSD-clean and **temporally coherent** — the differentiator named by
  the CTO. All our own orchestration code.
- **Verify:** unit-test the orchestration (frame extract → upscale → temporal blend → reassemble)
  with a stub upscaler; document the real-weights/GPU run recipe.

## Subsystem (d): GPU generation — VideoCrafter / CogVideo / InfiniteTalk alongside LTX

**Needs cloud + keys. Built + wired + unit-tested; inference verified later on Fal/Replicate/GCP.**

- Extend `src/gen/hosted.ts`: add a `genModel` dimension
  (`ltx | videocrafter | cogvideo | infinitetalk`) mapping each model to the correct
  **Fal/Replicate slug + input schema** (extend `MODELS` + `falInput()`), plus a GCP option.
- **InfiniteTalk** is audio-driven (talking-head): add a branch that takes a driving audio + image
  instead of pure text→video.
- One prompt surface routes to the best model for the ask; result drops on the timeline.
- **Original vs stronger:** each upstream is single-purpose; Kaestral unifies them behind one
  prompt + timeline drop, no per-tool glue.
- **Verify:** unit-test provider routing + input shaping per model (no live GPU here); document the
  exact BYOK/GCP recipe to verify each end-to-end.

---

## Cross-cutting

- **Gating:** every new tool/UI checks `genDevMode`. Free tier (3 headline features) unchanged.
  New `generate_video` model options, `dub_video`, PixiJS templates, temporal upscale, and any Pro
  UI are Pro-only. `add_captions` `style` defaults to current behavior (safe for free tier).
- **MCP surface:** new/extended tool defs in `toolDefs.ts`, executed in `executor.ts`; keep the
  frozen `palmier-pro` server identity and `.palmier` format.
- **Branch discipline:** all work on `pro-tier-expansion`; main untouched.
- **NOTICE.md:** add Real-ESRGAN (BSD-3), PixiJS (MIT), Piper (MIT), VideoLingo (Apache-2.0).
  Note GPL projects studied-only: video2x (AGPL), VideoCaptioner (GPL), Graphite (GPL).
- **FUTURE-IDEAS.md:** move the five from "parked" to "absorbed (Pro tier)".

## Verification matrix (honest)

| Subsystem | Locally verifiable now | Needs cloud/keys/GPU later |
|---|---|---|
| a1 captions | ✅ full (headless render) | — |
| a2 PixiJS motion + templates | ✅ full (render to frames) | — |
| b translate_captions | ✅ text path | translation API key for real language |
| b dub_video (Piper) | ✅ local synth + align | hosted-voice fallback needs key |
| c upscaling orchestration | ✅ unit (stub upscaler) | Real-ESRGAN weights + GPU for real run |
| d GPU gen routing | ✅ unit (routing/input shaping) | Fal/Replicate/GCP key for inference |

## Adversarial license audit (final gate)

- Grep shipping `src/` for any copied GPL/AGPL license text or upstream code → must be none.
- Confirm every new dependency is permissive (Real-ESRGAN BSD, PixiJS MIT, Piper MIT, VideoLingo
  Apache) and attributed in NOTICE.md.
- Confirm GPL-studied projects (video2x, VideoCaptioner, Graphite) contributed **ideas only** — our
  implementations are clean-room, with a provenance comment in each new module.
- Confirm the Pro-tier code is separable and permissive-clean (the base being GPLv3 is the Palmier
  port; the Pro additions must not pull in new copyleft).

## Out of scope (YAGNI)

- No new MCP server; no change to `.palmier` format or the `palmier-pro` identity.
- No local heavy diffusion generation (GPU gen stays hosted — the user has no local GPU).
- No auto-reframe/pose tracking, no video RAG, no player rewrites (still parked).
