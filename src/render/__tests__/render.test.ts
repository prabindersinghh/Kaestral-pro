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
  text.textContent = "Kaestral";
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
    const dir = mkdtempSync(join(tmpdir(), "kaestral-render-"));
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

  it("reports missingMedia when a clip's source can't be decoded (rnd-1 — no silent placeholder export)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "kaestral-missing-"));
    const out = join(dir, "out.mp4");
    const tl: Timeline = {
      ...defaultTimeline(), fps: 30, width: 320, height: 180,
      tracks: [{ ...defaultTrack("video", "v"), clips: [defaultClip({ mediaRef: "gone", startFrame: 0, durationFrames: 6, id: "cv", mediaType: "video" })] }],
    };
    // mediaPath points the video clip at a file that doesn't exist → ffmpeg extract fails → the clip
    // renders as a placeholder tile. The render must still finish, but flag the undecodable media.
    const res = await renderVideo(tl, { outputPath: out, codec: "H.264", mediaName: (r) => r, mediaPath: (r) => (r === "gone" ? join(dir, "nonexistent.mp4") : null) });
    expect(res.missingMedia).toContain("gone");
    expect(existsSync(out)).toBe(true); // a file is still produced (tiles), but the caller now knows it's incomplete
  }, 60000);
});

// Field report (v1.0.5): text clips carry a synthetic `text-<id>` mediaRef that never resolves to a
// path, so NodeFrameSource.prepare() filed every caption under `missing` and export_project reported
// status:"rendered_with_missing_media" listing 17–19 perfectly-rendered captions as undecodable.
describe("A2: text clips are never 'missing media' (they are drawn, not decoded)", () => {
  it("a timeline of text clips exports with status 'rendered' and no missingMedia", async () => {
    const dir = mkdtempSync(join(tmpdir(), "kaestral-textonly-"));
    const out = join(dir, "out.mp4");
    const caption = (id: string, startFrame: number): Clip => {
      const c = defaultClip({ mediaRef: `text-${id}`, startFrame, durationFrames: 6, id, mediaType: "text" });
      c.textContent = `caption ${id}`;
      c.textStyle = defaultTextStyle();
      return c;
    };
    const tl: Timeline = {
      ...defaultTimeline(), fps: 30, width: 320, height: 180,
      tracks: [{ ...defaultTrack("text", "t"), clips: [caption("a", 0), caption("b", 6), caption("c", 12)] }],
    };
    // A real path resolver that (correctly) knows nothing about text refs — exactly the executor's.
    const res = await renderVideo(tl, { outputPath: out, codec: "H.264", mediaName: (r) => r, mediaPath: () => null });
    expect(res.missingMedia).toEqual([]);
    expect(res.frames).toBe(18);
    expect(existsSync(out)).toBe(true);
  }, 60000);

  it("export_project reports status 'rendered' for a captions-only timeline", async () => {
    const { McpExecutor } = await import("../../mcp/executor");
    const dir = mkdtempSync(join(tmpdir(), "kaestral-textexp-"));
    const ex = new McpExecutor({ projectDir: dir });
    const add = await ex.execute("add_texts", { entries: [
      { startFrame: 0, durationFrames: 6, content: "one" },
      { startFrame: 6, durationFrames: 6, content: "two" },
    ] });
    expect(add.isError).toBeFalsy();
    const r = await ex.execute("export_project", { mode: "video", outputPath: join(dir, "captions.mp4") });
    expect(r.isError, r.content[0].text).toBeFalsy();
    const out = JSON.parse(r.content[0].text) as { status: string; missingMedia?: string[] };
    expect(out.status).toBe("rendered");
    expect(out.missingMedia).toBeUndefined();
  }, 60000);
});
