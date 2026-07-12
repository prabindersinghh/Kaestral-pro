import { spring } from "remotion";
import { useId, type ReactNode } from "react";

// clip-path only accepts a single basic-shape or a single SVG reference, so a multi-rect union
// (the logo mask's three bars) needs an actual SVG <clipPath> with multiple <rect> children rather
// than combining several `inset()` strings — CSS has no union operator for basic shapes. Each
// Mask instance gets a unique clipPath id (via React's `useId`) so multiple masked layers on the
// same beat don't clash.

// Mask/reveal wrapper — clips its child by `shape` and animates the reveal (`reveal`) with a
// spring, never a linear wipe. Used whenever a layer has `mask` set, or `enter.anim ===
// "maskReveal"` (Generative.tsx passes shape:"rect", reveal:"left" as the default in that case —
// see its wiring). The "logo" shape clips to the three-bar Kaestral mark silhouette (matches
// LogoMark.tsx's bar proportions) so a reveal-through-the-logo transition is possible.

export type MaskShape = "circle" | "pill" | "rect" | "logo" | "wipe";
export type MaskReveal = "left" | "up" | "iris" | "none";

export interface MaskProps {
  shape: MaskShape;
  reveal: MaskReveal;
  frame: number;
  fps: number;
  width: number;
  height: number;
  /** Local-frame delay before the reveal spring starts (mirrors `enter.delay` convention). */
  delay?: number;
  children: ReactNode;
}

/** Progress (0..1) of the reveal spring — overshoot-free (damping 18) since a mask edge
 * overshooting past 100% would clip nothing, which reads as a jarring pop rather than a settle. */
function revealProgress(frame: number, fps: number, delay: number): number {
  const local = frame - delay;
  return spring({ frame: local, fps, config: { damping: 18, mass: 0.8 } });
}

/**
 * Builds the `clipPath` for a given shape at reveal progress `p` (0 = fully hidden, 1 = fully
 * revealed) and `reveal` direction. `reveal:"none"` means the shape clips statically (no
 * animated reveal) — used when a layer just wants a permanent shaped mask, not a transition.
 * Returns `undefined` for `shape:"logo"`, which uses an SVG `<clipPath>` (multi-rect union isn't
 * expressible as a single CSS basic-shape) — see the `shape === "logo"` branch in `Mask` below.
 */
function clipPathFor(shape: MaskShape, reveal: MaskReveal, p: number, width: number, height: number): string | undefined {
  const prog = reveal === "none" ? 1 : Math.max(0, Math.min(1, p));

  if (shape === "circle" || shape === "pill") {
    // Iris-style reveal for circle/pill regardless of `reveal` direction, unless "left"/"up" is
    // explicitly requested (then treat like rect but rounded via border-radius on the wrapper,
    // handled by the caller — clipPath here just governs the iris case).
    if (reveal === "left") {
      const edge = prog * 100;
      return `inset(0 ${100 - edge}% 0 0)`;
    }
    if (reveal === "up") {
      const edge = prog * 100;
      return `inset(${100 - edge}% 0 0 0)`;
    }
    // "iris" or "none": grow a circle from the center out to cover the full frame.
    const maxR = Math.hypot(width, height) / 2;
    const r = maxR * prog;
    return `circle(${r}px at 50% 50%)`;
  }

  if (shape === "logo") return undefined;

  if (shape === "wipe") {
    // Diagonal wipe edge.
    const edge = prog * 140 - 20; // overshoot the frame bounds so the edge fully clears
    return `polygon(0 0, ${edge}% 0, ${edge - 15}% 100%, ${Math.max(0, edge - 30)}% 100%, 0 100%)`;
  }

  // "rect": plain directional reveal.
  if (reveal === "up") {
    const edge = prog * 100;
    return `inset(${100 - edge}% 0 0 0)`;
  }
  if (reveal === "iris") {
    const maxR = Math.hypot(width, height) / 2;
    const r = maxR * prog;
    return `circle(${r}px at 50% 50%)`;
  }
  // default / "left"
  const edge = prog * 100;
  return `inset(0 ${100 - edge}% 0 0)`;
}

/** Three-bar Kaestral mark layout, proportioned like LogoMark.tsx (bar widths 1/0.72/0.86,
 * stacked with gaps), expressed as fractions of a bounding box so it can scale to any frame size. */
const LOGO_BARS = [
  { w: 1, top: 0 },
  { w: 0.72, top: 0.36 },
  { w: 0.86, top: 0.72 },
] as const;
const LOGO_BAR_H = 0.24; // fraction of bounding box height per bar

export const Mask: React.FC<MaskProps> = ({ shape, reveal, frame, fps, width, height, delay = 0, children }) => {
  const p = revealProgress(frame, fps, delay);
  const reactId = useId();
  const clipId = `mask-logo-${reactId.replace(/[^a-zA-Z0-9]/g, "")}`;

  if (shape === "logo") {
    const prog = reveal === "none" ? 1 : Math.max(0, Math.min(1, p));
    // Bounding box for the mark: centered, ~46% of frame width, ~30% of frame height — large
    // enough to read clearly as the reveal shape without dominating the whole frame.
    const boxW = width * 0.46;
    const boxH = height * 0.3;
    const boxX = (width - boxW) / 2;
    const boxY = (height - boxH) / 2;

    return (
      <div style={{ position: "absolute", inset: 0 }}>
        <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
          <defs>
            <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
              {LOGO_BARS.map((bar, i) => {
                // Bar i reveals in sequence as `prog` advances 0->1 (bar i occupies
                // [i/3, (i+1)/3] of progress) — mirrors LogoMark's staggered bar entrance so the
                // reveal itself reads as "the mark assembling", stroke by stroke.
                const barProg = Math.max(0, Math.min(1, (prog - i / 3) * 3));
                if (barProg <= 0) return null;
                const rectW = boxW * bar.w * barProg;
                const rectH = boxH * LOGO_BAR_H;
                const rectY = boxY + boxH * bar.top;
                return <rect key={i} x={boxX} y={rectY} width={rectW} height={rectH} rx={rectH * 0.22} />;
              })}
            </clipPath>
          </defs>
        </svg>
        <div style={{ position: "absolute", inset: 0, clipPath: `url(#${clipId})`, WebkitClipPath: `url(#${clipId})` }}>
          {children}
        </div>
      </div>
    );
  }

  const clipPath = clipPathFor(shape, reveal, p, width, height);

  return (
    <div style={{ position: "absolute", inset: 0, clipPath, WebkitClipPath: clipPath }}>
      {children}
    </div>
  );
};

/** Convenience: is this reveal progress "mid-flight" (neither fully hidden nor fully shown)? Used
 * by callers/tests that want to sample a frame guaranteed to be mid-reveal. */
export function isMidReveal(frame: number, fps: number, delay = 0): boolean {
  const p = revealProgress(frame, fps, delay);
  return p > 0.05 && p < 0.95;
}
