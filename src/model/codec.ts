// Timeline (de)serialization. Enforces the FROZEN rule (SPEC §0.2):
//   - every non-optional field is ALWAYS written (even at its default)
//   - an optional is written ONLY when present (never null)
// Decoders are missing-key tolerant, mirroring Swift's `try?` fallback inits.

import {
  BLEND_MODES, INTERPOLATIONS, CLIP_TYPES, TEXT_ALIGNMENTS, TEXT_ANIMATION_PRESETS,
  type BlendMode, type ClipType, type Interpolation, type TextAlignment, type TextAnimationPreset,
} from "./enums";
import { defaultTextShadow, newId, rgba } from "./defaults";
import type {
  AnimPair, Clip, Crop, Effect, EffectParam, Keyframe, KeyframeTrack, KeyframeValue,
  RGBA, TextAnimation, TextFill, TextShadow, TextStyle, Timeline, Track, Transform, WordTiming,
} from "./types";

export type JsonObject = Record<string, unknown>;

// --- tolerant readers ---
const asNum = (v: unknown, d: number): number => (typeof v === "number" && Number.isFinite(v) ? v : d);
const asBool = (v: unknown, d: boolean): boolean => (typeof v === "boolean" ? v : d);
const asStr = (v: unknown, d: string): string => (typeof v === "string" ? v : d);
const asStrOpt = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
function asEnum<T extends string>(v: unknown, allowed: readonly T[], d: T): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : d;
}
function asEnumOpt<T extends string>(v: unknown, allowed: readonly T[]): T | undefined {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
}
const obj = (v: unknown): JsonObject => (v && typeof v === "object" && !Array.isArray(v) ? (v as JsonObject) : {});

/** Set `o[key] = value` only when value is present (the omit-if-nil half of §0.2). */
export function putOpt(o: JsonObject, key: string, value: unknown): void {
  if (value !== undefined && value !== null) o[key] = value;
}

// --- Transform / Crop ---

export function decodeTransform(v: unknown): Transform {
  const o = obj(v);
  const width = asNum(o.width, 1);
  const height = asNum(o.height, 1);
  // modern keys win; legacy x/y → center (Timeline.swift:443-466)
  let centerX = 0.5;
  if (typeof o.centerX === "number") centerX = o.centerX;
  else if (typeof o.x === "number") centerX = o.x + width - 0.5;
  let centerY = 0.5;
  if (typeof o.centerY === "number") centerY = o.centerY;
  else if (typeof o.y === "number") centerY = o.y + height - 0.5;
  return {
    centerX, centerY, width, height,
    rotation: asNum(o.rotation, 0),
    flipHorizontal: asBool(o.flipHorizontal, false),
    flipVertical: asBool(o.flipVertical, false),
  };
}

export function encodeTransform(t: Transform): JsonObject {
  return {
    centerX: t.centerX, centerY: t.centerY, width: t.width, height: t.height,
    rotation: t.rotation, flipHorizontal: t.flipHorizontal, flipVertical: t.flipVertical,
  };
}

export function decodeCrop(v: unknown): Crop {
  const o = obj(v);
  return { left: asNum(o.left, 0), top: asNum(o.top, 0), right: asNum(o.right, 0), bottom: asNum(o.bottom, 0) };
}

export function encodeCrop(c: Crop): JsonObject {
  return { left: c.left, top: c.top, right: c.right, bottom: c.bottom };
}

// --- Keyframes ---

const decPair = (v: unknown): AnimPair => {
  const o = obj(v);
  return { a: asNum(o.a, 0), b: asNum(o.b, 0) };
};
const encPair = (p: AnimPair): JsonObject => ({ a: p.a, b: p.b });

function decodeTrackOpt<V extends KeyframeValue>(
  v: unknown,
  decValue: (x: unknown) => V,
): KeyframeTrack<V> | undefined {
  if (v == null) return undefined;
  const o = obj(v);
  if (!Array.isArray(o.keyframes)) return undefined;
  const keyframes: Keyframe<V>[] = (o.keyframes as unknown[]).map((k) => {
    const ko = obj(k);
    return {
      frame: asNum(ko.frame, 0),
      value: decValue(ko.value),
      interpolationOut: asEnum<Interpolation>(ko.interpolationOut, INTERPOLATIONS, "smooth"),
    };
  });
  return { keyframes };
}

