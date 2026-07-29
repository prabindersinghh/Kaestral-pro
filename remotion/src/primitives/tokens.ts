// Brand tokens — single source of truth for the primitive layer. Mirrors
// `src/gen/sceneSpec.ts`'s BRAND_TOKENS (kept as a separate, standalone copy because the
// `remotion/` workspace does not depend on `src/`). Do NOT invent new colors here — every
// primitive must reuse exactly these values, proven in `remotion/src/compositions/HeroDemo.tsx`
// and `CondenseReel.tsx`.

export const TOKENS = {
  black: "#0b0a0d",
  green: "#16b16a",
  greenHi: "#1fce7e",
  gold: "rgba(201,162,39,0.55)",
  white: "rgba(255,255,255,0.10)",
  slate: "#484852",
  slate2: "#2b2931",
  ink: "#eaeaef",
  ink2: "rgba(255,255,255,0.55)",
  fontSans: "'Inter','Helvetica Neue',Arial,sans-serif",
  fontMono: "'SF Mono','Consolas','Menlo',monospace",
} as const;

export type TokenName = keyof typeof TOKENS;

const HEX_COLOR_RE = /^#([0-9a-f]{6})$/i;

/**
 * Resolves a role/token name (e.g. "green", "gold") to its hex/rgba value. Plain `#rrggbb` hex
 * colors pass through unchanged so agent-authored SceneSpec colors (validated elsewhere as
 * brand-token-or-hex) render correctly here too. Unknown non-hex names fall back to `ink`
 * (fail loud is enforced upstream in sceneSpec validation; this is a rendering-time resolver,
 * not a validator, so it degrades gracefully rather than throwing mid-render).
 */
export function tokenColor(x: string): string {
  if (typeof x === "string" && HEX_COLOR_RE.test(x)) return x;
  const known = TOKENS as Record<string, string>;
  if (typeof x === "string" && x in known) return known[x];
  return TOKENS.ink;
}

// Cinematic Reel pack — "NEVER a hardcoded hex" for palette-driven effects (orbs, shine sweep,
// strikethrough glow). When the scene authors `meta.palette`, every such effect cycles through
// those user colors; absent a palette, this falls back to a rotation of the EXISTING brand tokens
// (never a new invented color) so the effect still reads correctly on a spec that predates the
// palette field.
const FALLBACK_PALETTE: readonly string[] = [TOKENS.green, TOKENS.gold, TOKENS.greenHi];

/**
 * Resolves the `index`-th color of `palette` (wrapping around), or the `index`-th brand-token
 * fallback when `palette` is absent/empty. Each entry is itself resolved through `tokenColor` so a
 * palette of brand-token names OR `#rrggbb` hex strings (as validated by `checkColor` in
 * `src/gen/sceneSpec.ts`) both work identically.
 */
export function paletteColor(palette: readonly string[] | undefined, index = 0): string {
  const list = palette && palette.length > 0 ? palette : FALLBACK_PALETTE;
  const i = ((index % list.length) + list.length) % list.length;
  return tokenColor(list[i]);
}
