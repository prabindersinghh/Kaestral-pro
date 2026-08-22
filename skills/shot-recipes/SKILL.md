# Shot recipes — a compositional grammar for `compose_motion`

A library of NAMED SHOTS you compose films from. `art-direction` teaches the *principles* (read it
first — its restraint budget governs everything here); this skill gives you the *vocabulary*: each
recipe is a proven shot shape with its purpose, energy level, typical duration, and the exact
SceneSpec fields that build it. Compose by picking shots that serve the brief's arc — never by
stacking shots because they exist.

**How to use:** pick 1 shot per beat (a beat = one idea). Sequence low→high→resolve energy across
the film. Reuse ONE entrance language and ONE accent per film (art-direction §6). Every field below
is real, validated SceneSpec — no invention needed.

Durations assume 30fps. Energy: ▁ calm · ▂ medium · ▃ high.

---

## 1. Openers & hooks

**Cold-open claim** ▂ · 45–70f — One display line, nothing else. The thesis.
`layers:[{element:"text",props:{text},style:{role:"display",size:0.09},enter:{anim:"spring"}}]`,
`background:{kind:"glow",accent:"#<brand>"}`. The default spring rise IS the house opener — don't decorate it.

**Blur push-up hook** ▃ · 40–60f — Punchier opener for short-form; per-word stagger built in.
`enter:{anim:"blurPushUp"}` on a display text. Pair with `meta.handheld:true` for the alive feel.
Use INSTEAD of Cold-open when the film is 9:16 social — never both opener languages in one film.

**Typewriter terminal** ▁ · 60–90f — Dev-product opener; text arrives as if typed.
`enter:{anim:"typewriter"}` + `style:{font:"mono"}` + `background:{kind:"grid",accent:"#<brand>"}`. Calm by design —
don't add camera movement on top; the typing IS the motion.

**Countdown stinger** ▃ · 40–56f — 3-2-1 punch-in before a reveal.
`{element:"countdown",props:{from:3,stepFrames:14},enter:{anim:"fade",delay:0}}`. Follow with your
highest-energy beat — a countdown that resolves into something calm reads as a broken promise.

**Iris reveal** ▂ · 50–70f — Content discovered through an opening circle.
`enter:{anim:"maskReveal"}` (default iris) or `mask:{shape:"circle",reveal:"iris"}` on the hero
layer. Good first-look at product UI; don't reuse later in the film (a reveal only works once).

## 2. Product & UI shots

**Hero screenshot rise** ▂ · 60–90f — The product, presented.
`{element:"screenMock",props:{src},enter:{anim:"spring"}}` — its built-in translateY+scale settle is
the shot. Add `liveBreathe:true` ONLY if the beat holds >70f (art-direction: idle needs hold time).
`props.frame` picks the device: `"browser"` (default, traffic-lights + URL bar via `props.url`),
`"phone"` (phone body + dynamic-island pill — the right frame for app screenshots in 9:16 films),
or `"plain"` (bare card).

**Card edge-flip** ▃ · 50–70f — A card object flips in with 3D perspective.
`enter:{anim:"edgeFlip"}` on screenMock/image/shape; pair `exit:{anim:"edgeFlip",at}` for the
matching flip-out. Treat as an OBJECT shot — never on display type.

**Sheened product card** ▂ · 70–100f — A held card with a specular sweep selling finish quality.
screenMock + `shineSweep:true` + `meta.palette` set to brand. One sheen per film.

**Split compare** ▂ · 70–100f — Before/after or A-vs-B.
`{element:"splitLayout",props:{direction:"row",panels:[{element:"image",props:{src}},{element:"image",props:{src}}]}}`.
The staggered panel entrance is built in; add ONE text layer above naming the winner, nothing else.

**Feature filmstrip** ▂ · 80–110f — 3–4 cells scanning a feature set.
`{element:"gridLayout",props:{kind:"filmstrip",cells:[…]}}` (or default 2×2 grid for 4 items).
Cells stagger themselves; do not also stagger with per-layer delays.

**Ken Burns still** ▁ · 70–110f — A photograph made cinematic.
`{element:"image",props:{src},kenBurns:{move:"push",amount:0.5}}`. The slowest shot in the grammar —
use it to breathe between high-energy beats.

## 3. Data & proof shots

**Counter proof** ▂ · 50–80f — One number does the arguing.
`{element:"counter",props:{to:12000,label:"renders/day"}}` with a `hairline` accent under it.
One counter per film; two numbers = a chart, not two counters.

