import { AbsoluteFill } from "remotion";
import type { PrimitiveProps } from "./types";
import { tokenColor, TOKENS } from "./tokens";

// Ported from `remotion/src/compositions/HeroDemo.tsx`'s ambient "kestrel-eye" glow: a breathing
// radial gradient centered at 50%/42%, same size (46% x 40%) and same sine breathing formula
// (0.20 + 0.07 * sin(t * 1.6)). Accent color resolves via `props.accent` (brand token or hex),
// defaulting to brand green.

export const GlowField: React.FC<PrimitiveProps> = ({ props, frame, fps, opacity, position }) => {
  const accent = props.accent ? tokenColor(String(props.accent)) : TOKENS.green;
  const glow = 0.2 + 0.07 * Math.sin((frame / fps) * 1.6);
  const alphaHex = Math.round(glow * opacity * 255)
    .toString(16)
    .padStart(2, "0");
  const cx = position.x * 100;
  const cy = position.y * 100;

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(46% 40% at ${cx}% ${cy}%, ${accent}${alphaHex} 0%, transparent 60%)`,
      }}
    />
  );
};
