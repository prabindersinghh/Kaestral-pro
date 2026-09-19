// One composited timeline frame → JPEG. The agent's self-critique loop (inspect_timeline): exactly
// the drawFrame + NodeFrameSource pipeline renderVideo runs, for a single frame, so what the agent
// SEES is what the export will contain — grades, effects, text, keyframed motion all baked. Not a
// second renderer: the only differences from renderVideo are "one frame" and "downscale + JPEG".

import { createCanvas } from "@napi-rs/canvas";
import { drawFrame } from "../compositor/draw";
import { totalFrames } from "../model/helpers";
import { NodeFrameSource } from "./nodeFrameSource";
import { renderSize } from "./renderVideo";
import type { Timeline } from "../model/types";

export interface RenderFrameOptions {
  /** mediaRef → absolute source path (real decoded pixels; null → labelled placeholder tile). */
  mediaPath: (mediaRef: string) => string | null;
  mediaName?: (mediaRef: string) => string;
  /** Longest side of the returned image, in px (default 768). The frame is composited at the
   *  timeline's own size first — text sizes are in canvas points — and downscaled afterwards. */
  maxDim?: number;
  /** JPEG quality 0–1 (default 0.82). */
  quality?: number;
  ffmpegPath?: string;
}

export interface RenderedFrame {
  frame: number;
  width: number;
  height: number;
  jpegBase64: string;
  /** mediaRefs that rendered as a placeholder tile (could not be decoded) — same meaning as
   *  RenderResult.missingMedia. Text clips are never listed (they are drawn, not decoded). */
  missingMedia: string[];
}

/** Composite output frame `frame` of `timeline` (clamped to its range) and encode it as JPEG. */
export async function renderTimelineFrame(timeline: Timeline, frame: number, opts: RenderFrameOptions): Promise<RenderedFrame> {
  const fps = Math.max(1, timeline.fps);
  const [W, H] = renderSize(timeline, "Match Timeline");
  const total = Math.max(1, totalFrames(timeline.tracks));
  const f = Math.max(0, Math.min(total - 1, Math.trunc(frame)));
  const mediaName = opts.mediaName ?? ((r) => r);

  const frameSource = new NodeFrameSource(opts.mediaPath, fps, opts.ffmpegPath);
  try {
    await frameSource.prepare(timeline, { onlyFrame: f });
    await frameSource.ensure(timeline, f);
    const full = createCanvas(W, H);
    drawFrame(full.getContext("2d") as unknown as CanvasRenderingContext2D, timeline, { width: W, height: H, frame: f, mediaName, frameSource });

    // Downscale for the tool_result payload (the agent reads composition, not pixels).
    const maxDim = Math.max(128, Math.min(2048, Math.trunc(opts.maxDim ?? 768)));
    const scale = Math.min(1, maxDim / Math.max(W, H));
    const outW = Math.max(1, Math.round(W * scale)), outH = Math.max(1, Math.round(H * scale));
    let out = full;
    if (scale < 1) {
      out = createCanvas(outW, outH);
      out.getContext("2d").drawImage(full, 0, 0, outW, outH);
    }
    const jpeg = out.toBuffer("image/jpeg", Math.max(0.1, Math.min(1, opts.quality ?? 0.82)));
    return { frame: f, width: outW, height: outH, jpegBase64: jpeg.toString("base64"), missingMedia: [...frameSource.missing] };
  } finally {
    await frameSource.cleanup();
  }
}
