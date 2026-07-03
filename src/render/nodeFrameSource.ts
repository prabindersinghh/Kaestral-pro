// Node frame source: real decoded pixels for the FFmpeg render. Still images load once with
// @napi-rs/canvas loadImage; video clips are extracted to per-frame PNGs with FFmpeg (accurate
// seek from the clip's trim in), then loaded on demand (memory stays ~a few frames). Streaming
// decode instead of extract-to-temp is an UPGRADES item.

import { loadImage } from "@napi-rs/canvas";
import { spawn } from "node:child_process";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Clip, Timeline } from "../model/types";
import { isVisual } from "../model/enums";
import { endFrame, sourceFramesConsumed } from "../model/helpers";
import { type FrameImage, type FrameSource, sourceConsumedIndex } from "../compositor/frameSource";

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += String(d)));
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}: ${err.slice(-500)}`))));
  });
}

export class NodeFrameSource implements FrameSource {
  private images = new Map<string, FrameImage>();
  private videos = new Map<string, { dir: string; files: string[] }>();
  private cache = new Map<string, FrameImage>();
  private root = "";

  constructor(
    private readonly mediaPath: (mediaRef: string) => string | null,
    private readonly fps: number,
    private readonly ffmpegPath = "ffmpeg",
  ) {}

  /** Load still images and extract each video clip's frames. Call once before rendering. */
  async prepare(timeline: Timeline): Promise<void> {
    this.root = await mkdtemp(join(tmpdir(), "palmier-frames-"));
    for (const track of timeline.tracks) {
      if (!isVisual(track.type)) continue;
      for (const clip of track.clips) {
        const path = this.mediaPath(clip.mediaRef);
        if (!path) continue;
        if (clip.mediaType === "image") {
          if (!this.images.has(clip.mediaRef)) {
            try {
              const img = await loadImage(path);
              this.images.set(clip.mediaRef, { image: img as unknown as CanvasImageSource, width: img.width, height: img.height });
            } catch { /* leave as tile fallback */ }
          }
        } else if (clip.mediaType === "video") {
          await this.extractVideo(clip, path);
        }
      }
    }
  }

  private async extractVideo(clip: Clip, path: string): Promise<void> {
    const t0 = clip.trimStartFrame / this.fps;
    const count = sourceFramesConsumed(clip) + 2;
    // Frames land in root/ as "<clipId>_NNNNN.png" (accurate seek from the clip's trim in).
    try {
      await run(this.ffmpegPath, [
        "-y", "-i", path, "-ss", String(t0), "-vf", `fps=${this.fps}`,
        "-frames:v", String(count), "-start_number", "0", join(this.root, `${clip.id}_%05d.png`),
      ]);
    } catch (e) {
      console.error(`[NodeFrameSource] extract failed for ${clip.mediaRef} (${path}): ${e instanceof Error ? e.message : e}`);
      return;
    }
    // Collect produced files (pattern writes into root as <clipId>_NNNNN.png).
    const files = (await readdir(this.root).catch(() => []))
      .filter((f) => f.startsWith(`${clip.id}_`) && f.endsWith(".png"))
      .sort();
    if (files.length > 0) this.videos.set(clip.id, { dir: this.root, files });
    else console.error(`[NodeFrameSource] no frames extracted for ${clip.id} from ${path}`);
  }

  /** Preload the decoded frames this output frame needs (imageFor is sync). */
  async ensure(timeline: Timeline, frame: number): Promise<void> {
    for (const track of timeline.tracks) {
      if (!isVisual(track.type) || track.hidden) continue;
      for (const clip of track.clips) {
        if (clip.mediaType !== "video") continue;
        if (!(frame >= clip.startFrame && frame < endFrame(clip))) continue;
        const v = this.videos.get(clip.id);
        if (!v) continue;
        const idx = Math.max(0, Math.min(v.files.length - 1, sourceConsumedIndex(clip, frame)));
        const key = `${clip.id}:${idx}`;
        if (this.cache.has(key)) continue;
        try {
          const img = await loadImage(join(v.dir, v.files[idx]));
          this.cache.set(key, { image: img as unknown as CanvasImageSource, width: img.width, height: img.height });
        } catch { /* tile fallback */ }
        // keep the cache small
        if (this.cache.size > 8) this.cache.delete(this.cache.keys().next().value!);
      }
    }
  }

  imageFor(clip: Clip, frame: number): FrameImage | null {
    if (clip.mediaType === "image") return this.images.get(clip.mediaRef) ?? null;
    if (clip.mediaType === "video") {
      const v = this.videos.get(clip.id);
      if (!v) return null;
      const idx = Math.max(0, Math.min(v.files.length - 1, sourceConsumedIndex(clip, frame)));
      return this.cache.get(`${clip.id}:${idx}`) ?? null;
    }
    return null;
  }

  async cleanup(): Promise<void> {
    if (this.root) await rm(this.root, { recursive: true, force: true }).catch(() => undefined);
  }
}
