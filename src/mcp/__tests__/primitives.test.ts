import { describe, it, expect } from "vitest";
import { McpExecutor } from "../executor";
import { ALL_TOOL_DEFS, PRIMITIVE_TOOL_DEFS, TOOL_DEFS } from "../toolDefs";
import type { Track } from "../../model/types";

// The five primitives from the v1.0.5 field report: roughly a third of the operator's tool calls
// were workarounds for these missing building blocks rather than editing.

function videoTrack(id = "t0"): Track {
  return { id, type: "video", muted: false, hidden: false, syncLocked: true, clips: [] };
}
function seed(ex: McpExecutor): void {
  ex.media.addAsset({ id: "vid1", name: "clip.mp4", type: "video", duration: 10, source: { kind: "external", absolutePath: "/x.mp4" }, hasAudio: false });
  ex.engine.timeline.tracks.push(videoTrack());
}

describe("PRIMITIVE_TOOL_DEFS: additive, outside the frozen 41", () => {
  it("is advertised in ALL_TOOL_DEFS but never in TOOL_DEFS; names are unique across the whole surface", () => {
    expect(TOOL_DEFS.length).toBe(41);
    for (const t of PRIMITIVE_TOOL_DEFS) {
      expect(TOOL_DEFS.find((x) => x.name === t.name)).toBeUndefined();
      expect(ALL_TOOL_DEFS.find((x) => x.name === t.name)).toBe(t);
      expect(t.inputSchema.type).toBe("object");
    }
    expect(new Set(ALL_TOOL_DEFS.map((t) => t.name)).size).toBe(ALL_TOOL_DEFS.length);
  });
});

describe("B1: add_track", () => {
  it("creates an empty track of the given type and returns its index; the track survives later edits", async () => {
    const ex = new McpExecutor();
    seed(ex);
    const r = await ex.execute("add_track", { type: "video" });
    expect(r.isError, r.content[0].text).toBeFalsy();
    const out = JSON.parse(r.content[0].text) as { trackIndex: number; label: string; type: string };
    expect(out.trackIndex).toBe(0);
    expect(out.type).toBe("video");
    expect(out.label).toBe("V2"); // NLE labels count from the bottom: the new top track is V2
    expect(ex.timeline.tracks.length).toBe(2);
    expect(ex.timeline.tracks[0].clips).toEqual([]);
    // An edit elsewhere must not prune it (trap 3).
    await ex.execute("add_clips", { entries: [{ mediaRef: "vid1", trackIndex: 1, startFrame: 0, durationFrames: 30 }] });
    expect(ex.timeline.tracks.length).toBe(2);
    expect(ex.timeline.tracks[0].clips.length).toBe(0);
    // It is undoable as the assistant's own edit.
    const u = await ex.execute("undo", {});
    expect(u.content[0].text).toMatch(/Add Clips/);
  });

  it("honors an explicit index (clamped) and places audio at the end by default", async () => {
    const ex = new McpExecutor();
    seed(ex);
    const a = JSON.parse((await ex.execute("add_track", { type: "audio" })).content[0].text) as { trackIndex: number; label: string };
    expect(a.trackIndex).toBe(1);
    expect(a.label).toBe("A1");
    const v = JSON.parse((await ex.execute("add_track", { type: "text", index: 50 })).content[0].text) as { trackIndex: number };
    expect(v.trackIndex).toBe(2); // clamped to the end
    expect(ex.timeline.tracks.map((t) => t.type)).toEqual(["video", "audio", "text"]);
  });

  it("rejects an unknown type (closed enum)", async () => {
    const ex = new McpExecutor();
    const r = await ex.execute("add_track", { type: "subtitle" });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/type must be one of video, audio, image, text, lottie/);
    expect(ex.timeline.tracks.length).toBe(0);
  });
});

