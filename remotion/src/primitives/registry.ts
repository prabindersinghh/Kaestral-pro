import type { PrimitiveProps } from "./types";

// Indirection layer so nested-child primitives (SplitLayout/GridLayout) can look up a child
// element's renderer by name WITHOUT importing `./index.ts` directly (which would create a
// circular import: index.ts -> SplitLayout.tsx -> index.ts). `index.ts` calls `setRegistry` once,
// at module load, right after building the real REGISTRY map.
//
// This is purely a lookup indirection, NOT a way to run arbitrary code: `getPrimitive` only ever
// returns a component already present in the trusted REGISTRY built by index.ts from a fixed,
// hand-written import list — nested child `element` names are validated against the same closed
// `ELEMENTS` enum as top-level layers (src/gen/sceneSpec.ts), so a panel/cell's `element` is
// bounded data, never a free-form string used to synthesize a component.

let registry: Record<string, React.FC<PrimitiveProps>> = {};

export function setRegistry(r: Record<string, React.FC<PrimitiveProps>>): void {
  registry = r;
}

export function getPrimitive(element: string): React.FC<PrimitiveProps> | undefined {
  return registry[element];
}
