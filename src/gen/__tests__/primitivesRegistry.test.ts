import { describe, it, expect } from "vitest";
import { ELEMENTS } from "../sceneSpec";
import { REGISTRY } from "../../../remotion/src/primitives/index";

describe("primitive registry", () => {
  it("has an entry for every SceneSpec element", () => {
    for (const el of ELEMENTS) expect(REGISTRY[el], `missing primitive: ${el}`).toBeTypeOf("function");
  });
});
