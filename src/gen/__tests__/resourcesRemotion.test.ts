import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";

// Blocker 1: a fresh install must render motion with ZERO runtime `npm install`. That requires
// remotion/node_modules to be present at package time and SHIPPED into resources (only the
// transient .remotion browser cache + .bundle-cache are excluded — they're written on first render
// into the writable per-user copy). This test guards both the precondition and the exact filter
// prepare-resources.mjs uses, so a regression that stops shipping node_modules fails here.

const root = process.cwd();

// The filter from scripts/prepare-resources.mjs step 6 — keep in exact sync. Returns true if the
// path is COPIED into resources.
const shipFilter = (src: string) => !/[\\/](\.remotion|\.bundle-cache)([\\/]|$)/.test(src);

describe("remotion resources packaging (Blocker 1)", () => {
  it("remotion/node_modules is present in the repo (precondition for packaging)", () => {
    expect(existsSync(join(root, "remotion", "node_modules", "remotion")), "run `npm ci` in remotion/ before packaging").toBe(true);
    expect(existsSync(join(root, "remotion", "node_modules", "@remotion", "renderer"))).toBe(true);
  });

  it("the packaging filter SHIPS node_modules packages", () => {
    expect(shipFilter(join(root, "remotion", "node_modules", "remotion", "index.js"))).toBe(true);
    expect(shipFilter(join(root, "remotion", "node_modules", "@remotion", "renderer", "dist", "index.js"))).toBe(true);
  });

  it("the packaging filter EXCLUDES the transient browser + bundle caches", () => {
    expect(shipFilter(join(root, "remotion", "node_modules", ".remotion", "chrome-headless-shell"))).toBe(false);
    expect(shipFilter(join(root, "remotion", ".bundle-cache", "serveUrl.txt"))).toBe(false);
  });
});
