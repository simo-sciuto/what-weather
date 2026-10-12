# SESSION LOG

Short diary of the last sessions, newest first. Keep to about five entries; consolidated state goes in PROJECT_STATE.md.

## 2026-10-06 (poster closed, sea and provenance)
- Closed with the user's look at real exports (Torino, El Paso, Bergamo; iPhone): WTH-187, WTH-199, WTH-200, WTH-203.
- Done and reviewed: WTH-204 (`seaGrid`, one flood, identical output, 3.6 s to 26 ms on a long harbour), WTH-196 (`RecordInput.provenance`; "~" on an interpolated hour, no partial range or estimated air printed).
- Mistake owned: at the start the poster's name was said to be in Syne; it is Inter Tight (ADR-015 update).
- Next: WTH-166 (licences) or the poster clean-ups.

## 2026-10-05/06 (Visual Record poster)
- Worked on: WTH-187, the brief V3.1 (inspect, propose, spike), then the user's Type Engine research, then the "Crea poster" button on the record engine over the site's own map, iterated many times with the user (layouts, screenprint, typefaces, colours); WTH-199 the home page's name and temperature in the record's face. ADR-015 for the typeface.
- Decided by the user: the Tshuru structure, then the old poster's style with the record's facts; Syne (after Archivo, a free Helvetica, Mona Sans, Schibsted, Climate Crisis); no screenprint; colours from the app's colour study.
- Mistakes owned: a separate lab page instead of the poster at first; the zoom changed without being asked; board and state not kept up during the iterations (caught up on 2026-10-06).
- Not verified: a real Mapbox export (headless WebGL stalls here); the user is the one who has seen real posters. Reviewer pass pending on the whole branch.
- 2026-10-06: `claude/code-conventions` merged into `main`, then `main` merged into this branch and the record code brought to the conventions (`type`, `@/types/*` imports, the shared `clamp`); the typeface's ADR renumbered ADR-015, since ADR-014 is the conventions.

## 2026-10-05 (code conventions, WTH-186)
- Worked on: the conventions the user asked for (types not interfaces, shared types in one place, constants and labels in a file, utils, api folder), as ADR-014, after the architect's check; four checkpoints on `claude/code-conventions`, each reviewed.
- Found: the `rgba(` to `hexToRgba(` rename also hit a CSS string in the poster's glow, which no test, golden run or e2e draws (the poster needs the Mapbox token); the reviewer saw it. Fixed with `bloomColor` and a test, and from then on the poster is checked by a real render through a harness with a fake map, pixel by pixel.
- Not verified: the poster on screen with the map. Optional leftovers in WTH-189; WTH-188 (providers and sources depend on each other).
- Next: the merge into `main`, as the user decides.

## 2026-10-05 (poster readout)
- Worked on: WTH-183, the poster's foot as a readout of the Weather Fingerprint, on the user's proposal; the user chose English labels, the compass kept, no figures, the block small on the right.
- Reviewed: no critical problems; stand-in zeros made visible (dashed track), the whole day's stamp without an hour, the stand-in mapping made exact, the time zone taken into the snapshot. WTH-184 and WTH-185 added from the review.
- Decided by the user: stand-in marking stays as it is; `usePosterSnapshot()` instead of a context provider (a provider would rerender on every scrub). Merged into `main`.
- Not verified: the poster with the map on screen (no Mapbox token in the cloud container; a render with a fake map was shown).

## 2026-10-04 (product direction)
- Worked on: a startup-style review of the product (CEO, product, design, marketing, CTO, data, legal, finance).
- Decided by the user: direction Visual Weather Records (ROADMAP.md, ADR-013).
- Board re-prioritized: WTH-166 (licences) in NOW beside WTH-046; Records track WTH-167 to WTH-173 in NEXT with data trust and WTH-165; layout tasks WTH-017, 018, 022, 009, 015, 024 paused in LATER; WTH-174 to 176 as later products. Board parsed by the board tool.
- Not verified: market figures and licence terms are assumptions until WTH-166 and WTH-167.
- Next: unchanged, the user looks at the lab and K closes.

