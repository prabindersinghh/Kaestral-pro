# Palmier Pro → Windows Port — PROGRESS LOG

> Living context file. Append a new dated entry every work session and at each gate.
> Read this first when resuming — it is the running memory of the port.

---

## Project at a glance

- **Goal (Phase 1):** Reproduce macOS **Palmier Pro** (Swift, GPLv3) on **Windows** at *exact parity*
  — same `.palmier` project format, same MCP contract, same editor behavior. **No new features.**
- **Target stack:** Tauri 2 (Rust) + React + TypeScript · FFmpeg sidecar · `@modelcontextprotocol/sdk`
  (TS) for MCP · WebGL2/WGSL for compositing.
- **Source repo (executable spec, read-only):** `palmier-pro-main/` in this workspace.
- **Port artifacts live at workspace root** (beside, not inside, the GPLv3 source):
  `SPEC.md`, `PROGRESS.md` (this file), and later `UPGRADES.md`.
- **Build order:** A Foundations → B Edit engine (headless) → C MCP server → D Compositing/preview/export
  → E UI parity → F deferred (transcription/search/chat/generation).

---

## Entry — 2026-07-01 · Step 1: Spec extraction (COMPLETE)

**Who/what:** Read the spec-critical Swift source and produced `SPEC.md`. No code written yet
(per the kickoff: "No code yet" for step 1). This was the gate-1 deliverable.

### Files read (source of truth, all under `palmier-pro-main/Sources/PalmierPro/`)
- `Models/Timeline.swift` — Timeline, Track, Clip, Transform, Crop + all invariants/helpers.
- `Models/ClipType.swift` — enum + file-extension map + isVisual/isCompatible.
- `Models/Keyframe.swift` — Keyframe, KeyframeTrack, AnimPair, Interpolation, sampling, smoothstep.
- `Models/Effect.swift`, `Compositing/EffectRegistry.swift` — Effect/EffectParam + 20 effect descriptors.
- `Models/BlendMode.swift` — 16 blend modes.
- `Models/TextStyle.swift`, `Models/TextAnimation.swift` — text styling + WordTiming + 11 anim presets.
- `Models/MediaManifest.swift`, `Models/MediaAsset.swift`, `Models/MediaFolder.swift` — media.json schema.
- `Models/GradeCurve.swift`, `Models/HueCurves.swift` — color curve payloads.
- `Models/VideoLayout.swift` — 10 layout templates + slot rects.
- `Agent/Tools/ToolDefinitions.swift` (989 lines, full) — the tool contract.
- `Agent/MCP/MCPHTTPServer.swift`, `Agent/MCP/MCPService.swift` — transport + registration.
- `Agent/Tools/ToolExecutor+Generate.swift` — signed-out/stub behavior.
- `Project/VideoProject.swift`, `Utilities/Constants.swift` — `.palmier` package layout + constants.

### Key findings (these shape the port — see SPEC.md for detail)
1. **⚠️ 41 MCP tools, not 43.** `ToolDefinitions.all` registered verbatim = 41. Brief overcounted
   (media-library is 8, generation is 4). `read_skill` is in-app only, NOT on MCP.
2. **⚠️ "Omit defaults" is a `get_timeline` *tool-output* behavior, not `project.json`.** `project.json`
   is a plain `JSONEncoder().encode(Timeline)` with synthesized Codable → **all non-optional fields
   always written**; only nil optionals omitted. Only `Transform` has a custom encoder (all 7 always).
   → The port's `project.json` writer must NOT omit default-valued non-optional fields.
3. Round-trip acceptance is **semantic** (decode both, deep-equal), not byte-identical — JSONEncoder
   is compact, unsorted, reference-date dates; JS/Rust ordering will differ.
4. Keyframe default interpolation is **`.smooth`** (not linear) and always encoded.
5. Volume keyframe values are **dB** (linear gain via VolumeScale); trims are in **project frames**;
   keyframes are **clip-relative**; position kf = top-left, scale kf = normalized w/h.
6. MCP: port **19789**, bind **127.0.0.1** IPv4 only, `POST /mcp`, server **`palmier-pro` v1.0.0**,
   3 validators (origin/content-type/protocol), GET SSE `: connected`, oauth-protected-resource probe,
   2 resources (`palmier://models/{video,image}`).
7. Stub shape: `canGenerate = isSignedIn && hasCredits` → always `false` on Windows; generation tools
   throw "Generation requires signing in to Palmier…"; `list_models` → `{"models":[],"loaded":false}`.

### Deliverable
- `SPEC.md` written at workspace root — full project.json/media.json schemas, `.palmier` layout,
  MCP transport contract, all 41 tools with required args + semantics, effect/layout/blend enums,
  generation-stub behavior, and a §14 list of open items to verify before building.

### Open items carried forward (from SPEC §14)
- [ ] Obtain a real macOS-saved `.palmier` as the round-trip golden file (none confirmed in-repo yet).
- [ ] Read `ToolExecutor+Timeline.swift` in full to capture the exact `get_timeline` output dict
      (the default-omitting shape) — needed for the Stage-C MCP gate.
- [ ] Confirm `ToolResult.toMCPResult()` content-block/isError shape (`ToolResult.swift`).
- [ ] Document `GenerationLog` schema (`generation-log.json`) — preserve-only.
- [ ] Verify `media.json` Date encoding (reference-date Double) against a real manifest.

### Next gate (Stage A — Foundations)
1. Scaffold Tauri 2 + React + TS; wire FFmpeg/ffprobe sidecar; confirm they run from the app.
2. Port the data model to TS types + (de)serializers matching §2–§7 defaults/encoding exactly.
3. Port `.palmier` load/save (§1). **Gate:** round-trip a macOS `.palmier` with a clean *semantic*
   `project.json` diff.

> ⏸️ **Awaiting lead review of SPEC.md before starting Stage A** (kickoff says "stop at each gate").

---

## Entry — 2026-07-01 · Golden-file run-down + Stage A (scaffold + data-model port)

### Golden-file investigation (reported to lead)
- **No real macOS-saved `.palmier` is reachable from the repo.** Bundled samples are fetched at
  runtime from a Convex backend: `SampleProjectService.materialize` → `GET /v1/samples/resolve?slug=`
  returns `{project, manifest, downloads, …}` JSON (`Project/SampleProjectService.swift:52`). The base
  URL is `BackendConfig.convexHttpURL`, read from the **build-private** Info.plist key
  `PalmierConvexHttpURL` (`Account/BackendConfig.swift:7,13`) — absent from the open-source repo, so
  the backend is unreachable and there is no public Palmier-authored `.palmier` to grab. We have no Mac.
- No `.palmier`/`project.json`/`media.json` fixtures are committed anywhere.
- The Swift **test suite is a behavioral reference**: `Tests/PalmierProTests/Media/ProjectRoundTripTests.swift`
  encodes the app's own semantic round-trip + tolerant-decode contract (Timeline/Clip/Transform/Crop/
  keyframes/text/MediaManifest both `MediaSource` kinds/GenerationLog). We ported its cases to TS.

