import { interpolate, Easing } from "remotion";
import type { PrimitiveProps } from "./types";
import { TOKENS, tokenColor } from "./tokens";

// Like LineChart, but the emphasis flips: the FILLED AREA sweeps in left->right (via a clip-path
// reveal) as the hero motion, with a subtle green-to-transparent gradient fill and a thinner
// top-edge stroke riding along the leading edge. `props.points: number[]` normalized internally.

const ease = Easing.bezier(0.22, 0.61, 0.16, 1);

function normalize(points: number[]): number[] {
  if (points.length === 0) return [0, 0];
  const min = Math.min(...points);
  const max = Math.max(...points);
  if (max === min) return points.map(() => 0.5);
  return points.map((p) => (p - min) / (max - min));
}

export const AreaChart: React.FC<PrimitiveProps> = ({ props, frame, width, height, opacity, blur, position, enter }) => {
  const raw = Array.isArray(props.points) ? (props.points as unknown[]).map(Number) : [10, 24, 18, 40, 34, 58, 50, 82];
  const norm = normalize(raw);
  const accent = props.color ? tokenColor(String(props.color)) : TOKENS.green;

  const delay = enter?.delay ?? 0;
  const local = frame - delay;

  const plotW = width * 0.5;
  const plotH = height * 0.3;

  const coords = norm.map((v, i) => ({
    x: (i / Math.max(1, norm.length - 1)) * plotW,
    y: plotH - v * plotH,
  }));

  const pathD = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`).join(" ");
  const areaD = `${pathD} L ${plotW} ${plotH} L 0 ${plotH} Z`;

  const groupIn = interpolate(local, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sweep = interpolate(local, [4, 58], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });

  // Leading-edge point for the traveling glow marker that rides the sweep.
  const leadIdx = Math.min(coords.length - 1, Math.max(0, Math.floor(sweep * (coords.length - 1))));
  const leadFrac = sweep * (coords.length - 1) - leadIdx;
  const leadPrev = coords[leadIdx];
  const leadNext = coords[Math.min(coords.length - 1, leadIdx + 1)];
  const leadX = interpolate(leadFrac, [0, 1], [leadPrev.x, leadNext.x]);
  const leadY = interpolate(leadFrac, [0, 1], [leadPrev.y, leadNext.y]);

  return (
    <div
      style={{
        position: "absolute",
        left: `${position.x * 100}%`,
        top: `${position.y * 100}%`,
        transform: "translate(-50%, -50%)",
        width: plotW,
        height: plotH,
        opacity: opacity * groupIn,
        filter: blur > 0 ? `blur(${blur}px)` : undefined,
      }}
    >
      <svg width={plotW} height={plotH} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id="areaChartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity={0.55} />
            <stop offset="100%" stopColor={accent} stopOpacity={0} />
          </linearGradient>
          <clipPath id="areaChartSweep">
            <rect x={0} y={0} width={plotW * sweep} height={plotH} />
          </clipPath>
        </defs>
        {/* the filled area sweeping in left -> right (hero motion) */}
        <path d={areaD} fill="url(#areaChartFill)" clipPath="url(#areaChartSweep)" />
        {/* thin top-edge stroke riding along the same clip */}
        <path
          d={pathD}
          fill="none"
          stroke={accent}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          clipPath="url(#areaChartSweep)"
          style={{ filter: `drop-shadow(0 0 6px ${accent})` }}
        />
        {/* glowing marker riding the sweeping leading edge */}
        <circle cx={leadX} cy={leadY} r={5} fill={TOKENS.ink} style={{ filter: `drop-shadow(0 0 10px ${accent})` }} />
      </svg>
    </div>
  );
};
