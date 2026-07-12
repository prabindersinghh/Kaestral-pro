// Resolve a media asset's source to a real on-disk path for the FFmpeg render (node-only, pure).
//  - project package media → <projectDir>/<relativePath>
//  - bundled/served asset ("/foo.mp4") → <publicDir>/foo.mp4 (dev: kaestral/public)
//  - remote URL (http[s]) → null (download-first is an UPGRADE)
//  - real disk path (e.g. C:\clip.mp4) → itself

import { join } from "node:path";
import type { MediaSource } from "../model/media";

export function resolveRenderMediaPath(source: MediaSource, projectDir: string, publicDir: string): string | null {
  if (source.kind === "project") return join(projectDir, source.relativePath);
  const p = source.absolutePath;
  if (/^https?:\/\//.test(p)) return null;
  if (p.startsWith("/")) return join(publicDir, p.replace(/^\/+/, ""));
  return p;
}
