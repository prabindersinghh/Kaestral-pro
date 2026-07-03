# Palmier Pro — Port Specification (Phase 1)

**Status:** Step 1 deliverable — the persistence + MCP contract, extracted directly from the
macOS Swift source. Stage A in progress.
**Source of truth:** `palmier-pro-main/` (Swift 6.2, GPLv3) at the paths cited per section.
**Verified on:** 2026-07-01.
**Scope rule:** This document records *what the macOS app actually does* (round-trip and contract
behavior). Where it diverged from the master brief (`PALMIER-WINDOWS-PORT.md`), the lead has
**accepted the source-verified version**; §0 below is now the authoritative, frozen ruleset for the
port — not a list of open corrections.

---

## 0. Frozen rules (authoritative — accepted by lead 2026-07-01)

1. **The MCP server registers exactly 41 tools. This count is frozen.**
   `ToolDefinitions.all` (the array handed verbatim to `Server` in `MCPService.registerTools`,
   `Agent/MCP/MCPService.swift:73`) contains exactly **41** entries. (The brief's "43" double-counted:
   "Media library" is **8** tools, "Generation" is **4** — `generate_video`, `generate_image`,
   `generate_audio`, `upscale_media`.) `read_skill` exists but is **not registered** on MCP
   (`ToolDefinitions.swift:883` — "In-app assistant only"). The frozen contract the port must match
   is **the 41 tools in §9**, names and arg schemas verbatim.

2. **`project.json` serialization rule (FROZEN): every non-optional field is ALWAYS written; only
   nil optionals are omitted. This is explicitly NOT the `get_timeline` default-omitting form.**
   - `project.json` = plain `JSONEncoder().encode(Timeline)` (`VideoProject.captureSaveSnapshot`,
     `Project/VideoProject.swift:172`). Swift's *synthesized* `Codable` writes **every non-optional
     field even at its default** (`speed:1`, `opacity:1`, `trimStartFrame:0`, identity
     `transform`/`crop`, `muted:false`, …) and omits an optional **only when it is nil**
     (`encodeIfPresent`). The port's writer MUST do exactly this. Do **not** drop default-valued
     non-optional fields — doing so makes the diff *dirtier*, not cleaner.
   - The default-omitting compact JSON is a **separate** serialization built by hand inside
     `get_timeline` (`ToolExecutor+Timeline.swift`) for the agent. The two must never be conflated.

3. **Round-trip acceptance method (FROZEN): semantic decode-and-compare.** Acceptance is *not*
   byte-identical output (Swift `JSONEncoder` is compact, key-unsorted, and uses reference-date
   doubles for `Date`; JS/Rust will differ). The gate is: parse JSON → build the typed model →
   re-encode → parse again → **deep-equal of the two parsed structures**, with the §0.2 rule enforced
   (no loss of non-optional fields, no spurious omission of present fields, optionals omitted only
   when nil). See §1.1 for the golden fixture this runs against.

4. Only `Transform` has a **hand-written encoder** (always writes all 7 fields). Everything else uses
   synthesized `Codable` under the §0.2 rule.

---

## 1. The `.palmier` project package

A project is a **directory** (NSDocument package on macOS; a plain folder on Windows).
Constants from `Utilities/Constants.swift` (`enum Project`) and layout from `Project/VideoProject.swift`.

| Constant | Value |
|---|---|
| Extension | `palmier` |
| UTI / type identifier | `io.palmier.project` |
| Timeline file | `project.json` |
| Media manifest file | `media.json` |
| Generation log file | `generation-log.json` |
| Thumbnail file | `thumbnail.jpg` |
| Media subdirectory | `media/` |
| Chat sessions dir | `ChatSessionStore.dirName` (per-session `<uuid>.json`) |
| Registry (app-level, outside package) | `project-registry.json` |

```
MyProject.palmier/
├── project.json          # REQUIRED — JSONEncoder dump of Timeline. Missing ⇒ fileReadCorruptFile.
├── media.json            # optional — MediaManifest. Bad/missing ⇒ open with no media (preserved on save).
├── generation-log.json   # optional — GenerationLog. Written only if present in the editor.
├── thumbnail.jpg         # optional — 640px-long-edge JPEG (q=0.7) of first video/image clip.
├── media/                # optional — assets stored relative to the package (see MediaSource.project).
└── <chat-sessions-dir>/  # optional — <session-uuid>.json, one per non-empty chat session.
```

**Load (`readProjectPackage`, VideoProject.swift:88):**
- `project.json` is **required**; decode failure throws.
- `media.json` optional; if present but undecodable, project still opens with `manifest=nil` and a
  `manifestUnreadable=true` flag so the next save **does not clobber** the recoverable file.
