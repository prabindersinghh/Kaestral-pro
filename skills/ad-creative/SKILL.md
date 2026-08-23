---
name: Ad creative (direct response)
description: Direct-response short-form ads — hook → problem → proof → offer → CTA beat structure, on-screen text discipline, and a claims-caution rule.
---

# Ad creative (direct response)

Follow the `build-in-kaestral` house rule. A DR ad is a conversion machine with a fixed spine —
craft varies, the spine doesn't. `promo-ad` covers general promos; THIS skill is the stricter
direct-response variant (paid traffic, measurable action). Cross-reference, don't blend.

## The spine (beats + budgets, for a 30s ad at 30fps)
| Beat | Budget | Job |
|---|---|---|
| Hook | 0–3s | Stop the scroll — one device from `hook-engineering` (problem or transformation hooks convert best in DR) |
| Problem | 3–8s | The viewer's pain, in their words, sharpened — agitate ONE pain, not three |
| Proof | 8–20s | Show, don't claim: product demo (`screenMock` via compose_motion, or real footage), a number (`counter`), a before/after (`splitLayout`), a testimonial line |
| Offer | 20–26s | What they get + the deal, ONE sentence on screen |
| CTA | 26–30s | One imperative, spoken AND on screen, nothing else competing |
15s cut: hook 0–2.5 · problem 2.5–6 · proof 6–11.5 · offer+CTA 11.5–15 (merge the last two beats).

## Build notes per beat
- **Hook:** cold-open restructure per `hook-engineering`; captions from word one.
- **Problem:** face-to-camera or POV footage; caption style at full energy (`caption-styles`
  word-pop); a punch-in on the pain word (`retention-editing` §toolkit).
- **Proof:** this is where `compose_motion` earns its keep — a `counter` stat card, a
  `splitLayout` before/after, a `screenMock` product moment (see `shot-recipes` "Data & proof").
  One proof asset per 6–8s; two proofs beat four.
- **Offer:** boxed text (`add_texts`, backgroundColor = brand accent), 48–64px, static — the offer
  is READ, don't animate it hard.
- **CTA:** one line ("Get the free trial"), `popIn`, bottom third, last 2–4s; end hot per
  `retention-editing` §endings — DR ads loop too.

## On-screen text discipline
- One message on screen at a time. Caption OR offer card OR CTA — never simultaneous stacks.
- ≤7 words per text event; numbers as digits ("9 min → 90 sec").
- Every text event must be readable twice through at feed speed — if not, it's too long.
- Brand bug per `brand-kit`, absent during the hook.

## Claims caution (non-negotiable)
You are not the advertiser's lawyer, but you must not manufacture claims:
- Use ONLY numbers/claims the user supplied; never invent statistics, "#1", "guaranteed", cure or
  income promises.
- Testimonial lines must be provided by the user as real; results-claims should carry the user's
  qualifier if they gave one ("results vary").
- Regulated verticals (health, finance, employment) — flag once to the user that platform ad
  policies are strict there and claims are their responsibility, then build what they approve.
- If asked to fabricate proof ("just make up a stat"), decline that element and offer a compliant
  alternative (a demo moment, a real number they do have).

## Worked example (15s, app subscription)
Hook (problem device): cold-open on the pain — "Your exports look washed out?" text hook, 2.5s ·
Problem: 3 fast jump cuts of the frustration moment, punch-in on "every single time" · Proof:
`splitLayout` before/after export frames + `counter` "2,400 creators switched" (user-supplied
number) · Offer: boxed "Kaestral Pro — first month free" · CTA: "Try it today" spoken + popIn text.
Every beat cut to the music's grid via `analyze_audio` + `beat-sync-cutting`.

## Failure modes
- **Brand-ad drift** — mood montage, logo everywhere, CTA at 40s. DR spine or it isn't DR.
- **Three pains agitated** — diluted problem = no tension for the proof to resolve.
- **Claim inflation** — an invented "97%" can cost the account. Only supplied claims, ever.
- **Simultaneous text stacks** — caption + offer + disclaimer at once = nothing read.
