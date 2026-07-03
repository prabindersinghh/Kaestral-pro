import { describe, it, expect } from "vitest";
import { exportXMEML } from "../xml";
import { exportFCPXML } from "../fcpxml";
import { libraryResolver } from "../resolver";
import { MediaLibrary, type MediaAssetLite } from "../../mcp/mediaLibrary";
import { defaultClip, defaultTrack, defaultTimeline } from "../../model/defaults";
import type { Clip, Timeline, Track } from "../../model/types";
import type { ClipType } from "../../model/enums";

function lib(assets: (Omit<MediaAssetLite, "id"> & { id: string })[]): MediaLibrary {
  const m = new MediaLibrary();
  for (const a of assets) m.addAsset(a);
  return m;
}
function clip(id: string, start: number, dur: number, mediaRef: string, extra: Partial<Clip> = {}): Clip {
  const mediaType = (extra.mediaType ?? "video") as ClipType;
  return { ...defaultClip({ mediaRef, startFrame: start, durationFrames: dur, id, mediaType }), ...extra };
}
function tl(tracks: Track[], over: Partial<Timeline> = {}): Timeline {
  return { ...defaultTimeline(), ...over, tracks };
}
const vtrack = (id: string, clips: Clip[]) => ({ ...defaultTrack("video", id), clips });
const atrack = (id: string, clips: Clip[]) => ({ ...defaultTrack("audio", id), clips });

// ── XMEML (Premiere) ──────────────────────────────────────────────────────

describe("XMEML exporter (export_project mode:xml)", () => {
  it("emits the xmeml shell with sequence rate + canvas", () => {
    const xml = exportXMEML(tl([], { fps: 24, width: 1280, height: 720 }), libraryResolver(new MediaLibrary()));
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<xmeml version="4">');
    expect(xml).toContain('<sequence id="sequence-1">');
    expect(xml).toContain("<timebase>24</timebase>");
    expect(xml).toContain("<width>1280</width>");
    expect(xml).toContain("<height>720</height>");
    expect(xml).toContain("</xmeml>");
  });

  it("empty timeline → zero duration", () => {
    expect(exportXMEML(tl([]), libraryResolver(new MediaLibrary()))).toContain("<duration>0</duration>");
  });

  it("video clip emits clipitem with start/end/in/out + file", () => {
    const media = lib([{ id: "v", name: "MyVideo", type: "video", duration: 5, source: { kind: "external", absolutePath: "/tmp/v.mp4" }, hasAudio: false }]);
    const c = clip("c1", 10, 50, "v", { trimStartFrame: 5 });
    const xml = exportXMEML(tl([vtrack("t", [c])]), libraryResolver(media));
    expect(xml).toContain('<clipitem id="clipitem-c1">');
    expect(xml).toContain("<start>10</start>");
    expect(xml).toContain("<end>60</end>");
    expect(xml).toContain("<in>5</in>");
    expect(xml).toContain("<out>55</out>"); // trimStart 5 + sourceFramesConsumed(50)
    expect(xml).toContain("<name>MyVideo</name>");
    expect(xml).toContain('<file id="file-v-video">');
  });

  it("speed emits a Time Remap filter with speed×100", () => {
    const media = lib([{ id: "v", name: "v", type: "video", duration: 5, source: { kind: "external", absolutePath: "/tmp/v.mp4" }, hasAudio: false }]);
    const xml = exportXMEML(tl([vtrack("t", [clip("c", 0, 25, "v", { speed: 2 })])]), libraryResolver(media));
    expect(xml).toContain("Time Remap");
    expect(xml).toContain("<value>200.0000</value>");
  });

  it("opacity <1 emits an Opacity filter", () => {
    const media = lib([{ id: "v", name: "v", type: "video", duration: 5, source: { kind: "external", absolutePath: "/tmp/v.mp4" }, hasAudio: false }]);
    const xml = exportXMEML(tl([vtrack("t", [clip("c", 0, 25, "v", { opacity: 0.5 })])]), libraryResolver(media));
    expect(xml).toContain("<name>Opacity</name>");
    expect(xml).toContain("<value>50.0</value>");
  });

  it("linked A/V emit reciprocal <link> blocks", () => {
    const media = lib([{ id: "v", name: "v", type: "video", duration: 5, source: { kind: "external", absolutePath: "/tmp/v.mp4" }, hasAudio: true }]);
    const v = clip("vc", 0, 50, "v", { mediaType: "video", linkGroupId: "g" });
    const a = clip("ac", 0, 50, "v", { mediaType: "audio", linkGroupId: "g" });
    const xml = exportXMEML(tl([vtrack("tv", [v]), atrack("ta", [a])]), libraryResolver(media));
    expect(xml).toContain("<linkclipref>clipitem-vc</linkclipref>");
    expect(xml).toContain("<linkclipref>clipitem-ac</linkclipref>");
  });

  it("fade-in emits a start-black Cross Dissolve transition", () => {
    const media = lib([{ id: "v", name: "v", type: "video", duration: 5, source: { kind: "external", absolutePath: "/tmp/v.mp4" }, hasAudio: false }]);
    const xml = exportXMEML(tl([vtrack("t", [clip("c", 0, 50, "v", { fadeInFrames: 10 })])]), libraryResolver(media));
    expect(xml).toContain("<alignment>start-black</alignment>");
    expect(xml).toContain("Cross Dissolve");
  });
});

