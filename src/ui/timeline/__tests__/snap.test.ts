import { describe, it, expect } from "vitest";
import { collectTargets, findSnap, newSnapState } from "../snap";
import { defaultClip, defaultTrack } from "../../../model/defaults";
import type { Track } from "../../../model/types";

function trackWith(start: number, dur: number): Track {
  return { ...defaultTrack("video", "t"), clips: [defaultClip({ mediaRef: "m", startFrame: start, durationFrames: dur, id: "c" })] };
}

describe("SnapEngine (Timeline/SnapEngine.swift)", () => {
  it("collectTargets yields clip start + end edges, and the playhead when requested", () => {
    const targets = collectTargets([trackWith(0, 50)], { includePlayhead: true, playheadFrame: 120 });
    expect(targets).toContainEqual({ frame: 0, kind: "clipEdge" });
    expect(targets).toContainEqual({ frame: 50, kind: "clipEdge" });
    expect(targets).toContainEqual({ frame: 120, kind: "playhead" });
  });

  it("collectTargets skips excluded (dragged) clips", () => {
    const t = trackWith(10, 30);
    const targets = collectTargets([t], { excludeClipIds: new Set(["c"]) });
    expect(targets).toHaveLength(0);
  });

  it("snaps a probe to a nearby clip edge within the frame threshold", () => {
    // pixelsPerFrame 4 → base frame threshold = 8/4 = 2 frames.
    const targets = collectTargets([trackWith(100, 50)]);
    const state = newSnapState();
    const snap = findSnap({ position: 101, targets, state, pixelsPerFrame: 4 });
    expect(snap?.frame).toBe(100); // within 2 frames of the clip start
    expect(snap?.x).toBe(400);
  });

  it("does not snap when outside the threshold", () => {
    const targets = collectTargets([trackWith(100, 50)]);
    const state = newSnapState();
    expect(findSnap({ position: 108, targets, state, pixelsPerFrame: 4 })).toBeNull(); // 8 frames away > 2
  });

  it("playhead gets a wider (1.5×) threshold than clip edges", () => {
    const targets = collectTargets([], { includePlayhead: true, playheadFrame: 200 });
    const state = newSnapState();
    // 3 frames away: beyond clipEdge threshold (2) but within playhead threshold (2×1.5 = 3).
    expect(findSnap({ position: 203, targets, state, pixelsPerFrame: 4 })?.frame).toBe(200);
  });

  it("sticky: holds a snap until the probe moves past stickyMultiplier× threshold", () => {
    const targets = collectTargets([trackWith(100, 50)]);
    const state = newSnapState();
    findSnap({ position: 100, targets, state, pixelsPerFrame: 4 });
    expect(state.currentlySnappedTo).toBe(100);
    // hold threshold = 2 × 1.5 = 3 frames; position 102 is within → stays snapped.
    expect(findSnap({ position: 102, targets, state, pixelsPerFrame: 4 })?.frame).toBe(100);
  });
});
