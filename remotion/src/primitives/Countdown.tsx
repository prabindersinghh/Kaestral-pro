import { interpolate, spring } from "remotion";
import type { PrimitiveProps } from "./types";
import { TOKENS, tokenColor } from "./tokens";

// Countdown stinger element ("countdown") — big mono digits punching in with spring overshoot +
// a glow ring pulse, one digit at a time. Default counts 3-2-1 (`props.from`, default 3, counts
// down to 1) over `props.stepFrames` (default 16) frames each — quick and punchy, matching the
// "stinger" quality bar (masked reveals / stingers) rather than a slow counter reveal.

export const Countdown: React.FC<PrimitiveProps> = ({ props, frame, fps, height, opacity, blur, position, style }) => {
  const from = typeof props.from === "number" ? Math.max(1, Math.round(props.from)) : 3;
  const stepFrames = typeof props.stepFrames === "number" ? Math.max(6, Math.round(props.stepFrames)) : 16;
  const accent = props.accent ? tokenColor(String(props.accent)) : TOKENS.greenHi;

  const step = Math.min(from - 1, Math.floor(frame / stepFrames));
  const digit = from - step;
  const localFrame = frame - step * stepFrames;

  // Overshoot punch-in: scale rockets past 1 then settles, opacity snaps in fast.
  const p = spring({ frame: localFrame, fps, config: { damping: 10, mass: 0.5, stiffness: 180 } });
  const scale = interpolate(p, [0, 1], [0.3, 1]);
  const digitOpacity = interpolate(localFrame, [0, 3], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // Fade the digit out right before the next one lands so digits don't visibly overlap/stack.
  const exitFade = interpolate(localFrame, [stepFrames - 5, stepFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Glow ring: expands outward and fades, re-triggered every digit via localFrame.
  const ringP = interpolate(localFrame, [0, stepFrames * 0.8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ringScale = interpolate(ringP, [0, 1], [0.6, 1.9]);
  const ringOpacity = interpolate(ringP, [0, 1], [0.8, 0]);

  const fontSize = Math.round(height * (style?.size ?? 0.22));

  return (
    <div
      style={{
        position: "absolute",
        left: `${position.x * 100}%`,
        top: `${position.y * 100}%`,
        transform: "translate(-50%, -50%)",
        opacity: opacity * exitFade,
        filter: blur > 0 ? `blur(${blur}px)` : undefined,
        width: fontSize * 1.8,
        height: fontSize * 1.8,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* glow ring */}
      <div
        style={{
          position: "absolute",
          width: fontSize * 1.6,
          height: fontSize * 1.6,
          borderRadius: "50%",
          border: `2px solid ${accent}`,
          boxShadow: `0 0 40px ${accent}`,
          transform: `scale(${ringScale})`,
          opacity: ringOpacity,
        }}
      />
      {/* digit */}
      <div
        style={{
          position: "relative",
          transform: `scale(${scale})`,
          opacity: digitOpacity,
          fontFamily: TOKENS.fontMono,
          fontWeight: 800,
          fontSize,
          color: TOKENS.ink,
          textShadow: `0 0 50px ${accent}aa`,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {digit}
      </div>
    </div>
  );
};
