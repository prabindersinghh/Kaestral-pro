# Art-Directed Authoring Surface — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand Kaestral's SceneSpec so an LLM can express everything the three hand-authored films did (bezier easing, explicit hold, per-property animation, entrance physics, out-fades, optical placement, custom transition overlap), teach the craft via an auto-loading skill, and audit the tool surface — so a cold LLM art-directs at or above the hand-authored bar.

**Architecture:** Extend the pure validator (`src/gen/sceneSpec.ts`) with new bounded fields + fail-loud conflict detection; add a shared easing resolver used by the interpreter (`remotion/src/compositions/Generative.tsx` + primitives); ship a craft-transfer skill; produce a tool-surface audit and apply quick wins. The editor is the hands, the LLM the brain — no code-exec, validated data only.

**Tech Stack:** TypeScript (strict), Remotion (spring/interpolate/Easing.bezier), Vitest, the existing sceneSpec validator idiom (`checkUnknownKeys`/`checkEnum`/`clamp`/`checkColor`/`fail`/`isPlainObject`).

## Global Constraints

- **Safety unchanged:** the LLM emits validated declarative data only. No code, no CSS, no URLs, no `eval`/`new Function`/dynamic import. Every new field is a closed enum / clamped number / bounded array; unknown keys rejected with the exact path.
- **Fail loud, never silent:** conflicts (`animate.<prop>` + a conflicting `enter`/`exit` driver) are REJECTED with a specific message naming both drivers — never silently resolved.
- **Bezier easing range:** `curve: [x1, y1, x2, y2]`, x's clamped `[0,1]`, y's clamped `[-2,3]` (allows overshoot/anticipation).
- **Precedence (renderer):** `animate.<prop>`, when present, is the SOLE driver of that property for the beat; the validator forbids the conflicting authoring so this never silently happens.
- **1080p default / 4K opt-in unchanged. No new dependencies. Generative engine + primitives + SceneSpec all KEPT (this is expansion).**
- **Full test suite stays green; `npx tsc --noEmit` exit 0.**
- **Validator idiom (reuse, do not reinvent):** `checkUnknownKeys(obj, KEYS, path)`, `checkEnum(v, ENUM, path)`, `clamp(v, min, max, default)`, `checkColor(v, path)`, `fail(path, msg)` (throws internal ValidationError caught at the boundary), `isPlainObject(v)`. `validateSceneSpec` NEVER throws — returns `{ok:true,spec}` or `{ok:false,error}`.
- **Sync rule:** after editing anything under `remotion/`, run `cp -r remotion/src/* src-tauri/target/release/resources/remotion/src/` then `rm -rf remotion/.bundle-cache src-tauri/target/release/resources/remotion/.bundle-cache`.

---

## Task 1: Easing spec — bezier-or-preset type + validator + resolver

**Files:**
- Modify: `src/gen/sceneSpec.ts` (add `EasingSpec` type + `validateEasing`; export `resolveEasingToBezier`)
- Test: `src/gen/__tests__/easingSpec.test.ts`

**Interfaces:**
- Consumes: existing `EASINGS`, `clamp`, `fail`, `isPlainObject`, `checkEnum`.
- Produces:
  - `export type EasingSpec = (typeof EASINGS)[number] | { curve: [number, number, number, number] }`
  - `export function validateEasing(value: unknown, path: string): EasingSpec` — accepts a preset string OR `{curve:[x1,y1,x2,y2]}` (exactly 4 finite numbers; x's clamped [0,1], y's clamped [-2,3]); anything else → `fail(path, ...)`. Returns the normalized spec (clamped).
  - `export function resolveEasingToBezier(e: EasingSpec | undefined): [number, number, number, number]` — maps a preset to its bezier tuple (`ease-out`→`[0.22,0.61,0.16,1]`, `linear`→`[0,0,1,1]`, `spring`→`[0.16,1,0.3,1]`) or returns the custom curve. Default (undefined) → the `ease-out` tuple. Pure; used by the interpreter so presets and custom curves render through one path.

- [ ] **Step 1: Write the failing test**

