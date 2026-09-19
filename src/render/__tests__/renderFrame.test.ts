import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadImage, createCanvas } from "@napi-rs/canvas";
import { renderTimelineFrame } from "../renderFrame";
import { McpExecutor } from "../../mcp/executor";
import { defaultClip, defaultTrack, defaultTimeline, defaultTextStyle } from "../../model/defaults";
import type { Clip, Timeline } from "../../model/types";

// B5 (field report v1.0.5): inspect_timeline returned only a structured summary — the agent could
// never SEE its own finished work. It now also renders ONE composited frame (grades, effects, text,
// motion baked) through the same drawFrame the export uses, extracting only that frame's source
// pixels (not every frame of every clip). Same synthetic media as realpixels.test.ts: a video that
// is RED for 1 s then GREEN for 1 s, plus a solid CYAN still.
const dir = mkdtempSync(join(tmpdir(), "kaestral-frame-"));
const videoPath = join(dir, "src.mp4");
const imagePath = join(dir, "logo.png");

beforeAll(() => {
  execFileSync("ffmpeg", [
    "-y", "-f", "lavfi", "-i", "color=c=0xFF0000:s=320x240:r=30:d=1", "-f", "lavfi", "-i", "color=c=0x00FF00:s=320x240:r=30:d=1",
    "-filter_complex", "[0][1]concat=n=2:v=1:a=0", "-pix_fmt", "yuv420p", "-r", "30", videoPath,
  ], { stdio: "ignore" });
  execFileSync("ffmpeg", ["-y", "-f", "lavfi", "-i", "color=c=0x00FFFF:s=100x100", "-frames:v", "1", imagePath], { stdio: "ignore" });
}, 60000);

async function pixel(jpegBase64: string, x: number, y: number): Promise<[number, number, number]> {
  const img = await loadImage(Buffer.from(jpegBase64, "base64"));
  const c = createCanvas(img.width, img.height);
  const cx = c.getContext("2d");
  cx.drawImage(img, 0, 0);
  const d = cx.getImageData(x, y, 1, 1).data;
  return [d[0], d[1], d[2]];
}

function timeline(): Timeline {
  const png: Clip = defaultClip({ mediaRef: "img", startFrame: 0, durationFrames: 60, id: "cimg", mediaType: "image" });
  png.transform = { centerX: 0.18, centerY: 0.18, width: 0.28, height: 0.28, rotation: 0, flipHorizontal: false, flipVertical: false };
  const vid: Clip = defaultClip({ mediaRef: "vid", startFrame: 0, durationFrames: 60, id: "cvid", mediaType: "video" });
  return {
    ...defaultTimeline(), fps: 30, width: 320, height: 240,
    tracks: [
      { ...defaultTrack("video", "overlay"), clips: [png] },
      { ...defaultTrack("video", "main"), clips: [vid] },
    ],
  };
}
const paths: Record<string, string> = { vid: videoPath, img: imagePath };
const mediaPath = (r: string) => paths[r] ?? null;
const mediaName = (r: string) => r;

