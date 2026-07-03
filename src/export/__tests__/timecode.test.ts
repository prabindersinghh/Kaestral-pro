import { describe, it, expect } from "vitest";
import { formatTimecode, timecodeTags } from "../timecode";

// Mirrors Tests/PalmierProTests/Export/XMLExporterTimecodeTests.swift exactly.

describe("timecodeTags follows the track, not the video rate", () => {
  it("non-drop source emits non-drop timecode regardless of video NTSC", () => {
    const tc = timecodeTags({ frame: 1968620, quanta: 30, dropFrame: false }, 30, true);
    expect(tc.base).toBe(30);
    expect(tc.ntsc).toBe(true);
    expect(tc.dropFrame).toBe(false);
    expect(tc.string).toBe("18:13:40:20");
    expect(tc.string.includes(";")).toBe(false);
  });

  it("drop-frame source on 60p uses track quanta not video rate", () => {
    const tc = timecodeTags({ frame: 42966, quanta: 30, dropFrame: true }, 60, true);
    expect(tc.base).toBe(30);
    expect(tc.dropFrame).toBe(true);
    expect(tc.frame).toBe(42966);
    expect(tc.string).toBe("00;23;53;18");
  });

  it("clean 30fps source stays non-NTSC", () => {
    const tc = timecodeTags({ frame: 0, quanta: 30, dropFrame: false }, 30, false);
    expect(tc.ntsc).toBe(false);
    expect(tc.string).toBe("00:00:00:00");
  });

  it("no timecode track falls back to video rate and zero", () => {
    const tc = timecodeTags(null, 30, true);
    expect(tc.frame).toBe(0);
    expect(tc.base).toBe(30);
    expect(tc.dropFrame).toBe(true);
    expect(tc.string).toBe("00;00;00;00");
  });
});

describe("formatTimecode math", () => {
  it("non-drop formatting rolls fields at fps", () => {
    expect(formatTimecode(0, 25, false)).toBe("00:00:00:00");
    expect(formatTimecode(1688098, 25, false)).toBe("18:45:23:23");
    expect(formatTimecode(24 * 3600, 24, false)).toBe("01:00:00:00");
  });

  it("drop-frame skips dropped frame numbers", () => {
    expect(formatTimecode(0, 30, true)).toBe("00;00;00;00");
    expect(formatTimecode(42966, 30, true)).toBe("00;23;53;18");
  });

  it("zero fps does not crash", () => {
    expect(formatTimecode(100, 0, false)).toBe("00:00:00:00");
  });
});
