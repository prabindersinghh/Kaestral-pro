---
name: Transition craft
description: When each transition is right and wrong, overlap tuning, beat-snapping — and the restraint rule that most cuts should be cuts.
---

# Transition craft

Follow the `build-in-kaestral` house rule. Transitions exist in two places: BETWEEN beats of a
`compose_motion` film (`transitionOut` on a beat) and between timeline clips (where the honest
default is a straight cut — see "On the timeline" below). The governing law from `art-direction`:
**a transition is an event, and most moments don't deserve an event. Most cuts should be cuts.**

## The seven (compose_motion `transitionOut.kind`) — right and wrong
| Kind | Right when | Wrong when |
|---|---|---|
| `cut` | The DEFAULT. Ideas change cleanly; rhythm is carried by content | Almost never wrong |
| `dissolve` | Time passing, mood shift between two CALM beats | Between high-energy beats (reads as hesitation) |
| `wipe` | A deliberate, structured reveal (spatial "next panel" feel) | More than once per film — it's conspicuous |
| `push` | Sequential/spatial narrative ("and then"), list progression | Emotional moments — push is mechanical by nature |
| `whip` | ONE energy spike: the punchline, the beat drop, the reveal (`shot-recipes` "Whip cut") | As the house transition — a film that whips every beat reads frantic |
| `glitch` | Tech/breaking/disruption connotation, once | Anything warm, human, premium-calm |
| `rgbSplit` | A stylized micro-jolt in an energetic tech piece | Twice. It's the most conspicuous of the seven |
Pick ONE statement transition per film (whip OR glitch OR rgbSplit) + dissolves/cuts everywhere
else. Two statement languages in one film compete (`art-direction` §6 restraint budget).

## Overlap tuning (`transitionOut.overlapFrames`)
The overlap is where craft lives — it's how long both beats coexist:
- **Dissolve:** 12–18 frames reads intentional; 4–6 reads like a rendering mistake; 30+ turns into
  a double exposure with its own meaning (use only if you MEAN that).
- **Push/wipe:** 8–14 frames — spatial moves want to be brisk.
- **Whip/glitch/rgbSplit:** keep short, 6–10 frames — the effect IS the event; long versions smear.
- Rule of thumb: the calmer the transition, the longer it may overlap.

## Beat-snapping
With music: `analyze_audio` → put beat frames in `meta.beatMarkers`, set
`transitionOut.snapToBeat: true` (and `enter.snapToBeat` on hero layers) — the transition LANDS on
the beat instead of near it. A snapped cut at the drop, with the audio dip from `sound-design`
§transitions, is the single most "expensive-feeling" move available. Reference-timed films:
`match_motion` gives you the reference's beat boundaries to snap to instead.

## On the timeline (footage-to-footage)
Timeline clip changes have no transition effect surface — and that's the correct default: straight
cuts, placed on beats (`beat-sync-cutting`), read as confident. What you CAN craft:
- The J-feel: let music/SFX shift a few frames before the visual cut (`sound-design` §fades).
- The punch-cut: cut to a 1.08–1.12 scaled framing of the same subject (`set_clip_properties`) —
  the jump-cut idiom.
- A dissolve/whip BETWEEN footage sections when truly needed: build it as a short `compose_motion`
  bridge beat (video elements inside the spec) — honest, but reach for it rarely.

## Worked example
A 4-beat launch film, music with a drop at beat 3: beats 1→2 `dissolve` overlap 14 (calm setup) ·
2→3 `whip` overlap 8, `snapToBeat: true` — the drop hits WITH the whip into the product reveal ·
3→4 `cut` (the reveal's confidence needs no decoration). One statement transition, placed where
the film's energy actually spikes.

## Failure modes
- **Transition-as-decoration** — chosen because it exists, not because the moment turns. Cut instead.
- **Uniform overlaps** — every transition at the same length reads templated; tune per kind.
- **Two statement languages** — whip AND glitch in one film compete for the same slot.
- **Snapping nothing** — music present but markers unset; "close to the beat" is visibly not ON it.