function encodeKfTrack<V extends KeyframeValue>(
  t: KeyframeTrack<V>,
  encValue: (v: V) => unknown,
): JsonObject {
  return {
    keyframes: t.keyframes.map((k) => ({
      frame: k.frame,
      value: encValue(k.value),
      interpolationOut: k.interpolationOut,
    })),
  };
}

const decNumberTrack = (v: unknown) => decodeTrackOpt<number>(v, (x) => asNum(x, 0));
const decPairTrack = (v: unknown) => decodeTrackOpt<AnimPair>(v, decPair);
const decCropTrack = (v: unknown) => decodeTrackOpt<Crop>(v, decodeCrop);
const encNumberTrack = (t: KeyframeTrack<number>) => encodeKfTrack(t, (x) => x);
const encPairTrack = (t: KeyframeTrack<AnimPair>) => encodeKfTrack(t, encPair);
const encCropTrack = (t: KeyframeTrack<Crop>) => encodeKfTrack(t, encodeCrop);

// --- Effects ---

export function decodeEffectParam(v: unknown): EffectParam {
  const o = obj(v);
  const p: EffectParam = {};
  if (typeof o.value === "number") p.value = o.value;
  if (typeof o.string === "string") p.string = o.string;
  const track = decNumberTrack(o.track);
  if (track) p.track = track;
  return p;
}

export function encodeEffectParam(p: EffectParam): JsonObject {
  const o: JsonObject = {};
  putOpt(o, "value", p.value);
  putOpt(o, "string", p.string);
  putOpt(o, "track", p.track ? encNumberTrack(p.track) : undefined);
  return o;
}

export function decodeEffect(v: unknown): Effect {
  const o = obj(v);
  const rawParams = obj(o.params);
  const params: Record<string, EffectParam> = {};
  for (const k of Object.keys(rawParams)) params[k] = decodeEffectParam(rawParams[k]);
  return {
    id: asStr(o.id, newId()),
    type: asStr(o.type, ""),
    enabled: asBool(o.enabled, true),
    params,
  };
}

export function encodeEffect(e: Effect): JsonObject {
  const params: JsonObject = {};
  for (const k of Object.keys(e.params)) params[k] = encodeEffectParam(e.params[k]);
  return { id: e.id, type: e.type, enabled: e.enabled, params };
}

// --- Text ---

function decodeRGBA(v: unknown, d: RGBA): RGBA {
  const o = obj(v);
  return { r: asNum(o.r, d.r), g: asNum(o.g, d.g), b: asNum(o.b, d.b), a: asNum(o.a, d.a) };
}
const encodeRGBA = (c: RGBA): JsonObject => ({ r: c.r, g: c.g, b: c.b, a: c.a });

function decodeShadow(v: unknown): TextShadow {
  const def = defaultTextShadow();
  if (v == null) return def;
  const o = obj(v);
  return {
    enabled: asBool(o.enabled, def.enabled),
    color: decodeRGBA(o.color, def.color),
    offsetX: asNum(o.offsetX, def.offsetX),
    offsetY: asNum(o.offsetY, def.offsetY),
    blur: asNum(o.blur, def.blur),
  };
}
const encodeShadow = (s: TextShadow): JsonObject => ({
  enabled: s.enabled, color: encodeRGBA(s.color), offsetX: s.offsetX, offsetY: s.offsetY, blur: s.blur,
});

function decodeFill(v: unknown, defColor: RGBA): TextFill {
  const o = obj(v);
  return { enabled: asBool(o.enabled, false), color: decodeRGBA(o.color, defColor) };
}
const encodeFill = (f: TextFill): JsonObject => ({ enabled: f.enabled, color: encodeRGBA(f.color) });

export function decodeTextStyle(v: unknown): TextStyle {
  const o = obj(v);
  return {
    fontName: asStr(o.fontName, "Helvetica-Bold"),
    fontSize: asNum(o.fontSize, 96),
    fontScale: asNum(o.fontScale, 1),
    isBold: asBool(o.isBold, true),
    isItalic: asBool(o.isItalic, false),
    color: decodeRGBA(o.color, rgba()),
    alignment: asEnum<TextAlignment>(o.alignment, TEXT_ALIGNMENTS, "center"),
    shadow: decodeShadow(o.shadow),
    background: decodeFill(o.background, rgba(0, 0, 0, 0.6)),
    border: decodeFill(o.border, rgba(0, 0, 0, 1)),
  };
}

