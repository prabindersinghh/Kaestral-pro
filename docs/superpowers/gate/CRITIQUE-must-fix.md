# Quality Gate — Binding Critique (Task 5 review, user verdict: NOT shippable)

The user watched the Task-5 launch film and rejected it: "It's pathetic. A slideshow — centered
text on a background, hard cuts, dead-still frames, zero atmosphere." The pipeline/brand are fine;
the CREATIVE OUTPUT fails. Every point below is a BINDING requirement the generative engine must
satisfy before Task 10. **This output IS the product.**

## The 8 must-fixes (drive Tasks 6–9)

1. **No hard cuts.** Every beat transitions with intent: masked reveals (next beat revealed through a
   shape from the previous), wipes, dissolves, glitch stingers. Elements CARRY ACROSS beats and
   transform — they don't disappear and reappear. → Task 6 (transitions) + Task 9 (mask reveals) +
   interpreter must support cross-beat continuity.
2. **Stop centering everything.** Compose the frame: off-center anchors, rule of thirds, asymmetry,
   layered depth with blur behind. "Text in the middle" every beat = stacking, not designing. →
   authored specs use varied positions; interpreter honors position/depth/blur (already does) — the
   SPECS and defaults must exploit it.
3. **Camera on every beat.** Slow push-in minimum; rack-focus between layers; parallax backgrounds.
   The frame must NEVER be dead still. → Task 6 Camera primitive (real, not the minimal inline one).
4. **Atmosphere everywhere.** Drifting particles/constellation, pulsing glow bloom, drifting grid,
   lighting sweeps across surfaces. This is premium-vs-PowerPoint. → Task 6 (Particles) + Task 9
   (LightingSweep) + backgrounds must animate by default.
5. **Motion blur + weight/physics.** Fast elements blur and trail. Nothing moves linearly —
   everything overshoots, settles, has spring physics. → Task 9 (MotionBlur/Trails); all entrances
   use spring/overshoot easing, never linear.
6. **Kinetic typography.** Varied scales, arcs, emphasis words in green/gold, landing as a
   composition — not a monospace line centered. → Task 9 (TextOnPath/kinetic) + richer Text modes.
7. **SHOW THE PRODUCT.** HeroDemo felt alive via the command bar typing, the timeline filling, the
   playhead sweeping. Use ScreenMock/Video/Timeline/Waveform so the film shows Kaestral WORKING, not
   words about it. → Task 7 (Timeline/Waveform) + Task 8 (ScreenMock/Video) + gate specs must use them.
8. **Rhythm / beat-sync.** Cuts, entrances, transitions on a beat grid so the film has a pulse. →
   meta.beatMarkers + snapToBeat wired through interpreter + gate specs supply a beat grid.

## Task 10 pass bar (hard)
- If a stranger CAN'T tell whether a human motion designer made it → PASS.
- If it looks like an AI stacked text on a background → FAIL.
- `fallback: true` on any of the three films = automatic FAIL.
- **Controller self-gate:** do NOT show the user the three films until they genuinely impress the
  controller first. "This is okay" = keep working.

## Films required at Task 10
SaaS product demo · data-story · launch film — all agent-authored SceneSpecs, all `engine:"generative"`.
