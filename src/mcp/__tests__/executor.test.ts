import { describe, it, expect } from "vitest";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { McpExecutor, clampCaptionsToNextStart } from "../executor";
import { TOOL_DEFS } from "../toolDefs";
import { nodePackageFS } from "../../project/nodeFs";
import type { Track } from "../../model/types";

function videoTrack(id = "t0"): Track {
  return { id, type: "video", muted: false, hidden: false, syncLocked: true, clips: [] };
}
function seed(ex: McpExecutor): void {
  ex.media.addAsset({ id: "vid1", name: "clip.mp4", type: "video", duration: 10, source: { kind: "external", absolutePath: "/x.mp4" }, hasAudio: false });
  ex.engine.timeline.tracks.push(videoTrack());
}

describe("Stage-C: tool registry (frozen contract)", () => {
  it("registers exactly 41 tools, unique names, no read_skill", () => {
    expect(TOOL_DEFS.length).toBe(41);
    expect(new Set(TOOL_DEFS.map((t) => t.name)).size).toBe(41);
    expect(TOOL_DEFS.find((t) => t.name === "read_skill")).toBeUndefined();
    for (const t of TOOL_DEFS) expect(t.inputSchema.type).toBe("object");
  });

  it("includes the frozen set of names", () => {
    const names = new Set(TOOL_DEFS.map((t) => t.name));
    for (const n of ["get_timeline", "add_clips", "ripple_delete_ranges", "set_keyframes", "undo", "export_project", "list_models"]) {
      expect(names.has(n)).toBe(true);
    }
  });
});

describe("Stage-C: executor edit flow over the engine", () => {
  it("get_timeline → add_clips → ripple_delete_ranges → undo", async () => {
    const ex = new McpExecutor();
    seed(ex);

    const gt = await ex.execute("get_timeline", {});
    expect(gt.isError).toBeFalsy();
    const tl = JSON.parse(gt.content[0].text);
    expect(tl.canGenerate).toBe(false);
    expect(tl.tracks[0].label).toBe("V1");
    expect(tl.totalFrames).toBe(0);

    const add = await ex.execute("add_clips", { entries: [{ mediaRef: "vid1", trackIndex: 0, startFrame: 0, durationFrames: 100 }] });
    expect(add.isError).toBeFalsy();
    expect(ex.timeline.tracks[0].clips.length).toBe(1);

    const rip = await ex.execute("ripple_delete_ranges", { trackIndex: 0, ranges: [[10, 30]], units: "frames" });
    expect(rip.isError).toBeFalsy();
    expect(ex.timeline.tracks[0].clips.reduce((s, c) => s + c.durationFrames, 0)).toBe(80);

    const un = await ex.execute("undo", {});
    expect(un.isError).toBeFalsy();
    expect(ex.timeline.tracks[0].clips.reduce((s, c) => s + c.durationFrames, 0)).toBe(100);
  });

  it("add_clips derives duration from source when omitted (seconds × fps − trims)", async () => {
    const ex = new McpExecutor();
    seed(ex); // asset duration 10s, fps 30 → 300 project frames
    await ex.execute("add_clips", { entries: [{ mediaRef: "vid1", trackIndex: 0, startFrame: 0, trimStartFrame: 30 }] });
    expect(ex.timeline.tracks[0].clips[0].durationFrames).toBe(270);
  });

  it("set_keyframes stores clip-relative dB volume with interpolation", async () => {
    const ex = new McpExecutor();
    seed(ex);
    await ex.execute("add_clips", { entries: [{ mediaRef: "vid1", trackIndex: 0, startFrame: 0, durationFrames: 48 }] });
    const clipId = ex.timeline.tracks[0].clips[0].id;
    const r = await ex.execute("set_keyframes", { clipId, property: "volume", keyframes: [[0, 0], [24, -6, "linear"]] });
    expect(r.isError).toBeFalsy();
    const kfs = ex.engine.clipRef(clipId)!.volumeTrack!.keyframes;
    expect(kfs.map((k) => [k.frame, k.value])).toEqual([[0, 0], [24, -6]]);
    expect(kfs[1].interpolationOut).toBe("linear");
  });
});

