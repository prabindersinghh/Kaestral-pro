// Beat / onset detection — Maestro's OWN implementation (no third-party editor code). Decodes mono
// PCM with the bundled FFmpeg (same approach as waveform.ts), builds a short-time energy envelope,
// takes the positive energy flux as an onset function, adaptively peak-picks onsets, and estimates
// tempo by autocorrelating the onset envelope. Output is in PROJECT FRAMES so the AI can cut/keyframe
// on the beat via split_clips / set_keyframes. Good enough for beat-synced reel cuts; it is an
// energy-flux detector, not a full spectral-flux/DP tracker — documented honestly.

import { spawn } from "node:child_process";
import { ffmpegBin } from "../mcp/env";

const DECODE_RATE = 22050;       // enough for percussive onsets; keeps it light
const FRAME = 1024;              // analysis window (~46 ms @22.05k)
const HOP = 512;                 // 50% overlap → ~43 envelope samples/sec

export interface BeatAnalysis {
  durationSec: number;
  tempoBpm: number;              // 0 if undetectable
  beatFrames: number[];         // tempo-grid beats, in project frames
  onsetFrames: number[];        // detected onsets (transients), in project frames
  onsetSeconds: number[];       // same, in seconds (for non-frame use)
}

export interface SilenceRange { startFrame: number; endFrame: number } // project frames

export interface SilenceOptions {
  floorDb?: number;      // gate: below this (relative to the clip's own peak) counts as silence
  minSilenceSec?: number; // ignore gaps shorter than this
  padSec?: number;       // keep this much speech on each side of a cut (avoid clipping words)
}

/** Decode a file's first audio track to mono Float32 PCM at DECODE_RATE. */
function decodePcm(path: string, ffmpegPath = ffmpegBin()): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const ff = spawn(ffmpegPath, ["-v", "error", "-i", path, "-map", "a:0", "-ac", "1", "-ar", String(DECODE_RATE), "-f", "f32le", "-"], { stdio: ["ignore", "pipe", "pipe"] });
    const chunks: Buffer[] = [];
    let errBuf = "";
    ff.stdout.on("data", (d: Buffer) => chunks.push(d));
    ff.stderr.on("data", (d: Buffer) => { errBuf += d.toString(); });
    ff.on("error", reject);
    ff.on("close", (code) => {
      if (code !== 0 && chunks.length === 0) return reject(new Error(`ffmpeg PCM decode failed (${code}): ${errBuf.slice(0, 200)}`));
      const buf = Buffer.concat(chunks);
      // Float32LE view (guard against a trailing partial sample).
      const n = Math.floor(buf.length / 4);
      const out = new Float32Array(n);
      for (let i = 0; i < n; i++) out[i] = buf.readFloatLE(i * 4);
      resolve(out);
    });
  });
}

/** Short-time RMS energy envelope over hopped windows. */
function energyEnvelope(pcm: Float32Array): number[] {
  const env: number[] = [];
  for (let start = 0; start + FRAME <= pcm.length; start += HOP) {
    let sum = 0;
    for (let i = 0; i < FRAME; i++) { const s = pcm[start + i]; sum += s * s; }
    env.push(Math.sqrt(sum / FRAME));
  }
  return env;
}

/** Positive flux (increase in energy) = onset strength per hop. */
function onsetStrength(env: number[]): number[] {
  const flux: number[] = [0];
  for (let i = 1; i < env.length; i++) flux.push(Math.max(0, env[i] - env[i - 1]));
  return flux;
}

/** Adaptive peak-pick: a local max that exceeds mean + k·std over a sliding window, with a refractory gap. */
function pickPeaks(flux: number[], hopSec: number): number[] {
  if (flux.length === 0) return [];
  const win = Math.max(4, Math.round(0.35 / hopSec)); // ~350 ms adaptive window
  const refractory = Math.max(1, Math.round(0.12 / hopSec)); // ≥120 ms between onsets
  const peaks: number[] = [];
  let lastPeak = -Infinity;
  for (let i = 1; i < flux.length - 1; i++) {
    if (!(flux[i] > flux[i - 1] && flux[i] >= flux[i + 1])) continue;
    const lo = Math.max(0, i - win), hi = Math.min(flux.length, i + win);
    let mean = 0;
    for (let j = lo; j < hi; j++) mean += flux[j];
    mean /= (hi - lo);
    let varr = 0;
    for (let j = lo; j < hi; j++) { const d = flux[j] - mean; varr += d * d; }
    const std = Math.sqrt(varr / (hi - lo));
    if (flux[i] > mean + 1.5 * std && flux[i] > 1e-4 && i - lastPeak >= refractory) {
      peaks.push(i);
      lastPeak = i;
    }
  }
  return peaks;
}

