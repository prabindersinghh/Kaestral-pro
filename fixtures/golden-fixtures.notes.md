# Golden fixtures — field → source mapping

**Status: provisional-but-spec-authoritative.** Hand-authored from the Swift `Models/*` structs
(not from our writer), so the Stage-A round-trip test against it is a *real* gate, not a self-check.
If a genuine Palmier-authored `.palmier` is later obtained, diff it against these files, reconcile any
surprise (especially `MediaSource` shape and `Date` encoding), and promote it.

Every value below is traceable to a line in `palmier-pro-main/Sources/PalmierPro/`. JSON has no
comments, so the mapping lives here. Encode/serialization rule under test (SPEC §0.2): **every
non-optional field is always written; optionals are omitted only when nil.** Key order follows the
Swift `CodingKeys` / property declaration order for fidelity (acceptance is semantic, not byte-exact).

Dates are **intentionally excluded** from both fixtures (no `cachedRemoteURLExpiresAt`, no
`importInput.createdAt`, no `GenerationLog`) until a real file pins the `.deferredToDate`
(seconds-since-2001 Double) encoding — see SPEC §1.1 / §7.

---

## golden-project.json — `Timeline` (`Models/Timeline.swift`)

### Timeline root (`Timeline.swift:9`) — all 4 scalars are non-optional ⇒ always written
| field | fixture value | source default | note |
|---|---|---|---|
| `fps` | 24 | 30 (`:10`) | non-default |
| `width` | 1080 | 1920 (`:11`) | non-default (vertical) |
| `height` | 1920 | 1080 (`:12`) | non-default |
| `settingsConfigured` | true | false (`:13`) | non-default |
| `tracks` | [video, audio, text] | [] (`:14`) | 3 track types covered |
| *(omitted)* `totalFrames` | — | computed (`:16`) | **not serialized** |

### Track (`Timeline.swift:25`; CodingKeys `:56` = id,type,muted,hidden,syncLocked,clips)
- `track-video-0`: `hidden:true` (default false `:29`), `syncLocked:false` (default **true** `:30`).
- `track-audio-1`: `muted:true` (default false `:28`), `syncLocked:true` (default).
- `track-text-2`: type `text`, all flags default — proves defaults are still written.
- `displayHeight` (`:34`) is **excluded from CodingKeys** ⇒ never serialized. Absent from fixture.

### Clip (`Timeline.swift:75`; CodingKeys `:116`) — non-optionals (id…crop) always; optionals omit-if-nil
**`clip-video-1`** — exercises the full non-optional set + most optionals:
| field | value | default | source |
|---|---|---|---|
| `mediaType` | video | `.video` | `:78` |
| `sourceClipType` | video | `.video` | `:80` |
| `trimStartFrame`/`trimEndFrame` | 12 / 6 | 0 / 0 | `:83-84` (source offsets in **project frames**) |
| `speed` | 1.5 | 1.0 | `:85` (≠1 required by lead) |
| `volume` | 0.8 | 1.0 | `:86` |
| `fadeInFrames`/`fadeOutFrames` | 6 / 4 | 0 / 0 | `:87-88` |
| `fadeInInterpolation` | smooth | `.linear` | `:89` (fade default is linear) |
| `fadeOutInterpolation` | hold | `.linear` | `:90` |
| `opacity` | 0.9 | 1.0 | `:91` |
| `transform` | non-identity | `Transform()` | `:92` — see below |
| `crop` | {.05,.1,.05,0} | identity | `:93` |
| `linkGroupId` | "link-1" | nil | `:94` (optional, present) |
| `opacityTrack` | 2 kf | nil | `:104` |
| `positionTrack` | 2 kf (top-left a,b) | nil | `:105` |
| `scaleTrack` | 2 kf (norm w,h a,b) | nil | `:106` |
| `rotationTrack` | 2 kf (deg) | nil | `:107` |
| `cropTrack` | 1 kf | nil | `:108` |
| `volumeTrack` | 2 kf, **dB** (0, −6) | nil | `:109` (values are dB — `volumeAt` `:197`) |
| `effects` | exposure + lut | nil | `:111` |
| `blendMode` | screen | nil (normal) | `:114` |
| *(omitted, nil)* captionGroupId, textContent, textStyle, textAnimation, wordTimings | — | nil | proves omit-if-nil |

**`clip-audio-1`** — the "all non-optionals at default still written" proof:
- `mediaType:audio` but `sourceClipType:video` (derived/split-out audio — `sourceClipType` ≠ `mediaType`, `:80`).
- `volume:1`, `opacity:1`, identity `transform`/`crop`, `fade*:0`, `*Interpolation:linear` — **all present despite being defaults**.
- only optional present: `linkGroupId:"link-1"` (links to the video → l-cut/j-cut partner).

