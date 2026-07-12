import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Sequence, Easing } from "remotion";

// Bespoke vertical (9:16) reel for the "Raw footage → publish-ready reel" feature.
// Story in four beats: a long messy recording → filler/silence cut away → hook found +
// captioned → a tight vertical short. Same instrument aesthetic + exact logo green as HeroDemo.

export interface CondenseReelProps {
  accent?: string;
  durationSeconds?: number;
}

const GREEN = "#16b16a";
const GREEN_HI = "#1fce7e";
const RED = "#e5484d";
const WHITE_LINE = "rgba(255,255,255,0.10)";
const INK = "#eaeaef";
const INK2 = "rgba(255,255,255,0.55)";
const MONO = "'SF Mono','Consolas','Menlo',monospace";
const SANS = "'Inter','Helvetica Neue',Arial,sans-serif";
const ease = Easing.bezier(0.22, 0.61, 0.16, 1);

const Grid: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const drift = (frame * 0.12) % 64;
  return (
    <AbsoluteFill style={{ opacity: 0.45 }}>
      {Array.from({ length: Math.ceil(width / 64) + 1 }).map((_, i) => (
        <div key={`v${i}`} style={{ position: "absolute", top: 0, bottom: 0, left: i * 64 - drift, width: 1, background: WHITE_LINE }} />
      ))}
      {Array.from({ length: Math.ceil(height / 64) + 1 }).map((_, i) => (
        <div key={`h${i}`} style={{ position: "absolute", left: 0, right: 0, top: i * 64, height: 1, background: WHITE_LINE }} />
      ))}
    </AbsoluteFill>
  );
};

const LogoMark: React.FC<{ frame: number; fps: number; s: number }> = ({ frame, fps, s }) => {
  const bar = (i: number) => {
    const p = spring({ frame: frame - i * 5, fps, config: { damping: 15, mass: 0.7 } });
    return { transform: `translateX(${interpolate(p, [0, 1], [-30, 0])}px)`, opacity: p };
  };
  const w = 150 * s, h = 36 * s, gap = 12 * s, r = 8 * s;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap }}>
      <div style={{ width: w, height: h, borderRadius: r, background: GREEN, boxShadow: `0 0 ${22 * s}px rgba(31,206,126,0.55)`, ...bar(0) }} />
      <div style={{ width: w * 0.72, height: h, borderRadius: r, background: "#484852", ...bar(1) }} />
      <div style={{ width: w * 0.86, height: h, borderRadius: r, background: "#2b2931", ...bar(2) }} />
    </div>
  );
};

