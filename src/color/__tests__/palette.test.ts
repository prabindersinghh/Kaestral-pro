import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractPalette } from "../palette";

// A 2s clip that is the left half pure RED and right half pure BLUE → palette must surface both.
const dir = mkdtempSync(join(tmpdir(), "maestro-palette-"));
const clipPath = join(dir, "rb.mp4");

beforeAll(() => {
  execFileSync("ffmpeg", [
    "-y",
    "-f", "lavfi", "-i", "color=c=0xFF0000:s=100x100:r=30:d=2",
    "-f", "lavfi", "-i", "color=c=0x0000FF:s=100x100:r=30:d=2",
    "-filter_complex", "[0][1]hstack=inputs=2", "-pix_fmt", "yuv420p", clipPath,
  ], { stdio: "ignore" });
}, 60000);

describe("palette extraction (our own median-cut over FFmpeg pixels)", () => {
  it("extracts red and blue with prominence weights that sum to ~1", async () => {
    const { swatches } = await extractPalette(clipPath, 4, 2);
    expect(swatches.length).toBeGreaterThanOrEqual(2);
    const totalWeight = swatches.reduce((s, w) => s + w.weight, 0);
    expect(totalWeight).toBeGreaterThan(0.9);
    expect(totalWeight).toBeLessThan(1.1);
    const isRed = (s: { rgb: [number, number, number] }) => s.rgb[0] > 120 && s.rgb[2] < 100;
    const isBlue = (s: { rgb: [number, number, number] }) => s.rgb[2] > 120 && s.rgb[0] < 100;
    expect(swatches.some(isRed)).toBe(true);
    expect(swatches.some(isBlue)).toBe(true);
    // hex is well-formed
    expect(swatches[0].hex).toMatch(/^#[0-9a-f]{6}$/);
  }, 60000);
});
