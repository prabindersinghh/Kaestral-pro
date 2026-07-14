# Pricing — content spec for a NEW page: landing/pricing.html

Rules (point 4):
- DO NOT disclose any prices anywhere. No "$", no "/mo", no numbers.
- Three tiers: BASIC (defined, available now), PRO (defined, coming), MAX (mystery — do NOT say what's in it).
- Instead of prices/buttons-to-buy: a WAITLIST call-to-action (reuse the same Formspree waitlist form
  as the main page — endpoint https://formspree.io/f/xrenbavp; a mailto fallback is fine).
- Same visual language / tokens / nav / footer as index.html. Standalone page (own <head>), links back to /.
- Nav should add a "Pricing" link (also add it to index.html's nav → /pricing.html or #).

## BASIC — Available now · Free · Open source (GPLv3)
Tagline: Everything you need to edit by conversation. Free forever.
- The full AI-operated editor — describe the edit, it makes it
- All 50 MCP tools — perception, timeline, word-level editing, motion graphics, color, layout
- Word-synced captions, silence/filler removal, beat-synced cutting
- Bespoke motion graphics & launch films (compose_motion + the art-direction skill)
- Multi-track NLE — trim, split, keyframes, transitions, color grading
- Export H.264 / H.265 / ProRes, 1080p & 4K · XMEML / FCPXML / SRT
- Connect any LLM: `claude mcp add kaestral -- npx kaestral`
- 100% local — your footage never leaves your machine
CTA: Download for Windows (→ releases/latest)

## PRO — Coming soon · Join the waitlist
Tagline: Generative power on top of the editor you already have.
- AI video & image generation — prompt → new footage placed on your timeline (BYOK)
- Translation & dubbing — Hindi + regional Indian languages, and beyond
- AI upscaling — temporally consistent, no flicker
- Advanced generative motion — PixiJS particles & shaders
- Priority on new generative models as they land
CTA: Join the Pro waitlist (waitlist form)

## MAX — Something bigger is coming
Tagline: We're not ready to talk about this one yet.
- Keep it deliberately mysterious. A few evocative but non-committal lines, e.g.:
  - "The most ambitious thing we're building."
  - "For teams and studios who want to go far beyond a single editor."
  - "Details under wraps. Get on the list to be the first to know."
- NO feature bullets that reveal specifics. A locked/blurred aesthetic is on-brand.
CTA: Request early access (waitlist form, source tag 'max')

## Footer note (honest)
"Pricing for Pro and Max will be announced closer to launch. Basic is free and open source, forever."
