// XMEML 4 (Final Cut Pro 7 XML) exporter → Premiere Pro. Ported from Export/XMLExporter.swift.
// What transports: clip placement/trims, speed (Time Remap), volume (Audio Levels, static+kf),
// opacity (Opacity, static+kf), transform (Basic Motion), crop (Crop), fades (single-sided
// dissolve), linked A/V (<link>). What does NOT: text, flips, kf interpolation curves, effects.

import type { Clip, Timeline, Track } from "../model/types";
import { endFrame, sourceFramesConsumed, sourceDurationFrames } from "../model/helpers";

type FadeEdge = "left" | "right";
import { keyframeFrames, rawOpacityAt, rawVolumeAt, rotationAt, sizeAt, transformAt, cropAt } from "../model/clipSampling";
import { isVisual } from "../model/enums";
import {
  boolLeaf, el, elAttrs, leaf, render, type XmlNode,
} from "./xmlTree";
import { timecodeTags } from "./timecode";
import { lastPathComponent, premierePathURL, type ExportMediaResolver } from "./resolver";

const TICKS_PER_SECOND = 254_016_000_000n;

function secondsToFrame(seconds: number, fps: number): number {
  return Math.trunc(seconds * fps);
}
function fmt(value: number, places: number): string {
  return value.toFixed(places);
}

interface ClipAddress { trackIndex: number; clipIndex: number; isAudio: boolean }

export function exportXMEML(timeline: Timeline, resolver: ExportMediaResolver): string {
  return new Builder(timeline, resolver).build();
}

class Builder {
  private readonly fps: number;
  private readonly seqWidth: number;
  private readonly seqHeight: number;
  private emittedFiles = new Set<string>();
  private clipAddresses = new Map<string, ClipAddress>();
  private clipsByLinkGroup = new Map<string, Clip[]>();

  constructor(private readonly timeline: Timeline, private readonly resolver: ExportMediaResolver) {
    this.fps = timeline.fps;
    this.seqWidth = timeline.width;
    this.seqHeight = timeline.height;
  }

  build(): string {
    const videoTracks = this.timeline.tracks.filter((t) => isVisual(t.type)).reverse();
    const audioTracks = this.timeline.tracks.filter((t) => t.type === "audio");
    const sortedVideo = videoTracks.map((t) => this.sortEmittable(t));
    const sortedAudio = audioTracks.map((t) => this.sortEmittable(t));

    this.indexAddresses(sortedVideo, false);
    this.indexAddresses(sortedAudio, true);
    this.indexLinkGroups();

    const videoTrackNodes = videoTracks.map((t, i) => this.trackNode(t, sortedVideo[i], false));
    const audioTrackNodes = audioTracks.map((t, i) => this.trackNode(t, sortedAudio[i], true));

    const root = elAttrs("xmeml", [["version", "4"]], [
      elAttrs("sequence", [["id", "sequence-1"]], [
        leaf("name", "Timeline Export"),
        leaf("duration", totalFrames(this.timeline)),
        this.rate(this.fps),
        this.timecodeNode(),
        el("media", [
          el("video", [this.videoFormatNode(), ...videoTrackNodes]),
          el("audio", [leaf("numOutputChannels", 2), this.audioFormatNode(), this.audioOutputsNode(), ...audioTrackNodes]),
        ]),
      ]),
    ]);
    return '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE xmeml>\n' + render(root, 0);
  }

  private timecodeNode(): XmlNode {
    return el("timecode", [
      this.rate(this.fps),
      leaf("string", "00:00:00:00"),
      leaf("frame", 0),
      leaf("source", "source"),
      leaf("displayformat", "NDF"),
    ]);
  }

  private videoFormatNode(): XmlNode {
    return el("format", [el("samplecharacteristics", [
      leaf("width", this.seqWidth),
      leaf("height", this.seqHeight),
      boolLeaf("anamorphic", false),
      leaf("pixelaspectratio", "square"),
      leaf("fielddominance", "none"),
      this.rate(this.fps),
    ])]);
  }

  private audioFormatNode(): XmlNode {
    return el("format", [el("samplecharacteristics", [leaf("samplerate", 48000), leaf("depth", 16)])]);
  }

