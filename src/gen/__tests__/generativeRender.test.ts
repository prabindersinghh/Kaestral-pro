import { describe, it, expect } from "vitest";
import { renderRemotion } from "../../motion/renderRemotion";
import { validateSceneSpec } from "../sceneSpec";
import { join } from "node:path";
import { statSync } from "node:fs";
import { spawn } from "node:child_process";

const sampleImagePath = join(process.cwd(), "public", "sample-image.png");

const remotionDir = join(process.cwd(), "remotion");

// --- ffmpeg pixel-proof helpers (used only by the FINDING 1 regression test below) ---------------
// Deliberately minimal: no new dependency, just shells out to ffmpeg (already present in this
// environment) to extract ONE frame as raw 8-bit grayscale pixels, then averages them in Node. This
// gives a real "how bright is this region at this frame" signal without needing an image-decoding
// library — sufficient to distinguish "opacity pinned to full at frame 0" (bug) from "opacity fading
// in from near-black" (fixed).

function runFfmpeg(args: string[]): Promise<{ stdout: Buffer; code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args);
    const chunks: Buffer[] = [];
    let err = "";
    child.stdout.on("data", (d: Buffer) => chunks.push(d));
    child.stderr.on("data", (d) => { err += String(d); });
    child.on("error", (e) => reject(e));
    child.on("close", (code) => {
      if (code !== 0 && chunks.length === 0) return reject(new Error(`ffmpeg failed (exit ${code}): ${err.slice(-500)}`));
      resolve({ stdout: Buffer.concat(chunks), code });
    });
  });
}

/** True if an `ffmpeg` binary is reachable on PATH — the regression test degrades gracefully (render
 * assertions only, no pixel proof) rather than failing outright when it's absent. */
