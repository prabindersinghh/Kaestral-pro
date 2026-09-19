import { describe, it, expect } from "vitest";
import { zoomAboutPoint, planPunchIn, type NormBox } from "../punchIn";
import { sampleTrack } from "../../model/helpers";
import type { AnimPair, KeyframeTrack } from "../../model/types";

// B2 (field report v1.0.5): the single most common screen-recording edit. The operator hand-derived
// pos = (anchor − (z−1)·target)/W six times across two videos, keeping it consistent with the clip's
// base transform by hand. The maths lives ONCE here. Model facts it must respect:
//   • positionTrack stores the TOP-LEFT corner, normalised to the canvas (not the centre);
//   • scaleTrack stores width/height FRACTIONS of the canvas (not multipliers);
//   • keyframe frames are CLIP-RELATIVE (0 = the clip's first frame).
// Zooming by z about a focus point f (fraction of the clip's own frame) must keep that point fixed
// on screen:  T' = T − (z−1)·f·S,  S' = z·S.

const full: NormBox = { x: 0, y: 0, w: 1, h: 1 };

describe("zoomAboutPoint — hand-computed cases", () => {
  it("full-frame clip, 2× about the centre → top-left (−0.5,−0.5), size 2×2 (centre stays at 0.5)", () => {
    const z = zoomAboutPoint(full, 2, 0.5, 0.5);
    expect(z).toEqual({ x: -0.5, y: -0.5, w: 2, h: 2 });
    expect(z.x + 0.5 * z.w).toBeCloseTo(0.5);
    expect(z.y + 0.5 * z.h).toBeCloseTo(0.5);
  });

  it("full-frame clip, 2× about (0.25, 0.75) → top-left (−0.25, −0.75); the focus point stays put", () => {
    const z = zoomAboutPoint(full, 2, 0.25, 0.75);
    expect(z).toEqual({ x: -0.25, y: -0.75, w: 2, h: 2 });
    expect(z.x + 0.25 * z.w).toBeCloseTo(0.25);
    expect(z.y + 0.75 * z.h).toBeCloseTo(0.75);
  });

  it("a PIP box (0.6,0.6 / 0.3×0.3), 3× about its own top-left corner → corner fixed, size 0.9", () => {
    const pip: NormBox = { x: 0.6, y: 0.6, w: 0.3, h: 0.3 };
    const z = zoomAboutPoint(pip, 3, 0, 0);
    expect(z.x).toBeCloseTo(0.6);
    expect(z.y).toBeCloseTo(0.6);
    expect(z.w).toBeCloseTo(0.9);
    expect(z.h).toBeCloseTo(0.9);
  });

  it("the same PIP, 3× about its bottom-right corner → bottom-right fixed at 0.9", () => {
    const pip: NormBox = { x: 0.6, y: 0.6, w: 0.3, h: 0.3 };
    const z = zoomAboutPoint(pip, 3, 1, 1);
    expect(z.x).toBeCloseTo(0);
    expect(z.y).toBeCloseTo(0);
    expect(z.x + z.w).toBeCloseTo(0.9);
    expect(z.y + z.h).toBeCloseTo(0.9);
  });

  it("zoom 1 is the identity", () => {
    expect(zoomAboutPoint({ x: 0.1, y: 0.2, w: 0.5, h: 0.4 }, 1, 0.3, 0.9)).toEqual({ x: 0.1, y: 0.2, w: 0.5, h: 0.4 });
  });
});

describe("planPunchIn — clip-relative keyframes for position + scale", () => {
  it("ramp → hold → return: 4 keyframes on each track, hold uses 'hold' interpolation", () => {
    const plan = planPunchIn({ base: full, zoom: 2, focusX: 0.5, focusY: 0.5, fromRel: 10, toRel: 25, holdFrames: 30, returnFrames: 15 });
    expect(plan.position.map((k) => k.frame)).toEqual([10, 25, 55, 70]);
    expect(plan.scale.map((k) => k.frame)).toEqual([10, 25, 55, 70]);
    expect(plan.position.map((k) => k.interpolationOut)).toEqual(["smooth", "hold", "smooth", "smooth"]);
    expect(plan.position[0].value).toEqual({ a: 0, b: 0 });
    expect(plan.position[1].value).toEqual({ a: -0.5, b: -0.5 });
    expect(plan.position[2].value).toEqual({ a: -0.5, b: -0.5 });
    expect(plan.position[3].value).toEqual({ a: 0, b: 0 });
    expect(plan.scale.map((k) => k.value)).toEqual([{ a: 1, b: 1 }, { a: 2, b: 2 }, { a: 2, b: 2 }, { a: 1, b: 1 }]);
    expect(plan.endRel).toBe(70);
  });

  it("no returnFrames → ramp then stay zoomed (2 keyframes); no holdFrames but returnFrames → ramp then return", () => {
    const stay = planPunchIn({ base: full, zoom: 1.5, focusX: 0.2, focusY: 0.2, fromRel: 0, toRel: 12 });
    expect(stay.position.map((k) => k.frame)).toEqual([0, 12]);
    expect(stay.endRel).toBe(12);
    const bounce = planPunchIn({ base: full, zoom: 1.5, focusX: 0.2, focusY: 0.2, fromRel: 0, toRel: 12, returnFrames: 12 });
    expect(bounce.position.map((k) => k.frame)).toEqual([0, 12, 24]);
    expect(bounce.position[2].value).toEqual({ a: 0, b: 0 });
  });

  it("INVARIANT: the focus point never moves on screen at any frame of the ramp or the return", () => {
    const focusX = 0.3, focusY = 0.65;
    const base: NormBox = { x: 0.05, y: 0.1, w: 0.9, h: 0.8 };
    const plan = planPunchIn({ base, zoom: 2.5, focusX, focusY, fromRel: 0, toRel: 20, holdFrames: 10, returnFrames: 20 });
    const pos: KeyframeTrack<AnimPair> = { keyframes: plan.position };
    const scl: KeyframeTrack<AnimPair> = { keyframes: plan.scale };
    const px0 = base.x + focusX * base.w, py0 = base.y + focusY * base.h;
    for (let f = 0; f <= 50; f++) {
      const p = sampleTrack(pos, f, { a: 0, b: 0 });
      const s = sampleTrack(scl, f, { a: 1, b: 1 });
      expect(p.a + focusX * s.a, `frame ${f} x`).toBeCloseTo(px0, 9);
      expect(p.b + focusY * s.b, `frame ${f} y`).toBeCloseTo(py0, 9);
    }
  });
});