**Chart reveal** ▂ · 70–100f — Trend as narrative.
`{element:"lineChart"|"areaChart"|"barChart",props:{…},enter:{anim:"draw"}}`. Title the beat with a
small text layer positioned OFF the chart's ink (position by eye, art-direction §4).

**Annotated evidence** ▂ · 70–100f — Point at the thing that matters.
Hero layer + `{element:"arrow"|"pointerLine",props:{…},enter:{anim:"draw",delay:12}}` +
`highlightBox` around the target region. The delay ORDERS the reading: subject first, then pointer.

**Spotlight focus** ▂ · 60–90f — Dim everything except the point.
`{element:"spotlightDim",props:{…}}` above the hero layer. Combines well with Annotated evidence;
never with a busy background (`kind:"solid"` under it).

## 4. Emphasis & accents

**Strikethrough correction** ▃ · 45–70f — The old way, crossed out.
Text of the old claim + `{element:"strikethrough",props:{…},enter:{anim:"draw",delay:14}}`, then the
new claim enters below. THE single-use accent — once per film, ever.

**Hairline underline** ▁ · any — The house accent: a thin gold rule drawn under a key line.
`{element:"hairline",enter:{anim:"draw"}}`, anchored left with the text. Cheap, elegant, reusable.

**Word-stagger emphasis** ▂ · 50–80f — Each word lands on its own spring.
`enter:{anim:"wordStagger"}` for a 3–6 word line where per-word rhythm IS the message. Longer lines
→ `wordReveal` (flat, faster) instead.

**Kinetic slam** ▃ · 30–50f — One word, oversized, overshooting in.
`enter:{anim:"kinetic"}` + `style:{size:0.14+}`. The loudest text entrance — earn it, once.

## 5. Rhythm & transitions

**Whip cut** ▃ — Energy-spike beat change: `transitionOut:{kind:"whip"}`. On the beat drop or the
punchline only; a film that whips every beat reads frantic (art-direction §10.5).

**Glitch tear** ▃ — `transitionOut:{kind:"glitch"}` or exit a layer with `exit:{anim:"glitch"}`.
Tech/breaking connotation. Whip and glitch are the same energy slot — pick one language per film.

**Soft dissolve chain** ▁ — `transitionOut:{kind:"dissolve",overlapFrames:12–18}` between calm
beats. The overlap is the craft: 12f reads intentional, 4f reads like a mistake.

**Beat-locked cuts** ▂ — Get real beats first (`analyze_audio` on the score, or `detect_scenes` /
`match_motion` on a reference), put them in `meta.beatMarkers`, set `transitionOut.snapToBeat:true`
and entrance `snapToBeat` on hero layers. This is how a film feels *cut to music* rather than near it.

## 6. Atmosphere

**Ambient orbs field** ▁ — `background:{kind:"orbs",accent:"#<brand>"}` + `meta.palette` — soft, colorful, modern. (`accent` is REQUIRED on every background.)
**Engineer's grid** ▁ — `background:{kind:"grid",accent:"#<brand>"}` — technical, precise. Pairs with mono type.
**Glow stage** ▁ — `background:{kind:"glow",accent}` — the default premium stage for display type.
Pick ONE background language per film (art-direction §10.5). `meta.handheld:true` adds the living-
camera idle over everything — default ON for 9:16 social, OFF for corporate 16:9.

## 7. Closers

**Logo resolve** ▁ · 60–90f — `{element:"logo"}` (or brand image) entering on the house spring,
`background:{kind:"glow",accent:"#<brand>"}`, beat `outFade` authored so the film ENDS rather than stops.
**CTA hold** ▁ · 70–110f — One imperative line + one `hairline`, held: `hold:{startFrame,durationFrames}`
keeps it perfectly still for the read. The stillness is the shot.

---

## Composition patterns (shots → film)

- **Launch (16:9, ~20s):** Cold-open claim → Hero screenshot rise → Annotated evidence →
  Counter proof → Logo resolve. Dissolve chain throughout, ONE whip into the counter.
- **Social product short (9:16, ~12s):** Blur push-up hook → Card edge-flip → Split compare →
  CTA hold. `meta.handheld:true`, orbs, beat-locked cuts if there's a score.
- **Data story (~15s):** Cold-open claim → Chart reveal → Spotlight focus → Counter proof →
  CTA hold. Grid background, mono accents, zero whips.

Fit the reference, not the template: if the user gave a reference clip, `match_motion` +
`detect_scenes` give you its real beat lengths and cut rhythm — pour these shots into THAT timing.
