# SESSION LOG

Short diary of the last sessions, newest first. Keep to about five entries; consolidated state goes in PROJECT_STATE.md.

## 2026-10-04 (product direction)
- Worked on: a startup-style review of the product (CEO, product, design, marketing, CTO, data, legal, finance).
- Decided by the user: direction Visual Weather Records (ROADMAP.md, ADR-013).
- Board re-prioritized: WTH-166 (licences) in NOW beside WTH-046; Records track WTH-167 to WTH-173 in NEXT with data trust and WTH-165; layout tasks WTH-017, 018, 022, 009, 015, 024 paused in LATER; WTH-174 to 176 as later products. Board parsed by the board tool.
- Not verified: market figures and licence terms are assumptions until WTH-166 and WTH-167.
- Next: unchanged, the user looks at the lab and K closes.

## 2026-10-04 (poster without sentences)
- Worked on: WTH-181, after "proseguiamo": the outlook sentences removed from the hero, the name and temperature block to the top, the Luogo, Giorno, Ora row to the foot (on a phone the name rises, the facts stay at the foot).
- Found late: ADR-013 (the user's product direction of the same day) pauses layout work on the live app, WTH-017 among it. I should have read DECISIONS.md before starting: flagged, change left uncommitted, WTH-182 (stop overlap) was added meanwhile.
- Checked: tsc and ESLint clean. Not run: e2e. Not verified: the look.
- The user confirmed WTH-181 knowingly ("ok per tutto"), with PRODUCT.md updated and WTH-024 closed. Recorded in DECISIONS as a one-off exception to ADR-013's pause.
- Next: WTH-046H, or whatever the user picks (WTH-182 stops overlap, WTH-165 phone search).

## 2026-10-04 (transit stops)
- Worked on: WTH-180, after the user's "vai" (the next of their requests, as proposed).
- Completed: the stops drawn as forms (roundel, heavier roundel, open ring, dot) in `map-style.ts`, with a companion core layer and a `ring` kind in `syncMap`; five tests; tsc and ESLint clean. The design was mine to choose (the user asked for "something more graphically advanced"): elementary geometry in the line's colour, hierarchy by weight, no outline.
- Second look: the user wanted the inner dot gone, only the circle, with a box shadow, then the shadow harder so the stops float. Mapbox has no box-shadow: a companion `-shadow` layer under each stop, black, same shape, offset 2 px, blur 0.2, opacity 0.55 times the ink's. The metro's ring was brought to 5.35 px outer (the old dot's 5.3).
- The user found the stops too big on first look: the first radii (ring up to 7.5 and 8.5 px at zoom 17) exceeded the old dots (5). Shrunk: train ring 4.2, metro 4.8, tram 2.4, bus dot 1.6 at zoom 17, strokes 0.5 to 1.5. The relations between modes are tested, not the absolute sizes.
- Not verified: how it looks on the page and in the poster (the user's call; no screenshot, per the project rule).
- Next: WTH-181 (proposed as a checkpoint first), or WTH-046H.

