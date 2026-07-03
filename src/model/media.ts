// media.json — MediaManifest (Models/MediaManifest.swift, MediaFolder.swift).
// Non-optional fields always written; optionals omit-if-nil (SPEC §0.2, §7).
// generationInput / importInput / date fields are preserved as opaque passthrough
// (the port never authors them) so they round-trip losslessly.

import { CLIP_TYPES, type ClipType } from "./enums";
import { putOpt, type JsonObject } from "./codec";

/** MediaSource — Swift enum-with-associated-value JSON shape (SPEC §7). */
export type MediaSource =
  | { kind: "external"; absolutePath: string }
  | { kind: "project"; relativePath: string };

export interface MediaFolder {
  id: string;
  name: string;
  parentFolderId?: string;
}

export interface MediaManifestEntry {
  id: string;
  name: string;
  type: ClipType;
  source: MediaSource;
  duration: number;
  // optionals (omit-if-nil); opaque ones are preserved verbatim:
  generationInput?: unknown;
  sourceWidth?: number;
  sourceHeight?: number;
  sourceFPS?: number;
  hasAudio?: boolean;
  folderId?: string;
  cachedRemoteURL?: string;
  cachedRemoteURLExpiresAt?: unknown; // Date — passthrough until a real file pins encoding
  generationStatus?: string;
  importInput?: unknown;
}

export interface MediaManifest {
  version: number;
  entries: MediaManifestEntry[];
  folders: MediaFolder[];
}

const asNum = (v: unknown, d: number): number => (typeof v === "number" && Number.isFinite(v) ? v : d);
const asStr = (v: unknown, d: string): string => (typeof v === "string" ? v : d);
const asStrOpt = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const asNumOpt = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);
const asBoolOpt = (v: unknown): boolean | undefined => (typeof v === "boolean" ? v : undefined);
const obj = (v: unknown): JsonObject => (v && typeof v === "object" && !Array.isArray(v) ? (v as JsonObject) : {});

export function decodeMediaSource(v: unknown): MediaSource {
  const o = obj(v);
  const ext = obj(o.external);
  if (typeof ext.absolutePath === "string") return { kind: "external", absolutePath: ext.absolutePath };
  const proj = obj(o.project);
  return { kind: "project", relativePath: asStr(proj.relativePath, "") };
}

export function encodeMediaSource(s: MediaSource): JsonObject {
  return s.kind === "external"
    ? { external: { absolutePath: s.absolutePath } }
    : { project: { relativePath: s.relativePath } };
}

export function decodeManifestEntry(v: unknown): MediaManifestEntry {
  const o = obj(v);
  const e: MediaManifestEntry = {
    id: asStr(o.id, ""),
    name: asStr(o.name, ""),
    type: (typeof o.type === "string" && (CLIP_TYPES as readonly string[]).includes(o.type)
      ? o.type
      : "video") as ClipType,
    source: decodeMediaSource(o.source),
    duration: asNum(o.duration, 0),
  };
  if (o.generationInput !== undefined && o.generationInput !== null) e.generationInput = o.generationInput;
  e.sourceWidth = asNumOpt(o.sourceWidth);
  e.sourceHeight = asNumOpt(o.sourceHeight);
  e.sourceFPS = asNumOpt(o.sourceFPS);
  e.hasAudio = asBoolOpt(o.hasAudio);
  e.folderId = asStrOpt(o.folderId);
  e.cachedRemoteURL = asStrOpt(o.cachedRemoteURL);
  if (o.cachedRemoteURLExpiresAt !== undefined && o.cachedRemoteURLExpiresAt !== null) {
    e.cachedRemoteURLExpiresAt = o.cachedRemoteURLExpiresAt;
  }
  e.generationStatus = asStrOpt(o.generationStatus);
  if (o.importInput !== undefined && o.importInput !== null) e.importInput = o.importInput;
  return e;
}

export function encodeManifestEntry(e: MediaManifestEntry): JsonObject {
  // property order: id,name,type,source,duration,generationInput,sourceWidth,
  // sourceHeight,sourceFPS,hasAudio,folderId,cachedRemoteURL,cachedRemoteURLExpiresAt,
  // generationStatus,importInput (MediaManifest.swift:20).
  const o: JsonObject = {
    id: e.id,
    name: e.name,
    type: e.type,
    source: encodeMediaSource(e.source),
    duration: e.duration,
  };
  putOpt(o, "generationInput", e.generationInput);
  putOpt(o, "sourceWidth", e.sourceWidth);
  putOpt(o, "sourceHeight", e.sourceHeight);
  putOpt(o, "sourceFPS", e.sourceFPS);
  putOpt(o, "hasAudio", e.hasAudio);
  putOpt(o, "folderId", e.folderId);
  putOpt(o, "cachedRemoteURL", e.cachedRemoteURL);
  putOpt(o, "cachedRemoteURLExpiresAt", e.cachedRemoteURLExpiresAt);
  putOpt(o, "generationStatus", e.generationStatus);
  putOpt(o, "importInput", e.importInput);
  return o;
}

export function decodeMediaFolder(v: unknown): MediaFolder {
  const o = obj(v);
  const f: MediaFolder = { id: asStr(o.id, ""), name: asStr(o.name, "") };
  f.parentFolderId = asStrOpt(o.parentFolderId);
  return f;
}

export function encodeMediaFolder(f: MediaFolder): JsonObject {
  const o: JsonObject = { id: f.id, name: f.name };
  putOpt(o, "parentFolderId", f.parentFolderId);
  return o;
}

export function decodeManifest(v: unknown): MediaManifest {
  const o = obj(v);
  return {
    version: asNum(o.version, 1), // Swift falls back to 1 when absent (MediaManifest.swift:10)
    entries: Array.isArray(o.entries) ? (o.entries as unknown[]).map(decodeManifestEntry) : [],
    folders: Array.isArray(o.folders) ? (o.folders as unknown[]).map(decodeMediaFolder) : [],
  };
}

export function encodeManifest(m: MediaManifest): JsonObject {
  return {
    version: m.version,
    entries: m.entries.map(encodeManifestEntry),
    folders: m.folders.map(encodeMediaFolder),
  };
}

export function newManifest(): MediaManifest {
  return { version: 2, entries: [], folders: [] };
}

export function parseManifest(json: string): MediaManifest {
  return decodeManifest(JSON.parse(json));
}

export function stringifyManifest(m: MediaManifest): string {
  return JSON.stringify(encodeManifest(m));
}
