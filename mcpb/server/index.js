#!/usr/bin/env node
// Kaestral .mcpb entry point.
//
// This thin launcher lets Claude Desktop install Kaestral as a one-click connector. Rather than ship
// Kaestral's full engine (node_modules + ffmpeg + whisper + remotion resources = hundreds of MB) inside
// the .mcpb, it runs the published `kaestral` npm package via `npx` — so the bundle stays tiny and always
// launches the current release. Claude Desktop bundles Node/npx, so this works out of the box on Windows.
//
// stdio contract: this process must relay the child's stdin/stdout verbatim (that's the MCP JSON-RPC
// channel) and keep its OWN stdout clean — so all of our own logging goes to stderr.

const { spawn } = require("node:child_process");

const isWin = process.platform === "win32";
// On Windows, npx is a .cmd shim, so it must be invoked through the shell.
const npx = isWin ? "npx.cmd" : "npx";

process.stderr.write("Kaestral (.mcpb): launching the local editor engine via `npx kaestral`…\n");

// `-y` auto-confirms the package install on first run; `kaestral` runs its default stdio transport.
const child = spawn(npx, ["-y", "kaestral"], {
  stdio: ["pipe", "pipe", "inherit"], // pipe stdin/stdout (JSON-RPC), inherit stderr (logs)
  env: process.env,
  shell: isWin,
});

// Bridge the MCP stdio channel both ways.
process.stdin.pipe(child.stdin);
child.stdout.pipe(process.stdout);

child.on("error", (err) => {
  process.stderr.write(
    "Kaestral (.mcpb): failed to start `npx kaestral`. " +
      "Ensure Node.js/npm and FFmpeg + ffprobe are installed and on your PATH.\n" +
      String(err && err.message ? err.message : err) + "\n",
  );
  process.exit(1);
});

child.on("exit", (code) => process.exit(code == null ? 0 : code));

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => { try { child.kill(sig); } catch { /* already gone */ } });
}
