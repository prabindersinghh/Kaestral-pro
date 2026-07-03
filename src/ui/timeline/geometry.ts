// Pure timeline layout math. Ported from Timeline/TimelineGeometry.swift. Used by rendering
// and hit-testing. `pixelsPerFrame` is the effective zoom (px per project frame).

import { theme } from "../theme";
import { endFrame } from "../../model/helpers";
import type { Clip } from "../../model/types";

export interface Rect { x: number; y: number; width: number; height: number }

export type TrackDropTarget = { kind: "existingTrack"; index: number } | { kind: "newTrackAt"; index: number };

export class TimelineGeometry {
  readonly cumulativeY: number[];

  constructor(
    readonly pixelsPerFrame: number,
    readonly trackHeights: number[],
    readonly headerWidth = 0,
    readonly rulerHeight = theme.timeline.rulerHeight,
    readonly dropZoneHeight = theme.timeline.dropZoneHeight,
  ) {
    const cum: number[] = [];
    let y = rulerHeight + dropZoneHeight;
    for (const h of trackHeights) {
      cum.push(y);
      y += h;
    }
    this.cumulativeY = cum;
  }

  get trackCount(): number {
    return this.trackHeights.length;
  }

  xForFrame(frame: number): number {
    return this.headerWidth + frame * this.pixelsPerFrame;
  }

  /** Frame at a pixel x (clamped ≥ 0). */
  frameAt(x: number): number {
    return Math.max(0, Math.floor((x - this.headerWidth) / this.pixelsPerFrame));
  }

  trackHeight(index: number): number {
    return this.trackHeights[index] ?? theme.timeline.trackHeight;
  }

  trackY(index: number): number {
    return this.cumulativeY[index] ?? this.rulerHeight;
  }

  clipRect(clip: Clip, trackIndex: number): Rect {
    const y = this.trackY(trackIndex);
    const h = this.trackHeight(trackIndex);
    return {
      x: this.headerWidth + clip.startFrame * this.pixelsPerFrame,
      y: y + 2,
      width: clip.durationFrames * this.pixelsPerFrame,
      height: h - 4,
    };
  }

  /** Track index at a pixel y (in the lane region). */
  trackAt(y: number): number {
    for (let i = 0; i < this.cumulativeY.length; i++) {
      if (y < this.cumulativeY[i] + this.trackHeights[i]) return i;
    }
    return Math.max(0, this.trackCount - 1);
  }

  /** Total content width in px for the current tracks (max endFrame). */
  contentWidth(tracks: { clips: Clip[] }[]): number {
    let maxFrame = 0;
    for (const t of tracks) for (const c of t.clips) maxFrame = Math.max(maxFrame, endFrame(c));
    return this.headerWidth + maxFrame * this.pixelsPerFrame;
  }

  laneTop(): number {
    return this.rulerHeight + this.dropZoneHeight;
  }

  laneBottom(): number {
    return this.cumulativeY.length > 0
      ? this.cumulativeY[this.cumulativeY.length - 1] + this.trackHeights[this.trackHeights.length - 1]
      : this.laneTop();
  }
}

/** Clamp a zoom (px/frame) to the allowed range. */
export function clampZoom(pixelsPerFrame: number): number {
  return Math.max(theme.zoom.min, Math.min(theme.zoom.max, pixelsPerFrame));
}