**`clip-text-1`** — text/caption coverage:
- `mediaRef:"text-1"` (synthetic; text clips have no media-library asset → no `media.json` entry).
- `captionGroupId:"caption-grp-1"` (`:95`), `textContent` with `\n` (`:98`).
- `textStyle`, `textAnimation` (with `highlight`), `wordTimings` (`:99-101`).

### Transform (`Timeline.swift:388`) — ⚠️ **custom encoder (`:468`) always writes all 7**
`centerX,centerY,width,height,rotation,flipHorizontal,flipVertical`. Defaults
0.5/0.5/1/1/0/false/false (`:389-395`). `clip-video-1` uses non-identity (rotation 30, flipH true);
`clip-audio-1`/`clip-text-1` use values that include defaults to prove all 7 always appear.

### Crop (`Timeline.swift:525`) — synthesized, all 4 always
`left,top,right,bottom`, default 0 (`:526-529`).

### Keyframe / KeyframeTrack (`Models/Keyframe.swift`)
- `Keyframe` = `{frame, value, interpolationOut}` (`:7`). **`interpolationOut` default `.smooth`** (`:10`)
  and is **always encoded** — every kf in the fixture carries it explicitly (mix of smooth/linear).
- Frames are **clip-relative** (0 = clip start) — `:99` `toOffset`.
- `KeyframeTrack` = `{keyframes:[…]}` (`:13`). `AnimPair` = `{a,b}` (`:53`): position a=topLeftX b=topLeftY;
  scale a=normWidth b=normHeight.
- `Interpolation` raw values: `linear|hold|smooth` (`:3`).

### Effect / EffectParam (`Models/Effect.swift`)
- `Effect` = `{id,type,enabled,params}` (`:4`); `enabled` default true (`:7`), always written; `params` `{}` if empty.
- `EffectParam` = `{value?,string?,track?}` (`:34`) — all optional, omit-if-nil. Fixture: `ev.value`,
  `intensity.value`, and `path.string` (LUT path string param). Effect type ids from `EffectRegistry`
  (`color.exposure`, `color.lut` — SPEC §5).

### TextStyle (`Models/TextStyle.swift:5`; CodingKeys `:48` = 10 fields)
`fontName,fontSize,fontScale,isBold,isItalic,color,alignment,shadow,background,border`.
Defaults: "Helvetica-Bold"/96/1.0/true/false/RGBA(1,1,1,1)/center/Shadow()/Fill(off)/Fill(off)
(`:8-17`). Fixture overrides fontName/fontSize and enables `background`+`border` Fills.
`RGBA` = `{r,g,b,a}` (`:25`). `Shadow` = `{enabled,color,offsetX,offsetY,blur}` defaults
true/RGBA(0,0,0,.6)/0/−2/6 (`:32-39`). `Fill` = `{enabled,color}` (`:43`).

### TextAnimation (`Models/TextAnimation.swift:9`; CodingKeys `:62` = preset,perWordFrames,highlight)
`preset` default `.none` (`:10`), `perWordFrames` default 6 (`:11`), `highlight` optional (omit-if-nil).
Fixture: `wordReveal` / 5 / RGBA(1,.85,0,1) (matches `defaultHighlight` `:60`).
`WordTiming` = `{text,startFrame,endFrame}` (`:3`), clip-relative frames.

### BlendMode (`Models/BlendMode.swift:4`)
Raw values incl. `screen`. nil = normal/source-over; fixture sets `screen` on the video clip.

---

## golden-media.json — `MediaManifest` (`Models/MediaManifest.swift`)

### MediaManifest (`:3`; custom decoder `:8`)
`version` default 2 on encode (`:4`; decode falls back to 1 if absent). `entries`/`folders` always
written (`[]` if empty). Fixture: version 2, 2 entries, 1 folder.

### MediaManifestEntry (`:20`) — non-optionals id,name,type,source,duration always; rest omit-if-nil
- **`asset-ext-video`** — `source` = `{"external":{"absolutePath":"…"}}` (⚠️ Swift enum-with-assoc-value
  shape, `MediaSource.external` `:77`). Includes optional `sourceWidth/Height/FPS` + `hasAudio:true`.
- **`asset-proj-audio`** — `source` = `{"project":{"relativePath":"media/…"}}` (`MediaSource.project`
  `:78`); relative to package. Includes `hasAudio:false` + `folderId`.
- Omitted optionals (nil): generationInput, generationStatus, cachedRemoteURL*, importInput.

### MediaFolder (`Models/MediaFolder.swift:3`)
`{id,name,parentFolderId?}`. `folder-audio` has nil parent ⇒ `parentFolderId` omitted (top-level).

---

## What this fixture deliberately does NOT cover (verify against a real file later)
- `Date` fields (reference-date Double encoding).
- `generation-log.json` (`GenerationLog`) — preserve-only; documented separately.
- `lottie` clip/track type and the `MediaSource` for a `media/`-stored generated asset's metadata bag.
- Byte-exact key ordering and float formatting (out of scope — acceptance is semantic).
