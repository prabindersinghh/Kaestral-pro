import { describe, it, expect } from "vitest";

import { encodeClip, encodeTrack, encodeTimeline } from "../codec";
import { decodeManifestEntry, encodeManifestEntry } from "../media";
import { defaultClip, defaultTrack, defaultTimeline } from "../defaults";
import type { BlendMode } from "../enums";

// SPEC §0.2 (FROZEN): every non-optional field is ALWAYS written; an optional is
// written ONLY when present. This is the assertion that makes the gate a real rule,
// not just a fixture round-trip.

const NON_OPTIONAL_CLIP_KEYS = [
  "id", "mediaRef", "mediaType", "sourceClipType", "startFrame", "durationFrames",
  "trimStartFrame", "trimEndFrame", "speed", "volume", "fadeInFrames", "fadeOutFrames",
  "fadeInInterpolation", "fadeOutInterpolation", "opacity", "transform", "crop",
];
const OPTIONAL_CLIP_KEYS = [
  "linkGroupId", "captionGroupId", "textContent", "textStyle", "textAnimation", "wordTimings",
  "opacityTrack", "positionTrack", "scaleTrack", "rotationTrack", "cropTrack", "volumeTrack",
  "effects", "blendMode",
];

describe("Stage-A gate (b): writer emits every non-optional, omits only nil optionals", () => {
  it("a default clip serializes exactly the 17 non-optional keys (defaults included)", () => {
    const o = encodeClip(defaultClip({ mediaRef: "m", startFrame: 0, durationFrames: 30 }));
    expect(Object.keys(o).sort()).toEqual([...NON_OPTIONAL_CLIP_KEYS].sort());
    // default-valued non-optionals are present, not dropped:
    expect(o.speed).toBe(1);
    expect(o.volume).toBe(1);
    expect(o.opacity).toBe(1);
    expect(o.trimStartFrame).toBe(0);
    expect(o.fadeInInterpolation).toBe("linear");
    // none of the optionals leaked in:
    for (const k of OPTIONAL_CLIP_KEYS) expect(o).not.toHaveProperty(k);
  });

  it("Transform always writes all 7 fields; Crop all 4 (even at identity)", () => {
    const o = encodeClip(defaultClip({ mediaRef: "m", startFrame: 0, durationFrames: 30 })) as any;
    expect(Object.keys(o.transform).sort()).toEqual(
      ["centerX", "centerY", "width", "height", "rotation", "flipHorizontal", "flipVertical"].sort(),
    );
    expect(Object.keys(o.crop).sort()).toEqual(["left", "top", "right", "bottom"].sort());
  });

  it("present optionals are written; nil ones stay absent", () => {
    const clip = defaultClip({ mediaRef: "m", startFrame: 0, durationFrames: 30 });
    clip.linkGroupId = "g1";
    clip.blendMode = "screen" satisfies BlendMode;
    const o = encodeClip(clip);
    expect(o.linkGroupId).toBe("g1");
    expect(o.blendMode).toBe("screen");
    // still nil:
    expect(o).not.toHaveProperty("captionGroupId");
    expect(o).not.toHaveProperty("opacityTrack");
  });

  it("Track serializes exactly 6 keys and never includes displayHeight", () => {
    const o = encodeTrack(defaultTrack("video"));
    expect(Object.keys(o).sort()).toEqual(["id", "type", "muted", "hidden", "syncLocked", "clips"].sort());
    expect(o).not.toHaveProperty("displayHeight");
    expect(o.syncLocked).toBe(true); // default TRUE, present
  });

  it("Timeline serializes exactly 5 keys and never includes totalFrames", () => {
    const o = encodeTimeline(defaultTimeline());
    expect(Object.keys(o).sort()).toEqual(["fps", "width", "height", "settingsConfigured", "tracks"].sort());
    expect(o).not.toHaveProperty("totalFrames");
  });

  it("MediaSource encodes the exact Swift enum-with-associated-value shape", () => {
    const ext = encodeManifestEntry(
      decodeManifestEntry({
        id: "a", name: "A", type: "video",
        source: { external: { absolutePath: "/abs/x.mp4" } }, duration: 1,
      }),
    );
    expect(ext.source).toEqual({ external: { absolutePath: "/abs/x.mp4" } });

    const proj = encodeManifestEntry(
      decodeManifestEntry({
        id: "b", name: "B", type: "image",
        source: { project: { relativePath: "media/y.png" } }, duration: 0,
      }),
    );
    expect(proj.source).toEqual({ project: { relativePath: "media/y.png" } });
  });
});
