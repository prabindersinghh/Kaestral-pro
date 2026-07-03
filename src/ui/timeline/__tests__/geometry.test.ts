import { describe, it, expect } from "vitest";
import { TimelineGeometry, clampZoom } from "../geometry";
import { theme } from "../../theme";
import { defaultClip } from "../../../model/defaults";

const clip = (start: number, dur: number) => defaultClip({ mediaRef: "m", startFrame: start, durationFrames: dur });

describe("TimelineGeometry (Timeline/TimelineGeometry.swift)", () => {
  it("xForFrame / frameAt round-trip through headerWidth + pixelsPerFrame", () => {
    const g = new TimelineGeometry(4, [50, 50], 100);
    expect(g.xForFrame(0)).toBe(100);
    expect(g.xForFrame(10)).toBe(140); // 100 + 10*4
    expect(g.frameAt(140)).toBe(10);
    expect(g.frameAt(100)).toBe(0);
    expect(g.frameAt(0)).toBe(0); // clamped ≥ 0
  });

  it("cumulativeY starts at rulerHeight + dropZoneHeight and stacks track heights", () => {
    const g = new TimelineGeometry(4, [50, 40], 0);
    const top = theme.timeline.rulerHeight + theme.timeline.dropZoneHeight; // 24 + 60 = 84
    expect(g.trackY(0)).toBe(top);
    expect(g.trackY(1)).toBe(top + 50);
    expect(g.laneTop()).toBe(top);
    expect(g.laneBottom()).toBe(top + 50 + 40);
  });

  it("clipRect places x/width by frames and insets y/height by 2/4", () => {
    const g = new TimelineGeometry(4, [50], 100);
    const r = g.clipRect(clip(10, 25), 0);
    expect(r.x).toBe(100 + 10 * 4);
    expect(r.width).toBe(25 * 4);
    expect(r.y).toBe(g.trackY(0) + 2);
    expect(r.height).toBe(50 - 4);
  });

  it("trackAt maps a y to its lane", () => {
    const g = new TimelineGeometry(4, [50, 50], 0);
    expect(g.trackAt(g.trackY(0) + 5)).toBe(0);
    expect(g.trackAt(g.trackY(1) + 5)).toBe(1);
  });

  it("clampZoom respects the SPEC zoom range", () => {
    expect(clampZoom(1000)).toBe(theme.zoom.max);
    expect(clampZoom(0.0001)).toBe(theme.zoom.min);
    expect(clampZoom(4)).toBe(4);
  });
});
