import { describe, it, expect } from "vitest";
import { EditEngine } from "../editEngine";
import { encodeTimeline } from "../../model/codec";
import { sampleTrack } from "../../model/helpers";
import { defaultClip, defaultTrack, defaultTimeline } from "../../model/defaults";
import type { Clip, Timeline, Track } from "../../model/types";
import type { ClipType } from "../../model/enums";

function clip(id: string, start: number, dur: number, extra: Partial<Clip> = {}): Clip {
  const mediaType = (extra.mediaType ?? "video") as ClipType;
  return {
    ...defaultClip({ mediaRef: extra.mediaRef ?? "m", startFrame: start, durationFrames: dur, id, mediaType }),
    ...extra,
  };
}
function track(type: ClipType, id: string, clips: Clip[], extra: Partial<Track> = {}): Track {
  return { ...defaultTrack(type, id), clips, ...extra };
}
function timeline(tracks: Track[]): Timeline {
  return { ...defaultTimeline(), tracks };
}

describe("Stage-B invariant: ripple delete + sync-lock refusal", () => {
  // Genuine refusal lives in the selection path (rippleDeleteClips), where a sync-locked track
  // with no own removals is SHIFTED (not cut) and can therefore collide.
  function setup(): EditEngine {
    const t0 = track("video", "t0", [clip("A", 0, 50)]);
    const t1 = track("video", "t1", [clip("C1", 0, 100), clip("C2", 100, 50)]);
    return new EditEngine(timeline([t0, t1]));
  }

  it("refuses (no change) when a sync-locked follower can't absorb the shift", () => {
    const eng = setup();
    const before = JSON.stringify(encodeTimeline(eng.timeline));
    // Deleting A [0,50) shifts C2 (100→50) into C1 (ends 100) on the sync-locked track.
    const out = eng.rippleDeleteClips(["A"]);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toMatch(/room to ripple/);
    expect(JSON.stringify(encodeTimeline(eng.timeline))).toBe(before);
    expect(eng.canUndo).toBe(false);
  });

  it("succeeds once the blocking track is unlocked (not sync-locked)", () => {
    const eng = setup();
    eng.timeline.tracks[1].syncLocked = false;
    const out = eng.rippleDeleteClips(["A"]);
    expect(out.ok).toBe(true);
    expect(eng.clipRef("A")).toBeNull();
    // Unlocked track left untouched.
    expect(eng.timeline.tracks.find((t) => t.id === "t1")!.clips.map((c) => c.startFrame)).toEqual([0, 100]);
  });

  it("the tool path (rippleDeleteRangesOnTrack) CUTS sync-locked tracks instead of refusing", () => {
    const eng = new EditEngine(
      timeline([
        track("video", "t0", [clip("A", 0, 200)]),
        track("video", "t1", [clip("C1", 0, 100), clip("C2", 100, 50)]),
      ]),
    );
    const out = eng.rippleDeleteRangesOnTrack(0, [{ start: 20, end: 30 }]);
    expect(out.ok).toBe(true); // never refuses in the all-sync-locked case
    if (out.ok) expect(out.report.removedFrames).toBe(10);
    // Sync-locked track had [20,30) cut out and its gap closed: total shrinks 150 → 140.
    const t1 = eng.timeline.tracks.find((t) => t.id === "t1")!;
    expect(t1.clips.reduce((s, c) => s + c.durationFrames, 0)).toBe(140);
  });
});