### Decision (lead): author a spec-traceable golden fixture by hand
Since `project.json` is deterministic `JSONEncoder` output of `Timeline` (which we have exactly), the
golden file is **hand-authored from `Models/*`**, not from our writer — so the round-trip test against
it is a *real* gate, not a self-check. Committed:
- `palmier-win/fixtures/golden-project.json` — Timeline exercising every non-default + optional field
  (speed≠1, non-identity transform/crop, all 6 keyframe-track types w/ smooth interp + dB volume,
  text clip w/ textStyle+textAnimation+wordTimings, linkGroupId, captionGroupId, blendMode, effects).
- `palmier-win/fixtures/golden-media.json` — MediaManifest with **both** `MediaSource` variants
  (`external.absolutePath`, `project.relativePath`), folderId, optional metadata, a folder.
- `palmier-win/fixtures/golden-fixtures.notes.md` — every field → source-line/default mapping.
- **Status: provisional-but-spec-authoritative.** Dates intentionally excluded (reference-date Double
  encoding unconfirmed). **If a genuine `.palmier` is later obtained → diff against the fixture,
  reconcile MediaSource shape + Date encoding, and promote it.**

### Stage A — scaffold + data-model port (BUILT & VERIFIED)
New port project at `palmier-win/` (Tauri 2 + React + TS + Vitest). Toolchain probe:
**node v22.18 ✓, npm 11.12 ✓, ffmpeg 8.0 ✓ (on PATH), git ✓ — but Rust/cargo MISSING.**
- **Frontend + engine + tests are fully runnable now** (pure TS on Node/Vite/Vitest).
- **Tauri native shell is scaffolded but NOT compiled** (needs `rustup`): `src-tauri/` has
  `Cargo.toml`, `tauri.conf.json` (id `io.palmier.pro.win`, port 1420), `build.rs`, `src/main.rs`,
  `src/lib.rs` (fs plugin). Compilation deferred until Rust is installed — does not block Stage A/B.

Ported (TS, behavior-not-syntax):
- `src/model/enums.ts` — ClipType (+isVisual/isCompatible/ext-map), Interpolation, BlendMode,
  TextAlignment, TextAnimationPreset, VideoLayout/LayoutFit.
- `src/model/types.ts` — every model interface; `?` ⇔ Swift Optional.
- `src/model/defaults.ts` — default factories traceable to `Models/*`.
- `src/model/codec.ts` — decode (tolerant) + encode enforcing **SPEC §0.2** (non-optional always,
  optional omit-if-nil); Transform custom-encodes all 7; Track omits displayHeight.
- `src/model/media.ts` — MediaManifest/MediaSource/MediaFolder; gen/import/date fields passthrough.
- `src/model/helpers.ts` — pure invariants (endFrame, sourceFramesConsumed, sampleTrack hold/linear/
  smooth, fadeMultiplier, timelineFrameForSourceSeconds) — one engine for UI + (Stage C) MCP.
- `src/project/package.ts` + `nodeFs.ts` — `.palmier` load/save, FS-abstracted (Node now, Tauri later).

### Stage-A gate result
Command: `cd palmier-win && npm test` → **23/23 pass**; `npx tsc --noEmit` clean; `npm run build` OK.
- **Gate (b) — PASSED (real):** writer emits every non-optional, omits only nil optionals; Transform=7,
  Crop=4, Track has no displayHeight, Timeline no totalFrames; MediaSource external/project shape exact.
- **Gate (a) — PASSED against the provisional fixture:** golden-project.json + golden-media.json +
  package load/save all decode→encode deep-equal with no loss / no spurious omission.
- ⚠️ **Parity NOT declared.** Per lead: building ahead is fine, but the fixture is source-derived, not
  a macOS artifact — true byte/shape parity (esp. MediaSource + Date) stays **PENDING a genuine
  `.palmier`**. When one arrives: drop it in `fixtures/`, diff, reconcile, promote, then declare parity.

### Next (Stage B — headless edit engine)
Port EditorViewModel edit ops (add/insert/remove/move/split/ripple/trim/speed/keyframes/link-group/
sync-lock/undo) into one pure TS module over the model; unit-test the invariants (ripple+sync-lock
refusal, linked A/V, trim-in-project-frames, clip-relative keyframes). Then Stage C (MCP, 41 tools).
Install Rust (`rustup`) when the native shell / FFmpeg sidecar is needed.

> ⏸️ Stage A built and self-verified. Parity gate (a) remains formally pending a genuine `.palmier`.

---

## Standing requirements (not one-time tasks)

### Licensing / attribution — path A (settled by lead 2026-07-01)
Open-source Windows port under the lead's brand, **with full Palmier credit**. This is a **derivative
work of GPLv3 code**, so the port is **GPLv3** too.
- `palmier-win/LICENSE` = GPLv3 (copied from upstream). `palmier-win/NOTICE.md` credits
  `palmier-io/palmier-pro` + a port→upstream file map. README carries an attribution + license line.
- **Standing rule:** every ported file that mirrors a specific Palmier source file MUST carry an origin
  comment naming its upstream file (e.g. `// Ported from Editor/RippleEngine.swift`). New engine/tool
  files must add one. Keep the NOTICE.md file map current as files are added.
- The proprietary generative-AI backend is NOT upstream and NOT ported (generation stubbed, SPEC §10).

### Rust toolchain gate (first runnable build)
`rustup`/cargo is **not installed** here. The **pure-TS engine + MCP layer build and test without it**.
But these REQUIRE Rust + the FFmpeg sidecar and must not be started before installing `rustup`:
- **Stage D** (preview/export: WebGL/WebCodecs preview, FFmpeg render, interchange exporters), and
- **any on-screen app run** (`npm run tauri dev/build`, the native window).
Install `rustup` at the Stage-C→D boundary so it's not a surprise. FFmpeg 8.0 is already on PATH.

---

## Entry — 2026-07-01 · Stage B: headless edit engine (BUILT & VERIFIED)

Pure, UI-independent edit engine at `palmier-win/src/engine/`, one module shared by UI + MCP.
Ported from `Editor/RippleEngine.swift`, `OverwriteEngine.swift`, and `EditorViewModel+{ClipMutations,
Ripple,Linking,Keyframes,Tracks}.swift`.
- `ripple.ts` — RippleEngine (mergeRanges, computeRippleShifts[ForRanges], computeRipplePush).
- `overwrite.ts` — OverwriteEngine (remove/trimEnd/trimStart/split region clearing).
- `clipOps.ts` — setDuration, clamp/rescale keyframes, clampFades, rescaleWordTimings, trimValues,
  split-keyframe-track (clip-relative rebase).
- `editEngine.ts` — `EditEngine` class: add/insert/remove/removeTracks/move/split/trim/commitTrim/
  setClipSpeed/mutateClips/setKeyframes/rippleDeleteClips/rippleDeleteRangesOnTrack + undo/redo
  (snapshot-swap, matching withTimelineSwap).

### Source finding (recorded in engine comments)
`rippleDeleteRangesOnTrack` (the `ripple_delete_ranges` tool path, via `ToolExecutor+Clips.swift:782`)
adds **every** sync-locked track to `clearTrackIds` and CUTS it, so its refusal branch is **unreachable**
in that path — it never refuses; `ignoreSyncLockedTracks` just leaves a track untouched. The genuine
**sync-lock refusal** lives in the selection path `rippleDeleteSelectedClips` (shifts sync-locked
tracks without cutting → can collide → refuses). Ported both; refusal invariant tested on the real
refusing path (`rippleDeleteClips`).