describe("Stage-C: stub shapes (SPEC §10/§11)", () => {
  it("generate_video/image ask for a BYOK key when none is set (no fake clip)", async () => {
    const ex = new McpExecutor();
    for (const t of ["generate_video", "generate_image"]) {
      const r = await ex.execute(t, { prompt: "x" });
      expect(r.isError).toBe(true);
      expect(r.content[0].text).toMatch(/Fal or Replicate key/);
    }
    // generate_audio + upscale stay unwired.
    const au = await ex.execute("generate_audio", { prompt: "x" });
    expect(au.isError).toBe(true);
    expect(au.content[0].text).toMatch(/not wired/);
    const up = await ex.execute("upscale_media", { mediaRef: "x" });
    expect(up.isError).toBe(true);
    expect(up.content[0].text).toMatch(/not wired/);
  });

  it("list_models returns {models:[],loaded:false}", async () => {
    const ex = new McpExecutor();
    const r = await ex.execute("list_models", {});
    expect(JSON.parse(r.content[0].text)).toEqual({ models: [], loaded: false });
  });

  it("still-stubbed tools report unavailable (structured, not a crash)", async () => {
    const ex = new McpExecutor();
    // search_media (semantic/transcript search) remains a stub in this build. inspect_media and
    // inspect_timeline are now implemented (see inspectTools.test.ts) and no longer belong here.
    for (const t of ["search_media", "inspect_color"]) {
      const r = await ex.execute(t, {});
      expect(r.isError).toBe(true);
      expect(r.content[0].text).toMatch(/not available in this build/);
    }
  });

  it("inspect_timeline returns a structured summary (not a stub) on an empty timeline", async () => {
    const ex = new McpExecutor();
    const r = await ex.execute("inspect_timeline", {});
    expect(r.isError).toBeFalsy();
    const out = JSON.parse(r.content[0].text) as { fps: number; trackCount: number; totalFrames: number };
    expect(out.fps).toBe(30);
    expect(out.trackCount).toBe(0);
    expect(out.totalFrames).toBe(0);
  });

  it("transcription tools ask for the whisper setup when the model/binary isn't present", async () => {
    const ex = new McpExecutor();
    for (const t of ["get_transcript", "add_captions"]) {
      const r = await ex.execute(t, {});
      expect(r.isError).toBe(true);
      // Either the whisper setup message (no binary) or a clear arg error — never a crash.
      expect(r.content[0].text).toMatch(/whisper|transcription|clipId|mediaRef/i);
    }
  });
});

describe("Stage-D (pure): export_project interchange modes", () => {
  it("mode:xml and mode:fcpxml write valid files; kaestral works; video reports Stage D", async () => {
    const root = mkdtempSync(join(tmpdir(), "kaestral-exp-"));
    const ex = new McpExecutor({ fs: nodePackageFS(), projectDir: root });
    ex.media.addAsset({ id: "v", name: "v.mp4", type: "video", duration: 5, source: { kind: "external", absolutePath: "/tmp/v.mp4" }, hasAudio: false });
    ex.engine.timeline.tracks.push(videoTrack());
    await ex.execute("add_clips", { entries: [{ mediaRef: "v", trackIndex: 0, startFrame: 0, durationFrames: 50 }] });

    const xml = await ex.execute("export_project", { mode: "xml", outputPath: join(root, "o.xml") });
    expect(xml.isError).toBeFalsy();
    expect(readFileSync(join(root, "o.xml"), "utf8")).toContain('<xmeml version="4">');

    const fcp = await ex.execute("export_project", { mode: "fcpxml", outputPath: join(root, "o.fcpxml") });
    expect(fcp.isError).toBeFalsy();
    expect(readFileSync(join(root, "o.fcpxml"), "utf8")).toContain('<fcpxml version="1.10">');

    const pal = await ex.execute("export_project", { mode: "kaestral", outputPath: join(root, "P.kaestral") });
    expect(pal.isError).toBeFalsy();
    expect(readFileSync(join(root, "P.kaestral", "project.json"), "utf8")).toContain('"fps"');
    // mode:video renders via FFmpeg — covered end-to-end in src/render/__tests__/render.test.ts.
  });

  it("export_project mode:'srt' writes SubRip captions from the timeline's text clips", async () => {
    const root = mkdtempSync(join(tmpdir(), "kaestral-srt-"));
    const ex = new McpExecutor({ fs: nodePackageFS(), projectDir: root });
    await ex.execute("add_texts", { entries: [
      { startFrame: 0, durationFrames: 30, content: "Hello" },
      { startFrame: 60, durationFrames: 30, content: "World" },
    ] });
    const out = join(root, "captions.srt");
    const r = await ex.execute("export_project", { mode: "srt", outputPath: out });
    expect(r.isError).toBeFalsy();
    const srt = readFileSync(out, "utf8");
    expect(srt).toContain("1\n00:00:00,000 --> 00:00:01,000\nHello");
    expect(srt).toContain("World");
    // A timeline with no captions gives a clear error, not an empty file.
    const empty = new McpExecutor({ fs: nodePackageFS(), projectDir: root });
    const er = await empty.execute("export_project", { mode: "srt", outputPath: join(root, "none.srt") });
    expect(er.isError).toBe(true);
    expect(er.content[0].text).toMatch(/no caption/i);
  });

  it("mcp-8: export_project overwrite:false refuses to clobber an existing destination", async () => {
    const root = mkdtempSync(join(tmpdir(), "kaestral-ovw-"));
    const ex = new McpExecutor({ fs: nodePackageFS(), projectDir: root });
    ex.media.addAsset({ id: "v", name: "v.mp4", type: "video", duration: 5, source: { kind: "external", absolutePath: "/tmp/v.mp4" }, hasAudio: false });
    ex.engine.timeline.tracks.push(videoTrack());
    await ex.execute("add_clips", { entries: [{ mediaRef: "v", trackIndex: 0, startFrame: 0, durationFrames: 50 }] });
    const out = join(root, "o.xml");
    expect((await ex.execute("export_project", { mode: "xml", outputPath: out })).isError).toBeFalsy();
    const first = readFileSync(out, "utf8");
    const blocked = await ex.execute("export_project", { mode: "xml", outputPath: out, overwrite: false });
    expect(blocked.isError).toBe(true);
    expect(blocked.content[0].text).toMatch(/already exists/);
    expect(readFileSync(out, "utf8")).toBe(first); // untouched
  });
});