```typescript
// src/gen/__tests__/easingSpec.test.ts
import { describe, it, expect } from "vitest";
import { validateEasing, resolveEasingToBezier } from "../sceneSpec";

describe("validateEasing", () => {
  it("accepts a preset string", () => {
    expect(validateEasing("ease-out", "p")).toBe("ease-out");
    expect(validateEasing("spring", "p")).toBe("spring");
  });
  it("accepts a 4-number bezier curve and clamps ranges", () => {
    const e = validateEasing({ curve: [0.2, 1.6, 0.3, 1] }, "p");
    expect(e).toEqual({ curve: [0.2, 1.6, 0.3, 1] });
    // x clamped to [0,1], y clamped to [-2,3]
    const c = validateEasing({ curve: [-5, 9, 2, -9] }, "p") as { curve: number[] };
    expect(c.curve).toEqual([0, 3, 1, -2]);
  });
  it("rejects a non-preset string with the path", () => {
    expect(() => validateEasing("boing", "beats[0]")).toThrow(/beats\[0\]/);
  });
  it("rejects a curve that is not exactly 4 finite numbers", () => {
    expect(() => validateEasing({ curve: [0.1, 0.2, 0.3] }, "p")).toThrow(/curve/);
    expect(() => validateEasing({ curve: [0.1, 0.2, 0.3, NaN] }, "p")).toThrow(/curve/);
  });
});

describe("resolveEasingToBezier", () => {
  it("maps presets and passes through custom curves", () => {
    expect(resolveEasingToBezier("linear")).toEqual([0, 0, 1, 1]);
    expect(resolveEasingToBezier(undefined)).toEqual([0.22, 0.61, 0.16, 1]);
    expect(resolveEasingToBezier({ curve: [0.1, 0.2, 0.3, 0.4] })).toEqual([0.1, 0.2, 0.3, 0.4]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/gen/__tests__/easingSpec.test.ts`
Expected: FAIL — `validateEasing`/`resolveEasingToBezier` not exported.

- [ ] **Step 3: Implement in `src/gen/sceneSpec.ts`**

