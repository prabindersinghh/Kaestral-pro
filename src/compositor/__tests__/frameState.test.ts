import { describe, it, expect } from "vitest";
import { composeFrame, blendToCanvas } from "../frameState";
import { defaultClip, defaultTrack, defaultTimeline } from "../../model/defaults";
import type { Clip, Timeline, Track } from "../../model/types";
import type { ClipType } from "../../model/enums";

function clip(id: string, start: number, dur: number, type: ClipType = "video", over: Partial<Clip> = {}): Clip {
  return { ...defaultClip({ mediaRef: "m", startFrame: start, durationFrames: dur, id, mediaType: type }), ...over };
}
function tl(tracks: Track[]): Timeline {
  return { ...defaultTimeline(), tracks };
}
const vt = (id: string, clips: Clip[], over: Partial<Track> = {}) => ({ ...defaultTrack("video", id), clips, ...over });
const tt = (id: string, clips: Clip[]) => ({ ...defaultTrack("text", id), clips });
const at = (id: string, clips: Clip[]) => ({ ...defaultTrack("audio", id), clips });

describe("compositor frame state (FrameRenderer / CompositionBuilder.affineTransform)", () => {
  it("stacks visual tracks bottom→top (top track drawn last)", () => {
    const t = tl([
      tt("t-title", [clip("title", 0, 100, "text", { textContent: "Hi" })]),
      vt("t-main", [clip("hero", 0, 100)]),
      at("t-audio", [clip("aud", 0, 100, "audio")]),
    ]);
    const layers = composeFrame(t, 50);
    expect(layers.map((l) => l.clip.id)).toEqual(["hero", "title"]); // bottom (main) first, top (text) last
  });

  it("excludes audio tracks and clips not covering the frame", () => {
    const t = tl([vt("v", [clip("a", 0, 20), clip("b", 40, 20)]), at("au", [clip("x", 0, 100, "audio")])]);
    expect(composeFrame(t, 10).map((l) => l.clip.id)).toEqual(["a"]);
    expect(composeFrame(t, 50).map((l) => l.clip.id)).toEqual(["b"]);
    expect(composeFrame(t, 30).map((l) => l.clip.id)).toEqual([]); // gap
  });

  it("skips hidden visual tracks", () => {
    const t = tl([vt("v", [clip("a", 0, 100)], { hidden: true })]);
    expect(composeFrame(t, 10)).toHaveLength(0);
  });

  it("resolves a full-canvas identity transform to x0 y0 w1 h1", () => {
    const t = tl([vt("v", [clip("a", 0, 100)])]);
    const [l] = composeFrame(t, 10);
    expect([l.x, l.y, l.w, l.h]).toEqual([0, 0, 1, 1]);
  });

  it("applies the fade envelope to opacity", () => {
    const c = clip("a", 0, 100);
    c.fadeInFrames = 10;
    c.fadeInInterpolation = "linear";
    const t = tl([vt("v", [c])]);
    expect(composeFrame(t, 5)[0].opacity).toBeCloseTo(0.5);
    expect(composeFrame(t, 50)[0].opacity).toBeCloseTo(1);
  });

  it("samples keyframed position (top-left) at a frame", () => {
    const c = clip("a", 0, 100);
    c.positionTrack = { keyframes: [
      { frame: 0, value: { a: 0, b: 0 }, interpolationOut: "linear" },
      { frame: 100, value: { a: 0.5, b: 0.25 }, interpolationOut: "linear" },
    ] };
    const t = tl([vt("v", [c])]);
    const [l] = composeFrame(t, 50); // halfway
    expect(l.x).toBeCloseTo(0.25);
    expect(l.y).toBeCloseTo(0.125);
  });

  it("blendToCanvas maps blend modes to canvas composite ops", () => {
    expect(blendToCanvas("normal")).toBe("source-over");
    expect(blendToCanvas("multiply")).toBe("multiply");
    expect(blendToCanvas("screen")).toBe("screen");
    expect(blendToCanvas("colorDodge")).toBe("color-dodge");
    expect(blendToCanvas("luminosity")).toBe("luminosity");
  });
});
