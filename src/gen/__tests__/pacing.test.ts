import { describe, it, expect } from "vitest";
import { resolveEntranceTiming, ENTRANCE_COMPLETE_BY_FRACTION } from "../../../remotion/src/primitives/pacing";

// Proves the "hold/settle" engine fix (ENGINE-DEFECTS.md root cause B / task-10fix): a beat's
// content must spring in over the FIRST ~40-45% of the beat and then HOLD STILL for the rest — no
// authored delay may push an entrance's completion so late that motion smears across the whole
// beat. Asserted at the pure timing-helper level (no rendering/pixels needed) per the task brief.

/** Same conservative settle-time assumption `resolveEntranceTiming` itself uses internally, kept
 * here as an independent constant so this test doesn't just re-import the module's private number
 * — it re-derives the same value from the public contract (delay + assumed settle <= fraction). */
const ASSUMED_SETTLE_FRAMES = 20;

describe("resolveEntranceTiming (hold/settle pacing clamp)", () => {
  it("clamps a large authored delay so the entrance still completes within the first ~half of the beat", () => {
    // The exact motivating case from the task brief: delay:34 on a 60-frame beat. Unclamped, that
    // entrance wouldn't even START settling until 57% through the beat — motion smears across the
    // whole thing. The resolved delay's settle point (delay + assumed settle frames) must land at
    // or before ENTRANCE_COMPLETE_BY_FRACTION of the beat.
    const beatDuration = 60;
    const authoredDelay = 34;

    const resolved = resolveEntranceTiming(authoredDelay, beatDuration);

    expect(resolved).toBeLessThan(authoredDelay); // the clamp actually did something
    const settlePoint = resolved + ASSUMED_SETTLE_FRAMES;
    expect(settlePoint).toBeLessThanOrEqual(beatDuration * ENTRANCE_COMPLETE_BY_FRACTION + 0.001);
    // And concretely within "the first ~half" per the task's own phrasing.
    expect(settlePoint).toBeLessThanOrEqual(beatDuration * 0.5);
  });

  it("never lengthens a delay that already settles early — a snappy authored entrance is untouched", () => {
    const beatDuration = 90;
    const authoredDelay = 4; // settles at frame 24, well inside the first 45% of a 90-frame beat
    expect(resolveEntranceTiming(authoredDelay, beatDuration)).toBe(authoredDelay);
  });

  it("scales the clamp with beat duration — a longer beat allows a proportionally later delay", () => {
    const shortBeat = resolveEntranceTiming(34, 60);
    const longBeat = resolveEntranceTiming(34, 240);
    expect(longBeat).toBeGreaterThan(shortBeat);
    // The long beat is generous enough that delay:34 fits inside its own settle window untouched.
    expect(longBeat).toBe(34);
  });

  it("never returns a negative delay even for a very short beat or negative input", () => {
    expect(resolveEntranceTiming(34, 8)).toBeGreaterThanOrEqual(0);
    expect(resolveEntranceTiming(-5, 60)).toBeGreaterThanOrEqual(0);
  });

  it("treats non-finite/garbage inputs defensively rather than producing NaN", () => {
    expect(Number.isFinite(resolveEntranceTiming(Number.NaN, 60))).toBe(true);
    expect(Number.isFinite(resolveEntranceTiming(10, Number.NaN))).toBe(true);
    expect(Number.isFinite(resolveEntranceTiming(10, 0))).toBe(true);
  });
});
