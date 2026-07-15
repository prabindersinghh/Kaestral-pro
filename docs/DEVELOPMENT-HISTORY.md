# Kaestral — Development History (consolidated)

The narrative record of the major initiatives, so any future developer or AI has the full context of
*what was built and why*. For the chronological build log see [PROGRESS.md](./PROGRESS.md) (historical);
for how the system fits together see [ARCHITECTURE.md](./ARCHITECTURE.md).

Kaestral began as a GPLv3 Windows port of an upstream macOS AI-native editor (see [NOTICE.md](../NOTICE.md)
for the required attribution) and grew a differentiated generative-motion surface and a full 1.0 launch.

---

## 1. The port foundation
The upstream Swift source was used as an executable specification to build a Windows-native editor:
Tauri 2 (Rust) + React 18 + TypeScript + Vite. Core delivered: the pure `EditEngine`, the `.kaestral`
project format round-trip, the MCP server mirroring the upstream tool contract, on-device perception
(whisper transcription, frame vision, beat/silence detection, palette extraction), a composited preview,
and interchange export (XMEML→Premiere, FCPXML→Resolve/FCP). The MCP server identity is `kaestral`; the
project format was later renamed `.palmier`→`.kaestral` (a clean pre-launch break).

## 2. Option D — the art-directed authoring surface (the strategic lock)
The decisive bet: **don't build intelligence into the engine; build the most capable hands any LLM can
drive.** Three components, each gated by a non-negotiable, controller-judged test:

**Component 1 — SceneSpec expressiveness (the "hands").** The `compose_motion` SceneSpec + the
`Generative.tsx` interpreter were expanded so everything a human could hand-author is expressible as
validated data (no code-exec): custom bezier easing, per-property `animate` tweens, explicit `hold`,
`enter.spring`/`durationFrames`, exit fades, `transitionOut.overlapFrames`, text `anchor`+`mono` font,
`wordStagger` per-word reveal, anchored+eased `hairline` draws, `camera.easing`, authorable beat
`outFade`, and `enter.pacing:"manual"` (opt out of the anti-smear entrance clamp). A fail-loud
conflict detector rejects a layer that drives the same property via both `animate` and `enter/exit`.
- **Gate (reproduce a hand-authored beat as a pure SceneSpec):** failed round 1 (text ran off-frame,
  no per-word stagger, centered rules), drove the expansion above, and **passed round 3** — the
  SceneSpec reproduced the reference beat frame-for-frame.

**Component 2 — the craft-transfer skill.** `skills/art-direction/SKILL.md` — a master motion-designer
playbook that auto-loads for any connected LLM (wired into the `compose_motion` description + server
instructions + `catalog.json`). It teaches *principles, the decision process, trade-offs, the physics
of premium motion, optical composition, rhythm, restraint, transition craft, conceptual ambition,
worked examples with reasoning exposed, and real failure modes* — so a cold LLM composes bespoke films,
not templates.
- **Cold-subagent gate (must BEAT hand-authored films):** a fresh LLM with only the skill + tool
  schema, zero steering, authored a launch film. First pass matched on craft but had a conventional
  concept; a `§1.5 conceptual ambition` section was added and the gate re-run — the new film made a
  metaphor *structural* (a motionless "watching" dot that vanishes as the film's one sharp spring
  fires) and **exceeded** the hand films on concept while matching on execution. Proof the craft
  transfers rather than being imitated.

**Component 3 — the tool-surface audit.** `docs/superpowers/TOOL-SURFACE-AUDIT.md`: all 50 tools classified
(deep / quick-win-applied / deeper-later / missing-tool). Description quick-wins were applied; the top
missing tools (a `render_frame` to read back a composited frame for LLM self-critique, legibility
measurement, composition versioning) were deferred to [FUTURE-IDEAS.md](../FUTURE-IDEAS.md).

