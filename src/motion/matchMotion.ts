// Match motion from a reference clip — Kaestral's OWN implementation.
//
// Given a short reference clip, extract a compact "motion spec": its beat/cut STRUCTURE (reusing the
// beat detector), the dominant PALETTE per beat (reusing palette extraction), and a per-beat CAMERA
// MOTION CLASS (static / push-in / pull-back / pan) via a coarse block-matching optical flow on
// sampled grayscale frames. The output is timing/structure the Cinematic Reel preset can consume to
// auto-time a film to the reference.
//
// Deliberately NOT a video cloner: this is a coarse classifier feeding the preset system, not a
// frame-perfect SSIM reconstruction. The camera classifier reads GLOBAL motion (whole-frame pan vs
// radial zoom), not object motion — a subject walking across an otherwise-static shot may read as a
// weak "pan"; that is acceptable for timing a preset, and `motionConfidence` reflects the ambiguity.

import { spawn } from "node:child_process";
import { ffmpegBin, ffprobeBin } from "../mcp/env";
import { analyzeBeats } from "../audio/beats";
import { extractPaletteWindow } from "../color/palette";

// ---- tunables (coarse classifier; kept explicit so the thresholds are auditable) --------------------
const FLOW_W = 160;              // downscaled analysis width  (small = fast block matching)
const FLOW_H = 90;               // downscaled analysis height (16:9 analysis buffer; aspect-agnostic)
const GRID_X = 10;               // block-matching grid columns
const GRID_Y = 6;                // block-matching grid rows
const SEARCH = 8;                // block-match search radius in downscaled px (±SEARCH)
const FRAMES_PER_BEAT = 6;       // grayscale frames sampled within each beat window for flow
const STATIC_MAG = 0.6;          // mean flow-vector magnitude (px) below this ⇒ "static"
const ZOOM_DOMINANCE = 1.4;      // |divergence| must beat translation coherence by this factor for zoom
const FALLBACK_SEG_SEC = 2.2;    // when a clip has no audio/beats, segment into ~this-long beats

export interface MotionBeat {
  index: number;
  startFrame: number; endFrame: number;
  startSec: number; endSec: number;
  palette: string[];                                     // dominant hex colors for this beat
  camera: "static" | "push-in" | "pull-back" | "pan";
  panDirection?: "left" | "right" | "up" | "down";       // only when camera === "pan"
  motionConfidence: number;                              // 0..1, how cleanly the flow matched the class
}

export interface MotionSpec {
  fps: number; durationSec: number; width: number; height: number;
  beatCount: number;
  beats: MotionBeat[];
  source: { path: string };
}

// --- small process helper (binary stdout for raw frames, or text for ffprobe) ---------------------
function runText(bin: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    p.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    p.stderr.on("data", (d: Buffer) => { err += d.toString(); });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`${bin} exited ${code}: ${err.slice(0, 200)}`))));
  });
}

function runBinary(bin: string, args: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    const chunks: Buffer[] = [];
    let err = "";
    p.stdout.on("data", (d: Buffer) => chunks.push(d));
    p.stderr.on("data", (d: Buffer) => { err += d.toString(); });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(`${bin} exited ${code}: ${err.slice(0, 200)}`))));
  });
}

interface ProbeInfo { width: number; height: number; fps: number; durationSec: number }

async function probeClip(path: string): Promise<ProbeInfo> {
  const out = await runText(ffprobeBin(), [
    "-v", "error", "-select_streams", "v:0",
    "-show_entries", "stream=width,height,r_frame_rate", "-show_entries", "format=duration",
    "-of", "default=nw=1", path,
  ]).catch(() => "");
  const w = /width=(\d+)/.exec(out); const h = /height=(\d+)/.exec(out);
  const rate = /r_frame_rate=(\d+)\/(\d+)/.exec(out); const dur = /duration=([0-9.]+)/.exec(out);
  const fps = rate ? Math.round((parseInt(rate[1], 10) / Math.max(1, parseInt(rate[2], 10))) * 1000) / 1000 : 30;
  return {
    width: w ? parseInt(w[1], 10) : 0,
    height: h ? parseInt(h[1], 10) : 0,
    fps: Number.isFinite(fps) && fps > 0 ? fps : 30,
    durationSec: dur ? parseFloat(dur[1]) : 0,
  };
}

