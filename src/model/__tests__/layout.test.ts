import { describe, it, expect } from "vitest";
import { layoutPlacement, LAYOUTS, LAYOUT_NAMES } from "../layout";

// layoutPlacement is the cover-crop solver behind every split/grid/PiP composition (apply_layout).
// It had ZERO tests — a regression here silently distorts or mis-centers every multi-video layout.

const CANVAS_W = 1920, CANVAS_H = 1080; // 16:9

const cropSum = (c: { left: number; top: number; right: number; bottom: number }) => c;
const nonNeg = (c: { left: number; top: number; right: number; bottom: number }) =>
  c.left >= 0 && c.top >= 0 && c.right >= 0 && c.bottom >= 0;

describe("layoutPlacement (cover-crop solver)", () => {
  const fullSlot = { x: 0, y: 0, w: 1, h: 1 };

  it("fit:'fill' — a matching-aspect source needs no crop and fills the slot exactly", () => {
    const { transform: t, crop } = layoutPlacement(1920, 1080, CANVAS_W, CANVAS_H, fullSlot, "fill");
    expect(crop.left + crop.right + crop.top + crop.bottom).toBeCloseTo(0, 6);
    expect(t.width).toBeCloseTo(1, 6);
    expect(t.height).toBeCloseTo(1, 6);
    expect(t.centerX).toBeCloseTo(0.5, 6);
    expect(t.centerY).toBeCloseTo(0.5, 6);
  });

  it("fit:'fill' — a wide source into a 16:9 full slot crops LEFT/RIGHT, remaining aspect = slot aspect, center stays in frame", () => {
    // 100:1 ultra-wide source: must crop horizontally to reach the 16:9 slot aspect.
    const { transform: t, crop } = layoutPlacement(1000, 10, CANVAS_W, CANVAS_H, fullSlot, "fill");
    expect(nonNeg(crop)).toBe(true);
    expect(crop.top).toBeCloseTo(0, 6);
    expect(crop.bottom).toBeCloseTo(0, 6);
    expect(crop.left + crop.right).toBeLessThan(1);
    // visible aspect after crop == slot pixel aspect (16:9 here)
    const visW = 1000 * (1 - crop.left - crop.right);
    expect(visW / 10 / (1920 / 1080)).toBeCloseTo(1, 2);
    expect(t.centerX).toBeGreaterThanOrEqual(0);
    expect(t.centerX).toBeLessThanOrEqual(1);
    expect(t.width).toBeGreaterThan(0);
    expect(t.height).toBeGreaterThan(0);
  });

  it("fit:'fill' — a tall source crops TOP/BOTTOM and stays centered", () => {
    const { transform: t, crop } = layoutPlacement(1080, 1920, CANVAS_W, CANVAS_H, fullSlot, "fill");
    expect(crop.left).toBeCloseTo(0, 6);
    expect(crop.right).toBeCloseTo(0, 6);
    expect(crop.top).toBeGreaterThan(0);
    expect(t.centerY).toBeCloseTo(0.5, 6);
  });

  it("fit:'fit' — letterboxes with NO crop and never exceeds the slot", () => {
    const slot = { x: 0.25, y: 0, w: 0.5, h: 1 }; // a half-width slot
    const { transform: t, crop } = layoutPlacement(1080, 1920, CANVAS_W, CANVAS_H, slot, "fit");
    expect(crop.left + crop.right + crop.top + crop.bottom).toBeCloseTo(0, 6);
    expect(t.width).toBeLessThanOrEqual(slot.w + 1e-9);
    expect(t.height).toBeLessThanOrEqual(slot.h + 1e-9);
    expect(t.width).toBeGreaterThan(0);
    expect(t.height).toBeGreaterThan(0);
  });

  it("stays finite and positive for degenerate 1x1 and extreme 100:1 aspects", () => {
    for (const [sw, sh] of [[1, 1], [1000, 10], [10, 1000]] as const) {
      for (const fit of ["fill", "fit"] as const) {
        const { transform: t, crop } = layoutPlacement(sw, sh, CANVAS_W, CANVAS_H, fullSlot, fit);
        expect(Number.isFinite(t.width) && Number.isFinite(t.height)).toBe(true);
        expect(t.width).toBeGreaterThan(0);
        expect(t.height).toBeGreaterThan(0);
        expect(nonNeg(crop)).toBe(true);
        expect(crop.left + crop.right).toBeLessThan(1);
        expect(crop.top + crop.bottom).toBeLessThan(1);
      }
    }
  });

  it("produces a sane placement for every slot of every named layout (wide + tall source)", () => {
    for (const name of LAYOUT_NAMES) {
      for (const slot of LAYOUTS[name]) {
        for (const [sw, sh] of [[1920, 1080], [1080, 1920]] as const) {
          const { transform: t, crop } = layoutPlacement(sw, sh, CANVAS_W, CANVAS_H, slot.rect, "fill", 0.5, 0.5);
          expect(t.width).toBeGreaterThan(0);
          expect(t.height).toBeGreaterThan(0);
          expect(nonNeg(cropSum(crop))).toBe(true);
          expect(crop.left + crop.right).toBeLessThan(1);
          expect(crop.top + crop.bottom).toBeLessThan(1);
        }
      }
    }
  });
});
