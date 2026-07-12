// Hosted AI generation (STRATEGY ③) — BYOK to Fal.ai or Replicate. Node-only (runs in the MCP
// server so both the in-app chat and Claude Code can generate). Given a prompt + params it submits
// the job, polls to completion, and returns the result media URL. The executor then downloads the
// file and imports it onto the timeline. GTX-1650-class GPUs can't run LTX/FLUX locally, so this
// runs on the provider's servers — the user pays per clip.

// "gcp-ltx" is the user's OWN LTX-2 server on a Google Cloud GPU VM (see docs/GCP-LTX-GUIDE). Same
// contract as Fal/Replicate — submit a prompt, get a result media URL that the executor downloads and
// drops on the timeline — but it runs on the user's $300-credit GPU. VM start/stop lives in gcp.ts.
export type GenProvider = "fal" | "replicate" | "gcp-ltx";
export type GenKind = "video" | "image";

export interface GenConfig {
  provider: GenProvider;
  apiKey: string;
  videoModel: string; // e.g. fal: "fal-ai/ltx-video"   replicate: "owner/model" or a version hash
  imageModel: string; // e.g. fal: "fal-ai/flux/schnell" replicate: "black-forest-labs/flux-schnell"
  baseUrl?: string;   // gcp-ltx: the VM's LTX server, e.g. http://34.x.x.x:8000
}

export const DEFAULT_MODELS: Record<GenProvider, { video: string; image: string }> = {
  // Fal: LTX-2.3 fast is the current, cheapest LTX-2 text-to-video (~$0.04/s @1080p). The old
  // "fal-ai/ltx-video" slug is legacy; ltx-2.3 takes `duration` (seconds), not `num_frames`.
  fal: { video: "fal-ai/ltx-2.3/text-to-video/fast", image: "fal-ai/flux/schnell" },
  replicate: { video: "lightricks/ltx-video", image: "black-forest-labs/flux-schnell" },
  "gcp-ltx": { video: "ltx-2.3-distilled", image: "ltx-2.3-distilled" },
};

export interface GenResult { url: string; kind: GenKind }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Submit + poll a generation job; returns the first output media URL. Throws on failure/timeout. */
export async function generate(cfg: GenConfig, kind: GenKind, prompt: string, opts: { durationSeconds?: number; aspectRatio?: string } = {}): Promise<GenResult> {
  if (cfg.provider === "gcp-ltx") return { url: await runGcpLtx(cfg, kind, prompt, opts), kind };
  if (!cfg.apiKey) throw new Error("No generation API key set. Add your Fal or Replicate key in Settings → Generation.");
  const url = cfg.provider === "fal" ? await runFal(cfg, kind, prompt, opts) : await runReplicate(cfg, kind, prompt, opts);
  return { url, kind };
}

// ---- gcp-ltx (self-hosted LTX-2 on a GCP GPU VM) ----
// The VM's FastAPI server: POST /generate → { jobId }; GET /jobs/{jobId} → { status, url? }. Async so a
// clip that takes minutes never blocks on one long HTTP request. Every call touches the VM's activity
// stamp, so an active queue never trips the idle watchdog.
async function runGcpLtx(cfg: GenConfig, kind: GenKind, prompt: string, opts: { durationSeconds?: number; aspectRatio?: string }): Promise<string> {
  const base = (cfg.baseUrl ?? "").replace(/\/$/, "");
  if (!base) throw new Error("gcp-ltx: no server URL. Start the GPU (Settings → Generation → GPU) so Kaestral knows the VM's address.");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
  const body = JSON.stringify({ kind, prompt, seconds: opts.durationSeconds ?? 5, aspect_ratio: opts.aspectRatio ?? "16:9" });

  const sub = await fetch(`${base}/generate`, { method: "POST", headers, body });
  if (!sub.ok) throw new Error(`gcp-ltx submit ${sub.status}: ${(await sub.text()).slice(0, 200)}`);
  const { jobId } = (await sub.json()) as { jobId: string };
  if (!jobId) throw new Error("gcp-ltx: server returned no jobId.");

  for (let i = 0; i < 360; i++) { // up to ~30 min (video clips are slow on an L4)
    await sleep(5000);
    const st = await (await fetch(`${base}/jobs/${jobId}`, { headers })).json() as { status: string; url?: string; error?: string };
    if (st.status === "done" && st.url) return st.url;
    if (st.status === "error") throw new Error(`gcp-ltx job failed: ${st.error ?? "unknown"}`);
  }
  throw new Error("gcp-ltx: timed out waiting for the clip (30 min). The GPU may be overloaded or the clip too long.");
}

