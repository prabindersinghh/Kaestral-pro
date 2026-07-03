// Data-model interfaces ported from Models/*. Field optionality mirrors Swift:
// a `?` property is a Swift Optional (omitted from JSON when nil); every other
// property is a non-optional that is ALWAYS serialized (SPEC §0.2).

import type {
  BlendMode, ClipType, Interpolation, TextAlignment, TextAnimationPreset,
} from "./enums";

// --- Geometry (Models/Timeline.swift) ---

/** Transform — custom encoder always writes all 7 fields (Timeline.swift:388,468). */
export interface Transform {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  rotation: number; // degrees, + = clockwise
  flipHorizontal: boolean;
  flipVertical: boolean;
}

/** Crop — edge insets in normalized source coords (Timeline.swift:525). */
export interface Crop {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

// --- Keyframes (Models/Keyframe.swift) ---

export interface AnimPair {
  a: number;
  b: number;
}

export type KeyframeValue = number | AnimPair | Crop;

export interface Keyframe<V extends KeyframeValue> {
  frame: number; // clip-relative
  value: V;
  interpolationOut: Interpolation; // default "smooth", always encoded (Keyframe.swift:10)
}

export interface KeyframeTrack<V extends KeyframeValue> {
  keyframes: Keyframe<V>[];
}

// --- Effects (Models/Effect.swift) ---

export interface EffectParam {
  value?: number;
  string?: string;
  track?: KeyframeTrack<number>;
}

export interface Effect {
  id: string;
  type: string;
  enabled: boolean; // default true, always encoded (Effect.swift:7)
  params: Record<string, EffectParam>; // always encoded ({} when empty)
}

// --- Text (Models/TextStyle.swift, TextAnimation.swift) ---

export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface TextShadow {
  enabled: boolean;
  color: RGBA;
  offsetX: number;
  offsetY: number;
  blur: number;
}

export interface TextFill {
  enabled: boolean;
  color: RGBA;
}

export interface TextStyle {
  fontName: string;
  fontSize: number;
  fontScale: number;
  isBold: boolean;
  isItalic: boolean;
  color: RGBA;
  alignment: TextAlignment;
  shadow: TextShadow;
  background: TextFill;
  border: TextFill;
}

export interface TextAnimation {
  preset: TextAnimationPreset;
  perWordFrames: number;
  highlight?: RGBA;
}

export interface WordTiming {
  text: string;
  startFrame: number;
  endFrame: number;
}

// --- Clip / Track / Timeline (Models/Timeline.swift) ---

export interface Clip {
  // non-optional (always serialized), in CodingKeys order:
  id: string;
  mediaRef: string;
  mediaType: ClipType;
  sourceClipType: ClipType;
  startFrame: number;
  durationFrames: number;
  trimStartFrame: number;
  trimEndFrame: number;
  speed: number;
  volume: number;
  fadeInFrames: number;
  fadeOutFrames: number;
  fadeInInterpolation: Interpolation;
  fadeOutInterpolation: Interpolation;
  opacity: number;
  transform: Transform;
  crop: Crop;
  // optional (omit when undefined):
  linkGroupId?: string;
  captionGroupId?: string;
  textContent?: string;
  textStyle?: TextStyle;
  textAnimation?: TextAnimation;
  wordTimings?: WordTiming[];
  opacityTrack?: KeyframeTrack<number>;
  positionTrack?: KeyframeTrack<AnimPair>;
  scaleTrack?: KeyframeTrack<AnimPair>;
  rotationTrack?: KeyframeTrack<number>;
  cropTrack?: KeyframeTrack<Crop>;
  volumeTrack?: KeyframeTrack<number>;
  effects?: Effect[];
  blendMode?: BlendMode;
}

export interface Track {
  id: string;
  type: ClipType;
  muted: boolean;
  hidden: boolean;
  syncLocked: boolean; // default TRUE (Timeline.swift:30)
  clips: Clip[];
  // NOTE: displayHeight is intentionally absent — not in CodingKeys, never serialized.
}

export interface Timeline {
  fps: number;
  width: number;
  height: number;
  settingsConfigured: boolean;
  tracks: Track[];
}
