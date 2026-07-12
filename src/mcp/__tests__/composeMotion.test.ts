import { describe, it, expect } from "vitest";
import { McpExecutor } from "../executor";

describe("compose_motion", () => {
  it("rejects an invalid spec loudly without rendering", async () => {
    const exec = new McpExecutor();
    const res = await exec.execute("compose_motion", { spec: { meta: { aspect: "16:9", fps: 30 }, beats: [] } });
    expect(res.isError).toBe(true);
    expect(String(res.content?.[0]?.text)).toMatch(/beats/);
  });

  it("renders a valid spec and reports engine=generative, fallback=false", async () => {
    const exec = new McpExecutor();
    const spec = {
      meta: { aspect: "16:9", fps: 30 },
      beats: [{ durationInFrames: 24, layers: [{ element: "text", props: { text: "Hi" }, enter: { anim: "spring" } }] }],
    };
    const res = await exec.execute("compose_motion", { spec, place: false });
    expect(res.isError).toBeFalsy();
    const j = JSON.parse(String(res.content?.[0]?.text));
    expect(j.engine).toBe("generative");
    expect(j.fallback).toBe(false);
  }, 240000);
});
