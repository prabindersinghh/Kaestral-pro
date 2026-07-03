// Absolute-frame clip sampling. Ported from Models/Timeline.swift (Clip extension) +
// Keyframe.swift. Used by the exporters and (Stage D) the compositor. `frame` is an
// absolute timeline frame; tracks are sampled at the clip-relative offset internally.

import type { AnimatableProperty, Interpolation } from "./enums";
import type { AnimPair, Clip, Crop, KeyframeTrack, KeyframeValue, Transform } from "./types";
import { fadeMultiplier, sampleTrack } from "./helpers";

/** VolumeScale.linearFromDb (InspectorView.swift:1076): 10^(dB/20). */
export function linearFromDb(dB: number): number {
  return Math.pow(10, dB / 20);
}
/** Inverse: linear → dB (−96 floor for ≤0). */
export function dbFromLinear(linear: number): number {
  return linear > 0 ? 20 * Math.log10(linear) : -96;
}

function trackFor(c: Clip, property: AnimatableProperty): KeyframeTrack<KeyframeValue> | undefined {
  switch (property) {
    case "opacity": return c.opacityTrack;
    case "position": return c.positionTrack;
    case "scale": return c.scaleTrack;
    case "rotation": return c.rotationTrack;
    case "crop": return c.cropTrack;
    case "volume": return c.volumeTrack;
  }
}

/** Absolute keyframe frames for a property (Keyframe.swift:104 keyframeFrames). */
export function keyframeFrames(c: Clip, property: AnimatableProperty): number[] {
  return (trackFor(c, property)?.keyframes ?? []).map((k) => k.frame + c.startFrame);
}

/** interpolationOut of the keyframe at absolute `frame`, if any (Keyframe.swift:117). */
export function interpolationAt(c: Clip, property: AnimatableProperty, frame: number): Interpolation | undefined {
  const o = frame - c.startFrame;
  return trackFor(c, property)?.keyframes.find((k) => k.frame === o)?.interpolationOut;
}

export function rawOpacityAt(c: Clip, frame: number): number {
  return c.opacityTrack ? sampleTrack(c.opacityTrack, frame - c.startFrame, c.opacity) : c.opacity;
}

/** Effective opacity incl. the fade envelope (audio ignores the opacity fade). Timeline.swift:138. */
export function opacityAt(c: Clip, frame: number): number {
  const base = rawOpacityAt(c, frame);
  if (c.mediaType === "audio" || (c.fadeInFrames <= 0 && c.fadeOutFrames <= 0)) return base;
  return base * fadeMultiplier(c, frame);
}

export function rotationAt(c: Clip, frame: number): number {
  return c.rotationTrack ? sampleTrack(c.rotationTrack, frame - c.startFrame, c.transform.rotation) : c.transform.rotation;
}

export function sizeAt(c: Clip, frame: number): { width: number; height: number } {
  const fallback: AnimPair = { a: c.transform.width, b: c.transform.height };
  const s = c.scaleTrack ? (sampleTrack(c.scaleTrack, frame - c.startFrame, fallback) as AnimPair) : fallback;
  return { width: s.a, height: s.b };
}

export function topLeftAt(c: Clip, frame: number): { x: number; y: number } {
  if (c.positionTrack && c.positionTrack.keyframes.length > 0) {
    const p = sampleTrack(c.positionTrack, frame - c.startFrame, { a: 0, b: 0 }) as AnimPair;
    return { x: p.a, y: p.b };
  }
  const sz = sizeAt(c, frame);
  return { x: c.transform.centerX - sz.width / 2, y: c.transform.centerY - sz.height / 2 };
}

export function transformAt(c: Clip, frame: number): Transform {
  const tl = topLeftAt(c, frame);
  const sz = sizeAt(c, frame);
  return {
    centerX: tl.x + sz.width / 2,
    centerY: tl.y + sz.height / 2,
    width: sz.width,
    height: sz.height,
    rotation: rotationAt(c, frame),
    flipHorizontal: c.transform.flipHorizontal,
    flipVertical: c.transform.flipVertical,
  };
}

export function cropAt(c: Clip, frame: number): Crop {
  return c.cropTrack ? (sampleTrack(c.cropTrack, frame - c.startFrame, c.crop) as Crop) : c.crop;
}

/** Authored linear volume without the fade envelope (Timeline.swift:208 rawVolumeAt). */
export function rawVolumeAt(c: Clip, frame: number): number {
  const kfGain = c.volumeTrack && c.volumeTrack.keyframes.length > 0
    ? linearFromDb(sampleTrack(c.volumeTrack, frame - c.startFrame, 0) as number)
    : 1;
  return c.volume * kfGain;
}