describe("B2: punch_in", () => {
  async function placed(ex: McpExecutor, startFrame = 100, durationFrames = 300): Promise<string> {
    seed(ex);
    await ex.execute("add_clips", { entries: [{ mediaRef: "vid1", trackIndex: 0, startFrame, durationFrames }] });
    return ex.timeline.tracks[0].clips[0].id;
  }

  it("writes CLIP-RELATIVE position (top-left) + scale (size fraction) keyframes for ramp/hold/return, as ONE undo step", async () => {
    const ex = new McpExecutor();
    const clipId = await placed(ex); // clip spans timeline frames 100..400
    const r = await ex.execute("punch_in", { clipId, atFrame: 130, toFrame: 145, zoom: 2, focusX: 0.25, focusY: 0.75, holdFrames: 30, returnFrames: 15 });
    expect(r.isError, r.content[0].text).toBeFalsy();
    const c = ex.engine.clipRef(clipId)!;
    expect(c.positionTrack!.keyframes.map((k) => k.frame)).toEqual([30, 45, 75, 90]); // timeline 130/145/175/190 → clip-relative
    expect(c.scaleTrack!.keyframes.map((k) => k.frame)).toEqual([30, 45, 75, 90]);
    expect(c.positionTrack!.keyframes[1].value).toEqual({ a: -0.25, b: -0.75 });
    expect(c.scaleTrack!.keyframes[1].value).toEqual({ a: 2, b: 2 });
    expect(c.positionTrack!.keyframes[3].value).toEqual({ a: 0, b: 0 });
    const out = JSON.parse(r.content[0].text) as { zoom: number; keyframes: { position: number[] } };
    expect(out.zoom).toBe(2);
    // One undo step reverts BOTH tracks.
    const u = await ex.execute("undo", {});
    expect(u.isError).toBeFalsy();
    expect(ex.engine.clipRef(clipId)!.positionTrack).toBeUndefined();
    expect(ex.engine.clipRef(clipId)!.scaleTrack).toBeUndefined();
  });

  it("uses the clip's own transform as the base (a PIP zooms within its box), and clamps zoom/focus", async () => {
    const ex = new McpExecutor();
    const clipId = await placed(ex, 0, 100);
    await ex.execute("set_clip_properties", { clipIds: [clipId], transform: { centerX: 0.75, centerY: 0.75, width: 0.5, height: 0.5 } });
    const r = await ex.execute("punch_in", { clipId, atFrame: 0, toFrame: 10, zoom: 99, focusX: 7, focusY: -3 });
    expect(r.isError, r.content[0].text).toBeFalsy();
    const out = JSON.parse(r.content[0].text) as { zoom: number; focusX: number; focusY: number };
    expect(out.zoom).toBe(4);
    expect(out.focusX).toBe(1);
    expect(out.focusY).toBe(0);
    const c = ex.engine.clipRef(clipId)!;
    expect(c.positionTrack!.keyframes[0].value).toEqual({ a: 0.5, b: 0.5 }); // base top-left of the PIP
    // 4× about the PIP's top-right corner (1,0): x' = 0.5 − 3·1·0.5 = −1, y' = 0.5; size 2×2.
    expect(c.positionTrack!.keyframes[1].value).toEqual({ a: -1, b: 0.5 });
    expect(c.scaleTrack!.keyframes[1].value).toEqual({ a: 2, b: 2 });
  });

  it("a second punch_in on the same clip keeps the first (keyframes outside the new window are preserved)", async () => {
    const ex = new McpExecutor();
    const clipId = await placed(ex, 0, 300);
    await ex.execute("punch_in", { clipId, atFrame: 10, toFrame: 20, zoom: 2, focusX: 0.5, focusY: 0.5, holdFrames: 10, returnFrames: 10 });
    const r = await ex.execute("punch_in", { clipId, atFrame: 100, toFrame: 110, zoom: 3, focusX: 0.1, focusY: 0.1, holdFrames: 10, returnFrames: 10 });
    expect(r.isError, r.content[0].text).toBeFalsy();
    const c = ex.engine.clipRef(clipId)!;
    expect(c.positionTrack!.keyframes.map((k) => k.frame)).toEqual([10, 20, 30, 40, 100, 110, 120, 130]);
    expect(c.scaleTrack!.keyframes[5].value).toEqual({ a: 3, b: 3 });
  });

  it("rejects frames outside the clip, a non-increasing ramp, and an unknown clip — with the clip's range", async () => {
    const ex = new McpExecutor();
    const clipId = await placed(ex, 100, 50); // 100..150
    const bad = async (args: Record<string, unknown>, re: RegExp) => {
      const r = await ex.execute("punch_in", { clipId, zoom: 2, focusX: 0.5, focusY: 0.5, ...args });
      expect(r.isError).toBe(true);
      expect(r.content[0].text).toMatch(re);
    };
    await bad({ atFrame: 90, toFrame: 110 }, /within the clip.*100.*150/);
    await bad({ atFrame: 120, toFrame: 120 }, /toFrame must be after atFrame/);
    await bad({ atFrame: 120, toFrame: 140, holdFrames: 5, returnFrames: 20 }, /ends at frame 165.*clip ends at 150/);
    expect(ex.engine.clipRef(clipId)!.positionTrack).toBeUndefined();
    const r = await ex.execute("punch_in", { clipId: "ghost", atFrame: 0, toFrame: 1, zoom: 2, focusX: 0.5, focusY: 0.5 });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/clip not found/);
  });
});
