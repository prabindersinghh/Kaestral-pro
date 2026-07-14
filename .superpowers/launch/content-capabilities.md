# Capabilities / Tool Surface — full content (for a new #capabilities section)

Header idea: "50 MCP tools. Any LLM (Claude Code, Cursor, Codex) can drive every one."
Organized by category. Tool names must be VISIBLE (developers want to see the surface).
Mark Pro clearly as "coming". Emphasize PERCEPTION and MOTION GRAPHICS as the standout categories.

IMPORTANT (point 7): do NOT name "Palmier" anywhere. Where the source said "Palmier has none/zero of
this", reframe as "Traditional NLEs don't have this" or "Most editors can't do this" — a neutral
differentiator, no competitor/upstream name.

## 👁️ PERCEPTION — it sees, hears, and feels rhythm
| Tool | What it does |
|---|---|
| see_video | Extracts and returns real frames — the LLM watches your footage |
| get_transcript | Word-level transcription (local whisper), exact timestamps |
| analyze_audio | Beats, BPM, onsets, silence and pause detection |
| extract_palette | Dominant colors → brand-matched grading |
| inspect_media | Real ffprobe metadata — dimensions, fps, duration, audio |
| inspect_timeline | Structured read of the live timeline state |
| search_media | Semantic search across your library |

Callout: "Traditional NLEs have none of this. This is why Kaestral edits with judgment instead of guessing."

## ✂️ TIMELINE EDITING
Tools: get_timeline · add_clips · insert_clips · remove_clips · move_clips · split_clips · ripple_delete_ranges · set_clip_properties · set_keyframes · remove_tracks · sync_audio · undo
- Multi-track (video/audio/image/text/Lottie)
- Trim, split, ripple, razor, drag, snap
- Speed/retime, transforms, crop, opacity, blend modes
- Keyframe animation with easing lanes
- Linked A/V, sync-lock, full undo history

## 🗣️ WORD-LEVEL EDITING (the killer feature)
| Tool | What it does |
|---|---|
| remove_words | Surgically cut specific words — "remove every 'um'" |
| add_captions | Word-synced karaoke captions, styled and animated |
| add_texts / update_text | Full typography: font, size, weight, color, outline, background, alignment, animation presets |

## 🎨 MOTION GRAPHICS (traditional NLEs have zero of this)
| Tool | What it does |
|---|---|
| compose_motion | The art-direction surface. LLM authors bespoke films — beats, layers, per-property animation, bezier easing, hold-and-settle, optical placement, camera moves, transitions |
| generate_title | Fast animated title cards (canvas engine) |

Primitives available to the LLM: text (spring/typewriter/word-reveal/kinetic/karaoke) · shapes · hairlines · waveforms · animated timelines · logo marks · bar/line/area charts · counters · particles · glow fields · grids · masks & reveals · split/grid layouts · depth-of-field · motion blur · text-on-path · lighting sweeps · Ken Burns · countdown & glitch stingers · ScreenMock (browser chrome) · callouts (arrow, highlight box, pointer, spotlight-dim) · Video/Image compositing
Camera: push-in · pan · rack-focus · parallax
Transitions: wipe · dissolve · push · glitch · RGB-split · cut
Brand tokens: automatic on-palette output

## 🎛️ COLOR & EFFECTS
Tools: apply_color · apply_effect · inspect_color
Exposure · contrast · saturation · temperature · tint · lift/gamma/gain · curves · LUTs · blur · sharpen · stylize · blend modes

## 📐 LAYOUT
apply_layout — picture-in-picture · split-screen · grid · side-by-side, auto-composed

## 📁 MEDIA LIBRARY
import_media · import_from_url (paste a link → it pulls the video) · list_folders · create_folder · move_to_folder · rename_media · rename_folder · delete_media · delete_folder

## 📤 EXPORT
export_project — four modes:
- video → H.264 / H.265 / ProRes, 1080p or 4K
- xml → XMEML → Premiere Pro
- fcpxml → DaVinci Resolve / Final Cut
- kaestral → project package
Plus: SRT caption export

## 🧠 SKILLS (the craft layer)
Tools: list_skills · read_skill
Bundled playbooks the LLM auto-loads:
- art-direction — the master motion-designer playbook: decision process, optical composition, rhythm, restraint, trade-offs, worked examples, failure modes. This is what lets a cold LLM art-direct above hand-authored quality.
- viral-reel — hook → cut → punch-in → caption → grade
- beat-sync-cutting — cut to the music
- creative-director — palette, brand, typography
- caption-styles — word-pop, karaoke, bold-boxed, typewriter
- broll-planner — B-roll placement
- promo-ad — hook → beats → CTA
- platform-delivery — Reels / TikTok / Shorts / YouTube specs

## ⚙️ PROJECT
Tools: set_project_settings · export_project · list_models · send_feedback
Local .kaestral projects.

## 🔮 PRO — stubbed, waitlist open
Tools: generate_video · generate_image · generate_audio · upscale_media
Translation & dubbing (Hindi + regional Indian languages) · temporally-consistent upscaling · PixiJS shaders

## 🔒 EVERYTHING RUNS LOCAL
Local whisper · local rendering · local projects · your video never leaves your machine