## 2026-10-05 (historical provider)
- Worked on: WTH-168, after the user's "si" to the architecture and to merging the audits (merged: `9628b22`; the user had pushed `main` meanwhile).
- Done: asked the real archive before writing the adapter: ERA5-Land alone lacks cloud, rain, wind and weather code (not usable); every model returns visibility and UV empty; `best_match` is the IFS for recent dates; ERA5 snaps the place to a 25 km cell (about 7 km from Milan). Hence the model named by date, `missing` computed from the data, and a recorded real answer as the fixture. Confidence by age from ECMWF's notes on ERA5, stated as an initial rule.
- Not done: air quality for a past date; the label of a record's first frame ("Adesso"), left for WTH-169.
- Reviewer: no critical problems; two important, both mine and both fixed: nulls became silent zeros (a missing cloud cover read as a clear sky) while `missing` only watched visibility and UV, now every quantity with a hole is listed and an hour with no weather code is dropped; and the IFS is not a reanalysis (checked on Open-Meteo's page: four operational runs a day, assembled by them), so the record's kind now says `forecast-archive` and the IFS credit is an open question (WTH-222).
- Then, trying the first candidate records, two faults of the archive that the summer fixture could not show: it cuts days at today's offset (Berlin in November 1989 was +1, it said +2), and `is_day` was zero for a whole day in Washington 1963. Both corrected from the hours and the sun's times, with two more recorded answers as fixtures; and a reminder that a reconstruction is not the documented weather (Apollo 11: drizzle where NASA reports perfect weather).
- Second review: no critical problems; applied the nearest-instant choice (a real Mumbai answer has its hours at :30 UTC, Kathmandu's at :15: every record there would have failed), an alignment guard for zones with a huge historical offset, the sun's height as the fallback for day and night, and a timeout on a slow test. The Apia case is a synthetic test, not a real answer.
- The user then chose the direction of the validation page: five historical facts in places as significant, the Berlin Wall as the example. The user then said to change the events and not to spend long on it: Apollo 11 and the Madrid final replaced by the Beatles' roof (London 1969) and the Tokyo Olympics opening (1964), five records settled and listed in `docs/RECORDS_SAMPLES.md` with what each agrees with. Next: the records themselves, the page, the form.

## 2026-10-04 (the atmosphere becomes the palette)
- Worked on: closing WTH-046L after the user said "perfetto molto belli" and "ok" to making it the default.
- Completed: `frameLook` always paints from the atmosphere; the switch and its plumbing removed (engine.ts, TimeProvider's engine, useEngine, the withEngine calls); five look tests replace the switch's; docs rewritten (the engine doc keeps the switch as history). WTH-046 V1 marked done on the board; M parked.
- Chosen by me: `skyPalette` stays (the lab's "Oggi" and the tests need it) rather than being deleted as I had said I would: I told the user so.
- The test run caught an old pipeline test that asserted the palette equals `skyPalette` (WTH-046C's contract, now intentionally changed): rewritten to the new contract (the palette is the atmosphere's, fog and a clear hour paint different skies). Reviewer: no critical or important problems; one doc sentence corrected.
- Next: the user's next pick.
## 2026-10-04 (licences)
- Worked on: WTH-166, the first step of the Records track, while the reviewer read the audits.
- Found: the Mapbox terms were behind a PDF that the page fetcher could not read; extracted its text by hand (the PDF's fonts map glyph ids to characters through ToUnicode tables) and read clauses 1.4, 1.7 and 2.8.1 as written, instead of relying on the help pages' summary. The important finding is not only about the future: the free "Crea poster" download is a static digital copy of the Mapbox map, which the print clause restricts.
- Said honestly in the doc: what the pages say and what they leave unsettled (Open-Meteo's prices, OpenWeather's free historical access, visibility in the archive); this is not legal advice.
- Next: the user's word on WTH-219 and WTH-220; then WTH-168 (architect checkpoint) if the Records track goes on.

