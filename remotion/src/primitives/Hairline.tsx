import { interpolate, spring, Easing } from "remotion";
import type { PrimitiveProps } from "./types";
import { tokenColor, TOKENS } from "./tokens";
import { bezierFromSpec } from "./easing";

// Gold/white hairline rules that DRAW IN (grow from 0 -> full width/height) rather than appear
// instantly — small detail that reinforces "physics on entrances" (critique #5) and gives beats a
// designed frame instead of a floating text block. `props.orientation` picks horizontal/vertical,
// `props.length` (0..1, fraction of width/height) sets the drawn length, `props.color` a brand
// token or hex (defaults to the brand gold hairline).
//
// TASK 6b2 UPGRADE — `props.anchor` ("start"|"center"|"end", default "center") pins which edge of
// the rule stays fixed at `position` while it grows: hand-authored films pin a rule to the LEFT
// edge and grow it rightward rather than centering symmetrically. Also: when the layer authors
// `enter.easing`/`enter.durationFrames`, the draw progress is shaped by THAT bezier over that
// exact frame window (via the shared `bezierFromSpec` path, same convention as Text.tsx's
// non-spring escape hatch) instead of always using the hardcoded spring — `resolveEnter` in
// Generative.tsx fills a sentinel `easing:"spring"` default when none was authored, so "explicitly
// authored" here means "present and not that literal 'spring' sentinel", exactly like Text.tsx's
// `enter?.easing !== undefined && enter.easing !== "spring"` check. `durationFrames` is never
// sentinel-filled by `resolveEnter` (it stays `undefined` unless authored), so its mere presence is
// a reliable signal on its own. Absent both, the hairline draws EXACTLY as before (regression-safe).

export const Hairline: React.FC<PrimitiveProps> = ({ props, frame, fps, width, height, opacity, position, enter }) => {
  const orientation = props.orientation === "vertical" ? "vertical" : "horizontal";
  const color = props.color ? tokenColor(String(props.color)) : TOKENS.gold;
  const lengthFrac = typeof props.length === "number" ? props.length : 0.16;
  const thickness = typeof props.thickness === "number" ? props.thickness : 2;
  const anchor = props.anchor === "start" ? "start" : props.anchor === "end" ? "end" : "center";

  const delay = enter?.delay ?? 0;
  const local = frame - delay;

  const hasExplicitEasing = enter?.easing !== undefined && enter.easing !== "spring";
  const hasExplicitDuration = enter?.durationFrames !== undefined;
  let draw: number;
  if (hasExplicitEasing || hasExplicitDuration) {
    draw = interpolate(local, [0, enter?.durationFrames ?? 22], [0, 1], {
      easing: Easing.bezier(...bezierFromSpec(enter?.easing)),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  } else {
    const p = spring({ frame: local, fps, config: { damping: 18, mass: 0.6 } });
    draw = interpolate(p, [0, 1], [0, 1]);
  }
  // TASK 5 FIX (per-property `animate` "sole driver" contract, see Generative.tsx's `BeatLayer`) —
  // `animate.position` alone must not also kill this primitive's own opacity fade-in.
  const drawOpacity = enter?.neutralizeOpacity ? 1 : draw;

  const fullLen = orientation === "horizontal" ? width * lengthFrac : height * lengthFrac;
  const drawnLen = fullLen * draw;

  const boxW = orientation === "horizontal" ? drawnLen : thickness;
  const boxH = orientation === "horizontal" ? thickness : drawnLen;

  // Anchored draw direction: "start" pins the near edge (left for horizontal, top for vertical) at
  // `position` and grows toward the far edge; "end" pins the far edge (right/bottom); "center"
  // (default) keeps the original symmetric-outward-growth centering.
  let transform: string;
  if (orientation === "horizontal") {
    transform = anchor === "start" ? "translateY(-50%)" : anchor === "end" ? "translate(-100%, -50%)" : "translate(-50%, -50%)";
  } else {
    transform = anchor === "start" ? "translateX(-50%)" : anchor === "end" ? "translate(-50%, -100%)" : "translate(-50%, -50%)";
  }

  return (
    <div
      style={{
        position: "absolute",
        left: `${position.x * 100}%`,
        top: `${position.y * 100}%`,
        width: boxW,
        height: boxH,
        background: color,
        boxShadow: `0 0 12px ${color}`,
        opacity: opacity * drawOpacity,
        transform,
        borderRadius: thickness,
      }}
    />
  );
};
