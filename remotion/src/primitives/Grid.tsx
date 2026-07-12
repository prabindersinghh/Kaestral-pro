import { AbsoluteFill } from "remotion";
import type { PrimitiveProps } from "./types";
import { TOKENS } from "./tokens";

// Ported verbatim (as a primitive) from `remotion/src/compositions/HeroDemo.tsx`'s local `Grid` —
// the faint drifting timeline grid backdrop. Same 72px cell size, same drift speed, same
// white-hairline color and 0.5 opacity. Do not soften.

export const Grid: React.FC<PrimitiveProps> = ({ frame, width, height, opacity }) => {
  const drift = (frame * 0.15) % 72;
  return (
    <AbsoluteFill style={{ opacity: 0.5 * opacity }}>
      {Array.from({ length: Math.ceil(width / 72) + 1 }).map((_, i) => (
        <div
          key={`v${i}`}
          style={{ position: "absolute", top: 0, bottom: 0, left: i * 72 - drift, width: 1, background: TOKENS.white }}
        />
      ))}
      {Array.from({ length: Math.ceil(height / 72) + 1 }).map((_, i) => (
        <div
          key={`h${i}`}
          style={{ position: "absolute", left: 0, right: 0, top: i * 72, height: 1, background: TOKENS.white }}
        />
      ))}
    </AbsoluteFill>
  );
};
