import { interpolate, spring } from "remotion";
import type { PrimitiveProps } from "./types";
import { TOKENS, tokenColor } from "./tokens";

// Simple geometric primitive (rect/pill/circle/line) using the same glow treatment as the
// LogoMark bars and timeline clips in HeroDemo.tsx — a subtle boxShadow bloom in the fill color.

export const Shape: React.FC<PrimitiveProps> = ({ props, frame, fps, width, height, opacity, blur, position, enter }) => {
  const shape = typeof props.shape === "string" ? props.shape : "rect";
  const fill = props.color ? tokenColor(String(props.color)) : TOKENS.green;
  const w = typeof props.width === "number" ? props.width * width : width * 0.2;
  const h = typeof props.height === "number" ? props.height * height : height * 0.06;

  const delay = enter?.delay ?? 0;
  const local = frame - delay;
  const anim = enter?.anim ?? "fade";

  let animOpacity = 1;
  let scaleX = 1;
  let scaleY = 1;
  let translateY = 0;

  if (anim === "draw") {
    scaleX = interpolate(local, [0, 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    animOpacity = interpolate(local, [0, 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  } else if (anim === "spring") {
    const p = spring({ frame: local, fps, config: { damping: 15, mass: 0.7 } });
    animOpacity = p;
    scaleX = interpolate(p, [0, 1], [0.6, 1]);
    scaleY = interpolate(p, [0, 1], [0.6, 1]);
    translateY = interpolate(p, [0, 1], [16, 0]);
  } else {
    animOpacity = interpolate(local, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  }

  const radius = shape === "circle" ? "50%" : shape === "pill" ? h : shape === "line" ? h / 2 : 8;
  const boxW = shape === "circle" ? h : w;
  const boxH = shape === "line" ? Math.max(2, h * 0.1) : h;

  return (
    <div
      style={{
        position: "absolute",
        left: `${position.x * 100}%`,
        top: `${position.y * 100}%`,
        width: boxW,
        height: boxH,
        borderRadius: radius,
        background: fill,
        boxShadow: `0 0 28px ${fill}88`,
        opacity: opacity * animOpacity,
        filter: blur > 0 ? `blur(${blur}px)` : undefined,
        transformOrigin: "center",
        transform: `translate(-50%, -50%) translateY(${translateY}px) scale(${scaleX}, ${scaleY})`,
      }}
    />
  );
};
