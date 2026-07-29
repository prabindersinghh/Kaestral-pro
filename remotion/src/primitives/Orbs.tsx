import { AbsoluteFill } from "remotion";
import { paletteColor } from "./tokens";

// Ambient Orbs (Cinematic Reel pack effect #7, BG_KIND "orbs") — 3 large, heavily blurred circles
// gently drifting, colored from the scene's user palette (never a hardcoded hex — see
// `tokens.ts`'s `paletteColor`). Rendered directly by `Generative.tsx`'s `BeatBackground` resolver
// (like GlowField/Grid, this is a BACKGROUND, not a SceneSpec `element`), so it takes the same
// lightweight ad hoc prop set the other background components use rather than the full
// `PrimitiveProps` shape (no `props`/`enter`/`style`/`blur` needed for a background).
//
// Deterministic pseudo-random layout (seeded by index, same technique as Particles.tsx) so renders
// are stable frame-to-frame and reproducible — no Math.random() at render time.

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export interface OrbsProps {
  frame: number;
  fps: number;
  width: number;
  height: number;
  opacity: number;
  palette?: string[];
}

const ORB_COUNT = 3;
const ORB_BLUR_PX = 80;
const ORB_LOOP_SECONDS = 1.6; // "slowly drifting per-scene over ~1.6s loops"
const ORB_OPACITY_MIN = 0.18;
const ORB_OPACITY_MAX = 0.38;

export const Orbs: React.FC<OrbsProps> = ({ frame, fps, width, height, opacity, palette }) => {
  const t = frame / fps;
  const shortSide = Math.min(width, height);

  return (
    <AbsoluteFill style={{ opacity }}>
      {Array.from({ length: ORB_COUNT }).map((_, i) => {
        const baseX = 0.22 + seededRandom(i * 3.1 + 1) * 0.56;
        const baseY = 0.22 + seededRandom(i * 7.7 + 2) * 0.56;
        const phase = seededRandom(i * 5.3 + 3) * Math.PI * 2;
        const driftAngle = (t / ORB_LOOP_SECONDS) * Math.PI * 2 + phase;
        const driftX = Math.sin(driftAngle) * 0.05;
        const driftY = Math.cos(driftAngle * 0.8) * 0.05;
        const size = (0.24 + seededRandom(i * 4.4 + 6) * 0.12) * shortSide;
        const breathe = 0.5 + 0.5 * Math.sin(driftAngle * 1.3);
        const orbOpacity = ORB_OPACITY_MIN + breathe * (ORB_OPACITY_MAX - ORB_OPACITY_MIN);
        const color = paletteColor(palette, i);

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${(baseX + driftX) * 100}%`,
              top: `${(baseY + driftY) * 100}%`,
              width: size,
              height: size,
              borderRadius: "50%",
              background: color,
              filter: `blur(${ORB_BLUR_PX}px)`,
              opacity: orbOpacity,
              transform: "translate(-50%, -50%)",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
