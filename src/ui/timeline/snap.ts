// Timeline snapping. Ported from Timeline/SnapEngine.swift. Sticky behavior + playhead priority.

import { theme } from "../theme";
import { endFrame } from "../../model/helpers";
import type { Track } from "../../model/types";

export type SnapKind = "playhead" | "clipEdge";
export interface SnapTarget { frame: number; kind: SnapKind }
export interface SnapResult { frame: number; probeOffset: number; x: number }
export interface SnapState { currentlySnappedTo: number | null; currentProbeOffset: number }

export function newSnapState(): SnapState {
  return { currentlySnappedTo: null, currentProbeOffset: 0 };
}

export function collectTargets(
  tracks: Track[],
  opts: { playheadFrame?: number; excludeClipIds?: Set<string>; includePlayhead?: boolean } = {},
): SnapTarget[] {
  const { playheadFrame = 0, excludeClipIds = new Set<string>(), includePlayhead = false } = opts;
  const targets: SnapTarget[] = [];
  if (includePlayhead) targets.push({ frame: playheadFrame, kind: "playhead" });
  for (const track of tracks) {
    for (const clip of track.clips) {
      if (excludeClipIds.has(clip.id)) continue;
      targets.push({ frame: clip.startFrame, kind: "clipEdge" });
      targets.push({ frame: endFrame(clip), kind: "clipEdge" });
    }
  }
  return targets;
}

export function findSnap(args: {
  position: number;
  probeOffsets?: number[];
  targets: SnapTarget[];
  state: SnapState;
  baseThreshold?: number;
  pixelsPerFrame: number;
}): SnapResult | null {
  const { position, probeOffsets = [0], targets, state, pixelsPerFrame } = args;
  const baseThreshold = args.baseThreshold ?? theme.snap.thresholdPixels;
  const baseFrameThreshold = baseThreshold / pixelsPerFrame;

  // Sticky: stay snapped until moved stickyMultiplier× threshold away.
  if (state.currentlySnappedTo !== null) {
    const holdThreshold = baseFrameThreshold * theme.snap.stickyMultiplier;
    const probePos = position + state.currentProbeOffset;
    if (Math.abs(probePos - state.currentlySnappedTo) <= holdThreshold &&
        targets.some((t) => t.frame === state.currentlySnappedTo)) {
      return { frame: state.currentlySnappedTo, probeOffset: state.currentProbeOffset, x: state.currentlySnappedTo * pixelsPerFrame };
    }
    state.currentlySnappedTo = null;
    state.currentProbeOffset = 0;
  }

  // Closest (probe, target) pair within threshold; playhead gets a wider threshold.
  let best: { probeOffset: number; target: SnapTarget; distance: number } | null = null;
  for (const probeOffset of probeOffsets) {
    const probePos = position + probeOffset;
    for (const target of targets) {
      const threshold = target.kind === "playhead"
        ? baseFrameThreshold * theme.snap.playheadMultiplier
        : baseFrameThreshold;
      const dist = Math.abs(probePos - target.frame);
      if (dist <= threshold && dist < (best?.distance ?? Infinity)) {
        best = { probeOffset, target, distance: dist };
      }
    }
  }
  if (!best) return null;
  state.currentlySnappedTo = best.target.frame;
  state.currentProbeOffset = best.probeOffset;
  return { frame: best.target.frame, probeOffset: best.probeOffset, x: best.target.frame * pixelsPerFrame };
}
