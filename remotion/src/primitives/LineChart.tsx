import { interpolate, spring, Easing } from "remotion";
import type { PrimitiveProps } from "./types";
import { TOKENS, tokenColor } from "./tokens";

// Line chart that DRAWS ON left->right over the beat using the classic strokeDasharray /
// strokeDashoffset technique (dash the full path length, then animate the offset from full to
// zero), with a glowing dot riding the leading end and a faint area fill trailing under the
// drawn portion. `props.points: number[]` — normalized internally to the plot box regardless of
// whether the input is 0..1 or raw magnitudes.

const ease = Easing.bezier(0.22, 0.61, 0.16, 1);

function normalize(points: number[]): number[] {
  if (points.length === 0) return [0, 0];
  const min = Math.min(...points);
  const max = Math.max(...points);
  if (max === min) return points.map(() => 0.5);
  return points.map((p) => (p - min) / (max - min));
}

export const LineChart: React.FC<PrimitiveProps> = ({ props, frame, fps, width, height, opacity, blur, position, enter }) => {
  const raw = Array.isArray(props.points) ? (props.points as unknown[]).map(Number) : [12, 30, 22, 48, 40, 70, 62, 90];
  const norm = normalize(raw);
  const accent = props.color ? tokenColor(String(props.color)) : TOKENS.greenHi;

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

  // Approximate path length via segment sum (sufficient for a dash-offset draw-on — exact SVG
  // getTotalLength isn't available at SSR/render time without a DOM).
  let pathLen = 0;
  for (let i = 1; i < coords.length; i++) {
    pathLen += Math.hypot(coords[i].x - coords[i - 1].x, coords[i].y - coords[i - 1].y);
  }
  pathLen = Math.max(1, pathLen);

  const groupIn = interpolate(local, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const draw = interpolate(local, [6, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const dashOffset = pathLen * (1 - draw);

  const leadIdx = Math.min(coords.length - 1, Math.max(0, Math.floor(draw * (coords.length - 1))));
  const leadFrac = draw * (coords.length - 1) - leadIdx;
  const leadPrev = coords[leadIdx];
  const leadNext = coords[Math.min(coords.length - 1, leadIdx + 1)];
  const leadX = interpolate(leadFrac, [0, 1], [leadPrev.x, leadNext.x]);
  const leadY = interpolate(leadFrac, [0, 1], [leadPrev.y, leadNext.y]);
  const dotPulse = spring({ frame: local, fps, config: { damping: 12 } });

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
          <linearGradient id="lineChartArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity={0.35} />
            <stop offset="100%" stopColor={accent} stopOpacity={0} />
          </linearGradient>
        </defs>
        {/* faint area fill under the drawn portion */}
        <path d={areaD} fill="url(#lineChartArea)" opacity={draw} />
        {/* the line itself, drawing on via strokeDasharray/offset */}
        <path
          d={pathD}
          fill="none"
          stroke={accent}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={pathLen}
          strokeDashoffset={dashOffset}
          style={{ filter: `drop-shadow(0 0 8px ${accent})` }}
        />
        {/* glowing dot at the leading end */}
        <circle
          cx={leadX}
          cy={leadY}
          r={5 + dotPulse * 2}
          fill={accent}
          style={{ filter: `drop-shadow(0 0 10px ${accent})` }}
        />
      </svg>
    </div>
  );
};
