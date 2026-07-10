import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "node:http";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generate } from "../hosted";
import { McpExecutor } from "../../mcp/executor";

// A stand-in for the VM's LTX FastAPI server: POST /generate → {jobId}; GET /jobs/{id} → {status,url};
// GET /media/x.mp4 serves a tiny real MP4. This proves Maestro's gcp-ltx flow end-to-end (submit →
// poll → download → import → place) WITHOUT a real GPU.
const dir = mkdtempSync(join(tmpdir(), "maestro-gcpltx-"));
const clip = join(dir, "clip.mp4");
let server: Server;
let base = "";
let sawAuth = "";

beforeAll(async () => {
  execFileSync("ffmpeg", ["-y", "-f", "lavfi", "-i", "color=c=0x123456:s=64x64:r=30:d=1", "-pix_fmt", "yuv420p", clip], { stdio: "ignore" });
  const fs = await import("node:fs/promises");
  server = createServer(async (req, res) => {
    const url = req.url ?? "";
    if (req.method === "POST" && url === "/generate") {
      sawAuth = req.headers.authorization ?? "";
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ jobId: "job-1" }));
    } else if (req.method === "GET" && url === "/jobs/job-1") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "done", url: `${base}/media/clip.mp4` }));
    } else if (url === "/media/clip.mp4") {
      res.writeHead(200, { "Content-Type": "video/mp4" });
      res.end(await fs.readFile(clip));
    } else {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}, 60000);

afterAll(() => server?.close());

describe("gcp-ltx generation provider", () => {
  it("submits, polls, and returns the result URL (with bearer auth)", async () => {
    const url = (await generate({ provider: "gcp-ltx", apiKey: "secret-token", videoModel: "ltx", imageModel: "ltx", baseUrl: base }, "video", "a blue room")).url;
    expect(url).toBe(`${base}/media/clip.mp4`);
    expect(sawAuth).toBe("Bearer secret-token"); // token forwarded
  }, 30000);

  it("errors clearly when the GPU server URL isn't set", async () => {
    await expect(generate({ provider: "gcp-ltx", apiKey: "", videoModel: "ltx", imageModel: "ltx" }, "video", "x"))
      .rejects.toThrow(/Start the GPU|no server URL/i);
  });

  it("end-to-end: generate_video via executor downloads the clip and places it on the timeline", async () => {
    const ex = new McpExecutor();
    ex.genConfig = { provider: "gcp-ltx", apiKey: "", videoModel: "ltx", imageModel: "ltx", baseUrl: base };
    const r = await ex.execute("generate_video", { prompt: "a blue room", durationSeconds: 1 });
    expect(r.isError).toBeFalsy();
    const out = JSON.parse(r.content[0].text ?? "{}") as { placed?: boolean; provider?: string };
    expect(out.provider).toBe("gcp-ltx");
    expect(out.placed).toBe(true);
    // the generated clip is now a real clip on the timeline
    const vids = ex.timeline.tracks.flatMap((t) => t.clips).filter((c) => c.mediaType === "video");
    expect(vids.length).toBeGreaterThanOrEqual(1);
  }, 30000);

  it("without a started GPU, generate_video tells the user to Start GPU", async () => {
    const ex = new McpExecutor();
    ex.genConfig = { provider: "gcp-ltx", apiKey: "", videoModel: "ltx", imageModel: "ltx" }; // no baseUrl
    const r = await ex.execute("generate_video", { prompt: "x" });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/Start GPU/i);
  });
});
