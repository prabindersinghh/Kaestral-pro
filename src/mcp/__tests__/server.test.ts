import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { McpServer, MCP_PORT, MCP_HOST } from "../server";
import { McpExecutor } from "../executor";
import { TOOL_NAMES } from "../toolDefs";
import { version as PKG_VERSION } from "../../../package.json";

const PORT = 34567; // distinct from the contract port to avoid collisions during tests
let server: McpServer;

beforeAll(async () => {
  server = new McpServer(new McpExecutor(), PORT);
  await server.start();
});
afterAll(async () => {
  await server.stop();
});

async function rpc(method: string, params: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(`http://127.0.0.1:${PORT}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = res.status === 200 ? await res.json() : null;
  return { status: res.status, json };
}

describe("Stage-C: MCP HTTP transport (kaestral on 127.0.0.1)", () => {
  it("frozen transport constants", () => {
    expect(MCP_PORT).toBe(19789);
    expect(MCP_HOST).toBe("127.0.0.1");
  });

  it("initialize returns kaestral at the package.json version with tools capability", async () => {
    const { json } = await rpc("initialize", { protocolVersion: "2025-06-18" });
    // Dynamic, not pinned — the identity every connected agent sees must track the real version.
    expect(json.result.serverInfo).toEqual({ name: "kaestral", version: PKG_VERSION });
    expect(json.result.capabilities.tools).toBeDefined();
    expect(json.result.capabilities.resources).toBeDefined();
  });

  it("tools/list returns the frozen 41 plus the Skills extension (read_skill, list_skills)", async () => {
    const { json } = await rpc("tools/list", {});
    const names = json.result.tools.map((t: { name: string }) => t.name);
    // The frozen 41 parity tools are all still advertised.
    for (const n of TOOL_NAMES) expect(names).toContain(n);
    expect(names).toContain("get_timeline");
    // Plus the Kaestral extensions: Skills + motion graphics.
    expect(names).toContain("read_skill");
    expect(names).toContain("list_skills");
    expect(names).toContain("generate_title");
    expect(names).toContain("generate_motion");
    expect(names).toContain("compose_motion");
    // Plus the Analysis + perception extensions (reel/creative skills): beat, palette, vision.
    expect(names).toContain("analyze_audio");
    expect(names).toContain("extract_palette");
    expect(names).toContain("see_video");
    expect(names).toContain("import_from_url");
    expect(json.result.tools.length).toBe(52); // 41 frozen + skills(2) + motion(3) + analysis(6: analyze_audio, extract_palette, match_motion, detect_scenes, import_from_url, see_video)
  });

  it("tools/call get_timeline returns canGenerate:false", async () => {
    const { json } = await rpc("tools/call", { name: "get_timeline", arguments: {} });
    expect(json.result.isError).toBeFalsy();
    const tl = JSON.parse(json.result.content[0].text);
    expect(tl.canGenerate).toBe(false);
  });

  it("resources/list exposes the two model resources", async () => {
    const { json } = await rpc("resources/list", {});
    expect(json.result.resources.map((r: { uri: string }) => r.uri)).toEqual([
      "kaestral://models/video",
      "kaestral://models/image",
    ]);
  });

  it("GET /.well-known/oauth-protected-resource", async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/.well-known/oauth-protected-resource`);
    const json = await res.json();
    expect(json.resource).toBe(`http://127.0.0.1:${PORT}`);
  });

  it("GET /mcp opens the SSE keep-alive", async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/mcp`);
    expect(res.headers.get("content-type")).toMatch(/text\/event-stream/);
    await res.body?.cancel();
  });

  it("validator: rejects non-JSON content-type (415)", async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "{}",
    });
    expect(res.status).toBe(415);
  });

  it("validator: rejects a non-localhost Origin (403)", async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://evil.example" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
    });
    expect(res.status).toBe(403);
  });

  it("unknown path 404s", async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/nope`);
    expect(res.status).toBe(404);
  });

  it("GPU endpoints are routed and return sensible shapes (gcp-ltx)", async () => {
    const B = `http://127.0.0.1:${PORT}`;
    // /gpu/status with nothing configured → stopped
    const s0 = await (await fetch(`${B}/gpu/status`)).json();
    expect(s0.status).toBe("stopped");
    // configure a VM
    const cfg = await fetch(`${B}/gpu/config`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project: "p", zone: "us-central1-a", instance: "ltx-gpu", port: 8000 }) });
    expect((await cfg.json()).ok).toBe(true);
    // missing required fields → 400
    const bad = await fetch(`${B}/gpu/config`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project: "p" }) });
    expect(bad.status).toBe(400);
    // status now probes gcloud; with no gcloud installed it resolves to error/stopped, never a crash
    const s1 = await (await fetch(`${B}/gpu/status`)).json();
    expect(["error", "stopped", "starting"]).toContain(s1.status);
  });
});

