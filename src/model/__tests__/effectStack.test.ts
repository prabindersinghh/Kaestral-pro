import { describe, it, expect } from "vitest";
import { applyColorGrade, applyEffectStack, CANONICAL_ORDER } from "../effectStack";
import { defaultClip } from "../defaults";

const clip = () => defaultClip({ mediaRef: "m", startFrame: 0, durationFrames: 30 });

describe("apply_color effect stack (ToolExecutor+Color.swift)", () => {
  it("builds color.exposure from the ev knob", () => {
    const c = clip();
    applyColorGrade(c, { exposure: 0.5 });
    const e = c.effects!.find((x) => x.type === "color.exposure")!;
    expect(e.params.ev.value).toBe(0.5);
    expect(e.enabled).toBe(true);
  });

  it("merges knobs and keeps the canonical render order", () => {
    const c = clip();
    applyColorGrade(c, { saturation: 1.3 });
    applyColorGrade(c, { exposure: 1 }); // added later but ranks first
    const types = c.effects!.map((e) => e.type);
    expect(types).toEqual(["color.exposure", "color.saturation"]);
    expect(CANONICAL_ORDER.indexOf("color.exposure")).toBeLessThan(CANONICAL_ORDER.indexOf("color.saturation"));
  });

  it("merges params of the same effect without clobbering the untouched one", () => {
    const c = clip();
    applyColorGrade(c, { temperature: 5000 });
    applyColorGrade(c, { tint: 20 });
    const e = c.effects!.find((x) => x.type === "color.temperature")!;
    expect(e.params.temperature.value).toBe(5000);
    expect(e.params.tint.value).toBe(20);
  });

  it("reset strips the prior color.* grade", () => {
    const c = clip();
    applyColorGrade(c, { exposure: 1, contrast: 1.2 });
    applyColorGrade(c, { saturation: 1.5 }, true);
    expect(c.effects!.map((e) => e.type)).toEqual(["color.saturation"]);
  });

  it("wheels: shadowsHue+amount → color.wheels lift vector", () => {
    const c = clip();
    applyColorGrade(c, { shadowsHue: 180, shadowsAmount: 0.2 });
    const e = c.effects!.find((x) => x.type === "color.wheels")!;
    expect(e.params.lift_x.value).toBeCloseTo(-0.2); // cos(180°)*0.2
    expect(e.params.lift_y.value).toBeCloseTo(0, 5); // sin(180°)*0.2 ≈ 0
  });

  it("curves + lut are stored as string params", () => {
    const c = clip();
    applyColorGrade(c, { masterCurve: [[0, 0.06], [1, 0.95]], lut: { path: "/luts/film.cube", strength: 0.8 } });
    const curves = c.effects!.find((x) => x.type === "color.curves")!;
    expect(curves.params.curve.string).toContain("0.06");
    const lut = c.effects!.find((x) => x.type === "color.lut")!;
    expect(lut.params.path.string).toBe("/luts/film.cube");
    expect(lut.params.intensity.value).toBe(0.8);
  });
});

describe("apply_effect stack (ToolExecutor+Effect.swift)", () => {
  it("merges an effect by type and can bypass or remove it", () => {
    const c = clip();
    applyEffectStack(c, [{ type: "blur.gaussian", params: { radius: 8 } }]);
    expect(c.effects!.find((e) => e.type === "blur.gaussian")!.params.radius.value).toBe(8);
    applyEffectStack(c, [{ type: "blur.gaussian", params: { radius: 12 }, enabled: false }]);
    const e = c.effects!.find((x) => x.type === "blur.gaussian")!;
    expect(e.params.radius.value).toBe(12);
    expect(e.enabled).toBe(false);
    applyEffectStack(c, [], ["blur.gaussian"]);
    expect(c.effects).toBeUndefined();
  });

  it("orders mixed effects canonically", () => {
    const c = clip();
    applyEffectStack(c, [{ type: "stylize.vignette", params: { amount: 0.5 } }, { type: "blur.gaussian", params: { radius: 4 } }]);
    expect(c.effects!.map((e) => e.type)).toEqual(["blur.gaussian", "stylize.vignette"]);
  });
});
