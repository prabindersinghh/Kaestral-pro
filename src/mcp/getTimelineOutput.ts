// get_timeline output builder — the COMPACT, default-omitting form (SPEC §0.2, distinct
// from project.json). Ported from ToolExecutor+Timeline.swift:28 (getTimeline / compactTrack
// / compactClip / strippingDefaults / captionGroup).

import type { Timeline } from "../model/types";
import { encodeClip, encodeTimeline, type JsonObject } from "../model/codec";
import { defaultClip, defaultTextStyle } from "../model/defaults";
import { totalFrames } from "../model/helpers";

const TRACK_DEFAULTS: JsonObject = { muted: false, hidden: false, syncLocked: true };

// clipDefaults: a default clip WITH textStyle set, minus identity/fixed fields (so a default
// textStyle strips too). Matches ToolExecutor+Timeline.swift:65.
function clipDefaults(): JsonObject {
  const c = defaultClip({ mediaRef: "", startFrame: 0, durationFrames: 0 });
  c.textStyle = defaultTextStyle();
  const obj = encodeClip(c);
  for (const k of ["id", "mediaRef", "startFrame", "durationFrames", "sourceClipType"]) delete obj[k];
  return obj;
}
const CLIP_DEFAULTS = clipDefaults();

function isEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** strippingDefaults — remove keys equal to defaults; recurse into nested objects. */
function strippingDefaults(dict: JsonObject, defaults: JsonObject): JsonObject {
  const out: JsonObject = { ...dict };
  for (const [key, def] of Object.entries(defaults)) {
    if (!(key in out)) continue;
    const val = out[key];
    if (val && typeof val === "object" && !Array.isArray(val) && def && typeof def === "object" && !Array.isArray(def)) {
      const stripped = strippingDefaults(val as JsonObject, def as JsonObject);
      if (Object.keys(stripped).length === 0) delete out[key];
      else out[key] = stripped;
    } else if (isEqual(val, def)) {
      delete out[key];
    }
  }
  return out;
}

function compactClip(clip: JsonObject): JsonObject {
  const out: JsonObject = { ...clip };
  if (typeof out.sourceClipType === "string" && out.sourceClipType === out.mediaType) delete out.sourceClipType;
  if (out.mediaType === "text") {
    delete out.trimStartFrame;
    delete out.trimEndFrame;
  }
  return strippingDefaults(out, CLIP_DEFAULTS);
}

function intVal(v: unknown): number {
  return typeof v === "number" ? v : 0;
}

function captionGroup(gid: string, members: JsonObject[]): { group: JsonObject; deviants: JsonObject[] } {
  const rowKeys = new Set(["id", "startFrame", "durationFrames", "textContent", "captionGroupId"]);
  const counts = new Map<string, number>();
  let modalKey = "";
  let shared: JsonObject = {};
  const entries = members.map((clip) => {
    const residual: JsonObject = {};
    for (const [k, v] of Object.entries(clip)) if (!rowKeys.has(k)) residual[k] = v;
    if (residual.transform && typeof residual.transform === "object") {
      const t = { ...(residual.transform as JsonObject) };
      delete t.width;
      delete t.height;
      if (Object.keys(t).length === 0) delete residual.transform;
      else residual.transform = t;
    }
    const key = JSON.stringify(residual, Object.keys(residual).sort());
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if ((counts.get(key) ?? 0) > (counts.get(modalKey) ?? 0)) {
      modalKey = key;
      shared = residual;
    }
    return { clip, key };
  });

  const rows: unknown[][] = [];
  const deviants: JsonObject[] = [];
  let frameMin = Number.MAX_SAFE_INTEGER;
  let frameMax = 0;
  for (const { clip, key } of entries) {
    const start = intVal(clip.startFrame);
    const end = start + intVal(clip.durationFrames);
    frameMin = Math.min(frameMin, start);
    frameMax = Math.max(frameMax, end);
    if (key === modalKey) rows.push([clip.id ?? "", start, end - start, clip.textContent ?? ""]);
    else deviants.push(clip);
  }
  rows.sort((a, b) => intVal(a[1]) - intVal(b[1]));
  const group: JsonObject = {
    captionGroupId: gid,
    clipCount: rows.length + deviants.length,
    frameRange: [frameMin === Number.MAX_SAFE_INTEGER ? 0 : frameMin, frameMax],
    clipFormat: ["clipId", "startFrame", "durationFrames", "text"],
    clips: rows,
  };
  if (Object.keys(shared).length) group.shared = shared;
  return { group, deviants };
}

function compactTrack(track: JsonObject, label: string): JsonObject {
  const out = strippingDefaults(track, TRACK_DEFAULTS);
  out.label = label;
  const rawClips = Array.isArray(track.clips) ? (track.clips as JsonObject[]) : [];
  const compacted = rawClips.map(compactClip);

  const loose: JsonObject[] = [];
  const groupOrder: string[] = [];
  const grouped = new Map<string, JsonObject[]>();
  for (const clip of compacted) {
    const gid = clip.captionGroupId;
    if (typeof gid === "string") {
      if (!grouped.has(gid)) groupOrder.push(gid);
      grouped.set(gid, [...(grouped.get(gid) ?? []), clip]);
    } else {
      loose.push(clip);
    }
  }
  const groups: JsonObject[] = [];
  for (const gid of groupOrder) {
    const { group, deviants } = captionGroup(gid, grouped.get(gid) ?? []);
    groups.push(group);
    loose.push(...deviants);
  }
  loose.sort((a, b) => intVal(a.startFrame) - intVal(b.startFrame));
  out.clips = loose;
  if (groups.length) out.captionGroups = groups;
  return out;
}

/** Round floats to 3 places (roundJSONFloatingPointNumbers). */
function round3(v: unknown): unknown {
  if (typeof v === "number") return Number.isInteger(v) ? v : Math.round(v * 1000) / 1000;
  if (Array.isArray(v)) return v.map(round3);
  if (v && typeof v === "object") {
    const o: JsonObject = {};
    for (const [k, x] of Object.entries(v as JsonObject)) o[k] = round3(x);
    return o;
  }
  return v;
}

export interface GetTimelineOptions {
  startFrame?: number;
  endFrame?: number;
  currentFrame?: number;
  canGenerate: boolean;
  trackLabel: (index: number) => string;
}

export function buildGetTimelineOutput(timeline: Timeline, opts: GetTimelineOptions): JsonObject {
  const dict = encodeTimeline(timeline) as JsonObject;
  const tracks = (dict.tracks as JsonObject[]).map((t, i) => compactTrack(t, opts.trackLabel(i)));
  dict.tracks = tracks;
  dict.totalFrames = totalFrames(timeline.tracks);
  dict.currentFrame = opts.currentFrame ?? 0;
  dict.canGenerate = opts.canGenerate;
  if (opts.startFrame != null || opts.endFrame != null) {
    const s = opts.startFrame ?? 0;
    const e = opts.endFrame ?? Number.MAX_SAFE_INTEGER;
    dict.window = [s, Math.min(e, totalFrames(timeline.tracks))];
  }
  return round3(dict) as JsonObject;
}
