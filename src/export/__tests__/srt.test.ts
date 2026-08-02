import { describe, it, expect } from "vitest";
import { exportSRT, frameToSrtTime } from "../srt";
import { defaultClip, defaultTrack, defaultTimeline } from "../../model/defaults";
import type { Clip, Timeline, Track } from "../../model/types";
import type { ClipType } from "../../model/enums";

function clip(id: string, start: number, dur: number, extra: Partial<Clip> = {}): Clip {
  const mediaType = (extra.mediaType ?? "text") as ClipType;
  return { ...defaultClip({ mediaRef: `text-${id}`, startFrame: start, durationFrames: dur, id, mediaType }), ...extra };
}
function tl(tracks: Track[], fps = 30): Timeline {
  return { ...defaultTimeline(), fps, tracks };
}
const ttrack = (clips: Clip[]) => ({ ...defaultTrack("text", "t"), clips });

describe("frameToSrtTime", () => {
  it("formats HH:MM:SS,mmm at fps", () => {
    expect(frameToSrtTime(0, 30)).toBe("00:00:00,000");
    expect(frameToSrtTime(15, 30)).toBe("00:00:00,500"); // half a second at 30fps
    expect(frameToSrtTime(30, 30)).toBe("00:00:01,000");
    expect(frameToSrtTime(30 * 3661, 30)).toBe("01:01:01,000"); // 1h 1m 1s
  });
});

describe("exportSRT", () => {
  it("emits sequentially-numbered cues with frame-accurate timecodes, ordered by start", () => {
    // deliberately out of order to prove sorting
    const srt = exportSRT(tl([ttrack([
      clip("b", 60, 30, { textContent: "second" }),
      clip("a", 0, 30, { textContent: "first" }),
    ])]));
    expect(srt).toBe(
      "1\n00:00:00,000 --> 00:00:01,000\nfirst\n\n" +
      "2\n00:00:02,000 --> 00:00:03,000\nsecond\n",
    );
  });

  it("preserves multi-line caption text and skips empty clips", () => {
    const srt = exportSRT(tl([ttrack([
      clip("a", 0, 30, { textContent: "line one\nline two" }),
      clip("blank", 30, 30, { textContent: "   " }), // whitespace-only → skipped
    ])]));
    expect(srt).toContain("line one\nline two");
    expect(srt.trim().startsWith("1")).toBe(true);
    expect(srt).not.toContain("2\n"); // the blank clip produced no second cue
  });

  it("returns an empty string for a timeline with no caption clips", () => {
    expect(exportSRT(tl([{ ...defaultTrack("video", "v"), clips: [clip("v", 0, 30, { mediaType: "video", textContent: undefined })] }]))).toBe("");
    expect(exportSRT(tl([]))).toBe("");
  });
});
