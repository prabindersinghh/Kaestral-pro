import { interpolate, spring } from "remotion";
import type { PrimitiveProps } from "./types";
import { getPrimitive } from "./registry";
import { TOKENS } from "./tokens";

// Multi-cell layout element ("gridLayout") — same nested-child pattern as SplitLayout, but for a
// 2x2 grid (`props.kind` unset or "grid") or a horizontal filmstrip (`props.kind === "filmstrip"`).
// `props.cells`: array of child layer-like defs `{ element, props, style? }`, looked up through the
// same primitive REGISTRY via `getPrimitive`. Staggered entrances, hairline dividers between cells.

interface CellDef {
  element: string;
  props?: Record<string, unknown>;
  style?: { role?: "display" | "accent" | "muted"; size?: number };
}

function resolveCells(raw: unknown): CellDef[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
    .map((c) => ({
      element: typeof c.element === "string" ? c.element : "",
      props: typeof c.props === "object" && c.props !== null ? (c.props as Record<string, unknown>) : {},
      style: typeof c.style === "object" && c.style !== null ? (c.style as CellDef["style"]) : undefined,
    }))
    .filter((c) => c.element !== "");
}

const STAGGER = 6;

export const GridLayout: React.FC<PrimitiveProps> = ({ props, frame, fps, width, height, opacity, blur }) => {
  const kind = props.kind === "filmstrip" ? "filmstrip" : "grid";
  const cells = resolveCells(props.cells).slice(0, kind === "grid" ? 4 : 6);
  if (cells.length === 0) return null;

  const cols = kind === "filmstrip" ? cells.length : 2;
  const rows = kind === "filmstrip" ? 1 : Math.ceil(cells.length / 2);
  const cellW = width / cols;
  const cellH = height / rows;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        opacity,
        filter: blur > 0 ? `blur(${blur}px)` : undefined,
      }}
    >
      {cells.map((cell, i) => {
        const Primitive = getPrimitive(cell.element);
        const cellDelay = STAGGER * i;
        const p = spring({ frame: frame - cellDelay, fps, config: { damping: 16, mass: 0.75 } });
        const scale = interpolate(p, [0, 1], [0.85, 1]);
        const cellOpacity = p;
        const col = i % cols;
        const row = Math.floor(i / cols);

        return (
          <div
            key={i}
            style={{
              position: "relative",
              overflow: "hidden",
              opacity: cellOpacity,
              transform: `scale(${scale})`,
              borderRight: col < cols - 1 ? `1px solid ${TOKENS.white}` : undefined,
              borderBottom: row < rows - 1 ? `1px solid ${TOKENS.white}` : undefined,
            }}
          >
            {Primitive && (
              <Primitive
                props={cell.props ?? {}}
                frame={Math.max(0, frame - cellDelay)}
                fps={fps}
                width={cellW}
                height={cellH}
                opacity={1}
                blur={0}
                position={{ x: 0.5, y: 0.5 }}
                style={cell.style}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
