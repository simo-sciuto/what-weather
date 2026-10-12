# SESSION LOG

Short diary of the last sessions, newest first. Keep to about five entries; consolidated state goes in PROJECT_STATE.md.

## 2026-10-12 (open branches closed)
- Worked on: closing the open work. Merged the historical-provider port and WTH-185 into `main`; resolved the board conflict and the reused ids; merged WTH-206, WTH-189 and WTH-224.
- Decided, as asked: ADR-001 and ADR-013 updated, `getAt` keeps the `WeatherData` shape (ADR-016 note). Deleted the six branches of the session on origin.
- Found on the way: a slow WTH-200 test timed out under parallel load; only its timeout changed. The poster was not checked visually.
- Next: WTH-169 checkpoint (labels "Oggi"/"Domani" for past moments, cache lifetime of `getAt`), then WTH-167.

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

