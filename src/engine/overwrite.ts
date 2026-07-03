// Ported from Editor/OverwriteEngine.swift — pure overlap resolution for a region.

import type { Clip } from "../model/types";
import { endFrame } from "../model/helpers";

export type OverwriteAction =
  | { kind: "remove"; clipId: string }
  | { kind: "trimEnd"; clipId: string; newDuration: number }
  | { kind: "trimStart"; clipId: string; newStartFrame: number; newTrimStart: number; newDuration: number }
  | {
      kind: "split";
      clipId: string;
      leftDuration: number;
      rightId: string;
      rightStartFrame: number;
      rightTrimStart: number;
      rightDuration: number;
    };

/** OverwriteEngine.computeOverwrite — actions to clear [regionStart, regionEnd). */
export function computeOverwrite(
  clips: Clip[],
  regionStart: number,
  regionEnd: number,
  makeId: () => string,
): OverwriteAction[] {
  if (regionEnd <= regionStart) return [];
  const actions: OverwriteAction[] = [];
  for (const clip of clips) {
    const cs = clip.startFrame;
    const ce = endFrame(clip);
    if (ce <= regionStart || cs >= regionEnd) continue;

    if (cs >= regionStart && ce <= regionEnd) {
      actions.push({ kind: "remove", clipId: clip.id });
    } else if (cs < regionStart && ce > regionEnd) {
      actions.push({
        kind: "split",
        clipId: clip.id,
        leftDuration: regionStart - cs,
        rightId: makeId(),
        rightStartFrame: regionEnd,
        rightTrimStart: clip.trimStartFrame + Math.round((regionEnd - cs) * clip.speed),
        rightDuration: ce - regionEnd,
      });
    } else if (cs < regionStart) {
      actions.push({ kind: "trimEnd", clipId: clip.id, newDuration: regionStart - cs });
    } else {
      actions.push({
        kind: "trimStart",
        clipId: clip.id,
        newStartFrame: regionEnd,
        newTrimStart: clip.trimStartFrame + Math.round((regionEnd - cs) * clip.speed),
        newDuration: ce - regionEnd,
      });
    }
  }
  return actions;
}
