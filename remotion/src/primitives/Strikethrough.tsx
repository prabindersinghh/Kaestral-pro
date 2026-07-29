import { interpolate, Easing } from "remotion";
import type { PrimitiveProps } from "./types";
import { tokenColor, paletteColor } from "./tokens";
import { bezierFromSpec } from "./easing";

// Strikethrough (Cinematic Reel pack effect #6, ELEMENT "strikethrough") — a thin, angled, glowing
// line drawn THROUGH a piece of text/content for emphasis. Modeled closely on Hairline.tsx's
// draw-in mechanics (same `enter.easing`/`enter.durationFrames` override convention), but:
//   - a FIXED rotate(-4deg) — a strikethrough always cuts the same deliberate diagonal, never an
//     orientation/anchor choice like Hairline's horizontal/vertical + start/center/end variants.
//   - grows via `scaleX` (transform-origin "left"), not a resized width — reads as the line
//     striking rightward FROM its anchor point, over ~700ms by default.
//   - its glow is tinted from the scene's user palette (`meta.palette`, threaded down as
//     `PrimitiveProps.palette`) via `paletteColor`, never a hardcoded hex — falls back to the
//     brand accent tokens when no palette is authored (same convention as every other Cinematic
//     Reel palette-driven effect).

const STRIKETHROUGH_DEFAULT_MS = 700;
const HOUSE_EASE = Easing.bezier(0.22, 0.61, 0.16, 1);

export const Strikethrough: React.FC<PrimitiveProps> = ({ props, frame, fps, width, opacity, position, enter, palette }) => {
  const color = props.color ? tokenColor(String(props.color)) : paletteColor(palette, 0);
  const lengthFrac = typeof props.length === "number" ? props.length : 0.3;
  const thickness = typeof props.thickness === "number" ? props.thickness : 3;

  const delay = enter?.delay ?? 0;
  const local = frame - delay;

  // Same "explicitly authored easing/duration overrides the default" convention as Hairline.tsx —
  // `resolveEnter` (Generative.tsx) fills a sentinel `easing:"spring"` default when none was
  // authored, so "explicitly authored" means "present and not that literal sentinel".
  const hasExplicitEasing = enter?.easing !== undefined && enter.easing !== "spring";
  const durationFrames = enter?.durationFrames ?? Math.round(fps * (STRIKETHROUGH_DEFAULT_MS / 1000));
  const easingFn = hasExplicitEasing ? Easing.bezier(...bezierFromSpec(enter?.easing)) : HOUSE_EASE;
  const draw = interpolate(local, [0, Math.max(1, durationFrames)], [0, 1], {
    easing: easingFn,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // TASK 5 FIX-convention (per-property `animate` "sole driver" contract) — pin opacity to fully
  // drawn when `animate.opacity` owns this layer's opacity instead (see Text.tsx's fuller comment).
  const drawOpacity = enter?.neutralizeOpacity ? 1 : draw;

  const fullLen = width * lengthFrac;

  return (
    <div
      style={{
        position: "absolute",
        left: `${position.x * 100}%`,
        top: `${position.y * 100}%`,
        width: fullLen,
        height: thickness,
        background: color,
        boxShadow: `0 0 18px ${color}, 0 0 5px ${color}`,
        opacity: opacity * drawOpacity,
        transform: `translateY(-50%) rotate(-4deg) scaleX(${draw})`,
        transformOrigin: "left center",
        borderRadius: thickness,
      }}
    />
  );
};
