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

/**
 * Extracts a single frame, downsampled to a small full-frame grayscale grid (cheap but
 * representative of the WHOLE picture, not just one crop), for the Cinematic Reel pack render
 * test's "motion is actually happening" proof below — comparing two of these across frames is a
 * much stronger "did anything change" signal than a single luma average (which can coincidentally
 * stay flat even while content visibly moves/drifts).
 */
async function frameThumbnailBytes(videoPath: string, frameIndex: number): Promise<Buffer> {
  const { stdout } = await runFfmpeg([
    "-y",
    "-i", videoPath,
    "-vf", `select=eq(n\\,${frameIndex}),scale=48:85,format=gray`,
    "-frames:v", "1",
    "-f", "rawvideo",
    "-pix_fmt", "gray",
    "pipe:1",
  ]);
  if (stdout.length === 0) throw new Error(`ffmpeg produced no pixel data for frame ${frameIndex} of ${videoPath}`);
  return stdout;
}

/** True if two same-shaped downsampled grayscale frame buffers differ meaningfully (more than a
 * handful of pixels beyond a per-pixel noise threshold) — proof of real motion/content-change
 * between the two sampled frames, not just codec dithering noise on an otherwise-static frame. */
function framesDiffer(a: Buffer, b: Buffer, minDiffPixels = 30, perPixelThreshold = 6): boolean {
  const len = Math.min(a.length, b.length);
  let diffCount = 0;
  for (let i = 0; i < len; i++) {
    if (Math.abs(a[i] - b[i]) > perPixelThreshold) diffCount++;
  }
  return diffCount >= minDiffPixels;
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

  // TASK 6b1 — text ANCHOR + mono FONT. Before this task `text` layers always CENTERED on
  // `position`, so a left-column title authored at x:0.12 ran off the left edge of the frame.
  it("renders a LEFT-anchored text at x:0.12 with ink pixels near the left edge — proves anchor:'left' places the text's start near position.x, not centered on it", async () => {
    const v = validateSceneSpec({
      meta: { aspect: "16:9", fps: 30 },
      beats: [
        {
          durationInFrames: 60,
          background: { kind: "solid", accent: "#0b0a0d" }, // solid black backdrop isolates the text's own luma
          layers: [
            {
              element: "text",
              props: { text: "A kestrel watches." },
              position: { x: 0.12, y: 0.4, snap: false },
              style: { role: "display", size: 0.072, anchor: "left" },
              enter: { anim: "spring" },
            },
          ],
        },
      ],
    });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const out = join(remotionDir, ".test-out", "gen-text-anchor-left.mp4");
    const res = await renderRemotion("Generative", { spec: v.spec }, out, remotionDir);
    expect(res.width).toBe(1920);
    expect(res.height).toBe(1080);
    // Baseline "actually rendered, not blank" proxy, matching every other test in this file.
    expect(statSync(out).size).toBeGreaterThan(8000);

    const ffmpegAvailable = await checkFfmpegAvailable();
    if (!ffmpegAvailable) {
      // Environment without ffmpeg: the render assertions above already prove the spec is legal
      // and renders successfully; the pixel-level left-anchoring proof is skipped in this case.
      return;
    }
    // Settle frame: default spring entrance settles to ~99% opacity by frame ~28-32 at 30fps (see
    // ASSUMED_ENTRANCE_SETTLE_FRAMES in remotion/src/primitives/pacing.ts) — frame 40 is comfortably
    // settled and still well before this beat's own OUT_FADE_FRAMES resolve.
    const settleFrame = 40;
    // The LEFT ~8% column of the frame, centered vertically around y=40% (position.y). If the text
    // is genuinely left-anchored (its LEFT edge starts at x:0.12, i.e. the text runs rightward from
    // there), this narrow strip right at the very left edge of the frame (x:[0, 0.08]) sits just
    // before the text's start and would read near-black if the text were being CENTERED instead
    // (centered on x:0.12 would push the text's visible ink leftward past this column and off-frame
    // entirely, clipped — the strip would stay dark either way in that failure mode). The
    // decisive column is immediately AFTER position.x's left edge: x:[0.12, 0.20], an 8%-wide band
    // starting exactly at the authored left-anchor point, which must contain bright ink for a
    // left-anchored render (a center-anchored render would place the text's horizontal midpoint at
    // x:0.12, so its ink would straddle x:[0.12,0.20] far less and skew darker/clipped-looking, and
    // for a genuinely off-frame center-anchored overflow the same band would still show materially
    // less ink than the true left-anchored case).
    const leftAnchorBandLuma = await meanLumaOfCrop(out, settleFrame, {
      x: 1920 * 0.12,
      y: 1080 * 0.4 - 1080 * 0.1,
      w: 1920 * 0.08,
      h: 1080 * 0.2,
    });
    // A dark background (solid #0b0a0d, luma ~11) with bright ink (#eaeaef, luma ~234) means any
    // meaningful text coverage in this band pulls the mean well above the background floor.
    expect(leftAnchorBandLuma).toBeGreaterThan(40);
  }, 240000);

  it("renders a mono-font text without error", async () => {
    const v = validateSceneSpec({
      meta: { aspect: "16:9", fps: 30 },
      beats: [
        {
          durationInFrames: 30,
          layers: [
            {
              element: "text",
              props: { text: "Mono" },
              style: { role: "display", size: 0.1, font: "mono" },
            },
          ],
        },
      ],
    });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const out = join(remotionDir, ".test-out", "gen-text-font-mono.mp4");
    const res = await renderRemotion("Generative", { spec: v.spec }, out, remotionDir);
    expect(res.width).toBe(1920);
    expect(statSync(out).size).toBeGreaterThan(8000);
  }, 240000);

  // TASK 6b2 — hairline ANCHORED draw + honor enter.easing/durationFrames. Before this task
  // Hairline always CENTERED on `position` (grew symmetrically outward from the midpoint) and
  // ignored `enter.easing`/`enter.durationFrames` entirely (always used its own hardcoded spring).
  // This spec pins the rule's LEFT edge at position.x:0.12 via `props.anchor:"start"` and shapes
  // the draw-in with a custom bezier over an exact 22-frame window (after a 10-frame delay).
  it("renders a LEFT-anchored hairline shaped by enter.easing/durationFrames, with ink starting at the anchor and not centered on it", async () => {
    const v = validateSceneSpec({
      meta: { aspect: "16:9", fps: 30 },
      beats: [
        {
          durationInFrames: 60,
          background: { kind: "solid", accent: "#0b0a0d" }, // solid black backdrop isolates the hairline's own luma
          layers: [
            {
              element: "hairline",
              position: { x: 0.12, y: 0.52, snap: false },
              // `thickness:14` (vs. the primitive's 2px default) so the drawn band is thick enough
              // to dominate a reasonably-sized ffmpeg sampling crop below without needing a
              // pixel-fragile, anti-aliasing-sensitive 1-2px-tall crop window.
              props: { orientation: "horizontal", length: 0.2, anchor: "start", color: "gold", thickness: 14 },
              enter: { anim: "draw", easing: { curve: [0.22, 0.61, 0.16, 1] }, durationFrames: 22, delay: 10 },
            },
          ],
        },
      ],
    });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const out = join(remotionDir, ".test-out", "gen-hairline-anchor-draw.mp4");
    const res = await renderRemotion("Generative", { spec: v.spec }, out, remotionDir);
    expect(res.width).toBe(1920);
    expect(res.height).toBe(1080);
    // Baseline "actually rendered, not blank" proxy, matching every other test in this file.
    expect(statSync(out).size).toBeGreaterThan(8000);

    const ffmpegAvailable = await checkFfmpegAvailable();
    if (!ffmpegAvailable) {
      // Environment without ffmpeg: the render assertions above already prove the spec is legal
      // and renders successfully; the pixel-level anchored-draw proof is skipped in this case.
      return;
    }
    // Frame 22 = 10-frame delay + 12 frames into the 22-frame draw window -> mid-draw, well past
    // the point any eased curve would have painted ink starting from the left anchor.
    const midDrawFrame = 22;
    // Just RIGHT of the anchor (x:0.12): a thin band at x:[0.13,0.16], y a tight ~14px-tall strip
    // centered on position.y (0.52, matching the authored `thickness:14`) — must show drawn GOLD
    // ink if the rule grows rightward from its LEFT-pinned anchor.
    const rightOfAnchorLuma = await meanLumaOfCrop(out, midDrawFrame, {
      x: 1920 * 0.13,
      y: 1080 * 0.52 - 7,
      w: 1920 * 0.03,
      h: 14,
    });
    // Just LEFT of the anchor (x:0.12): a thin band at x:[0.06,0.10] — must show NO ink (background
    // only) if the rule is left-anchored rather than centered on position.x (a centered rule at
    // 20%-length would draw symmetrically outward and this band would ALSO light up).
    const leftOfAnchorLuma = await meanLumaOfCrop(out, midDrawFrame, {
      x: 1920 * 0.06,
      y: 1080 * 0.52 - 7,
      w: 1920 * 0.04,
      h: 14,
    });
    // Solid #0b0a0d background reads luma ~11; drawn gold ink over it should read materially
    // brighter in the right-of-anchor band, while the left-of-anchor band stays near the floor.
    expect(rightOfAnchorLuma).toBeGreaterThan(30);
    expect(leftOfAnchorLuma).toBeLessThan(20);
  }, 240000);

  // TASK 6b3 — wordStagger: a REAL per-word spring stagger (opacity + translateY 12->0, each word
  // springing up independently with an i*4-frame offset), unlike wordReveal's flat word-COUNT
  // reveal (all-visible words instantly fully opaque, no per-word transform). This spec renders
  // "Total precision. Then it strikes." left-anchored at x:0.12, mono font, size:0.06 — at that
  // size a monospace advance places the FIRST word ("Total") roughly at x:[0.13,0.20] and the LAST
  // word ("strikes.") roughly at x:[0.56,0.64] (calibrated against an actual rendered frame),
  // giving two well-separated horizontal bands to sample.
  it("renders wordStagger with SEQUENTIAL per-word reveal — early frame shows only the first word, later frame shows the last word too", async () => {
    const v = validateSceneSpec({
      meta: { aspect: "16:9", fps: 30 },
      beats: [
        {
          durationInFrames: 150, // generous so enter.delay:16 is not pulled back by resolveEntranceTiming's hold/settle clamp
          background: { kind: "solid", accent: "#0b0a0d" }, // solid black backdrop isolates the text's own luma
          layers: [
            {
              element: "text",
              props: { text: "Total precision. Then it strikes." },
              position: { x: 0.12, y: 0.4, snap: false },
              style: { role: "display", size: 0.06, anchor: "left", font: "mono" },
              enter: { anim: "wordStagger", spring: { damping: 16, mass: 1, stiffness: 100 }, delay: 16 },
            },
          ],
        },
      ],
    });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const out = join(remotionDir, ".test-out", "gen-text-word-stagger.mp4");
    const res = await renderRemotion("Generative", { spec: v.spec }, out, remotionDir);
    expect(res.width).toBe(1920);
    expect(res.height).toBe(1080);
    // Baseline "actually rendered, not blank" proxy, matching every other test in this file.
    expect(statSync(out).size).toBeGreaterThan(8000);

    const ffmpegAvailable = await checkFfmpegAvailable();
    if (!ffmpegAvailable) {
      // Environment without ffmpeg: the render assertions above already prove the spec is legal
      // and renders successfully; the pixel-level sequential-reveal proof is skipped in this case.
      return;
    }

    // EARLY frame: delay=16, word i's spring frame = local - i*4 (local = frame - 16). At frame 24
    // (local=8), word 0's spring frame is 8 (well into its damping:16 spring rise, ~85% opacity —
    // comfortably bright ink), while word 5's ("strikes.") spring frame is 8 - 20 = -12 —
    // Remotion's spring() clamps negative frames to progress 0, so it must be fully invisible
    // (background floor only). This is the crux of the sequential-vs-all-at-once distinction:
    // wordReveal or a flat fade would show BOTH bands identically bright at this frame.
    const earlyFrame = 24;
    const firstWordBandEarly = await meanLumaOfCrop(out, earlyFrame, {
      x: 1920 * 0.13, y: 1080 * 0.4 - 1080 * 0.1, w: 1920 * 0.07, h: 1080 * 0.2,
    });
    const lastWordBandEarly = await meanLumaOfCrop(out, earlyFrame, {
      x: 1920 * 0.56, y: 1080 * 0.4 - 1080 * 0.1, w: 1920 * 0.08, h: 1080 * 0.2,
    }); // "strikes." lands roughly x:[0.56,0.64] at this size/position (calibrated against an actual rendered frame)

    // LATER frame: comfortably past every word's settle point (last word's spring starts at
    // local=20 i.e. frame=36, settles ~30 frames later around frame=66) and still well before this
    // beat's own OUT_FADE_FRAMES resolve (durationInFrames:150 fades out only in its final 18
    // frames, [132,150)).
    const laterFrame = 90;
    const firstWordBandLater = await meanLumaOfCrop(out, laterFrame, {
      x: 1920 * 0.13, y: 1080 * 0.4 - 1080 * 0.1, w: 1920 * 0.07, h: 1080 * 0.2,
    });
    const lastWordBandLater = await meanLumaOfCrop(out, laterFrame, {
      x: 1920 * 0.56, y: 1080 * 0.4 - 1080 * 0.1, w: 1920 * 0.08, h: 1080 * 0.2,
    });

    // Solid #0b0a0d background reads luma ~11; bright ink (#eaeaef) reads far brighter.
    expect(firstWordBandEarly).toBeGreaterThan(20); // first word already visible early
    expect(lastWordBandEarly).toBeLessThan(20); // last word NOT visible yet — proves sequential, not all-at-once
    expect(firstWordBandLater).toBeGreaterThan(20); // first word still visible later
    expect(lastWordBandLater).toBeGreaterThan(20); // last word now visible too — sequential reveal completed
  }, 240000);

  // TASK 6b4 — camera.easing (bezier-shaped push-in) + beat.outFade (authorable content out-fade
  // window). Before this task the camera push-in was always LINEAR and the content out-fade was
  // hardcoded to the beat's last 18 frames — an author couldn't shape the push-in's ease, nor
  // choose an exact custom fade window anywhere else in the beat.
  //
  // This single-beat 84-frame spec authors BOTH: an eased push-in AND an EARLY outFade window of
  // [20, 20+14) = [20,34) — deliberately DISJOINT from the OLD hardcoded default window of the
  // beat's last 18 frames, [66,84). That disjointness is the whole point of this test's shape: if
  // the interpreter ignored `beat.outFade` entirely and fell back to the old hardcoded [66,84)
  // window, NOTHING would fade anywhere near frame 20-34 (both frame 10 and frame 32 sit well
  // before frame 66, so they'd read identically full-bright), and the assertions below would FAIL.
  // Only reading the authored `outFade` field can make content dim inside [20,34) — which is what
  // makes this a real guard on the new field rather than a coincidental pass under old behavior.
  it("renders camera.easing + an authored EARLY outFade:[20,34] window — content fades inside that window although it sits nowhere near the old hardcoded last-18-frames default", async () => {
    const v = validateSceneSpec({
      meta: { aspect: "16:9", fps: 30 },
      beats: [
        {
          durationInFrames: 84,
          background: { kind: "solid", accent: "#0b0a0d" }, // solid black backdrop isolates the text's own luma
          camera: { move: "push-in", amount: 0.04, easing: { curve: [0.22, 0.61, 0.16, 1] } },
          outFade: { startFrame: 20, durationFrames: 14 },
          layers: [
            {
              element: "text",
              props: { text: "Kaestral", color: "greenLight" },
              position: { x: 0.5, y: 0.5, snap: false },
              style: { role: "display", size: 0.14 },
              enter: { anim: "spring" },
            },
          ],
        },
      ],
    });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    if (v.ok) {
      // Sanity-check the validator actually carried both new fields through before rendering.
      expect(v.spec.beats[0].camera!.easing).toEqual({ curve: [0.22, 0.61, 0.16, 1] });
      expect(v.spec.beats[0].outFade).toEqual({ startFrame: 20, durationFrames: 14 });
    }
    const out = join(remotionDir, ".test-out", "gen-camera-easing-outfade.mp4");
    const res = await renderRemotion("Generative", { spec: v.spec }, out, remotionDir);
    expect(res.width).toBe(1920);
    expect(res.height).toBe(1080);
    // Baseline "actually rendered, not blank" proxy, matching every other test in this file. The
    // eased camera push-in + authored outFade must not break the render pipeline.
    expect(statSync(out).size).toBeGreaterThan(8000);

    const ffmpegAvailable = await checkFfmpegAvailable();
    if (!ffmpegAvailable) {
      // Environment without ffmpeg: the render assertions above already prove the spec is legal
      // and renders successfully with the eased camera + authored outFade; the pixel-level
      // out-fade-window proof is skipped in this case.
      return;
    }
    const cropAtCenter = { x: 1920 * 0.5 - 1920 * 0.2, y: 1080 * 0.5 - 1080 * 0.12, w: 1920 * 0.4, h: 1080 * 0.24 };
    // Frame 10: before the authored outFade window starts (20), and the default spring entrance
    // (settles ~frame 28-32... but note the entrance and the outFade window overlap here, which is
    // fine — frame 10 is still early/rising in the entrance, so it's not used as a "full-bright"
    // baseline. It only needs to be un-faded-by-outFade, which it trivially is since 10 < 20.
    const lumaAt10 = await meanLumaOfCrop(out, 10, cropAtCenter);
    // Frame 32: 12 frames into the authored [20,34) outFade window (12/14 ≈ 86% through) — content
    // must read markedly DIMMER than frame 10. Under the OLD hardcoded [66,84) default, neither
    // frame 10 nor frame 32 is anywhere near the fade window, so both would read full-bright and
    // this assertion would FAIL on old (pre-825e515) code — that failure is what proves the
    // authored window, not the old default, is driving the fade.
    const lumaAt32 = await meanLumaOfCrop(out, 32, cropAtCenter);
    expect(lumaAt32).toBeLessThan(lumaAt10 - 5);

    // Frame 78: well past the authored [20,34) window's end. `interpolate` clamps past its output
    // range by default, so once fully faded the content STAYS faded (it does not un-fade or drift
    // back up) — frame 78 must read approximately as dim as frame 32, and critically must NOT be
    // explained by the OLD hardcoded [66,84) default coincidentally kicking in here too: it must
    // stay near the fully-faded floor, not partially-bright partway through a second fade.
    const lumaAt78 = await meanLumaOfCrop(out, 78, cropAtCenter);
    expect(lumaAt78).toBeLessThan(lumaAt10 - 5);
    // Loose tolerance (compression/encoding noise near the near-black floor) — the point is "stays
    // in the same faded ballpark," not bit-exact equality with frame 32.
    expect(Math.abs(lumaAt78 - lumaAt32)).toBeLessThan(10);
  }, 240000);

  // TASK 6 — enter.pacing:"manual" opt-out of the beat-relative anti-smear auto-clamp
  // (resolveEntranceTiming in Generative.tsx's resolveEnter). On an 84-frame beat, the AUTO clamp's
  // ceiling is `84*0.45 - 30 = 7.8` frames (see pacing.ts) — so ANY authored delay above ~7.8 gets
  // pulled back under the default. This spec authors `delay:34` (well past that ceiling) WITH
  // `pacing:"manual"`, which must reach the primitive completely unclamped. Proof: at frame 20 (past
  // where the OLD auto-clamped delay of ~7.8 would already be visible/settling) the text region must
  // still be DARK — the entrance hasn't even started — and by frame 70 (well past delay:34 + settle)
  // it must be visible. Under the auto-clamp this assertion would FAIL (text already bright at frame
  // 20), which is what makes this a real guard on `pacing:"manual"` rather than a coincidental pass.
  it("renders enter.pacing:'manual' and honors a large authored delay VERBATIM, skipping the auto-clamp — dark at frame 20, visible by frame 70", async () => {
    const v = validateSceneSpec({
      meta: { aspect: "16:9", fps: 30 },
      beats: [
        {
          durationInFrames: 84,
          background: { kind: "solid", accent: "#0b0a0d" }, // solid black backdrop isolates the text's own luma
          layers: [
            {
              element: "text",
              props: { text: "Kaestral", color: "greenLight" },
              position: { x: 0.5, y: 0.5, snap: false },
              style: { role: "display", size: 0.14 },
              enter: { anim: "wordStagger", delay: 34, pacing: "manual" },
            },
          ],
        },
      ],
    });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    if (v.ok) {
      // Sanity-check the validator carried `pacing:"manual"` through verbatim before rendering.
      expect(v.spec.beats[0].layers[0].enter!.pacing).toBe("manual");
      expect(v.spec.beats[0].layers[0].enter!.delay).toBe(34);
    }
    const out = join(remotionDir, ".test-out", "gen-enter-pacing-manual.mp4");
    const res = await renderRemotion("Generative", { spec: v.spec }, out, remotionDir);
    expect(res.width).toBe(1920);
    expect(res.height).toBe(1080);
    // Baseline "actually rendered, not blank" proxy, matching every other test in this file.
    expect(statSync(out).size).toBeGreaterThan(8000);

    const ffmpegAvailable = await checkFfmpegAvailable();
    if (!ffmpegAvailable) {
      // Environment without ffmpeg: the render assertions above already prove the spec is legal and
      // renders successfully with `pacing:"manual"`; the pixel-level unclamped-delay proof is
      // skipped in this case.
      return;
    }
    const cropAtCenter = { x: 1920 * 0.5 - 1920 * 0.2, y: 1080 * 0.5 - 1080 * 0.12, w: 1920 * 0.4, h: 1080 * 0.24 };
    // Frame 20: well past the AUTO clamp's ceiling delay (~7.8 frames on this 84-frame beat) plus
    // its settle window — under the OLD/auto behavior the text would already be bright here. With
    // pacing:"manual" honoring delay:34 verbatim, the entrance hasn't even started yet at frame 20,
    // so this region must still read near the dark background floor.
    const lumaAt20 = await meanLumaOfCrop(out, 20, cropAtCenter);
    // Frame 70: comfortably past delay:34 plus its settle window (~30 frames -> settled by ~64),
    // and still before this beat's own final-18-frames outFade default ([66,84) on an 84f beat) —
    // pick a spot inside the settled-but-not-yet-fading band; 70 sits just past outFade start (66)
    // but interpolate's fade there is gradual, so use the ratio against frame 20 to prove the
    // entrance genuinely happened rather than requiring near-peak brightness.
    const lumaAt70 = await meanLumaOfCrop(out, 70, cropAtCenter);
    expect(lumaAt20).toBeLessThan(20); // still dark — entrance has not started (delay:34 survived unclamped)
    expect(lumaAt70).toBeGreaterThan(lumaAt20 + 15); // visible later — the entrance did eventually play
  }, 240000);

  // Cinematic Reel pack — 8 composable 9:16 effects. This spec exercises all of them: a 9:16 beat
  // with meta.palette + meta.handheld:true, a "blurPushUp" multi-word text entrance, an "edgeFlip"
  // card (shape) with liveBreathe + shineSweep, a "strikethrough" emphasis element, an "orbs"
  // background, all resolving through a "whip" transitionOut into a second beat — proving the whole
  // pack validates and renders together, not just each field in isolation.
  it("renders the Cinematic Reel pack (9:16): palette + handheld idle, blurPushUp text, edgeFlip+liveBreathe+shineSweep card, strikethrough, orbs background, whip transition — non-blank + real motion", async () => {
    const v = validateSceneSpec({
      meta: {
        aspect: "9:16",
        fps: 30,
        palette: ["#16b16a", "#c9a227", "#1fce7e"],
        preset: "cinematic-reel",
        handheld: true,
      },
      beats: [
        {
          durationInFrames: 90,
          background: { kind: "orbs", accent: "#16b16a" },
          transitionOut: { kind: "whip", overlapFrames: 24 },
          layers: [
            {
              element: "text",
              props: { text: "Cinematic Reel" },
              position: { x: 0.5, y: 0.3, snap: false },
              style: { role: "display", size: 0.09 },
              enter: { anim: "blurPushUp" },
            },
            {
              element: "shape",
              props: { shape: "rect", color: "greenLight", width: 0.55, height: 0.26 },
              position: { x: 0.5, y: 0.54, snap: false },
              depth: "foreground",
              enter: { anim: "edgeFlip", durationFrames: 35 },
              liveBreathe: true,
              shineSweep: true,
            },
            {
              element: "strikethrough",
              props: { length: 0.42, thickness: 4 },
              position: { x: 0.5, y: 0.78, snap: false },
              enter: { anim: "draw", delay: 20 },
            },
          ],
        },
        {
          durationInFrames: 60,
          background: { kind: "glow", accent: "#16b16a" },
          layers: [
            {
              element: "text",
              props: { text: "Kaestral" },
              style: { role: "accent", size: 0.1 },
              enter: { anim: "spring" },
            },
          ],
        },
      ],
    });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    // Sanity-check the validator actually carried the new Cinematic Reel fields through.
    expect(v.spec.meta.palette).toEqual(["#16b16a", "#c9a227", "#1fce7e"]);
    expect(v.spec.meta.handheld).toEqual({ on: true, amount: 1 });
    expect(v.spec.beats[0].background!.kind).toBe("orbs");
    expect(v.spec.beats[0].transitionOut!.kind).toBe("whip");
    expect(v.spec.beats[0].layers[0].enter!.anim).toBe("blurPushUp");
    expect(v.spec.beats[0].layers[1].enter!.anim).toBe("edgeFlip");
    expect(v.spec.beats[0].layers[1].liveBreathe).toBe(true);
    expect(v.spec.beats[0].layers[1].shineSweep).toBe(true);
    expect(v.spec.beats[0].layers[2].element).toBe("strikethrough");

    const out = join(remotionDir, ".test-out", "gen-cinematic-reel-pack.mp4");
    const res = await renderRemotion("Generative", { spec: v.spec }, out, remotionDir);
    // 9:16 -> 1080x1920 per dimsForAspect.
    expect(res.width).toBe(1080);
    expect(res.height).toBe(1920);
    // Every pack effect compositing together (orbs + card flip/breathe/shine + strikethrough glow +
    // blurPushUp text + a whip-pan into a second beat) should compress noticeably larger than a
    // flat background alone — the same coarse-but-effective "actually rendered" proxy every other
    // test in this file uses.
    expect(statSync(out).size).toBeGreaterThan(15000);

    const ffmpegAvailable = await checkFfmpegAvailable();
    if (!ffmpegAvailable) {
      // Environment without ffmpeg: the render + validation assertions above already prove the
      // whole pack is legal and renders successfully; the pixel-level non-blank/motion proofs
      // below are skipped in this case (same degrade-gracefully convention as every other
      // ffmpeg-driven assertion in this file).
      return;
    }

    // NON-BLANK: at frame 50 (well past every entrance in beat 1 — blurPushUp's ~500ms/~15f push-up
    // plus its ~120ms-per-word stagger, the edgeFlip card's authored 35-frame flip-in, and the
    // strikethrough's 20-frame delay + ~21-frame draw all settle by frame ~41), the WHOLE frame
    // (not just one crop) should read well above the near-black `TOKENS.black` (#0b0a0d, luma ~11)
    // background floor — real content (text, the flip card, the glow strikethrough, the orbs) is
    // visibly composited, not a blank/near-blank frame.
    const wholeFrame = { x: 0, y: 0, w: 1080, h: 1920 };
    const lumaSettled = await meanLumaOfCrop(out, 50, wholeFrame);
    expect(lumaSettled).toBeGreaterThan(18);

    // MOTION #1 (continuous, within beat 1's own un-faded hold window — BEFORE its whip-out tail
    // starts at frame 90-24=66, so this isolates ambient/loop motion from the transition itself):
    // frame 45 and frame 60 are both well past every entrance's settle point (blurPushUp's ~15f
    // push-up + ~4f-per-word stagger, the edgeFlip card's authored 35-frame flip-in, and the
    // strikethrough's 20-frame delay + ~21-frame draw all finish by frame ~41) — so any difference
    // between them is genuinely continuous motion: liveBreathe's rotateY/rotateX loop, the
    // shineSweep band, the orbs' drift, and the global handheld idle are all still animating.
    const settledA = await frameThumbnailBytes(out, 45);
    const settledB = await frameThumbnailBytes(out, 60);
    expect(framesDiffer(settledA, settledB)).toBe(true);

    // MOTION #2 (the whip-pan transition itself): frame 20 (mid beat 1, its own content) vs frame
    // 130 (well into beat 2, past the whip-pan handoff — beat 1's durationInFrames:90 plus its
    // 24-frame overlap means beat 2 is fully in control by frame ~106) must differ substantially —
    // proof the whip transition actually carried the film into a genuinely different beat, not a
    // frozen/duplicated frame.
    const beat1Frame = await frameThumbnailBytes(out, 20);
    const beat2Frame = await frameThumbnailBytes(out, 130);
    expect(framesDiffer(beat1Frame, beat2Frame)).toBe(true);
  }, 240000);

  // interp-2 — exit.anim:"fade" was a VALID SceneSpec enum value with NO interpreter handler, so an
  // authored fade exit was a silent no-op: the layer stayed fully visible past exit.at and overlapped
  // whatever followed (the "elements overlapping" reputational failure). This proves the layer's
  // region actually darkens after its exit window (and before the beat's own out-fade confound).
  it("renders a fade exit that actually darkens the layer (interp-2 — fade/collapse were silent no-ops)", async () => {
    const v = validateSceneSpec({
      meta: { aspect: "16:9", fps: 30 },
      beats: [
        {
          durationInFrames: 60,
          background: { kind: "solid", accent: "#0b0a0d" }, // solid black isolates the text's own luma
          layers: [
            {
              element: "text",
              props: { text: "EXIT" },
              style: { role: "display", size: 0.2 },
              position: { x: 0.5, y: 0.5 },
              enter: { anim: "fade" }, // settled by ~frame 12, before the exit at 20
              exit: { anim: "fade", at: 20, durationFrames: 8 }, // fully faded by frame 28
            },
          ],
        },
      ],
    });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const out = join(remotionDir, ".test-out", "gen-fade-exit.mp4");
    const res = await renderRemotion("Generative", { spec: v.spec }, out, remotionDir);
    expect(res.width).toBe(1920);
    expect(statSync(out).size).toBeGreaterThan(10000);

    const ffmpegAvailable = await checkFfmpegAvailable();
    if (!ffmpegAvailable) return; // render success already proves the spec is legal + fade is wired
    const crop = { x: 1920 * 0.35, y: 1080 * 0.4, w: 1920 * 0.3, h: 1080 * 0.2 };
    const beforeExit = await meanLumaOfCrop(out, 18, crop); // pre-exit, settled — text bright
    const afterExit = await meanLumaOfCrop(out, 36, crop);  // past exit end (28), before beat out-fade (42)
    // The fade must have visibly reduced the layer's brightness. If fade were still a no-op the text
    // would remain fully bright and these would be ~equal.
    expect(afterExit).toBeLessThan(beforeExit - 5);
  }, 240000);

  // interp-3 + val-3 — a splitLayout authored with an off-center position + enter.delay, a countdown
  // with enter.delay, and a scale-animated shape on its DEFAULT entrance (which would otherwise
  // compound the primitive's own internal spring scale into a double-pop). Proves all three legal
  // spec shapes render without throwing (previously position/delay were silently ignored; the
  // scale-animate had no neutralizeScale pin).
  it("renders splitLayout(position+delay) + countdown(delay) + scale-animated shape without error (interp-3/val-3)", async () => {
    const v = validateSceneSpec({
      meta: { aspect: "9:16", fps: 30 },
      beats: [
        {
          durationInFrames: 70,
          background: { kind: "solid", accent: "#0b0a0d" },
          layers: [
            {
              element: "splitLayout",
              props: { direction: "row", panels: [{ element: "text", props: { text: "A" } }, { element: "text", props: { text: "B" } }] },
              position: { x: 0.4, y: 0.5 },
              enter: { anim: "spring", delay: 12 },
            },
            {
              element: "shape",
              props: { shape: "circle", fill: "#16b16a" },
              position: { x: 0.5, y: 0.8 },
              animate: { scale: { from: 0.5, to: 1, startFrame: 0, durationFrames: 20, easing: "ease-out" } },
            },
          ],
        },
        {
          durationInFrames: 60,
          background: { kind: "solid", accent: "#0b0a0d" },
          layers: [{ element: "countdown", props: { from: 3, stepFrames: 12 }, position: { x: 0.5, y: 0.5 }, enter: { anim: "fade", delay: 15 } }],
        },
      ],
    });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const out = join(remotionDir, ".test-out", "gen-interp3-val3.mp4");
    const res = await renderRemotion("Generative", { spec: v.spec }, out, remotionDir);
    expect(res.height).toBe(1920); // 9:16
    expect(statSync(out).size).toBeGreaterThan(10000);
  }, 240000);
});