Add near the other validators. `validateEasing`: if `typeof value === "string"` → `checkEnum(value, EASINGS, path)`. Else if `isPlainObject(value)` and `Array.isArray(value.curve)` → require length 4, each `Number.isFinite`; build `[clamp(x1,0,1,0), clamp(y1,-2,3,0), clamp(x2,0,1,1), clamp(y2,-2,3,1)]` (use the array's values; on non-finite → `fail(\`${path}.curve\`, "must be 4 finite numbers")`) and return `{curve: [...]}`. Else `fail(path, "must be a preset (ease-out|spring|linear) or { curve:[x1,y1,x2,y2] }")`. Add the `EasingSpec` type export. `resolveEasingToBezier`: `const PRESET = { "ease-out":[0.22,0.61,0.16,1], linear:[0,0,1,1], spring:[0.16,1,0.3,1] }`; return the curve for objects, the preset tuple for strings, `PRESET["ease-out"]` for undefined.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/gen/__tests__/easingSpec.test.ts`
Expected: PASS (6 assertions across 6 tests).

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit` (exit 0)
```bash
git add src/gen/sceneSpec.ts src/gen/__tests__/easingSpec.test.ts
git commit -m "feat(motion): bezier-or-preset EasingSpec + validator + resolver"
```

---

## Task 2: Enter/Exit expansion — durationFrames, spring, exit fade; wire EasingSpec into enter/exit/transition

**Files:**
- Modify: `src/gen/sceneSpec.ts` (`Enter`/`Exit`/`TransitionOut` types + `ENTER_KEYS`/`EXIT_KEYS`/`TRANSITION_OUT_KEYS` + `validateEnter`/`validateExit`/`validateTransitionOut`)
- Test: `src/gen/__tests__/sceneSpec.test.ts` (append cases)

**Interfaces:**
- Consumes: `validateEasing` (Task 1), `clamp`, `checkEnum`, `checkUnknownKeys`.
- Produces:
  - `Enter` gains `easing: EasingSpec` (was the enum), `durationFrames?: number` (clamp 1..600, default undefined = interpreter picks), `spring?: { damping: number; mass: number; stiffness: number }` (each clamped: damping 1..40, mass 0.1..5, stiffness 1..400).
  - `Exit` gains `easing?: EasingSpec` and `durationFrames?: number` (clamp 1..600); `EXIT_ANIMS` already includes `fade` — confirm.
  - `TransitionOut` gains `overlapFrames?: number` (clamp 1..60), `easing?: EasingSpec`.

- [ ] **Step 1: Write the failing test** (append to `src/gen/__tests__/sceneSpec.test.ts`)

```typescript
import { validateSceneSpec } from "../sceneSpec";
// helper to build a one-layer spec with a given layer
const specWith = (layer: object, beatExtra: object = {}) => ({
  meta: { aspect: "16:9", fps: 30 },
  beats: [{ durationInFrames: 90, layers: [{ element: "text", props: { text: "Hi" }, ...layer }], ...beatExtra }],
});

it("enter accepts a bezier curve + durationFrames + spring, clamped", () => {
  const r = validateSceneSpec(specWith({ enter: { anim: "spring", easing: { curve: [0.2, 1.6, 0.3, 1] }, durationFrames: 18, spring: { damping: 15, mass: 0.7, stiffness: 100 } } }));
  expect(r.ok).toBe(true);
  if (r.ok) {
    const e = r.spec.beats[0].layers[0].enter!;
    expect(e.easing).toEqual({ curve: [0.2, 1.6, 0.3, 1] });
    expect(e.durationFrames).toBe(18);
    expect(e.spring).toEqual({ damping: 15, mass: 0.7, stiffness: 100 });
  }
});

it("exit accepts fade + durationFrames; transitionOut accepts overlapFrames", () => {
  const r = validateSceneSpec(specWith({ exit: { anim: "fade", at: 70, durationFrames: 16 } }, { transitionOut: { kind: "wipe", overlapFrames: 22 } }));
  expect(r.ok).toBe(true);
  if (r.ok) {
    expect(r.spec.beats[0].layers[0].exit!.durationFrames).toBe(16);
    expect(r.spec.beats[0].transitionOut!.overlapFrames).toBe(22);
  }
});

it("rejects an unknown enter key with the path", () => {
  const r = validateSceneSpec(specWith({ enter: { anim: "spring", wobble: 5 } }));
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error).toMatch(/enter/);
});
```

- [ ] **Step 2: Run → FAIL** (`npx vitest run src/gen/__tests__/sceneSpec.test.ts`) — enter has no `durationFrames`/`spring`.

- [ ] **Step 3: Implement.** Update the three interfaces + key arrays (`ENTER_KEYS` add `"durationFrames","spring"`; `EXIT_KEYS` add `"easing","durationFrames"`; `TRANSITION_OUT_KEYS` add `"overlapFrames","easing"`). In `validateEnter`: `easing = validateEasing(obj.easing ?? "ease-out", \`${path}.easing\`)`; `durationFrames = obj.durationFrames === undefined ? undefined : clamp(obj.durationFrames, 1, 600, 30)`; `spring` = validate a nested object (add `validateSpringConfig(obj.spring, \`${path}.spring\`)` → `{ damping: clamp(...,1,40,15), mass: clamp(...,0.1,5,1), stiffness: clamp(...,1,400,100) }`, or undefined). In `validateExit`: add `easing`(optional via validateEasing) + `durationFrames`(optional clamp 1..600). In `validateTransitionOut`: add `overlapFrames`(optional clamp 1..60) + `easing`(optional).

- [ ] **Step 4: Run → PASS.**

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/gen/sceneSpec.ts src/gen/__tests__/sceneSpec.test.ts
git commit -m "feat(motion): enter durationFrames+spring, exit fade+duration, transition overlapFrames+easing"
```

---

## Task 3: Explicit `hold` + `position.snap` opt-out

**Files:**
- Modify: `src/gen/sceneSpec.ts` (`Layer` type + `LAYER_KEYS` + `validateLayer`; `position` sub-validation)
- Test: `src/gen/__tests__/sceneSpec.test.ts` (append)

**Interfaces:**
- Produces:
  - `Layer` gains `hold?: { startFrame: number; durationFrames: number }` (both clamped 0..600).
  - `position` gains optional `snap?: boolean` (default true). The existing `position` is `{x,y}`; extend its validation to also read `snap`.

- [ ] **Step 1: Write the failing test**

```typescript
it("layer accepts explicit hold {startFrame,durationFrames} clamped", () => {
  const r = validateSceneSpec(specWith({ hold: { startFrame: 20, durationFrames: 45 } }));
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.spec.beats[0].layers[0].hold).toEqual({ startFrame: 20, durationFrames: 45 });
});
it("position.snap defaults true and can be set false", () => {
  const a = validateSceneSpec(specWith({ position: { x: 0.28, y: 0.4 } }));
  const b = validateSceneSpec(specWith({ position: { x: 0.28, y: 0.4, snap: false } }));
  expect(a.ok && a.spec.beats[0].layers[0].position.snap).toBe(true);
  expect(b.ok && b.spec.beats[0].layers[0].position.snap).toBe(false);
});
```

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement.** Add `hold` to `LAYER_KEYS`; validate via a `validateHold` helper (`{ startFrame: clamp(...,0,600,0), durationFrames: clamp(...,0,600,0) }` or undefined). Extend the position validator: read `snap = obj.snap === undefined ? true : Boolean(obj.snap)`, add `"snap"` to the allowed position keys, return `{x,y,snap}`. Update the `Layer.position` type to include `snap: boolean`.
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Typecheck + commit** `git commit -m "feat(motion): explicit hold{startFrame,durationFrames} + position.snap opt-out"`

---

## Task 4: Per-property `animate` block + fail-loud conflict detection

**Files:**
- Modify: `src/gen/sceneSpec.ts` (`Layer` type + `LAYER_KEYS` + `validateLayer`; new `validateAnimate` + conflict check)
- Test: `src/gen/__tests__/sceneSpec.test.ts` (append)

**Interfaces:**
- Consumes: `validateEasing`, `clamp`.
- Produces:
  - `type Tween = { from: number; to: number; startFrame: number; durationFrames: number; easing: EasingSpec }` (position uses `from/to` of `{x,y}` — a `PositionTween`).
  - `Layer` gains `animate?: { position?: PositionTween; opacity?: Tween; scale?: Tween; blur?: Tween; rotation?: Tween }`.
  - Conflict rule enforced in `validateLayer` AFTER enter/exit/animate parsed: reject with a specific message.

- [ ] **Step 1: Write the failing test**

```typescript
it("accepts a per-property animate block (opacity + position on their own curves)", () => {
  const r = validateSceneSpec(specWith({
    animate: {
      opacity: { from: 0, to: 1, startFrame: 0, durationFrames: 16, easing: "ease-out" },
      position: { from: { x: 0.3, y: 0.5 }, to: { x: 0.5, y: 0.5 }, startFrame: 4, durationFrames: 20, easing: { curve: [0.2, 0.8, 0.2, 1] } },
    },
  }));
  expect(r.ok).toBe(true);
});
it("REJECTS animate.opacity + enter.anim:fade with a message naming both", () => {
  const r = validateSceneSpec(specWith({
    enter: { anim: "fade" },
    animate: { opacity: { from: 0, to: 1, startFrame: 0, durationFrames: 12, easing: "linear" } },
  }));
  expect(r.ok).toBe(false);
  if (!r.ok) { expect(r.error).toMatch(/animate\.opacity/); expect(r.error).toMatch(/enter/); }
});
it("REJECTS an unknown animate property key", () => {
  const r = validateSceneSpec(specWith({ animate: { skew: { from: 0, to: 1, startFrame: 0, durationFrames: 8, easing: "linear" } } }));
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error).toMatch(/animate/);
});
```

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement.** Add `"animate"` to `LAYER_KEYS`. `validateAnimate(obj, path)`: allowed keys `["position","opacity","scale","blur","rotation"]` via `checkUnknownKeys`; each present key validated: scalar tweens require `from`,`to` finite (clamp opacity 0..1, scale 0..8, blur 0..64, rotation -720..720), `startFrame`/`durationFrames` clamp 0..600, `easing` via `validateEasing`; `position` tween validates `from`/`to` each `{x,y}` clamped 0..1. In `validateLayer`, after enter/exit/animate: if `animate?.opacity` AND (`enter?.anim` in `["fade","spring"]` OR `exit?.anim === "fade"`) → `fail(path, \`animate.opacity conflicts with ${enter?.anim ? \`enter.anim:"${enter.anim}"\` : \`exit.anim:"fade"\`} — both drive opacity; keep one\`)`. If `animate?.position` AND `enter?.from` (any) → analogous message. If `animate?.scale` AND `enter?.anim === "kinetic"` (scale-driving) → analogous.
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Typecheck + commit** `git commit -m "feat(motion): per-property animate block + fail-loud conflict detection vs enter/exit"`

---

## Task 5: Interpreter — apply easing/hold/animate/spring/overlap/snap in the render

**Files:**
- Modify: `remotion/src/compositions/Generative.tsx` (BeatLayer + entrance/hold/exit application; overlap; snap), `remotion/src/primitives/Text.tsx` and other primitives that read `enter.easing` (route through a bezier helper), `remotion/src/primitives/pacing.ts` if it references timing.
- Modify: `remotion/src/primitives/easing.ts` (NEW) — a tiny `bezierFromSpec(easingSpec): (t:number)=>number` used by the interpreter, mirroring `resolveEasingToBezier`'s tuples so the remotion side needs no `src/gen` import.
- Test: extend `src/gen/__tests__/generativeRender.test.ts` (render a spec exercising animate+hold+bezier+overlap → non-blank MP4).

**Interfaces:**
- Consumes: the validated SceneSpec shape (Generative.tsx already mirrors it structurally — extend the local mirror types with the new optional fields).
- Produces: renders that honor: custom bezier (via `Easing.bezier(...bezierFromSpec)`), explicit `hold` (element static across window), per-property `animate` (each property tweened independently, overriding enter/exit for that property), `enter.spring` config, `transitionOut.overlapFrames` (replaces the fixed `TRANSITION_FRAMES` for that beat), `position.snap:false` (skip the baseline-grid snap in `layout.ts` for that layer).

- [ ] **Step 1: Write the failing test** (append to `generativeRender.test.ts`)

```typescript
it("renders a spec using per-property animate + hold + bezier easing + custom overlap", async () => {
  const v = validateSceneSpec({
    meta: { aspect: "16:9", fps: 30 },
    beats: [
      { durationInFrames: 60, transitionOut: { kind: "wipe", overlapFrames: 22 },
        layers: [{ element: "text", props: { text: "One" }, position: { x: 0.3, y: 0.45, snap: false },
          animate: { opacity: { from: 0, to: 1, startFrame: 0, durationFrames: 14, easing: { curve: [0.2, 0.8, 0.2, 1] } },
                     position: { from: { x: 0.3, y: 0.45 }, to: { x: 0.42, y: 0.45 }, startFrame: 0, durationFrames: 20, easing: "ease-out" } },
          hold: { startFrame: 22, durationFrames: 30 } }] },
      { durationInFrames: 60, layers: [{ element: "text", props: { text: "Two" }, enter: { anim: "spring", spring: { damping: 15, mass: 0.7, stiffness: 120 } } }] },
    ],
  });
  expect(v.ok).toBe(true);
  if (!v.ok) return;
  const out = join(remotionDir, ".test-out", "art.mp4");
  const res = await renderRemotion("Generative", { spec: v.spec }, out, remotionDir);
  expect(res.width).toBe(1920);
  expect(statSync(out).size).toBeGreaterThan(10000);
}, 240000);
```

- [ ] **Step 2: Run → FAIL** (the new fields aren't interpreted; render may ignore them or the local mirror types reject compile). `npx vitest run src/gen/__tests__/generativeRender.test.ts`
- [ ] **Step 3: Implement.** Create `remotion/src/primitives/easing.ts` exporting `bezierFromSpec(e)` (same tuples as `resolveEasingToBezier`). In `Generative.tsx`: extend the local mirror `Layer`/`Enter`/`Exit`/`TransitionOut`/`Position` types with the new optional fields; in `BeatLayer`, compute each animated property: if `layer.animate?.<prop>` present → tween `from→to` over its window with `interpolate(localFrame,[start,start+dur],[from,to],{easing:Easing.bezier(...bezierFromSpec(prop.easing)),extrapolateLeft:"clamp",extrapolateRight:"clamp"})` and mark that property as animate-driven (so enter/exit don't touch it); else fall back to the existing enter/exit path but route its easing through `bezierFromSpec(enter.easing)` and its physics through `enter.spring` when present. Apply `hold`: during `[hold.start, hold.start+dur]` freeze the element's transform/opacity at their settled values (skip residual entrance motion). Use `transitionOut.overlapFrames ?? TRANSITION_FRAMES` in the beat-overlap math. In `layout.ts` resolve: when `position.snap === false`, skip the baseline-grid quantization (keep safe-area clamp). Sync to app render dir + bust cache (Global Constraints).
- [ ] **Step 4: Run → PASS** (renders non-blank). Also `npx tsc --noEmit` exit 0.
- [ ] **Step 5: Commit** `git commit -m "feat(motion): interpreter honors bezier/animate/hold/spring/overlap/snap"`

---

## Task 6: 🚦 COMPONENT 1 GATE — reproduce a FilmLaunch beat as a SceneSpec

**Files:**
- Create: `docs/superpowers/gate/filmlaunch-beat.json` (a SceneSpec re-expressing one FilmLaunch beat)
- No production code — a checkpoint that also PROVES the surface is expressive enough.

**Interfaces:** Consumes the full expanded SceneSpec (Tasks 1–5).

- [ ] **Step 1: Pick a beat.** Use FilmLaunch BEAT 2 (the thesis: two centered lines + drawn underline + out-fade) OR BEAT 1 (left-anchored title + gold hairline draw + subline — exercises `snap:false` + `animate` + hold). Prefer BEAT 1 (harder — asymmetric optical placement is the real test). Read its exact numbers from `remotion/src/compositions/FilmLaunch.tsx` (`Beat1`): positions left:12%/top:40/52/56%, title spring damping 15 translateY 22→0, gold rule interpolate `[10,32]` width 0→width*0.2, subline word stagger, beat out-fade `[70,84]`, push-in `[0,84]` 0→0.04.
- [ ] **Step 2: Author the SceneSpec** in `filmlaunch-beat.json` reproducing those: `position {x:0.12,y:0.40,snap:false}` for the title (left is 12% → x≈0.12; note primitives center on the anchor, so pick x that lands the text's left edge like the hand film — adjust after first render), title `enter{anim:spring, spring:{damping:15}, durationFrames:~16}`, a `shape` hairline with `animate` or `enter.anim:draw` timed to start ~10f, subline `text` wordReveal delayed, beat `transitionOut` or a layer `exit{anim:fade, at:70, durationFrames:14}`, `camera{move:"push-in",amount:0.04}`.
- [ ] **Step 3: Render both.** Render the hand beat: `ffmpeg -y -ss 1.2 -i film-FilmLaunch.mp4 -frames:v 1 hand-beat.png` (or render FilmLaunch fresh if absent). Render the SceneSpec: `cd remotion && node render.mjs Generative "$(node -e '…wrap {spec:...}')" ../repro-beat.mp4`, then `ffmpeg -y -ss 1.2 -i repro-beat.mp4 -frames:v 1 repro-beat.png`.
- [ ] **Step 4: Controller compares + iterates.** Read both frames. If the SceneSpec version does NOT match (optical placement, curve feel, hold, out-fade), identify the missing expressiveness, GO BACK and expand Tasks 1–5 (add the missing field), re-render. Repeat until it matches. **Do not proceed until the SceneSpec reproduces the hand beat.**
- [ ] **Step 5: SHOW THE USER** both frames side by side + state honestly whether the tool can now express what the hands did. Commit the gate spec: `git commit -m "gate: FilmLaunch beat reproduced purely as a SceneSpec (expressiveness proven)"`

---

## Task 7: The art-direction craft-transfer skill

**Files:**
- Create: `skills/art-direction/SKILL.md`
- Modify: `skills/catalog.json` (register it), `src/mcp/toolDefs.ts` (add a line to the `compose_motion` description pointing to the skill), `src/mcp/server.ts` (SERVER_INSTRUCTIONS mentions it)
- Test: `src/mcp/__tests__/artDirectionSkill.test.ts` (skill file exists, is in catalog, tool description references it)

**Interfaces:** Produces the skill doc + its wiring; no runtime API.

- [ ] **Step 1: Write the failing test**

```typescript
// src/mcp/__tests__/artDirectionSkill.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
const root = process.cwd();
describe("art-direction skill wiring", () => {
  it("SKILL.md exists and teaches principles (has the required sections)", () => {
    const p = join(root, "skills", "art-direction", "SKILL.md");
    expect(existsSync(p)).toBe(true);
    const t = readFileSync(p, "utf8").toLowerCase();
    for (const s of ["decision process", "trade-off", "physics", "optical", "rhythm", "restraint", "worked example", "failure"]) {
      expect(t, `missing section: ${s}`).toContain(s);
    }
  });
  it("is registered in catalog.json", () => {
    const cat = JSON.parse(readFileSync(join(root, "skills", "catalog.json"), "utf8"));
    const ids = JSON.stringify(cat);
    expect(ids).toContain("art-direction");
  });
});
```

- [ ] **Step 2: Run → FAIL** (skill file absent). `npx vitest run src/mcp/__tests__/artDirectionSkill.test.ts`
- [ ] **Step 3: Write `skills/art-direction/SKILL.md`** — a master motion designer's playbook, PRINCIPLES not presets, with the 10 spec sections in order: (1) decision process (read brief → emotional arc → single most important moment → what must the eye do first → restraint budget); (2) trade-offs as tensions (asymmetry↔stability, hold-length↔drag, gold↔muddiness, motion-blur↔legibility); (3) physics of premium (translateY+settle vs scale-pop, one ease curve unifies, spring damping feel, linear reads dead); (4) optical composition (where the eye lands, glow shifts weight, asymmetry, negative space, left-column-vs-centered reasoning); (5) rhythm (hold ∝ word-count & prior density; build/release tension; hold vs cut); (6) restraint (fewer = more expensive; element budget/beat); (7) transition craft (overlap ∝ outgoing busyness; eye never orphaned); (8) worked examples — 2–3 real FilmLaunch/FilmSaaS beats with the THINKING exposed; (9) failure modes attempts 1–3 (scale-pop, centered-everything, hard cuts, muddy gold, over-animation); (10) tool-to-craft mapping (hold, animate, curve, overlapFrames, snap:false, enter.spring → craft intents). Register in `catalog.json` (`{ "id": "art-direction", "name": "Art direction (motion)", "description": "Master motion-designer playbook for composing premium films with compose_motion — the decision process, optical composition, rhythm, restraint, and the physics of premium motion. Read before composing motion." }`). In `toolDefs.ts`, prepend to the `compose_motion` description: `"BEFORE composing, read the 'art-direction' skill (read_skill('art-direction')) — it teaches how to art-direct at a premium level. "`. In `server.ts` SERVER_INSTRUCTIONS, add a sentence: motion work should read the art-direction skill first.
- [ ] **Step 4: Run → PASS** (both tests). `npx tsc --noEmit` exit 0.
- [ ] **Step 5: Commit** `git commit -m "feat(skill): art-direction craft-transfer playbook + wiring (catalog, tool desc, server instructions)"`

---

## Task 8: Tool-surface audit + quick-win exposures

**Files:**
- Create: `docs/superpowers/TOOL-SURFACE-AUDIT.md`
- Modify: whichever tool defs/executor methods the quick wins touch (found during the audit)
- Test: any quick win that changes behavior gets a focused test; the audit doc itself is prose.

**Interfaces:** Produces the audit doc + applied quick wins.

- [ ] **Step 1: Enumerate the 49 tools.** `node -e "const {ALL_TOOL_DEFS}=require('./dist-server/…')"` is unavailable pre-bundle; instead read the names from `src/mcp/toolDefs.ts` (grep `name:`). List all in the doc.
- [ ] **Step 2: Classify each** ✅ deep / ⚡ quick-win / 🔩 deeper-later / ➕ MISSING-TOOL, with the specific gap and — per the user's addition — "what would an LLM WANT to do here that it can't (including a capability needing a new tool)". Rank by impact.
- [ ] **Step 3: Apply the ⚡ quick wins** (1–2 line exposures of existing engine capability, or a shallow motion/perception tool returning more). Each behavior change: write a failing test first, implement, pass. If NO safe quick win exists, say so in the doc (do not invent risky changes days pre-launch).
- [ ] **Step 4: Full suite + tsc.** `npx vitest run` all green; `npx tsc --noEmit` exit 0.
- [ ] **Step 5: Commit** `git commit -m "docs+feat: tool-surface audit (49 tools) + applied quick wins"`

---

## Task 9: 🚦 COLD-SUBAGENT TEST — must BEAT the hand films

**Files:**
- Create: `docs/superpowers/gate/cold-launch-film.json` (the subagent's authored SceneSpec, saved)
- No production code — the final gate.

**Interfaces:** Consumes the entire expanded surface + skill (Tasks 1–8).

- [ ] **Step 1: Dispatch a cold subagent.** Give it ONLY: the full text of `skills/art-direction/SKILL.md` + the `compose_motion` tool description (the expanded SceneSpec schema). **No hand-film context, no positions, no steering.** Prompt: "You are art-directing a launch film for Kaestral (an AI-operated video editor for Windows; brand = near-black + green #16b16a + gold/white hairlines). Compose a premium ~12s 1080p launch film as a SceneSpec JSON. Return only the JSON." Have it return the SceneSpec.
- [ ] **Step 2: Render it.** Save to `cold-launch-film.json`, validate (`validateSceneSpec`), render via `node render.mjs Generative "$(wrap {spec})" ../cold-film.mp4`. If validation fails, feed the exact error back to the subagent to fix (that's the intended loop) — but do NOT hand-fix it yourself (that would taint the test).
- [ ] **Step 3: Controller judges HARSHLY.** Extract frames across all beats. Compare against film-FilmLaunch/FilmSaaS/FilmData. Ask: is this BETTER than the hand-authored films (composition, pacing, restraint, optical placement, premium feel), or merely equal?
- [ ] **Step 4: If merely equal (or worse) → REWRITE the skill.** The skill is teaching imitation, not craft. Deepen the decision process / trade-offs / worked examples (Task 7 file), then re-run with a FRESH subagent (new cold context). Repeat until a cold LLM EXCEEDS the hand films.
- [ ] **Step 5: SHOW THE USER** the cold-authored film's frames + an honest verdict: did an unsteered cold LLM beat the hand films? Commit: `git commit -m "gate: cold-subagent art-direction test — <verdict>"`

---

## Self-Review (completed)

- **Spec coverage:** easing bezier→T1; enter/exit/transition expansion→T2; hold+snap→T3; per-property animate + conflict detection→T4; interpreter application→T5; Component-1 gate→T6; craft skill + wiring→T7; tool audit + quick wins + missing-tool flags→T8; cold-subagent test (must BEAT)→T9. All spec sections mapped.
- **Placeholder scan:** T6/T8/T9 are checkpoints with concrete steps (author spec, dispatch subagent, judge) — not code, so no code placeholders; the one "adjust x after first render" in T6 is inherent to an optical reproduction task (the gate itself is the iteration loop), not a vague TODO.
- **Type consistency:** `EasingSpec`, `validateEasing`, `resolveEasingToBezier`/`bezierFromSpec`, `Tween`/`PositionTween`, `hold{startFrame,durationFrames}`, `position{x,y,snap}` used consistently T1→T5. `validateSceneSpec` return shape and the `ok`/`error` contract unchanged.
- **Gates sequenced in:** Component-1 gate is T6 (mid-plan, before the skill) and the cold-subagent gate is T9 (final) — both non-negotiable, both show the user, both loop-until-pass. Matches the spec.