- `generation-log.json` optional; decoded best-effort (`try?`).

**Save (`writeProjectPackage`, VideoProject.swift:205):**
- Always writes `project.json` (atomic).
- Writes `media.json` if a manifest snapshot exists; otherwise **copies the preserved original**.
- Writes `generation-log.json` and `thumbnail.jpg` when present; thumbnail otherwise preserved.
- Rewrites the chat dir; copies the `media/` dir when saving to a new location.

**Encoder settings (critical for round-trip):** plain `JSONEncoder()` / `JSONDecoder()` — meaning:
- Output is **compact** (no pretty-print), keys in **declaration / CodingKeys order**, **not sorted**.
- `Date` ⇒ **`.deferredToDate`**: a `Double` of seconds since the 2001-01-01 reference date
  (affects `media.json` date fields only — `project.json` has no dates).
- Optionals: nil ⇒ omitted; non-optionals: always present.
- **Round-trip acceptance is *semantic* (deep-equal of decoded structures), not byte-identical** —
  JS/Rust key ordering and float formatting will differ from Swift; the test must decode both sides
  and compare values, and re-encode must itself round-trip.

### 1.1 Golden fixture (Stage-A acceptance source)

No real macOS-saved `.palmier` is reachable: bundled samples are fetched at runtime from a Convex
backend (`SampleProjectService` → `/v1/samples/resolve`) whose URL is the build-private Info.plist
key `PalmierConvexHttpURL` (`Account/BackendConfig.swift:7,13`), absent from the open-source repo;
no `.palmier`/`project.json`/`media.json` fixtures are committed. We have no Mac to generate one.

Since `project.json` is deterministic `JSONEncoder` output of the `Timeline` struct — which we have
exactly — the golden file is **hand-authored from source** and lives at:
- `fixtures/golden-project.json` — a `Timeline` exercising every non-default + optional field.
- `fixtures/golden-media.json` — a `MediaManifest` exercising **both** `MediaSource` variants
  (`external.absolutePath`, `project.relativePath`), `folderId`, optional metadata, and a folder.
- `fixtures/golden-fixtures.notes.md` — per-field → source-line/default mapping (JSON has no comments).

**This fixture is provisional-but-spec-authoritative.** It is derived from `Models/*`, not from our
writer, so it is a *real* gate (not a self-check). If a genuine Palmier-authored `.palmier` is later
obtained, diff it against the fixture, reconcile any surprise (esp. `MediaSource` shape + `Date`
encoding), and promote it. Dates are intentionally omitted from the fixture until a real file pins
the reference-date encoding.

**Stage-A round-trip acceptance (the gate):**
(a) decode `golden-project.json`/`golden-media.json` into the ported TS model, re-encode, and
    **semantically compare** — no data loss, no spurious omission of present fields; and
(b) assert the writer **emits every non-optional field and omits only nil optionals** (the §0.2 rule),
    verified on a default-constructed `Clip`/`Track`/`Timeline`.
Verify the `MediaSource` `external`/`project` JSON shape against the fixture now, and again against a
genuine `.palmier` if/when one is obtained.

---

## 2. `project.json` — the `Timeline` schema

Spine: `Models/Timeline.swift`. Field name · type · default · encode behavior.

### 2.1 Timeline (root, synthesized Codable)
| Field | Type | Default | Notes |
|---|---|---|---|
| `fps` | Int | 30 | always written |
| `width` | Int | 1920 | always written |
| `height` | Int | 1080 | always written |
| `settingsConfigured` | Bool | false | always written |
| `tracks` | Track[] | [] | always written (`[]` if empty) |

`totalFrames` is computed (`max track.endFrame`) — **not serialized**.

### 2.2 Track (custom decoder, synthesized encoder; CodingKeys: id,type,muted,hidden,syncLocked,clips)
| Field | Type | Default | Notes |
|---|---|---|---|
| `id` | String (UUID) | new UUID | always written |
| `type` | ClipType | — (required) | always written |
| `muted` | Bool | false | always written |
| `hidden` | Bool | false | always written |
| `syncLocked` | Bool | **true** | always written; governs ripple shifting |
| `clips` | Clip[] | [] | always written |

`displayHeight` (CGFloat=50) is **excluded from CodingKeys** — never serialized; resets on open.
Decoder is missing-key tolerant (every field falls back to its default).

### 2.3 Clip (custom decoder, synthesized encoder)
Encode order = CodingKeys order below. **Non-optional fields always written; optionals omitted when nil.**

