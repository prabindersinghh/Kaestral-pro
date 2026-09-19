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
