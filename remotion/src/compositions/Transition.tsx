import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

export interface TransitionProps {
  accent?: string;
  label?: string;
  durationSeconds?: number;
}

// A full-frame "stinger" wipe you drop between two clips: an accent panel sweeps across, an optional
// label flashes at the midpoint, then it sweeps off — a reusable transition asset.
export const Transition: React.FC<TransitionProps> = ({ accent = "#1db26b", label }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const mid = durationInFrames / 2;
  // panel covers 0→100% by mid, then 100→off by end (translateX)
  const cover = interpolate(frame, [0, mid], [-width, 0], { extrapolateRight: "clamp", easing: (t) => 1 - Math.pow(1 - t, 4) });
  const off = interpolate(frame, [mid, durationInFrames], [0, width], { extrapolateLeft: "clamp", easing: (t) => t * t });
  const x = frame < mid ? cover : off;
  const labelOp = interpolate(frame, [mid - 6, mid, mid + 6], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 0, top: 0, width, height, background: `linear-gradient(120deg, ${accent}, #0a0a0a)`, transform: `translateX(${x}px) skewX(-8deg)` }} />
      {label && (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: labelOp }}>
          <div style={{ fontFamily: "Helvetica, Arial, sans-serif", fontWeight: 800, fontSize: Math.round(height * 0.09), color: "#fff", letterSpacing: 2 }}>{label}</div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
