// Pure clip-mutation helpers. Ported from Models/Timeline.swift (Clip extension) and
// Editor/ViewModel/EditorViewModel+ClipMutations.swift. These mutate a Clip in place;
// the engine snapshots the timeline before each committed action, so in-place is safe.

import type { AnimPair, Clip, Crop, Keyframe, KeyframeTrack, KeyframeValue } from "../model/types";
import { sampleTrack } from "../model/helpers";

type TrackKey =
  | "opacityTrack" | "positionTrack" | "scaleTrack" | "rotationTrack" | "cropTrack" | "volumeTrack";
const ALL_TRACK_KEYS: TrackKey[] = [
  "opacityTrack", "positionTrack", "scaleTrack", "rotationTrack", "cropTrack", "volumeTrack",
];

/** KeyframeTrack.upsert — keep frames sorted, replace same-frame (Keyframe.swift:18). */
export function upsertKeyframe<V extends KeyframeValue>(track: KeyframeTrack<V>, kf: Keyframe<V>): void {
  const i = track.keyframes.findIndex((k) => k.frame === kf.frame);
  if (i >= 0) {
    track.keyframes[i] = kf;
    return;
  }
  const at = track.keyframes.findIndex((k) => k.frame > kf.frame);
  if (at < 0) track.keyframes.push(kf);
  else track.keyframes.splice(at, 0, kf);
}

function clampTrack(
  track: KeyframeTrack<KeyframeValue> | undefined,
  duration: number,
): KeyframeTrack<KeyframeValue> | undefined {
  if (!track) return undefined;
  const out: KeyframeTrack<KeyframeValue> = { keyframes: [] };
  for (const kf of track.keyframes) {
    if (kf.frame >= 0 && kf.frame <= duration) upsertKeyframe(out, kf);
  }
  return out.keyframes.length ? out : undefined;
}

/** Clip.clampKeyframesToDuration — Timeline.swift:256. */
export function clampKeyframesToDuration(c: Clip): void {
  for (const k of ALL_TRACK_KEYS) {
    (c as unknown as Record<string, unknown>)[k] =clampTrack(c[k] as KeyframeTrack<KeyframeValue> | undefined, c.durationFrames);
  }
}

function rescaleTrack(
  track: KeyframeTrack<KeyframeValue> | undefined,
  scale: number,
): KeyframeTrack<KeyframeValue> | undefined {
  if (!track) return undefined;
  if (!Number.isFinite(scale) || scale <= 0) return track;
  const out: KeyframeTrack<KeyframeValue> = { keyframes: [] };
  for (const kf of track.keyframes) {
    upsertKeyframe(out, { ...kf, frame: Math.round(kf.frame * scale) });
  }
  return out.keyframes.length ? out : undefined;
}

/** Clip.rescaleKeyframes — Timeline.swift:265. */
export function rescaleKeyframes(c: Clip, scale: number): void {
  for (const k of ALL_TRACK_KEYS) {
    (c as unknown as Record<string, unknown>)[k] =rescaleTrack(c[k] as KeyframeTrack<KeyframeValue> | undefined, scale);
  }
}

/** Clip.clampFadesToDuration — Timeline.swift:302. */
export function clampFadesToDuration(c: Clip): void {
  c.fadeInFrames = Math.max(0, Math.min(c.fadeInFrames, c.durationFrames));
  c.fadeOutFrames = Math.max(0, Math.min(c.fadeOutFrames, c.durationFrames - c.fadeInFrames));
}

/** Clip.rescaleWordTimings — Timeline.swift:307. */
export function rescaleWordTimings(c: Clip, oldDuration: number): void {
  if (c.mediaType !== "text" || !c.wordTimings || oldDuration <= 0 || c.durationFrames <= 0) return;
  const scale = c.durationFrames / oldDuration;
  c.wordTimings = c.wordTimings.map((t) => {
    const start = Math.min(Math.max(0, Math.round(t.startFrame * scale)), Math.max(0, c.durationFrames - 1));
    const end = Math.min(Math.max(start + 1, Math.round(t.endFrame * scale)), c.durationFrames);
    return { text: t.text, startFrame: start, endFrame: end };
  });
}

