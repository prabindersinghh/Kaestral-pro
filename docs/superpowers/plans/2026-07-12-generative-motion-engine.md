# Kaestral Generative Motion Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Kaestral's agent design premium, bespoke motion-graphics videos by emitting a validated declarative SceneSpec that a trusted interpreter renders to MP4 via a deep primitive library — never executing agent-written code.

**Architecture:** Agent → `compose_motion` MCP tool → validate SceneSpec (`src/gen/sceneSpec.ts`) → render the single `Generative` Remotion composition (`remotion/src/compositions/Generative.tsx`), which interprets the spec through a primitive registry (`remotion/src/primitives/`) → existing `renderRemotion` bridge → MP4 → import + place on timeline. Fail loud: validation/render errors return actionable messages for agent retry; a template fallback is used only after retries and is always labelled `fallback:true`.

**Tech Stack:** TypeScript (strict), React 18 + Remotion (existing isolated `remotion/` workspace, rendered via `remotion/render.mjs` + headless Chromium), Vitest, MCP JSON-RPC executor.

## Global Constraints

- **Work on `main`.** Do NOT use the stale `pro-tier-expansion` branch.
- **No agent-authored executable code is ever rendered.** SceneSpec fields are closed enums / clamped numbers / brand-token-or-hex colors only. No free-form CSS, no code, no URLs.
- **Brand tokens (single source of truth):** black `#0b0a0d`; green `#16b16a` / `#1fce7e`; gold hairline `rgba(201,162,39,0.55)`; white hairline `rgba(255,255,255,0.10)`; slate `#484852` / `#2b2931`. Type roles: Geist (display/sans) + Geist Mono.
- **Fail loud, never silent-substitute:** template fallback only after retries exhausted, always labelled `fallback:true` with a reason.
- **Quality bar:** output must match or beat `remotion/src/compositions/HeroDemo.tsx` and `CondenseReel.tsx`. The user judges rendered output visually — mediocre output does not ship.
- **Every render syncs to the app's live render dir** before showing the user: after editing anything in `remotion/`, copy `remotion/src/**` to `src-tauri/target/release/resources/remotion/src/**` and delete that copy's `.bundle-cache/` (the app renders from there; the top-level `remotion/` is the source of truth).
- **Existing render bridge (do not change its signature):** `renderRemotion(compId: string, props: Record<string, unknown>, outputPath: string, remotionDir: string): Promise<MotionResult>` where `MotionResult = { outputLocation, durationInFrames, width, height, fps }` (`src/motion/renderRemotion.ts`).
- **Compositions register in** `remotion/src/Root.tsx` via `<Composition id=... component=... calculateMetadata={dur} />`; `dur` reads `props.durationSeconds`.

---

## Task 1: SceneSpec types + validator (pure, no rendering)

**Files:**
- Create: `src/gen/sceneSpec.ts`
- Test: `src/gen/__tests__/sceneSpec.test.ts`

**Interfaces:**
- Consumes: nothing (pure module).
- Produces:
  - `type SceneSpec` — `{ meta: SceneMeta; beats: Beat[] }` (full nested types below).
  - `function validateSceneSpec(input: unknown): { ok: true; spec: SceneSpec } | { ok: false; error: string }` — `error` names the exact offending path, e.g. `"beats[0].layers[2].element: unknown value 'foo' (allowed: text, textOnPath, …)"`. Clamps numeric fields in-range on success. Never throws.
  - Exported constants used by later tasks: `ELEMENTS`, `ANIMS`, `EASINGS`, `CAMERA_MOVES`, `BG_KINDS`, `TRANSITIONS`, `MASK_SHAPES`, `STYLE_ROLES`, `ASPECTS` (all `readonly string[]`), and `BRAND_TOKENS: Record<string,string>` (token name → hex/rgba), `isAllowedColor(c: string): boolean`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/gen/__tests__/sceneSpec.test.ts
import { describe, it, expect } from "vitest";
import { validateSceneSpec } from "../sceneSpec";

const minimal = {
  meta: { aspect: "16:9", fps: 30 },
  beats: [{ durationInFrames: 60, layers: [{ element: "text", props: { text: "Hi" } }] }],
};