// Sample `count` grayscale frames evenly across [startSec, endSec] at FLOW_W×FLOW_H, returned as raw
// gray8 byte planes. One ffmpeg pass: fps filter selects ~count frames within the trimmed window.
async function sampleGrayFrames(path: string, startSec: number, endSec: number, count: number): Promise<Uint8Array[]> {
  const dur = Math.max(0.001, endSec - startSec);
  const rate = Math.max(0.001, (count - 1) / dur); // frames spread across the window
  const buf = await runBinary(ffmpegBin(), [
    "-v", "error", "-ss", String(startSec), "-t", String(dur), "-i", path,
    "-vf", `fps=${rate.toFixed(4)},scale=${FLOW_W}:${FLOW_H},format=gray`,
    "-frames:v", String(count), "-f", "rawvideo", "-pix_fmt", "gray", "pipe:1",
  ]).catch(() => Buffer.alloc(0));
  const planeSize = FLOW_W * FLOW_H;
  const frames: Uint8Array[] = [];
  for (let off = 0; off + planeSize <= buf.length; off += planeSize) {
    frames.push(new Uint8Array(buf.subarray(off, off + planeSize)));
  }
  return frames;
}

interface FlowVec { px: number; py: number; dx: number; dy: number } // px,py = block center; dx,dy = displacement

// Coarse block-matching optical flow between two gray8 frames: for each grid block, find the ±SEARCH
// displacement that minimizes SAD against the next frame. Returns one vector per block.
function blockFlow(prev: Uint8Array, next: Uint8Array): FlowVec[] {
  const bw = Math.floor(FLOW_W / GRID_X), bh = Math.floor(FLOW_H / GRID_Y);
  const vecs: FlowVec[] = [];
  for (let gy = 0; gy < GRID_Y; gy++) {
    for (let gx = 0; gx < GRID_X; gx++) {
      const x0 = gx * bw, y0 = gy * bh;
      let bestSad = Infinity, bdx = 0, bdy = 0;
      for (let dy = -SEARCH; dy <= SEARCH; dy++) {
        for (let dx = -SEARCH; dx <= SEARCH; dx++) {
          let sad = 0;
          // sub-sample the block (every 2px) for speed; enough signal for a coarse class
          for (let y = 1; y < bh - 1; y += 2) {
            const sy = y0 + y, ty = sy + dy;
            if (ty < 0 || ty >= FLOW_H) { sad = Infinity; break; }
            for (let x = 1; x < bw - 1; x += 2) {
              const sx = x0 + x, tx = sx + dx;
              if (tx < 0 || tx >= FLOW_W) { sad += 255; continue; }
              sad += Math.abs(prev[sy * FLOW_W + sx] - next[ty * FLOW_W + tx]);
            }
          }
          if (sad < bestSad) { bestSad = sad; bdx = dx; bdy = dy; }
        }
      }
      vecs.push({ px: x0 + bw / 2, py: y0 + bh / 2, dx: bdx, dy: bdy });
    }
  }
  return vecs;
}

interface CameraClass { camera: MotionBeat["camera"]; panDirection?: MotionBeat["panDirection"]; confidence: number }

// Classify a beat's aggregated flow field. Translation = coherent uniform motion (pan); divergence =
// radial motion from the frame center (out ⇒ push-in/zoom, in ⇒ pull-back). Static = little of either.
function classifyCamera(fields: FlowVec[][]): CameraClass {
  const all: FlowVec[] = fields.flat();
  if (all.length === 0) return { camera: "static", confidence: 0 };
  const cx = FLOW_W / 2, cy = FLOW_H / 2;
  let sumDx = 0, sumDy = 0, sumRadial = 0, sumMag = 0;
  for (const v of all) {
    sumDx += v.dx; sumDy += v.dy;
    sumMag += Math.hypot(v.dx, v.dy);
    // radial component: positive when the vector points AWAY from center (outward = zoom-in)
    const rx = v.px - cx, ry = v.py - cy, rlen = Math.hypot(rx, ry) || 1;
    sumRadial += (v.dx * rx + v.dy * ry) / rlen;
  }
  const n = all.length;
  const meanMag = sumMag / n;                          // overall motion energy
  const meanDx = sumDx / n, meanDy = sumDy / n;
  const transMag = Math.hypot(meanDx, meanDy);         // coherent translation (pan) strength
  const divergence = sumRadial / n;                    // signed radial (zoom) strength

  if (meanMag < STATIC_MAG) return { camera: "static", confidence: clamp01(1 - meanMag / STATIC_MAG) };

  const zoomSignal = Math.abs(divergence);
  const total = zoomSignal + transMag + 1e-6;
  if (zoomSignal > transMag * ZOOM_DOMINANCE) {
    return { camera: divergence > 0 ? "push-in" : "pull-back", confidence: clamp01(zoomSignal / total) };
  }
  // pan: direction from the dominant translation axis
  const dir: MotionBeat["panDirection"] =
    Math.abs(meanDx) >= Math.abs(meanDy) ? (meanDx > 0 ? "right" : "left") : (meanDy > 0 ? "down" : "up");
  return { camera: "pan", panDirection: dir, confidence: clamp01(transMag / total) };
}