describe("renderTimelineFrame — one composited frame with real source pixels", () => {
  it("is frame-accurate (red at 5, green at 45) and composites the image PIP", async () => {
    const tl = timeline();
    const f5 = await renderTimelineFrame(tl, 5, { mediaPath, mediaName });
    expect(f5.width).toBe(320);
    expect(f5.height).toBe(240);
    expect(f5.missingMedia).toEqual([]);
    const [r5, g5] = await pixel(f5.jpegBase64, 160, 120);
    expect(r5).toBeGreaterThan(150);
    expect(g5).toBeLessThan(90);
    const [rc, gc, bc] = await pixel(f5.jpegBase64, 58, 43);
    expect(gc).toBeGreaterThan(150);
    expect(bc).toBeGreaterThan(150);
    expect(rc).toBeLessThan(120);

    const f45 = await renderTimelineFrame(tl, 45, { mediaPath, mediaName });
    const [r45, g45] = await pixel(f45.jpegBase64, 160, 120);
    expect(g45).toBeGreaterThan(150);
    expect(r45).toBeLessThan(120);
  }, 90000);

  it("bakes keyframed motion: an animated PIP has left its start position by its last frame", async () => {
    const tl = timeline();
    const pip = tl.tracks[0].clips[0];
    pip.positionTrack = { keyframes: [
      { frame: 0, value: { a: 0.04, b: 0.04 }, interpolationOut: "linear" },
      { frame: 59, value: { a: 0.7, b: 0.7 }, interpolationOut: "linear" },
    ] };
    const late = await renderTimelineFrame(tl, 59, { mediaPath, mediaName });
    const [rc, gc] = await pixel(late.jpegBase64, 58, 43); // where the PIP WAS → the green video shows
    expect(gc).toBeGreaterThan(150);
    expect(rc).toBeLessThan(120);
    const [rm, gm, bm] = await pixel(late.jpegBase64, 270, 205); // where it moved → cyan
    expect(gm).toBeGreaterThan(150);
    expect(bm).toBeGreaterThan(150);
    expect(rm).toBeLessThan(120);
  }, 90000);

  it("bakes a colour grade (saturation 0 turns the red frame grey) and honours hidden tracks", async () => {
    const tl = timeline();
    tl.tracks[0].hidden = true;
    tl.tracks[1].clips[0].effects = [{ id: "e1", type: "color.saturation", enabled: true, params: { amount: { value: 0 } } }];
    const f = await renderTimelineFrame(tl, 5, { mediaPath, mediaName });
    const [r, g, b] = await pixel(f.jpegBase64, 160, 120);
    expect(Math.abs(r - g)).toBeLessThan(40); // grey, not red
    expect(Math.abs(g - b)).toBeLessThan(40);
    const [rc, gc, bc] = await pixel(f.jpegBase64, 58, 43); // hidden PIP → the same grey video, not cyan
    expect(Math.abs(rc - gc)).toBeLessThan(40);
    expect(bc).toBeLessThan(200);
  }, 90000);

  it("bakes text (a frame with a caption differs from one without) and downscales to maxDim", async () => {
    const tl = timeline();
    const text: Clip = defaultClip({ mediaRef: "text-1", startFrame: 0, durationFrames: 60, id: "ct", mediaType: "text" });
    text.textContent = "HELLO";
    text.textStyle = defaultTextStyle();
    const withText: Timeline = { ...tl, tracks: [{ ...defaultTrack("text", "t"), clips: [text] }, ...tl.tracks] };
    const a = await renderTimelineFrame(tl, 5, { mediaPath, mediaName, maxDim: 160 });
    const b = await renderTimelineFrame(withText, 5, { mediaPath, mediaName, maxDim: 160 });
    expect(a.width).toBe(160);
    expect(a.height).toBe(120);
    expect(b.missingMedia).toEqual([]); // text is drawn, never "missing"
    expect(a.jpegBase64).not.toBe(b.jpegBase64);
  }, 90000);
});

describe("inspect_timeline returns the composited frame as an image block beside the summary", () => {
  it("empty timeline → summary only; placed clips → JSON summary + one image at the requested frame", async () => {
    const ex = new McpExecutor();
    const empty = await ex.execute("inspect_timeline", {});
    expect(empty.isError).toBeFalsy();
    expect(empty.content.length).toBe(1);

    const imp = JSON.parse((await ex.execute("import_media", { source: { path: videoPath } })).content[0].text) as { assetId: string };
    await ex.execute("add_clips", { entries: [{ mediaRef: imp.assetId, startFrame: 0, durationFrames: 60 }] });
    const r = await ex.execute("inspect_timeline", { frame: 45, maxDim: 320 });
    expect(r.isError, r.content[0].text).toBeFalsy();
    const summary = JSON.parse(r.content[0].text) as { trackCount: number; preview: { frame: number; timeSec: number; width: number; height: number } };
    expect(summary.trackCount).toBeGreaterThan(0);
    expect(summary.preview.frame).toBe(45);
    expect(summary.preview.timeSec).toBe(1.5);
    const img = r.content[1] as { type: string; data: string; mimeType: string };
    expect(img.type).toBe("image");
    expect(img.mimeType).toBe("image/jpeg");
    // The clip fills the default 1920x1080 project frame, so the centre is GREEN at 1.5 s.
    const [rr, gg] = await pixel(img.data, Math.round(summary.preview.width / 2), Math.round(summary.preview.height / 2));
    expect(gg).toBeGreaterThan(150);
    expect(rr).toBeLessThan(120);
    // A frame past the end clamps to the last frame.
    const tail = JSON.parse((await ex.execute("inspect_timeline", { frame: 9999 })).content[0].text) as { preview: { frame: number } };
    expect(tail.preview.frame).toBe(59);
  }, 120000);
});