async function checkFfmpegAvailable(): Promise<boolean> {
  try {
    await runFfmpeg(["-version"]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extracts a single frame from `videoPath` at EXACT frame index `frameIndex` (via the `select`
 * filter — deliberately NOT `-ss` time-seeking, which for a file with a sparse keyframe/GOP
 * structure can decode-and-return the wrong actual frame depending on ffmpeg's nearest-keyframe
 * seek heuristics; `select=eq(n,frameIndex)` is unambiguous regardless of GOP layout), crops to
 * `rect` (pixel coords), downsamples to 8-bit grayscale raw pixels, and returns the mean pixel
 * value (0=black..255=white) — a coarse but effective "how bright/opaque does this region read"
 * proxy.
 */
async function meanLumaOfCrop(
  videoPath: string,
  frameIndex: number,
  rect: { x: number; y: number; w: number; h: number }
): Promise<number> {
  const { x, y, w, h } = rect;
  const { stdout } = await runFfmpeg([
    "-y",
    "-i", videoPath,
    "-vf", `select=eq(n\\,${frameIndex}),crop=${Math.round(w)}:${Math.round(h)}:${Math.round(x)}:${Math.round(y)},format=gray`,
    "-frames:v", "1",
    "-f", "rawvideo",
    "-pix_fmt", "gray",
    "pipe:1",
  ]);
  if (stdout.length === 0) throw new Error(`ffmpeg produced no pixel data for frame ${frameIndex} of ${videoPath}`);
  let sum = 0;
  for (const byte of stdout) sum += byte;
  return sum / stdout.length;
}

describe("Generative render", () => {
  it("renders a MINIMAL sparse spec (no background/particles/camera/enter) to a non-blank MP4 — premium-by-construction defaults must kick in", async () => {
    const v = validateSceneSpec({
      meta: { aspect: "16:9", fps: 30 },
      beats: [{ durationInFrames: 60, layers: [{ element: "text", props: { text: "Kaestral" } }] }],
    });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const out = join(remotionDir, ".test-out", "gen-sparse.mp4");
    const res = await renderRemotion("Generative", { spec: v.spec }, out, remotionDir);
    expect(res.width).toBe(1920);
    // A flat-black slideshow frame compresses far smaller than one with an animated grid + glow +
    // particles backdrop behind spring-entrance text — this is a coarse but effective proxy for
    // "atmosphere actually composited", not just "some bytes were written".
    expect(statSync(out).size).toBeGreaterThan(10000);
  }, 240000);

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

  it("renders a 2-beat spec with a transition + particles + camera push-in (no hard cuts, atmosphere)", async () => {
    const v = validateSceneSpec({
      meta: { aspect: "16:9", fps: 30 },
      beats: [
        {
          durationInFrames: 45,
          camera: { move: "push-in", amount: 0.08 },
          background: { kind: "glow", accent: "#16b16a" },
          transitionOut: { kind: "wipe", accent: "#16b16a", snapToBeat: false },
          layers: [
            { element: "particles", props: { accent: "goldHairline" }, opacity: 1, blur: 0 },
            {
              element: "text",
              props: { text: "Kaestral" },
              style: { role: "display", size: 0.1 },
              enter: { anim: "spring" },
            },
          ],
        },
        {
          durationInFrames: 45,
          camera: { move: "push-in", amount: 0.08 },
          background: { kind: "grid", accent: "#16b16a" },
          layers: [
            { element: "particles", props: { accent: "goldHairline" }, opacity: 1, blur: 0 },
            {
              element: "text",
              props: { text: "Motion" },
              style: { role: "accent", size: 0.1 },
              enter: { anim: "spring" },
            },
          ],
        },
      ],
    });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const out = join(remotionDir, ".test-out", "gen-transition.mp4");
    const res = await renderRemotion("Generative", { spec: v.spec }, out, remotionDir);
    expect(res.width).toBe(1920);
    expect(res.height).toBe(1080);
    expect(statSync(out).size).toBeGreaterThan(10000);
  }, 240000);

  it("renders a data-story spec (barChart + counter, then timeline + captionKaraoke across a wipe transition) — 'show the product working' primitives", async () => {
    const v = validateSceneSpec({
      meta: { aspect: "16:9", fps: 30 },
      beats: [
        {
          durationInFrames: 60,
          background: { kind: "glow", accent: "#16b16a" },
          transitionOut: { kind: "wipe", accent: "#16b16a", snapToBeat: false },
          layers: [
            {
              element: "barChart",
              props: {
                title: "Growth",
                bars: [
                  { label: "Jan", value: 42 },
                  { label: "Feb", value: 65 },
                  { label: "Mar", value: 88 },
                ],
              },
              position: { x: 0.5, y: 0.42 },
              enter: { anim: "spring" },
            },
            {
              element: "counter",
              props: { value: 1280, label: "renders", suffix: "+" },
              position: { x: 0.5, y: 0.82 },
              enter: { anim: "spring", delay: 10 },
            },
          ],
        },
        {
          durationInFrames: 60,
          background: { kind: "grid", accent: "#16b16a" },
          layers: [
            {
              element: "timeline",
              props: {},
              position: { x: 0.5, y: 0.35 },
              enter: { anim: "spring" },
            },
            {
              element: "captionKaraoke",
              props: { words: ["show", "the", "product", "working"] },
              position: { x: 0.5, y: 0.75 },
              enter: { anim: "spring", delay: 8 },
            },
          ],
        },
      ],
    });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const out = join(remotionDir, ".test-out", "gen-data-story.mp4");
    const res = await renderRemotion("Generative", { spec: v.spec }, out, remotionDir);
    expect(res.width).toBe(1920);
    expect(res.height).toBe(1080);
    expect(statSync(out).size).toBeGreaterThan(10000);
  }, 240000);

  it("renders a screenMock (real product screenshot) + arrow + highlightBox — 'show the product' primitives", async () => {
    const v = validateSceneSpec(
      {
        meta: { aspect: "16:9", fps: 30 },
        beats: [
          {
            durationInFrames: 60,
            background: { kind: "glow", accent: "#16b16a" },
            layers: [
              {
                element: "screenMock",
                props: { src: sampleImagePath, url: "kaestral.dev" },
                position: { x: 0.5, y: 0.5 },
                enter: { anim: "spring" },
              },
              {
                element: "arrow",
                props: { from: { x: 0.15, y: 0.15 }, to: { x: 0.4, y: 0.35 } },
                enter: { anim: "draw" },
              },
              {
                element: "highlightBox",
                props: { rect: { x: 0.3, y: 0.25, w: 0.35, h: 0.2 } },
                enter: { anim: "draw" },
              },
            ],
          },
        ],
      },
      { allowedMediaPaths: [sampleImagePath] },
    );
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const out = join(remotionDir, ".test-out", "gen-screenmock.mp4");
    const res = await renderRemotion("Generative", { spec: v.spec }, out, remotionDir);
    expect(res.width).toBe(1920);
    expect(res.height).toBe(1080);
    // Real screenshot content composited into the chrome should compress noticeably larger than a
    // flat background alone — a coarse but effective "actually rendered, not blank" proxy.
    expect(statSync(out).size).toBeGreaterThan(15000);
  }, 240000);

  it("renders the Task 9 premium-motion set (maskReveal+kenBurns+lightingSweep on an image, splitLayout, textOnPath, glitch exit) to a non-blank MP4", async () => {
    const v = validateSceneSpec(
      {
        meta: { aspect: "16:9", fps: 30 },
        beats: [
          {
            durationInFrames: 60,
            background: { kind: "glow", accent: "#16b16a" },
            transitionOut: { kind: "wipe", accent: "#16b16a", snapToBeat: false },
            layers: [
              {
                element: "image",
                props: { src: sampleImagePath },
                position: { x: 0.5, y: 0.45 },
                depth: "foreground",
                mask: { shape: "circle", reveal: "iris" },
                kenBurns: { move: "drift", amount: 0.1 },
                lightingSweep: { on: true, angle: 25, speed: 1 },
                enter: { anim: "maskReveal" },
              },
            ],
          },
          {
            durationInFrames: 60,
            background: { kind: "grid", accent: "#16b16a" },
            transitionOut: { kind: "glitch", accent: "#16b16a", snapToBeat: false },
            layers: [
              {
                element: "splitLayout",
                props: {
                  direction: "row",
                  panels: [
                    { element: "text", props: { text: "Design" }, style: { role: "display", size: 0.09 } },
                    { element: "text", props: { text: "Motion" }, style: { role: "accent", size: 0.09 } },
                  ],
                },
                position: { x: 0.5, y: 0.5 },
                enter: { anim: "spring" },
              },
            ],
          },
          {
            durationInFrames: 45,
            background: { kind: "glow", accent: "#16b16a" },
            layers: [
              {
                element: "textOnPath",
                props: { text: "Kaestral ships motion", path: "arc", emphasis: [0, 2] },
                position: { x: 0.5, y: 0.4 },
                enter: { anim: "kinetic" },
                exit: { anim: "glitch", at: 30 },
              },
              {
                element: "countdown",
                props: { from: 3, stepFrames: 12 },
                position: { x: 0.5, y: 0.78 },
              },
            ],
          },
        ],
      },
      { allowedMediaPaths: [sampleImagePath] },
    );
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const out = join(remotionDir, ".test-out", "gen-premium-motion.mp4");
    const res = await renderRemotion("Generative", { spec: v.spec }, out, remotionDir);
    expect(res.width).toBe(1920);
    expect(res.height).toBe(1080);
    // Every premium technique compositing together (masked image + Ken Burns + lighting sweep +
    // split-panel text + kinetic text-on-path + countdown + glitch) should compress noticeably
    // larger than a flat background alone — a coarse but effective "actually rendered" proxy.
    expect(statSync(out).size).toBeGreaterThan(15000);
  }, 240000);

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

  // REGRESSION TEST — task-5 review FINDING 1 (Critical): `animate.position` authored ALONE must
  // NOT silently kill the layer's own entrance-driven OPACITY fade-in. The bug: Generative.tsx's
  // `BeatLayer` used to compute `animateNeutralizesEnter = !!(layer.animate?.opacity ||
  // layer.animate?.position)` — a single combined OR flag — so authoring `animate.position` alone
  // wrongly neutralized the ENTIRE entrance (opacity included), pinning opacity to instant-full at
  // frame 0 instead of letting it fade in via the default spring entrance. This spec is legal and
  // must reach the interpreter: no `enter` is authored at all (so `resolveEnter` fills in the
  // default spring entrance) and `animate` covers ONLY `position` — the validator's
  // `checkAnimateConflicts` only rejects an explicitly-authored `enter.from` alongside
  // `animate.position` (see src/gen/sceneSpec.ts), and there is no `enter` here whatsoever, so this
  // spec validates fine and is exactly the shape the review calls out as reaching the interpreter.
  it("renders animate.position ALONE (no animate.opacity, no enter authored) and the entrance-driven opacity fade survives — FINDING 1 regression", async () => {
    const v = validateSceneSpec({
      meta: { aspect: "16:9", fps: 30 },
      beats: [
        {
          durationInFrames: 60,
          background: { kind: "solid", accent: "#0b0a0d" }, // solid black backdrop, no grid/glow/particles — isolates the text's own luma
          layers: [
            {
              element: "text",
              props: { text: "GLOW", color: "greenLight" },
              // No `enter` authored at all -> default spring entrance fills in (resolveEnter),
              // which is NOT rejected by checkAnimateConflicts since no `enter.from` was authored.
              position: { x: 0.5, y: 0.5, snap: false },
              style: { role: "display", size: 0.16 },
              animate: {
                // position ALONE — no animate.opacity. A short tween so both its start and end sit
                // well inside a single generous crop box below.
                position: {
                  from: { x: 0.46, y: 0.5 },
                  to: { x: 0.54, y: 0.5 },
                  startFrame: 0,
                  durationFrames: 45,
                  easing: "linear",
                },
              },
            },
          ],
        },
      ],
    });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const out = join(remotionDir, ".test-out", "gen-animate-position-only.mp4");
    const res = await renderRemotion("Generative", { spec: v.spec }, out, remotionDir);
    expect(res.width).toBe(1920);
    expect(res.height).toBe(1080);
    // Baseline "actually rendered, not blank" proxy, matching every other test in this file.
    expect(statSync(out).size).toBeGreaterThan(8000);

    // Pixel-level proof (ffmpeg, present in this environment): the default spring entrance settles
    // to ~99% opacity by frame ~28-32 at 30fps (see ASSUMED_ENTRANCE_SETTLE_FRAMES in
    // remotion/src/primitives/pacing.ts) — frame 2 is deep inside the entrance's fade-in (spring
    // barely started), frame 35 is comfortably settled AND still well before this beat's own
    // OUT_FADE_FRAMES content resolve (Generative.tsx's BeatSequence fades the whole beat's content
    // out over its final 18 frames — [42,60) on this 60-frame beat — so frame 35 avoids that
    // confound entirely). If the CRITICAL bug were still present, opacity would be pinned to fully
    // opaque at BOTH frames (the entrance neutralized wholesale by animate.position's mere presence)
    // and this luma comparison would fail — this was verified by deliberately reproducing the bug
    // (stale pre-fix bundle) during development of this test, which DID fail this exact assertion
    // with the text already fully bright at frame 0. Crop box covers the full x=[0.42,0.58] range
    // the text sweeps across (its animate.position tween), so the crop reliably contains the text
    // at every frame regardless of the horizontal drift.
    const ffmpegAvailable = await checkFfmpegAvailable();
    if (!ffmpegAvailable) {
      // Environment without ffmpeg: the render assertions above already prove the spec is legal and
      // renders successfully; the opacity-fade claim itself is verified by code trace in this case
      // (see BeatLayer's per-property neutralizeOpacity/neutralizePosition split and Text.tsx's
      // post-hoc pin — animate.position alone sets neutralizePosition=true, neutralizeOpacity stays
      // false, so animOpacity keeps playing the branch's own spring value un-pinned).
      return;
    }
    const earlyLuma = await meanLumaOfCrop(out, 2, { x: 1920 * 0.42, y: 1080 * 0.4, w: 1920 * 0.16, h: 1080 * 0.2 });
    const settledLuma = await meanLumaOfCrop(out, 35, { x: 1920 * 0.42, y: 1080 * 0.4, w: 1920 * 0.16, h: 1080 * 0.2 });
    // Early frame (deep in the entrance fade-in) must be visibly DIMMER than the settled frame — proof
    // the opacity entrance actually animated from low to high, i.e. was NOT pinned to full opacity at
    // frame 0 by animate.position's mere presence.
    expect(earlyLuma).toBeLessThan(settledLuma - 5);
  }, 240000);
});
