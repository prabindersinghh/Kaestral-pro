# Graph Report - palmier-win  (2026-07-15)

## Corpus Check
- 265 files · ~542,191 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2414 nodes · 5232 edges · 178 communities (157 shown, 21 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 46 edges (avg confidence: 0.68)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `61a82472`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- codec.ts
- sceneSpec.ts
- defaults.ts
- Clip
- McpExecutor
- README.md
- beats.ts
- editEngine.ts
- EditEngine
- Builder
- manifest.json
- executor.ts
- Editor.tsx
- Builder
- draw.ts
- tokenColor
- tauri.conf.json
- EditorStore
- Generative.tsx
- Kaestral — Port Specification (Phase 1)
- index.ts
- fail
- toolDefs.ts
- compilerOptions
- server.ts
- renderVideo.ts
- Root.tsx
- Timeline.tsx
- modifiers.ts
- .emit
- Timeline
- ltx_server.py
- dependencies
- devDependencies
- endFrame
- xml.ts
- ProjectBridge
- Inspector.tsx
- ChatPanel.tsx
- theme.ts
- golden-project.json — `Timeline` (`Models/Timeline.swift`)
- Art Direction for Motion
- clipSampling.ts
- fcpxml.ts
- TimelineGeometry
- lib.rs
- Kaestral Generative Motion Engine — Implementation Plan
- package.json
- gcp.ts
- hosted.ts
- store.ts
- KaestralLaunch.tsx
- env.ts
- Kaestral — Windows Port — PROGRESS LOG (historical)
- Kaestral Generative Motion Engine — Design Spec
- Kaestral Pro Tier Expansion — Design Spec
- .exportProject
- effectStack.ts
- definitions
- definitions
- Settings.tsx
- permissions
- transitions.test.ts
- README.hi.md
- Art-Directed Authoring Surface — Implementation Plan
- getTimelineOutput.ts
- properties
- properties
- Kaestral Art-Directed Authoring Surface for LLMs — Design Spec
- package.json
- files
- scripts
- SplitLayout.tsx
- compilerOptions
- Viral-style reel
- validateSceneSpec
- err
- frames.ts
- Kaestral MCP tools
- Build order
- Kaestral — FAQ
- FilmLaunch.tsx
- FilmSaaS.tsx
- Styles (pick to match the vibe)
- skills.ts
- Kaestral — Architecture
- Kaestral 1.0.0 — Launch Runbook
- Root-cause diff (hero-demo vs generated), by mechanism
- Global Constraints
- keywords
- FilmData.tsx
- Mask.tsx
- webviews
- webviews
- Contributing to Kaestral
- Run LTX-2 on your own Google Cloud GPU (with your $300 credits)
- render.mjs
- Text.tsx
- prepare-resources.mjs
- Platform delivery
- CapabilityRemote
- CapabilityRemote
- Kaestral — MCP registry submission prep
- Auto-updater setup (Tauri 2)
- B-roll planner
- Kaestral — Development History (consolidated)
- Publishing Kaestral
- Kaestral `.mcpb` bundle (one-click Claude Desktop install)
- Beat-synced cutting
- Creative director
- .importFromPath
- waveform.tsx
- permissions
- permissions
- kaestral.mjs
- Entry — 2026-07-01 · Golden-file run-down + Stage A (scaffold + data-model port)
- Entry — 2026-07-01 · Step 1: Spec extraction (COMPLETE)
- Tool-Surface Audit — Kaestral MCP (50 tools)
- NOTICE / CREDITS
- Connect an AI
- CondenseReel.tsx
- Transitions.tsx
- HeroDemo.tsx
- Timeline.tsx
- Promo / ad video
- AnimatableProperty
- Capability
- Capability
- Kaestral — launch posts (drafts)
- Entry — 2026-07-03 · THE REAL USER LOOP + Kaestral rename + GitHub push
- Quality Gate — Binding Critique (Task 5 review, user verdict: NOT shippable)
- Kaestral — Future Ideas (post-1.0)
- resolveLayoutPosition
- Particles.tsx
- TextOnPath.tsx
- Build inside Kaestral
- stdio.ts
- desktop-schema.json
- windows-schema.json
- UPGRADES — the honest gap to a real editor
- Entry — 2026-07-03 · Stage F: color/effects + FFmpeg render — PHASE-1 PARITY COMPLETE
- Entry — 2026-07-01 · Stage B: headless edit engine (BUILT & VERIFIED)
- Entry — 2026-07-01 · Stage C: MCP server + 41 tools (BUILT & VERIFIED)
- Forensic diff vs hero-demo — the last 60→85→100 craft closure (ranked)
- vercel.json
- What it does
- resolveEntranceTiming
- AreaChart.tsx
- make-latest-json.mjs
- .entry
- stdio.test.ts
- local
- local
- Entry — 2026-07-08 · STRATEGY ② motion graphics — Remotion engine added (React), auto-picked
- Standing requirements (not one-time tasks)
- index.js
- resourcesRemotion.test.ts
- identifier
- identifier
- idle-stop.sh
- setup.sh
- Entry — 2026-07-03 · Real decoded media pixels (preview + render) — the usable-editor gate
- Entry — 2026-07-03 · Stage E gate 1: Timeline UI (BUILT & VERIFIED)
- Entry — 2026-07-03 · Stage E gate 2: frame-accurate preview / compositor (BUILT & VERIFIED)
- Entry — 2026-07-06 · STRATEGY ② motion graphics — animated titles (piece 1), live
- Entry — 2026-07-08 · Connect-AI: two paths (in-app chat / Claude Code) + auto-import fix
- checkColor
- ValidationError
- artDirectionSkill.test.ts

## God Nodes (most connected - your core abstractions)
1. `Clip` - 82 edges
2. `McpExecutor` - 78 edges
3. `EditorStore` - 71 edges
4. `EditEngine` - 54 edges
5. `endFrame()` - 46 edges
6. `Timeline` - 41 edges
7. `tokenColor()` - 40 edges
8. `Builder` - 39 edges
9. `defaultClip()` - 39 edges
10. `defaultTrack()` - 31 edges

## Surprising Connections (you probably didn't know these)
- `ProjectTab()` --references--> `res`  [EXTRACTED]
  src/ui/Settings.tsx → scripts/prepare-resources.mjs
- `decodePcm()` --indirect_call--> `n()`  [INFERRED]
  src/audio/beats.ts → src/export/fcpxml.ts
- `composeFrame()` --indirect_call--> `clip()`  [INFERRED]
  src/compositor/frameState.ts → src/state/demoProject.ts
- `clip()` --calls--> `defaultClip()`  [EXTRACTED]
  src/engine/__tests__/ripple.test.ts → src/model/defaults.ts
- `computeOverwrite()` --indirect_call--> `clip()`  [INFERRED]
  src/engine/overwrite.ts → src/state/demoProject.ts

## Import Cycles
- None detected.

## Communities (178 total, 21 thin omitted)

### Community 0 - "codec.ts"
Cohesion: 0.06
Nodes (81): main(), asBool(), asEnum(), asEnumOpt(), asNum(), asStr(), asStrOpt(), decCropTrack() (+73 more)

### Community 1 - "sceneSpec.ts"
Cohesion: 0.03
Nodes (62): Animate, ANIMATE_KEYS, ANIMS, ASPECTS, Background, BACKGROUND_KEYS, Beat, BEAT_KEYS (+54 more)

### Community 2 - "defaults.ts"
Cohesion: 0.10
Nodes (39): at(), clip(), tl(), tt(), vt(), clip(), linkedAV(), setup() (+31 more)

### Community 3 - "Clip"
Cohesion: 0.09
Nodes (25): BrowserFrameSource, VideoState, FrameImage, FrameSource, sourceConsumedIndex(), CompositedLayer, BlendMode, ClipType (+17 more)

### Community 4 - "McpExecutor"
Cohesion: 0.18
Nodes (8): aArr(), aInt(), aStr(), aStrArr(), McpExecutor, ok(), okJson(), requireStr()

### Community 5 - "README.md"
Cohesion: 0.08
Nodes (25): 🔗, 🔗, 🔗, 🔗, 🔗, 🔗, 🔗, 🔗 (+17 more)

### Community 6 - "beats.ts"
Cohesion: 0.08
Nodes (35): analyzeBeats(), BeatAnalysis, decodePcm(), energyEnvelope(), estimateTempo(), onsetStrength(), pickPeaks(), SilenceOptions (+27 more)

### Community 7 - "editEngine.ts"
Cohesion: 0.10
Nodes (32): ALL_TRACK_KEYS, clampFadesToDuration(), clampKeyframesToDuration(), clampTrack(), rescaleKeyframes(), rescaleTrack(), rescaleWordTimings(), setClipDuration() (+24 more)

### Community 9 - "Builder"
Cohesion: 0.14
Nodes (7): Builder, fontFaceFallback(), fontFamilyFallback(), formatNumber(), gcd(), n(), Transform

### Community 10 - "manifest.json"
Cohesion: 0.06
Nodes (35): author, name, url, compatibility, platforms, runtimes, description, display_name (+27 more)

### Community 11 - "executor.ts"
Cohesion: 0.08
Nodes (25): MoveSpec, downloadUrl(), ytdlpAvailable(), Args, parseKeyframeRow(), ToolContent, ToolContentImage, ToolContentText (+17 more)

### Community 12 - "Editor.tsx"
Cohesion: 0.10
Nodes (19): App(), previewAudio, CanvasPreview(), useEditorVersion(), CloseConfirm(), CLIENTS, ConnectHelp(), Snippet (+11 more)

### Community 13 - "Builder"
Cohesion: 0.24
Nodes (7): Builder, fmt(), boolLeaf(), el(), elAttrs(), leaf(), XmlNode

### Community 14 - "draw.ts"
Cohesion: 0.14
Nodes (27): drawFrame(), drawLayer(), DrawOpts, drawStyledLine(), drawStyledLineWord(), drawText(), rgbaCss(), setFont() (+19 more)

### Community 15 - "tokenColor"
Cohesion: 0.11
Nodes (23): BeatBackground(), Arrow(), ease, toPoint(), Bar, BarChart(), DEFAULT_BARS, Counter() (+15 more)

### Community 16 - "tauri.conf.json"
Cohesion: 0.07
Nodes (29): https://github.com/prabindersinghh/Kaestral-pro/releases/latest/download/latest.json, icons/128x128.png, icons/32x32.png, icons/icon.ico, nsis, resources/**/*, app, security (+21 more)

### Community 18 - "Generative.tsx"
Cohesion: 0.11
Nodes (26): AmbientParticles(), AnimateField, Background, Beat, BeatContent(), CameraField, DEFAULT_MASK_REVEAL, DEFAULT_POSITION (+18 more)

### Community 19 - "Kaestral — Port Specification (Phase 1)"
Cohesion: 0.07
Nodes (26): 0. Frozen rules (authoritative — accepted by lead 2026-07-01), 10. Generation stub behavior (phase-1 mandate), 11. Phase-1 deferred capabilities (register, return "unavailable"), 12. Enum quick-reference, 13. SwiftPM deps → Windows fate (from `Package.swift`), 14. Open items to verify before/while building (Stage A–B), 1.1 Golden fixture (Stage-A acceptance source), 1. The `.kaestral` project package (+18 more)

### Community 20 - "index.ts"
Cohesion: 0.16
Nodes (14): CaptionKaraoke(), Countdown(), GlowField(), Grid(), Image(), REGISTRY, LogoMark(), ScreenMock() (+6 more)

### Community 21 - "fail"
Cohesion: 0.34
Nodes (27): checkAnimateConflicts(), checkEnum(), checkUnknownKeys(), clamp(), fail(), isPlainObject(), validateAnimate(), validateBackground() (+19 more)

### Community 22 - "toolDefs.ts"
Cohesion: 0.09
Nodes (15): seed(), videoTrack(), ANALYSIS_TOOL_DEFS, ANIMATION_VALUES, JsonSchema, MOTION_TOOL_DEFS, NOTE: tool DESCRIPTIONS here are faithful source-derived summaries. The canonica, SKILL_TOOL_DEFS (+7 more)

### Community 23 - "compilerOptions"
Cohesion: 0.08
Nodes (24): DOM, DOM.Iterable, ES2022, node, vite.config.ts, compilerOptions, isolatedModules, jsx (+16 more)

### Community 24 - "server.ts"
Cohesion: 0.14
Nodes (16): CORS, header(), McpServer, MIME, readBody(), readBodyBuffer(), RESOURCES, rpcError() (+8 more)

### Community 25 - "renderVideo.ts"
Cohesion: 0.15
Nodes (21): linearFromDb(), rawVolumeAt(), totalFrames(), atempoChain(), AudioMixInput, AudioMixPlan, buildAudioMix(), timelineSeconds() (+13 more)

### Community 26 - "Root.tsx"
Cohesion: 0.11
Nodes (17): AnimatedIntro(), IntroProps, DataViz(), DataVizProps, DEFAULT_BARS, dimsForAspect(), Generative(), GenerativeProps (+9 more)

### Community 27 - "Timeline.tsx"
Cohesion: 0.14
Nodes (18): AUDIO_PROPS, KeyframeLaneContent(), KeyframeLaneLabels(), LABEL, laneProps(), VISUAL_PROPS, collectTargets(), findSnap() (+10 more)

### Community 28 - "modifiers.ts"
Cohesion: 0.13
Nodes (21): BeatLayer(), glitchExitStyle(), Camera(), CameraProps, CameraSpec, cameraTransform(), DEFAULT_CAMERA, parallaxOffset() (+13 more)

### Community 30 - "Timeline"
Cohesion: 0.15
Nodes (7): PreviewAudioEngine, UndoEntry, MediaAssetLite, MediaLibrary, MediaFolder, MediaSource, Timeline

### Community 31 - "ltx_server.py"
Cohesion: 0.16
Nodes (18): BaseModel, _auth(), _boot(), _dims(), generate(), GenReq, job(), load_pipeline() (+10 more)

### Community 32 - "dependencies"
Cohesion: 0.10
Nodes (21): @modelcontextprotocol/sdk, @napi-rs/canvas, dependencies, @modelcontextprotocol/sdk, @napi-rs/canvas, react, react-dom, remotion (+13 more)

### Community 33 - "devDependencies"
Cohesion: 0.10
Nodes (21): devDependencies, @tauri-apps/api, @tauri-apps/cli, tsx, @types/node, @types/react, @types/react-dom, typescript (+13 more)

### Community 34 - "endFrame"
Cohesion: 0.17
Nodes (15): SrcFor, allClips(), dir, reel, timelineLen(), videoClip(), containsFrame(), endFrame() (+7 more)

### Community 35 - "xml.ts"
Cohesion: 0.16
Nodes (12): ExportMediaResolver, fileURLString(), lastPathComponent(), premierePathURL(), formatTimecode(), SourceTimecode, timecodeTags, ClipAddress (+4 more)

### Community 37 - "Inspector.tsx"
Cohesion: 0.12
Nodes (12): BLEND_MODES, TEXT_ALIGNMENTS, colorParam(), ColorSwatch(), dbFromLinear(), fmtDb(), FONTS, fromHex() (+4 more)

### Community 38 - "ChatPanel.tsx"
Cohesion: 0.18
Nodes (10): AgentCallbacks, ContentBlock, KaestralAgent, Msg, Role, ToolDef, ChatPanel(), iconBtn (+2 more)

### Community 39 - "theme.ts"
Cohesion: 0.16
Nodes (13): ASPECTS, GenerationPanel(), Kind, fmtDuration(), inTauri(), MediaPanel(), MediaThumb(), bg (+5 more)

### Community 40 - "golden-project.json — `Timeline` (`Models/Timeline.swift`)"
Cohesion: 0.11
Nodes (17): BlendMode (`Models/BlendMode.swift:4`), Clip (`Timeline.swift:75`; CodingKeys `:116`) — non-optionals (id…crop) always; optionals omit-if-nil, Crop (`Timeline.swift:525`) — synthesized, all 4 always, Effect / EffectParam (`Models/Effect.swift`), Golden fixtures — field → source mapping, golden-media.json — `MediaManifest` (`Models/MediaManifest.swift`), golden-project.json — `Timeline` (`Models/Timeline.swift`), Keyframe / KeyframeTrack (`Models/Keyframe.swift`) (+9 more)

### Community 41 - "Art Direction for Motion"
Cohesion: 0.11
Nodes (17): 10. Tool-to-craft mapping — which field expresses which intent, 1.5 Conceptual ambition — reach for the brave idea, not the obvious one, 1. The decision process — how to read a brief before you touch a field, 2. Trade-offs — there are no right answers, only tensions you resolve on purpose, 3. The physics of premium — why some motion reads expensive and some reads cheap, 4. Optical composition — directing where the eye lands, 5. Rhythm — hold vs. density, tension and release, 6. Restraint — why fewer elements read as more expensive (+9 more)

### Community 42 - "clipSampling.ts"
Cohesion: 0.30
Nodes (14): composeFrame(), cropAt(), interpolationAt(), keyframeFrames(), opacityAt(), rawOpacityAt(), rotationAt(), sizeAt() (+6 more)

### Community 43 - "fcpxml.ts"
Cohesion: 0.14
Nodes (13): compact(), defaultTextStyleLite(), EmittableClip, FCPXMLVersion, MediaResource, Node, nt(), renderNode() (+5 more)

### Community 44 - "TimelineGeometry"
Cohesion: 0.14
Nodes (6): clampZoom(), Rect, TimelineGeometry, TrackDropTarget, clip(), TrackHeader()

### Community 45 - "lib.rs"
Cohesion: 0.24
Nodes (16): AppHandle, Command, Option, PathBuf, Result, apply_env(), copy_dir_if_absent(), ensure_writable_remotion() (+8 more)

### Community 46 - "Kaestral Generative Motion Engine — Implementation Plan"
Cohesion: 0.12
Nodes (16): Global Constraints, Kaestral Generative Motion Engine — Implementation Plan, Self-Review (completed), Task 10: 🚦 BLOCKING QUALITY GATE — three agent-authored films, user judges, Task 11: Windows-build blocker — ship `resources/remotion/node_modules` in the installer, Task 12: Windows-build blocker — implement `inspect_media` + `inspect_timeline`, Task 13: Rebuild app, verify engine live, final sweep, Task 1: SceneSpec types + validator (pure, no rendering) (+8 more)

### Community 47 - "package.json"
Cohesion: 0.12
Nodes (16): dependencies, react, react-dom, remotion, @remotion/bundler, @remotion/renderer, description, react (+8 more)

### Community 48 - "gcp.ts"
Cohesion: 0.26
Nodes (11): externalIp(), gbase(), GcpRunner, GpuConfig, gpuState, GpuStatus, realRunner, startVm() (+3 more)

### Community 49 - "hosted.ts"
Cohesion: 0.21
Nodes (14): DEFAULT_MODELS, falInput(), GenConfig, generate(), GenKind, GenProvider, GenResult, pickUrl() (+6 more)

### Community 50 - "store.ts"
Cohesion: 0.18
Nodes (11): encodeManifest(), ClipPatch, demo, envGen, PROP_TO_KEY, store, ViewState, ExportResult (+3 more)

### Community 51 - "KaestralLaunch.tsx"
Cohesion: 0.18
Nodes (10): AgentScene(), easeOut, EditorScene(), FeaturesScene(), Hook(), KaestralLaunchProps, LogoSting(), StatsScene() (+2 more)

### Community 52 - "env.ts"
Cohesion: 0.22
Nodes (12): JFK_JSON, ensureModel(), MODEL_URL(), parseWhisperJson(), run(), transcribe(), Transcript, TranscriptWord (+4 more)

### Community 53 - "Kaestral — Windows Port — PROGRESS LOG (historical)"
Cohesion: 0.13
Nodes (15): Entry — 2026-07-01 · Stage D (pure-TS slice): interchange exporters (BUILT & VERIFIED), Entry — 2026-07-03 · Fixes from real-run feedback (tiles / garbled text / export path), Entry — 2026-07-03 · Stage E gate 3: inspector + media panel (BUILT & VERIFIED), Entry — 2026-07-04 · ② AUDIO (waveforms + preview sound + audio in export), Entry — 2026-07-05 · ④ UI polish to upstream level + ⑤ color verified + ⑥ trim handles, Entry — 2026-07-05 · Smooth playback + MCP tools (apply_layout, Skills) + STRATEGY + video-use setup, Entry — 2026-07-06 · STRATEGY ① video-use + captions #5 — the transcript-editing loop, live, Entry — 2026-07-06 · The 4 unfinished UI pieces (Settings, Typography, Generation, Keyframe lanes) (+7 more)

### Community 54 - "Kaestral Generative Motion Engine — Design Spec"
Cohesion: 0.13
Nodes (14): Architecture (approved), Error handling, Four isolated, independently-testable units, Goal, Housekeeping / notes, Kaestral Generative Motion Engine — Design Spec, MCP tool: `compose_motion`, Non-negotiables (+6 more)

### Community 55 - "Kaestral Pro Tier Expansion — Design Spec"
Cohesion: 0.13
Nodes (14): Adversarial license audit (final gate), Build priority (locked by CTO), Cross-cutting, Existing seams this builds on (verified in code), Goal, Kaestral Pro Tier Expansion — Design Spec, Non-negotiable licensing rule (protects the paid tier), Out of scope (YAGNI) (+6 more)

### Community 56 - ".exportProject"
Cohesion: 0.20
Nodes (6): extractWaveform(), normalized(), WaveformEnvelope, SceneSpec, publicDir(), resolveRenderMediaPath()

### Community 57 - "effectStack.ts"
Cohesion: 0.26
Nodes (13): applyColorGrade(), applyEffectStack(), CANONICAL_ORDER, EffectSpec, hueVec(), insertIndex(), points(), ps() (+5 more)

### Community 58 - "definitions"
Cohesion: 0.13
Nodes (15): definitions, Identifier, Number, PermissionEntry, Target, Value, oneOf, anyOf (+7 more)

### Community 59 - "definitions"
Cohesion: 0.13
Nodes (15): definitions, Identifier, Number, PermissionEntry, Target, Value, oneOf, anyOf (+7 more)

### Community 60 - "Settings.tsx"
Cohesion: 0.16
Nodes (6): humanizeError(), AboutTab(), LaunchButton(), selectStyle, Settings(), Tab

### Community 61 - "permissions"
Cohesion: 0.14
Nodes (13): *, core:default, core:window:allow-close, core:window:allow-destroy, dialog:default, fs:default, main, updater:default (+5 more)

### Community 62 - "transitions.test.ts"
Cohesion: 0.26
Nodes (9): tl(), vid(), canCrossDissolve(), clampDur(), isHardCut(), leftHandleFrames(), planTransition(), TransitionEdit (+1 more)

### Community 63 - "README.hi.md"
Cohesion: 0.15
Nodes (12): 🎬 AI-संचालित। आप निर्देशन करें, यह एडिट करे।, Pro और Max (वेटलिस्ट), एक AI कनेक्ट करें, ⚡ कच्ची फ़ुटेज → पब्लिश-रेडी रील।, प्राइवेसी — लोकल-फ़र्स्ट, 📊 बिना एडिटर के SaaS और प्रोडक्ट वीडियो बनाइए।, यह क्या करता है, लाइसेंस (+4 more)

### Community 64 - "Art-Directed Authoring Surface — Implementation Plan"
Cohesion: 0.15
Nodes (12): Art-Directed Authoring Surface — Implementation Plan, Global Constraints, Self-Review (completed), Task 1: Easing spec — bezier-or-preset type + validator + resolver, Task 2: Enter/Exit expansion — durationFrames, spring, exit fade; wire EasingSpec into enter/exit/transition, Task 3: Explicit `hold` + `position.snap` opt-out, Task 4: Per-property `animate` block + fail-loud conflict detection, Task 5: Interpreter — apply easing/hold/animate/spring/overlap/snap in the render (+4 more)

### Community 65 - "getTimelineOutput.ts"
Cohesion: 0.29
Nodes (12): buildGetTimelineOutput(), captionGroup(), CLIP_DEFAULTS, compactClip(), compactTrack(), GetTimelineOptions, intVal(), isEqual() (+4 more)

### Community 66 - "properties"
Cohesion: 0.15
Nodes (13): properties, default, description, type, array, null, description, type (+5 more)

### Community 67 - "properties"
Cohesion: 0.15
Nodes (13): properties, default, description, type, array, null, description, type (+5 more)

### Community 68 - "Kaestral Art-Directed Authoring Surface for LLMs — Design Spec"
Cohesion: 0.17
Nodes (11): Component 1 — Expressiveness expansion (the ceiling-lift), 🚦 COMPONENT 1 GATE (non-negotiable, shown to user), Component 2 — The craft-transfer skill (`skills/art-direction/SKILL.md`), Component 3 — Tool-surface audit for LLM power, Kaestral Art-Directed Authoring Surface for LLMs — Design Spec, New/expanded fields (all bounded data — no code), Out of scope (YAGNI), Strategic thesis (locked) (+3 more)

### Community 69 - "package.json"
Cohesion: 0.17
Nodes (11): bin, kaestral, description, homepage, license, name, repository, type (+3 more)

### Community 70 - "files"
Cohesion: 0.17
Nodes (12): files, bin/, dist-server/, LICENSE, NOTICE.md, public/, README.md, remotion/package.json (+4 more)

### Community 71 - "scripts"
Cohesion: 0.17
Nodes (12): scripts, build, bundle:server, dev, mcp, mcpb:pack, prepublishOnly, preview (+4 more)

### Community 72 - "SplitLayout.tsx"
Cohesion: 0.26
Nodes (9): CellDef, GridLayout(), resolveCells(), getPrimitive(), registry, setRegistry(), PanelDef, resolvePanels() (+1 more)

### Community 73 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, esModuleInterop, jsx, module, moduleResolution, noEmit, skipLibCheck, strict (+3 more)

### Community 74 - "Viral-style reel"
Cohesion: 0.17
Nodes (11): 0. Understand the footage FIRST (perception), 1. Set the frame (9:16), 2. Land the hook (first 3 seconds), 3. Tighten the pace (jump cuts on pauses), 4. Add energy (zoom punches + retime + motion), 5. Captions (retention driver), 6. Transitions + polish, 7. Outro / loop (+3 more)

### Community 75 - "validateSceneSpec"
Cohesion: 0.21
Nodes (9): validateSceneSpec(), checkFfmpegAvailable(), meanLumaOfCrop(), remotionDir, runFfmpeg(), sampleImagePath, minimal, MotionResult (+1 more)

### Community 76 - "err"
Cohesion: 0.42
Nodes (6): dataDir(), remotionDir(), aBool(), aNum(), cryptoId(), err()

### Community 77 - "frames.ts"
Cohesion: 0.24
Nodes (9): ffprobeBin(), okImages(), extractFrames(), probeDuration(), run(), SampleMode, VisionFrame, clip (+1 more)

### Community 78 - "Kaestral MCP tools"
Cohesion: 0.18
Nodes (11): Capability audit, Connect, ✅ Fully wired (27), HTTP (for a long-lived engine, or the desktop app's own connection), Kaestral MCP tools, 🧩 Kaestral Skills extensions (beyond the frozen 41), 🟡 Partial / could be extended, 🔒 Signed-out by design (the upstream closed paid cloud) (+3 more)

### Community 79 - "Build order"
Cohesion: 0.18
Nodes (10): ① video-use — transcript-based smart editing (PRIORITY, in progress), ② Prompt → motion graphics — Remotion + Motion Canvas + Manim (the upstream editor has none), ③ Free open AI generation — un-stub generate_video/generate_image (the upstream paid part, made free), ④ Skills system — teach Claude to edit like a pro (partly done), ⑤ Research-only (report, don't build), Build order, Ground rules, Kaestral strategy — beat the upstream editor by being open (+2 more)

### Community 80 - "Kaestral — FAQ"
Cohesion: 0.18
Nodes (11): Can I use ChatGPT?, Do I need an API key or a paid plan to use it?, Does my data stay on my device?, How do I connect Claude?, How is it different from the upstream editor (Palmier Pro)?, Is Kaestral free?, Kaestral — FAQ, What are Pro and Max? (+3 more)

### Community 81 - "FilmLaunch.tsx"
Cohesion: 0.18
Nodes (3): ease, FilmLaunch(), FilmLaunchProps

### Community 82 - "FilmSaaS.tsx"
Cohesion: 0.18
Nodes (3): ease, FilmSaaS(), FilmSaaSProps

### Community 83 - "Styles (pick to match the vibe)"
Cohesion: 0.18
Nodes (10): 1. Word-pop (energetic, most common), 2. Karaoke highlight (the word being said lights up), 3. Bold-boxed (clean, punchy, brand-safe), 4. Typewriter (suspense / storytelling), 5. Slide-up lower-third (informational), Apply, Placement + sizing (do this for all styles), Styles (pick to match the vibe) (+2 more)

### Community 84 - "skills.ts"
Cohesion: 0.29
Nodes (6): skillsDir(), BASE, parseFrontmatter(), SkillEntry, skillsBase(), SkillStore

### Community 85 - "Kaestral — Architecture"
Cohesion: 0.20
Nodes (10): Conventions, Desktop shell (Tauri 2), Kaestral — Architecture, Privacy / local-first (a real invariant, not just marketing), Project file format (.kaestral), The generative motion surface (the differentiator), The MCP server — two transports, The thesis (the one idea everything serves) (+2 more)

### Community 86 - "Kaestral 1.0.0 — Launch Runbook"
Cohesion: 0.20
Nodes (9): 0. Prerequisites (once), 1. One-time updater signing key (required before the FIRST signed release), 2. Build the 1.0.0 installer, 3. Publish the MCP package to npm  (enables `npx kaestral`), 4. Create the GitHub release (so the landing Download button works), 5. Deploy the landing page to Vercel + kaestral.com, 6. (Optional, post-launch) Submit to the MCP registry, Kaestral 1.0.0 — Launch Runbook (+1 more)

### Community 87 - "Root-cause diff (hero-demo vs generated), by mechanism"
Cohesion: 0.20
Nodes (9): A. NO LAYOUT SYSTEM (biggest failure — "alignment & placement"), Also: SaaS demo showed a FAKE green-gradient screenshot, B. NO HOLD / SETTLE — everything always moving ("pacing" + "premiumness"), C. OVER-ANIMATION / NO RESTRAINT ("restraint"), D. FINISH — "the few pixels off" ("quality/finish"), E. EASING — verify curves match, Engine defects — why generated films are ~60% of hero-demo (Task 10 second FAIL), Pass bar (+1 more)

### Community 88 - "Global Constraints"
Cohesion: 0.20
Nodes (9): Authoring Surface — Gate-Driven Expansion (Task 6b) Implementation Plan, Global Constraints, Task 1: Text anchor + mono font (validator + interpreter), Task 2: Hairline anchor + honor enter.easing/durationFrames (interpreter, validator already open), Task 3: Per-word spring stagger reveal (validator + interpreter), Task 4: Camera easing + authorable beat out-fade (validator + interpreter), Task 5: 🚦 RE-RUN THE GATE (controller judges personally) — round 2, Task 6: Honor authored entrance pacing (opt-out of the auto-clamp) (+1 more)

### Community 89 - "keywords"
Cohesion: 0.20
Nodes (10): ffmpeg, mcp, transcription, video, windows, keywords, ai, claude (+2 more)

### Community 90 - "FilmData.tsx"
Cohesion: 0.20
Nodes (3): ease, FilmData(), FilmDataProps

### Community 91 - "Mask.tsx"
Cohesion: 0.29
Nodes (9): MaskField, clipPathFor(), isMidReveal(), LOGO_BARS, Mask(), MaskProps, MaskReveal, MaskShape (+1 more)

### Community 92 - "webviews"
Cohesion: 0.20
Nodes (10): type, webviews, windows, items, description, items, type, description (+2 more)

### Community 93 - "webviews"
Cohesion: 0.20
Nodes (10): type, webviews, windows, items, description, items, type, description (+2 more)

### Community 94 - "Contributing to Kaestral"
Cohesion: 0.22
Nodes (9): Code of conduct, Contributing to Kaestral, Conventions, License, Prerequisites, Pull-request workflow, Set up, Ways to contribute (+1 more)

### Community 95 - "Run LTX-2 on your own Google Cloud GPU (with your $300 credits)"
Cohesion: 0.22
Nodes (8): Appendix — the `gcloud` create command (if you skip the console form), Honest limits, Part A — Google Cloud setup (you do this once, ~30–60 min mostly waiting), Part B — Connect Kaestral (one time), Part C — Daily use (the loop), Run LTX-2 on your own Google Cloud GPU (with your $300 credits), The four stop-guards (why you won't burn credits), The money math (so you're not nervous)

### Community 96 - "render.mjs"
Cohesion: 0.22
Nodes (6): chromiumOptions, __dirname, MEDIA_SRC_ELEMENTS, MIME_BY_EXT, outputLocation, renderScale

### Community 97 - "Text.tsx"
Cohesion: 0.36
Nodes (6): bezierFromSpec(), EASING_PRESET_BEZIER, Hairline(), ease, roleColor(), Text()

### Community 98 - "prepare-resources.mjs"
Cohesion: 0.25
Nodes (6): dirBytes(), mb2(), napiDir, res, root, ProjectTab()

### Community 99 - "Platform delivery"
Cohesion: 0.22
Nodes (8): 1. Pick the target(s), 2. Set the frame, 3. Respect the safe areas, 4. Trim to the platform's sweet spot, 5. Captions + branding pass, 6. Export one file per platform, Deliver, Platform delivery

### Community 100 - "CapabilityRemote"
Cohesion: 0.22
Nodes (9): description, properties, required, type, CapabilityRemote, urls, urls, description (+1 more)

### Community 101 - "CapabilityRemote"
Cohesion: 0.22
Nodes (9): description, properties, required, type, CapabilityRemote, urls, urls, description (+1 more)

### Community 102 - "Kaestral — MCP registry submission prep"
Cohesion: 0.25
Nodes (8): Description, Example `server.json` manifest (draft), Install / run / connect, Kaestral — MCP registry submission prep, Links for the submission, Prerequisites, Server identity, Tool count and categories

### Community 103 - "Auto-updater setup (Tauri 2)"
Cohesion: 0.25
Nodes (8): 0. Why signing is required, 1. One-time key setup, 2. Publishing an update (e.g. v1.1.0), Auto-updater setup (Tauri 2), Paste the public key into the config, Quick reference, Set the signing env vars before building, Troubleshooting

### Community 104 - "B-roll planner"
Cohesion: 0.25
Nodes (7): 1. Understand the A-roll, 2. Choose B-roll for each moment, 3. Place it as an overlay, 4. Make it feel intentional, 5. Rhythm, B-roll planner, Deliver

### Community 106 - "Kaestral — Development History (consolidated)"
Cohesion: 0.29
Nodes (7): 1. The port foundation, 2. Option D — the art-directed authoring surface (the strategic lock), 3. The 1.0 launch wrap, 4. Landing page + marketing (kaestral.com), 5. Repo hygiene, Kaestral — Development History (consolidated), Where to look next

### Community 107 - "Publishing Kaestral"
Cohesion: 0.29
Nodes (6): 1. npm — `npx kaestral` (primary distribution), 2. Landing page — deploy the static site, 3. GitHub — repo + release, 4. Launch, ⚠️ Before the public launch — quick polish, Publishing Kaestral

### Community 108 - "Kaestral `.mcpb` bundle (one-click Claude Desktop install)"
Cohesion: 0.29
Nodes (6): Build it, Kaestral `.mcpb` bundle (one-click Claude Desktop install), Keep the version in sync, Prerequisites for the end user, Ship it, What's here

### Community 109 - "Beat-synced cutting"
Cohesion: 0.29
Nodes (6): 1. Analyze the music, 2. Cut on the beat, 3. Punch on the beat, 4. Choose the grid density, Beat-synced cutting, Notes / limits

### Community 110 - "Creative director"
Cohesion: 0.29
Nodes (6): 1. Read the palette, 2. Grade for a look (`apply_color`), 3. Typography + captions, 4. Composition, Creative director, Deliver

### Community 111 - ".importFromPath"
Cohesion: 0.29
Nodes (3): mimeToType(), MediaProbe, probeMedia()

### Community 112 - "waveform.tsx"
Cohesion: 0.33
Nodes (5): cache, Envelope, fetchOnce(), NONE, WaveformStrip()

### Community 113 - "permissions"
Cohesion: 0.29
Nodes (7): $ref, description, items, type, uniqueItems, items, permissions

### Community 114 - "permissions"
Cohesion: 0.29
Nodes (7): $ref, description, items, type, uniqueItems, items, permissions

### Community 115 - "kaestral.mjs"
Cohesion: 0.33
Nodes (5): child, env, httpMode, pkgRoot, server

### Community 116 - "Entry — 2026-07-01 · Golden-file run-down + Stage A (scaffold + data-model port)"
Cohesion: 0.33
Nodes (6): Decision (lead): author a spec-traceable golden fixture by hand, Entry — 2026-07-01 · Golden-file run-down + Stage A (scaffold + data-model port), Golden-file investigation (reported to lead), Next (Stage B — headless edit engine), Stage-A gate result, Stage A — scaffold + data-model port (BUILT & VERIFIED)

### Community 117 - "Entry — 2026-07-01 · Step 1: Spec extraction (COMPLETE)"
Cohesion: 0.33
Nodes (6): Deliverable, Entry — 2026-07-01 · Step 1: Spec extraction (COMPLETE), Files read (source of truth, all under `palmier-pro-main/Sources/PalmierPro/`), Key findings (these shape the port — see SPEC.md for detail), Next gate (Stage A — Foundations), Open items carried forward (from SPEC §14)

### Community 118 - "Tool-Surface Audit — Kaestral MCP (50 tools)"
Cohesion: 0.33
Nodes (5): Bucket table, DEEPER-LATER, MISSING TOOLS, QUICK WINS APPLIED, Tool-Surface Audit — Kaestral MCP (50 tools)

### Community 119 - "NOTICE / CREDITS"
Cohesion: 0.33
Nodes (6): Attribution in source, NOTICE / CREDITS, Perception (transcription + vision), Port-to-upstream file map (data model + engine), Third-party, Upstream work this is derived from

### Community 120 - "Connect an AI"
Cohesion: 0.33
Nodes (6): 1. Claude Code — one command, 2. Cursor, 3. Claude Desktop, Connect an AI, Or: in-app chat (no MCP client needed), Prefer the HTTP transport?

### Community 121 - "CondenseReel.tsx"
Cohesion: 0.33
Nodes (3): CondenseReel(), CondenseReelProps, ease

### Community 122 - "Transitions.tsx"
Cohesion: 0.47
Nodes (5): BeatSequence(), applyTransition(), clamp01(), interpolate1(), TransitionStyles

### Community 123 - "HeroDemo.tsx"
Cohesion: 0.33
Nodes (3): ease, HeroDemo(), HeroDemoProps

### Community 124 - "Timeline.tsx"
Cohesion: 0.40
Nodes (5): DEFAULT_TRACKS, ease, resolveTracks(), Timeline(), TrackSpec

### Community 125 - "Promo / ad video"
Cohesion: 0.33
Nodes (5): Checklist, Format, Make it feel produced, Promo / ad video, The arc

### Community 127 - "Capability"
Cohesion: 0.33
Nodes (6): description, required, type, Capability, identifier, permissions

### Community 128 - "Capability"
Cohesion: 0.33
Nodes (6): description, required, type, Capability, identifier, permissions

### Community 129 - "Kaestral — launch posts (drafts)"
Cohesion: 0.40
Nodes (4): Hacker News — Show HN, Kaestral — launch posts (drafts), r/ClaudeAI, X / Twitter (thread)

### Community 130 - "Entry — 2026-07-03 · THE REAL USER LOOP + Kaestral rename + GitHub push"
Cohesion: 0.40
Nodes (5): Architecture change: shared project state (the fix for "app and Claude edit different projects"), Entry — 2026-07-03 · THE REAL USER LOOP + Kaestral rename + GitHub push, Kaestral rename + GitHub, Protocol going forward (user directive), THE LOOP — verified in the RUNNING app (not the harness), every step pixel-checked

### Community 131 - "Quality Gate — Binding Critique (Task 5 review, user verdict: NOT shippable)"
Cohesion: 0.40
Nodes (4): Films required at Task 10, Quality Gate — Binding Critique (Task 5 review, user verdict: NOT shippable), Task 10 pass bar (hard), The 8 must-fixes (drive Tasks 6–9)

### Community 132 - "Kaestral — Future Ideas (post-1.0)"
Cohesion: 0.40
Nodes (4): add_captions doc/handler mismatch, Kaestral — Future Ideas (post-1.0), Other audited MISSING tools (see TOOL-SURFACE-AUDIT.md), render_frame / preview_timeline (post-launch — HIGH value)

### Community 133 - "resolveLayoutPosition"
Cohesion: 0.70
Nodes (4): clampToSafeArea(), ResolvedPosition, resolveLayoutPosition(), snapToBaselineGrid()

### Community 134 - "Particles.tsx"
Cohesion: 0.60
Nodes (4): buildNodes(), Node, Particles(), seededRandom()

### Community 135 - "TextOnPath.tsx"
Cohesion: 0.60
Nodes (4): PathKind, pathOffset(), resolveEmphasis(), TextOnPath()

### Community 136 - "Build inside Kaestral"
Cohesion: 0.40
Nodes (4): Build inside Kaestral, The loop for any "make me a video" request, The rule, Why

### Community 137 - "stdio.ts"
Cohesion: 0.50
Nodes (3): JsonRpcRequest, runStdio(), writeMessage()

### Community 138 - "desktop-schema.json"
Cohesion: 0.40
Nodes (4): anyOf, description, $schema, title

### Community 139 - "windows-schema.json"
Cohesion: 0.40
Nodes (4): anyOf, description, $schema, title

### Community 140 - "UPGRADES — the honest gap to a real editor"
Cohesion: 0.40
Nodes (4): Ranked gap to "a real editor", Standing hard gate, UPGRADES — the honest gap to a real editor, What already works (so the list above is in context)

### Community 141 - "Entry — 2026-07-03 · Stage F: color/effects + FFmpeg render — PHASE-1 PARITY COMPLETE"
Cohesion: 0.50
Nodes (4): Color grade + effects (apply_color / apply_effect), Entry — 2026-07-03 · Stage F: color/effects + FFmpeg render — PHASE-1 PARITY COMPLETE, Final pass, Video render (FFmpeg) — the finish line

### Community 142 - "Entry — 2026-07-01 · Stage B: headless edit engine (BUILT & VERIFIED)"
Cohesion: 0.50
Nodes (4): Entry — 2026-07-01 · Stage B: headless edit engine (BUILT & VERIFIED), Next: Stage C (MCP server) — proceeding without idling (licensing settled = path A), Source finding (recorded in engine comments), Stage-B gate result

### Community 143 - "Entry — 2026-07-01 · Stage C: MCP server + 41 tools (BUILT & VERIFIED)"
Cohesion: 0.50
Nodes (4): Entry — 2026-07-01 · Stage C: MCP server + 41 tools (BUILT & VERIFIED), Phase-1 stubs still honest (register + report unavailable, never fake), ⛔ Reached the Rust/FFmpeg boundary (Stage D), Stage-C gate result

### Community 144 - "Forensic diff vs hero-demo — the last 60→85→100 craft closure (ranked)"
Cohesion: 0.50
Nodes (3): Forensic diff vs hero-demo — the last 60→85→100 craft closure (ranked), PixiJS verdict (honest), Resolution (user-facing engine default)

### Community 145 - "vercel.json"
Cohesion: 0.50
Nodes (3): cleanUrls, headers, trailingSlash

### Community 146 - "What it does"
Cohesion: 0.50
Nodes (4): 🎬 AI-operated. You direct, it edits., 📊 Make SaaS & product videos without an editor., ⚡ Raw footage → publish-ready reel., What it does

### Community 148 - "AreaChart.tsx"
Cohesion: 0.67
Nodes (3): AreaChart(), ease, normalize()

### Community 153 - "local"
Cohesion: 0.50
Nodes (4): default, description, type, local

### Community 154 - "local"
Cohesion: 0.50
Nodes (4): default, description, type, local

### Community 155 - "Entry — 2026-07-08 · STRATEGY ② motion graphics — Remotion engine added (React), auto-picked"
Cohesion: 0.67
Nodes (3): Entry — 2026-07-08 · STRATEGY ② motion graphics — Remotion engine added (React), auto-picked, Gate — verified live, Windows / Chromium

### Community 156 - "Standing requirements (not one-time tasks)"
Cohesion: 0.67
Nodes (3): Licensing / attribution — path A (settled by lead 2026-07-01), Rust toolchain gate (first runnable build), Standing requirements (not one-time tasks)

### Community 160 - "identifier"
Cohesion: 0.67
Nodes (3): description, type, identifier

### Community 161 - "identifier"
Cohesion: 0.67
Nodes (3): description, type, identifier

## Knowledge Gaps
- **870 isolated node(s):** `pkgRoot`, `server`, `env`, `httpMode`, `child` (+865 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **21 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Clip` connect `Clip` to `codec.ts`, `defaults.ts`, `McpExecutor`, `editEngine.ts`, `EditEngine`, `Builder`, `executor.ts`, `Builder`, `EditorStore`, `.entry`, `renderVideo.ts`, `Timeline.tsx`, `endFrame`, `xml.ts`, `Inspector.tsx`, `clipSampling.ts`, `fcpxml.ts`, `TimelineGeometry`, `store.ts`, `effectStack.ts`, `transitions.test.ts`, `waveform.tsx`, `AnimatableProperty`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **Why does `EditEngine` connect `EditEngine` to `defaults.ts`, `McpExecutor`, `editEngine.ts`, `executor.ts`, `EditorStore`, `store.ts`, `transitions.test.ts`, `Timeline`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Why does `EditorStore` connect `EditorStore` to `defaults.ts`, `ProjectBridge`, `EditEngine`, `clipSampling.ts`, `waveform.tsx`, `store.ts`, `.pollGpu`, `AnimatableProperty`, `.emit`, `Timeline`, `.setGenProvider`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **What connects `pkgRoot`, `server`, `env` to the rest of the system?**
  _870 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `codec.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.059961777353081704 - nodes in this community are weakly interconnected._
- **Should `sceneSpec.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.032242063492063495 - nodes in this community are weakly interconnected._
- **Should `defaults.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09502262443438914 - nodes in this community are weakly interconnected._