export const CondenseReel: React.FC<CondenseReelProps> = ({ accent = GREEN }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();

  const glow = 0.18 + 0.06 * Math.sin((frame / fps) * 1.6);
  const outFade = interpolate(frame, [durationInFrames - 16, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });

  // waveform bars — some flagged as "filler" (red), collapse away in beat 2
  const N = 26;
  const fillerIdx = new Set([3, 4, 9, 14, 15, 20]);

  // BEAT 1 (0–72): the raw recording — long waveform, "20:00" label
  const b1 = frame;
  const revealBars = interpolate(b1, [8, 40], [0, N], { extrapolateRight: "clamp", easing: ease });

  // BEAT 2 (72–150): cut filler + silence — red bars collapse, timeline tightens
  const b2 = frame - 74;
  const collapse = interpolate(b2, [4, 34], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });

  // BEAT 3 (150–228): hook + captions
  const b3 = frame - 152;
  const hookIn = spring({ frame: b3, fps, config: { damping: 15 } });
  const capWords = ["this", "is", "the", "hook"];

  // BEAT 4 (228–end): tight reel + logo
  const b4 = frame - 230;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0a0d", opacity: outFade, fontFamily: SANS }}>
      <AbsoluteFill style={{ background: `radial-gradient(40% 26% at 50% 40%, ${accent}${Math.round(glow * 255).toString(16).padStart(2, "0")} 0%, transparent 60%)` }} />
      <Grid />

      {/* BEAT 1 — the raw recording */}
      <Sequence from={0} durationInFrames={76}>
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 8%" }}>
          <div style={{ fontFamily: MONO, fontSize: Math.round(width * 0.045), color: INK2, letterSpacing: 3, textTransform: "uppercase", marginBottom: 40 }}>Raw recording</div>
          <div style={{ display: "flex", alignItems: "center", gap: width * 0.012, height: height * 0.18 }}>
            {Array.from({ length: N }).map((_, i) => {
              if (i >= revealBars) return <div key={i} style={{ width: width * 0.022 }} />;
              const h = 0.25 + 0.6 * Math.abs(Math.sin(i * 1.3));
              const filler = fillerIdx.has(i);
              return <div key={i} style={{ width: width * 0.022, height: `${h * 100}%`, borderRadius: 6, background: filler ? RED : accent, opacity: filler ? 0.85 : 0.7 }} />;
            })}
          </div>
          <div style={{ marginTop: 40, fontFamily: MONO, fontSize: Math.round(width * 0.05), color: INK, letterSpacing: 1 }}>20:00</div>
          <div style={{ marginTop: 10, fontFamily: MONO, fontSize: Math.round(width * 0.03), color: RED }}>● filler · silence · rambling</div>
        </AbsoluteFill>
      </Sequence>

      {/* BEAT 2 — cut the filler */}
      <Sequence from={74} durationInFrames={78}>
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 8%" }}>
          <div style={{ fontFamily: MONO, fontSize: Math.round(width * 0.045), color: accent, letterSpacing: 3, textTransform: "uppercase", marginBottom: 40 }}>Cutting filler…</div>
          <div style={{ display: "flex", alignItems: "center", gap: width * 0.012, height: height * 0.18 }}>
            {Array.from({ length: N }).map((_, i) => {
              const filler = fillerIdx.has(i);
              const h = 0.25 + 0.6 * Math.abs(Math.sin(i * 1.3));
              const scale = filler ? 1 - collapse : 1;
              return <div key={i} style={{ width: width * 0.022 * (filler ? Math.max(0.001, scale) : 1), height: `${h * 100}%`, borderRadius: 6, background: filler ? RED : accent, opacity: filler ? 0.85 * (1 - collapse) : 0.75, transition: "none" }} />;
            })}
          </div>
          <div style={{ marginTop: 40, display: "flex", alignItems: "center", gap: 18, fontFamily: MONO, fontSize: Math.round(width * 0.05), color: INK }}>
            <span style={{ color: RED, textDecoration: "line-through", opacity: 1 - collapse * 0.6 }}>20:00</span>
            <span style={{ color: accent }}>→</span>
            <span style={{ color: GREEN_HI }}>0:20</span>
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* BEAT 3 — hook + captions */}
      <Sequence from={152} durationInFrames={78}>
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 8%" }}>
          <div style={{ opacity: hookIn, transform: `scale(${interpolate(hookIn, [0, 1], [0.8, 1])})`, textAlign: "center" }}>
            <div style={{ fontFamily: MONO, fontSize: Math.round(width * 0.04), color: accent, letterSpacing: 2, textTransform: "uppercase", marginBottom: 30 }}>Hook, up front</div>
            {/* karaoke-style caption chips lighting up */}
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 14, maxWidth: width * 0.8 }}>
              {capWords.map((w, i) => {
                const wp = spring({ frame: b3 - 10 - i * 8, fps, config: { damping: 16 } });
                return (
                  <span key={i} style={{
                    opacity: wp, transform: `translateY(${interpolate(wp, [0, 1], [16, 0])}px)`,
                    fontWeight: 800, fontSize: Math.round(width * 0.085), color: i === 3 ? GREEN_HI : INK,
                    background: i === 3 ? "rgba(31,206,126,0.14)" : "transparent", padding: "2px 14px", borderRadius: 12,
                    letterSpacing: -1,
                  }}>{w}</span>
                );
              })}
            </div>
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* BEAT 4 — the finished reel + logo */}
      <Sequence from={230}>
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          <div style={{ opacity: spring({ frame: b4, fps, config: { damping: 16 } }), textAlign: "center" }}>
            <div style={{ fontWeight: 800, fontSize: Math.round(width * 0.08), color: INK, letterSpacing: -1.5, lineHeight: 1.05 }}>Publish-ready</div>
            <div style={{ fontWeight: 800, fontSize: Math.round(width * 0.08), color: GREEN_HI, letterSpacing: -1.5, lineHeight: 1.05, marginBottom: height * 0.05 }}>in one prompt.</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 22 }}>
              <LogoMark frame={b4 - 8} fps={fps} s={0.9} />
              <div style={{ fontWeight: 800, fontSize: Math.round(width * 0.09), color: INK, letterSpacing: -2, opacity: spring({ frame: b4 - 18, fps, config: { damping: 16 } }) }}>Kaestral</div>
            </div>
          </div>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
