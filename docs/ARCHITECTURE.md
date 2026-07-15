# Kaestral — Architecture

The enduring "how it fits together" reference. Read this first when picking up the codebase.

## The thesis (the one idea everything serves)

> **The editor is the hands; the LLM is the brain.** Kaestral doesn't build intelligence into the
> engine — it builds the most capable *hands* any LLM can drive. A connected LLM (Claude Code, in-app
> chat, Cursor, …) perceives the footage and the timeline, then operates a real non-linear editor
> through a bounded, validated tool surface. The race we're winning is the **capability surface**, not
> the model.

Two consequences that shape the whole codebase:
1. Every editing action is an **MCP tool** over a shared engine — never a one-off UI-only path. The
   desktop UI and the LLM drive the *same* engine.
2. Anything the LLM emits is **validated data, never executed code** — closed enums, clamped numbers,
   bounded arrays. There is no `eval`, no code-from-the-model. This is the safety model.

## Top-level layout

```
palmier-win/                      (local dir name; the repo is github.com/prabindersinghh/Kaestral-pro)
├── src/                          React 18 + TS frontend + the engine + MCP server (Vite)
│   ├── ui/                       the desktop editor UI (inline-styled, one token file: ui/theme.ts)
│   ├── engine/                   EditEngine — the pure, UI-independent edit core (one source of truth)
│   ├── state/                    EditorStore (useSyncExternalStore) + ProjectBridge (UI↔engine link)
│   ├── model/                    Timeline/Clip types, codec (.kaestral round-trip), sampling, enums
│   ├── mcp/                      the MCP server: server.ts (HTTP+stdio), executor.ts (tool impls),
│   │                             toolDefs.ts (the 50 tool schemas), skills.ts, mediaLibrary.ts, env.ts
│   ├── gen/                      SceneSpec validator (sceneSpec.ts) + hosted-gen config + download
│   ├── compositor/              CanvasPreview — the composited pixel preview
│   ├── render/                   the render CLI + node frame source (export pipeline)
│   ├── export/                   XMEML (Premiere) + FCPXML (Resolve/FCP) + SRT exporters
│   ├── color/ audio/ motion/     palette extraction · transcription/beats · canvas titles
│   └── project/                  package.ts — the .kaestral project reader/writer
├── remotion/                     standalone Remotion workspace (motion graphics render)
│   └── src/                      Generative.tsx interpreter + primitives/ + the reference films
├── src-tauri/                    Tauri 2 (Rust) desktop shell — window, updater, launch_claude_code
├── skills/                       bundled editing playbooks (art-direction, viral-reel, …) + catalog.json
├── landing/                      the marketing site (static HTML: index.html + pricing.html)
├── bin/kaestral.mjs              the `npx kaestral` entry (spawns dist-server/server.cjs)
├── scripts/                      bundle-server.mjs · prepare-resources.mjs · make-latest-json.mjs
├── docs/                         this file, MCP-TOOLS.md, LAUNCH-RUNBOOK.md, UPDATER-SETUP.md, …
└── fixtures/                     golden project/media JSON for round-trip tests
```

## The two front-ends, one engine

`EditEngine` (`src/engine/`) is the single mutation core. Both drivers go through it:

- **Desktop UI** (`src/ui/`): renders from `EditorStore` via `useSyncExternalStore`; user actions call
  store methods → engine.
- **MCP server** (`src/mcp/`): `McpExecutor.execute(tool, args)` validates args then calls the engine.

They stay in sync through `ProjectBridge` (`src/state/bridge.ts`): the running desktop app hosts the
HTTP server on `127.0.0.1:19789`, and the bridge pushes/pulls timeline state so edits the LLM makes
appear live in the window.

## The MCP server — two transports

`src/mcp/server.ts` has one JSON-RPC core, `handleMessage(msg)`, used by both transports:

- **stdio** (`src/mcp/stdio.ts`): the default for `npx kaestral`. Newline-delimited JSON-RPC on
  stdin/stdout. This is what `claude mcp add kaestral -- npx kaestral` uses — one command, zero config.
  **stdout carries ONLY JSON-RPC** (all logging goes to stderr) — do not `console.log` in this path.
