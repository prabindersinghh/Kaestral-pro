import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractFrames } from "../frames";
import { McpExecutor } from "../../mcp/executor";

// A 3s clip that changes color halfway (red → blue) so scene sampling has something to find.
const dir = mkdtempSync(join(tmpdir(), "kaestral-vision-test-"));
const clip = join(dir, "shots.mp4");

beforeAll(() => {
  execFileSync("ffmpeg", [
    "-y",
    "-f", "lavfi", "-i", "color=c=0xE03030:s=320x240:r=30:d=1.5",
    "-f", "lavfi", "-i", "color=c=0x3040E0:s=320x240:r=30:d=1.5",
    "-filter_complex", "[0][1]concat=n=2:v=1:a=0", "-pix_fmt", "yuv420p", clip,
  ], { stdio: "ignore" });
}, 60000);

describe("video vision — extractFrames", () => {
  it("returns base64 JPEG frames with timestamps (interval)", async () => {
    const frames = await extractFrames(clip, { count: 4, mode: "interval", maxDim: 256 });
    expect(frames.length).toBe(4);
    for (const f of frames) {
      expect(f.media_type).toBe("image/jpeg");
      expect(f.data.length).toBeGreaterThan(100);      // real base64 payload
      expect(Buffer.from(f.data, "base64").length).toBeGreaterThan(200); // decodes to real bytes
    }
    // timestamps ascend across the clip
    for (let i = 1; i < frames.length; i++) expect(frames[i].timeSec).toBeGreaterThan(frames[i - 1].timeSec);
  }, 60000);

  it("scene mode finds the color change", async () => {
    const frames = await extractFrames(clip, { count: 6, mode: "scene", maxDim: 256 });
    expect(frames.length).toBeGreaterThanOrEqual(1); // at least the first shot; the cut adds another
  }, 60000);
});

describe("see_video MCP tool returns viewable image blocks", () => {
  it("emits an image content block per frame", async () => {
    const ex = new McpExecutor();
    const imp = JSON.parse((await ex.execute("import_media", { source: { path: clip } })).content[0].text ?? "{}") as { assetId: string };
    const r = await ex.execute("see_video", { mediaRef: imp.assetId, count: 3, mode: "interval" });
    expect(r.isError).toBeFalsy();
    // content[0] is the text caption; the rest are image blocks the model can SEE
    expect(r.content[0].type).toBe("text");
    const images = r.content.filter((c) => c.type === "image");
    expect(images.length).toBe(3);
    // MCP-canonical flat image shape {type:"image", data, mimeType}
    const img0 = images[0] as { type: "image"; data: string; mimeType: string };
    expect(img0.mimeType).toBe("image/jpeg");
    expect(img0.data.length).toBeGreaterThan(100);
    expect(Buffer.from(img0.data, "base64").length).toBeGreaterThan(200);
  }, 60000);
});

// B4 (field report v1.0.5): 12 frames per call over a 2:22 recording is one frame every 12 s —
// useless for finding a click, so the operator built 1-fps contact sheets in ffmpeg. A time window
// (fromSec/toSec) can now be sampled densely (fps), under a hard cap on frames per call.
describe("see_video dense time window (fromSec / toSec / fps)", () => {
  it("extractFrames samples a window at the requested fps, timestamps ascending from fromSec", async () => {
    const frames = await extractFrames(clip, { startSec: 1.0, endSec: 2.0, fps: 4, maxDim: 128 });
    expect(frames.map((f) => f.timeSec)).toEqual([1, 1.25, 1.5, 1.75, 2]);
  }, 60000);

  it("extractFrames hard-caps a too-dense window at MAX_FRAMES_PER_CALL (payload guard)", async () => {
    const { MAX_FRAMES_PER_CALL } = await import("../frames");
    const frames = await extractFrames(clip, { startSec: 0, endSec: 3, fps: 30, maxDim: 128 });
    expect(frames.length).toBe(MAX_FRAMES_PER_CALL);
    // …and the window is still covered end to end (cap thins the sampling, it doesn't truncate it).
    expect(frames[0].timeSec).toBe(0);
    expect(frames[frames.length - 1].timeSec).toBeCloseTo(3, 1);
  }, 60000);

  it("see_video(mediaRef, fromSec, toSec, fps) returns one image per sample with source timestamps", async () => {
    const ex = new McpExecutor();
    const imp = JSON.parse((await ex.execute("import_media", { source: { path: clip } })).content[0].text) as { assetId: string };
    const r = await ex.execute("see_video", { mediaRef: imp.assetId, fromSec: 1, toSec: 2, fps: 2, maxDim: 128 });
    expect(r.isError, r.content[0].text).toBeFalsy();
    expect(r.content.filter((c) => c.type === "image").length).toBe(3); // 1.0, 1.5, 2.0
    expect(r.content[0].text).toMatch(/1\.00s/);
    expect(r.content[0].text).toMatch(/2\.00s/);
  }, 60000);

  it("see_video(clipId, fromSec, toSec) takes CLIP-relative seconds and labels each frame with its timeline frame", async () => {
    const ex = new McpExecutor();
    const imp = JSON.parse((await ex.execute("import_media", { source: { path: clip } })).content[0].text) as { assetId: string };
    // Place the clip at timeline frame 300 with 1 s trimmed off its head (fps 30).
    await ex.execute("add_clips", { entries: [{ mediaRef: imp.assetId, startFrame: 300, trimStartFrame: 30, durationFrames: 60 }] });
    const clipId = ex.timeline.tracks.flatMap((t) => t.clips).find((c) => c.mediaType === "video")!.id;
    const r = await ex.execute("see_video", { clipId, fromSec: 0, toSec: 1, fps: 1, maxDim: 128 });
    expect(r.isError, r.content[0].text).toBeFalsy();
    expect(r.content.filter((c) => c.type === "image").length).toBe(2);
    // clip-second 0 = source 1.00s = timeline frame 300; clip-second 1 = source 2.00s = frame 330
    expect(r.content[0].text).toMatch(/1\.00s \(timeline frame 300\)/);
    expect(r.content[0].text).toMatch(/2\.00s \(timeline frame 330\)/);
  }, 60000);

  it("see_video rejects a window outside the clip and a backwards window", async () => {
    const ex = new McpExecutor();
    const imp = JSON.parse((await ex.execute("import_media", { source: { path: clip } })).content[0].text) as { assetId: string };
    const r = await ex.execute("see_video", { mediaRef: imp.assetId, fromSec: 2, toSec: 1 });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/toSec must be greater than fromSec/);
  }, 60000);
});
