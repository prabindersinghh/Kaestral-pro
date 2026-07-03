// Pure per-frame compositor state. Ports FrameRenderer's stacking + CompositionBuilder.affineTransform:
// visual tracks stack bottom→top (model stores tracks top→bottom, so iterate in reverse), each clip
// resolved to a normalized canvas box + rotation/flip/opacity(incl. fade)/crop/blend at `frame`.

import type { BlendMode, ClipType } from "./../model/enums";
import { isVisual } from "./../model/enums";
import type { Clip, Crop, Timeline } from "./../model/types";
import { endFrame } from "./../model/helpers";
import { cropAt, opacityAt, rotationAt, sizeAt, topLeftAt } from "./../model/clipSampling";

export interface CompositedLayer {
  clip: Clip;
  mediaType: ClipType;
  /** Normalized (0–1 of canvas), top-left origin. */
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number; // degrees, +clockwise
  flipH: boolean;
  flipV: boolean;
  opacity: number; // 0–1, includes fade envelope
  blendMode: BlendMode;
  crop: Crop;
}

/** Layers to draw at `frame`, ordered bottom→top (draw in array order). */
export function composeFrame(timeline: Timeline, frame: number): CompositedLayer[] {
  const layers: CompositedLayer[] = [];
  // Model stores tracks top→bottom; the topmost track is the topmost layer. Draw bottom→top.
  for (let ti = timeline.tracks.length - 1; ti >= 0; ti--) {
    const track = timeline.tracks[ti];
    if (!isVisual(track.type) || track.hidden) continue;
    for (const clip of track.clips) {
      if (!(frame >= clip.startFrame && frame < endFrame(clip))) continue;
      const opacity = opacityAt(clip, frame);
      if (opacity <= 0) continue;
      const tl = topLeftAt(clip, frame);
      const sz = sizeAt(clip, frame);
      layers.push({
        clip,
        mediaType: clip.mediaType,
        x: tl.x,
        y: tl.y,
        w: sz.width,
        h: sz.height,
        rotation: rotationAt(clip, frame),
        flipH: clip.transform.flipHorizontal,
        flipV: clip.transform.flipVertical,
        opacity: Math.min(1, Math.max(0, opacity)),
        blendMode: clip.blendMode ?? "normal",
        crop: cropAt(clip, frame),
      });
    }
  }
  return layers;
}

/** BlendMode → canvas globalCompositeOperation (BlendMode.swift ciFilterName equivalents). */
export function blendToCanvas(mode: BlendMode): GlobalCompositeOperation {
  const map: Record<BlendMode, GlobalCompositeOperation> = {
    normal: "source-over",
    darken: "darken",
    multiply: "multiply",
    colorBurn: "color-burn",
    lighten: "lighten",
    screen: "screen",
    colorDodge: "color-dodge",
    overlay: "overlay",
    softLight: "soft-light",
    hardLight: "hard-light",
    difference: "difference",
    exclusion: "exclusion",
    hue: "hue",
    saturation: "saturation",
    color: "color",
    luminosity: "luminosity",
  };
  return map[mode];
}