### Stage-B gate result
`cd palmier-win && npm test` → **47/47 pass**; `npx tsc --noEmit` clean. Invariants covered:
- **ripple + sync-lock refusal**: `rippleDeleteClips` refuses (no change, names track) when a
  sync-locked follower can't absorb; succeeds when unlocked; tool path cuts-not-refuses (documented).
- **linked A/V propagation**: move (partner follows by delta), remove (whole group), split (partner
  split + right-halves regrouped), ripple-delete (partner track cut on same range), trim (propagates).
- **trim-in-project-frames**: project-frame edge drag → source trim ×speed, back to timeline ÷speed.
- **clip-relative keyframes**: setKeyframes stores 0-relative; unchanged on move; dB volume; sort +
  dedup last-wins; empty clears.
- plus core: add (overwrite), insert (ripple push), speed (rescale + chain ripple), undo.

### Next: Stage C (MCP server) — proceeding without idling (licensing settled = path A)
Read `Agent/Tools/ToolExecutor*.swift` + `ToolResult.swift`; stand up localhost MCP on **19789**
(`palmier-pro` v1.0.0, origin/content-type/protocol validators) with `@modelcontextprotocol/sdk`;
register all **41** tools wired to `EditEngine`; generation tools return the signed-out shape,
`list_models` → `{models:[],loaded:false}`, `get_timeline.canGenerate=false`.

> ✅ Stage B verified. Continuing to Stage C. Hard stops remain: real `.palmier` (parity sign-off) — n/a here.

---

## Entry — 2026-07-01 · Stage C: MCP server + 41 tools (BUILT & VERIFIED)

Localhost MCP server at `palmier-win/src/mcp/`, ported from `Agent/MCP/*` + `Agent/Tools/*`.
- `toolDefs.ts` — the **41** tools with exact names + inputSchemas (frozen contract; a guard throws
  if the count ≠ 41). `read_skill` intentionally absent (in-app only). ⚠️ Tool *descriptions* are
  faithful source-derived summaries; **verbatim description sync from ToolDefinitions.swift is a tracked
  release checklist item** (names + schemas are exact now).
- `executor.ts` — `McpExecutor`: dispatches all 41 tools to the shared `EditEngine` + `MediaLibrary`.
  Edit/read/library/project tools implemented; generation → signed-out error; `list_models` →
  `{models:[],loaded:false}`; transcription/render tools → structured "unavailable in this build".
  `get_timeline.canGenerate` = false.
- `getTimelineOutput.ts` — the COMPACT default-omitting `get_timeline` form (ports compactTrack/
  compactClip/strippingDefaults/captionGroup) — distinct from project.json (SPEC §0.2).
- `server.ts` — HTTP server on **127.0.0.1:19789**, `POST /mcp`, GET SSE `: connected`, oauth probe,
  three validators (origin 403 / content-type 415 / protocol), JSON-RPC (initialize, tools/list,
  tools/call, resources/list+read, ping). Identity **palmier-pro 1.0.0**.
- `main.ts` + `npm run mcp` — runnable server (optionally loads a `.palmier`). For
  `claude mcp add --transport http palmier-pro http://127.0.0.1:19789/mcp`.

### Stage-C gate result
`cd palmier-win && npm test` → **65/65 pass** (18 new: 8 executor + 10 server); `tsc --noEmit` clean.
Live smoke test (`npm run mcp` on **19789** + curl):
- `initialize` → `{serverInfo:{name:"palmier-pro",version:"1.0.0"}, capabilities:{tools,resources}}` ✓
- `tools/list` → **41** ✓
- `tools/call get_timeline` → compact JSON, `canGenerate:false` ✓
- `/.well-known/oauth-protected-resource` → `{"resource":"http://127.0.0.1:19789"}` ✓
- validators: non-localhost Origin 403, non-JSON 415, unknown path 404, GET SSE stream ✓
- headless edit flow: get_timeline → add_clips → ripple_delete_ranges → undo ✓; generation stub ✓.

### Phase-1 stubs still honest (register + report unavailable, never fake)
generate_*/upscale (signed-out), list_models (loaded:false), get_transcript/add_captions/search_media/
remove_words/sync_audio/inspect_media/inspect_timeline/inspect_color (unavailable), apply_layout +
apply_color/apply_effect (stack edit + render is Stage D), export_project video/xml/fcpxml (Stage D;
`palmier` export works via the package writer).

### ⛔ Reached the Rust/FFmpeg boundary (Stage D)
Per the standing gate: **Stage D (preview/export render) + any on-screen app need `rustup` + the FFmpeg
sidecar.** FFmpeg 8.0 is on PATH; Rust is NOT installed. Pure-TS slices of Stage D that need NO Rust:
the **XMEML (`XMLExporter`) and FCPXML (`FCPXMLExporter`) interchange exporters** (pure timeline→XML)
and the already-working `.palmier` exporter. The H.264/H.265/ProRes video render + WebGL/WebCodecs
preview + native window require the toolchain install — a decision at this boundary.

> ✅ Stages A, B, C complete & verified. Next boundary = install `rustup` (for video render + preview +
> app) OR proceed with the pure-TS interchange exporters (XMEML/FCPXML) first. Awaiting the call on rustup.

---

## Entry — 2026-07-01 · Stage D (pure-TS slice): interchange exporters (BUILT & VERIFIED)

Ported the two pure-TS exporters (no Rust/FFmpeg needed) so `export_project` xml/fcpxml now work.
- `src/export/xml.ts` — **XMEML 4** (Premiere) from `Export/XMLExporter.swift`: sequence shell, tracks
  (video reversed bottom→top), clipitems (start/end/in/out), Time Remap (speed), Audio Levels
  (volume static+kf), Opacity, Basic Motion (transform static+kf), Crop, single-sided fade
  transitions, reciprocal `<link>` blocks, per-file NTSC rate tags.
- `src/export/fcpxml.ts` — **FCPXML 1.10** (Resolve/FCP) from `Export/FCPXMLExporter.swift`: resources
  (format/asset/compound), ref-clip over compound, timeMap retime, adjust-transform (pos/scale/rot
  +kf, flip), adjust-crop, adjust-blend (opacity +kf), adjust-volume (dB, static), titles for text.
  Font family/face use the deterministic fallback (no NSFont on Windows) — noted fidelity diff.
- `src/export/timecode.ts` — SMPTE drop/non-drop math + source-timecode tags. tmcd probing not
  available → files fall back to a dummy 00:00:00:00 (faithful for footage without a timecode track).
- `src/export/xmlTree.ts` / `resolver.ts` — shared XML renderer + exporter media-resolution surface.
- Wired into `McpExecutor.exportProject`: **xml → XMEML, fcpxml → FCPXML, palmier → package (all work);
  video → reports Stage D** (needs FFmpeg). Matches the tool's `export_project` modes.

### Gate result
`cd palmier-win && npm test` → **86/86 pass**; `npx tsc --noEmit` clean. Coverage:
- `timecode.test.ts` (7) — mirrors the Swift `XMLExporterTimecodeTests` vectors **exactly**
  (18:13:40:20 non-drop, 00;23;53;18 drop @30 on 60p, NTSC fallbacks, formatTimecode math).
- `interchange.test.ts` (13) — XMEML shell/clipitem/in-out/TimeRemap/Opacity/link/fade; FCPXML
  shell/ref-clip/compound/adjust-volume-dB/timeMap/title/rational-seconds.
