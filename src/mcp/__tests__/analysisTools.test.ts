import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { McpExecutor } from "../executor";

// Real media so the tools resolve a path and run the actual FFmpeg-backed analyzers.
const dir = mkdtempSync(join(tmpdir(), "kaestral-analysis-"));
const click = join(dir, "click.wav");
const rb = join(dir, "rb.mp4");

beforeAll(() => {
  execFileSync("ffmpeg", ["-y", "-f", "lavfi", "-i", "aevalsrc=0.7*sin(2*PI*880*t)*lt(mod(t\\,0.5)\\,0.05):d=5:s=22050", click], { stdio: "ignore" });
  execFileSync("ffmpeg", ["-y", "-f", "lavfi", "-i", "color=c=0xFF0000:s=80x80:r=30:d=1", "-f", "lavfi", "-i", "color=c=0x0000FF:s=80x80:r=30:d=1", "-filter_complex", "[0][1]hstack=inputs=2", "-pix_fmt", "yuv420p", rb], { stdio: "ignore" });
}, 60000);

describe("analyze_audio + extract_palette MCP tools (end-to-end via executor)", () => {
  it("analyze_audio returns beats/onsets/tempo in project frames", async () => {
    const ex = new McpExecutor();
    const imp = await ex.execute("import_media", { source: { path: click } });
    const { assetId } = JSON.parse(imp.content[0].text) as { assetId: string };
    const r = await ex.execute("analyze_audio", { mediaRef: assetId });
    expect(r.isError).toBeFalsy();
    const out = JSON.parse(r.content[0].text) as { tempoBpm: number; onsetFrames: number[]; beatFrames: number[]; fps: number };
    expect(out.fps).toBe(30);
    expect(out.onsetFrames.length).toBeGreaterThanOrEqual(6);
    expect(out.tempoBpm).toBeGreaterThan(50);
  }, 60000);

  it("extract_palette returns weighted hex swatches (red + blue)", async () => {
    const ex = new McpExecutor();
    const imp = await ex.execute("import_media", { source: { path: rb } });
    const { assetId } = JSON.parse(imp.content[0].text) as { assetId: string };
    const r = await ex.execute("extract_palette", { mediaRef: assetId, colors: 4 });
    expect(r.isError).toBeFalsy();
    const out = JSON.parse(r.content[0].text) as { swatches: { hex: string; rgb: [number, number, number]; weight: number }[] };
    expect(out.swatches.length).toBeGreaterThanOrEqual(2);
    expect(out.swatches.some((s) => s.rgb[0] > 120 && s.rgb[2] < 100)).toBe(true); // red
    expect(out.swatches.some((s) => s.rgb[2] > 120 && s.rgb[0] < 100)).toBe(true); // blue
  }, 60000);

  it("errors clearly when the media can't be resolved", async () => {
    const ex = new McpExecutor();
    const r = await ex.execute("analyze_audio", { mediaRef: "nope" });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/resolvable mediaRef or clipId/);
  });
});
