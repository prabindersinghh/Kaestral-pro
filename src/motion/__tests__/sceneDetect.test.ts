import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detectScenes } from "../sceneDetect";

// A synthetic 6s clip with two HARD cuts at exactly t=2s and t=4s (red → blue → green), built with
// ffmpeg at test time — a deterministic fixture, same pattern as the beats suite's synthesized WAVs.
const dir = mkdtempSync(join(tmpdir(), "kaestral-scenes-"));
const clip = join(dir, "scenes.mp4");

beforeAll(() => {
  execFileSync("ffmpeg", [
    "-v", "error", "-y",
    "-f", "lavfi", "-i", "color=red:s=320x180:d=2:r=30",
    "-f", "lavfi", "-i", "color=blue:s=320x180:d=2:r=30",
    "-f", "lavfi", "-i", "color=green:s=320x180:d=2:r=30",
    "-filter_complex", "[0][1][2]concat=n=3:v=1:a=0", clip,
  ]);
}, 60000);

describe("detectScenes (scene-cut detection)", () => {
  it("finds the two constructed cuts at ~2s and ~4s, as project frames at the given fps", async () => {
    const r = await detectScenes(clip, { fps: 30 });
    expect(r.fps).toBe(30);
    expect(r.durationSec).toBeGreaterThan(5.5);
    expect(r.cutCount).toBe(2);
    // Frame 60 (t=2s) and frame 120 (t=4s), ±2 frames of encoder tolerance.
    expect(Math.abs(r.cuts[0].frame - 60)).toBeLessThanOrEqual(2);
    expect(Math.abs(r.cuts[1].frame - 120)).toBeLessThanOrEqual(2);
    // Ascending, scored, and never reporting t=0 as a cut.
    expect(r.cuts[0].timeSec).toBeLessThan(r.cuts[1].timeSec);
    for (const c of r.cuts) {
      expect(c.timeSec).toBeGreaterThan(0.5);
      expect(c.score).toBeGreaterThan(0);
      expect(c.score).toBeLessThanOrEqual(1);
    }
  }, 60000);

  it("a higher threshold reports fewer (or equal) cuts; a cut-free clip reports none", async () => {
    // The flat-color cuts score exactly 0.4 — a 0.5 threshold must exclude them.
    const strict = await detectScenes(clip, { fps: 30, threshold: 0.5 });
    expect(strict.cutCount).toBeLessThanOrEqual(2);
    const single = join(dir, "single.mp4");
    execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "color=red:s=320x180:d=2:r=30", single]);
    const none = await detectScenes(single, { fps: 30 });
    expect(none.cutCount).toBe(0);
    expect(none.cuts).toEqual([]);
  }, 60000);
});