- **HTTP** (`npx kaestral --http`, or the desktop app's own server): POST /mcp on 127.0.0.1:19789, plus
  it serves media/waveforms to the app's preview. Used by the in-app flow and http-transport clients.

`ALL_TOOL_DEFS` in `toolDefs.ts` = the **50 tools** (`TOOL_DEFS` 41 + `SKILL_TOOL_DEFS` 2 +
`MOTION_TOOL_DEFS` 3 + `ANALYSIS_TOOL_DEFS` 4). The 41 are a frozen name/schema contract mirrored from
the upstream Swift `ToolDefinitions`. Full reference: [MCP-TOOLS.md](./MCP-TOOLS.md).

## The generative motion surface (the differentiator)

This is the deepest part and the biggest recent investment.

- **`compose_motion`** takes a **SceneSpec** — a validated declarative JSON scene (beats → layers →
  elements with enter/exit/animate/hold/camera/transitions). `src/gen/sceneSpec.ts` is the pure
  validator: it never throws to the caller (`{ok,spec}|{ok,error}`), enforces closed enums / clamped
  numbers, and **fails loud** with the exact offending path on bad input.
- **`remotion/src/compositions/Generative.tsx`** is the trusted **interpreter**: it reads the validated
  SceneSpec and maps it onto the primitive registry (text/shape/hairline/chart/timeline/… + camera,
  masks, depth-of-field, motion blur, lighting sweeps). The remotion workspace is **standalone** — it
  does NOT import from `src/`; shared logic (e.g. bezier resolution in `primitives/easing.ts`) is
  duplicated by design.
- **Expressiveness** the SceneSpec supports (so an LLM can art-direct at a premium level): custom
  cubic-bezier easing `{curve:[…]}`, per-property `animate` tweens (each property on its own timeline),
  explicit `hold` windows, `enter.spring` physics + `enter.pacing:"manual"` (opt out of the anti-smear
  clamp), text `anchor`+`font`, `wordStagger` per-word reveal, anchored+eased `hairline` draws, eased
  `camera`, authorable beat `outFade`, and `transitionOut.overlapFrames`.
- **The craft skill** `skills/art-direction/SKILL.md` auto-loads for any connected LLM (referenced from
  the `compose_motion` description + SERVER_INSTRUCTIONS). It teaches the *decision process, physics,
  optical composition, rhythm, restraint, transition craft, conceptual ambition, worked examples, and
  failure modes* — so a cold LLM composes bespoke films, not templates. This is why Kaestral's motion
  reads as designed.

## Project file format (.kaestral)

`src/project/package.ts` reads/writes the **`.kaestral`** project package (timeline + media manifest).
`export_project` mode `"kaestral"` writes it; `"video"` renders H.264/H.265/ProRes; `"xml"`→Premiere
(XMEML); `"fcpxml"`→Resolve/FCP. (The format was renamed from the upstream `.palmier` — a clean
pre-launch break; layout/semantics otherwise unchanged. Round-trip is covered by
`src/model/__tests__/roundtrip.test.ts` + `fixtures/golden-project.json`.)

## Desktop shell (Tauri 2)

`src-tauri/` is a thin Rust shell: one window, drag-drop, `launch_claude_code`, a window close-request
guard (unsaved-changes confirm), and the **auto-updater** (`tauri-plugin-updater`, endpoint →
`Kaestral-pro/releases/latest/download/latest.json`, pubkey in `tauri.conf.json`). Signing key setup
and the release flow are in [UPDATER-SETUP.md](./UPDATER-SETUP.md).

`scripts/prepare-resources.mjs` assembles everything the packaged app needs (node.exe, ffmpeg/ffprobe,
`dist-server/`, remotion with the Chromium cache stripped, skills, whisper) into `src-tauri/resources/`
at build time — regenerated wholesale on every `npm run tauri build`.

## Privacy / local-first (a real invariant, not just marketing)

Transcription (whisper), frame vision, beat detection, palette extraction, and rendering all run
**on-device**. Nothing is uploaded. The only outbound data: AI prompts (to Anthropic, only if the user
uses in-app chat with their own key) and the waitlist email (only if they opt in). Keep it this way —
it's a selling point stated in the app and on the landing page.

## Conventions

- **Frontend styling:** inline styles referencing tokens in `src/ui/theme.ts`. No CSS framework.
- **Errors to users:** never a raw `e.message`/stack trace — route through `src/ui/errors.ts`
  `humanizeError()`.
- **Tests:** `npx vitest run` (full suite; includes real Remotion renders, ~4 min). `npx tsc --noEmit`
  must be clean. The MCP tool names + schemas are a contract — changing them is a deliberate act.
- **Landing:** plain static HTML; both `index.html` and `pricing.html` are self-contained (inline
  CSS/JS), mobile-audited (hamburger nav, no horizontal overflow at 320–768px).

See [DEVELOPMENT-HISTORY.md](./DEVELOPMENT-HISTORY.md) for the chronological record of major work.
