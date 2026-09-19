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
import { ffmpegBin } from "../mcp/env";

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
  /** mediaRefs whose pixels could NOT be decoded (unresolved path, ffmpeg failure, or zero frames).
   * These render as the colored placeholder tile — the caller surfaces them so a "successful" export
   * of a color block instead of real footage is never reported as a clean render. */
  readonly missing = new Set<string>();

  constructor(
    private readonly mediaPath: (mediaRef: string) => string | null,
    private readonly fps: number,
    private readonly ffmpegPath = ffmpegBin(),
  ) {}

  /**
   * Load still images and extract each video clip's frames. Call once before rendering.
   * `onlyFrame`: prepare just what ONE output frame needs — clips not showing at that frame (or on
   * hidden tracks) are skipped, and each video clip gets exactly one source frame extracted with an
   * input-side seek. This is what a single-frame preview (inspect_timeline) uses; a full export must
   * not pay for it, and a preview must not pay for extracting every frame of a 25-minute timeline.
   */
  async prepare(timeline: Timeline, opts: { onlyFrame?: number } = {}): Promise<void> {
    this.root = await mkdtemp(join(tmpdir(), "kaestral-frames-"));
    const only = opts.onlyFrame;
    for (const track of timeline.tracks) {
      if (!isVisual(track.type)) continue;
      if (only !== undefined && track.hidden) continue;
      for (const clip of track.clips) {
        if (only !== undefined && !(only >= clip.startFrame && only < endFrame(clip))) continue;
        // Text is DRAWN by the compositor from clip.textContent/textStyle — its synthetic `text-<id>`
        // mediaRef never resolves to a file and must not be reported as undecodable media.
        if (clip.mediaType === "text") continue;
        const path = this.mediaPath(clip.mediaRef);
        if (!path) { this.missing.add(clip.mediaRef); continue; } // unresolved/offline/remote source
        if (clip.mediaType === "image") {
          if (!this.images.has(clip.mediaRef)) {
            try {
              const img = await loadImage(path);
              this.images.set(clip.mediaRef, { image: img as unknown as CanvasImageSource, width: img.width, height: img.height });
            } catch { this.missing.add(clip.mediaRef); /* leave as tile fallback */ }
          }
        } else if (clip.mediaType === "video") {
          if (only !== undefined) await this.extractOneFrame(clip, path, only);
          else await this.extractVideo(clip, path);
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
      this.missing.add(clip.mediaRef);
      console.error(`[NodeFrameSource] extract failed for ${clip.mediaRef} (${path}): ${e instanceof Error ? e.message : e}`);
      return;
    }
    // Collect produced files (pattern writes into root as <clipId>_NNNNN.png).
    const files = (await readdir(this.root).catch(() => []))
      .filter((f) => f.startsWith(`${clip.id}_`) && f.endsWith(".png"))
      .sort();
    if (files.length > 0) this.videos.set(clip.id, { dir: this.root, files });
    else { this.missing.add(clip.mediaRef); console.error(`[NodeFrameSource] no frames extracted for ${clip.id} from ${path}`); }
  }

  /** Extract the single source frame a clip shows at output `frame` (input-side seek — decoding
   *  starts at the nearest keyframe, not at the file's head). Registered as a one-file "video" so
   *  ensure()/imageFor() serve it at any index (they clamp into the file list). */
  private async extractOneFrame(clip: Clip, path: string, frame: number): Promise<void> {
    // Seek HALF a source frame early: -ss keeps the first frame whose pts >= the seek point, so
    // this lands exactly on the wanted frame whether its pts rounds up or down — seeking to the
    // frame's own timestamp can overshoot the file's last frame and yield nothing (exit 0).
    const t = (clip.trimStartFrame + sourceConsumedIndex(clip, frame) - 0.5) / this.fps;
    const file = `${clip.id}_00000.png`;
    const out = join(this.root, file);
    try {
      await run(this.ffmpegPath, ["-y", "-ss", Math.max(0, t).toFixed(3), "-i", path, "-frames:v", "1", out]);
      // ffmpeg exits 0 even when the seek lands past the last frame and nothing is written.
      if (!(await readdir(this.root).catch(() => [] as string[])).includes(file)) throw new Error("no frame at that time");
      this.videos.set(clip.id, { dir: this.root, files: [file] });
    } catch (e) {
      this.missing.add(clip.mediaRef);
      console.error(`[NodeFrameSource] single-frame extract failed for ${clip.mediaRef} (${path}): ${e instanceof Error ? e.message : e}`);
    }
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