  private audioOutputsNode(): XmlNode {
    return el("outputs", [el("group", [
      leaf("index", 1), leaf("numchannels", 2), leaf("downmix", 0),
      el("channel", [leaf("index", 1)]), el("channel", [leaf("index", 2)]),
    ])]);
  }

  private trackNode(track: Track, sortedClips: Clip[], isAudio: boolean): XmlNode {
    const enabled = isAudio ? !track.muted : !track.hidden;
    const children: XmlNode[] = [boolLeaf("enabled", enabled), boolLeaf("locked", false)];
    for (const clip of sortedClips) {
      const fadeIn = this.fadeTransition(clip, "left", isAudio);
      if (fadeIn) children.push(fadeIn);
      children.push(this.clipItemNode(clip, isAudio));
      const fadeOut = this.fadeTransition(clip, "right", isAudio);
      if (fadeOut) children.push(fadeOut);
    }
    return el("track", children);
  }

  private clipItemNode(clip: Clip, isAudio: boolean): XmlNode {
    const sourceDuration = this.sourceDurationFramesFor(clip.mediaRef) ?? sourceDurationFrames(clip);
    const inPoint = clip.trimStartFrame;
    const outPoint = clip.trimStartFrame + sourceFramesConsumed(clip);

    const children: XmlNode[] = [
      leaf("masterclipid", this.masterclipId(clip, isAudio)),
      leaf("name", this.resolver.displayName(clip.mediaRef)),
      boolLeaf("enabled", true),
      leaf("duration", sourceDuration),
      this.rate(this.fps),
      leaf("start", clip.startFrame),
      leaf("end", endFrame(clip)),
      leaf("in", inPoint),
      leaf("out", outPoint),
      this.fileNode(clip.mediaRef, isAudio),
    ];
    const remap = this.timeRemapFilter(clip.speed, isAudio);
    if (remap) children.push(remap);
    children.push(...(isAudio ? this.volumeFilters(clip) : this.videoFilters(clip)));
    children.push(...this.linkNodes(clip));
    return elAttrs("clipitem", [["id", `clipitem-${clip.id}`]], children);
  }

  private masterclipId(clip: Clip, isAudio: boolean): string {
    if (clip.linkGroupId) return `masterclip-${clip.linkGroupId}`;
    return `masterclip-${clip.mediaRef}-${isAudio ? "audio" : "video"}`;
  }

  private fileNode(mediaRef: string, isAudio: boolean): XmlNode {
    const fileId = `file-${mediaRef}-${isAudio ? "audio" : "video"}`;
    const key = `${mediaRef}|${isAudio}`;
    if (this.emittedFiles.has(key)) return elAttrs("file", [["id", fileId]]);
    this.emittedFiles.add(key);

    const entry = this.resolver.entry(mediaRef);
    const path = this.resolver.resolvePath(mediaRef);
    const fileName = path ? lastPathComponent(path) : entry?.name ?? mediaRef;
    const pathUrl = path ? premierePathURL(path) : `media/${mediaRef}`;
    const isImage = entry?.type === "image";
    const durationFrames = isImage ? 1 : entry ? Math.max(0, secondsToFrame(entry.duration, this.fps)) : 0;
    const { timebase, ntsc } = this.rateTags(entry?.sourceFPS ?? this.fps);

    const media: XmlNode = isAudio
      ? el("media", [el("audio", [
          el("samplecharacteristics", [leaf("samplerate", 48000), leaf("depth", 16)]),
          leaf("channelcount", 2),
        ])])
      : el("media", [el("video", [
          ...(isImage ? [leaf("duration", 1)] : []),
          el("samplecharacteristics", [
            leaf("width", entry?.sourceWidth ?? this.seqWidth),
            leaf("height", entry?.sourceHeight ?? this.seqHeight),
            boolLeaf("anamorphic", false),
            leaf("pixelaspectratio", "square"),
            leaf("fielddominance", "none"),
            this.rate(timebase, ntsc),
          ]),
        ])]);

    const tc = timecodeTags(this.resolver.sourceTimecode(mediaRef), timebase, ntsc);
    const timecode = el("timecode", [
      this.rate(tc.base, tc.ntsc),
      leaf("string", tc.string),
      leaf("frame", tc.frame),
      leaf("displayformat", tc.dropFrame ? "DF" : "NDF"),
    ]);
    return elAttrs("file", [["id", fileId]], [
      leaf("name", fileName),
      leaf("pathurl", pathUrl),
      this.rate(timebase, ntsc),
      leaf("duration", durationFrames),
      timecode,
      media,
    ]);
  }

