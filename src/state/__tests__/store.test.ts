import { describe, it, expect } from "vitest";
import { EditorStore } from "../store";
import { MediaLibrary } from "../../mcp/mediaLibrary";
import { defaultClip, defaultTrack, defaultTimeline } from "../../model/defaults";
import type { AnimPair } from "../../model/types";

function fresh(): EditorStore {
  const media = new MediaLibrary();
  media.addAsset({ id: "v", name: "v.mp4", type: "video", duration: 4, source: { kind: "external", absolutePath: "/x.mp4" }, hasAudio: false });
  const clip = defaultClip({ mediaRef: "v", startFrame: 0, durationFrames: 60, id: "c" });
  const tl = { ...defaultTimeline(), tracks: [{ ...defaultTrack("video", "t"), clips: [clip] }] };
  return new EditorStore(tl, media);
}

describe("EditorStore — inspector + media ops (wired to the engine)", () => {
  it("editSelected sets opacity and clears its keyframe track", () => {
    const s = fresh();
    s.select("c");
    s.engine.setKeyframes("c", "opacity", [{ frame: 0, value: 0, interpolationOut: "smooth" }]);
    s.editSelected({ opacity: 0.4 });
    const c = s.engine.clipRef("c")!;
    expect(c.opacity).toBe(0.4);
    expect(c.opacityTrack).toBeUndefined();
  });

  it("editSelected speed rescales duration (set_clip_properties parity)", () => {
    const s = fresh();
    s.select("c");
    s.editSelected({ speed: 2 }); // 60 frames of source at 2× → 30 timeline frames
    expect(s.engine.clipRef("c")!.durationFrames).toBe(30);
  });

  it("editSelected transform merges partial fields", () => {
    const s = fresh();
    s.select("c");
    s.editSelected({ transform: { centerX: 0.3, width: 0.5 } });
    const t = s.engine.clipRef("c")!.transform;
    expect(t.centerX).toBe(0.3);
    expect(t.width).toBe(0.5);
    expect(t.centerY).toBe(0.5); // untouched
  });

  it("stampKeyframe writes a clip-relative keyframe of the current value at the playhead", () => {
    const s = fresh();
    s.select("c");
    s.setCurrentFrame(20);
    s.stampKeyframe("scale");
    const kfs = s.engine.clipRef("c")!.scaleTrack!.keyframes;
    expect(kfs).toHaveLength(1);
    expect(kfs[0].frame).toBe(20); // clip-relative (clip starts at 0)
    expect(kfs[0].value as AnimPair).toEqual({ a: 1, b: 1 }); // default full-size
  });

  it("clearKeyframes removes the track", () => {
    const s = fresh();
    s.select("c");
    s.setCurrentFrame(10);
    s.stampKeyframe("rotation");
    expect(s.engine.clipRef("c")!.rotationTrack).toBeDefined();
    s.clearKeyframes("rotation");
    expect(s.engine.clipRef("c")!.rotationTrack).toBeUndefined();
  });

  it("addMediaToTimeline places a clip at the playhead", () => {
    const s = fresh();
    s.setCurrentFrame(90);
    s.addMediaToTimeline("v");
    const clips = s.timeline.tracks[0].clips;
    expect(clips.length).toBe(2);
    expect(clips.some((c) => c.startFrame === 90 && c.mediaRef === "v")).toBe(true);
  });
});
