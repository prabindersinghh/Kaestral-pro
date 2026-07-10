import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { analyzeBeats, silencesFromEnvelope } from "../beats";

// A 6s click track: an 880 Hz tone pulsed ON for 50 ms every 500 ms → a clear beat at 120 BPM.
const dir = mkdtempSync(join(tmpdir(), "maestro-beats-"));
const clickPath = join(dir, "click.wav");
// A "speech-then-silence" clip: 1s of tone, 1s of silence, 1s of tone → one clear dead-air gap.
const gapPath = join(dir, "gap.wav");

beforeAll(() => {
  execFileSync("ffmpeg", [
    "-y", "-f", "lavfi",
    "-i", "aevalsrc=0.7*sin(2*PI*880*t)*lt(mod(t\\,0.5)\\,0.05):d=6:s=22050",
    clickPath,
  ], { stdio: "ignore" });
  execFileSync("ffmpeg", [
    "-y", "-f", "lavfi",
    "-i", "aevalsrc=0.6*sin(2*PI*440*t)*(lt(t\\,1)+gt(t\\,2)):d=3:s=22050",
    gapPath,
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

  it("detects the dead-air gap for jump-cut-on-pause", async () => {
    const a = await analyzeBeats(gapPath, 30);
    // Expect one silence range covering roughly [1s, 2s] → frames [~30, ~60] @30fps (padded inward).
    expect(a.silences.length).toBeGreaterThanOrEqual(1);
    const gap = a.silences.find((r) => r.startFrame >= 25 && r.endFrame <= 68);
    expect(gap).toBeDefined();
    expect(gap!.endFrame - gap!.startFrame).toBeGreaterThan(15); // ~0.5s+ of real silence
  }, 60000);
});

describe("silence gate", () => {
  it("returns nothing for a fully-loud envelope", () => {
    const env = new Array(200).fill(0.5);
    expect(silencesFromEnvelope(env, 30)).toEqual([]);
  });
});