- `executor.test.ts` — export_project xml+fcpxml+palmier write real files; video reports Stage D.

## ⛔ HUMAN STOP: Rust toolchain install (Prabinder's machine)

Everything buildable without Rust is done and green (model, .palmier I/O, edit engine, MCP + 41 tools,
interchange exporters). The **native/visible layer (Tauri app: timeline UI, preview, inspector, media
panel, compositor, video render H.264/H.265/ProRes) requires `rustup` + the FFmpeg sidecar**, which
needs Prabinder's machine. FFmpeg 8.0 is already on PATH. Steps handed to Prabinder (see chat / below):
install `rustup` (stable) + MSVC C++ Build Tools + WebView2, then `npm run tauri dev`. **Paused here per
plan.** After Rust is in: Tauri app + compositor + video render, each verified against SPEC invariants.

> ✅ Interchange exporters verified (86/86). Paused at the Rust install boundary (human step) as directed.

**Icon fix (2026-07-03):** Rust/C++/WebView2 all confirmed working on Prabinder's machine; first
`tauri dev` reached the Vite server on :1420 and failed only on missing `icons/icon.ico`. Generated a
themed 1024×1024 `palmier-win/app-icon.png` (dark canvas + 3 staggered "timeline" bars) via FFmpeg and
ran `npx tauri icon app-icon.png` → `src-tauri/icons/` now has `icon.ico` (valid 6-image MS icon
resource), `icon.png`, `icon.icns`, `32x32.png`, `128x128*`, and the Square*/StoreLogo set.
`tauri.conf.json` already references the three desktop icons — no config change. **Ready to re-run
`npm run tauri dev`; the window should open.**

---

## Entry — 2026-07-03 · Stage E gate 1: Timeline UI (BUILT & VERIFIED)

Window opened on Prabinder's machine (icons fixed). Built the real editor into it, timeline first.
- `src/ui/theme.ts` — single design-token module (mirrors the AppTheme rule); timeline layout
  constants from `Constants.swift` (rulerHeight 24, trackHeight 50, dropZoneHeight 60, headerWidth 100,
  pixelsPerFrame 4), snap + zoom constants.
- `src/ui/timeline/geometry.ts` — `TimelineGeometry` ported from `Timeline/TimelineGeometry.swift`
  (xForFrame/frameAt/clipRect/trackY/trackAt/cumulativeY + zoom clamp).
- `src/ui/timeline/snap.ts` — `SnapEngine` ported from `Timeline/SnapEngine.swift` (collectTargets,
  findSnap with sticky hold + playhead priority).
- `src/state/store.ts` — `EditorStore` (one shared `EditEngine` + `MediaLibrary` + view state) exposed
  to React via `useSyncExternalStore`; all edits go through the engine. `src/state/demoProject.ts` — a
  representative project (text/video×2/audio×2 tracks, linked A/V, 6 clips) so the UI has content.
- `src/ui/timeline/Timeline.tsx` — ruler (timecode ticks), fixed track-header column, scrollable lanes,
  clips coloured by type, playhead; interaction: click-to-move-playhead (snapped), clip select
  (shift=additive), clip drag with SnapEngine, Ctrl/⌘-wheel zoom, keys (Del remove, S split, ⌘/Ctrl+Z
  undo/redo). `src/ui/Editor.tsx` — toolbar (undo/redo/split/delete/zoom, frame+resolution readout) +
  preview placeholder + timeline. `App.tsx`/`index.css` wired.

### Gate result — verified 3 ways
1. **Unit tests:** `geometry.test.ts` (5) + `snap.test.ts` (6) against SPEC constants. **97/97 pass**,
   `tsc --noEmit` clean, `npm run build` OK.
2. **Live render (Playwright on the running Vite dev server):** toolbar + 5 headers with correct
   **mirrored V/A numbering** (T1/V2/V1/A1/A2), ruler 0:00–0:14, all 6 clips, playhead. No JS errors
   (only a benign favicon 404).
3. **Live interaction through EditEngine:** select `a-hero` → Delete removed it **and its linked audio**
   + **pruned the emptied track** → Undo restored all 6 clips + the track. Faithful link-group + prune
   + snapshot-undo, end-to-end in the real UI.

Note: the Vite dev server is live and Tauri points at it, so the window HMR-updates to the new editor
(or re-run `npm run tauri dev`).

> ✅ Timeline UI verified. Next: frame-accurate preview (canvas compositor), then inspector + media panel.

---

## Entry — 2026-07-03 · Stage E gate 2: frame-accurate preview / compositor (BUILT & VERIFIED)

- `src/compositor/frameState.ts` — pure `composeFrame(timeline, frame)` → layers bottom→top. Ports
  FrameRenderer stacking + `CompositionBuilder.affineTransform`: visual tracks only, hidden skipped,
  model stores tracks top→bottom so iterate reversed; each clip → normalized canvas box (topLeft/size),
  rotation, flip, opacity(incl. fade), crop, blendMode. `blendToCanvas` maps the 16 blend modes to
  canvas globalCompositeOperation.
- `src/compositor/CanvasPreview.tsx` — draws the frame to a `<canvas>` at timeline resolution: black bg,
  each layer with transform (translate/rotate/scale-flip about centre), crop inset, globalAlpha =
  opacity, globalCompositeOperation = blend; **real text rendering** (font/size/color/alignment/shadow,
  multi-line) and colour-tile placeholders for media (decoded pixels arrive with the FFmpeg/WebCodecs
  frame source in the render gate). `src/model/clipSampling.ts` gained `opacityAt` (incl. fade).
- `Editor.tsx` — preview wired in; **playback transport** (Play/Pause + Space, requestAnimationFrame
  loop advancing currentFrame at fps, stops at totalFrames).

### Gate result — verified 2 ways
1. **Unit tests:** `frameState.test.ts` (7) — bottom→top stacking, audio/gap exclusion, hidden-track
   skip, identity transform → (0,0,1,1), fade opacity at a frame, keyframed top-left position sample,
   blend-mode → composite-op mapping. **104/104 total pass**, `tsc` clean, `npm run build` OK.
