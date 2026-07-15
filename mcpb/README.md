# Kaestral `.mcpb` bundle (one-click Claude Desktop install)

An [MCP Bundle](https://github.com/anthropics/mcpb) (`.mcpb`) so users can install Kaestral into
**Claude Desktop with one double-click** — no JSON editing.

## What's here
- `manifest.json` — the bundle manifest (`manifest_version 0.3`). Declares a `node` server whose
  `mcp_config` runs `server/index.js`.
- `server/index.js` — a thin launcher that spawns the published **`npx kaestral`** package and bridges
  its stdio (the MCP JSON-RPC channel). This keeps the `.mcpb` tiny — it always runs the current release
  rather than embedding the whole engine (~hundreds of MB of node_modules + ffmpeg + whisper).
- `icon.png` — the connector icon.

## Prerequisites for the end user
Because the launcher runs `npx kaestral`, the user needs **Node.js / npm** and **FFmpeg + ffprobe** on
their PATH (same as the CLI path). Claude Desktop bundles Node, but FFmpeg must be installed. *(The
Windows installer is the zero-dependency alternative — it bundles everything.)*

## Build it
Requires the `kaestral` package to be published to npm first (so `npx kaestral` resolves).

```bash
# from repo root
npm run mcpb:pack     # -> mcpb/kaestral.mcpb
# (or manually:)
cd mcpb && npx @anthropic-ai/mcpb pack . kaestral.mcpb
```

`mcpb pack` validates the manifest and zips this directory into `kaestral.mcpb`.

## Ship it
Attach `kaestral.mcpb` to the GitHub release (alongside `Kaestral_<version>_x64-setup.exe`). The README
+ landing page link users to `releases/latest` to grab it. To install: **double-click `kaestral.mcpb`**
→ Claude Desktop adds Kaestral as a connector.

## Keep the version in sync
Bump `manifest.json`'s `version` to match `package.json` on each release, then re-pack.