| Field | Type | Default | Optional? | Notes |
|---|---|---|---|---|
| `id` | String (UUID) | new UUID | no | |
| `mediaRef` | String | — (required) | no | → `media.json` entry id |
| `mediaType` | ClipType | `.video` | no | always written |
| `sourceClipType` | ClipType | `.video` | no | original type, for color-coding |
| `startFrame` | Int | — (required) | no | timeline position, project frames |
| `durationFrames` | Int | — (required) | no | timeline length, project frames |
| `trimStartFrame` | Int | 0 | no | **source** in-point offset, in **project frames** |
| `trimEndFrame` | Int | 0 | no | **source** out-point offset, in **project frames** |
| `speed` | Double | 1.0 | no | |
| `volume` | Double | 1.0 | no | linear 0–1 |
| `fadeInFrames` | Int | 0 | no | |
| `fadeOutFrames` | Int | 0 | no | |
| `fadeInInterpolation` | Interpolation | `.linear` | no | `linear`\|`hold`\|`smooth` |
| `fadeOutInterpolation` | Interpolation | `.linear` | no | |
| `opacity` | Double | 1.0 | no | |
| `transform` | Transform | identity | no | **custom encoder → all 7 fields always** |
| `crop` | Crop | identity (0,0,0,0) | no | synthesized → all 4 always |
| `linkGroupId` | String? | nil | yes | links video↔split-out audio |
| `captionGroupId` | String? | nil | yes | groups caption clips |
| `textContent` | String? | nil | yes | text clips only |
| `textStyle` | TextStyle? | nil | yes | text clips only |
| `textAnimation` | TextAnimation? | nil | yes | text clips only |
| `wordTimings` | WordTiming[]? | nil | yes | per-word caption timing |
| `opacityTrack` | KeyframeTrack\<Double>? | nil | yes | |
| `positionTrack` | KeyframeTrack\<AnimPair>? | nil | yes | top-left normalized (x,y) |
| `scaleTrack` | KeyframeTrack\<AnimPair>? | nil | yes | normalized (width,height) |
| `rotationTrack` | KeyframeTrack\<Double>? | nil | yes | degrees |
| `cropTrack` | KeyframeTrack\<Crop>? | nil | yes | |
| `volumeTrack` | KeyframeTrack\<Double>? | nil | yes | values are **dB**, see §4 |
| `effects` | Effect[]? | nil | yes | color.* + blur/stylize/… |
| `blendMode` | BlendMode? | nil | yes | nil = normal/source-over |

### 2.4 Transform (⚠️ custom encoder — always writes all 7)
`centerX`=0.5, `centerY`=0.5, `width`=1, `height`=1, `rotation`=0 (deg, +CW),
`flipHorizontal`=false, `flipVertical`=false. Coords are **normalized canvas space**; `width/height`
are normalized sizes (1 = fills that axis). Legacy decoder accepts old `x`/`y` keys (top-left-ish)
and converts; the port only needs the modern keys for writing.

### 2.5 Crop (synthesized — all 4 always)
`left`,`top`,`right`,`bottom` — edge insets in normalized 0–1 **source** coords; default 0.

---

## 3. Core invariants (carry into the engine exactly)