describe("Stage-B invariant: linked A/V propagation", () => {
  function linkedAV(): EditEngine {
    const v = clip("V", 0, 50, { linkGroupId: "g" });
    const a = clip("A", 0, 50, { mediaType: "audio", linkGroupId: "g" });
    return new EditEngine(timeline([track("video", "t0", [v]), track("audio", "t1", [a])]));
  }

  it("moving a clip moves its linked partner by the same delta", () => {
    const eng = linkedAV();
    eng.moveClips([{ clipId: "V", toFrame: 100 }]);
    expect(eng.clipRef("V")!.startFrame).toBe(100);
    expect(eng.clipRef("A")!.startFrame).toBe(100); // partner followed, stayed on its track
    expect(eng.findClip("A")!.trackIndex).toBe(1);
  });

  it("removing a clip removes its whole link group", () => {
    const eng = linkedAV();
    eng.removeClips(["V"]);
    expect(eng.clipRef("V")).toBeNull();
    expect(eng.clipRef("A")).toBeNull();
  });

  it("splitting a clip splits its partner at the same frame and regroups the right halves", () => {
    const eng = linkedAV();
    eng.splitClips([{ clipId: "V", atFrame: 25 }]);
    const vClips = eng.timeline.tracks[0].clips;
    const aClips = eng.timeline.tracks[1].clips;
    expect(vClips.map((c) => c.startFrame).sort((x, y) => x - y)).toEqual([0, 25]);
    expect(aClips.map((c) => c.startFrame).sort((x, y) => x - y)).toEqual([0, 25]);
    const vRight = vClips.find((c) => c.startFrame === 25)!;
    const aRight = aClips.find((c) => c.startFrame === 25)!;
    // Right halves share a NEW link group; left halves keep the original.
    expect(vRight.linkGroupId).toBe(aRight.linkGroupId);
    expect(vRight.linkGroupId).not.toBe("g");
    expect(vClips.find((c) => c.startFrame === 0)!.linkGroupId).toBe("g");
  });

  it("ripple delete cuts the linked partner's track on the same range (A/V stays in sync)", () => {
    const eng = new EditEngine(
      timeline([
        track("video", "t0", [clip("V", 0, 50, { linkGroupId: "g" }), clip("B", 50, 50)]),
        track("audio", "t1", [clip("A", 0, 50, { mediaType: "audio", linkGroupId: "g" })]),
      ]),
    );
    const out = eng.rippleDeleteRangesOnTrack(0, [{ start: 10, end: 20 }]);
    expect(out.ok).toBe(true);
    // Both lanes cut identically: V and A had the same span, so post-cut layouts match.
    const lane = (ti: number) =>
      eng.timeline.tracks[ti].clips
        .filter((c) => c.mediaRef === "m")
        .map((c) => [c.startFrame, c.durationFrames])
        .sort((x, y) => x[0] - y[0]);
    // audio lane (A) equals the V-derived clips on the video lane (exclude B)
    const videoAV = eng.timeline.tracks[0].clips
      .filter((c) => c.startFrame < 40)
      .map((c) => [c.startFrame, c.durationFrames])
      .sort((x, y) => x[0] - y[0]);
    expect(lane(1)).toEqual(videoAV);
  });

  it("commitTrim propagates trim to the linked partner", () => {
    const eng = linkedAV();
    eng.commitTrim("V", "left", 10, true);
    expect(eng.clipRef("V")!.trimStartFrame).toBe(10);
    expect(eng.clipRef("A")!.trimStartFrame).toBe(10);
  });
});

describe("Stage-B invariant: trim measured in PROJECT frames (converted via speed)", () => {
  it("a project-frame edge drag maps to source frames by ×speed, back to timeline by ÷speed", () => {
    const eng = new EditEngine(timeline([track("video", "t0", [clip("V", 100, 50, { speed: 2 })])]));
    // Left edge in by 10 project frames on a 2× clip.
    eng.commitTrim("V", "left", 10, false);
    const v = eng.clipRef("V")!;
    expect(v.trimStartFrame).toBe(20); // source: round(10 × 2)
    expect(v.startFrame).toBe(110); // timeline: 100 + round(20 / 2)
    expect(v.durationFrames).toBe(40); // 50 - 10
  });

  it("trimClips (absolute source values) recomputes duration/startFrame in project frames", () => {
    const eng = new EditEngine(timeline([track("video", "t0", [clip("V", 100, 50, { speed: 2 })])]));
    eng.trimClips([{ clipId: "V", trimStartFrame: 20, trimEndFrame: 0 }]);
    const v = eng.clipRef("V")!;
    expect(v.startFrame).toBe(110);
    expect(v.durationFrames).toBe(40);
  });
});

