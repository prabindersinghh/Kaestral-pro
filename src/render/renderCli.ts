// Render CLI — reads {timeline, media} JSON from stdin, writes a video file. Invoked by the Tauri
// `export_video` command (app export button) and usable standalone:
//   echo '{"timeline":{...},"media":{...}}' | npx tsx src/render/renderCli.ts out.mp4 H.264 1080p

import { resolve } from "node:path";
import { renderVideo, type VideoCodec, type VideoResolution } from "./renderVideo";
import { resolveRenderMediaPath } from "./mediaPath";
import { publicDir } from "../mcp/env";
import { decodeTimeline } from "../model/codec";
import { decodeManifest } from "../model/media";

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (data += c));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

async function main(): Promise<void> {
  const outPath = process.argv[2] ? resolve(process.argv[2]) : "";
  const codec = (process.argv[3] ?? "H.264") as VideoCodec;
  const resolution = (process.argv[4] ?? "Match Timeline") as VideoResolution;
  if (!outPath) throw new Error("usage: renderCli <outPath> [codec] [resolution]  (project JSON on stdin)");

  const parsed = JSON.parse(await readStdin());
  const timeline = decodeTimeline(parsed.timeline);
  const projectDir = typeof parsed.projectDir === "string" ? parsed.projectDir : ".";
  const names = new Map<string, string>();
  const paths = new Map<string, string>();
  const pubDir = publicDir();
  if (parsed.media) {
    for (const e of decodeManifest(parsed.media).entries) {
      names.set(e.id, e.name);
      const p = resolveRenderMediaPath(e.source, projectDir, pubDir);
      if (p) paths.set(e.id, p);
    }
  }

  const result = await renderVideo(timeline, {
    outputPath: outPath,
    codec,
    resolution,
    mediaName: (r) => names.get(r) ?? r,
    mediaPath: (r) => paths.get(r) ?? null,
    onProgress: (d, t) => process.stderr.write(`\rrendering ${d}/${t}`),
  });
  process.stderr.write("\n");
  process.stdout.write(JSON.stringify(result));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
