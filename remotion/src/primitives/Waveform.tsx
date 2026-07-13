import { interpolate, spring, Easing } from "remotion";
import type { PrimitiveProps } from "./types";
import { TOKENS, tokenColor } from "./tokens";

// Ported from `remotion/src/compositions/CondenseReel.tsx` beats 1-2: a row of vertical waveform
// bars that reveal left-to-right, with "filler" bars flagged in red (#e5484d) that COLLAPSE away
// (width -> 0, opacity -> 0) when `props.collapse` is true — the exact "cut the filler" motif.
// `props.bars` sets the bar count (defaults to CondenseReel's N=26); `props.fillerIdx: number[]`
// flags which bar indices are filler/silence. Heights are seeded (deterministic sine pattern),
// never Math.random(), so re-renders are stable frame-to-frame.

const RED = "#e5484d";
const ease = Easing.bezier(0.22, 0.61, 0.16, 1);

function barHeight(i: number): number {
  return 0.25 + 0.6 * Math.abs(Math.sin(i * 1.3));
}

export const Waveform: React.FC<PrimitiveProps> = ({ props, frame, fps, width, height, opacity, blur, position, enter }) => {
  const N = typeof props.bars === "number" ? Math.round(props.bars) : 26;
  const fillerIdx = new Set(Array.isArray(props.fillerIdx) ? (props.fillerIdx as unknown[]).map(Number) : []);
  const collapseFlag = props.collapse === true;
  const accent = props.color ? tokenColor(String(props.color)) : TOKENS.green;

  const delay = enter?.delay ?? 0;
  const local = frame - delay;

  // Bars reveal left -> right, spring-settled group entrance (never a hard pop-in).
  const rawGroupIn = spring({ frame: local, fps, config: { damping: 16, mass: 0.7 } });
  // TASK 5 FIX (per-property `animate` "sole driver" contract, see Generative.tsx's `BeatLayer`) —
  // `animate.position` alone must not also kill this primitive's own opacity fade-in.
  const groupIn = enter?.neutralizeOpacity ? 1 : rawGroupIn;
  const revealBars = interpolate(local, [4, 34], [0, N], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });

  // Collapse animation kicks in after the reveal has had a moment to settle.
  const collapse = collapseFlag
    ? interpolate(local, [30, 64], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease })
    : 0;

  const barGap = width * 0.012;
  const barW = width * 0.022;

  return (
    <div
      style={{
        position: "absolute",
        left: `${position.x * 100}%`,
        top: `${position.y * 100}%`,
        transform: `translate(-50%, -50%) translateY(${interpolate(groupIn, [0, 1], [14, 0])}px)`,
        opacity: opacity * groupIn,
        filter: blur > 0 ? `blur(${blur}px)` : undefined,
        display: "flex",
        alignItems: "center",
        gap: barGap,
        height: height * 0.18,
      }}
    >
      {Array.from({ length: N }).map((_, i) => {
        if (i >= revealBars) return <div key={i} style={{ width: barW }} />;
        const h = barHeight(i);
        const filler = fillerIdx.has(i);
        const scale = filler ? Math.max(0.001, 1 - collapse) : 1;
        const barOpacity = filler ? 0.85 * (1 - collapse) : 0.72;
        const color = filler ? RED : accent;
        return (
          <div
            key={i}
            style={{
              width: barW * scale,
              height: `${h * 100}%`,
              borderRadius: 6,
              background: color,
              opacity: barOpacity,
              boxShadow: `0 0 10px ${color}66`,
            }}
          />
        );
      })}
    </div>
  );
};
