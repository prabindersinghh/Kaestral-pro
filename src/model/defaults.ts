// Default factories. Values trace to Models/* (see golden-fixtures.notes.md).

import type {
  Clip, Crop, RGBA, TextFill, TextShadow, TextStyle, Timeline, Track, Transform,
} from "./types";
import type { ClipType } from "./enums";

export function newId(): string {
  return crypto.randomUUID();
}

/** Transform() — Timeline.swift:389-395 */
export function defaultTransform(): Transform {
  return {
    centerX: 0.5, centerY: 0.5, width: 1, height: 1,
    rotation: 0, flipHorizontal: false, flipVertical: false,
  };
}

/** Crop() — Timeline.swift:526-529 */
export function defaultCrop(): Crop {
  return { left: 0, top: 0, right: 0, bottom: 0 };
}

/** RGBA() — TextStyle.swift:25 (all components default 1) */
export function rgba(r = 1, g = 1, b = 1, a = 1): RGBA {
  return { r, g, b, a };
}

/** Shadow() — TextStyle.swift:32-39 */
export function defaultTextShadow(): TextShadow {
  return { enabled: true, color: rgba(0, 0, 0, 0.6), offsetX: 0, offsetY: -2, blur: 6 };
}

/** TextStyle() — TextStyle.swift:8-17 */
export function defaultTextStyle(): TextStyle {
  return {
    fontName: "Helvetica-Bold",
    fontSize: 96,
    fontScale: 1,
    isBold: true,
    isItalic: false,
    color: rgba(),
    alignment: "center",
    shadow: defaultTextShadow(),
    background: { enabled: false, color: rgba(0, 0, 0, 0.6) } satisfies TextFill,
    border: { enabled: false, color: rgba(0, 0, 0, 1) } satisfies TextFill,
  };
}

/**
 * Clip with the same non-optional defaults as Swift's memberwise init
 * (Timeline.swift:75-95). All optional tracks/fields stay undefined.
 */
export function defaultClip(args: {
  mediaRef: string;
  startFrame: number;
  durationFrames: number;
  id?: string;
  mediaType?: ClipType;
  sourceClipType?: ClipType;
}): Clip {
  const mediaType = args.mediaType ?? "video";
  return {
    id: args.id ?? newId(),
    mediaRef: args.mediaRef,
    mediaType,
    sourceClipType: args.sourceClipType ?? mediaType,
    startFrame: args.startFrame,
    durationFrames: args.durationFrames,
    trimStartFrame: 0,
    trimEndFrame: 0,
    speed: 1,
    volume: 1,
    fadeInFrames: 0,
    fadeOutFrames: 0,
    fadeInInterpolation: "linear",
    fadeOutInterpolation: "linear",
    opacity: 1,
    transform: defaultTransform(),
    crop: defaultCrop(),
  };
}

/** Track(type:) — Timeline.swift:25-31 (syncLocked defaults TRUE). */
export function defaultTrack(type: ClipType, id?: string): Track {
  return {
    id: id ?? newId(),
    type,
    muted: false,
    hidden: false,
    syncLocked: true,
    clips: [],
  };
}

/** Timeline() — Timeline.swift:10-14 */
export function defaultTimeline(): Timeline {
  return { fps: 30, width: 1920, height: 1080, settingsConfigured: false, tracks: [] };
}
