// Bridge to the isolated Remotion workspace (remotion/render.mjs). Node-only. Spawns the render as a
// child (its own node_modules + headless Chromium) and returns the composition metadata.

import { spawn } from "node:child_process";

export interface MotionResult {
  outputLocation: string;
  durationInFrames: number;
  width: number;
  height: number;
  fps: number;
}

export function renderRemotion(
  compId: string,
  props: Record<string, unknown>,
  outputPath: string,
  remotionDir: string,
): Promise<MotionResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("node", ["render.mjs", compId, JSON.stringify(props), outputPath], { cwd: remotionDir });
    let out = "", err = "";
    child.stdout.on("data", (d) => { out += String(d); });
    child.stderr.on("data", (d) => { err += String(d); if (err.length > 40000) err = err.slice(-40000); });
    child.on("error", (e) => reject(new Error(`Failed to launch Remotion render: ${e.message}`)));
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(`Remotion render failed (exit ${code}): ${(err || out).slice(-800)}`));
      const line = out.trim().split("\n").filter(Boolean).pop() ?? "{}";
      try { resolve(JSON.parse(line) as MotionResult); }
      catch { reject(new Error(`Remotion render: unexpected output: ${out.slice(-400)}`)); }
    });
  });
}
