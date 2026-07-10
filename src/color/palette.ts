// Palette / dominant-colour extraction — Maestro's OWN implementation. Decodes a few downscaled
// RGB frames with the bundled FFmpeg, then median-cut quantizes the pixels to N buckets and returns
// each bucket's average colour + prominence weight. Feeds creative/brand skills: extract the reel's
// palette, then apply_color / text styling to stay on-brand. Median-cut is a classic algorithm
// reimplemented here from first principles (no third-party source).

import { spawn } from "node:child_process";
import { ffmpegBin } from "../mcp/env";

export interface Swatch { hex: string; rgb: [number, number, number]; weight: number } // weight 0–1
export interface Palette { swatches: Swatch[] }

const SIZE = 96; // per-frame sample grid

/** Decode up to `frames` downscaled RGB frames (rgb24) sampled ~1/sec. */
function decodeRgb(path: string, frames: number, ffmpegPath = ffmpegBin()): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const ff = spawn(ffmpegPath, [
      "-v", "error", "-i", path,
      "-vf", `fps=1,scale=${SIZE}:${SIZE}:force_original_aspect_ratio=increase,crop=${SIZE}:${SIZE}`,
      "-frames:v", String(frames), "-f", "rawvideo", "-pix_fmt", "rgb24", "-",
    ], { stdio: ["ignore", "pipe", "pipe"] });
    const chunks: Buffer[] = [];
    let err = "";
    ff.stdout.on("data", (d: Buffer) => chunks.push(d));
    ff.stderr.on("data", (d: Buffer) => { err += d.toString(); });
    ff.on("error", reject);
    ff.on("close", (code) => {
      const buf = Buffer.concat(chunks);
      if (buf.length === 0) return reject(new Error(`ffmpeg RGB decode produced no pixels (${code}): ${err.slice(0, 200)}`));
      resolve(new Uint8Array(buf));
    });
  });
}

interface Box { pixels: number[]; } // indices into the rgb triplet array

function channelRange(rgb: Uint8Array, idxs: number[], ch: number): number {
  let lo = 255, hi = 0;
  for (const i of idxs) { const v = rgb[i * 3 + ch]; if (v < lo) lo = v; if (v > hi) hi = v; }
  return hi - lo;
}

/** Median-cut: repeatedly split the widest-ranging box along its widest channel until N boxes. */
function medianCut(rgb: Uint8Array, n: number): Box[] {
  const count = Math.floor(rgb.length / 3);
  let boxes: Box[] = [{ pixels: Array.from({ length: count }, (_, i) => i) }];
  while (boxes.length < n) {
    // pick the box with the largest single-channel range
    let bi = -1, bestRange = -1, bestCh = 0;
    for (let k = 0; k < boxes.length; k++) {
      if (boxes[k].pixels.length < 2) continue;
      for (let ch = 0; ch < 3; ch++) {
        const r = channelRange(rgb, boxes[k].pixels, ch);
        if (r > bestRange) { bestRange = r; bi = k; bestCh = ch; }
      }
    }
    if (bi < 0 || bestRange <= 0) break;
    const box = boxes[bi];
    box.pixels.sort((a, b) => rgb[a * 3 + bestCh] - rgb[b * 3 + bestCh]);
    const mid = box.pixels.length >> 1;
    const left = { pixels: box.pixels.slice(0, mid) };
    const right = { pixels: box.pixels.slice(mid) };
    boxes.splice(bi, 1, left, right);
  }
  return boxes;
}

function toHex([r, g, b]: [number, number, number]): string {
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
}

/** Extract an N-colour palette (default 6) from a media file, sorted by prominence. */
export async function extractPalette(path: string, colors = 6, sampleFrames = 4, ffmpegPath = ffmpegBin()): Promise<Palette> {
  const rgb = await decodeRgb(path, Math.max(1, sampleFrames), ffmpegPath);
  const total = Math.floor(rgb.length / 3);
  const boxes = medianCut(rgb, Math.max(1, colors));
  const swatches: Swatch[] = boxes
    .filter((b) => b.pixels.length > 0)
    .map((b) => {
      let r = 0, g = 0, bl = 0;
      for (const i of b.pixels) { r += rgb[i * 3]; g += rgb[i * 3 + 1]; bl += rgb[i * 3 + 2]; }
      const rgbAvg: [number, number, number] = [r / b.pixels.length, g / b.pixels.length, bl / b.pixels.length];
      return { hex: toHex(rgbAvg), rgb: rgbAvg.map(Math.round) as [number, number, number], weight: b.pixels.length / total };
    })
    .sort((a, b) => b.weight - a.weight);
  return { swatches };
}