export function encodeTextStyle(s: TextStyle): JsonObject {
  // CodingKeys order, all 10 always (TextStyle.swift:48).
  return {
    fontName: s.fontName,
    fontSize: s.fontSize,
    fontScale: s.fontScale,
    isBold: s.isBold,
    isItalic: s.isItalic,
    color: encodeRGBA(s.color),
    alignment: s.alignment,
    shadow: encodeShadow(s.shadow),
    background: encodeFill(s.background),
    border: encodeFill(s.border),
  };
}

export function decodeTextAnimation(v: unknown): TextAnimation {
  const o = obj(v);
  const anim: TextAnimation = {
    preset: asEnum<TextAnimationPreset>(o.preset, TEXT_ANIMATION_PRESETS, "none"),
    perWordFrames: asNum(o.perWordFrames, 6),
  };
  if (o.highlight != null) anim.highlight = decodeRGBA(o.highlight, rgba());
  return anim;
}

export function encodeTextAnimation(a: TextAnimation): JsonObject {
  const o: JsonObject = { preset: a.preset, perWordFrames: a.perWordFrames };
  putOpt(o, "highlight", a.highlight ? encodeRGBA(a.highlight) : undefined);
  return o;
}

function decodeWordTiming(v: unknown): WordTiming {
  const o = obj(v);
  return { text: asStr(o.text, ""), startFrame: asNum(o.startFrame, 0), endFrame: asNum(o.endFrame, 0) };
}
const encodeWordTiming = (w: WordTiming): JsonObject => ({
  text: w.text, startFrame: w.startFrame, endFrame: w.endFrame,
});

// --- Clip ---

export function decodeClip(v: unknown): Clip {
  const o = obj(v);
  const mediaType = asEnum<ClipType>(o.mediaType, CLIP_TYPES, "video");
  const c: Clip = {
    id: asStr(o.id, newId()),
    mediaRef: asStr(o.mediaRef, ""),
    mediaType,
    sourceClipType: asEnum<ClipType>(o.sourceClipType, CLIP_TYPES, "video"),
    startFrame: asNum(o.startFrame, 0),
    durationFrames: asNum(o.durationFrames, 0),
    trimStartFrame: asNum(o.trimStartFrame, 0),
    trimEndFrame: asNum(o.trimEndFrame, 0),
    speed: asNum(o.speed, 1),
    volume: asNum(o.volume, 1),
    fadeInFrames: asNum(o.fadeInFrames, 0),
    fadeOutFrames: asNum(o.fadeOutFrames, 0),
    fadeInInterpolation: asEnum<Interpolation>(o.fadeInInterpolation, INTERPOLATIONS, "linear"),
    fadeOutInterpolation: asEnum<Interpolation>(o.fadeOutInterpolation, INTERPOLATIONS, "linear"),
    opacity: asNum(o.opacity, 1),
    transform: decodeTransform(o.transform),
    crop: decodeCrop(o.crop),
  };
  c.linkGroupId = asStrOpt(o.linkGroupId);
  c.captionGroupId = asStrOpt(o.captionGroupId);
  c.textContent = asStrOpt(o.textContent);
  if (o.textStyle != null) c.textStyle = decodeTextStyle(o.textStyle);
  if (o.textAnimation != null) c.textAnimation = decodeTextAnimation(o.textAnimation);
  if (Array.isArray(o.wordTimings)) c.wordTimings = (o.wordTimings as unknown[]).map(decodeWordTiming);
  c.opacityTrack = decNumberTrack(o.opacityTrack);
  c.positionTrack = decPairTrack(o.positionTrack);
  c.scaleTrack = decPairTrack(o.scaleTrack);
  c.rotationTrack = decNumberTrack(o.rotationTrack);
  c.cropTrack = decCropTrack(o.cropTrack);
  c.volumeTrack = decNumberTrack(o.volumeTrack);
  if (Array.isArray(o.effects)) c.effects = (o.effects as unknown[]).map(decodeEffect);
  c.blendMode = asEnumOpt<BlendMode>(o.blendMode, BLEND_MODES);
  return c;
}