  private linkNodes(clip: Clip): XmlNode[] {
    if (!clip.linkGroupId) return [];
    const partners = this.clipsByLinkGroup.get(clip.linkGroupId);
    if (!partners || partners.length <= 1) return [];
    const out: XmlNode[] = [];
    for (const partner of partners) {
      const addr = this.clipAddresses.get(partner.id);
      if (!addr) continue;
      out.push(el("link", [
        leaf("linkclipref", `clipitem-${partner.id}`),
        leaf("mediatype", addr.isAudio ? "audio" : "video"),
        leaf("trackindex", addr.trackIndex),
        leaf("clipindex", addr.clipIndex),
      ]));
    }
    return out;
  }

  private fadeTransition(clip: Clip, edge: FadeEdge, isAudio: boolean): XmlNode | null {
    const frames = edge === "left" ? clip.fadeInFrames : clip.fadeOutFrames;
    if (frames <= 0) return null;
    let start: number, end: number, alignment: string, cutFrames: number;
    if (edge === "left") {
      start = clip.startFrame; end = clip.startFrame + frames; alignment = "start-black"; cutFrames = 0;
    } else {
      start = endFrame(clip) - frames; end = endFrame(clip); alignment = "end-black"; cutFrames = frames;
    }
    const children: XmlNode[] = [leaf("start", start), leaf("end", end), leaf("alignment", alignment)];
    if (isAudio) {
      children.push(this.rate(this.fps));
      children.push(this.effect("Cross Fade ( 0dB)", "KGAudioTransCrossFade0dB", "transition", "audio"));
    } else {
      const cutPointTicks = BigInt(cutFrames) * (TICKS_PER_SECOND / BigInt(this.fps));
      children.push(leaf("cutPointTicks", cutPointTicks.toString()));
      children.push(this.rate(this.fps));
      children.push(this.effect("Cross Dissolve", "Cross Dissolve", "transition", "video", "Dissolve", [
        leaf("wipecode", 0), leaf("wipeaccuracy", 100), leaf("startratio", 0), leaf("endratio", 1), boolLeaf("reverse", false),
      ]));
    }
    return el("transitionitem", children);
  }

  private timeRemapFilter(speed: number, isAudio: boolean): XmlNode | null {
    if (speed === 1.0) return null;
    return this.filter(this.effect("Time Remap", "timeremap", "motion", isAudio ? "audio" : "video", undefined, [
      this.parameter("variablespeed", "variablespeed", "0", "1", leaf("value", 0)),
      this.parameter("speed", "speed", "-100000", "100000", leaf("value", fmt(speed * 100, 4))),
      this.parameter("reverse", "reverse", undefined, undefined, boolLeaf("value", false)),
      this.parameter("frameblending", "frameblending", undefined, undefined, boolLeaf("value", false)),
    ]));
  }

  private volumeFilters(clip: Clip): XmlNode[] {
    const clampLevel = (v: number) => Math.max(0, Math.min(v, 3.98));
    const frames = keyframeFrames(clip, "volume");
    let level: XmlNode;
    if (frames.length === 0) {
      if (clip.volume === 1.0) return [];
      level = this.scalarParam("level", "Level", "0", "3.98107", clampLevel(clip.volume), [], "%.4f");
    } else {
      const kfs = frames.map((f) => ({ when: f - clip.startFrame, value: clampLevel(rawVolumeAt(clip, f)) }));
      level = this.scalarParam("level", "Level", "0", "3.98107", kfs[0].value, kfs, "%.4f");
    }
    return [this.filter(this.effect("Audio Levels", "audiolevels", "audio", "audio", undefined, [level]))];
  }

