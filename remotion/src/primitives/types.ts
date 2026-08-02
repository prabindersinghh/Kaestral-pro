// Shared types for the primitive layer. Every primitive is a `React.FC<PrimitiveProps>` driven
// entirely by plain data (frame/fps/dimensions + a validated SceneSpec layer's fields) — no
// free-form code or CSS ever reaches a primitive, per the Global Constraints' "no agent-authored
// executable code is ever rendered" rule. `props` is the layer's per-element data bag
// (`Layer.props` in `src/gen/sceneSpec.ts`), typed loosely here since each primitive interprets
// its own subset.

import type { EasingSpec } from "./easing";

export interface SpringConfig {
  damping: number;
  mass: number;
  stiffness: number;
}

export interface EnterSpec {
  anim: "spring" | "typewriter" | "wordReveal" | "wordStagger" | "kinetic" | "draw" | "fade" | "collapse" | "maskReveal" | "edgeFlip" | "blurPushUp";
  easing?: EasingSpec;
  delay?: number;
  from?: "below" | "left" | "scale";
  snapToBeat?: boolean;
  /** TASK 6 — explicit opt-out of the beat-relative anti-smear auto-clamp (`resolveEntranceTiming`
   * in Generative.tsx's `resolveEnter`). Default (absent or `"auto"`) keeps the guardrail: every
   * authored `delay` is pulled back so the entrance still settles within the first ~half of the
   * beat. `"manual"` honors the authored `delay` verbatim — the escape hatch for a deliberately
   * staggered spec whose entrances already settle within the beat on their own. */
  pacing?: "auto" | "manual";
  durationFrames?: number;
  spring?: SpringConfig;
  /**
   * TASK 5 FIX — per-property `animate` "sole driver" contract (see `Generative.tsx`'s
   * `BeatLayer`): when `layer.animate.opacity`/`layer.animate.position` is present, that property
   * must be driven SOLELY by the tween, and the entrance must not ALSO drive it internally (every
   * primitive bakes its own entrance-driven opacity multiplier and/or translate/scale offset from
   * one shared spring/interpolate curve). These two flags are independent — one may be true while
   * the other is false/undefined — so a layer authoring `animate.position` ALONE continues to get
   * its normal entrance-driven opacity fade-in, and vice versa. A primitive that reads these should
   * pin its OWN internal opacity multiplier to 1 (when `neutralizeOpacity`) and/or its own internal
   * translate/scale offset to its settled value — 0 offset / scale 1 (when `neutralizePosition`) —
   * as a final step, without altering which `anim` branch it takes or how that branch computes its
   * *other* (non-neutralized) property.
   */
  neutralizeOpacity?: boolean;
  neutralizePosition?: boolean;
  /**
   * Companion to the two above, for SCALE. When `layer.animate.scale` (an outer CSS scale wrapper in
   * the interpreter) is authored, a primitive that drives an internal entrance spring scale must pin
   * that scale to 1 so the two don't multiply into a compounding double-pop. Kept SEPARATE from
   * `neutralizePosition` so a scale-animated layer keeps its legitimate entrance translate/slide-in.
   */
  neutralizeScale?: boolean;
}

export interface StyleSpec {
  role?: "display" | "accent" | "muted";
  size?: number;
  anchor?: "left" | "center" | "right";
  font?: "sans" | "mono";
}

export interface PrimitiveProps {
  props: Record<string, unknown>;
  frame: number;
  fps: number;
  width: number;
  height: number;
  opacity: number;
  blur: number;
  position: { x: number; y: number };
  enter?: EnterSpec;
  style?: StyleSpec;
  /** User-supplied brand palette (`meta.palette`), threaded down from the interpreter so any
   * primitive can tint itself from the SAME user colors instead of a hardcoded hex — see
   * `tokens.ts`'s `paletteColor` for the resolve-with-fallback helper every Cinematic Reel
   * palette-driven primitive (Strikethrough, Orbs, shineSweep) uses. */
  palette?: string[];
}
