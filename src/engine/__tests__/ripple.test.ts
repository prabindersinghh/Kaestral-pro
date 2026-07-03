import { describe, it, expect } from "vitest";
import { mergeRanges, computeRippleShiftsForRanges, computeRipplePush } from "../ripple";
import { computeOverwrite } from "../overwrite";
import { defaultClip } from "../../model/defaults";
import type { Clip } from "../../model/types";

function clip(id: string, start: number, dur: number, extra: Partial<Clip> = {}): Clip {
  return { ...defaultClip({ mediaRef: "m", startFrame: start, durationFrames: dur, id }), ...extra };
}

describe("RippleEngine (pure)", () => {
  it("mergeRanges merges overlapping and adjacent ranges", () => {
    expect(mergeRanges([{ start: 0, end: 10 }, { start: 10, end: 20 }])).toEqual([{ start: 0, end: 20 }]);
    expect(mergeRanges([{ start: 0, end: 5 }, { start: 3, end: 8 }])).toEqual([{ start: 0, end: 8 }]);
    expect(mergeRanges([{ start: 30, end: 40 }, { start: 0, end: 10 }])).toEqual([
      { start: 0, end: 10 }, { start: 30, end: 40 },
    ]);
  });

  it("computeRippleShiftsForRanges shifts by total length of ranges entirely before a clip", () => {
    const clips = [clip("a", 0, 10), clip("b", 20, 10), clip("c", 40, 10)];
    const shifts = computeRippleShiftsForRanges(clips, [{ start: 10, end: 20 }]);
    // a: nothing before → no shift; b,c: one 10-frame range before → -10
    expect(shifts).toEqual([
      { clipId: "b", newStartFrame: 10 },
      { clipId: "c", newStartFrame: 30 },
    ]);
  });

  it("computeRipplePush pushes clips at/after insertFrame", () => {
    const clips = [clip("a", 0, 10), clip("b", 20, 10)];
    expect(computeRipplePush(clips, 15, 100)).toEqual([{ clipId: "b", newStartFrame: 120 }]);
  });
});

describe("OverwriteEngine (pure)", () => {
  const idGen = () => "RIGHT";
  it("remove: clip fully inside region", () => {
    expect(computeOverwrite([clip("a", 10, 10)], 0, 40, idGen)).toEqual([{ kind: "remove", clipId: "a" }]);
  });
  it("trimEnd: clip overlaps left side of region", () => {
    expect(computeOverwrite([clip("a", 0, 30)], 20, 40, idGen)).toEqual([
      { kind: "trimEnd", clipId: "a", newDuration: 20 },
    ]);
  });
  it("trimStart: clip overlaps right side; trim in source frames via speed", () => {
    const [action] = computeOverwrite([clip("a", 10, 40, { speed: 2 })], 0, 30, idGen);
    expect(action).toEqual({
      kind: "trimStart", clipId: "a", newStartFrame: 30, newTrimStart: 40, newDuration: 20,
    });
  });
  it("split: clip straddles the whole region", () => {
    const [action] = computeOverwrite([clip("a", 0, 100)], 40, 60, idGen);
    expect(action).toMatchObject({ kind: "split", clipId: "a", leftDuration: 40, rightStartFrame: 60, rightDuration: 40 });
  });
});