  private videoFilters(clip: Clip): XmlNode[] {
    return [this.motionFilter(clip), this.cropFilter(clip), this.opacityFilter(clip)].filter((x): x is XmlNode => x !== null);
  }

  private motionFilter(clip: Clip): XmlNode | null {
    const sourceWidth = this.resolver.entry(clip.mediaRef)?.sourceWidth ?? 0;
    const scalePct = (width: number) => (sourceWidth > 0 ? (this.seqWidth / sourceWidth) * width * 100 : width * 100);
    const center = (t: { centerX: number; centerY: number }) => ({ x: t.centerX - 0.5, y: t.centerY - 0.5 });

    const frames = [...new Set([
      ...keyframeFrames(clip, "position"),
      ...keyframeFrames(clip, "scale"),
      ...keyframeFrames(clip, "rotation"),
    ])].sort((a, b) => a - b);

    let params: XmlNode[] = [];
    if (frames.length === 0) {
      const t = clip.transform;
      const c = center(t), scaled = scalePct(t.width), rotated = -t.rotation;
      const needsCenter = Math.abs(c.x) > 0.001 || Math.abs(c.y) > 0.001;
      const needsScale = Math.abs(scaled - 100) > 0.1;
      const needsRotation = Math.abs(rotated) > 0.05;
      if (!needsCenter && !needsScale && !needsRotation) return null;
      if (needsScale) params.push(this.scalarParam("scale", "Scale", "0", "1000", scaled));
      if (needsRotation) params.push(this.scalarParam("rotation", "Rotation", "-100000", "100000", rotated));
      if (needsCenter) params.push(this.centerParam(c.x, c.y));
    } else {
      const scaleKfs = frames.map((f) => ({ when: f - clip.startFrame, value: scalePct(sizeAt(clip, f).width) }));
      const rotationKfs = frames.map((f) => ({ when: f - clip.startFrame, value: -rotationAt(clip, f) }));
      const centerKfs = frames.map((f) => {
        const c = center(transformAt(clip, f));
        return { when: f - clip.startFrame, x: c.x, y: c.y };
      });
      params = [
        this.scalarParam("scale", "Scale", "0", "1000", scaleKfs[0].value, scaleKfs),
        this.scalarParam("rotation", "Rotation", "-100000", "100000", rotationKfs[0].value, rotationKfs),
        this.centerParam(centerKfs[0].x, centerKfs[0].y, centerKfs),
      ];
    }
    return this.filter(this.effect("Basic Motion", "basic", "motion", "video", undefined, params));
  }

  private cropFilter(clip: Clip): XmlNode | null {
    const frames = keyframeFrames(clip, "crop");
    const identity = clip.crop.left === 0 && clip.crop.top === 0 && clip.crop.right === 0 && clip.crop.bottom === 0;
    if (frames.length === 0 && identity) return null;
    const edge = (id: string, pick: (c: { left: number; top: number; right: number; bottom: number }) => number): XmlNode => {
      if (frames.length === 0) return this.scalarParam(id, id, "0", "100", pick(clip.crop) * 100);
      const kfs = frames.map((f) => ({ when: f - clip.startFrame, value: pick(cropAt(clip, f)) * 100 }));
      return this.scalarParam(id, id, "0", "100", kfs[0].value, kfs);
    };
    const params = [edge("left", (c) => c.left), edge("right", (c) => c.right), edge("top", (c) => c.top), edge("bottom", (c) => c.bottom)];
    return this.filter(this.effect("Crop", "crop", "motion", "video", "motion", params));
  }

  private opacityFilter(clip: Clip): XmlNode | null {
    const frames = keyframeFrames(clip, "opacity");
    let opacity: XmlNode;
    if (frames.length === 0) {
      if (clip.opacity === 1.0) return null;
      opacity = this.scalarParam("opacity", "Opacity", "0", "100", clip.opacity * 100, [], "%.1f");
    } else {
      const kfs = frames.map((f) => ({ when: f - clip.startFrame, value: rawOpacityAt(clip, f) * 100 }));
      opacity = this.scalarParam("opacity", "Opacity", "0", "100", kfs[0].value, kfs, "%.1f");
    }
    return this.filter(this.effect("Opacity", "opacity", "motion", "video", undefined, [opacity]));
  }