2. **Live pixel verification (Playwright on the running app, frame 66):** canvas backing **1920×1080**;
   hero video fills frame at **exactly #3b6fe0**; logo renders as a bounded bottom-right PIP inset
   (fill **exactly #8a5cf6**; outside the box is hero-blue → transform bounding confirmed); title
   "Palmier Pro" rasterized (19,859 white glyph px) on the top track. Correct compositing + stacking.

Dev aid: `globalThis.store` exposed under `import.meta.env.DEV` for e2e/debugging (dev-only).

> ✅ Timeline + frame-accurate preview verified. Next: inspector (clip properties/keyframes) + media panel.

---

## Entry — 2026-07-03 · Stage E gate 3: inspector + media panel (BUILT & VERIFIED)

- `src/ui/Inspector.tsx` — edits the selected clip: Speed, Volume, Opacity, BlendMode, Transform
  (centerX/Y/width/height/rotation), and a Keyframes section with ◆ stamp / ✕ clear per animatable
  property at the playhead. Wired to store → engine (`set_clip_properties`/`set_keyframes` parity).
- `src/ui/MediaPanel.tsx` — lists the media library (name/type/duration); click adds the asset as a
  clip at the playhead on a compatible track.
- `Editor.tsx` — 3-pane NLE layout (media | preview | inspector) over the full-width timeline.
- `store.ts` — `editSelected` (per-clip fields + speed), `stampKeyframe`/`clearKeyframes` (current
  sampled value, clip-relative), `addMediaToTimeline`.

### Gate result
`store.test.ts` (6) — editSelected opacity/speed/transform, stampKeyframe writes clip-relative current
value, clearKeyframes removes track, addMediaToTimeline places at playhead. **110/110 tests**, `tsc`
clean. **Live (Playwright):** 3-pane layout renders (5 media rows, full inspector on the Hero clip);
inspector opacity→0.3 edit reflected in the preview as **exactly 0.3×hero (rgb 18,34,68)**.

> ✅ Inspector + media panel verified. Next: color grade + effects (apply_color/apply_effect) in preview.

---

## Entry — 2026-07-03 · Stage F: color/effects + FFmpeg render — PHASE-1 PARITY COMPLETE

### Color grade + effects (apply_color / apply_effect)
- `src/model/effectStack.ts` — pure `applyColorGrade` (scalar knobs + wheels + curves + lut → color.*
  effects, canonical order, merge/reset) and `applyEffectStack` (merge/remove non-color effects).
- `src/compositor/effectFilter.ts` — effect stack → canvas `filter` (exposure/contrast/saturation/
  vibrance/temperature/blur). `src/compositor/draw.ts` — shared `drawFrame` (preview == render) applies
  the filter per layer. Executor `apply_color`/`apply_effect` now edit the stack; inspector has a Color
  section (exposure/contrast/saturation/temp). Full CI-kernel parity → UPGRADES.
- Verified: `effectStack.test.ts` (8) + `effectFilter.test.ts` (6); live pixel — exposure +1 → exactly
  2× hero (rgb 118,222,255).

### Video render (FFmpeg) — the finish line
- `src/render/renderVideo.ts` — rasterizes each composited frame with `@napi-rs/canvas` (the SAME
  `drawFrame` as the preview) → pipes PNG frames to FFmpeg → H.264/H.265 (mp4) or ProRes (mov);
  `renderSize` ports ExportResolution. `src/render/renderCli.ts` — stdin {timeline,media} → file.
- Wired: executor `export_project` mode:video → renderVideo (dynamic import, server-only). UI
  `⭳ Export MP4` button → `exportVideo.ts` → Tauri `export_video` command (`src-tauri/src/lib.rs`,
  spawns `node --import tsx renderCli.ts`). Video renders **inline** (port deviation from the macOS
  background render — file ready on return).
- Verified: `render.test.ts` — renderVideo → **real h264 640×360 mp4** (ffprobe); renderCli standalone
  → h264 640×360, 0.667s; **MCP e2e** (agent driving): import_media → add_clips (auto linked-audio) →
  add_texts → ripple_delete_ranges → get_timeline (canGenerate:false) → **export_project video → real
  h264 1280×720 1.667s MP4** (ffprobe), generate_video → signed-out stub.

### Final pass
`cd palmier-win && npm test` → **126/126**; `npx tsc --noEmit` clean; `npm run build` OK (napi-canvas
stays out of the browser bundle). Live UI (timeline/preview/inspector/color) + MCP (41 tools, edit +
MP4 export) both green. `UPGRADES.md` written (decoded media, exact CI color, transcription, packaging,
etc.). 

> ✅✅ **PHASE-1 PARITY COMPLETE.** Only remaining hard gate: parity sign-off vs a real macOS `.palmier`
> (golden fixture is source-derived; promote a genuine one when available).

---

## Entry — 2026-07-03 · Real decoded media pixels (preview + render) — the usable-editor gate

Replaced the labelled-tile placeholders with **real decoded pixels** for video/image in BOTH the live
preview and the FFmpeg render — so dropping in a real clip shows and exports actual footage.
- `src/compositor/frameSource.ts` — `FrameSource.imageFor(clip, frame)` interface + source-frame math.
- `src/compositor/draw.ts` — `drawLayer` draws the decoded image with **crop as a source sub-rect**
  into the (crop-inset) transform box; tile fallback only when a frame isn't decoded yet.
- `src/render/nodeFrameSource.ts` — render path: images via `@napi-rs/canvas` `loadImage`; video via
  FFmpeg frame extraction (accurate seek from the clip's trim in) + on-demand load (memory ~a few
  frames). Wired into `renderVideo` (+ `renderCli` + executor pass `mediaPath`).
- `src/compositor/browserFrameSource.ts` — preview path: images via `createImageBitmap`, video via a
  `<video>` element seeked to the clip's source time; `resolveMediaSrc` (Tauri `convertFileSrc` / served
  URL). Wired into `CanvasPreview` (re-renders as frames decode). Demo hero/logo now point at real
  served media in `public/` (magenta mp4, orange png).

### Gate result — verified with REAL media, both paths
- **Export (direct):** `realpixels.test.ts` — a red→green source video + cyan image → the output MP4
  shows **RED at frame 5, GREEN at frame 45 (frame-accurate), CYAN at the image PIP** (ffmpeg-extract +
  getImageData). **127/127 tests**, `tsc` clean, build OK.
- **Export (agent over MCP):** clean server → `import_media` a real red→green mp4 → `add_clips` →
  `export_project` video → output shows **RED @0.20s, GREEN @1.50s** (real footage, frame-accurate).
  (First attempt hit a *stale server still bound to 19789* running old code — killed the PID by port,
  re-ran clean; lesson: kill 19789 owners before restarting the MCP server.)
- **Preview (live, Playwright):** hero video = **rgb(255,0,254)** (real magenta mp4 via `<video>` seek),
  logo image = **rgb(254,135,0)** (real orange png via `createImageBitmap`) — not the tile blue/purple.

Remaining (UPGRADES): smooth per-frame video decode at play speed (WebCodecs), streaming render decode,
audio in preview/export.

> ✅✅✅ **Genuinely usable editor:** import a real mp4/png → see true pixels in the preview → export an
> MP4 containing the real footage. Phase-1 truly done (pending only parity sign-off vs a real `.palmier`).

---

## Entry — 2026-07-03 · Fixes from real-run feedback (tiles / garbled text / export path)

Prabinder ran the app and hit 3 real issues. Fixed + verified:
1. **Preview showed tiles, not footage (in the Tauri app).** Root cause: `resolveMediaSrc` ran served/
   root-relative paths (`/sample.mp4`) through `convertFileSrc`, mangling them into unloadable asset
   URLs → tile fallback. Fixed: root-relative + `http(s)` used as-is; only real disk paths go through
   `convertFileSrc`. Shipped **real bundled media** in `public/` (animated-gradient `sample-video.mp4`
   + brand `sample-image.png`); the demo now references them and shows real footage on fresh open.
   Verified (Playwright, fresh load): hero = gradient that **changes between frames** (rgb 153,163,157
   → 204,134,131 — animated real video, not tile blue), logo image = rgb 16,71,47.
2. **Garbled text (two labels colliding).** The video wasn't decoding (issue 1) so a tile with a
   *centred* white label ("Sample Clip.mp4") overlapped the centred title. Fixed both ways: real video
   now decodes (no tile), and the fallback tile label moved to a **small top-left chip** (never
   centred). Verified: title "Palmier Pro" clean (10,883 white glyph px), **0** stray label px at the
   old collision spot.