/** Estimate tempo (BPM) by autocorrelating the onset envelope over a 50–200 BPM lag range. */
function estimateTempo(flux: number[], hopSec: number): number {
  const minBpm = 60, maxBpm = 190;
  const minLag = Math.max(1, Math.round((60 / maxBpm) / hopSec));
  const maxLag = Math.round((60 / minBpm) / hopSec);
  let bestLag = 0, best = 0;
  for (let lag = minLag; lag <= maxLag && lag < flux.length; lag++) {
    let s = 0;
    for (let i = lag; i < flux.length; i++) s += flux[i] * flux[i - lag];
    if (s > best) { best = s; bestLag = lag; }
  }
  if (bestLag === 0) return 0;
  return Math.round(60 / (bestLag * hopSec));
}

/** Detect silence/dead-air ranges from the energy envelope (for jump-cut-on-pause). Project frames. */
export function silencesFromEnvelope(env: number[], fps: number, opts: SilenceOptions = {}): SilenceRange[] {
  if (env.length === 0) return [];
  const floorDb = opts.floorDb ?? -34;
  const minSilenceSec = opts.minSilenceSec ?? 0.35;
  const padSec = opts.padSec ?? 0.08;
  const hopSec = HOP / DECODE_RATE;

  const peak = Math.max(...env, 1e-9);
  const gate = peak * Math.pow(10, floorDb / 20); // linear threshold relative to the loudest part
  const minHops = Math.max(1, Math.round(minSilenceSec / hopSec));
  const padHops = Math.round(padSec / hopSec);

  const ranges: SilenceRange[] = [];
  let runStart = -1;
  const flush = (endEx: number) => {
    if (runStart < 0) return;
    const s = runStart + padHops, e = endEx - padHops; // pad inward so speech isn't clipped
    if (e - s >= minHops) ranges.push({ startFrame: Math.round(s * hopSec * fps), endFrame: Math.round(e * hopSec * fps) });
    runStart = -1;
  };
  for (let i = 0; i < env.length; i++) {
    if (env[i] < gate) { if (runStart < 0) runStart = i; }
    else flush(i);
  }
  flush(env.length);
  return ranges.filter((r) => r.endFrame > r.startFrame);
}

/** Analyze a media file: onsets + tempo grid + silence ranges, in project frames. */
export async function analyzeBeats(path: string, fps: number, silenceOpts: SilenceOptions = {}, ffmpegPath = ffmpegBin()): Promise<BeatAnalysis & { silences: SilenceRange[] }> {
  const pcm = await decodePcm(path, ffmpegPath);
  const durationSec = pcm.length / DECODE_RATE;
  const hopSec = HOP / DECODE_RATE;
  const env = energyEnvelope(pcm);
  const flux = onsetStrength(env);
  const peakIdx = pickPeaks(flux, hopSec);

  const onsetSeconds = peakIdx.map((i) => i * hopSec);
  const onsetFrames = onsetSeconds.map((t) => Math.round(t * fps));

  const tempoBpm = estimateTempo(flux, hopSec);
  // Tempo grid: beats every 60/bpm seconds, phase-aligned to the first strong onset.
  const beatFrames: number[] = [];
  if (tempoBpm > 0 && durationSec > 0) {
    const period = 60 / tempoBpm;
    const phase = onsetSeconds.length ? onsetSeconds[0] % period : 0;
    for (let t = phase; t <= durationSec; t += period) beatFrames.push(Math.round(t * fps));
  }
  const silences = silencesFromEnvelope(env, fps, silenceOpts);
  return { durationSec, tempoBpm, beatFrames, onsetFrames, onsetSeconds, silences };
}