  // --- indexing ---

  private sortEmittable(track: Track): Clip[] {
    return track.clips
      .filter((c) => this.resolver.resolvePath(c.mediaRef) !== undefined)
      .sort((a, b) => a.startFrame - b.startFrame);
  }

  private indexAddresses(sortedTracks: Clip[][], isAudio: boolean): void {
    sortedTracks.forEach((clips, ti) => {
      clips.forEach((clip, ci) => {
        this.clipAddresses.set(clip.id, { trackIndex: ti + 1, clipIndex: ci + 1, isAudio });
      });
    });
  }

  private indexLinkGroups(): void {
    for (const track of this.timeline.tracks) {
      for (const clip of track.clips) {
        if (!clip.linkGroupId) continue;
        const arr = this.clipsByLinkGroup.get(clip.linkGroupId) ?? [];
        arr.push(clip);
        this.clipsByLinkGroup.set(clip.linkGroupId, arr);
      }
    }
  }

  private sourceDurationFramesFor(mediaRef: string): number | null {
    const seconds = this.resolver.entry(mediaRef)?.duration;
    if (seconds === undefined) return null;
    return Math.max(0, secondsToFrame(seconds, this.fps));
  }

  private rateTags(rawFps: number): { timebase: number; ntsc: boolean } {
    const timebase = Math.max(1, Math.round(rawFps));
    const ntscRate = (timebase * 1000) / 1001;
    return { timebase, ntsc: Math.abs(rawFps - ntscRate) < Math.abs(rawFps - timebase) };
  }

  // --- builders ---

  private rate(timebase: number, ntsc = false): XmlNode {
    return el("rate", [leaf("timebase", timebase), boolLeaf("ntsc", ntsc)]);
  }
  private filter(effect: XmlNode): XmlNode {
    return el("filter", [effect]);
  }
  private effect(name: string, id: string, type: string, mediatype: string, category?: string, body: XmlNode[] = []): XmlNode {
    const children: XmlNode[] = [leaf("name", name), leaf("effectid", id)];
    if (category) children.push(leaf("effectcategory", category));
    children.push(leaf("effecttype", type), leaf("mediatype", mediatype), ...body);
    return el("effect", children);
  }
  private parameter(id: string, name: string, min: string | undefined, max: string | undefined, value: XmlNode, keyframes: { when: number; value: XmlNode }[] = []): XmlNode {
    const children: XmlNode[] = [leaf("parameterid", id), leaf("name", name)];
    if (min !== undefined) children.push(leaf("valuemin", min));
    if (max !== undefined) children.push(leaf("valuemax", max));
    children.push(value);
    children.push(...keyframes.map((k) => el("keyframe", [leaf("when", k.when), k.value])));
    return el("parameter", children);
  }
  private scalarParam(id: string, name: string, min: string, max: string, base: number, keyframes: { when: number; value: number }[] = [], spec = "%.2f"): XmlNode {
    const places = specPlaces(spec);
    return this.parameter(id, name, min, max, leaf("value", fmt(base, places)),
      keyframes.map((k) => ({ when: k.when, value: leaf("value", fmt(k.value, places)) })));
  }
  private centerParam(x: number, y: number, keyframes: { when: number; x: number; y: number }[] = []): XmlNode {
    const vec = (vx: number, vy: number) => el("value", [leaf("horiz", fmt(vx, 5)), leaf("vert", fmt(vy, 5))]);
    return this.parameter("center", "Center", undefined, undefined, vec(x, y),
      keyframes.map((k) => ({ when: k.when, value: vec(k.x, k.y) })));
  }
}

function specPlaces(spec: string): number {
  const m = /%\.(\d)f/.exec(spec);
  return m ? Number(m[1]) : 2;
}

function totalFrames(timeline: Timeline): number {
  let max = 0;
  for (const t of timeline.tracks) for (const c of t.clips) max = Math.max(max, endFrame(c));
  return max;
}
