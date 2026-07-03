import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { McpServer, MCP_PORT, MCP_HOST } from "../server";
import { McpExecutor } from "../executor";

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

describe("Stage-C: MCP HTTP transport (palmier-pro on 127.0.0.1)", () => {
  it("frozen transport constants", () => {
    expect(MCP_PORT).toBe(19789);
    expect(MCP_HOST).toBe("127.0.0.1");
  });

  it("initialize returns palmier-pro 1.0.0 with tools capability", async () => {
    const { json } = await rpc("initialize", { protocolVersion: "2025-06-18" });
    expect(json.result.serverInfo).toEqual({ name: "palmier-pro", version: "1.0.0" });
    expect(json.result.capabilities.tools).toBeDefined();
    expect(json.result.capabilities.resources).toBeDefined();
  });

  it("tools/list returns all 41 tools", async () => {
    const { json } = await rpc("tools/list", {});
    expect(json.result.tools.length).toBe(41);
    expect(json.result.tools.map((t: { name: string }) => t.name)).toContain("get_timeline");
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
      "palmier://models/video",
      "palmier://models/image",
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
});