describe("Stage-D: MCP schema<->handler fixes (silent-failure + dropped-field bugs)", () => {
  it("mcp-4: mutations that changed nothing report an error, not phantom success", async () => {
    const ex = new McpExecutor();
    seed(ex); // one video track at index 0
    // insert onto a track that doesn't exist → nothing inserted (was reported as inserted:N).
    const ins = await ex.execute("insert_clips", { trackIndex: 9, atFrame: 0, entries: [{ mediaRef: "vid1" }] });
    expect(ins.isError).toBe(true);
    // add onto a track that doesn't exist → nothing added.
    const add = await ex.execute("add_clips", { entries: [{ mediaRef: "vid1", trackIndex: 9, startFrame: 0, durationFrames: 30 }] });
    expect(add.isError).toBe(true);
    // property/effect/text edits on clipIds that match nothing → error, not "Updated N".
    expect((await ex.execute("set_clip_properties", { clipIds: ["nope"], opacity: 0.5 })).isError).toBe(true);
    expect((await ex.execute("apply_color", { clipIds: ["nope"], exposure: 1 })).isError).toBe(true);
    expect((await ex.execute("update_text", { clipIds: ["nope"], content: "x" })).isError).toBe(true);
    expect((await ex.execute("set_keyframes", { clipId: "nope", property: "opacity", keyframes: [[0, 1]] })).isError).toBe(true);
  });

  it("mcp-2: add_texts applies the per-entry styling/transform/animation the schema advertises", async () => {
    const ex = new McpExecutor();
    const r = await ex.execute("add_texts", { entries: [{ startFrame: 0, durationFrames: 30, content: "HOOK", fontSize: 110, isBold: true, color: "#ff0000", animation: "popIn", transform: { centerX: 0.2 } }] });
    expect(r.isError).toBeFalsy();
    const clipId = JSON.parse(r.content[0].text).clipIds[0] as string;
    const c = ex.engine.clipRef(clipId)!;
    expect(c.textStyle!.fontSize).toBe(110);
    expect(c.textStyle!.isBold).toBe(true);
    expect(c.textStyle!.color).toEqual({ r: 1, g: 0, b: 0, a: 1 });
    expect(c.transform.centerX).toBe(0.2);
    expect(c.textAnimation!.preset).toBe("popIn");
  });

  it("mcp-1: update_text resolves captionGroupId to every clip in the group", async () => {
    const ex = new McpExecutor();
    const r = await ex.execute("add_texts", { entries: [
      { startFrame: 0, durationFrames: 20, content: "a" },
      { startFrame: 20, durationFrames: 20, content: "b" },
    ] });
    const ids = JSON.parse(r.content[0].text).clipIds as string[];
    for (const id of ids) ex.engine.clipRef(id)!.captionGroupId = "grp1";
    const up = await ex.execute("update_text", { captionGroupId: "grp1", content: "Z" });
    expect(up.isError).toBeFalsy();
    for (const id of ids) expect(ex.engine.clipRef(id)!.textContent).toBe("Z");
  });
});

