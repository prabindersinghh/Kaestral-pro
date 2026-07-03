// Pure invariant helpers ported verbatim from Models/Timeline.swift + Keyframe.swift.
// Behavior parity (outputs), not syntax. These are shared by the UI and (Stage C) the
// MCP edit engine — one implementation, two front-ends (brief rule #6).

import type { Interpolation } from "./enums";
import type { AnimPair, Clip, Crop, KeyframeTrack, KeyframeValue } from "./types";

/** Timeline.swift:127 */
export function endFrame(c: Clip): number {
  return c.startFrame + c.durationFrames;
}

/** Timeline.swift:130 — source frames consumed by the visible portion. */
export function sourceFramesConsumed(c: Clip): number {
  return Math.round(c.durationFrames * c.speed);
}

/** Timeline.swift:133 */
export function sourceDurationFrames(c: Clip): number {
  return sourceFramesConsumed(c) + c.trimStartFrame + c.trimEndFrame;
}

/** Timeline.swift:95 (contains(timelineFrame:)) — [startFrame, endFrame). */
export function containsFrame(c: Clip, frame: number): boolean {
  return frame >= c.startFrame && frame < endFrame(c);
}

/** smoothstep — Keyframe.swift:40 */
export function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerpNumber(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function interpolateValue<V extends KeyframeValue>(a: V, b: V, t: number): V {
  if (typeof a === "number" && typeof b === "number") return lerpNumber(a, b, t) as V;
  if ("a" in (a as object)) {
    const pa = a as AnimPair;
    const pb = b as AnimPair;
    return { a: lerpNumber(pa.a, pb.a, t), b: lerpNumber(pa.b, pb.b, t) } as V;
  }
  const ca = a as Crop;
  const cb = b as Crop;
  return {
    left: lerpNumber(ca.left, cb.left, t),
    top: lerpNumber(ca.top, cb.top, t),
    right: lerpNumber(ca.right, cb.right, t),
    bottom: lerpNumber(ca.bottom, cb.bottom, t),
  } as V;
}

/**
 * KeyframeTrack.sample(at:fallback:) — Keyframe.swift:231.
 * `frame` is clip-relative. Flat before first / after last; segment uses the
 * LEFT keyframe's interpolationOut (hold | linear | smooth).
 */
export function sampleTrack<V extends KeyframeValue>(
  track: KeyframeTrack<V>,
  frame: number,
  fallback: V,
): V {
  const ks = track.keyframes;
  if (ks.length === 0) return fallback;
  if (ks.length === 1) return ks[0].value;
  if (frame <= ks[0].frame) return ks[0].value;
  const last = ks[ks.length - 1];
  if (frame >= last.frame) return last.value;

  const bIdx = ks.findIndex((k) => k.frame > frame);
  if (bIdx <= 0) return last.value;
  const a = ks[bIdx - 1];
  const b = ks[bIdx];
  const raw = (frame - a.frame) / (b.frame - a.frame);
  const interp: Interpolation = a.interpolationOut;
  if (interp === "hold") return a.value;
  const t = interp === "smooth" ? smoothstep(raw) : raw;
  return interpolateValue(a.value, b.value, t);
}

/**
 * Clip.fadeMultiplier(at:) — Timeline.swift:219. 0..1 envelope from head/tail ramps.
 * `frame` is an absolute timeline frame.
 */
export function fadeMultiplier(c: Clip, frame: number): number {
  const rel = frame - c.startFrame;
  if (rel < 0 || rel > c.durationFrames) return 0;
  let inMul = 1;
  if (c.fadeInFrames > 0) {
    const t = Math.min(1, rel / c.fadeInFrames);
    inMul = c.fadeInInterpolation === "smooth" ? smoothstep(t) : t;
  }
  let outMul = 1;
  if (c.fadeOutFrames > 0) {
    const outRem = c.durationFrames - rel;
    const t = Math.min(1, outRem / c.fadeOutFrames);
    outMul = c.fadeOutInterpolation === "smooth" ? smoothstep(t) : t;
  }
  return Math.min(inMul, outMul);
}

/**
 * Clip.timelineFrame(sourceSeconds:fps:) — Timeline.swift:237.
 * Returns null outside [startFrame, endFrame).
 */
export function timelineFrameForSourceSeconds(c: Clip, sourceSeconds: number, fps: number): number | null {
  const sourceFrame = sourceSeconds * fps;
  const offsetFromTrim = sourceFrame - c.trimStartFrame;
  if (offsetFromTrim < 0) return null;
  const frame = Math.round(c.startFrame + offsetFromTrim / Math.max(c.speed, 0.0001));
  if (frame < c.startFrame || frame >= endFrame(c)) return null;
  return frame;
}

/** Track end frame — max clip endFrame (Timeline.swift:36). */
export function trackEndFrame(clips: Clip[]): number {
  return clips.reduce((m, c) => Math.max(m, endFrame(c)), 0);
}

/** Timeline.totalFrames — Timeline.swift:16. */
export function totalFrames(tracks: { clips: Clip[] }[]): number {
  return tracks.reduce((m, t) => Math.max(m, trackEndFrame(t.clips)), 0);
}
