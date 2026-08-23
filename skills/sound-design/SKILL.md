---
name: Sound design
description: Audio as craft — VO/music/SFX level hierarchy, keyframed ducking, fades, beat-aware music entry/exit, silence as punctuation, platform loudness guidance.
---

# Sound design

Follow the `build-in-kaestral` house rule: all mixing happens ON the timeline via clip `volume`,
`set_keyframes` volume envelopes, and fades — the mix you hear in preview is the mix
`export_project` renders (speed-chained atempo, keyframed envelopes, and fades are all honored in
the export mixdown).

## The hierarchy (relative levels — set with `set_clip_properties` volume / `set_keyframes`)
Voice is king; everything else serves it.
- **VO / dialogue:** the reference — volume 1.0 (0 dB relative).
- **Music under VO:** 0.15–0.30 (≈ −16 to −10 dB under voice). Lyrical music under spoken words:
  lower still, or instrumental instead — two word-streams fight.
- **Music alone** (no VO section): 0.6–0.9 — let it own the moment.
- **SFX accents:** 0.4–0.7, mixed to be FELT at the cut, not noticed as a sound.
Honesty: Kaestral has **no loudness meter (LUFS) tool**. The numbers above are relative gains that
produce a correct HIERARCHY; platform loudness normalization (most target ≈ −14 LUFS integrated)
will level the final anyway. Say this if a user asks for exact LUFS delivery — offer XMEML/FCPXML
export for a metered finishing pass in a DAW/NLE instead of pretending to measure.

## Ducking (music dips under speech)
Keyframe the MUSIC clip's volume, not the VO:
`set_keyframes(clipId=music, property:"volume", keyframes: [[voStart−12, 0.7],[voStart, 0.22],
[voEnd, 0.22],[voEnd+18, 0.7]])` — a 12-frame dive, an 18-frame recovery (recover slower than you
duck; fast recovery pumps). Duck per speech REGION (from `get_transcript` timings), not per word.

## Fades & transitions
- Music in/out: 12–30 frame volume ramps via keyframes (`[[start,0],[start+24,0.7]]`); never hard
  chop a music tail mid-phrase — end it on a musical boundary (see next section).
- Crossing two music tracks: overlap 1–2s, keyframe one down while the other rises.
- Audio under a video whip/glitch transition: a 2–4 frame dip to ~0.5 on the cut sells impact.

## Beat-aware entry/exit (`analyze_audio` first, always)
- Bring music IN on a downbeat aligned to a visual moment — place the clip so a detected beat
  frame lands exactly on the cut (`beat-sync-cutting` owns the cutting side).
- Take music OUT on a phrase boundary (beats cluster in 4s/8s groups — exit on a group boundary),
  or duck it to 0.1 under the final CTA line and end it with the video.
- The drop: if the track has an energy rise (visible in the beat/energy data), put the reveal ON it.

## Silence as punctuation
Total silence is the loudest thing available — spend it:
- 8–15 frames of everything-out right BEFORE the key claim makes the claim land twice as hard
  (keyframe music to 0, cut SFX; the pause survives `talking-head-cleanup` as the ONE kept pause).
- After a punchline: 10–20 frames of music-only (no VO) is the comedic beat.
- Never more than one engineered silence per 30s — repetition kills the device.

## SFX placement (when the user has SFX assets)
`import_media` the file, `add_clips` on an audio track at the exact frame, volume 0.4–0.7:
- Whooshes: START 3–5 frames BEFORE the cut they accent, peak on it.
- Impacts/pops: ON the frame of the text pop / punch-in (`add_texts` popIn moment).
- UI ticks: on counter/typewriter moments, sparse — every caption ticking is noise.
Kaestral bundles no SFX library (roadmap item); use the user's assets or skip — never fake it.

## Order of the audio pass (after picture lock)
1. Level VO to 1.0 across clips (normalize loud/quiet takes against each other by ear/waveform).
2. Music in, entry/exit on musical boundaries, base level per hierarchy.
3. Ducking keyframes per speech region.
4. SFX accents. 5. Engineered silence (one, at the key moment). 6. Preview the full mix; export.

## Failure modes
- **Music at "sounds fine solo" level** — always judge WITH the VO playing; solo music lies.
- **Ducking every word** — pumping. Duck regions.
- **Symmetric duck ramps** — equal-speed dive and recovery reads mechanical; recover slower.
- **Lyrics under speech** — two language streams, both lose.
- **Claiming LUFS compliance** — no meter exists here; state the honest path.
