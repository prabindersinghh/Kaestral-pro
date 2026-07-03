import { describe, it, expect } from "vitest";

import {
  endFrame, sourceFramesConsumed, sourceDurationFrames, containsFrame,
  sampleTrack, fadeMultiplier, timelineFrameForSourceSeconds, smoothstep,
} from "../helpers";
import { decodeTimeline, decodeTrack, decodeClip, decodeTransform } from "../codec";
import { decodeManifest } from "../media";
import { defaultClip } from "../defaults";
import type { KeyframeTrack } from "../types";

describe("clip invariants (Timeline.swift)", () => {
  it("endFrame, sourceFramesConsumed, sourceDurationFrames", () => {
    const c = defaultClip({ mediaRef: "m", startFrame: 10, durationFrames: 60 });
    c.speed = 1.5;
    c.trimStartFrame = 12;
    c.trimEndFrame = 6;
    expect(endFrame(c)).toBe(70);
    expect(sourceFramesConsumed(c)).toBe(90); // round(60 * 1.5)
    expect(sourceDurationFrames(c)).toBe(90 + 12 + 6);
    expect(containsFrame(c, 10)).toBe(true);
    expect(containsFrame(c, 70)).toBe(false);
  });

  it("fadeMultiplier ramps in and out, smooth uses smoothstep", () => {
    const c = defaultClip({ mediaRef: "m", startFrame: 0, durationFrames: 100 });
    c.fadeInFrames = 10;
    c.fadeOutFrames = 10;
    c.fadeInInterpolation = "linear";
    expect(fadeMultiplier(c, 0)).toBeCloseTo(0);
    expect(fadeMultiplier(c, 5)).toBeCloseTo(0.5);
    expect(fadeMultiplier(c, 50)).toBeCloseTo(1);
    expect(fadeMultiplier(c, 95)).toBeCloseTo(0.5);
    expect(fadeMultiplier(c, -1)).toBe(0);
    c.fadeInInterpolation = "smooth";
    expect(fadeMultiplier(c, 5)).toBeCloseTo(smoothstep(0.5));
  });

  it("timelineFrameForSourceSeconds maps through trim and speed, null outside range", () => {
    const c = defaultClip({ mediaRef: "m", startFrame: 100, durationFrames: 100 });
    c.trimStartFrame = 0;
    c.speed = 1;
    expect(timelineFrameForSourceSeconds(c, 0, 30)).toBe(100);
    expect(timelineFrameForSourceSeconds(c, 1, 30)).toBe(130);
    expect(timelineFrameForSourceSeconds(c, 1000, 30)).toBeNull();
  });
});

describe("keyframe sampling (Keyframe.swift:231)", () => {
  const track: KeyframeTrack<number> = {
    keyframes: [
      { frame: 0, value: 0, interpolationOut: "linear" },
      { frame: 10, value: 10, interpolationOut: "hold" },
      { frame: 20, value: 20, interpolationOut: "smooth" },
    ],
  };

  it("flat before first and after last", () => {
    expect(sampleTrack(track, -5, 99)).toBe(0);
    expect(sampleTrack(track, 100, 99)).toBe(20);
  });

  it("linear segment", () => {
    expect(sampleTrack(track, 5, 99)).toBeCloseTo(5);
  });

  it("hold segment returns the left value", () => {
    expect(sampleTrack(track, 15, 99)).toBe(10);
  });

  it("single keyframe is constant; empty uses fallback", () => {
    expect(sampleTrack({ keyframes: [{ frame: 3, value: 7, interpolationOut: "smooth" }] }, 99, 1)).toBe(7);
    expect(sampleTrack({ keyframes: [] }, 5, 42)).toBe(42);
  });
});

// Tolerant-decode parity with Tests/PalmierProTests/Media/ProjectRoundTripTests.swift.
describe("tolerant decode (legacy / missing fields)", () => {
  it("track missing muted/hidden/syncLocked → false/false/true", () => {
    const t = decodeTrack({ id: "t1", type: "video", label: "V1", clips: [] });
    expect(t.muted).toBe(false);
    expect(t.hidden).toBe(false);
    expect(t.syncLocked).toBe(true);
  });

  it("clip with only required fields → all defaults filled", () => {
    const c = decodeClip({ id: "c1", mediaRef: "media-1", startFrame: 0, durationFrames: 30 });
    expect(c.speed).toBe(1);
    expect(c.volume).toBe(1);
    expect(c.opacity).toBe(1);
    expect(c.fadeInFrames).toBe(0);
    expect(c.fadeInInterpolation).toBe("linear");
    expect(c.linkGroupId).toBeUndefined();
    expect(c.textContent).toBeUndefined();
  });

  it("transform legacy x/y migrates to a non-default center", () => {
    const t = decodeTransform({ x: 0.1, y: 0.2, width: 0.4, height: 0.3 });
    expect(t.width).toBe(0.4);
    expect(t.height).toBe(0.3);
    expect(t.centerX !== 0.5 || t.centerY !== 0.5).toBe(true);
  });

  it("manifest missing version → 1; empty doc → empty arrays", () => {
    expect(decodeManifest({ entries: [], folders: [] }).version).toBe(1);
    const empty = decodeManifest({});
    expect(empty.entries).toEqual([]);
    expect(empty.folders).toEqual([]);
  });

  it("timeline missing fields → struct defaults", () => {
    const tl = decodeTimeline({});
    expect(tl.fps).toBe(30);
    expect(tl.width).toBe(1920);
    expect(tl.height).toBe(1080);
    expect(tl.settingsConfigured).toBe(false);
    expect(tl.tracks).toEqual([]);
  });
});
