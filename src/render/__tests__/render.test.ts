import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderVideo, renderSize } from "../renderVideo";
import { defaultClip, defaultTrack, defaultTimeline, defaultTextStyle } from "../../model/defaults";
import type { Clip, Timeline } from "../../model/types";

function smallTimeline(): Timeline {
  const video: Clip = defaultClip({ mediaRef: "m", startFrame: 0, durationFrames: 15, id: "cv" });
  const text: Clip = defaultClip({ mediaRef: "text-1", startFrame: 0, durationFrames: 15, id: "ct", mediaType: "text" });
  text.textContent = "Palmier";
  text.textStyle = defaultTextStyle();
  return {
    ...defaultTimeline(), fps: 30, width: 640, height: 360,
    tracks: [
      { ...defaultTrack("text", "t"), clips: [text] },
      { ...defaultTrack("video", "v"), clips: [video] },
    ],
  };
}

describe("renderSize (ExportOptions.swift)", () => {
  it("Match Timeline keeps even dims; 1080p scales the short side", () => {
    const tl = { ...defaultTimeline(), width: 1920, height: 1080 };
    expect(renderSize(tl, "Match Timeline")).toEqual([1920, 1080]);
    expect(renderSize({ ...tl, width: 3840, height: 2160 }, "1080p")).toEqual([1920, 1080]);
    expect(renderSize({ ...tl, width: 1081, height: 1080 }, "Match Timeline")).toEqual([1080, 1080]); // rounded even
  });
});

describe("renderVideo → real playable file (FFmpeg finish line)", () => {
  it("renders composited frames and encodes an H.264 mp4 ffprobe can read", async () => {
    const dir = mkdtempSync(join(tmpdir(), "palmier-render-"));
    const out = join(dir, "out.mp4");
    const res = await renderVideo(smallTimeline(), { outputPath: out, codec: "H.264", resolution: "Match Timeline", mediaName: () => "Clip" });

    expect(res.frames).toBe(15);
    expect([res.width, res.height]).toEqual([640, 360]);
    expect(existsSync(out)).toBe(true);

    const probe = JSON.parse(
      execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name,width,height", "-of", "json", out]).toString(),
    );
    const s = probe.streams[0];
    expect(s.codec_name).toBe("h264");
    expect(Number(s.width)).toBe(640);
    expect(Number(s.height)).toBe(360);
  }, 60000);
});
