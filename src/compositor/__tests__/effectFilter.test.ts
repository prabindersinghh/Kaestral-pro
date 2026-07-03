import { describe, it, expect } from "vitest";
import { canvasFilter } from "../effectFilter";
import type { Effect } from "../../model/types";

const eff = (type: string, params: Record<string, number>, enabled = true): Effect => ({
  id: type, type, enabled, params: Object.fromEntries(Object.entries(params).map(([k, v]) => [k, { value: v }])),
});

describe("effect → canvas filter mapping", () => {
  it("no effects → none", () => {
    expect(canvasFilter(undefined)).toBe("none");
    expect(canvasFilter([])).toBe("none");
  });
  it("exposure ev → brightness(2^ev)", () => {
    expect(canvasFilter([eff("color.exposure", { ev: 1 })])).toBe("brightness(2.0000)");
  });
  it("contrast / saturation map directly", () => {
    expect(canvasFilter([eff("color.contrast", { amount: 1.2 })])).toBe("contrast(1.2)");
    expect(canvasFilter([eff("color.saturation", { amount: 0.5 })])).toBe("saturate(0.5)");
  });
  it("blur radius → blur(px)", () => {
    expect(canvasFilter([eff("blur.gaussian", { radius: 6 })])).toBe("blur(6px)");
  });
  it("disabled effects are skipped", () => {
    expect(canvasFilter([eff("color.contrast", { amount: 1.4 }, false)])).toBe("none");
  });
  it("combines multiple mapped effects", () => {
    const f = canvasFilter([eff("color.exposure", { ev: 0 }), eff("color.contrast", { amount: 1.1 }), eff("color.saturation", { amount: 1.3 })]);
    expect(f).toBe("contrast(1.1) saturate(1.3)"); // ev 0 emits nothing
  });
});
