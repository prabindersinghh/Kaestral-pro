import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export interface DataVizProps {
  title?: string;
  accent?: string;
  bars?: { label: string; value: number }[];
  durationSeconds?: number;
}

const DEFAULT_BARS = [
  { label: "Jan", value: 42 }, { label: "Feb", value: 65 }, { label: "Mar", value: 51 },
  { label: "Apr", value: 88 }, { label: "May", value: 73 }, { label: "Jun", value: 96 },
];

// Animated bar chart: bars grow with a staggered spring, values count up. Data-driven motion —
// exactly the sort of thing you'd want a real render engine (not hand-drawn canvas) for.
export const DataViz: React.FC<DataVizProps> = ({ title = "Growth", accent = "#1db26b", bars = DEFAULT_BARS }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const max = Math.max(...bars.map((b) => b.value), 1);
  const plotH = height * 0.6;
  const plotY = height * 0.78;
  const barW = (width * 0.8) / bars.length * 0.6;
  const gap = (width * 0.8) / bars.length;
  const startX = width * 0.1 + (gap - barW) / 2;
  const outFade = interpolate(frame, [durationInFrames - 14, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const titleOp = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0e12", opacity: outFade }}>
      <div style={{ position: "absolute", top: height * 0.08, left: width * 0.1, opacity: titleOp, fontFamily: "Helvetica, Arial, sans-serif", fontWeight: 800, fontSize: Math.round(height * 0.07), color: "#fff" }}>{title}</div>
      {/* baseline */}
      <div style={{ position: "absolute", left: width * 0.08, width: width * 0.84, top: plotY, height: 2, background: "rgba(255,255,255,0.15)" }} />
      {bars.map((b, i) => {
        const g = spring({ frame: frame - 12 - i * 6, fps, config: { damping: 15, mass: 0.7 } });
        const h = (b.value / max) * plotH * g;
        const shown = Math.round(b.value * g);
        return (
          <div key={i}>
            <div style={{ position: "absolute", left: startX + i * gap, top: plotY - h, width: barW, height: h, background: `linear-gradient(180deg, ${accent}, ${accent}88)`, borderRadius: "8px 8px 0 0", boxShadow: `0 0 20px ${accent}55` }} />
            <div style={{ position: "absolute", left: startX + i * gap, top: plotY - h - height * 0.05, width: barW, textAlign: "center", color: "#fff", fontFamily: "Helvetica, Arial, sans-serif", fontWeight: 700, fontSize: Math.round(height * 0.03), opacity: g }}>{shown}</div>
            <div style={{ position: "absolute", left: startX + i * gap, top: plotY + height * 0.015, width: barW, textAlign: "center", color: "rgba(255,255,255,0.6)", fontFamily: "Helvetica, Arial, sans-serif", fontSize: Math.round(height * 0.026) }}>{b.label}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
