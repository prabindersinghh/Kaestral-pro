import { interpolate, spring } from "remotion";
import type { PrimitiveProps } from "./types";
import { getPrimitive } from "./registry";
import { TOKENS, tokenColor } from "./tokens";

// Multi-panel layout element ("splitLayout") — lays two child "panels" side-by-side (row) or
// stacked (column) with a thin hairline divider between them, each panel's content entering
// staggered. This is one of the primitive layout techniques that separates a designed composition
// from "text stacked in the middle" (binding critique #2/#6): asymmetric panels, not a single
// centered block.
//
// `props.panels`: array of child layer-like defs `{ element, props, style? }` — looked up through
// the SAME primitive REGISTRY as top-level layers via `getPrimitive` (see registry.ts). Bounded,
// closed-enum `element` names only; no free-form component synthesis.
// `props.direction`: "row" (default, side-by-side) | "column" (stacked top/bottom).

interface PanelDef {
  element: string;
  props?: Record<string, unknown>;
  style?: { role?: "display" | "accent" | "muted"; size?: number };
}

function resolvePanels(raw: unknown): PanelDef[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p): p is Record<string, unknown> => typeof p === "object" && p !== null)
    .map((p) => ({
      element: typeof p.element === "string" ? p.element : "",
      props: (typeof p.props === "object" && p.props !== null ? (p.props as Record<string, unknown>) : {}),
      style: typeof p.style === "object" && p.style !== null ? (p.style as PanelDef["style"]) : undefined,
    }))
    .filter((p) => p.element !== "");
}

export const SplitLayout: React.FC<PrimitiveProps> = ({ props, frame, fps, width, height, opacity, blur }) => {
  const panels = resolvePanels(props.panels).slice(0, 2); // exactly 2 panels — "split" by definition
  const direction = props.direction === "column" ? "column" : "row";
  const dividerColor = props.dividerColor ? tokenColor(String(props.dividerColor)) : TOKENS.gold;

  if (panels.length === 0) return null;

  // Divider grows in lockstep with the group entrance spring — no separate curve needed, the
  // spring's own easing already reads as a deliberate "grows in" motion.
  const dividerGrow = spring({ frame, fps, config: { damping: 16, mass: 0.8 } });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: direction,
        opacity,
        filter: blur > 0 ? `blur(${blur}px)` : undefined,
      }}
    >
      {panels.map((panel, i) => {
        const Primitive = getPrimitive(panel.element);
        if (!Primitive) return <div key={i} style={{ flex: 1, position: "relative" }} />;

        // Staggered entrance: panel i's content is delayed an extra `i * STAGGER` frames beyond
        // whatever delay the panel's own props/enter specify.
        const STAGGER = 8;
        const panelDelay = STAGGER * i;
        const slideFrom = direction === "row" ? (i === 0 ? -1 : 1) : i === 0 ? -1 : 1;
        const panelP = spring({ frame: frame - panelDelay, fps, config: { damping: 16, mass: 0.8 } });
        const translate = interpolate(panelP, [0, 1], [slideFrom * 24, 0]);
        const panelOpacity = panelP;

        return (
          <div
            key={i}
            style={{
              flex: 1,
              position: "relative",
              overflow: "hidden",
              opacity: panelOpacity,
              transform: direction === "row" ? `translateX(${translate}px)` : `translateY(${translate}px)`,
            }}
          >
            <Primitive
              props={panel.props ?? {}}
              frame={Math.max(0, frame - panelDelay)}
              fps={fps}
              width={width / (direction === "row" ? 2 : 1)}
              height={height / (direction === "column" ? 2 : 1)}
              opacity={1}
              blur={0}
              position={{ x: 0.5, y: 0.5 }}
              style={panel.style}
            />
          </div>
        );
      })}

      {/* Thin hairline divider between the two panels — grows in with the group entrance. */}
      <div
        style={{
          position: "absolute",
          left: direction === "row" ? "50%" : 0,
          top: direction === "row" ? 0 : "50%",
          width: direction === "row" ? 1 : `${dividerGrow * 100}%`,
          height: direction === "row" ? `${dividerGrow * 100}%` : 1,
          background: dividerColor,
          boxShadow: `0 0 12px ${dividerColor}`,
          transform: direction === "row" ? "translateX(-0.5px)" : "translateY(-0.5px)",
        }}
      />
    </div>
  );
};
