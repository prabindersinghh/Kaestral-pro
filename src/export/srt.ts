// SubRip (.srt) caption export — walks the timeline's text/caption clips into subtitle cues so
// captions built by add_captions can leave the editor as a standard sidecar (YouTube/social/etc.).
// Timecodes are HH:MM:SS,mmm (millisecond SubRip form), NOT the SMPTE frame timecode in timecode.ts.

import type { Timeline } from "../model/types";

/** A single frame index → SubRip timestamp "HH:MM:SS,mmm" at `fps`. */
export function frameToSrtTime(frame: number, fps: number): string {
  const totalMs = Math.max(0, Math.round((frame / Math.max(1, fps)) * 1000));
  const ms = totalMs % 1000;
  const totalSec = Math.floor(totalMs / 1000);
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60) % 60;
  const h = Math.floor(totalSec / 3600);
  const p2 = (n: number) => String(n).padStart(2, "0");
  const p3 = (n: number) => String(n).padStart(3, "0");
  return `${p2(h)}:${p2(m)}:${p2(s)},${p3(ms)}`;
}

/**
 * Export every text/caption clip on the timeline as a SubRip (.srt) document, cues numbered in
 * start-frame order. Clips with empty content are skipped; an empty timeline yields an empty string.
 */
export function exportSRT(timeline: Timeline): string {
  const fps = Math.max(1, timeline.fps);
  const cues = timeline.tracks
    .flatMap((t) => t.clips)
    .filter((c) => c.mediaType === "text" && typeof c.textContent === "string" && c.textContent.trim().length > 0)
    .sort((a, b) => a.startFrame - b.startFrame || a.id.localeCompare(b.id));

  const blocks = cues.map((c, i) => {
    const start = frameToSrtTime(c.startFrame, fps);
    const end = frameToSrtTime(c.startFrame + Math.max(1, c.durationFrames), fps);
    return `${i + 1}\n${start} --> ${end}\n${c.textContent!.trim()}\n`;
  });
  return blocks.join("\n");
}