3. **Export from the demo.** Added `src/render/mediaPath.ts` (`resolveRenderMediaPath`): bundled `/x`
   → real disk file in `public/x`, project media → `<projectDir>/…`, disk paths as-is, remote → null.
   Wired into the executor + `renderCli` (which now returns an **absolute** output path). Verified: the
   demo rendered via the exact CLI the Export button invokes → **1280×720 H.264, 6s, real footage**
   (hero gradient changing 159,158,151 → 210,128,126; logo brand-green 15,69,44). Lands at
   `palmier-win/palmier-export.mp4` (absolute path shown in the toolbar).

Also rewrote **UPGRADES.md** into an honest, severity-ranked "gap to real Palmier" (🔴 smooth playback,
🔴 audio, 🟠 own-media import, 🟠 exact colour/effects, 🟠 transitions, 🟠 timeline power tools, …).

`npm test` 127/127; `tsc` clean; `npm run build` OK.

> ✅ Three real-run issues fixed + pixel-verified. Honest gap list in UPGRADES.md. Not "done"-done —
> smooth playback + audio are the next things that make it feel like a real editor.

---

## Entry — 2026-07-03 · THE REAL USER LOOP + Maestro rename + GitHub push

### Architecture change: shared project state (the fix for "app and Claude edit different projects")
The MCP server is now the **project backend**. New pieces (all `palmier-win/`):
- `src/mcp/probe.ts` — ffprobe metadata on import (mirrors `MediaAsset.loadMetadata` in
  `Models/MediaAsset.swift`: duration/dimensions/fps/hasAudio).
- `src/mcp/executor.ts` — `stateVersion`, `getState()/setState()`, `importFromPath()` (real metadata);
  `import_media` path-mode now probes.
- `src/mcp/server.ts` — bridge endpoints (NOT part of the frozen MCP contract): `GET/POST /state`,
  `POST /upload` (file bytes → disk → probe → register), `GET /media/:id` (streams bytes with Range +
  CORS — the preview's media source; replaces the broken convertFileSrc approach).
- `src/state/bridge.ts` + `store.ts` — live sync: local edits push (300ms debounce), Claude's edits
  arrive via 1s poll; `mediaSrcFor` (objectURL → served path → bridge stream); connection dot in UI.
- `src/ui/MediaPanel.tsx` — **＋ Import** (Tauri file dialog / browser input); `Editor.tsx` — window
  drag-drop (browser Files + Tauri native paths via `onDragDropEvent`).
- `src-tauri/` — `tauri-plugin-dialog`, `capabilities/default.json` (core/dialog/fs), auto-spawn of
  the project server on app start. **`cargo check` passed.**
- Store zone routing: video prefers a `video` track (matches `EditorViewModel+Linking` zones).

### THE LOOP — verified in the RUNNING app (not the harness), every step pixel-checked
1. **Import own file via the real UI:** clicked ＋ Import → real file chooser → `my-vacation.mp4`
   (external red→green test file) → uploaded, probed (**4s, 480×270, 30fps**), in the media panel.
2. **True pixels in preview:** clicked the asset → placed on a video track → preview showed
   **rgb(254,0,0)** (red half) and **rgb(0,255,1)** (green half), frame-accurate.
3. **Claude edits the SAME project over MCP:** `ripple_delete_ranges` cut the red half → the app
   picked it up automatically (clip → trim 60/dur 60; preview at clip start turned GREEN).
4. **Export contains the user's footage:** MCP `export_project` → H.264 1280×720 8s; at the user
   clip's position the output reads **rgb(0,252,0)**.
`npm test` 127/127 · `tsc` clean · cargo check clean.

### Maestro rename + GitHub
Product renamed **Maestro** (UI title, window title, productName, identifier `io.maestro.editor`,
package name). **MCP identity `palmier-pro` + `.palmier` format intentionally kept** (frozen contract
compat; documented in README). New README (Maestro branding, Palmier GPLv3 credit, quickstart, MCP
guide, honest gaps). Repo initialized from `palmier-win/` (docs/SPEC.md + docs/PROGRESS.md snapshots
included) and **pushed: https://github.com/prabindersinghh/Maestro-pro (main, 154 files)**.

### Protocol going forward (user directive)
Port faithfully from the Palmier source (file-cited), verify LIVE in the app with the user's own file,
then STOP for the user's live confirmation before the next piece. Order: ① real media import (DONE —
awaiting user confirmation) → ② audio (`Audio/`, waveforms/preview/export-mix) → ③ smooth playback
(port Palmier's preview approach; WebCodecs for AVFoundation) → ④ full MCP loop on user media (DONE
as part of ①) → ⑤ exact color/effects (`Compositing/` kernels), transitions, timeline power tools.

---

## Entry — 2026-07-04 · ② AUDIO (waveforms + preview sound + audio in export)

Ported from `Audio/WaveformExtractor.swift`, `Audio/AudioEnvelope.swift`, and
`Preview/CompositionBuilder.swift` (audio-mix section) + `EditorViewModel.placeClip`.
- `src/audio/waveform.ts` — peak envelope via ffmpeg f32 PCM, same contract (200 s/s, −50 dB floor,
  0=loud/1=silence, 240k cap).
- `src/render/audioMix.ts` — export mix as an ffmpeg filter graph: per audio clip
  `atrim → atempo(speed) → volume → afade in/out → adelay`, then `amix=normalize=0`. Wired into
  `renderVideo` single-pass (video from stdin = input 0, audio files = inputs 1..N; aac for mp4, pcm
  for mov; `-t` bounds to video). Offline/missing inputs dropped via existsSync.
- `src/audio/previewAudio.ts` — Web Audio equivalent of the AVMutableAudioMix: decode per asset,
  schedule BufferSource+Gain per clip with trim offset, playbackRate=speed, static volume + linear
  head/tail fade ramps, aligned to the playhead. Hooked into the Editor play/pause effect.
- `placeClip` linked-audio ported into `store.addMediaToTimeline`: a **video with audio** on a video
  track now creates a `linkGroupId` video clip + a linked **audio clip** on a resolved/created audio
  track — so the user's imported video's sound reaches the audio-only mix (both preview & export).
  `resolveOrCreateAudioTrack` ported.
- Server bridge: `GET /waveform/:id` (executor caches peak envelopes; no-cache on unresolved asset so
  it retries after the UI seeds state). Timeline draws `WaveformStrip` on audio clips; clip labels now
  show the asset name.
- Demo ships a real audio bed (`public/sample-audio.m4a`); demo title text → "Maestro".

### Gate — verified against the ACTUAL running app (Playwright, real files, screenshot in repo)
- **Waveform visible:** `docs/screenshots/02-audio-waveform.png` shows the peaks drawn on the A1 clip;
  programmatic check = 1500×57 canvas, ~49k opaque px; server `/waveform/a-music` = 2401 peaks.
- **Preview audio graph runs:** real Play click → `activeSources:1`, AudioContext `running`, clock
  advancing in real time. (Audibility is checkpoint (a) — user listens.)
- **Export audio:** linked-audio project → output has an **aac** stream at **−21 dB mean / −17.7 dB
  max** (not the ~−91 dB of silence), via `volumedetect`.
