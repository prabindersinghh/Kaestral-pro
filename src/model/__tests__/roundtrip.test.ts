import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { decodeTimeline, encodeTimeline, decodeTransform } from "../codec";
import { decodeManifest, encodeManifest } from "../media";
import { MediaLibrary } from "../../mcp/mediaLibrary";
import { nodePackageFS } from "../../project/nodeFs";
import { readProjectPackage, writeProjectPackage, PROJECT } from "../../project/package";

function fixture(name: string): string {
  return readFileSync(new URL(`../../../fixtures/${name}`, import.meta.url), "utf8");
}

const rawProject = JSON.parse(fixture("golden-project.json"));
const rawMedia = JSON.parse(fixture("golden-media.json"));

describe("Stage-A gate (a): golden fixture decode→encode is semantically lossless", () => {
  it("project.json round-trips with no loss and no spurious default-omission", () => {
    const reencoded = encodeTimeline(decodeTimeline(rawProject));
    // Deep-equal against the source-derived fixture. Because the fixture carries every
    // non-optional field plus the present optionals, equality holds ONLY if the writer
    // emits all non-optionals and omits exactly the nil optionals (SPEC §0.2).
    expect(reencoded).toEqual(rawProject);
  });

  it("the default-valued non-optionals on clip-audio-1 are NOT dropped", () => {
    const tl = decodeTimeline(rawProject);
    const audio = encodeTimeline(tl) as any;
    const clip = audio.tracks[1].clips[0];
    // All at their defaults, yet every one must still be present.
    expect(clip.volume).toBe(1);
    expect(clip.opacity).toBe(1);
    expect(clip.fadeInFrames).toBe(0);
    expect(clip.fadeInInterpolation).toBe("linear");
    expect(clip.transform).toEqual({
      centerX: 0.5, centerY: 0.5, width: 1, height: 1, rotation: 0,
      flipHorizontal: false, flipVertical: false,
    });
    expect(clip.crop).toEqual({ left: 0, top: 0, right: 0, bottom: 0 });
  });

  it("media.json round-trips with both MediaSource variants intact", () => {
    const reencoded = encodeManifest(decodeManifest(rawMedia));
    expect(reencoded).toEqual(rawMedia);
  });
});

describe("Stage-A gate: .kaestral package load/save round-trip (Node FS)", () => {
  it("writes then reads a package, preserving project.json and media.json semantically", async () => {
    const fs = nodePackageFS();
    const root = mkdtempSync(join(tmpdir(), "kaestral-"));
    const dirA = join(root, `Golden.${PROJECT.fileExtension}`);

    // Seed package A directly from the golden fixtures.
    await fs.writeText(join(dirA, PROJECT.timelineFilename), fixture("golden-project.json"));
    await fs.writeText(join(dirA, PROJECT.manifestFilename), fixture("golden-media.json"));

    const contents = await readProjectPackage(fs, dirA);
    expect(contents.manifestUnreadable).toBe(false);
    expect(contents.manifest).not.toBeNull();

    // Save to a second package, then re-read and compare to the originals.
    const dirB = join(root, `Golden Copy.${PROJECT.fileExtension}`);
    await writeProjectPackage(fs, dirB, contents);
    const reread = await readProjectPackage(fs, dirB);

    expect(encodeTimeline(reread.timeline)).toEqual(rawProject);
    expect(encodeManifest(reread.manifest!)).toEqual(rawMedia);
  });

  it("throws on a package missing project.json", async () => {
    const fs = nodePackageFS();
    const root = mkdtempSync(join(tmpdir(), "kaestral-"));
    const dir = join(root, `Empty.${PROJECT.fileExtension}`);
    await fs.ensureDir(dir);
    await expect(readProjectPackage(fs, dir)).rejects.toThrow(/project\.json/);
  });

  it("throws a clean 'Corrupt project' error on a present-but-malformed project.json (not a raw SyntaxError)", async () => {
    const fs = nodePackageFS();
    const root = mkdtempSync(join(tmpdir(), "kaestral-"));
    const dir = join(root, `Bad.${PROJECT.fileExtension}`);
    await fs.writeText(join(dir, PROJECT.timelineFilename), "not json {");
    await expect(readProjectPackage(fs, dir)).rejects.toThrow(/Corrupt project/);
  });
});

describe("Stage-A sweep fixes: legacy transform migration + media provenance passthrough", () => {
  it("migrates a legacy top-left x/y to a CENTER using +size/2 (was wrong for scaled clips)", () => {
    // A half-size clip at the top-left origin: its center is (0.25, 0.25), not (0,0).
    const t = decodeTransform({ x: 0, y: 0, width: 0.5, height: 0.5 });
    expect(t.centerX).toBeCloseTo(0.25, 6);
    expect(t.centerY).toBeCloseTo(0.25, 6);
    // Full-frame legacy clips are unaffected (both formulas agree at width/height === 1).
    const full = decodeTransform({ x: 0, y: 0, width: 1, height: 1 });
    expect(full.centerX).toBeCloseTo(0.5, 6);
  });

  it("MediaLibrary.toManifest preserves opaque provenance (generationInput/importInput/cachedRemoteURL) through load→save", () => {
    const raw = {
      version: 2,
      entries: [{
        id: "a1", name: "gen.mp4", type: "video", duration: 4,
        source: { kind: "external", absolutePath: "/g.mp4" },
        generationInput: { prompt: "a cat", model: "veo" },
        importInput: { url: "https://x/y" },
        cachedRemoteURL: "https://cache/z.mp4",
        cachedRemoteURLExpiresAt: "2030-01-01T00:00:00.000Z",
      }],
      folders: [],
    };
    // Load into a MediaLibrary the way the server does, then re-encode from toManifest().
    const media = new MediaLibrary();
    media.assets = decodeManifest(raw).entries.map((e) => ({
      id: e.id, name: e.name, type: e.type, duration: e.duration, source: e.source,
      folderId: e.folderId, sourceWidth: e.sourceWidth, sourceHeight: e.sourceHeight,
      sourceFPS: e.sourceFPS, hasAudio: e.hasAudio, generationStatus: e.generationStatus,
      generationInput: e.generationInput, importInput: e.importInput,
      cachedRemoteURL: e.cachedRemoteURL, cachedRemoteURLExpiresAt: e.cachedRemoteURLExpiresAt,
    }));
    const out = encodeManifest(decodeManifest(encodeManifest(media.toManifest())));
    expect(out).toEqual(encodeManifest(decodeManifest(raw)));
  });
});
