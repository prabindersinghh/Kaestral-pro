// Render a Remotion composition to MP4 by id + input props. Invoked by the Kaestral server
// (generate_motion). Bundles once and caches the bundle in .bundle-cache for fast repeat renders;
// ensureBrowser() fetches the headless Chromium on first use.
//
//   node render.mjs <CompositionId> '<props-json>' <output.mp4>

import { bundle } from "@remotion/bundler";
import { selectComposition, renderMedia, ensureBrowser } from "@remotion/renderer";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const [, , compId, propsJson, outArg] = process.argv;
if (!compId || !outArg) {
  console.error("usage: node render.mjs <CompositionId> '<props-json>' <output.mp4>");
  process.exit(2);
}
const inputProps = propsJson ? JSON.parse(propsJson) : {};
const outputLocation = path.resolve(outArg);

async function getServeUrl() {
  // Cache the webpack bundle so only the first render pays the bundling cost.
  const cacheDir = path.join(__dirname, ".bundle-cache");
  const marker = path.join(cacheDir, "serveUrl.txt");
  const entryHashPath = path.join(cacheDir, "entry.txt");
  const entryPoint = path.join(__dirname, "src", "index.ts");
  if (existsSync(marker) && existsSync(readFileSync(marker, "utf8")) && existsSync(entryHashPath)) {
    return readFileSync(marker, "utf8");
  }
  mkdirSync(cacheDir, { recursive: true });
  const serveUrl = await bundle({ entryPoint, outDir: path.join(cacheDir, "bundle") });
  writeFileSync(marker, serveUrl);
  writeFileSync(entryHashPath, "1");
  return serveUrl;
}

await ensureBrowser();
const serveUrl = await getServeUrl();
const composition = await selectComposition({ serveUrl, id: compId, inputProps });
await renderMedia({
  composition,
  serveUrl,
  codec: "h264",
  outputLocation,
  inputProps,
  // headless Chromium flags that are robust across machines (incl. no-GPU Windows CI/VMs)
  chromiumOptions: { gl: "angle" },
});

console.log(JSON.stringify({
  outputLocation,
  durationInFrames: composition.durationInFrames,
  width: composition.width,
  height: composition.height,
  fps: composition.fps,
}));
