// Bundle the MCP server + render CLI into standalone CommonJS so the packaged app can run them on a
// plain Node runtime (no tsx, no TS source). @napi-rs/canvas is native → kept external and shipped
// alongside as a resource. Output: dist-server/{server,renderCli}.cjs
import { build } from "esbuild";

await build({
  entryPoints: { server: "src/mcp/main.ts", renderCli: "src/render/renderCli.ts" },
  outdir: "dist-server",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  external: ["@napi-rs/canvas"],
  outExtension: { ".js": ".cjs" },
  logLevel: "info",
});
console.log("bundled → dist-server/server.cjs, dist-server/renderCli.cjs");
