import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export interface IntroProps {
  title: string;
  subtitle?: string;
  accent?: string;
  durationSeconds?: number;
}

export const AnimatedIntro: React.FC<IntroProps> = ({ title, subtitle, accent = "#1db26b" }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 13, mass: 0.9 } });
  const scale = interpolate(enter, [0, 1], [0.62, 1]);
  const titleOpacity = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" });
  const outFade = interpolate(frame, [durationInFrames - 14, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const glowPulse = 0.28 + 0.12 * Math.sin((frame / fps) * 2.2);
  const underline = interpolate(enter, [0.3, 1], [0, 1], { extrapolateLeft: "clamp" });

  const words = (subtitle ?? "").split(" ");

  return (
    <AbsoluteFill style={{ backgroundColor: "#07100c", opacity: outFade }}>
      {/* animated radial glow */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 46%, ${accent}${Math.round(glowPulse * 255).toString(16).padStart(2, "0")} 0%, transparent 55%)`,
        }}
      />
      {/* drifting accent bars */}
      {[0, 1, 2, 3].map((i) => {
        const y = ((frame * (0.6 + i * 0.25) + i * 220) % (height + 120)) - 60;
        return (
          <div
            key={i}
            style={{
              position: "absolute", left: 0, top: y, width, height: 2,
              background: accent, opacity: 0.08,
            }}
          />
        );
      })}

      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div
          style={{
            transform: `scale(${scale})`, opacity: titleOpacity,
            fontFamily: "Helvetica, Arial, sans-serif", fontWeight: 800,
            fontSize: Math.round(height * 0.13), color: "#ffffff", letterSpacing: -2,
            textShadow: "0 8px 40px rgba(0,0,0,0.6)", textAlign: "center", padding: "0 6%",
          }}
        >
          {title}
        </div>

        <div style={{ height: 10, width: interpolate(underline, [0, 1], [0, height * 0.34]), background: accent, borderRadius: 6, marginTop: height * 0.02, boxShadow: `0 0 24px ${accent}` }} />

        {subtitle && (
          <div style={{ marginTop: height * 0.04, display: "flex", gap: "0.4ch", fontFamily: "Helvetica, Arial, sans-serif", fontWeight: 500, fontSize: Math.round(height * 0.038), color: "rgba(255,255,255,0.86)" }}>
            {words.map((w, i) => {
              const wp = spring({ frame: frame - 16 - i * 4, fps, config: { damping: 16 } });
              return (
                <span key={i} style={{ opacity: wp, transform: `translateY(${interpolate(wp, [0, 1], [18, 0])}px)`, display: "inline-block" }}>{w}</span>
              );
            })}
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