## 3. The 1.0 launch wrap
Taking it from "works" to "shippable":
- **UI/UX polish:** first-run onboarding (Welcome → sample project → 3 example prompts → Connect AI),
  an unsaved-changes close guard, humanized errors (`src/ui/errors.ts` — never a stack trace to a user),
  empty-timeline + indeterminate export-progress states, a shortcuts cheat-sheet (+ deduped keyboard
  handlers), and tokenized visual polish.
- **Versioning + auto-update:** bumped to **1.0.0** across package.json / tauri.conf.json / Cargo.toml;
  wired the Tauri updater end-to-end (plugin, capability, config, `latest.json` template + generator,
  in-app About + "Check for updates"). The signing key is the one documented manual step
  ([UPDATER-SETUP.md](./UPDATER-SETUP.md)).
- **MCP official-quality:** added the **stdio transport** so `claude mcp add kaestral -- npx kaestral`
  works as one zero-config command (HTTP kept as `npx kaestral --http`); reconciled the tool count to
  50; wrote [MCP-TOOLS.md](./MCP-TOOLS.md) + registry-submission prep ([MCP-REGISTRY.md](./MCP-REGISTRY.md)).
- **The 1.0.0 installer** (`Kaestral_1.0.0_x64-setup.exe`) built cleanly; full suite (272 tests) green.
- Fixed the `add_captions` schema/handler mismatch (schema now matches what the handler reads) and the
  FCPXML export library name. Publish/deploy runbook: [LAUNCH-RUNBOOK.md](./LAUNCH-RUNBOOK.md).

## 4. Landing page + marketing (kaestral.com)
Static site in `landing/` (self-contained `index.html` + `pricing.html`), deployed to Vercel:
- All links → `github.com/prabindersinghh/Kaestral-pro`; Download → `/releases/latest`; Vercel
  Analytics + `download_click`/`pro_waitlist_submit` events; Pro waitlist wired to Formspree; a 3-step
  "How it works" (Install → Connect Claude → Describe your edit) with the one-command connect.
- **Expanded content:** an 8-audience **Use Cases** section, a full **Capabilities / 50-tools** section
  (tool names visible; Pro marked "coming"), and a **Pricing** page (Basic defined/free, Pro defined/
  coming, Max deliberately mysterious — **no prices**, waitlist CTAs).
- **Local-first privacy** stated prominently (landing + in-app), honest about the two exceptions.
- **Fixes:** removed the fixed left playhead-rail line and the scroll-drifting glow (now a static
  ambient glow).
- **Mobile audit (Playwright, 320/375/390/412/768):** added a hamburger nav (section links were
  unreachable on mobile), fixed table/step overflow (scroll containers + `minmax(0,1fr)`), a mobile
  gutter, and a media `max-width` guard. Zero page horizontal-scroll at all viewports; desktop unchanged.

## 5. Repo hygiene
- Consolidated to a single `main` branch (the Pro-tier spec was preserved onto `main`).
- Renamed the project format `.palmier`→`.kaestral` and purged the old "palmier" product name from
  prose/comments/format strings. **Retained** (deliberately): the GPLv3 upstream attribution in
  [NOTICE.md](../NOTICE.md) / README / landing footers (legally required), the live external dependency
  URL `palmier-io/palmier-skills` (the skills fetcher depends on it), and factual upstream-source
  provenance in dev docs (`palmier-pro-main/…` Swift paths). None of these present Kaestral *as*
  Palmier.

---

## Where to look next
- **Ship it:** [LAUNCH-RUNBOOK.md](./LAUNCH-RUNBOOK.md) — npm publish, GitHub release, Vercel deploy,
  updater key setup.
- **Post-1.0 work:** [FUTURE-IDEAS.md](../FUTURE-IDEAS.md) and the Pro-tier spec under
  `docs/superpowers/specs/`.
- **The motion surface** (where most of the value is): [ARCHITECTURE.md](./ARCHITECTURE.md) §
  "generative motion surface", `src/gen/sceneSpec.ts`, `remotion/src/compositions/Generative.tsx`,
  and `skills/art-direction/SKILL.md`.
