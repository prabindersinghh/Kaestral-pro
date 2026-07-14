# Mobile responsiveness audit (point 6) — results

Tested landing/index.html AND landing/pricing.html with Playwright at 320×568, 375×667, 390×844,
412×915, 768×1024. Desktop (1400) re-verified unchanged after every fix.

## Issues found + fixes (minimal, production-safe — no redesign)
1. Horizontal overflow at 320px from the "How it works" .step cards.
   Root cause: .steps grid columns (repeat(3,1fr)) + a non-wrapping `<code>` (the connect command) let
   the column size to content and exceed the viewport.
   Fix: grid-template-columns:repeat(3,minmax(0,1fr)) + .step{min-width:0}. Code block now scrolls
   internally (it already had overflow-x:auto). VERIFIED: .step no longer overflows.

2. Comparison + capability TABLES overflowed the page at narrow widths.
   Root cause: table has min-width:520px; the .cmp wrapper's overflow:hidden clipped instead of scrolling.
   Fix: .cmp{max-width:100%}, .cmp-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;max-width:100%}.
   VERIFIED: all 4 tables now scroll internally (inScroll:true, scScrollable:true); page does not scroll.

3. Page gutter (26px) too large on small phones.
   Fix: @media(max-width:600px){:root{--gutter:16px}} on both pages.

4. Use-case panel "Coming — join the waitlist" pill overflowed the panel header at 320px.
   Fix: .upanel .uh{flex-wrap:wrap} so the pill drops to its own line.

5. Media could overflow containers.
   Fix: img,video,svg,canvas{max-width:100%;height:auto} global guard on both pages.

6. MOBILE NAVIGATION was broken: nav links are display:none ≤820px but there was NO hamburger —
   the section links (incl. the new Capabilities/Pricing) were unreachable on mobile.
   Fix: added a hamburger menu button (both pages) that toggles the links as a dropdown panel;
   closes on link tap / outside click; aria-expanded wired. VERIFIED: opens (8 links), closes,
   hidden on desktop (links stay inline/horizontal on desktop — desktop unchanged).

## Final state (VERIFIED via Playwright)
- index.html: pageHorizontalScroll=0 and realClipCount=0 at ALL 5 viewports; hamburger works.
- pricing.html: pageHorizontalScroll=0, realClipCount=0 at 320 and 768; hamburger works; 3 tiers stack.
- Desktop (1400): hamburger hidden, 8 nav links inline, no overflow — design unchanged.
- Only console error on both = /_vercel/insights/script.js 404 (resolves once deployed on Vercel).

## Remaining risks / notes
- Code blocks (<pre>) and wide tables scroll horizontally WITHIN their box on mobile — this is
  intentional, standard behavior (not page overflow).
- Not tested on physical iOS Safari (safe-area insets) — the layout uses no fixed bottom bars, so
  safe-area risk is low; recommend a quick real-device check post-deploy.

VERDICT: production-safe for mobile. Desktop design preserved exactly.
