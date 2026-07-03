// Maps a clip's effect stack to a canvas 2D `filter` string for the preview/render. Covers the
// effects that have a direct canvas-filter analogue (exposure/contrast/saturation/vibrance/
// temperature/blur). Full Core-Image parity (LUT, curves, wheels, hue curves) is an UPGRADES item —
// those still persist in the model and export via FCPXML; they just aren't previewed pixel-exact.

import type { Effect } from "../model/types";

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function canvasFilter(effects: Effect[] | undefined): string {
  if (!effects || effects.length === 0) return "none";
  const parts: string[] = [];
  for (const e of effects) {
    if (!e.enabled) continue;
    const v = (k: string, d = 0) => e.params[k]?.value ?? d;
    switch (e.type) {
      case "color.exposure": {
        const ev = v("ev");
        if (ev !== 0) parts.push(`brightness(${Math.pow(2, ev).toFixed(4)})`);
        break;
      }
      case "color.contrast": {
        const a = v("amount", 1);
        if (a !== 1) parts.push(`contrast(${a})`);
        break;
      }
      case "color.saturation": {
        const a = v("amount", 1);
        if (a !== 1) parts.push(`saturate(${a})`);
        break;
      }
      case "color.vibrance": {
        const a = v("amount");
        if (a !== 0) parts.push(`saturate(${(1 + a * 0.5).toFixed(4)})`);
        break;
      }
      case "color.blacksWhites": {
        // Whites lift → brightness nudge (coarse preview).
        const w = v("whites");
        if (w !== 0) parts.push(`brightness(${(1 + w * 0.3).toFixed(4)})`);
        break;
      }
      case "color.temperature": {
        const t = v("temperature", 6500);
        if (t !== 6500) parts.push(`sepia(${clamp01((Math.abs(t - 6500) / 4500) * 0.5).toFixed(4)})`);
        break;
      }
      case "blur.gaussian": {
        const r = v("radius");
        if (r > 0) parts.push(`blur(${r}px)`);
        break;
      }
    }
  }
  return parts.length ? parts.join(" ") : "none";
}
