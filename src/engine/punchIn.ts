// Punch-in (zoom about a point) — the maths for the single most common screen-recording edit, written
// ONCE. Consumed by the punch_in MCP tool; pure and unit-tested against hand-computed cases.
//
// Model facts this must respect (see model/clipSampling.ts):
//   • positionTrack stores the clip box's TOP-LEFT corner, normalised to the canvas (not the centre);
//   • scaleTrack stores the box's width/height as FRACTIONS of the canvas (not zoom multipliers);
//   • keyframe frames are CLIP-RELATIVE (0 = the clip's first frame).
// Crop insets are applied INSIDE the box (draw.ts), so a fraction of the clip's own frame maps
// linearly onto the box: source point f sits at T + f·S on screen regardless of crop.

import type { AnimPair, Keyframe } from "../model/types";

/** A clip box in normalised canvas coordinates: top-left (x,y) + size (w,h). */
export interface NormBox { x: number; y: number; w: number; h: number }

/**
 * Scale `base` by `zoom` so that the point at fraction (fx, fy) of the box stays fixed on screen.
 * Before: P = T + f·S.  After: P = T' + f·(z·S)  ⇒  T' = T − (z−1)·f·S,  S' = z·S.
 */
export function zoomAboutPoint(base: NormBox, zoom: number, fx: number, fy: number): NormBox {
  return {
    x: base.x - (zoom - 1) * fx * base.w,
    y: base.y - (zoom - 1) * fy * base.h,
    w: zoom * base.w,
    h: zoom * base.h,
  };
}

export interface PunchInSpec {
  /** The clip's box at the punch-in start (sampled from its current transform/keyframes). */
  base: NormBox;
  zoom: number;
  focusX: number;
  focusY: number;
  /** Clip-relative frame where the ramp starts (box = base). */
  fromRel: number;
  /** Clip-relative frame where full zoom is reached (must be > fromRel). */
  toRel: number;
  /** Frames to hold at full zoom before returning. Ignored without returnFrames (zoom just stays). */
  holdFrames?: number;
  /** Frames for the ramp back to `base`. Omit/0 = stay zoomed to the end of the clip. */
  returnFrames?: number;
}

export interface PunchInPlan {
  position: Keyframe<AnimPair>[];
  scale: Keyframe<AnimPair>[];
  /** Clip-relative frame of the last keyframe written. */
  endRel: number;
}

/**
 * Keyframe rows for one punch-in: base → (smooth) → zoomed [→ hold → (smooth) → base]. Both tracks
 * are keyed at identical frames with identical interpolation, so at every intermediate frame the
 * focus point stays exactly where it was (T(t) + f·S(t) is constant along a shared ease).
 */
export function planPunchIn(spec: PunchInSpec): PunchInPlan {
  const zoomed = zoomAboutPoint(spec.base, spec.zoom, spec.focusX, spec.focusY);
  const pos = (b: NormBox): AnimPair => ({ a: b.x, b: b.y });
  const size = (b: NormBox): AnimPair => ({ a: b.w, b: b.h });
  const steps: { frame: number; box: NormBox; interp: Keyframe<AnimPair>["interpolationOut"] }[] = [
    { frame: spec.fromRel, box: spec.base, interp: "smooth" },
  ];
  const ret = spec.returnFrames ?? 0;
  if (ret > 0) {
    const hold = spec.holdFrames ?? 0;
    if (hold > 0) {
      steps.push({ frame: spec.toRel, box: zoomed, interp: "hold" });
      steps.push({ frame: spec.toRel + hold, box: zoomed, interp: "smooth" });
      steps.push({ frame: spec.toRel + hold + ret, box: spec.base, interp: "smooth" });
    } else {
      steps.push({ frame: spec.toRel, box: zoomed, interp: "smooth" });
      steps.push({ frame: spec.toRel + ret, box: spec.base, interp: "smooth" });
    }
  } else {
    steps.push({ frame: spec.toRel, box: zoomed, interp: "smooth" });
  }
  return {
    position: steps.map((s) => ({ frame: s.frame, value: pos(s.box), interpolationOut: s.interp })),
    scale: steps.map((s) => ({ frame: s.frame, value: size(s.box), interpolationOut: s.interp })),
    endRel: steps[steps.length - 1].frame,
  };
}
