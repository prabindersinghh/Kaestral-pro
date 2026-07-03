// Pure effect-stack edits mirroring apply_color / apply_effect (ToolExecutor+Color/Effect.swift).
// Effects render in a fixed canonical order (EffectRegistry.canonicalOrder); apply_color builds
// color.* entries from named knobs; apply_effect merges non-color effects by type.

import type { Clip, Effect, EffectParam } from "./types";
import { newId } from "./defaults";

// EffectRegistry.canonicalOrder (EffectRegistry.swift:350).
export const CANONICAL_ORDER: string[] = [
  "color.exposure", "color.contrast", "color.highlightsShadows", "color.blacksWhites",
  "color.temperature", "color.vibrance", "color.saturation", "color.wheels", "color.curves",
  "color.hueCurves", "color.lut", "detail.clarity", "key.chroma", "blur.gaussian", "blur.sharpen",
  "blur.noiseReduction", "blur.motion", "stylize.grain", "stylize.vignette", "stylize.glow",
];

function insertIndex(effects: Effect[], type: string): number {
  const rank = CANONICAL_ORDER.indexOf(type);
  const r = rank < 0 ? Number.MAX_SAFE_INTEGER : rank;
  const at = effects.findIndex((e) => {
    const er = CANONICAL_ORDER.indexOf(e.type);
    return (er < 0 ? Number.MAX_SAFE_INTEGER : er) > r;
  });
  return at < 0 ? effects.length : at;
}

const pv = (value: number): EffectParam => ({ value });
const ps = (string: string): EffectParam => ({ string });

/** Insert-or-merge an effect by type, merging its params. */
export function upsertEffect(effects: Effect[], type: string, paramPatch: Record<string, EffectParam>, enabled = true): void {
  let e = effects.find((x) => x.type === type);
  if (!e) {
    e = { id: newId(), type, enabled, params: {} };
    effects.splice(insertIndex(effects, type), 0, e);
  } else {
    e.enabled = enabled;
  }
  for (const [k, v] of Object.entries(paramPatch)) e.params[k] = v;
}

export function removeEffect(effects: Effect[], type: string): void {
  const i = effects.findIndex((e) => e.type === type);
  if (i >= 0) effects.splice(i, 1);
}

// hue(0–360)+amount → color-vector (x,y) for the wheels.
function hueVec(hue: number, amount: number): [number, number] {
  const rad = (hue * Math.PI) / 180;
  return [Math.cos(rad) * amount, Math.sin(rad) * amount];
}
function points(arr: number[][] | undefined): { x: number; y: number }[] {
  return (arr ?? []).map(([x, y]) => ({ x, y }));
}

export interface ColorArgs {
  exposure?: number; contrast?: number; saturation?: number; vibrance?: number;
  temperature?: number; tint?: number; highlights?: number; shadows?: number; blacks?: number; whites?: number;
  shadowsHue?: number; shadowsAmount?: number; shadowsLum?: number;
  midsHue?: number; midsAmount?: number; midsGamma?: number;
  highsHue?: number; highsAmount?: number; highsGain?: number;
  masterCurve?: number[][]; redCurve?: number[][]; greenCurve?: number[][]; blueCurve?: number[][];
  lut?: { path?: string; strength?: number };
}

/** apply_color: build/merge color.* effects onto the clip (reset strips the current color.* grade). */
export function applyColorGrade(clip: Clip, a: ColorArgs, reset = false): void {
  let effects = clip.effects ?? [];
  if (reset) effects = effects.filter((e) => !e.type.startsWith("color."));

  if (a.exposure !== undefined) upsertEffect(effects, "color.exposure", { ev: pv(a.exposure) });
  if (a.contrast !== undefined) upsertEffect(effects, "color.contrast", { amount: pv(a.contrast) });
  if (a.saturation !== undefined) upsertEffect(effects, "color.saturation", { amount: pv(a.saturation) });
  if (a.vibrance !== undefined) upsertEffect(effects, "color.vibrance", { amount: pv(a.vibrance) });
  if (a.temperature !== undefined || a.tint !== undefined) {
    const patch: Record<string, EffectParam> = {};
    if (a.temperature !== undefined) patch.temperature = pv(a.temperature);
    if (a.tint !== undefined) patch.tint = pv(a.tint);
    upsertEffect(effects, "color.temperature", patch);
  }
  if (a.highlights !== undefined || a.shadows !== undefined) {
    const patch: Record<string, EffectParam> = {};
    if (a.highlights !== undefined) patch.highlights = pv(a.highlights);
    if (a.shadows !== undefined) patch.shadows = pv(a.shadows);
    upsertEffect(effects, "color.highlightsShadows", patch);
  }
  if (a.blacks !== undefined || a.whites !== undefined) {
    const patch: Record<string, EffectParam> = {};
    if (a.blacks !== undefined) patch.blacks = pv(a.blacks);
    if (a.whites !== undefined) patch.whites = pv(a.whites);
    upsertEffect(effects, "color.blacksWhites", patch);
  }

  const wheel: Record<string, EffectParam> = {};
  if (a.shadowsHue !== undefined || a.shadowsAmount !== undefined) {
    const [x, y] = hueVec(a.shadowsHue ?? 0, a.shadowsAmount ?? 0);
    wheel.lift_x = pv(x); wheel.lift_y = pv(y);
  }
  if (a.shadowsLum !== undefined) wheel.lift_m = pv(a.shadowsLum);
  if (a.midsHue !== undefined || a.midsAmount !== undefined) {
    const [x, y] = hueVec(a.midsHue ?? 0, a.midsAmount ?? 0);
    wheel.gamma_x = pv(x); wheel.gamma_y = pv(y);
  }
  if (a.midsGamma !== undefined) wheel.gamma_m = pv(a.midsGamma);
  if (a.highsHue !== undefined || a.highsAmount !== undefined) {
    const [x, y] = hueVec(a.highsHue ?? 0, a.highsAmount ?? 0);
    wheel.gain_x = pv(x); wheel.gain_y = pv(y);
  }
  if (a.highsGain !== undefined) wheel.gain_m = pv(a.highsGain);
  if (Object.keys(wheel).length) upsertEffect(effects, "color.wheels", wheel);

  if (a.masterCurve || a.redCurve || a.greenCurve || a.blueCurve) {
    const gc = {
      master: points(a.masterCurve), red: points(a.redCurve),
      green: points(a.greenCurve), blue: points(a.blueCurve),
    };
    upsertEffect(effects, "color.curves", { curve: ps(JSON.stringify(gc)) });
  }
  if (a.lut) {
    const patch: Record<string, EffectParam> = { intensity: pv(a.lut.strength ?? 1) };
    if (a.lut.path) patch.path = ps(a.lut.path);
    upsertEffect(effects, "color.lut", patch);
  }

  clip.effects = effects.length ? effects : undefined;
}

export interface EffectSpec {
  type: string;
  params?: Record<string, number>;
  enabled?: boolean;
}

/** apply_effect: merge non-color effects by type; `remove` deletes by type. */
export function applyEffectStack(clip: Clip, specs: EffectSpec[], remove: string[] = []): void {
  const effects = clip.effects ?? [];
  for (const t of remove) removeEffect(effects, t);
  for (const spec of specs) {
    const patch: Record<string, EffectParam> = {};
    for (const [k, v] of Object.entries(spec.params ?? {})) patch[k] = pv(v);
    upsertEffect(effects, spec.type, patch, spec.enabled ?? true);
  }
  clip.effects = effects.length ? effects : undefined;
}
