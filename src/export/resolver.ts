// Media resolution surface the exporters need. Ported from the subset of MediaResolver used by
// XMLExporter / FCPXMLExporter (displayName / entry / resolveURL). Source-timecode probing (tmcd)
// is not available in this build → returns null, so files fall back to a dummy 00:00:00:00.

import type { ClipType } from "../model/enums";
import type { MediaSource } from "../model/media";
import type { MediaLibrary } from "../mcp/mediaLibrary";
import type { SourceTimecode } from "./timecode";

export interface ExportEntry {
  id: string;
  name: string;
  type: ClipType;
  duration: number;
  sourceWidth?: number;
  sourceHeight?: number;
  sourceFPS?: number;
  hasAudio?: boolean;
  source: MediaSource;
}

export interface ExportMediaResolver {
  displayName(mediaRef: string): string;
  entry(mediaRef: string): ExportEntry | undefined;
  /** Absolute host path (used to derive filename + file:// URL forms), or undefined if unresolved. */
  resolvePath(mediaRef: string): string | undefined;
  sourceTimecode(mediaRef: string): SourceTimecode | null;
}

/** Build an exporter resolver from the in-memory MediaLibrary. */
export function libraryResolver(media: MediaLibrary, projectDir?: string): ExportMediaResolver {
  return {
    displayName(mediaRef) {
      return media.asset(mediaRef)?.name ?? mediaRef;
    },
    entry(mediaRef) {
      const a = media.asset(mediaRef);
      if (!a) return undefined;
      return {
        id: a.id, name: a.name, type: a.type, duration: a.duration,
        sourceWidth: a.sourceWidth, sourceHeight: a.sourceHeight, sourceFPS: a.sourceFPS,
        hasAudio: a.hasAudio, source: a.source,
      };
    },
    resolvePath(mediaRef) {
      const a = media.asset(mediaRef);
      if (!a) return undefined;
      if (a.source.kind === "external") return a.source.absolutePath;
      const base = (projectDir ?? ".").replace(/[/\\]+$/, "");
      return `${base}/${a.source.relativePath}`;
    },
    sourceTimecode() {
      return null; // no tmcd probing in phase 1
    },
  };
}

// --- URL form helpers (a file path → the strings the two formats want) ---

export function lastPathComponent(p: string): string {
  return p.split(/[/\\]/).pop() ?? p;
}

/** file:// absolute-string form (FCPXML <media-rep src>). */
export function fileURLString(p: string): string {
  const norm = p.replace(/\\/g, "/");
  return norm.startsWith("/") ? `file://${norm}` : `file:///${norm}`;
}

/** Premiere's extra-slash host form for XMEML <pathurl>. */
export function premierePathURL(p: string): string {
  return fileURLString(p).replace("file://", "file://localhost//");
}