describe("validateSceneSpec", () => {
  it("accepts a minimal valid spec and fills defaults", () => {
    const r = validateSceneSpec(minimal);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.spec.meta.brand).toBe("kaestral");          // default
      expect(r.spec.beats[0].layers[0].opacity).toBe(1);   // default
    }
  });

  it("rejects an unknown element with the offending path", () => {
    const bad = { ...minimal, beats: [{ durationInFrames: 60, layers: [{ element: "foo", props: {} }] }] };
    const r = validateSceneSpec(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/beats\[0\]\.layers\[0\]\.element/);
  });

  it("clamps out-of-range numbers instead of failing", () => {
    const big = { ...minimal, beats: [{ durationInFrames: 99999, layers: [{ element: "text", props: { text: "x" }, opacity: 5 }] }] };
    const r = validateSceneSpec(big);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.spec.beats[0].durationInFrames).toBe(600);  // clamp max
      expect(r.spec.beats[0].layers[0].opacity).toBe(1);   // clamp max
    }
  });

  it("rejects a non-brand, non-hex color with the path", () => {
    const bad = { ...minimal, beats: [{ durationInFrames: 60, background: { kind: "solid", accent: "javascript:alert(1)" }, layers: [{ element: "text", props: { text: "x" } }] }] };
    const r = validateSceneSpec(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/accent/);
  });

  it("requires at least one beat", () => {
    const r = validateSceneSpec({ meta: { aspect: "16:9", fps: 30 }, beats: [] });
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/gen/__tests__/sceneSpec.test.ts`
Expected: FAIL — `Cannot find module '../sceneSpec'`.

- [ ] **Step 3: Implement `src/gen/sceneSpec.ts`**

Write the module with: the closed-enum constants; nested types `SceneMeta`, `Beat`, `Layer`, `Enter`, `Exit`, `LayerStyle`, `Camera`, `Background`, `TransitionOut`, `Mask`, `KenBurns`, `LightingSweep`; a `clamp(n,min,max,def)` helper; `isAllowedColor` (matches a `BRAND_TOKENS` value OR `/^#([0-9a-f]{6})$/i`); and `validateSceneSpec` that walks the structure, returns `{ok:false,error}` with the exact path on the first closed-enum/color/shape violation, and otherwise returns `{ok:true,spec}` with all numbers clamped and defaults filled (`meta.brand="kaestral"`, `meta.fps=30`, layer `opacity=1`, `blur=0`, `position={x:0.5,y:0.5}`, `depth="mid"`, `motionBlur=false`). Bounds: `durationInFrames` 8..600; `opacity` 0..1; `blur` 0..24; `position.x/y` 0..1; `camera.amount` 0..0.3; `style.size` 0.01..0.4. Enumerate `ELEMENTS`, `ANIMS`, `EASINGS`, `CAMERA_MOVES`, `BG_KINDS`, `TRANSITIONS`, `MASK_SHAPES`, `STYLE_ROLES`, `ASPECTS` exactly as in the spec's SceneSpec block.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/gen/__tests__/sceneSpec.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/gen/sceneSpec.ts src/gen/__tests__/sceneSpec.test.ts
git commit -m "feat(motion): SceneSpec types + fail-loud validator with clamps and brand-token colors"
```

---

## Task 2: Brand tokens + first primitives (Text, Shape, Grid, GlowField, LogoMark)

**Files:**
- Create: `remotion/src/primitives/tokens.ts`
- Create: `remotion/src/primitives/Text.tsx`, `Shape.tsx`, `Grid.tsx`, `GlowField.tsx`, `LogoMark.tsx`
- Create: `remotion/src/primitives/index.ts` (the registry)
- Test: `src/gen/__tests__/primitivesRegistry.test.ts` (asserts the registry exports every element name in `ELEMENTS`)

**Interfaces:**
- Consumes: `ELEMENTS` from `src/gen/sceneSpec.ts` (imported by the registry test only — the `remotion/` workspace is standalone).
- Produces:
  - `remotion/src/primitives/tokens.ts` → `export const TOKENS` (the brand palette + type roles), `export function tokenColor(role|token: string): string`.
  - Each primitive: `export const Text: React.FC<PrimitiveProps>` etc., where `PrimitiveProps = { props: Record<string,unknown>; frame: number; fps: number; width: number; height: number; opacity: number; blur: number; position: {x:number;y:number}; enter?: EnterSpec; style?: StyleSpec }` (define `PrimitiveProps` in `remotion/src/primitives/types.ts`).
  - `remotion/src/primitives/index.ts` → `export const REGISTRY: Record<string, React.FC<PrimitiveProps>>` mapping each `element` name to a component (unimplemented ones may map to a `Noop` placeholder for now — later tasks replace them).

- [ ] **Step 1: Write the failing test**

```typescript
// src/gen/__tests__/primitivesRegistry.test.ts
import { describe, it, expect } from "vitest";
import { ELEMENTS } from "../sceneSpec";
import { REGISTRY } from "../../../remotion/src/primitives/index";

describe("primitive registry", () => {
  it("has an entry for every SceneSpec element", () => {
    for (const el of ELEMENTS) expect(REGISTRY[el], `missing primitive: ${el}`).toBeTypeOf("function");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/gen/__tests__/primitivesRegistry.test.ts`
Expected: FAIL — cannot find `remotion/src/primitives/index`.

- [ ] **Step 3: Implement tokens + the five primitives + registry**

- `tokens.ts`: export `TOKENS` (black/green/greenHi/gold/white/slate/slate2 + `fontSans:"Inter,Helvetica,Arial,sans-serif"`, `fontMono:"'SF Mono',Consolas,monospace"`) and `tokenColor(x)` (resolves a role/token name to hex; passes through `#rrggbb`).
- `types.ts`: `PrimitiveProps` (above) + `EnterSpec`, `StyleSpec`.
- `Text.tsx`: implement the 5 enter modes (spring/typewriter/wordReveal/kinetic/fade — karaoke handled by CaptionKaraoke later; treat unknown as fade) using `interpolate`/`spring`; honor `opacity`, `blur`, `position` (absolute % placement), `style.role`→color, `style.size`→`fontSize = size*height`. Reuse the exact look from `HeroDemo.tsx` beat 3 (white display + green accent, letter-spacing) as the quality baseline.
- `Shape.tsx`: rect/pill/circle/line via `props.shape`, spring or draw entrance, token fill.
- `Grid.tsx`: the drifting timeline grid from `HeroDemo.tsx` (`Grid` there) as a primitive.
- `GlowField.tsx`: the kestrel-eye radial bloom (breathing) from `HeroDemo.tsx`.
- `LogoMark.tsx`: the three-bar assembling mark from `HeroDemo.tsx` (`LogoMark` there).
- `index.ts`: a `Noop` component; `REGISTRY` maps every name in the spec's `ELEMENTS` list — real ones to their components, not-yet-built ones to `Noop`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/gen/__tests__/primitivesRegistry.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add remotion/src/primitives src/gen/__tests__/primitivesRegistry.test.ts
git commit -m "feat(motion): brand tokens + first primitives (Text/Shape/Grid/GlowField/LogoMark) + registry"
```

---

## Task 3: Generative interpreter composition + register it

**Files:**
- Create: `remotion/src/compositions/Generative.tsx`
- Modify: `remotion/src/Root.tsx` (add the `Generative` composition; dimensions come from `props.spec.meta.aspect`)
- Test: `src/gen/__tests__/generativeRender.test.ts` (headless render of a minimal spec → non-blank MP4)

**Interfaces:**
- Consumes: `REGISTRY`, `PrimitiveProps` (Task 2); the render bridge `renderRemotion` (existing).
- Produces: a Remotion composition with `id="Generative"` taking `{ spec: SceneSpec }` as a prop. `calculateMetadata` computes `durationInFrames = sum(beats.durationInFrames)` and `width/height` from `meta.aspect` (16:9→1920×1080, 9:16→1080×1920, 1:1→1080×1080).

- [ ] **Step 1: Write the failing test**

```typescript
// src/gen/__tests__/generativeRender.test.ts
import { describe, it, expect } from "vitest";
import { renderRemotion } from "../../motion/renderRemotion";
import { validateSceneSpec } from "../sceneSpec";
import { join } from "node:path";
import { statSync } from "node:fs";

const remotionDir = join(process.cwd(), "remotion");

describe("Generative render", () => {
  it("renders a minimal spec to a non-trivial MP4", async () => {
    const v = validateSceneSpec({
      meta: { aspect: "16:9", fps: 30 },
      beats: [{ durationInFrames: 30, background: { kind: "glow", accent: "#16b16a" },
        layers: [{ element: "text", props: { text: "Kaestral" }, style: { role: "display", size: 0.1 }, enter: { anim: "spring" } }] }],
    });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const out = join(remotionDir, ".test-out", "gen.mp4");
    const res = await renderRemotion("Generative", { spec: v.spec }, out, remotionDir);
    expect(res.width).toBe(1920);
    expect(statSync(out).size).toBeGreaterThan(10000);
  }, 240000);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/gen/__tests__/generativeRender.test.ts`
Expected: FAIL — composition `Generative` not found.

- [ ] **Step 3: Implement `Generative.tsx` + register**

`Generative.tsx`: `AbsoluteFill`; iterate `spec.beats` inside sequential `<Sequence from=… durationInFrames=…>` (accumulate offsets); per beat render the `background` (map `kind`→Grid/GlowField/solid), wrap in the `Camera` treatment (push-in/pan via `interpolate` on a scale/translate — inline for now, extracted in Task 6), then map each `layer` to `REGISTRY[layer.element]` passing `PrimitiveProps` (compute `frame` local to the beat via `useCurrentFrame`). Apply `opacity`/`blur`/`position` on a wrapper `div`. In `Root.tsx` add `<Composition id="Generative" component={Generative} calculateMetadata={({props}) => ({ durationInFrames, width, height })} defaultProps={{ spec: <the minimal spec> }} />`.
Then sync to the app render dir and bust cache:
```bash
cp -r remotion/src/* src-tauri/target/release/resources/remotion/src/
rm -rf remotion/.bundle-cache src-tauri/target/release/resources/remotion/.bundle-cache
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/gen/__tests__/generativeRender.test.ts`
Expected: PASS (first run is slow — bundles + fetches Chromium).

- [ ] **Step 5: Commit**

```bash
git add remotion/src/compositions/Generative.tsx remotion/src/Root.tsx src/gen/__tests__/generativeRender.test.ts
git commit -m "feat(motion): Generative interpreter composition rendering a SceneSpec via the primitive registry"
```

---

## Task 4: `compose_motion` MCP tool (fail-loud, labelled fallback) + wiring

**Files:**
- Modify: `src/mcp/toolDefs.ts` (add the `compose_motion` tool definition after `generate_motion`)
- Modify: `src/mcp/executor.ts` (add `composeMotion(a)`; register `case "compose_motion"`; add to the tool-name allowlist near line 508)
- Test: `src/mcp/__tests__/composeMotion.test.ts`

**Interfaces:**
- Consumes: `validateSceneSpec` (Task 1), `renderRemotion` (existing), the existing `generateMotion` fallback path, `this.media.addAsset` / `this.engine.addClips` / `this.ensureTrack` (existing executor methods, see `generateMotion` at `src/mcp/executor.ts:419`).
- Produces: tool `compose_motion` with input `{ spec: object, place?: boolean }`. Result on success: `okJson({ assetId, name:"Motion: generative", frames, width, height, engine:"generative", fallback:false, placed })`. On validation failure: `err(<exact path message>)` (no render). On render failure after one retry-safe attempt: render the deterministic template fallback and return `okJson({ ..., engine:"remotion-template", fallback:true, fallbackReason })`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/mcp/__tests__/composeMotion.test.ts
import { describe, it, expect } from "vitest";
import { McpExecutor } from "../executor";
// Build an executor the same way other executor tests do (see analysisTools.test.ts for the setup helper).

describe("compose_motion", () => {
  it("rejects an invalid spec loudly without rendering", async () => {
    const exec = /* construct as in analysisTools.test.ts */ null as unknown as McpExecutor;
    const res = await exec.call("compose_motion", { spec: { meta: { aspect: "16:9", fps: 30 }, beats: [] } });
    expect(res.isError).toBe(true);
    expect(String(res.content?.[0]?.text)).toMatch(/beats/);
  });

  it("renders a valid spec and reports engine=generative, fallback=false", async () => {
    const exec = /* construct */ null as unknown as McpExecutor;
    const spec = { meta: { aspect: "16:9", fps: 30 }, beats: [{ durationInFrames: 24, layers: [{ element: "text", props: { text: "Hi" }, enter: { anim: "spring" } }] }] };
    const res = await exec.call("compose_motion", { spec, place: false });
    const j = JSON.parse(String(res.content?.[0]?.text));
    expect(j.engine).toBe("generative");
    expect(j.fallback).toBe(false);
  }, 240000);
});
```

> Note: mirror the exact executor-construction helper used in `src/mcp/__tests__/analysisTools.test.ts`. If that test exposes a `makeExecutor()`-style helper, import it; otherwise copy its setup verbatim into this file.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/mcp/__tests__/composeMotion.test.ts`
Expected: FAIL — `unknown tool 'compose_motion'`.

- [ ] **Step 3: Implement the tool + executor method**

In `toolDefs.ts`, add `compose_motion` with a description that teaches the agent the SceneSpec shape (aspect/beats/layers/elements/animations/modifiers/beat-sync) and states: emit JSON, never code; on error you get the exact path — fix and retry. Input schema: `obj({ spec: obj({}, []), place: { type: "boolean" } }, ["spec"])` (spec validated in the executor, not the JSON schema).
In `executor.ts`, add `private async composeMotion(a: Args)`: `const v = validateSceneSpec((a as any).spec); if (!v.ok) return err(\`compose_motion: ${v.error}\`);` → render `renderRemotion("Generative", { spec: v.spec }, outputPath, remotionDir())` inside try/catch → on success add asset + place (copy the asset/place block from `generateMotion`) and return `okJson({..., engine:"generative", fallback:false})`. On catch: pick the deterministic template (chart-dominant→DataViz, logo-dominant→LogoReveal, else AnimatedIntro with the spec's first text as title), render it, return `okJson({..., engine:"remotion-template", fallback:true, fallbackReason: String(e).slice(0,300)})`. Register `case "compose_motion": return this.composeMotion(a);` and add `"compose_motion"` to the allowlist array.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/mcp/__tests__/composeMotion.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Typecheck + full test sweep**

Run: `npx tsc --noEmit && npx vitest run src/mcp`
Expected: exit 0; all MCP tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/mcp/toolDefs.ts src/mcp/executor.ts src/mcp/__tests__/composeMotion.test.ts
git commit -m "feat(motion): compose_motion MCP tool — validate, render generative, labelled template fallback"
```

---

## Task 5: 🚦 EARLY QUALITY GATE #1 — first agent-authored render, shown to the user

**Files:**
- Create: `docs/superpowers/gate/spec-launch-v1.json` (a hand-authored-as-if-agent SceneSpec for a launch film, using only Task-2 primitives)
- No production code — this is a checkpoint.

**Interfaces:** Consumes everything from Tasks 1–4.

- [ ] **Step 1: Author a launch-film SceneSpec** using only the primitives that exist so far (Text, Shape, Grid, GlowField, LogoMark, background glow/grid, camera push-in). 4–5 beats, brand tokens, spring/wordReveal text, logo landing — aim at HeroDemo quality with the current toolset.

- [ ] **Step 2: Render it via the app pipeline**

Run:
```bash
cd remotion && node render.mjs Generative "$(cat ../docs/superpowers/gate/spec-launch-v1.json)" ../scratch-gate-launch.mp4
```
(Or invoke `compose_motion` through the running app.) Then extract 4 frames with ffmpeg.

- [ ] **Step 3: SHOW THE USER** the rendered frames + the MP4 path. Ask: does this match/beat HeroDemo? **This is the first iteration checkpoint** — capture the user's specific critiques (what reads as templated / flat / cheap).

- [ ] **Step 4: Record critiques** as a checklist appended to this task in the plan file, feeding Task 6's enrichment. Do NOT proceed to bulk-building primitives until the user has seen output and reacted.

- [ ] **Step 5: Commit the gate spec**

```bash
git add docs/superpowers/gate/spec-launch-v1.json
git commit -m "chore(motion): early quality gate #1 — first agent-style launch-film spec + user review"
```

---

## Task 6: Camera + transitions + Particles + Hairline (atmosphere slice)

**Files:**
- Create: `remotion/src/primitives/Camera.tsx`, `Particles.tsx`, `Hairline.tsx`, `Transitions.tsx` (wipe/dissolve/push/glitch/rgbSplit/cut)
- Modify: `remotion/src/compositions/Generative.tsx` (use `Camera` wrapper per beat; apply `transitionOut` between beats), `remotion/src/primitives/index.ts` (register `particles`, `hairline`)
- Test: extend `src/gen/__tests__/generativeRender.test.ts` with a 2-beat spec that uses a transition + particles + camera push-in and asserts a non-blank render.

**Interfaces:**
- Produces: `Camera` (wraps children, applies push-in/pan/rack/parallax by `move`+`amount`), `Transitions` (a `applyTransition(kind, progress, accent)` returning style/overlay), `Particles`/`Hairline` primitives (constellation motif + drawing gold/white rules).

- [ ] **Step 1: Write the failing test** (2-beat spec with `transitionOut:{kind:"wipe"}`, a `particles` layer, `camera:{move:"push-in",amount:0.08}`) asserting `statSync(out).size > 10000` and correct dims.
- [ ] **Step 2: Run → FAIL** (particles maps to Noop / no transition yet). `npx vitest run src/gen/__tests__/generativeRender.test.ts`
- [ ] **Step 3: Implement** the four files; wire `Camera` + `transitionOut` into `Generative.tsx`; register `particles`/`hairline`. Port `Particles` from the landing constellation mesh idea + `HeroDemo` motion. Sync to app render dir + bust cache (see Global Constraints).
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** `git commit -m "feat(motion): Camera moves, beat transitions, Particles, Hairline primitives"`

---

## Task 7: Data primitives (BarChart, LineChart, AreaChart, Counter) + Waveform + Timeline + CaptionKaraoke

**Files:**
- Create: `remotion/src/primitives/{BarChart,LineChart,AreaChart,Counter,Waveform,Timeline,CaptionKaraoke}.tsx`
- Modify: `remotion/src/primitives/index.ts` (register all seven)
- Test: extend `generativeRender.test.ts` with a data-story spec (barChart + counter + text) → non-blank render.

**Interfaces:** Produces the seven primitives, each honoring `PrimitiveProps` + count-up/draw-on/stagger animations, token colors. `Waveform` supports `props.fillerIdx` + collapse; `Timeline` supports growing tracks + sweeping playhead; `CaptionKaraoke` supports `props.words` + per-word highlight timing (and `snapToBeat` via `meta.beatMarkers` passed through).

- [ ] **Step 1: Write the failing test** (data-story spec). — [ ] **Step 2: Run → FAIL.** — [ ] **Step 3: Implement** the seven (reuse `CondenseReel.tsx` Waveform/CaptionKaraoke look as the baseline). Sync + bust cache. — [ ] **Step 4: Run → PASS.** — [ ] **Step 5: Commit** `"feat(motion): data charts, waveform, timeline, karaoke-caption primitives"`

---

## Task 8: Media + callout primitives (Video, Image, ScreenMock, Arrow, HighlightBox, PointerLine, SpotlightDim)

**Files:**
- Create: `remotion/src/primitives/{Video,Image,ScreenMock,Arrow,HighlightBox,PointerLine,SpotlightDim}.tsx`
- Modify: `remotion/src/primitives/index.ts`; `src/gen/sceneSpec.ts` (validate that `video`/`image` `props.src` resolves inside the project media set — add a `validateMediaPath` hook that the executor supplies the allowed paths to)
- Modify: `src/mcp/executor.ts` (`composeMotion` passes the project's known media absolute paths into validation)
- Test: extend `sceneSpec.test.ts` (media path outside the set is rejected); extend `generativeRender.test.ts` (a spec with an `image` layer using a real sample asset renders).

**Interfaces:** Produces the seven primitives. `Video`/`Image` honor `mask`, `kenBurns`, chrome framing via `ScreenMock`. Adds `validateSceneSpec(input, { allowedMediaPaths?: string[] })` optional 2nd arg; when provided, `video`/`image` `src` must be in the set (path traversal / arbitrary FS blocked).

- [ ] **Step 1: Write the failing tests.** — [ ] **Step 2: Run → FAIL.** — [ ] **Step 3: Implement** primitives + the media-path allowlist; use `public/sample-image.png` / `public/sample-video.mp4` in the render test. Sync + bust cache. — [ ] **Step 4: Run → PASS.** — [ ] **Step 5: Commit** `"feat(motion): media (Video/Image/ScreenMock) + callout primitives with media-path allowlist"`

---

## Task 9: Premium-motion primitives (Mask/Reveal, Split/Grid layouts, DepthOfField, MotionBlur, TextOnPath, LightingSweep, KenBurns, Stingers)

**Files:**
- Create: `remotion/src/primitives/{Mask,SplitLayout,GridLayout,TextOnPath,Countdown}.tsx` and modifier helpers `remotion/src/primitives/modifiers.ts` (`applyDepthOfField`, `applyMotionBlur`, `applyKenBurns`, `applyLightingSweep`)
- Modify: `remotion/src/compositions/Generative.tsx` (apply per-layer modifiers `mask`/`depth`/`motionBlur`/`kenBurns`/`lightingSweep` around whatever element the layer holds; `splitLayout`/`gridLayout`/`countdown`/`textOnPath` as elements that nest child layers)
- Modify: `remotion/src/primitives/index.ts`
- Test: extend `generativeRender.test.ts` — a spec exercising a masked reveal, a 2×2 grid layout, motion-blur on a moving layer, Ken Burns on an image, and a glitch stinger → non-blank render; a frame test confirming the mask actually clips (sample a pixel expected to be transparent/background).

**Interfaces:** Produces the layout/mask/path primitives + the four modifier functions. `Generative.tsx` composes modifiers in a fixed order: kenBurns → element → mask → depth-of-field blur → motion-blur → lighting-sweep → opacity/position wrapper.

- [ ] **Step 1: Write the failing tests.** — [ ] **Step 2: Run → FAIL.** — [ ] **Step 3: Implement.** This is the deep-quality task — port/borrow the best of `HeroDemo`/`CondenseReel` and go beyond. Sync + bust cache. — [ ] **Step 4: Run → PASS.** — [ ] **Step 5: Commit** `"feat(motion): premium primitives — mask/reveal, split/grid, DOF, motion-blur, text-on-path, lighting-sweep, Ken Burns, stingers"`

---

## Task 10: 🚦 BLOCKING QUALITY GATE — three agent-authored films, user judges

**Files:**
- Create: `docs/superpowers/gate/{saas-demo,data-story,launch-film}.json` (SceneSpecs authored as the agent would, using the full primitive set)
- No production code.

**Interfaces:** Consumes the entire engine (Tasks 1–9).

- [ ] **Step 1: Author three SceneSpecs** — (a) SaaS product demo (ScreenMock + Video + callouts + text + camera), (b) data-story (charts + counters + narrative text + beat-sync), (c) launch film (cinematic text + logo + particles + camera + stingers).
- [ ] **Step 2: Render all three** via `compose_motion` (or `node render.mjs Generative …`). Confirm each result reports `engine:"generative", fallback:false` (a `fallback:true` here is a FAIL — the bespoke render must succeed).
- [ ] **Step 3: Extract frames + SHOW THE USER** all three, side-by-side with `HeroDemo`/`CondenseReel`.
- [ ] **Step 4: The user judges.** If any looks templated/generic/flat: capture the specific critique, **loop back to Task 9 (or the relevant primitive)**, enrich, re-render, show again. Repeat until the user approves all three with their own eyes.
- [ ] **Step 5: Commit the approved gate specs** `git commit -m "chore(motion): blocking quality gate passed — 3 agent-authored films approved by user"`

---

## Task 11: Windows-build blocker — ship `resources/remotion/node_modules` in the installer

**Files:**
- Modify: `scripts/prepare-resources.mjs` (ensure `remotion/node_modules` is installed + copied into `src-tauri/resources/remotion/`)
- Modify: `src-tauri/tauri.conf.json` if a bundle-resource glob currently excludes `node_modules`
- Test: `src/gen/__tests__/resourcesRemotion.test.ts` — asserts `src-tauri/resources/remotion/node_modules/remotion` exists after `prepare-resources` runs (or an equivalent presence check).

**Interfaces:** Produces a build where a freshly-installed app can render motion without a runtime `npm install`.

- [ ] **Step 1: Write the failing test** asserting the packaged remotion has `node_modules` (`existsSync(join(res,"remotion","node_modules","remotion"))`).
- [ ] **Step 2: Run → FAIL** (node_modules missing from resources).
- [ ] **Step 3: Implement** — in `prepare-resources.mjs`, before copying `remotion/`, run `npm ci --omit=dev` (or `npm install --omit=dev`) inside `remotion/` if `remotion/node_modules` is absent, then copy the whole `remotion/` (incl. `node_modules`) to `src-tauri/resources/remotion/`. Confirm `tauri.conf.json` `resources: ["resources/**/*"]` doesn't exclude it.
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** `"fix(build): ship remotion/node_modules in app resources so generation works on a fresh install"`

---

## Task 12: Windows-build blocker — implement `inspect_media` + `inspect_timeline`

**Files:**
- Modify: `src/mcp/executor.ts` (replace the `unavailable(...)` stubs at ~line 543/545 with real implementations)
- Test: `src/mcp/__tests__/inspectTools.test.ts`

**Interfaces:**
- `inspect_media`: given a media asset id, return real metadata via ffprobe (`MAESTRO_FFPROBE`) — width/height/duration/fps/hasAudio/codec — plus a few sampled frame descriptions if a frame-sampler exists (`src/vision/frames.ts`); otherwise metadata-only, honestly labelled.
- `inspect_timeline`: return a structured summary of the current project timeline (tracks, clips with in/out/frames, total duration) from the in-memory engine state — no compositing render required.

- [ ] **Step 1: Write the failing tests** — `inspect_timeline` returns tracks/clips for a project with one placed clip; `inspect_media` returns width/height/duration for `public/sample-video.mp4`.
- [ ] **Step 2: Run → FAIL** (returns the "not available in this build" stub).
- [ ] **Step 3: Implement** both using existing helpers (ffprobe wrapper as in `renderVideo`/`mediaPath`; engine state as `get_timeline` uses). Remove them from the stub list.
- [ ] **Step 4: Run → PASS + full sweep** `npx tsc --noEmit && npx vitest run`.
- [ ] **Step 5: Commit** `"fix(mcp): implement inspect_media (ffprobe) + inspect_timeline (engine state) — remove Windows stubs"`

---

## Task 13: Rebuild app, verify engine live, final sweep

**Files:** none (build + verification).

- [ ] **Step 1:** `npm run build && npm run bundle:server && node scripts/prepare-resources.mjs`
- [ ] **Step 2:** `cd src-tauri && cargo build --release` (or `npx tauri build --no-bundle` for the embedded-frontend exe).
- [ ] **Step 3:** Launch the exe; confirm the window loads (not "localhost refused"), engine reports `kaestral`, and `compose_motion` renders a generative film end-to-end from the running app.
- [ ] **Step 4:** `npx tsc --noEmit && npx vitest run` — all green.
- [ ] **Step 5: Commit** any resource/build changes `"chore: rebuild with generative motion engine + windows fixes; verified live"`

---

## Self-Review (completed)

- **Spec coverage:** SceneSpec+validator→T1; primitives (all groups incl. premium set)→T2/6/7/8/9; interpreter→T3; compose_motion + fail-loud/labelled-fallback→T4; media-path safety→T8; PixiJS forward-compat→registry in T2 (element-name indirection); early gate→T5; blocking 3-film gate→T10; Windows node_modules→T11; inspect stubs→T12; testing→each task; brand tokens→T2. All spec sections map to a task.
- **Placeholder scan:** the only deliberately-deferred detail is the executor-construction helper in T4/T5 tests — flagged with the exact file to mirror (`analysisTools.test.ts`), not a silent TODO.
- **Type consistency:** `PrimitiveProps`, `REGISTRY`, `validateSceneSpec` return shape, `MotionResult`, and the `okJson` result keys (`engine`/`fallback`) are used consistently across T1–T12.
- **Sequencing:** quality gate at T5 (early, after a thin vertical slice) and T10 (blocking, full set) — output shown to the user early and often, as required.