describe("add_captions overlap-clamp (silent-caption-drop guard)", () => {
  it("shortens each caption to the next one's start so none overlap, and leaves gaps alone", () => {
    // caption 0 [0,20) would end at 20 but caption 1 starts at 15 → clamp 0 to [0,15).
    const specs = [
      { startFrame: 0, durationFrames: 20 },
      { startFrame: 15, durationFrames: 10 }, // ends 25; caption 2 starts 40 → gap, untouched
      { startFrame: 40, durationFrames: 8 },  // last — never clamped
    ];
    clampCaptionsToNextStart(specs);
    expect(specs[0].durationFrames).toBe(15); // clamped to next start
    expect(specs[1].durationFrames).toBe(10); // gap before next → unchanged
    expect(specs[2].durationFrames).toBe(8);  // last, unchanged
    // No two captions overlap now.
    for (let i = 0; i < specs.length - 1; i++) {
      expect(specs[i].startFrame + specs[i].durationFrames).toBeLessThanOrEqual(specs[i + 1].startFrame);
    }
  });
});

describe("Stage-D: per-tool argument-rejection guards (untested reject paths)", () => {
  const expectFail = async (ex: McpExecutor, tool: string, args: Record<string, unknown>, re: RegExp) => {
    const r = await ex.execute(tool, args);
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(re);
  };

  it("apply_layout rejects malformed requests with a clear message", async () => {
    const ex = new McpExecutor();
    seed(ex);
    await expectFail(ex, "apply_layout", { layout: "nope", slots: [{ slot: "x" }] }, /unknown layout/);
    await expectFail(ex, "apply_layout", { layout: "side_by_side", fit: "stretch", slots: [{ slot: "left" }] }, /fit must be/);
    await expectFail(ex, "apply_layout", { layout: "full", slots: [{ slot: "main", mediaRef: "vid1", clipIds: ["c"], durationFrames: 30 }] }, /exactly one of/);
    await expectFail(ex, "apply_layout", { layout: "side_by_side", slots: [{ slot: "left", mediaRef: "vid1", durationFrames: 30 }] }, /Missing: right/);
    await expectFail(ex, "apply_layout", { layout: "side_by_side", slots: [{ slot: "left", mediaRef: "vid1", durationFrames: 30 }, { slot: "right", clipIds: ["c"] }] }, /don't mix/);
    await expectFail(ex, "apply_layout", { layout: "full", durationFrames: 30, slots: [{ slot: "main", mediaRef: "ghost" }] }, /asset not found/);
  });

  it("add_clips / ripple_delete_ranges reject contradictory args", async () => {
    const ex = new McpExecutor();
    seed(ex);
    await expectFail(ex, "add_clips", { entries: [] }, /entries is required/);
    await expectFail(ex, "add_clips", { entries: [{ mediaRef: "vid1", startFrame: 0, durationFrames: 30, trimEndFrame: 10 }] }, /mutually exclusive/);
    await expectFail(ex, "add_clips", { entries: [{ mediaRef: "vid1", startFrame: 0, durationFrames: 30, trackIndex: 0 }, { mediaRef: "vid1", startFrame: 40, durationFrames: 30 }] }, /every entry or none/);
    await expectFail(ex, "ripple_delete_ranges", { ranges: [[0, 10]] }, /exactly one of/);
    await expectFail(ex, "ripple_delete_ranges", { trackIndex: 0, units: "seconds", ranges: [[0, 10]] }, /requires units 'frames'/);
  });
});

// Field report (v1.0.5): add_clips without trackIndex went to the first visual track and OVERWROTE
// it — one full-length band overlay erased all 12 of a user's cut clips; add_texts did the same on
// the very next call. Placement must be non-destructive by default.
describe("A1: non-destructive placement (add_clips / add_texts)", () => {
  /** Three butted 100-frame cuts on V1 (the "12 cut clips" of the field report, in miniature). */
  async function seedCuts(ex: McpExecutor): Promise<string[]> {
    seed(ex);
    const entries = [0, 100, 200].map((startFrame) => ({ mediaRef: "vid1", trackIndex: 0, startFrame, durationFrames: 100 }));
    await ex.execute("add_clips", { entries });
    return ex.timeline.tracks[0].clips.map((c) => c.id);
  }

  it("add_clips without trackIndex auto-routes a destructive overlay to a NEW track, keeping every cut", async () => {
    const ex = new McpExecutor();
    const cutIds = await seedCuts(ex);
    expect(cutIds.length).toBe(3);
    const r = await ex.execute("add_clips", { entries: [{ mediaRef: "vid1", startFrame: 0, durationFrames: 300 }] });
    expect(r.isError, r.content[0].text).toBeFalsy();
    const out = JSON.parse(r.content[0].text) as { added: number; routedToNewTrack?: boolean; clips: { trackIndex: number }[] };
    expect(out.routedToNewTrack).toBe(true);
    // Every original cut survives, untouched, on its own track.
    const survivors = ex.timeline.tracks.flatMap((t) => t.clips).filter((c) => cutIds.includes(c.id));
    expect(survivors.map((c) => [c.startFrame, c.durationFrames])).toEqual([[0, 100], [100, 100], [200, 100]]);
    // The overlay landed on a different (new) visual track.
    const overlayTrack = ex.timeline.tracks[out.clips[0].trackIndex];
    expect(overlayTrack.clips.some((c) => cutIds.includes(c.id))).toBe(false);
    expect(overlayTrack.clips[0].durationFrames).toBe(300);
    expect(ex.timeline.tracks.filter((t) => t.type === "video").length).toBe(2);
  });

  it("add_clips without trackIndex still uses the existing track when nothing overlaps", async () => {
    const ex = new McpExecutor();
    await seedCuts(ex);
    const r = await ex.execute("add_clips", { entries: [{ mediaRef: "vid1", startFrame: 300, durationFrames: 50 }] });
    expect(r.isError).toBeFalsy();
    const out = JSON.parse(r.content[0].text) as { routedToNewTrack?: boolean };
    expect(out.routedToNewTrack).toBeFalsy();
    expect(ex.timeline.tracks.filter((t) => t.type === "video").length).toBe(1);
    expect(ex.timeline.tracks[0].clips.length).toBe(4);
  });

  it("add_clips with an explicit trackIndex refuses a destructive placement unless overwrite:true", async () => {
    const ex = new McpExecutor();
    const cutIds = await seedCuts(ex);
    const r = await ex.execute("add_clips", { entries: [{ mediaRef: "vid1", trackIndex: 0, startFrame: 50, durationFrames: 100 }] });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/add_clips: would overwrite 2 existing clip\(s\) on track 0/);
    expect(r.content[0].text).toMatch(/overwrite:true/);
    // Nothing changed.
    expect(ex.timeline.tracks[0].clips.map((c) => c.id)).toEqual(cutIds);

    const ok = await ex.execute("add_clips", { entries: [{ mediaRef: "vid1", trackIndex: 0, startFrame: 50, durationFrames: 100 }], overwrite: true });
    expect(ok.isError, ok.content[0].text).toBeFalsy();
    // Overwrite semantics as before: clip A trimmed to 50, clip B trim-started to 150.
    const clips = ex.timeline.tracks[0].clips.map((c) => [c.startFrame, c.durationFrames]);
    expect(clips).toEqual([[0, 50], [50, 100], [150, 50], [200, 100]]);
  });

  it("add_texts without trackIndex auto-routes onto a NEW text track instead of overwriting captions", async () => {
    const ex = new McpExecutor();
    const first = await ex.execute("add_texts", { entries: [
      { startFrame: 0, durationFrames: 30, content: "one" },
      { startFrame: 30, durationFrames: 30, content: "two" },
    ] });
    const capIds = JSON.parse(first.content[0].text).clipIds as string[];
    const r = await ex.execute("add_texts", { entries: [{ startFrame: 0, durationFrames: 60, content: "BAND" }] });
    expect(r.isError, r.content[0].text).toBeFalsy();
    const out = JSON.parse(r.content[0].text) as { routedToNewTrack?: boolean; clipIds: string[] };
    expect(out.routedToNewTrack).toBe(true);
    for (const id of capIds) expect(ex.engine.clipRef(id)?.durationFrames).toBe(30);
    expect(ex.timeline.tracks.filter((t) => t.type === "text").length).toBe(2);
  });

  it("add_texts with an explicit trackIndex refuses a destructive placement unless overwrite:true", async () => {
    const ex = new McpExecutor();
    const first = await ex.execute("add_texts", { entries: [{ startFrame: 0, durationFrames: 30, content: "one" }] });
    const capId = (JSON.parse(first.content[0].text).clipIds as string[])[0];
    const r = await ex.execute("add_texts", { entries: [{ trackIndex: 0, startFrame: 10, durationFrames: 10, content: "x" }] });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/add_texts: would overwrite 1 existing clip\(s\) on track 0/);
    expect(ex.engine.clipRef(capId)?.durationFrames).toBe(30);
    const ok = await ex.execute("add_texts", { entries: [{ trackIndex: 0, startFrame: 10, durationFrames: 10, content: "x" }], overwrite: true });
    expect(ok.isError).toBeFalsy();
    expect(ex.timeline.tracks[0].clips.length).toBe(3); // split into left + x + right
  });
});
