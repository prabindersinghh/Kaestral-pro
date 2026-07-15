import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadImage, createCanvas } from "@napi-rs/canvas";
import { renderVideo } from "../renderVideo";
import { defaultClip, defaultTrack, defaultTimeline } from "../../model/defaults";
import type { Clip, Timeline } from "../../model/types";

// A source video that is RED for its first second and GREEN for its second (60 frames @30),
// plus a solid CYAN still. If the render composites real pixels, the output shows red early,
// green late (frame-accurate through trim), and cyan where the image PIP sits.
const dir = mkdtempSync(join(tmpdir(), "kaestral-realpx-"));
const videoPath = join(dir, "src.mp4");
const imagePath = join(dir, "logo.png");

beforeAll(() => {
  execFileSync("ffmpeg", [
    "-y",
    "-f", "lavfi", "-i", "color=c=0xFF0000:s=320x240:r=30:d=1",
    "-f", "lavfi", "-i", "color=c=0x00FF00:s=320x240:r=30:d=1",
    "-filter_complex", "[0][1]concat=n=2:v=1:a=0", "-pix_fmt", "yuv420p", "-r", "30", videoPath,
  ], { stdio: "ignore" });
  execFileSync("ffmpeg", ["-y", "-f", "lavfi", "-i", "color=c=0x00FFFF:s=100x100", "-frames:v", "1", imagePath], { stdio: "ignore" });
}, 60000);

/** Sample one RGB pixel of output frame `n` at (x,y): extract the frame → getImageData. */
async function samplePixel(file: string, n: number, x: number, y: number): Promise<[number, number, number]> {
  const png = join(dir, `probe_${n}_${x}_${y}.png`);
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", file, "-vf", `select=eq(n\\,${n})`, "-vframes", "1", png], { stdio: "ignore" });
  const img = await loadImage(png);
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

describe("REAL decoded pixels in the FFmpeg render (import mp4/png → export shows footage)", () => {
  it("renders true source pixels: red early, green late (frame-accurate), cyan image PIP", async () => {
    const out = join(dir, "out.mp4");
    const paths: Record<string, string> = { vid: videoPath, img: imagePath };
    await renderVideo(timeline(), { outputPath: out, codec: "H.264", mediaName: (r) => r, mediaPath: (r) => paths[r] ?? null });

    const [r5, g5, b5] = await samplePixel(out, 5, 160, 120);   // centre, first second → RED
    expect(r5).toBeGreaterThan(150);
    expect(g5).toBeLessThan(90);
    expect(b5).toBeLessThan(90);

    const [r45, g45, b45] = await samplePixel(out, 45, 160, 120); // centre, second second → GREEN
    expect(g45).toBeGreaterThan(150);
    expect(r45).toBeLessThan(120);
    expect(b45).toBeLessThan(120);

    const [rc, gc, bc] = await samplePixel(out, 5, 58, 43);       // image PIP → CYAN
    expect(gc).toBeGreaterThan(150);
    expect(bc).toBeGreaterThan(150);
    expect(rc).toBeLessThan(120);
  }, 90000);
});
