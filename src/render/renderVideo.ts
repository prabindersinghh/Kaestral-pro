// Video render — the finish line. Rasterizes each composited frame headlessly with @napi-rs/canvas
// (the SAME drawFrame the live preview uses, so preview == export) and pipes PNG frames to FFmpeg
// (on PATH / Tauri sidecar) → H.264/H.265 (mp4) or ProRes (mov). Runs in Node (MCP server / sidecar).

import { createCanvas } from "@napi-rs/canvas";
import { spawn } from "node:child_process";
import { drawFrame } from "../compositor/draw";
import { totalFrames } from "../model/helpers";
import { NodeFrameSource } from "./nodeFrameSource";
import type { Timeline } from "../model/types";

export type VideoCodec = "H.264" | "H.265" | "ProRes";
export type VideoResolution = "720p" | "1080p" | "2K" | "4K" | "Match Timeline";

export interface RenderOptions {
  outputPath: string;
  codec?: VideoCodec;
  resolution?: VideoResolution;
  mediaName?: (mediaRef: string) => string;
  /** mediaRef → absolute source path; enables real decoded pixels (else labelled tiles). */
  mediaPath?: (mediaRef: string) => string | null;
  onProgress?: (done: number, total: number) => void;
  ffmpegPath?: string;
}

export interface RenderResult {
  outputPath: string;
  frames: number;
  width: number;
  height: number;
  codec: VideoCodec;
}

const even = (n: number): number => Math.max(2, Math.floor(Math.round(n) / 2) * 2);

/** ExportResolution.renderSize (ExportOptions.swift). */
export function renderSize(timeline: Timeline, resolution: VideoResolution): [number, number] {
  const short = { "720p": 720, "1080p": 1080, "2K": 1440, "4K": 2160 }[resolution as "720p"];
  if (!short) return [even(timeline.width), even(timeline.height)];
  const canvasShort = Math.min(timeline.width, timeline.height);
  if (canvasShort <= 0) return [even(timeline.width), even(timeline.height)];
  const scale = short / canvasShort;
  return [even(timeline.width * scale), even(timeline.height * scale)];
}

function ffmpegArgs(codec: VideoCodec, fps: number, W: number, H: number, out: string): string[] {
  const input = ["-y", "-f", "image2pipe", "-framerate", String(fps), "-s", `${W}x${H}`, "-i", "-"];
  const rate = ["-r", String(fps)];
  switch (codec) {
    case "ProRes":
      return [...input, ...rate, "-c:v", "prores_ks", "-profile:v", "3", "-pix_fmt", "yuv422p10le", out];
    case "H.265":
      return [...input, ...rate, "-c:v", "libx265", "-pix_fmt", "yuv420p", "-crf", "22", "-tag:v", "hvc1", out];
    default:
      return [...input, ...rate, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "medium", "-movflags", "+faststart", out];
  }
}

export async function renderVideo(timeline: Timeline, opts: RenderOptions): Promise<RenderResult> {
  const codec = opts.codec ?? "H.264";
  const fps = Math.max(1, timeline.fps);
  const [W, H] = renderSize(timeline, opts.resolution ?? "Match Timeline");
  const total = Math.max(1, totalFrames(timeline.tracks));
  const mediaName = opts.mediaName ?? ((r) => r);

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // Real decoded pixels (images + extracted video frames), when a path resolver is given.
  const frameSource = opts.mediaPath ? new NodeFrameSource(opts.mediaPath, fps, opts.ffmpegPath) : undefined;
  if (frameSource) await frameSource.prepare(timeline);

  const ff = spawn(opts.ffmpegPath ?? "ffmpeg", ffmpegArgs(codec, fps, W, H, opts.outputPath), {
    stdio: ["pipe", "ignore", "pipe"],
  });
  let stderr = "";
  ff.stderr.on("data", (d) => { stderr += String(d); if (stderr.length > 20000) stderr = stderr.slice(-20000); });

  const closed = new Promise<void>((resolve, reject) => {
    ff.on("error", (e) => reject(new Error(`Failed to launch ffmpeg (${opts.ffmpegPath ?? "ffmpeg"}): ${e.message}`)));
    ff.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-800)}`))));
  });

  const write = (buf: Buffer): Promise<void> =>
    ff.stdin.write(buf) ? Promise.resolve() : new Promise((r) => ff.stdin.once("drain", () => r()));

  try {
    for (let f = 0; f < total; f++) {
      if (frameSource) await frameSource.ensure(timeline, f);
      drawFrame(ctx as unknown as CanvasRenderingContext2D, timeline, { width: W, height: H, frame: f, mediaName, frameSource });
      await write(canvas.toBuffer("image/png"));
      opts.onProgress?.(f + 1, total);
    }
  } finally {
    ff.stdin.end();
    await frameSource?.cleanup();
  }
  await closed;
  return { outputPath: opts.outputPath, frames: total, width: W, height: H, codec };
}