// Build the correct Fal input per model family — the schemas differ significantly.
export function falInput(model: string, kind: GenKind, prompt: string, opts: { durationSeconds?: number; aspectRatio?: string }): Record<string, unknown> {
  const ar = opts.aspectRatio ?? "16:9";
  if (kind === "image") {
    // FLUX takes image_size (an enum), NOT aspect_ratio.
    const image_size = ar === "9:16" ? "portrait_16_9" : ar === "1:1" ? "square_hd" : ar === "4:5" ? "portrait_4_3" : "landscape_16_9";
    return { prompt, image_size };
  }
  if (/ltx-2/.test(model)) {
    // LTX-2.3: duration is an enum of SECONDS (6|8|10); resolution + aspect_ratio; NO num_frames.
    const secs = opts.durationSeconds ?? 6;
    const duration = secs <= 6 ? 6 : secs <= 8 ? 8 : 10;
    return { prompt, duration, resolution: "1080p", aspect_ratio: ar };
  }
  if (/ltxv-13b/.test(model)) {
    return { prompt, num_frames: Math.round((opts.durationSeconds ?? 5) * 24), resolution: "720p", aspect_ratio: ar };
  }
  // generic fallback (older/other video models)
  const input: Record<string, unknown> = { prompt, aspect_ratio: ar };
  if (opts.durationSeconds) input.num_frames = Math.round(opts.durationSeconds * 24);
  return input;
}

// ---- Fal.ai (queue API) ----
async function runFal(cfg: GenConfig, kind: GenKind, prompt: string, opts: { durationSeconds?: number; aspectRatio?: string }): Promise<string> {
  const model = kind === "video" ? cfg.videoModel : cfg.imageModel;
  const headers = { Authorization: `Key ${cfg.apiKey}`, "Content-Type": "application/json" };
  const input = falInput(model, kind, prompt, opts);

  const sub = await fetch(`https://queue.fal.run/${model}`, { method: "POST", headers, body: JSON.stringify(input) });
  if (!sub.ok) throw new Error(`Fal submit ${sub.status}: ${(await sub.text()).slice(0, 300)}`);
  const { request_id } = (await sub.json()) as { request_id: string };

  const base = `https://queue.fal.run/${model.split("/").slice(0, 2).join("/")}/requests/${request_id}`;
  for (let i = 0; i < 300; i++) { // up to ~10 min
    await sleep(2000);
    const st = await (await fetch(`${base}/status`, { headers })).json() as { status: string };
    if (st.status === "COMPLETED") break;
    if (st.status === "FAILED" || st.status === "ERROR") throw new Error(`Fal job ${st.status}`);
  }
  const out = await (await fetch(base, { headers })).json() as Record<string, unknown>;
  const found = pickUrl(out);
  if (!found) throw new Error(`Fal: no output URL in result: ${JSON.stringify(out).slice(0, 300)}`);
  return found;
}

// ---- Replicate (predictions API) ----
async function runReplicate(cfg: GenConfig, kind: GenKind, prompt: string, opts: { durationSeconds?: number; aspectRatio?: string }): Promise<string> {
  const model = kind === "video" ? cfg.videoModel : cfg.imageModel;
  const headers = { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" };
  const input: Record<string, unknown> = { prompt };
  if (opts.aspectRatio) input.aspect_ratio = opts.aspectRatio;
  // Set the clip LENGTH for video (was never set) — ltx-video takes num_frames (8k+1). Cap for cost.
  if (kind === "video" && opts.durationSeconds) {
    input.num_frames = Math.min(257, Math.round(((opts.durationSeconds * 24) - 1) / 8) * 8 + 1);
  }

  // model is "owner/name" (uses the latest version) or a bare version hash.
  const endpoint = model.includes("/") ? `https://api.replicate.com/v1/models/${model}/predictions` : "https://api.replicate.com/v1/predictions";
  const body = model.includes("/") ? { input } : { version: model, input };
  const sub = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
  if (!sub.ok) throw new Error(`Replicate submit ${sub.status}: ${(await sub.text()).slice(0, 300)}`);
  let pred = (await sub.json()) as { status: string; urls?: { get: string }; output?: unknown };

  for (let i = 0; i < 300 && pred.status !== "succeeded"; i++) {
    if (pred.status === "failed" || pred.status === "canceled") throw new Error(`Replicate job ${pred.status}`);
    await sleep(2000);
    pred = await (await fetch(pred.urls!.get, { headers })).json() as typeof pred;
  }
  const found = pickUrl(pred.output);
  if (!found) throw new Error(`Replicate: no output URL: ${JSON.stringify(pred.output).slice(0, 300)}`);
  return found;
}

/** Find the first media URL in a provider result (handles {video:{url}}, {images:[{url}]}, [url], "url"). */
function pickUrl(v: unknown): string | null {
  if (typeof v === "string" && /^https?:\/\//.test(v)) return v;
  if (Array.isArray(v)) { for (const x of v) { const u = pickUrl(x); if (u) return u; } return null; }
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    for (const key of ["video", "image", "url", "output", "images", "videos"]) {
      if (key in o) { const u = pickUrl(o[key]); if (u) return u; }
    }
    for (const val of Object.values(o)) { const u = pickUrl(val); if (u) return u; }
  }
  return null;
}
