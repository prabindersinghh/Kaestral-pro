// Browser frame source: real decoded pixels for the live preview. Still images decode via
// createImageBitmap; video clips use a <video> element seeked to the clip's source time (drawable
// once 'seeked' fires). Not-ready frames return null (compositor draws a tile) and trigger a
// re-render when they load. Smooth per-frame video decode (WebCodecs) is an UPGRADES item.

import type { Clip } from "../model/types";
import { type FrameImage, type FrameSource, sourceConsumedIndex } from "./frameSource";

interface VideoState {
  el: HTMLVideoElement;
  ready: boolean;
  seekedTime: number;
  wantTime: number;
}

export class BrowserFrameSource implements FrameSource {
  private bitmaps = new Map<string, FrameImage>();
  private loadingImg = new Set<string>();
  private videos = new Map<string, VideoState>();

  constructor(
    private readonly srcFor: (mediaRef: string) => string | null,
    private readonly fps: number,
    private readonly onReady: () => void,
  ) {}

  imageFor(clip: Clip, frame: number): FrameImage | null {
    const src = this.srcFor(clip.mediaRef);
    if (!src) return null;
    if (clip.mediaType === "image") return this.imageBitmap(clip.mediaRef, src);
    if (clip.mediaType === "video") return this.videoFrame(clip, src, frame);
    return null;
  }

  private imageBitmap(mediaRef: string, src: string): FrameImage | null {
    const cached = this.bitmaps.get(mediaRef);
    if (cached) return cached;
    if (!this.loadingImg.has(mediaRef)) {
      this.loadingImg.add(mediaRef);
      void (async () => {
        try {
          const bmp = await createImageBitmap(await (await fetch(src)).blob());
          this.bitmaps.set(mediaRef, { image: bmp, width: bmp.width, height: bmp.height });
          this.onReady();
        } catch {
          /* leave as tile */
        }
      })();
    }
    return null;
  }

  private timeFor(clip: Clip, frame: number): number {
    return (clip.trimStartFrame + sourceConsumedIndex(clip, frame)) / this.fps;
  }

  private videoFrame(clip: Clip, src: string, frame: number): FrameImage | null {
    let v = this.videos.get(clip.mediaRef);
    if (!v) {
      const el = document.createElement("video");
      el.muted = true;
      el.preload = "auto";
      el.crossOrigin = "anonymous";
      el.src = src;
      v = { el, ready: false, seekedTime: -1, wantTime: -1 };
      const state = v;
      el.addEventListener("loadeddata", () => { state.ready = true; this.seekTo(state, this.timeFor(clip, frame)); });
      el.addEventListener("seeked", () => { state.seekedTime = el.currentTime; this.onReady(); });
      this.videos.set(clip.mediaRef, v);
      el.load();
      return null;
    }
    if (!v.ready || v.el.videoWidth === 0) return null;
    const t = this.timeFor(clip, frame);
    if (Math.abs(v.seekedTime - t) <= 1 / this.fps) {
      return { image: v.el, width: v.el.videoWidth, height: v.el.videoHeight };
    }
    this.seekTo(v, t);
    return null;
  }

  private seekTo(v: VideoState, t: number): void {
    if (v.wantTime !== t) {
      v.wantTime = t;
      try { v.el.currentTime = t; } catch { /* not seekable yet */ }
    }
  }
}
