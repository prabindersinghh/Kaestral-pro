---
name: Hook engineering
description: The first 1–3 seconds as a craft — hook taxonomy, finding or building one in real footage, cold-open restructuring, and open loops.
---

# Hook engineering

Follow the `build-in-kaestral` house rule. The hook is the 1–3 seconds that decide whether the
other 27 get watched. It is engineered, not found by luck — and it must be TRUE to the video: a
hook the body doesn't pay off trains viewers to never trust you again.

## The taxonomy (pick ONE per video)
1. **Curiosity gap** — name the payoff, withhold the mechanism: "The setting that doubled our
   render speed." Payoff must actually arrive (see Open loops).
2. **Bold claim** — a falsifiable, specific assertion: "Most captions are killing your retention."
   Specific beats grand: numbers, named things.
3. **Question** — only when the viewer would genuinely answer wrong: "Why does this cut feel
   expensive?" Rhetorical filler questions are anti-hooks.
4. **Pattern interrupt** — start mid-action or mid-sentence at the loudest visual/verbal moment;
   no greeting, no logo, no establishing shot.
5. **Problem** — the viewer's pain, named precisely in their words: "Your exports look washed out
   on Instagram."
6. **Transformation** — before→after in one beat: show the after FIRST, then "here's how."
7. **Contrarian** — invert a common belief: "Stop cutting on the beat." Must be defended in the body.
8. **Shocking data** — one number that reframes: "92% drop-off happens before second 3." Real
   numbers only; source it in the body.

## Finding the hook in existing footage
- `get_transcript` → scan for: numbers, superlatives, conflict words ("mistake", "never",
  "nobody"), completed one-liners. The best spoken hook is usually mid-recording, not at the top.
- `see_video` mode:"scene" → the strongest VISUAL moment (reaction, reveal, motion spike).
- The hook is spoken-line OR visual-moment OR an authored text line — often spoken + text together.

## Building it (the cold-open restructure)
1. `split_clips` at the chosen moment's start and end.
2. `move_clips` that segment to frame 0 (or `ripple_delete_ranges` the weak lead-in instead —
   deleting a slow intro is the single most reliable hook improvement).
3. Text hook on top: `add_texts`, 3–7 words, top third (`centerY ≈ 0.2`), 90–120px bold, boxed or
   heavy outline (`caption-styles`), on screen 1.5–2.5s, `animation:"popIn"` or `wordPop`.
4. Energy punch: scale 1.0→1.06 over the first 8–12 frames via `set_keyframes` on scale — or open
   ON a beat using `analyze_audio` + `beat-sync-cutting`.
5. Captions from word one (`add_captions`) — a mute-autoplay feed hook without captions is silent.

## Open loops (rewatch + completion value)
- Open a second, smaller loop inside the hook ("…and the third one saved the project") and resolve
  it in the FINAL beat — completion-seeking carries viewers to the end.
- Loop-friendly ending: cut the last frames so the end flows visually into the opening frame
  (`retention-editing` §endings); on loop, the hook re-hooks.
- Ledger rule: every promise made in the hook gets a visible payoff moment — list promises, check
  them against the body before export.

## Worked example
Raw: 60s talking head that starts "Hey guys, so today…". Transcript shows at 0:38: "we cut our
export time from nine minutes to ninety seconds." That's the hook (transformation + data).
Build: split 0:38–0:41 → `move_clips` to 0 → text hook "9 min → 90 sec" (popIn, top third) →
body continues from the original top minus the greeting (`ripple_delete_ranges` 0:00–0:04) →
captions on. First 3 seconds now: the claim, the number on screen, the voice mid-energy.

## Failure modes
- **The clickbait gap** — hook promises what the body never pays. Kills channels, not just videos.
- **Greeting tax** — any "hey guys, welcome back" before the hook. Delete every time.
- **Two hooks** — a claim AND a question AND a number in 3s reads as noise. One device.
- **Hook text ≠ spoken content** — text says one thing while VO says another; viewer reads OR
  listens, choose the same message for both.
- **Slow burn defense** ("it gets good at 0:40") — then 0:40 IS the video. Cold-open it.