function clamp01(x: number): number { return x < 0 ? 0 : x > 1 ? 1 : x; }

// --- segment the timeline into beats (from detected beats, or fixed fallback segments) --------------
function beatSegments(beatFrames: number[], totalFrames: number, fps: number): Array<{ startFrame: number; endFrame: number }> {
  // Use detected beats as segment boundaries; keep only well-separated ones so beats aren't sub-second.
  const minGap = Math.round(fps * 0.6);
  const bounds: number[] = [0];
  for (const f of beatFrames) {
    if (f > bounds[bounds.length - 1] + minGap && f < totalFrames - minGap) bounds.push(f);
  }
  bounds.push(totalFrames);
  // If detection was too sparse (≤1 real boundary), fall back to fixed segments.
  if (bounds.length <= 2) {
    const seg = Math.max(1, Math.round(fps * FALLBACK_SEG_SEC));
    const out: Array<{ startFrame: number; endFrame: number }> = [];
    for (let s = 0; s < totalFrames; s += seg) out.push({ startFrame: s, endFrame: Math.min(totalFrames, s + seg) });
    return out.length ? out : [{ startFrame: 0, endFrame: totalFrames }];
  }
  const segs: Array<{ startFrame: number; endFrame: number }> = [];
  for (let i = 0; i < bounds.length - 1; i++) segs.push({ startFrame: bounds[i], endFrame: bounds[i + 1] });
  return segs;
}

/**
 * Extract a MotionSpec from a reference clip: beat structure + per-beat palette + per-beat camera class.
 * Robust to clips with no audio (falls back to fixed segments) and to frame-sampling failures
 * (a beat that yields no frames is classified "static" with 0 confidence rather than throwing).
 */
export async function extractMotionSpec(clipPath: string, opts: { fps?: number } = {}): Promise<MotionSpec> {
  const info = await probeClip(clipPath);
  const fps = opts.fps ?? info.fps;
  const totalFrames = Math.max(1, Math.round(info.durationSec * fps));

  // Beat/cut structure (reuse the detector; tolerate no-audio clips).
  let beatFrames: number[] = [];
  try { beatFrames = (await analyzeBeats(clipPath, fps)).beatFrames ?? []; } catch { beatFrames = []; }
  const segs = beatSegments(beatFrames, totalFrames, fps);

  const beats: MotionBeat[] = [];
  for (let i = 0; i < segs.length; i++) {
    const { startFrame, endFrame } = segs[i];
    const startSec = startFrame / fps, endSec = endFrame / fps;

    // Camera motion: sample gray frames across the beat window, compute per-adjacent-pair flow, classify.
    const gray = await sampleGrayFrames(clipPath, startSec, Math.max(startSec + 0.05, endSec), FRAMES_PER_BEAT);
    const fields: FlowVec[][] = [];
    for (let f = 0; f + 1 < gray.length; f++) fields.push(blockFlow(gray[f], gray[f + 1]));
    const cam = classifyCamera(fields);

    // Per-beat palette: dominant colors from THIS beat's own time window (not the whole clip).
    let palette: string[] = [];
    try {
      const pal = await extractPaletteWindow(clipPath, startSec, Math.max(startSec + 0.1, endSec), 4, 3);
      palette = pal.swatches.map((s) => s.hex);
    } catch { palette = []; }

    beats.push({
      index: i, startFrame, endFrame, startSec: round3(startSec), endSec: round3(endSec),
      palette, camera: cam.camera, panDirection: cam.panDirection,
      motionConfidence: round3(cam.confidence),
    });
  }

  return {
    fps, durationSec: round3(info.durationSec), width: info.width, height: info.height,
    beatCount: beats.length, beats, source: { path: clipPath },
  };
}

function round3(x: number): number { return Math.round(x * 1000) / 1000; }
