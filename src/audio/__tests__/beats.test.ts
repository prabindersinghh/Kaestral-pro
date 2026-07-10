import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { analyzeBeats } from "../beats";

// A 6s click track: an 880 Hz tone pulsed ON for 50 ms every 500 ms → a clear beat at 120 BPM.
const dir = mkdtempSync(join(tmpdir(), "maestro-beats-"));
const clickPath = join(dir, "click.wav");

beforeAll(() => {
  execFileSync("ffmpeg", [
    "-y", "-f", "lavfi",
    "-i", "aevalsrc=0.7*sin(2*PI*880*t)*lt(mod(t\\,0.5)\\,0.05):d=6:s=22050",
    clickPath,
  ], { stdio: "ignore" });
}, 60000);

describe("beat/onset detection (our own FFmpeg-based analyzer)", () => {
  it("finds ~one onset per 0.5s beat and a tempo near 120 BPM", async () => {
    const a = await analyzeBeats(clickPath, 30);
    expect(a.durationSec).toBeGreaterThan(5.5);
    // ~12 beats in 6s (one every 0.5s). Allow slack for edge windows / detector noise.
    expect(a.onsetFrames.length).toBeGreaterThanOrEqual(8);
    expect(a.onsetFrames.length).toBeLessThanOrEqual(16);
    // Onsets are in ascending project frames, spaced ~15 frames (0.5s @30fps).
    for (let i = 1; i < a.onsetFrames.length; i++) expect(a.onsetFrames[i]).toBeGreaterThan(a.onsetFrames[i - 1]);
    // Tempo detected within a reasonable band around 120 (or a metrical multiple like 60/240).
    expect(a.tempoBpm).toBeGreaterThan(50);
    expect([60, 120, 240].some((b) => Math.abs(a.tempoBpm - b) <= 12)).toBe(true);
    // A tempo grid was produced.
    expect(a.beatFrames.length).toBeGreaterThan(4);
  }, 60000);
});
