import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export interface LogoRevealProps {
  title: string;
  accent?: string;
  durationSeconds?: number;
}

// A ring draws on, then the wordmark springs in with a shine sweep — the kind of masked/animated
// reveal that's painful in raw canvas but natural in Remotion.
export const LogoReveal: React.FC<LogoRevealProps> = ({ title, accent = "#5b8cff" }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const R = height * 0.24;
  const circ = 2 * Math.PI * R;
  const draw = interpolate(frame, [0, 40], [0, 1], { extrapolateRight: "clamp", easing: (t) => 1 - Math.pow(1 - t, 3) });
  const pop = spring({ frame: frame - 30, fps, config: { damping: 12, mass: 0.8 } });
  const shine = interpolate(frame, [44, 74], [-1, 2], { extrapolateLeft: "clamp" });
  const outFade = interpolate(frame, [durationInFrames - 14, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a12", opacity: outFade, justifyContent: "center", alignItems: "center" }}>
      <svg width={width} height={height} style={{ position: "absolute" }}>
        <circle cx={width / 2} cy={height / 2} r={R} fill="none" stroke={accent} strokeWidth={height * 0.012}
          strokeDasharray={circ} strokeDashoffset={circ * (1 - draw)} strokeLinecap="round"
          transform={`rotate(-90 ${width / 2} ${height / 2})`} style={{ filter: `drop-shadow(0 0 18px ${accent})` }} />
      </svg>
      <div style={{ position: "relative", transform: `scale(${interpolate(pop, [0, 1], [0.4, 1])})`, opacity: pop, overflow: "hidden" }}>
        <div style={{ fontFamily: "Helvetica, Arial, sans-serif", fontWeight: 800, fontSize: Math.round(height * 0.11), color: "#fff", letterSpacing: 1 }}>{title}</div>
        <div style={{ position: "absolute", top: 0, bottom: 0, width: "40%", left: `${shine * 100}%`, background: "linear-gradient(100deg, transparent, rgba(255,255,255,0.55), transparent)", transform: "skewX(-18deg)" }} />
      </div>
    </AbsoluteFill>
  );
};
