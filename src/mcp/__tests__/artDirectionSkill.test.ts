import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

describe("art-direction skill wiring", () => {
  it("SKILL.md exists and teaches principles (has the required sections)", () => {
    const p = join(root, "skills", "art-direction", "SKILL.md");
    expect(existsSync(p)).toBe(true);
    const t = readFileSync(p, "utf8").toLowerCase();
    for (const s of ["decision process", "trade-off", "physics", "optical", "rhythm", "restraint", "worked example", "failure"]) {
      expect(t, `missing section: ${s}`).toContain(s);
    }
  });

  it("is registered in catalog.json", () => {
    const cat = JSON.parse(readFileSync(join(root, "skills", "catalog.json"), "utf8"));
    const ids = JSON.stringify(cat);
    expect(ids).toContain("art-direction");
  });

  it("compose_motion tool description points to the art-direction skill", () => {
    const t = readFileSync(join(root, "src", "mcp", "toolDefs.ts"), "utf8");
    // find the compose_motion tool block and assert its description references the skill
    const idx = t.indexOf('name: "compose_motion"');
    expect(idx).toBeGreaterThan(-1);
    const block = t.slice(idx, idx + 4000);
    expect(block).toContain("art-direction");
  });

  it("SERVER_INSTRUCTIONS mentions reading the art-direction skill for motion work", () => {
    const t = readFileSync(join(root, "src", "mcp", "server.ts"), "utf8");
    expect(t).toContain("art-direction");
  });
});
