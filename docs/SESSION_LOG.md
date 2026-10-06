# SESSION LOG

Short diary of the last sessions, newest first. Keep to about five entries; consolidated state goes in PROJECT_STATE.md.

## 2026-10-05/06 (Visual Record poster)
- Worked on: WTH-187, the brief V3.1 (inspect, propose, spike), then the user's Type Engine research, then the "Crea poster" button on the record engine over the site's own map, iterated many times with the user (layouts, screenprint, typefaces, colours); WTH-199 the home page's name and temperature in the record's face. ADR-014 for the typeface.
- Decided by the user: the Tshuru structure, then the old poster's style with the record's facts; Syne (after Archivo, a free Helvetica, Mona Sans, Schibsted, Climate Crisis); no screenprint; colours from the app's colour study.
- Mistakes owned: a separate lab page instead of the poster at first; the zoom changed without being asked; board and state not kept up during the iterations (caught up on 2026-10-06).
- Not verified: a real Mapbox export (headless WebGL stalls here); the user is the one who has seen real posters. Reviewer pass pending on the whole branch.

## 2026-10-05 (poster readout)
- Worked on: WTH-183, the poster's foot as a readout of the Weather Fingerprint, on the user's proposal; the user chose English labels, the compass kept, no figures, the block small on the right.
- Reviewed: no critical problems; stand-in zeros made visible (dashed track), the whole day's stamp without an hour, the stand-in mapping made exact, the time zone taken into the snapshot. WTH-184 and WTH-185 added from the review.
- Open with the user: whether interpolated hours and estimated sources count as stand-ins on the poster; a `usePosterSnapshot()` hook instead of the asked-for context provider (proposed, waiting).
- Not verified: the poster on screen (no screenshots, project rule). Committed on `claude/poster-readout`, pushed.

## 2026-10-04 (product direction)
- Worked on: a startup-style review of the product (CEO, product, design, marketing, CTO, data, legal, finance).
- Decided by the user: direction Visual Weather Records (ROADMAP.md, ADR-013).
- Board re-prioritized: WTH-166 (licences) in NOW beside WTH-046; Records track WTH-167 to WTH-173 in NEXT with data trust and WTH-165; layout tasks WTH-017, 018, 022, 009, 015, 024 paused in LATER; WTH-174 to 176 as later products. Board parsed by the board tool.
- Not verified: market figures and licence terms are assumptions until WTH-166 and WTH-167.
- Next: unchanged, the user looks at the lab and K closes.

## 2026-10-04 (phone search)
- Worked on: WTH-165, the user's pick ("si") with the merge to `main` to follow.
- Found: the flash is the phone being a script's guess (`useSyncExternalStore` with a server snapshot of `false`): the HTML is born with the whole bar. For the iPhone text I found no certain cause; I changed what WebKit is known to handle badly (the field changing place and size at the instant of focus, a scale animation under the rising keyboard) and gave the text its own colour: a hypothesis, said so to the user.
- Mistake caught before it shipped: I built the phone's Tailwind classes by joining strings at run time, which Tailwind never sees; written out whole instead.
- Checked: six tests on the server's HTML (five fail on the old component); tsc and ESLint. Not verified on a phone, which is the user's.
- Reviewer: no critical problems; the computer's docked classes made `lg:`-only (no clash with the phone's on a narrowed window), the hidden clear button out of the tab order, wording of the changelog made prudent. Not checked by anyone: a narrowed window at 700 px after scrolling, and an iPhone.
- Merged into `main` (`a4eacf0`, no-ff, as the earlier feature branches): `main` had no commits the branch lacked, the production build passed first (`next build` exit 0, the lab a 404 in the build). Not pushed: the user did not ask for it.
- Next: the user's pick (push, WTH-182, data audits, the Records track).

## 2026-10-04 (the atmosphere becomes the palette)
- Worked on: closing WTH-046L after the user said "perfetto molto belli" and "ok" to making it the default.
- Completed: `frameLook` always paints from the atmosphere; the switch and its plumbing removed (engine.ts, TimeProvider's engine, useEngine, the withEngine calls); five look tests replace the switch's; docs rewritten (the engine doc keeps the switch as history). WTH-046 V1 marked done on the board; M parked.
- Chosen by me: `skyPalette` stays (the lab's "Oggi" and the tests need it) rather than being deleted as I had said I would: I told the user so.
- The test run caught an old pipeline test that asserted the palette equals `skyPalette` (WTH-046C's contract, now intentionally changed): rewritten to the new contract (the palette is the atmosphere's, fog and a clear hour paint different skies). Reviewer: no critical or important problems; one doc sentence corrected.
- Next: the user's next pick.
