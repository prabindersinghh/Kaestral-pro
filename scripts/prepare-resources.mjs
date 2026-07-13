// Assemble everything the packaged app needs to run with NO Node/npm/tsx/FFmpeg on the user's
// machine, into src-tauri/resources/ (bundled by Tauri as read-only app resources):
//   node.exe, ffmpeg.exe, ffprobe.exe, dist-server/*.cjs, public/, remotion/ (source only),
//   node_modules/@napi-rs/canvas (native).
import { cpSync, mkdirSync, rmSync, existsSync, copyFileSync, statSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const res = path.join(root, "src-tauri", "resources");

function which(bin) {
  try { return execFileSync("where", [bin], { encoding: "utf8" }).split(/\r?\n/).find(Boolean)?.trim(); }
  catch { return null; }
}
const mb = (p) => (existsSync(p) ? (statSync(p).size / 1e6).toFixed(0) : "?");
// Recursive directory size in MB (for reporting the shipped node_modules footprint).
function dirBytes(p) {
  if (!existsSync(p)) return 0;
  const st = statSync(p);
  if (st.isFile()) return st.size;
  let total = 0;
  for (const e of readdirSync(p)) total += dirBytes(path.join(p, e));
  return total;
}
const mb2 = (p) => (dirBytes(p) / 1e6).toFixed(0);

rmSync(res, { recursive: true, force: true });
mkdirSync(res, { recursive: true });

// 1) Node runtime (the exe running this script).
copyFileSync(process.execPath, path.join(res, "node.exe"));

// 2) FFmpeg + ffprobe.
const ffmpeg = process.env.FFMPEG_SRC || which("ffmpeg");
const ffprobe = process.env.FFPROBE_SRC || which("ffprobe");
if (!ffmpeg || !ffprobe) throw new Error("ffmpeg/ffprobe not found on PATH — set FFMPEG_SRC / FFPROBE_SRC.");
copyFileSync(ffmpeg, path.join(res, "ffmpeg.exe"));
copyFileSync(ffprobe, path.join(res, "ffprobe.exe"));

// 3) Bundled server + render CLI.
cpSync(path.join(root, "dist-server"), path.join(res, "dist-server"), { recursive: true });

// 4) Bundled sample media (served + demo).
cpSync(path.join(root, "public"), path.join(res, "public"), { recursive: true });

// 5) Native canvas package + its platform binary package (the .node lives in a SEPARATE
//    @napi-rs/canvas-<platform> package that the loader requires — copy every @napi-rs/canvas*).
const napiDir = path.join(root, "node_modules", "@napi-rs");
for (const pkg of readdirSync(napiDir).filter((n) => n.startsWith("canvas"))) {
  cpSync(path.join(napiDir, pkg), path.join(res, "node_modules", "@napi-rs", pkg), { recursive: true });
}

// 6) Remotion workspace: source + node_modules SHIPPED so a fresh install renders motion with ZERO
//    runtime `npm install`. We exclude only the transient/writable caches:
//      - node_modules/.remotion : the downloaded headless Chromium (~590 MB). It CANNOT live in the
//        read-only resources (Remotion writes/updates it), so it's downloaded on first render into
//        the writable per-user copy of this workspace (see ensure_writable_remotion in lib.rs).
//      - .bundle-cache : the per-run webpack bundle cache (rebuilt on first render, writable copy).
//    Requires `npm ci` (or install) to have run in remotion/ before packaging — assert it did.
if (!existsSync(path.join(root, "remotion", "node_modules", "remotion"))) {
  throw new Error("remotion/node_modules is missing — run `npm ci` (or `npm install`) in remotion/ before packaging.");
}
cpSync(path.join(root, "remotion"), path.join(res, "remotion"), { recursive: true });
// Node's cpSync `filter` does NOT prune a directory subtree when it returns false for the dir, so
// the transient caches get copied anyway. Delete them from the destination explicitly: the ~590 MB
// .remotion headless-Chromium cache (re-downloaded on first render into the writable per-user copy)
// and the per-run .bundle-cache. This keeps the installer ~590 MB smaller.
rmSync(path.join(res, "remotion", "node_modules", ".remotion"), { recursive: true, force: true });
rmSync(path.join(res, "remotion", ".bundle-cache"), { recursive: true, force: true });
if (existsSync(path.join(res, "remotion", "node_modules", ".remotion"))) {
  throw new Error("packaging: failed to strip remotion/node_modules/.remotion from resources.");
}

// 7) Bundled skill library (Kaestral's own editing playbooks — served by read_skill offline).
cpSync(path.join(root, "skills"), path.join(res, "skills"), { recursive: true });

// 8) Bundled whisper.cpp CLI (on-device transcription). The model .bin downloads on first use.
cpSync(path.join(root, "vendor", "whisper"), path.join(res, "whisper"), { recursive: true });

console.log("resources assembled:");
console.log(`  node.exe     ${mb(path.join(res, "node.exe"))} MB`);
console.log(`  ffmpeg.exe   ${mb(path.join(res, "ffmpeg.exe"))} MB`);
console.log(`  ffprobe.exe  ${mb(path.join(res, "ffprobe.exe"))} MB`);
console.log(`  remotion     ${mb2(path.join(res, "remotion", "node_modules"))} MB node_modules (chromium cache stripped)`);
console.log(`  + dist-server, public, @napi-rs/canvas, skills, whisper`);
