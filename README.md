# Maestro

**An AI-native video editor for Windows.** Edit on a real multi-track timeline — or let Claude edit
for you over MCP. Import your footage, cut it by hand or by prompt, and export a real MP4.

Maestro is an open-source (GPLv3) Windows port of [Palmier Pro](https://github.com/palmier-io/palmier-pro)
(© Palmier Inc.), rebuilt on **Tauri 2 + React + TypeScript** with an **FFmpeg** render pipeline. It keeps
Palmier's project format (`.palmier`) and its full **41-tool MCP contract**, so agents and configs built
for Palmier work against Maestro unchanged. Full credit and the port→upstream file map: [NOTICE.md](./NOTICE.md).

---

## What works today (each verified end-to-end)

- **The real loop:** import your own video (file picker or drag-drop) → see its true pixels on the
  preview and timeline → connect Claude over MCP and prompt edits to *that* project → export an MP4
  containing your footage.
- **Editor:** multi-track timeline (ruler, playhead, drag with snapping, split, delete, undo/redo,
  zoom), frame-accurate composited preview (transforms, crop, opacity, 16 blend modes, keyframes,
  titles), inspector (speed/volume/opacity/blend/transform + keyframe stamping), media panel.
- **Shared project state:** the app and the MCP server edit the *same* project live — your changes and
  Claude's merge in real time.
- **MCP server:** `palmier-pro` v1.0.0 on `http://127.0.0.1:19789/mcp` (localhost-only), all 41 tools
  with Palmier's exact names/schemas. Generation tools honestly report signed-out (no cloud).
- **Export:** H.264 / H.265 / ProRes video via FFmpeg, plus XMEML (Premiere), FCPXML (Resolve/FCP),
  and `.palmier` package.
- **Format parity:** `.palmier` projects round-trip (`project.json` / `media.json` semantics ported
  field-by-field from the Swift source).

**Honest gaps** (ranked): see [UPGRADES.md](./UPGRADES.md) — top items are smooth real-time playback
(preview currently seeks per frame), audio (waveforms/monitoring/mix-in-export), and pixel-exact
color kernels (LUT/curves/wheels render approximately in preview today).

## Quickstart

Prereqs: **Node 20+**, **Rust** (`rustup`, stable), **FFmpeg + ffprobe on PATH**, Windows 10/11.

```bash
git clone https://github.com/prabindersinghh/Maestro-pro
cd Maestro-pro
npm install
npm run tauri dev     # opens the Maestro window (auto-starts the project server)
```

In the app: **＋ Import** (or drop a file anywhere) → click the asset to place it at the playhead →
scrub the ruler, **Space** to play, **S** split, **Del** delete, **Ctrl+Z** undo → **⭳ Export MP4**.

## Let Claude edit your video

```bash
# the app auto-starts the project server; or run it standalone:
npm run mcp

# then point Claude Code at it:
claude mcp add --transport http palmier-pro http://127.0.0.1:19789/mcp
claude
```

Ask things like: *“Call get_timeline, then cut the first 2 seconds of my-vacation.mp4, add a title
that says ‘Trip 2026’, and export the project as video to C:\Users\me\Videos\trip.mp4.”*
Claude's edits appear in the Maestro window live; your manual edits are visible to Claude the same way.

## Development

```bash
npm test           # 127 tests: format round-trip, edit-engine invariants, MCP contract, exporters, render
npm run typecheck  # strict TS
npm run build      # production frontend
```

```
src/model/       .palmier format (Timeline/Clip/keyframes/effects) — ported from Sources/PalmierPro/Models
src/engine/      headless edit engine (ripple/sync-lock/linked A/V/trim math) — EditorViewModel+*
src/mcp/         MCP server + 41 tools + shared project state — Agent/MCP, Agent/Tools
src/compositor/  frame compositing + preview (real decoded pixels) — Compositing/FrameRenderer
src/export/      XMEML + FCPXML exporters — Export/XMLExporter, FCPXMLExporter
src/render/      FFmpeg H.264/H.265/ProRes render — Export/ExportService semantics
src/ui/          timeline, inspector, media panel — Timeline/, Inspector/, MediaPanel/
src-tauri/       Tauri 2 shell (window, dialogs, render command)
docs/            SPEC.md (frozen contract) + PROGRESS.md (verified gate ledger)
```

## License & credit

**GPLv3** — Maestro is a derivative work of **Palmier Pro** by Palmier Inc.
([palmier-io/palmier-pro](https://github.com/palmier-io/palmier-pro), GPLv3), re-implemented for
Windows using the Swift source as the executable specification. The `.palmier` format, MCP tool
contract, and editing semantics are theirs; the Windows implementation is this repo. Palmier's
proprietary cloud generation backend is not part of the upstream repo and is not ported — generation
tools return a clean “signed-out” response. See [LICENSE](./LICENSE) and [NOTICE.md](./NOTICE.md).