From `Models/Timeline.swift` + `Models/Keyframe.swift`:
- `endFrame = startFrame + durationFrames`.
- `sourceFramesConsumed = round(durationFrames * speed)`.
- `sourceDurationFrames = sourceFramesConsumed + trimStartFrame + trimEndFrame`.
- **Trim offsets are measured in project frames** (timeline fps), never source fps.
- **Keyframe frames are clip-relative** (0 = clip's first frame). Stored as `frame - startFrame`;
  exposed to the agent as clip-relative. They follow the clip on move; clamped to `[0, durationFrames]`
  on shrink; rescaled by duration ratio on speed/stretch.
- `position` keyframes = **top-left** normalized canvas coords; `scale` = normalized (w,h) (NOT a
  factor); `crop` = side insets 0–1; `rotation` = degrees; `opacity` 0–1; `volume` = **dB** envelope.
- **Fade envelope** (`fadeMultiplier`): `min(inRamp, outRamp)`; `smooth` uses `smoothstep(t)=t²(3−2t)`,
  else linear. Audio clips ignore the *opacity* fade. Head+tail clamp so they can't exceed duration.
- **Effective opacity** = `opacityTrack.sample ?? opacity`, then × fade (non-audio).
- **Effective volume** = `volume × linearFromDb(volumeTrack.sample) × fade`. (`VolumeScale` in
  `Inspector/InspectorView.swift:1076`.)
- Linked A/V partners (`linkGroupId`) move/trim/split/delete together; on split the right halves
  regroup into a new link pair.
- `syncLocked` tracks shift together on ripple; a ripple **refuses** (no-op) if a sync-locked track
  can't absorb the shift (e.g. would cross frame 0), naming the blocking track.
- `timelineFrame(sourceSeconds:fps:)`: `start + (t·fps − trimStart)/max(speed,1e-4)`, valid only
  inside `[startFrame, endFrame)`.

---

## 4. Keyframes (`Models/Keyframe.swift`)

- `Keyframe<V>` = `{ frame:Int, value:V, interpolationOut:Interpolation = .smooth }`.
  ⚠️ **default interp is `.smooth`** and is always encoded.
- `KeyframeTrack<V>` = `{ keyframes:[Keyframe<V>] }`; `isActive = !empty`.
- `AnimPair` = `{ a:Double, b:Double }` (position = (x,y) top-left; scale = (w,h)).
- `Interpolation`: `linear` | `hold` | `smooth`.
- **Sampling** (`sample(at:fallback:)`): before first kf → first value; after last → last value;
  between `a` and `b` use `a.interpolationOut`: `hold`→a; `linear`→lerp; `smooth`→lerp∘smoothstep.
  Single keyframe → constant. `upsert` keeps frames sorted, replacing same-frame.

---

## 5. Effects & color (`Models/Effect.swift`, `Compositing/EffectRegistry.swift`)

- `Effect` = `{ id:UUID, type:String, enabled:Bool=true, params:{String:EffectParam} }` (synthesized;
  id/type/enabled/params always written, `params` as `{}` if empty).
- `EffectParam` = `{ value:Double?, string:String?, track:KeyframeTrack<Double>? }` — all optional,
  omitted when nil. `resolved(at:default:)` = animated track sample else `value ?? default`.
- Effects render in a **fixed canonical order** regardless of array order (`canonicalOrder`).
- 20 registered effect descriptors (id — params(range, default)):

| id | params |
|---|---|
| `color.exposure` | ev (−3…3, 0) |
| `color.contrast` | amount (0.5…1.5, 1) |
| `color.saturation` | amount (0…2, 1) |
| `color.temperature` | temperature (2000…11000K, 6500), tint (−100…100, 0) |
| `color.highlightsShadows` | highlights (−1…1, 0), shadows (−1…1, 0) |
| `color.blacksWhites` | blacks (−1…1, 0), whites (−1…1, 0) |
| `color.vibrance` | amount (−1…1, 0) |
| `color.wheels` | lift_x/y (−1…1,0) lift_m (−.5….5,0) gamma_x/y (−1…1,0) gamma_m (.5…2,1) gain_x/y (−1…1,0) gain_m (.5…1.5,1) |
| `color.hueCurves` | string param `curves` (HueCurves JSON) |
| `color.lut` | intensity (0…1, 1) + resource `path` (.cube) |
| `color.curves` | string param `curve` (GradeCurve JSON) |
| `detail.clarity` | clarity (−1…1, 0), dehaze (−1…1, 0) |
| `key.chroma` | keyHue (0…1, .333), tolerance (0…1, 0), softness (0…1, .5), spill (0…1, .5) |
| `blur.gaussian` | radius (0…100px, 8) |
| `blur.sharpen` | amount (0…2, .4) |
| `blur.noiseReduction` | amount (0…1, 0) |
| `blur.motion` | radius (0…100px, 0), angle (−180…180°, 0) |
| `stylize.grain` | amount (0…1, 0), size (.5…4, 1.5) |
| `stylize.vignette` | amount (−1…1,0), midpoint (0…1,.5), roundness (−1…1,0), feather (0…1,.5) |
| `stylize.glow` | intensity (0…1,0), radius (0…100px,20), threshold (0…1,.6), warmth (0…1,0) |

- `GradeCurve` (`color.curves`'s `curve` string): `{ master,red,green,blue: CurvePoint[] }`,
  `CurvePoint={x,y}` 0–1, piecewise-linear, identity = `[(0,0),(1,1)]`.
- `HueCurves` (`color.hueCurves`'s `curves` string): `{ hueVsHue, hueVsSat, hueVsLum: CurvePoint[] }`,
  cyclic eval, neutral y=0.5.
- `BlendMode` (`Models/BlendMode.swift`): `normal, darken, multiply, colorBurn, lighten, screen,
  colorDodge, overlay, softLight, hardLight, difference, exclusion, hue, saturation, color, luminosity`.
  `normal` ⇒ stored as nil (source-over). Each maps to a `CI*BlendMode` (port to WebGL blend).

---

## 6. Text (`Models/TextStyle.swift`, `Models/TextAnimation.swift`)

- `WordTiming` = `{ text:String, startFrame:Int, endFrame:Int }` (clip-relative frames).
- `TextStyle` (CodingKeys: fontName,fontSize,fontScale,isBold,isItalic,color,alignment,shadow,
  background,border — synthesized encode of those 10):
  - `fontName`="Helvetica-Bold", `fontSize`=96, `fontScale`=1.0, `isBold`=true, `isItalic`=false,
    `color`=RGBA(1,1,1,1), `alignment`=`center` (`left`|`center`|`right`),
    `shadow`=Shadow(enabled:true, color:RGBA(0,0,0,.6), offsetX:0, offsetY:−2, blur:6),
    `background`=Fill(enabled:false, color:RGBA(0,0,0,.6)),
    `border`=Fill(enabled:false, color:RGBA(0,0,0,1)).
  - `RGBA` = `{r,g,b,a}` doubles (default 1). Hex parse accepts `#RGB`/`#RRGGBB`/`#RRGGBBAA`.
  - Glyph border stroke width constant = −4 (outline).
- `TextAnimation` (custom decoder; CodingKeys: preset, perWordFrames, highlight):
  - `preset`=`.none`, `perWordFrames`=6, `highlight`:RGBA? (nil → omitted).
  - Presets: `none`; per-line `fadeIn,popIn,slideUp,typewriter`;
    per-word `wordReveal,wordSlide,wordPop,wordCycle,highlightPop,highlightBlock`.
  - Agent-facing values (`agentValues`): `["off"] + all non-none rawValues` (`off` ⇒ none/clear).

---

## 7. `media.json` — the `MediaManifest` schema (`Models/MediaManifest.swift`)

- `MediaManifest` (custom decoder): `version:Int=2` (decode falls back to 1 if absent; encode always
  writes 2), `entries:MediaManifestEntry[]=[]`, `folders:MediaFolder[]=[]`. All three always written.
- `MediaManifestEntry` (synthesized; non-optionals always, optionals omitted when nil):
  - required: `id:String` (let), `name:String`, `type:ClipType`, `source:MediaSource`, `duration:Double`.
  - optional: `generationInput:GenerationInput?`, `sourceWidth/Height:Int?`, `sourceFPS:Double?`,
    `hasAudio:Bool?`, `folderId:String?`, `cachedRemoteURL:String?`,
    `cachedRemoteURLExpiresAt:Date?`, `generationStatus:String?`, `importInput:MediaImportInput?`.
- `MediaSource` — **enum with associated values**; Swift synthesized JSON shape is
  `{"external":{"absolutePath":"…"}}` or `{"project":{"relativePath":"…"}}`. Reproduce this exact
  shape. `.project` paths are relative to the package; `.external` are absolute host paths.
- `MediaFolder` = `{ id:String, name:String, parentFolderId:String? }` (nested folders).
- `MediaImportInput` = `{ sourceURL?, sourcePath?, createdAt?:Date }`.
- `GenerationInput` — large optional bag (prompt, model, duration, aspectRatio, resolution?, quality?,
  imageURLs?, numImages?, voice?, lyrics?, styleInstructions?, instrumental?, generateAudio?,
  reference*/asset-id arrays, createdAt?, backendJobId?, outputIndex?, resultURLs?). The port **reads
  and preserves** it but never authors it (generation is stubbed). `generationStatus` strings:
  `preparing|generating|downloading|rendering|failed: <msg>` (transient `none/preparing` not persisted).
- ⚠️ Date fields encode via `.deferredToDate` (seconds-since-2001 Double). Match this if writing dates;
  simplest safe path is to **preserve** unparsed manifest bytes when only the timeline changed.

`Defaults` (Constants.swift): image clip = 5.0s, TTS audio = 10.0s, music = 60.0s, text = 3.0s,
aspect tolerance 0.02.

---

## 8. MCP transport contract (`Agent/MCP/MCPHTTPServer.swift`, `MCPService.swift`)

| Property | Value |
|---|---|
| Port | **19789** (`MCPService.port`) |
| Bind | **`127.0.0.1` IPv4 loopback only** (never LAN; `requiredLocalEndpoint`) |
| Endpoint | `POST /mcp` (also accepts `/`) |
| Server identity | name **`palmier-pro`**, version **`1.0.0`** |
| Capabilities | `resources{subscribe:false, listChanged:false}`, `tools{listChanged:false}` |
| Enabled pref key | `io.palmier.pro.mcp.enabled` (default true) |

Behaviors to replicate exactly:
- `GET /mcp` → `200` with `Content-Type: text/event-stream` and body `: connected\n\n` (SSE keep-alive).
- `GET /.well-known/oauth-protected-resource` → `{"resource":"http://127.0.0.1:19789"}`.
- Unknown path → 404; unparsable → 400.
- **Validation pipeline (all three, in order):** `OriginValidator.localhost(port:)`,
  `ContentTypeValidator`, `ProtocolVersionValidator`. Stateless transport; one Server per connection.
- **2 MCP resources** also registered: `palmier://models/video`, `palmier://models/image`
  (`application/json`). For the stub these return `[]`.
- Client config that must keep working:
  `claude mcp add --transport http palmier-pro http://127.0.0.1:19789/mcp`.

---

## 9. The 41 registered MCP tools (frozen contract)

Names + arg schemas are **frozen**; copy verbatim from `Agent/Tools/ToolDefinitions.swift`. Schemas
are built by helpers: `objectSchema(properties:required:)` emits
`{"type":"object", "properties":…, "required":…}` (omits `properties`/`required` when empty);
`textStyleProperties()` and `textBoxTransformProperties()` are shared property bundles (§9.3).
Required arrays per tool are listed below; full per-arg descriptions live in the source and must be
preserved (real external agents depend on the wording).

### 9.1 Tool list (registration order, with required args)

**Read / inspect (6)**
1. `get_timeline` — req: none. Args: `startFrame?`, `endFrame?`. Returns settings, tracks, clips,
   caption groups, and **`canGenerate`** (see §10). Tool output **omits default fields** (distinct
   from project.json, §0.2).
2. `get_media` — req: none. Lists assets + `generationStatus`.
3. `inspect_media` — req: `mediaRef`. Args: `clipId?, maxFrames?, startSeconds?, endSeconds?,
   wordTimestamps?, overview?, language?`. (Transcription-dependent — §11.)
4. `get_transcript` — req: none. Args: `startFrame?, endFrame?, clipId?, language?`. (Transcription-dep.)
5. `inspect_timeline` — req: none. Args: `startFrame?, endFrame?, maxFrames?`. Composited frames.
6. `search_media` — req: `query`. Args: `scope?(visual|spoken|both), mediaRef?, limit?`. (Search-dep.)

**Timeline edit (13)**
7. `add_clips` — req: `entries`. entry: `{mediaRef, startFrame, trackIndex?, durationFrames?,
   trimStartFrame?, trimEndFrame?}` (durationFrames ⟂ trimEndFrame). Overwrites overlap on a track.
8. `insert_clips` — req: `trackIndex, atFrame, entries`. Ripples (pushes right); spawns linked audio.
9. `remove_clips` — req: `clipIds`. Removes whole link group.
10. `remove_tracks` — req: `trackIndexes`. Indices shift down after.
11. `move_clips` — req: `moves` (each `{clipId, toTrack?, toFrame?}`, ≥1 of toTrack/toFrame). Links follow.
12. `apply_layout` — req: `layout, slots`. layout ∈ VideoLayout (§9.4); slot `{slot, mediaRef|clipIds,
    anchor?, anchorX?, anchorY?}`; top-level `startFrame?, durationFrames?, fit?(fill|fit)`.
13. `set_clip_properties` — req: `clipIds`. Args: `durationFrames?, trimStartFrame?, trimEndFrame?,
    speed?, volume?, opacity?, transform?(partial: centerX,centerY,width,height,flipH,flipV),
    blendMode?(BlendMode enum)`. Setting volume/opacity clears that keyframe track. Timing propagates
    to linked partner; per-clip fields don't. **Not for layout** (use apply_layout).
14. `set_keyframes` — req: `clipId, property, keyframes`. property ∈
    `{volume,opacity,rotation,position,scale,crop}`. Rows = `[frame, …values, interp?]`, **clip-relative**:
    volume/opacity `[f,v]`; rotation `[f,deg]`; position `[f,tlX,tlY]`; scale `[f,w,h]`;
    crop `[f,top,right,bottom,left]`. interp ∈ {linear,hold,smooth}, default smooth. Empty array clears.
15. `split_clips` — req: none (exactly one mode): `splits`=`[{clipId,atFrame}]` **or** `trackIndex`+`frames`.
    Cuts are inserted (no shift). Linked partners split together.
16. `ripple_delete_ranges` — req: `ranges` (`[start,end]` pairs). Exactly one of `trackIndex`
    (units must be `frames`, may span clips) or `clipId` (allows `units:seconds|frames`).
    `units?` default frames; `ignoreSyncLockedTracks?:int[]`. Closes gaps; refuses on sync-lock conflict.
17. `remove_words` — req: `words` (ints or `[start,end]` index spans). Args: `cutAggressiveness?
    (tight|balanced|loose), language?`. Indices come from `get_transcript`. (Transcription-dep.)
18. `sync_audio` — req: `referenceClipId`. Args: `targetClipId?|targetClipIds?, searchWindowSeconds?
    (30), minConfidence?(0.5)`. Cross-correlation align. (Audio-engine-dep.)
19. `undo` — req: none. Reverts the assistant's most recent edit; refuses if last change wasn't the agent's.

**Text / captions (3)**
20. `add_texts` — req: `entries`. entry: `{startFrame, durationFrames, content}` + `trackIndex?,
    transform?(textBox), …textStyle, animation?(TextAnimation.agentValues), highlightColor?}`.
    Unknown fields rejected.
21. `update_text` — req: none. Args: `clipIds?|captionGroupId?, content?, transform?, …textStyle,
    animation?, highlightColor?`. Unknown fields rejected.
22. `add_captions` — req: none. Args: `clipIds?, language?, centerX?, centerY?, textCase?(auto|upper|
    lower), censorProfanity?, maxWords?, …textStyle, animation?, highlightColor?`. (Transcription-dep.)

**Color / effects (3)**
23. `apply_effect` — req: `clipIds`. Args: `effects` (`[{type, params?, enabled?}]`), `remove?:string[]`.
    Merge semantics; canonical render order; effect types from §5.
24. `apply_color` — req: `clipIds`. Args: `reset?` + named knobs: `exposure, contrast, saturation,
    vibrance, temperature, tint, highlights, shadows, blacks, whites, shadowsHue/Amount/Lum,
    midsHue/Amount/Gamma, highsHue/Amount/Gain, masterCurve/redCurve/greenCurve/blueCurve
    ([[x,y],…]), hueCurves{targets:[{targetHue, hueShift?, satScale?, lumShift?}]}, lut{path?,strength?}`.
    Merges onto current grade; maps to `color.*` effects.
25. `inspect_color` — req: none. Args: `clipId?|mediaRef?, atFrame?, reference?`. Returns scopes + frame.

**Media library (8)**  ⚠️ (brief said 9)
26. `import_media` — req: `source` (exactly one of `url|path|bytes`, `mimeType` req for bytes).
    Args: `name?, folderId?`. HTTPS≤1GB; bytes≤~11MB.
27. `list_folders` — req: none.
28. `create_folder` — req: none. `name`(+`parentFolderId?`) **or** `entries:[{name,parentFolderId?}]`.
29. `move_to_folder` — req: none. `assetIds`(+`folderId?`) **or** `entries:[{assetIds,folderId?}]`.
30. `rename_media` — req: none. `mediaRef`+`name` **or** `entries:[{mediaRef,name}]`.
31. `rename_folder` — req: none. `folderId`+`name` **or** `entries:[{folderId,name}]`.
32. `delete_media` — req: `assetIds`. Removes referencing clips in same undo step.
33. `delete_folder` — req: `folderIds`. Deletes contents recursively.

**Project / misc (4)**
34. `export_project` — req: none. Args: `mode?(video|xml|fcpxml|palmier, default video),
    codec?(H.264|H.265|ProRes), resolution?(720p|1080p|2K|4K|Match Timeline), outputPath?, overwrite?
    (default true)`. video renders async (returns `status=started`); xml/fcpxml/palmier finish inline.
35. `set_project_settings` — req: none. Args: `fps?, width?, height?, aspectRatio?(16:9|9:16|1:1|4:3|
    2.4:1|9:14), quality?(720p|1080p|2K|4K)`. (aspectRatio ⟂ width/height.) Re-fits clips; rescales on fps change.
36. `list_models` — req: none. Args: `type?(video|image|audio|upscale)`. Returns `{models, loaded}`.
    Stub: `{"models":[], "loaded":false}`.
37. `send_feedback` — req: `category(missing_capability|wrong_result|confusing_ux|failure|suggestion),
    summary`. Args: `details?, severity?(low|medium|high)`. Sends with no confirmation; paraphrase only.

**Generation (4) — STUB (see §10)**
38. `generate_video` — req: `prompt`.
39. `generate_image` — req: `prompt`.
40. `generate_audio` — req: none.
41. `upscale_media` — req: `mediaRef`.

> `read_skill` (req: `id`) is defined but **in-app agent only** — not in `all`, not on MCP.

### 9.2 Tool result shape
`ToolResult` → MCP result (`ToolResult.swift`, `ToolExecutor.execute`). `.ok(text)` /
`.error(text)`. Errors are thrown as `ToolError(message)` and surfaced as the result text.

### 9.3 Shared schema bundles
- `textBoxTransformProperties`: `centerX, centerY, width, height` (all "0-1 …", number).
- `textStyleProperties`: `fontName, fontSize, isBold, isItalic, color(hex), alignment(left|center|right),
  borderColor(hex), backgroundColor(hex)`.

### 9.4 VideoLayout (`Models/VideoLayout.swift`) — layout → slots (rect x,y,w,h; z)
- `full` — main(0,0,1,1)
- `side_by_side` — left(0,0,.5,1), right(.5,0,.5,1)
- `top_bottom` — top(0,0,1,.5), bottom(0,.5,1,.5)
- `pip_bottom_right|pip_bottom_left|pip_top_right|pip_top_left` — main(0,0,1,1,z0) + inset(.28×.28,
  margin .035, z1)
- `grid_2x2` — top_left/top_right/bottom_left/bottom_right (quadrants)
- `main_sidebar` — main(0,0,.7,1), sidebar(.7,0,.3,1)
- `three_up` — left/center/right (thirds)
- `LayoutFit`: `fill` (cover+crop) | `fit` (letterbox).

---

## 10. Generation stub behavior (phase-1 mandate)

`canGenerate` (in `get_timeline` output, `ToolExecutor+Timeline.swift:56`):
```
canGenerate = AccountService.isSignedIn && AccountService.hasCredits
```
The Windows port has no cloud account ⇒ **`canGenerate` is always `false`**. Register the 4 generation
tools and `list_models`, but:
- `generate_video` / `generate_image` (`ToolExecutor+Generate.swift:6`) → error
  **"Generation requires signing in to Palmier. Tell the user to sign in."**
- `generate_audio` (`:198`) / `upscale_media` (`:320`) → same signed-out error
  (upscale: "Upscale requires signing in to Palmier. Tell the user to sign in.").
- `list_models` → `{"models":[], "loaded":false}` (signed-out shape, `:391`).
- MCP resources `palmier://models/{video,image}` → `[]`.

**No fabricated clips, models, or transcripts.** A capability that isn't built returns a clear,
structured "not available in this build" — never a silent wrong result.

---

## 11. Phase-1 deferred capabilities (register, return "unavailable")

These tools depend on on-device transcription / semantic search / audio cross-correlation, stubbed
in phase 1 (`Transcription/*`, `Search/*`, `Audio/*`): `get_transcript`, `add_captions`,
`search_media`, `remove_words`, `sync_audio`, and the transcription path of `inspect_media`.
Register them; return a clear "transcription/search unavailable in this build" result. **Do not fake
transcripts.** (Optional: wire `whisper.cpp` if time permits — cleanest single add.)

---

## 12. Enum quick-reference

- `ClipType`: `video | audio | image | text | lottie`. `isVisual` = video/image/text/lottie.
  `isCompatible(a,b)` = `a==b || (a.isVisual && b.isVisual)`.
- **File-extension → type** (`ClipType(fileExtension:)`):
  - video: `mov, mp4, m4v`
  - audio: `mp3, wav, aac, m4a, aiff, aif, aifc, flac`
  - image: `png, jpg, jpeg, tiff, heic, webp`
  - lottie: `json, lottie`
  - (note: `import_media` accepts a narrower set — no webp, no lottie — and requires transcodes externally.)
- `Interpolation`: `linear | hold | smooth`. `BlendMode`: §5. `LayoutFit`: `fill | fit`.
- Export modes: `video` (H.264/H.265/ProRes), `xml` (XMEML→Premiere), `fcpxml` (→Resolve/FCP),
  `palmier` (package).

---

## 13. SwiftPM deps → Windows fate (from `Package.swift`)

| Dependency | Purpose | Windows plan |
|---|---|---|
| `modelcontextprotocol/swift-sdk` | MCP server | `@modelcontextprotocol/sdk` (TS) |
| `Sparkle` | auto-update | drop (Tauri updater later) |
| `sentry-cocoa` | crash reporting | optional / drop |
| `clerk-ios`, `clerk-convex-swift`, `convex-swift` | cloud-gen auth | drop (generation stubbed) |
| `swift-transformers` (Tokenizers) | on-device search/transcription | stub phase 1 (whisper.cpp later) |
| `lottie-ios` | Lottie | `lottie-web` |

---

## 14. Open items to verify before/while building (Stage A–B)

1. Get a real macOS-saved `.palmier` to use as the round-trip golden file (none in-repo yet; check
   `palmier-pro-main/` sample-project resources or generate from a macOS build).
2. Confirm exact `get_timeline` output dict shape (the default-omitting representation) by reading
   `ToolExecutor+Timeline.swift` in full — needed for the MCP gate, separate from project.json.
3. Confirm `ToolResult.toMCPResult()` structure (text content blocks, isError flag) from `ToolResult.swift`.
4. Confirm `GenerationLog` schema (`generation-log.json`) — preserve-only, but document it.
5. Cross-check `media.json` `Date` encoding (reference-date Double) against a real manifest.

---

*End of SPEC.md (step 1). Next gate per the brief: scaffold Tauri+React+TS + FFmpeg sidecar, port
the data model, and round-trip a macOS `.palmier` with a clean semantic `project.json` diff.*