export function encodeClip(c: Clip): JsonObject {
  const o: JsonObject = {
    id: c.id,
    mediaRef: c.mediaRef,
    mediaType: c.mediaType,
    sourceClipType: c.sourceClipType,
    startFrame: c.startFrame,
    durationFrames: c.durationFrames,
    trimStartFrame: c.trimStartFrame,
    trimEndFrame: c.trimEndFrame,
    speed: c.speed,
    volume: c.volume,
    fadeInFrames: c.fadeInFrames,
    fadeOutFrames: c.fadeOutFrames,
    fadeInInterpolation: c.fadeInInterpolation,
    fadeOutInterpolation: c.fadeOutInterpolation,
    opacity: c.opacity,
    transform: encodeTransform(c.transform),
    crop: encodeCrop(c.crop),
  };
  putOpt(o, "linkGroupId", c.linkGroupId);
  putOpt(o, "captionGroupId", c.captionGroupId);
  putOpt(o, "textContent", c.textContent);
  putOpt(o, "textStyle", c.textStyle ? encodeTextStyle(c.textStyle) : undefined);
  putOpt(o, "textAnimation", c.textAnimation ? encodeTextAnimation(c.textAnimation) : undefined);
  putOpt(o, "wordTimings", c.wordTimings ? c.wordTimings.map(encodeWordTiming) : undefined);
  putOpt(o, "opacityTrack", c.opacityTrack ? encNumberTrack(c.opacityTrack) : undefined);
  putOpt(o, "positionTrack", c.positionTrack ? encPairTrack(c.positionTrack) : undefined);
  putOpt(o, "scaleTrack", c.scaleTrack ? encPairTrack(c.scaleTrack) : undefined);
  putOpt(o, "rotationTrack", c.rotationTrack ? encNumberTrack(c.rotationTrack) : undefined);
  putOpt(o, "cropTrack", c.cropTrack ? encCropTrack(c.cropTrack) : undefined);
  putOpt(o, "volumeTrack", c.volumeTrack ? encNumberTrack(c.volumeTrack) : undefined);
  putOpt(o, "effects", c.effects ? c.effects.map(encodeEffect) : undefined);
  putOpt(o, "blendMode", c.blendMode);
  return o;
}

// --- Track / Timeline ---

export function decodeTrack(v: unknown): Track {
  const o = obj(v);
  return {
    id: asStr(o.id, newId()),
    type: asEnum<ClipType>(o.type, CLIP_TYPES, "video"),
    muted: asBool(o.muted, false),
    hidden: asBool(o.hidden, false),
    syncLocked: asBool(o.syncLocked, true),
    clips: Array.isArray(o.clips) ? (o.clips as unknown[]).map(decodeClip) : [],
  };
}

export function encodeTrack(t: Track): JsonObject {
  // CodingKeys: id,type,muted,hidden,syncLocked,clips — displayHeight excluded.
  return {
    id: t.id,
    type: t.type,
    muted: t.muted,
    hidden: t.hidden,
    syncLocked: t.syncLocked,
    clips: t.clips.map(encodeClip),
  };
}

export function decodeTimeline(v: unknown): Timeline {
  const o = obj(v);
  return {
    fps: asNum(o.fps, 30),
    width: asNum(o.width, 1920),
    height: asNum(o.height, 1080),
    settingsConfigured: asBool(o.settingsConfigured, false),
    tracks: Array.isArray(o.tracks) ? (o.tracks as unknown[]).map(decodeTrack) : [],
  };
}

export function encodeTimeline(t: Timeline): JsonObject {
  return {
    fps: t.fps,
    width: t.width,
    height: t.height,
    settingsConfigured: t.settingsConfigured,
    tracks: t.tracks.map(encodeTrack),
  };
}

// --- top-level JSON helpers (project.json) ---

export function parseTimeline(json: string): Timeline {
  return decodeTimeline(JSON.parse(json));
}

/** Compact, matching Swift's default JSONEncoder (no pretty-print). */
export function stringifyTimeline(t: Timeline): string {
  return JSON.stringify(encodeTimeline(t));
}
