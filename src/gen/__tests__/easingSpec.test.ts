// src/gen/__tests__/easingSpec.test.ts
import { describe, it, expect } from "vitest";
import { validateEasing, resolveEasingToBezier } from "../sceneSpec";

describe("validateEasing", () => {
  it("accepts a preset string", () => {
    expect(validateEasing("ease-out", "p")).toBe("ease-out");
    expect(validateEasing("spring", "p")).toBe("spring");
  });
  it("accepts a 4-number bezier curve and clamps ranges", () => {
    const e = validateEasing({ curve: [0.2, 1.6, 0.3, 1] }, "p");
    expect(e).toEqual({ curve: [0.2, 1.6, 0.3, 1] });
    // x clamped to [0,1], y clamped to [-2,3]
    const c = validateEasing({ curve: [-5, 9, 2, -9] }, "p") as { curve: number[] };
    expect(c.curve).toEqual([0, 3, 1, -2]);
  });
  it("rejects a non-preset string with the path", () => {
    expect(() => validateEasing("boing", "beats[0]")).toThrow(/beats\[0\]/);
  });
  it("rejects a curve that is not exactly 4 finite numbers", () => {
    expect(() => validateEasing({ curve: [0.1, 0.2, 0.3] }, "p")).toThrow(/curve/);
    expect(() => validateEasing({ curve: [0.1, 0.2, 0.3, NaN] }, "p")).toThrow(/curve/);
  });
});

describe("resolveEasingToBezier", () => {
  it("maps presets and passes through custom curves", () => {
    expect(resolveEasingToBezier("linear")).toEqual([0, 0, 1, 1]);
    expect(resolveEasingToBezier(undefined)).toEqual([0.22, 0.61, 0.16, 1]);
    expect(resolveEasingToBezier({ curve: [0.1, 0.2, 0.3, 0.4] })).toEqual([0.1, 0.2, 0.3, 0.4]);
  });
});
