// Ported from Editor/RippleEngine.swift — pure ripple math. Behavior parity.

import type { Clip } from "../model/types";
import { endFrame } from "../model/helpers";

/** A proposed new start frame for one clip. */
export interface ClipShift {
  clipId: string;
  newStartFrame: number;
}

/** Half-open [start, end) frame interval on a single track. */
export interface FrameRange {
  start: number;
  end: number;
}
export const rangeLength = (r: FrameRange): number => r.end - r.start;

/** RippleEngine.mergeRanges */
export function mergeRanges(ranges: FrameRange[]): FrameRange[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: FrameRange[] = [];
  for (const r of sorted) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) {
      merged[merged.length - 1] = { start: last.start, end: Math.max(last.end, r.end) };
    } else {
      merged.push({ ...r });
    }
  }
  return merged;
}

/** RippleEngine.computeRippleShiftsForRanges — shift clips left to close the gaps. */
export function computeRippleShiftsForRanges(clips: Clip[], removedRanges: FrameRange[]): ClipShift[] {
  const merged = mergeRanges(removedRanges);
  if (merged.length === 0) return [];
  const shifts: ClipShift[] = [];
  for (const clip of [...clips].sort((a, b) => a.startFrame - b.startFrame)) {
    const shift = merged
      .filter((r) => r.end <= clip.startFrame)
      .reduce((s, r) => s + rangeLength(r), 0);
    if (shift > 0) shifts.push({ clipId: clip.id, newStartFrame: clip.startFrame - shift });
  }
  return shifts;
}

/** RippleEngine.computeRippleShifts — remove clips by id, then close their gaps. */
export function computeRippleShifts(clips: Clip[], removedIds: Set<string>): ClipShift[] {
  const removedRanges = clips
    .filter((c) => removedIds.has(c.id))
    .map((c) => ({ start: c.startFrame, end: endFrame(c) }));
  return computeRippleShiftsForRanges(
    clips.filter((c) => !removedIds.has(c.id)),
    removedRanges,
  );
}

/** RippleEngine.computeRipplePush — push clips at/after insertFrame right by pushAmount. */
export function computeRipplePush(
  clips: Clip[],
  insertFrame: number,
  pushAmount: number,
  excludeIds: Set<string> = new Set(),
): ClipShift[] {
  return clips
    .filter((c) => !excludeIds.has(c.id) && c.startFrame >= insertFrame)
    .map((c) => ({ clipId: c.id, newStartFrame: c.startFrame + pushAmount }));
}
