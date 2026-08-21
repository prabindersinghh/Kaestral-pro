// Scene-change detection — absorbed from the autoshorts-style clip-extraction workflow. Gives a
// connected LLM the exact CUT points of a clip (something see_video's sampled frames can't show),
// so it can rank and extract self-contained moments from long-form footage, align edits to the
// source's own cuts, or segment a reference for match_motion-style reuse.
//
// Implementation: ffmpeg's scene filter (`select='gt(scene,T)'` + metadata=print) — the score is
// ffmpeg's own inter-frame difference metric in [0,1]; a hard cut typically scores 0.4–0.9, a
// dissolve lower. No frames are decoded into JS; ffmpeg does the work and we parse its report.

import { spawn } from "node:child_process";
import { ffmpegBin, ffprobeBin } from "../mcp/env";

export interface SceneCut {
  frame: number;      // project-fps frame index of the first frame of the new scene
  timeSec: number;    // source time of the cut
  score: number;      // ffmpeg scene score (0..1) — higher = harder cut
}

export interface SceneReport {
  fps: number;              // fps used to express `frame` (project fps)
  durationSec: number;
  threshold: number;
  cutCount: number;
  cuts: SceneCut[];         // ascending by time; excludes t=0 (the clip start is not a "cut")
  note: string;
}

const DEFAULT_THRESHOLD = 0.3; // catches real hard cuts; dissolves/flat-color cuts can score ~0.4

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

async function probeDuration(path: string): Promise<number> {
  const out = await runText(ffprobeBin(), [
    "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1", path,
  ]).catch(() => "");
  const m = /duration=([0-9.]+)/.exec(out);
  return m ? parseFloat(m[1]) : 0;
}

/**
 * Detect scene changes in a media file. `fps` expresses the returned frame indices (pass the
 * project fps so cuts land directly on timeline frames). `threshold` in (0,1]; lower = more
 * sensitive (more cuts reported).
 */
export async function detectScenes(
  path: string,
  opts: { fps?: number; threshold?: number } = {},
): Promise<SceneReport> {
  const fps = Math.max(1, opts.fps ?? 30);
  const rawThreshold = opts.threshold ?? DEFAULT_THRESHOLD;
  const threshold = Math.min(1, Math.max(0.05, rawThreshold));
  const durationSec = await probeDuration(path);

  // metadata=print:file=- writes "frame:N pts:… pts_time:T" + "lavfi.scene_score=S" pairs to stdout.
  const out = await runText(ffmpegBin(), [
    "-v", "error", "-i", path,
    "-vf", `select='gt(scene,${threshold})',metadata=print:file=-`,
    "-an", "-f", "null", "-",
  ]);

  const cuts: SceneCut[] = [];
  let pendingTime: number | null = null;
  for (const line of out.split(/\r?\n/)) {
    const t = /pts_time:([0-9.]+)/.exec(line);
    if (t) { pendingTime = parseFloat(t[1]); continue; }
    const s = /lavfi\.scene_score=([0-9.]+)/.exec(line);
    if (s && pendingTime !== null) {
      if (pendingTime > 0.001) { // the clip's own start is not a cut
        cuts.push({ frame: Math.round(pendingTime * fps), timeSec: pendingTime, score: parseFloat(s[1]) });
      }
      pendingTime = null;
    }
  }
  cuts.sort((a, b) => a.timeSec - b.timeSec);

  return {
    fps, durationSec, threshold, cutCount: cuts.length, cuts,
    note: "frame indices are at the given fps (project frames from the MEDIA's start, 0 = its first frame). Each cut marks the first frame of a NEW scene. Segment boundaries for moment extraction: [0, cut1), [cut1, cut2), …, [lastCut, end).",
  };
}
