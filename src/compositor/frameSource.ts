// A frame source supplies the DECODED source image for a clip at an output frame — real pixels.
// Two implementations share this interface so preview (browser) and render (node) composite the
// same footage: NodeFrameSource (@napi-rs/canvas loadImage + FFmpeg extraction) and
// BrowserFrameSource (createImageBitmap + <video> seek). Returns null when the frame isn't decoded
// yet (the compositor then draws a placeholder tile and the source triggers a load + re-render).

import type { Clip } from "../model/types";

export interface FrameImage {
  image: CanvasImageSource;
  width: number;
  height: number;
}

export interface FrameSource {
  /** Decoded source image for this clip at this output frame, or null if not ready. */
  imageFor(clip: Clip, frame: number): FrameImage | null;
}

/** Source project-frame consumed by a clip at output `frame` (trim + speed). Timeline.swift math. */
export function sourceConsumedIndex(clip: Clip, frame: number): number {
  return Math.round((frame - clip.startFrame) * clip.speed);
}