describe("Stage-B invariant: clip-relative keyframes", () => {
  it("setKeyframes stores clip-relative frames; they follow the clip on move", () => {
    const eng = new EditEngine(timeline([track("video", "t0", [clip("V", 100, 100)])]));
    eng.setKeyframes("V", "opacity", [
      { frame: 0, value: 0, interpolationOut: "linear" },
      { frame: 50, value: 1, interpolationOut: "smooth" },
    ]);
    expect(eng.clipRef("V")!.opacityTrack!.keyframes.map((k) => k.frame)).toEqual([0, 50]);

    eng.moveClips([{ clipId: "V", toFrame: 300 }]);
    // Frames are clip-relative — unchanged by the move.
    expect(eng.clipRef("V")!.startFrame).toBe(300);
    expect(eng.clipRef("V")!.opacityTrack!.keyframes.map((k) => k.frame)).toEqual([0, 50]);
    // Sampling at clip-relative 25 (linear 0→1 over 0..50) = 0.5.
    expect(sampleTrack(eng.clipRef("V")!.opacityTrack!, 25, 1)).toBeCloseTo(0.5);
  });

  it("volume keyframes are stored in dB; rows are sorted and de-duplicated last-wins", () => {
    const eng = new EditEngine(timeline([track("video", "t0", [clip("V", 0, 48)])]));
    eng.setKeyframes("V", "volume", [
      { frame: 24, value: -6, interpolationOut: "smooth" },
      { frame: 0, value: 0, interpolationOut: "smooth" },
      { frame: 24, value: -3, interpolationOut: "smooth" }, // dup frame → last wins
    ]);
    const kfs = eng.clipRef("V")!.volumeTrack!.keyframes;
    expect(kfs.map((k) => [k.frame, k.value])).toEqual([[0, 0], [24, -3]]);
  });

  it("empty keyframes array clears the track", () => {
    const eng = new EditEngine(timeline([track("video", "t0", [clip("V", 0, 48)])]));
    eng.setKeyframes("V", "opacity", [{ frame: 0, value: 0.5, interpolationOut: "smooth" }]);
    expect(eng.clipRef("V")!.opacityTrack).toBeDefined();
    eng.setKeyframes("V", "opacity", []);
    expect(eng.clipRef("V")!.opacityTrack).toBeUndefined();
  });
});

describe("Stage-B core: add/insert/speed/undo", () => {
  it("add_clips overwrites overlapping content on the same track", () => {
    const eng = new EditEngine(timeline([track("video", "t0", [clip("A", 0, 100)])]));
    eng.addClips([{ mediaRef: "m2", trackIndex: 0, startFrame: 40, durationFrames: 20 }]);
    // A is split by the new clip; new clip sits in [40,60).
    const starts = eng.timeline.tracks[0].clips.map((c) => c.startFrame).sort((x, y) => x - y);
    expect(starts).toEqual([0, 40, 60]);
  });

  it("insert_clips ripples existing clips right by the inserted duration", () => {
    const eng = new EditEngine(timeline([track("video", "t0", [clip("A", 0, 50), clip("B", 50, 50)])]));
    eng.insertClips([{ mediaRef: "m2", durationFrames: 30 }], 0, 50);
    // B (at 50) pushed to 80; new clip lands at 50.
    const byStart = [...eng.timeline.tracks[0].clips].sort((a, b) => a.startFrame - b.startFrame);
    expect(byStart.map((c) => c.startFrame)).toEqual([0, 50, 80]);
    expect(byStart[2].id).toBe("B");
  });

  it("setClipSpeed rescales duration and ripples the contiguous chain", () => {
    const eng = new EditEngine(timeline([track("video", "t0", [clip("A", 0, 100), clip("B", 100, 50)])]));
    eng.setClipSpeed(["A"], 2); // 100 source frames at 2× → 50 timeline frames
    expect(eng.clipRef("A")!.durationFrames).toBe(50);
    expect(eng.clipRef("B")!.startFrame).toBe(50); // contiguous B pulled back by 50
  });

  it("undo reverts the most recent edit", () => {
    const eng = new EditEngine(timeline([track("video", "t0", [clip("A", 0, 100)])]));
    const before = JSON.stringify(encodeTimeline(eng.timeline));
    eng.removeClips(["A"]);
    expect(JSON.stringify(encodeTimeline(eng.timeline))).not.toBe(before);
    const name = eng.undo();
    expect(name).toBe("Remove Clip");
    expect(JSON.stringify(encodeTimeline(eng.timeline))).toBe(before);
  });
});