// ── FCPXML (Resolve / FCP) ────────────────────────────────────────────────

describe("FCPXML exporter (export_project mode:fcpxml)", () => {
  it("emits the fcpxml shell with sequence format + project", () => {
    const xml = exportFCPXML(tl([]), libraryResolver(new MediaLibrary()));
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<fcpxml version="1.10">');
    expect(xml).toContain('<format id="r1"');
    expect(xml).toContain('<project name="Timeline Export">');
    expect(xml).toContain("</fcpxml>");
  });

  it("video clip → ref-clip over a compound asset", () => {
    const media = lib([{ id: "v", name: "MyVid", type: "video", duration: 5, source: { kind: "external", absolutePath: "/tmp/v.mp4" }, sourceWidth: 1920, sourceHeight: 1080, hasAudio: false }]);
    const xml = exportFCPXML(tl([vtrack("t", [clip("c", 0, 50, "v")])]), libraryResolver(media));
    expect(xml).toContain('<asset id="asset1"');
    expect(xml).toContain('<media id="media1"');
    expect(xml).toContain("<ref-clip");
    expect(xml).toContain('ref="media1"');
    expect(xml).toContain('srcEnable="video"');
  });

  it("static volume ≠1 emits adjust-volume in dB", () => {
    const media = lib([{ id: "a", name: "a", type: "audio", duration: 5, source: { kind: "external", absolutePath: "/tmp/a.m4a" }, hasAudio: true }]);
    const xml = exportFCPXML(tl([atrack("t", [clip("c", 0, 50, "a", { mediaType: "audio", volume: 0.5 })])]), libraryResolver(media));
    expect(xml).toContain("adjust-volume");
    expect(xml).toContain('amount="-6'); // 20·log10(0.5) ≈ −6.0206
  });

  it("speed emits a timeMap", () => {
    const media = lib([{ id: "v", name: "v", type: "video", duration: 5, source: { kind: "external", absolutePath: "/tmp/v.mp4" }, hasAudio: false }]);
    const xml = exportFCPXML(tl([vtrack("t", [clip("c", 0, 25, "v", { speed: 2 })])]), libraryResolver(media));
    expect(xml).toContain("<timeMap");
    expect(xml).toContain('frameSampling="floor"');
  });

  it("text clip → title with a text-style-def", () => {
    const c = clip("t", 0, 30, "text-1", { mediaType: "text", textContent: "Hello" });
    const xml = exportFCPXML(tl([{ ...defaultTrack("text", "tt"), clips: [c] }]), libraryResolver(new MediaLibrary()));
    expect(xml).toContain("<title");
    expect(xml).toContain("<text-style-def");
    expect(xml).toContain(">Hello</text-style>");
    expect(xml).toContain('<effect id="titleBasic"');
  });

  it("time values are rational seconds", () => {
    const media = lib([{ id: "v", name: "v", type: "video", duration: 5, source: { kind: "external", absolutePath: "/tmp/v.mp4" }, hasAudio: false }]);
    // fps 30, clip at 15 frames → 15/30 = 1/2s.
    const xml = exportFCPXML(tl([vtrack("t", [clip("c", 15, 30, "v")])]), libraryResolver(media));
    expect(xml).toContain('offset="1/2s"');
  });
});
