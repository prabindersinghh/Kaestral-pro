import { interpolate, spring } from "remotion";
import type { PrimitiveProps } from "./types";
import { TOKENS } from "./tokens";

// Ported verbatim from `remotion/src/compositions/HeroDemo.tsx`'s local `LogoMark` — the
// three-bar Kaestral mark (green / slate / slate2), bars assembling in sequence with a
// translateX spring, top bar glowing green. Same dimensions, same damping, same colors.

export const LogoMark: React.FC<PrimitiveProps> = ({ frame, fps, opacity, blur, position, props, style }) => {
  const s = typeof props.scale === "number" ? props.scale : style?.size ? style.size / 0.09 : 1;

  const bar = (i: number) => {
    const p = spring({ frame: frame - i * 5, fps, config: { damping: 15, mass: 0.7 } });
    return { transform: `translateX(${interpolate(p, [0, 1], [-40, 0])}px)`, opacity: p };
  };

  const w = 190 * s,
    h = 46 * s,
    gap = 16 * s,
    r = 10 * s;

  return (
    <div
      style={{
        position: "absolute",
        left: `${position.x * 100}%`,
        top: `${position.y * 100}%`,
        transform: "translate(-50%, -50%)",
        opacity,
        filter: blur > 0 ? `blur(${blur}px)` : undefined,
        display: "flex",
        flexDirection: "column",
        gap,
      }}
    >
      <div
        style={{
          width: w,
          height: h,
          borderRadius: r,
          background: TOKENS.green,
          boxShadow: `0 0 ${28 * s}px rgba(31,206,126,0.55)`,
          ...bar(0),
        }}
      />
      <div style={{ width: w * 0.72, height: h, borderRadius: r, background: TOKENS.slate, ...bar(1) }} />
      <div style={{ width: w * 0.86, height: h, borderRadius: r, background: TOKENS.slate2, ...bar(2) }} />
    </div>
  );
};
