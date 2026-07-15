// .kaestral package load/save (Project/VideoProject.swift, Utilities/Constants.swift).
// FS-abstracted so the same logic runs over Node (tests/CLI) and Tauri (app).

import { parseTimeline, stringifyTimeline } from "../model/codec";
import type { Timeline } from "../model/types";
import { parseManifest, stringifyManifest, type MediaManifest } from "../model/media";

/** enum Project (Constants.swift:105). */
export const PROJECT = {
  fileExtension: "kaestral",
  typeIdentifier: "io.kaestral.project",
  timelineFilename: "project.json",
  manifestFilename: "media.json",
  generationLogFilename: "generation-log.json",
  thumbnailFilename: "thumbnail.jpg",
  mediaDirectoryName: "media",
} as const;

/** Minimal FS surface a `.kaestral` package needs. `readText` returns null when absent. */
export interface PackageFS {
  readText(path: string): Promise<string | null>;
  writeText(path: string, content: string): Promise<void>;
  ensureDir(path: string): Promise<void>;
}

export interface ProjectPackageContents {
  timeline: Timeline;
  manifest: MediaManifest | null;
  /** media.json existed but failed to decode — preserve it, don't clobber on save. */
  manifestUnreadable: boolean;
  /** generation-log.json preserved verbatim (the port never authors it). */
  generationLogRaw: string | null;
}

function child(dir: string, name: string): string {
  return dir.endsWith("/") ? `${dir}${name}` : `${dir}/${name}`;
}

/** readProjectPackage — VideoProject.swift:88. project.json required; media.json tolerant. */
export async function readProjectPackage(fs: PackageFS, dir: string): Promise<ProjectPackageContents> {
  const timelineText = await fs.readText(child(dir, PROJECT.timelineFilename));
  if (timelineText == null) {
    throw new Error(`Corrupt project: missing ${PROJECT.timelineFilename}`);
  }
  const timeline = parseTimeline(timelineText);

  let manifest: MediaManifest | null = null;
  let manifestUnreadable = false;
  const manifestText = await fs.readText(child(dir, PROJECT.manifestFilename));
  if (manifestText != null) {
    try {
      manifest = parseManifest(manifestText);
    } catch {
      manifest = null;
      manifestUnreadable = true;
    }
  }

  const generationLogRaw = await fs.readText(child(dir, PROJECT.generationLogFilename));

  return { timeline, manifest, manifestUnreadable, generationLogRaw };
}

/** writeProjectPackage — VideoProject.swift:205. Always writes project.json. */
export async function writeProjectPackage(
  fs: PackageFS,
  dir: string,
  contents: ProjectPackageContents,
): Promise<void> {
  await fs.ensureDir(dir);
  await fs.writeText(child(dir, PROJECT.timelineFilename), stringifyTimeline(contents.timeline));

  if (contents.manifest != null) {
    // Don't overwrite a recoverable bad manifest with an empty one (manifestSnapshotData, VideoProject.swift:184).
    const m = contents.manifest;
    const isEmpty = m.entries.length === 0 && m.folders.length === 0;
    if (!(contents.manifestUnreadable && isEmpty)) {
      await fs.writeText(child(dir, PROJECT.manifestFilename), stringifyManifest(m));
    }
  }

  if (contents.generationLogRaw != null) {
    await fs.writeText(child(dir, PROJECT.generationLogFilename), contents.generationLogRaw);
  }
}