- `npm test` **136/136** (+9 audioMix), `tsc` clean, build OK.

> ⏸️ **CHECKPOINT (a): user listens.** Per protocol, stopping here for Prabinder to confirm preview
> sound + exported-file sound by ear before ③ smooth playback.

---

## Entry — 2026-07-05 · ④ UI polish to Palmier level + ⑤ color verified + ⑥ trim handles

User confirmed audio (GO) but flagged the UI as not Palmier-level (with a real Palmier screenshot) and
⑤/⑥ as weak. Ported Palmier's actual design + added the missing power tool:
- **theme.ts** — Palmier `UI/AppTheme.swift` tokens verbatim (bg #0a0a0a/#161616/#1e1e1e/#2c2c2c, border
  white .16/.12, text white 1/.8/.62/.34, track colors video #0091C2 / audio #58A822 / image·text
  #B72DD2, Radius/Spacing/FontSize scales, accent timecode rgb .95/.6/.2).
- **Editor** — clean title bar (name + connection dot + accent Export); preview **transport bar**
  (orange timecode, ⏮◀▶▶⏭, 16:9/fps/res badges, total TC); timeline **toolbar** (undo/redo, split,
  delete, zoom slider).
- **Inspector** — ported `InspectorView` structure: sections LEVELS (Volume in **dB** via VolumeScale,
  Fade In/Out in **s**), PLAYBACK (Speed ×), COMPOSITING (Opacity %, Blend), TRANSFORM, COLOR,
  KEYFRAMES — `[icon] Label … value` rows. Added fade editing to `editSelected`.
- **MediaPanel** — 16:9 thumbnail **grid** with real video/image previews.
- **Timeline** — clips render a **color rail + real media thumbnail/filmstrip**; track headers get
  mute/hide toggles (`store.toggleTrackFlag`); labels show asset names.
- **⑥ Trim handles** — `store.trimClip` → engine `commitTrim` (already ported from
  `EditorViewModel`); draggable left/right edge handles on clips (appear on hover/selection),
  linked-partner propagation, one undo step.

### Gate — verified in the running app (Playwright + screenshots in docs/screenshots/)
- `04-ui-overhaul.png`, `05-inspector.png`, `06-trim-and-inspector.png` — the app now visually matches
  Palmier's layout (media grid, transport, sectioned inspector, thumbnailed clips + waveform).
- **Trim** live: hero clip right edge 90f → 60f (one undo step), restored via undo.
- **Color renders** live: exposure +2 on the hero brightened the sampled preview pixel
  rgb(87,200,192) → rgb(255,255,255) — ⑤ was already compositing through the same `drawFrame`
  pipeline used by the export.
- `npm test` 136/136, `tsc` clean, build OK.

Remaining before ⑥ is "great": keyframe lanes in the timeline, razor-tool cursor (Split works via
button/S), transitions, live trim preview while dragging. ③ smooth playback (WebCodecs) still pending.

> ⏸️ **CHECKPOINT (b): user judges UI/UX.** Stopping for Prabinder to look at the polished app and say
> whether it now reads as Palmier-level before ③ smooth playback + deeper ⑤/⑥.

---

## Entry — 2026-07-05 · Smooth playback + MCP tools (apply_layout, Skills) + STRATEGY + video-use setup

- **③ Smooth playback** (Preview/VideoEngine analog): real-time `<video>` playback + a dedicated
  60fps canvas draw loop in CanvasPreview; playhead emit throttled to ~20/s. tsc/build/136 tests green.
  **Live visual smoothness NOT yet verified** — Playwright MCP was disconnected this session. Code is
  committed; needs an eyeball (the running app reflects it via HMR).
- **apply_layout WIRED** (was stubbed): ported VideoLayout slots + cover-crop solver
  (`src/model/layout.ts`). **Verified live over MCP**: side_by_side → correct transforms/crops.
- **Skills system** (Agent/Skills port): `src/mcp/skills.ts` fetches the real palmier-io/palmier-skills
  catalog + bodies; `read_skill` + `list_skills` exposed over MCP (43 advertised = frozen 41 + 2
  extensions); skills catalog injected into initialize instructions. **Verified live**:
  `read_skill('color-grading')` → real 8,474-char body; `list_skills` → 4 skills.
- **MCP tools audit** written: `docs/MCP-TOOLS.md` (27 fully wired · partials · stubs · signed-out),
  each claim backed by a live tool result. Also live-verified this session: set_keyframes, update_text,
  add_texts.
- **docs/STRATEGY.md** written: the open-tooling plan (transcript editing → motion graphics → free
  generation), integration seam = `import_media`, build order ①–⑤, license ledger.
- **STRATEGY ① video-use** (MIT, transcript editing) INSTALLED: cloned to `~/Developer/video-use`,
  `uv sync` done, symlinked into `~/.claude/skills/video-use`, helpers verified
  (`transcribe.py --help` OK, ffprobe OK). **BLOCKED on the user's ElevenLabs API key** (write to
  `~/Developer/video-use/.env`) before the live end-to-end test. Seam: video-use → `final.mp4` →
  Maestro `import_media`.

Prereqs confirmed on this machine: Python 3.11, uv 0.10, ffmpeg 8.0, node 22, git.

> ⏸️ Awaiting: (a) ElevenLabs key to finish ① live; (b) an eyeball on smooth playback (Playwright was
> down). Everything else this session is verified live over MCP.

---

## Entry — 2026-07-06 · The 4 unfinished UI pieces (Settings, Typography, Generation, Keyframe lanes)

Smooth playback confirmed by the user. Built the 4 non-key-dependent UI pieces in the user's ranked
order, each verified LIVE in the running app (Playwright + screenshots in docs/screenshots/):
1. **Settings + Connect-AI** (`src/ui/Settings.tsx`) — modal with Connect AI (server status, MCP URL,
   one-click copy of `claude mcp add …`, 3-step guide), Project (fps/resolution), Export (codec/res)
   tabs; gear + Connect-AI buttons in the title bar. `07-settings-connect.png`.
2. **Typography** (`src/ui/Inspector.tsx` TextSection; `store.editText`; `draw.ts` bg+outline) —
   content, font, size, bold/italic, alignment, color, background, outline, shadow, animation preset +
   per-word frames. Compositor now renders text background box + outline. Verified: "MAESTRO" with
   green bg + black outline renders. `08-typography.png`.
3. **Generation panel** (`src/ui/GenerationPanel.tsx`) — Palmier's generate surface (Video/Image/Audio,
   LTX-2 model picker, prompt, aspect/duration, Generate) with an honest "backend not connected — see
   STRATEGY ③" banner; never fakes a result. `09-generation.png`.
4. **Keyframe lanes** (`src/ui/timeline/KeyframeLanes.tsx`; store `keyframesOf`/`moveKeyframe`/
   `deleteKeyframe`; `stampKeyframe(prop, atFrame)`) — per-property lanes (Opacity/Position/Scale/
   Rotation/Crop, or Volume) under the tracks with diamond keyframes at their timeline positions;
   click-empty adds, drag moves, click deletes. Timeline made vertically scrollable with the header
   column synced. Verified live: 3 diamonds rendered; add→[8,55], move 8→17, delete verified.
   `10-keyframe-lanes.png`.