// A3 (field report v1.0.5): the bridge endpoints (/state, /gen-config, /gpu/*, /upload, /media/:id,
// /waveform/:id) were served BEFORE the Origin gate with `Access-Control-Allow-Origin: *`, so any page
// in any browser tab could read the whole timeline + media manifest (incl. the absolute projectDir),
// replace the project, write into the media dir, read imported bytes, repoint the generation key, and
// start/stop the user's GCP VM. Every path is now behind the same loopback Origin allowlist + a Host
// check (DNS rebinding), and CORS echoes only an allowed Origin. A MISSING Origin stays allowed — CLI
// MCP clients legitimately send none.
describe("A3: bridge endpoints share the loopback Origin/Host gate", () => {
  const B = `http://127.0.0.1:${PORT}`;
  const BRIDGE_PATHS: [string, string][] = [
    ["GET", "/state"], ["POST", "/state"], ["GET", "/gen-config"], ["POST", "/gen-config"],
    ["GET", "/gpu/status"], ["POST", "/gpu/config"], ["POST", "/gpu/start"], ["POST", "/gpu/stop"],
    ["POST", "/upload?name=x.bin"], ["GET", "/media/anything"], ["GET", "/waveform/anything"],
    ["GET", "/.well-known/oauth-protected-resource"], ["GET", "/mcp"],
  ];

  it("rejects a foreign Origin on every bridge path (403) and never grants it CORS", async () => {
    for (const [method, path] of BRIDGE_PATHS) {
      const res = await fetch(`${B}${path}`, { method, headers: { Origin: "https://evil.example", "Content-Type": "application/json" }, body: method === "POST" ? "{}" : undefined });
      expect(res.status, `${method} ${path}`).toBe(403);
      expect(res.headers.get("access-control-allow-origin"), `${method} ${path}`).toBeNull();
      await res.body?.cancel();
    }
    // The CORS preflight itself is gated too — a foreign page gets no 204 to build on.
    const pre = await fetch(`${B}/state`, { method: "OPTIONS", headers: { Origin: "https://evil.example" } });
    expect(pre.status).toBe(403);
  });

  it("rejects a foreign Host header (DNS rebinding) even with no Origin", async () => {
    const { request } = await import("node:http");
    const status = await new Promise<number>((resolve, reject) => {
      const req = request({ host: "127.0.0.1", port: PORT, path: "/state", method: "GET", headers: { Host: "evil.example" } }, (res) => { res.resume(); resolve(res.statusCode ?? 0); });
      req.on("error", reject);
      req.end();
    });
    expect(status).toBe(403);
  });

  it("accepts a MISSING Origin (CLI clients) on bridge paths", async () => {
    const res = await fetch(`${B}/state`); // Node fetch sends no Origin header
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("timeline");
    expect(res.headers.get("access-control-allow-origin")).toBeNull(); // no Origin → no CORS grant needed
  });

  it("accepts loopback Origins and echoes them exactly (never '*'): dev webview, packaged Tauri webview", async () => {
    for (const origin of ["http://localhost:1420", "http://127.0.0.1:1420", "http://tauri.localhost", "tauri://localhost"]) {
      const res = await fetch(`${B}/state`, { headers: { Origin: origin } });
      expect(res.status, origin).toBe(200);
      expect(res.headers.get("access-control-allow-origin"), origin).toBe(origin);
      expect(res.headers.get("vary")).toMatch(/Origin/);
      await res.body?.cancel();
      const pre = await fetch(`${B}/state`, { method: "OPTIONS", headers: { Origin: origin } });
      expect(pre.status, origin).toBe(204);
      expect(pre.headers.get("access-control-allow-origin")).toBe(origin);
    }
  });
});