/** Clip.setDuration — Timeline.swift:342. */
export function setClipDuration(c: Clip, newDuration: number): void {
  const old = c.durationFrames;
  c.durationFrames = newDuration;
  rescaleWordTimings(c, old);
  clampKeyframesToDuration(c);
  clampFadesToDuration(c);
}

export type TrimEdge = "left" | "right";

/**
 * EditorViewModel.trimValues — a project-frame edge drag of `delta` maps to a SOURCE-frame
 * trim change via speed: sourceDelta = round(delta * speed). Image/text are unbounded.
 * (Linking.swift:158.)
 */
export function trimValues(c: Clip, edge: TrimEdge, delta: number): { trimStart: number; trimEnd: number } {
  const sourceDelta = Math.round(delta * c.speed);
  const unbounded = c.mediaType === "image" || c.mediaType === "text";
  if (edge === "left") {
    const newStart = c.trimStartFrame + sourceDelta;
    return { trimStart: unbounded ? newStart : Math.max(0, newStart), trimEnd: c.trimEndFrame };
  }
  const newEnd = c.trimEndFrame - sourceDelta;
  return { trimStart: c.trimStartFrame, trimEnd: unbounded ? newEnd : Math.max(0, newEnd) };
}

/** Fallback per-property value used when splitting a keyframe track. */
function trackFallback(key: TrackKey, c: Clip): KeyframeValue {
  switch (key) {
    case "opacityTrack": return c.opacity;
    case "volumeTrack": return 0; // dB
    case "positionTrack": return { a: 0, b: 0 } satisfies AnimPair;
    case "scaleTrack": return { a: 1, b: 1 } satisfies AnimPair;
    case "rotationTrack": return 0;
    case "cropTrack": return c.crop;
  }
}

/**
 * Split every animatable track at the cut, keeping each side continuous with a boundary
 * keyframe and rebasing the right side to clip-relative 0. Ported from
 * EditorViewModel+ClipMutations.swift:178 (splitKeyframeTrack).
 */
export function splitClipKeyframes(source: Clip, left: Clip, right: Clip, splitOffset: number): void {
  for (const key of ALL_TRACK_KEYS) {
    const [l, r] = splitOneTrack(source[key] as KeyframeTrack<KeyframeValue> | undefined, splitOffset, trackFallback(key, source));
    (left as unknown as Record<string, unknown>)[key] = l;
    (right as unknown as Record<string, unknown>)[key] = r;
  }
}

function splitOneTrack(
  track: KeyframeTrack<KeyframeValue> | undefined,
  splitOffset: number,
  fallback: KeyframeValue,
): [KeyframeTrack<KeyframeValue> | undefined, KeyframeTrack<KeyframeValue> | undefined] {
  if (!track || track.keyframes.length === 0) return [track, track];
  const boundary = sampleTrack(track, splitOffset, fallback);

  const leftKfs: Keyframe<KeyframeValue>[] = track.keyframes.filter((k) => k.frame <= splitOffset).map((k) => ({ ...k }));
  if (leftKfs.length === 0 || leftKfs[leftKfs.length - 1].frame !== splitOffset) {
    leftKfs.push({ frame: splitOffset, value: boundary, interpolationOut: "smooth" });
  }

  const rightKfs: Keyframe<KeyframeValue>[] = track.keyframes
    .filter((k) => k.frame >= splitOffset)
    .map((k) => ({ frame: k.frame - splitOffset, value: k.value, interpolationOut: k.interpolationOut }));
  if (rightKfs.length === 0 || rightKfs[0].frame !== 0) {
    const interp = [...track.keyframes].reverse().find((k) => k.frame < splitOffset)?.interpolationOut ?? "smooth";
    rightKfs.unshift({ frame: 0, value: boundary, interpolationOut: interp });
  }

  return [
    leftKfs.length ? { keyframes: leftKfs } : undefined,
    rightKfs.length ? { keyframes: rightKfs } : undefined,
  ];
}

export type { Crop };
