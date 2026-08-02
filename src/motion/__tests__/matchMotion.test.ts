import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { extractMotionSpec } from "../matchMotion";

// Real end-to-end test: run the motion extractor on an ACTUAL clip in the repo (not a mock) and assert
// the MotionSpec is well-formed. We do NOT assert a specific camera class — the classifier is a coarse
// optical-flow estimator; we assert it returns a VALID class and a real per-beat palette.
const CLIP = join(process.cwd(), "public", "sample-video.mp4");
const CAMERA_CLASSES = new Set(["static", "push-in", "pull-back", "pan"]);
const HEX = /^#[0-9a-f]{6}$/i;

describe("extractMotionSpec (match motion from a real reference clip)", () => {
  it("produces a well-formed MotionSpec: beats, per-beat palette, valid camera class, monotonic frames", async () => {
    expect(existsSync(CLIP), `test clip missing: ${CLIP}`).toBe(true);

    const spec = await extractMotionSpec(CLIP);

    // container metadata
    expect(spec.fps).toBeGreaterThan(0);
    expect(spec.width).toBeGreaterThan(0);
    expect(spec.height).toBeGreaterThan(0);
    expect(spec.durationSec).toBeGreaterThan(0);

    // at least one beat, and beatCount matches the array
    expect(spec.beatCount).toBeGreaterThanOrEqual(1);
    expect(spec.beats.length).toBe(spec.beatCount);

    let prevEnd = -1;
    for (const b of spec.beats) {
      // monotonic, non-empty windows
      expect(b.startFrame).toBeLessThan(b.endFrame);
      expect(b.startFrame).toBeGreaterThanOrEqual(prevEnd); // segments don't overlap / go backwards
      prevEnd = b.endFrame;

      // a valid camera class (+ a direction only when panning)
      expect(CAMERA_CLASSES.has(b.camera)).toBe(true);
      if (b.camera === "pan") expect(["left", "right", "up", "down"]).toContain(b.panDirection);
      else expect(b.panDirection).toBeUndefined();

      // confidence in range
      expect(b.motionConfidence).toBeGreaterThanOrEqual(0);
      expect(b.motionConfidence).toBeLessThanOrEqual(1);

      // a real per-beat palette of valid hex colors
      expect(b.palette.length).toBeGreaterThan(0);
      for (const hex of b.palette) expect(hex).toMatch(HEX);
    }
  }, 120000);
});