136 tests green, tsc clean, build OK. All committed + pushed.

> ⏸️ **STOP for the ElevenLabs key.** Per the agreed dependency, captions (#5) needs word-level
> transcription = the key + video-use ①. Next phase = video-use ① + captions #5 together, once the
> user pastes the key (write to `~/Developer/video-use/.env`).

---

## Entry — 2026-07-06 · STRATEGY ① video-use + captions #5 — the transcript-editing loop, live

User provided the ElevenLabs key. Ran the whole loop end-to-end on a real speech clip and it works:
- **Key**: written to `~/Developer/video-use/.env` (chmod 600, never echoed/committed); auth check → 200.
- **Test clip**: generated a 20s talking-head with real speech + filler words ("So, um … uh …") via
  Windows SAPI TTS muxed onto a color bg (`~/Developer/video-use-test/my-talkinghead.mp4`).
- **Transcribe**: `transcribe.py` → ElevenLabs Scribe → **65 words** with timings; fillers located
  ("um" 0.96–1.14s, "uh" 4.94–5.00s, "um" 10.88–11.04s, "uh" 11.26–11.42s).
- **Filler removal**: built an EDL keeping everything except the filler intervals → `render.py`
  → `final.mp4` **19.93s → 19.56s**, loudness-normalized to −14 LUFS.
- **Import + captions in Maestro** (`scratchpad/captions-loop.mjs`): `import_media(final.mp4)` →
  `add_clips` → **11 caption chunks** derived from the transcript (fillers dropped, timings remapped
  past the cuts) added via `add_texts`. Verified live: preview shows **"welcome to Maestro." (white)
  overlaid on the video**; timeline = caption track (T1) over cleaned video (V1) over audio (A1).
  `docs/screenshots/11-videouse-captions.png`.

**Maestro fixes this surfaced (committed):** `add_texts` now (a) routes text to a **dedicated text
track** (`ensureTextTrack`) instead of overwriting the video track, and (b) sets a **default textStyle
+ lower-third transform** so captions actually render (drawText needs both). These make captions a real
feature, not just clips.

**Honest notes on video-use (MIT):** two Windows path bugs in the repo — `grade.py` auto-grade and the
subtitle-burn both pass `C:\…` paths into ffmpeg filter strings, whose `:`/`\` break the filter parser.
Worked around by `grade:null` + `--no-subtitles` and doing **captions in Maestro** instead (better
anyway — editable text clips vs burned-in). Fixing video-use's Windows paths is a small upstream patch
(worth a PR). Cost: one short Scribe call (~20s clip).

136 tests green, tsc clean.

> ✅ The #1 edge over Palmier — transcript-based smart editing — is live end-to-end: talking-head →
> Scribe → filler cut → cleaned clip + captions on Maestro's timeline, all Claude-drivable over MCP.

---

## Entry — 2026-07-06 · STRATEGY ② motion graphics — animated titles (piece 1), live

The other big thing Palmier lacks. Engine decision (flagged to user): built on **@napi-rs/canvas +
FFmpeg** (the render stack we already have) instead of a heavy Remotion project — zero-install,
deterministic, fast, fully local (no GPU, no key). Remotion can be added later as a 2nd engine for
complex React compositions.
- `src/motion/renderTitle.ts` — draws each frame with canvas (presets: fadeSlideUp, scaleIn,
  typewriter, wordReveal, lowerThird; easing; in/hold/out timing; gradient/spotlight/solid bg,
  accent, subtitle) → pipes to FFmpeg → H.264 MP4.
- `generate_title` MCP tool (Maestro extension, **44 tools** now = 41 + read_skill/list_skills +
  generate_title). Claude maps a prompt → params, it renders locally, imports via the media library,
  and (by default) places at the playhead. `place=false` to only import.

### Gate — verified over MCP + the rendered frame
- `generate_title("TRIP 2026", subtitle "summer cut", scaleIn, spotlight)` → **90 frames 1920×1080
  H.264**, imported as "Title: TRIP 2026", `get_timeline` shows it **placed on the timeline** (1 clip,
  asset matched). Rendered frame (mid): bold white title + subtitle on a green spotlight gradient —
  `docs/screenshots/12-motion-title.png`; mid-frame has 21,543 white text px.
- 136 tests green, tsc clean.
- **In-app screenshot (title clip on Maestro's timeline + preview) pending** — the Playwright MCP
  server was disconnected this turn; the render + placement are verified over MCP and the frame above.

Next motion pieces (one at a time): transitions (crossfade/wipe between clips), intro/outro templates,
transparent lower-thirds (WebM alpha). STRATEGY ③ (LTX-2 generation) still deferred — will check the
user's GPU + local-vs-hosted cost first.

---

## Entry — 2026-07-08 · STRATEGY ② motion graphics — Remotion engine added (React), auto-picked

Per user: full capacity, not just the safe engine. Added **Remotion** (the real React render engine
from remotion-dev/skills) alongside the canvas engine; Claude auto-picks by request.
- **Isolated workspace** `palmier-win/remotion/` (own package.json/node_modules — gitignored): Root +
  4 parameterized compositions using the Remotion skill's frame-driven APIs (useCurrentFrame,
  interpolate, spring, Sequence, AbsoluteFill, calculateMetadata for prop-driven duration):
  **AnimatedIntro** (spring scale-in + glow + wipe underline + staggered subtitle), **LogoReveal**
  (ring-draw + wordmark spring + shine sweep), **DataViz** (animated bar chart from `bars`, values
  count up), **Transition** (accent wipe stinger). `render.mjs` = bundle(cached) → selectComposition →
  renderMedia; `ensureBrowser()` fetches Chrome Headless Shell.
- `src/motion/renderRemotion.ts` bridges the executor → render.mjs (child process).
- **`generate_motion`** MCP tool (Remotion) added next to **`generate_title`** (canvas). **45 tools**
  now (41 + read_skill/list_skills + generate_title + generate_motion). Tool descriptions do the
  **auto-pick**: simple text → generate_title; springs/logo/charts/transitions/"motion design" →
  generate_motion.

### Windows / Chromium
`ensureBrowser()` auto-downloaded **Chrome Headless Shell (102 MB, one-time, cached)** — no user
action needed. First render also bundles (webpack) once → cached in `remotion/.bundle-cache`;
subsequent renders ~10-12s. `chromiumOptions.gl:"angle"` for no-GPU robustness. **Setup for a fresh
clone: `cd remotion && npm install` once** (node_modules is gitignored).

### Gate — verified live
- `generate_motion(AnimatedIntro, "MAESTRO")` over MCP → **11.7s** → 120 frames 1920×1080, engine
  "remotion", **placed on the timeline**. In-app: preview shows the intro (48,402 white title px +
  3,697 green accent px). `docs/screenshots/13-remotion-intro.png`.
- All 4 templates render OK (h264 1920×1080): AnimatedIntro (in-app), LogoReveal, DataViz, Transition.
  DataViz frame: `docs/screenshots/14-remotion-dataviz.png` (animated Growth bar chart).
- 136 tests green, tsc clean.

> ✅ Two motion engines, auto-picked: canvas (instant simple titles) + Remotion (complex motion
> design). "A complex animated intro" → Remotion renders it → it lands on Maestro's timeline.

---

<!-- Append the next session's entry below this line. Keep newest at the bottom or top consistently. -->
