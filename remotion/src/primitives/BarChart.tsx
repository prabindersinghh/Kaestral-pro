import { interpolate, spring } from "remotion";
import type { PrimitiveProps } from "./types";
import { TOKENS, tokenColor } from "./tokens";

// Improves on `remotion/src/compositions/DataViz.tsx`'s bar chart template: staggered spring
// entrance per bar (not a shared linear ramp), count-up value labels, a gold/white hairline
// baseline axis, and the layered glow bloom used elsewhere (LogoMark/Shape). `props.bars:
// [{label, value}]`; `props.title` optional caption above the chart; `props.color` overrides the
// bar accent (defaults to brand green).

interface Bar {
  label: string;
  value: number;
}

const DEFAULT_BARS: Bar[] = [
  { label: "Jan", value: 42 },
  { label: "Feb", value: 65 },
  { label: "Mar", value: 51 },
  { label: "Apr", value: 88 },
];

export const BarChart: React.FC<PrimitiveProps> = ({ props, frame, fps, width, height, opacity, blur, position, enter }) => {
  const bars: Bar[] = Array.isArray(props.bars)
    ? (props.bars as unknown[]).map((b) => {
        const o = (b ?? {}) as Record<string, unknown>;
        return { label: typeof o.label === "string" ? o.label : "", value: typeof o.value === "number" ? o.value : 0 };
      })
    : DEFAULT_BARS;
  const accent = props.color ? tokenColor(String(props.color)) : TOKENS.green;
  const title = typeof props.title === "string" ? props.title : undefined;

  const delay = enter?.delay ?? 0;
  const local = frame - delay;

  const max = Math.max(...bars.map((b) => b.value), 1);
  const chartW = width * 0.5;
  const chartH = height * 0.32;
  const barGap = chartW / bars.length;
  const barW = barGap * 0.56;
  const startX = -chartW / 2 + (barGap - barW) / 2;

  const titleIn = interpolate(local, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const axisIn = interpolate(local, [4, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div
      style={{
        position: "absolute",
        left: `${position.x * 100}%`,
        top: `${position.y * 100}%`,
        transform: "translate(-50%, -50%)",
        opacity,
        filter: blur > 0 ? `blur(${blur}px)` : undefined,
      }}
    >
      {title && (
        <div
          style={{
            textAlign: "center",
            marginBottom: 18,
            opacity: titleIn,
            transform: `translateY(${interpolate(titleIn, [0, 1], [10, 0])}px)`,
            fontFamily: TOKENS.fontSans,
            fontWeight: 800,
            fontSize: Math.round(height * 0.04),
            color: TOKENS.ink,
            letterSpacing: -0.5,
          }}
        >
          {title}
        </div>
      )}
      <div style={{ position: "relative", width: chartW, height: chartH }}>
        {/* gold hairline baseline axis */}
        <div
          style={{
            position: "absolute",
            left: 0,
            width: chartW * axisIn,
            bottom: 0,
            height: 2,
            background: TOKENS.gold,
            boxShadow: `0 0 10px ${TOKENS.gold}`,
          }}
        />
        {bars.map((b, i) => {
          const g = spring({ frame: local - 8 - i * 6, fps, config: { damping: 15, mass: 0.7 } });
          const barH = (b.value / max) * chartH * g;
          const shown = Math.round(b.value * g);
          const x = startX + i * barGap;
          return (
            <div key={i}>
              <div
                style={{
                  position: "absolute",
                  left: chartW / 2 + x,
                  bottom: 0,
                  width: barW,
                  height: Math.max(0, barH),
                  background: `linear-gradient(180deg, ${accent}, ${accent}88)`,
                  borderRadius: "8px 8px 2px 2px",
                  boxShadow: `0 0 24px ${accent}66`,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: chartW / 2 + x,
                  bottom: barH + 10,
                  width: barW,
                  textAlign: "center",
                  color: TOKENS.ink,
                  fontFamily: TOKENS.fontMono,
                  fontVariantNumeric: "tabular-nums",
                  fontWeight: 700,
                  fontSize: Math.round(height * 0.026),
                  opacity: g,
                }}
              >
                {shown}
              </div>
              <div
                style={{
                  position: "absolute",
                  left: chartW / 2 + x,
                  bottom: -chartH * 0.12,
                  width: barW,
                  textAlign: "center",
                  color: TOKENS.ink2,
                  fontFamily: TOKENS.fontSans,
                  fontSize: Math.round(height * 0.022),
                  letterSpacing: 0.5,
                  opacity: axisIn,
                }}
              >
                {b.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
