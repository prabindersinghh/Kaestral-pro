import { describe, it, expect } from "vitest";
import { generate, DEFAULT_MODELS, falInput } from "../hosted";

describe("hosted generation", () => {
  it("refuses without a key (no network call)", async () => {
    await expect(generate({ provider: "fal", apiKey: "", videoModel: "m", imageModel: "m" }, "video", "x"))
      .rejects.toThrow(/No generation API key/);
  });

  it("defaults to the current models (Fal LTX-2.3, FLUX; Replicate ltx-video)", () => {
    expect(DEFAULT_MODELS.fal.video).toBe("fal-ai/ltx-2.3/text-to-video/fast");
    expect(DEFAULT_MODELS.fal.image).toContain("flux");
    expect(DEFAULT_MODELS.replicate.video).toContain("ltx");
  });
});

describe("falInput — correct schema per model family", () => {
  it("LTX-2.3 video uses `duration` (seconds enum), not num_frames", () => {
    const i = falInput("fal-ai/ltx-2.3/text-to-video/fast", "video", "x", { durationSeconds: 7, aspectRatio: "9:16" });
    expect(i).toMatchObject({ duration: 8, resolution: "1080p", aspect_ratio: "9:16" });
    expect(i.num_frames).toBeUndefined();
  });
  it("legacy ltxv-13b video uses num_frames", () => {
    const i = falInput("fal-ai/ltxv-13b-098-distilled", "video", "x", { durationSeconds: 5 });
    expect(i.num_frames).toBe(120);
    expect(i.duration).toBeUndefined();
  });
  it("FLUX image uses image_size, not aspect_ratio", () => {
    const i = falInput("fal-ai/flux/schnell", "image", "x", { aspectRatio: "9:16" });
    expect(i.image_size).toBe("portrait_16_9");
    expect(i.aspect_ratio).toBeUndefined();
  });
});
