# SESSION LOG

Short diary of the last sessions, newest first. Keep to about five entries; consolidated state goes in PROJECT_STATE.md.

## 2026-10-13 (Create brief: audit, spec, CreateRecord v1, consolidation)
- Worked on: a read-only audit of the user's Create brief, conflicts with DECISIONS flagged; the user decided (three treatments, fixed view, preparation only). Reviewed `claude/explore-create-seam` (one important finding: the poster on `/crea` read the weather page's view). Then, authorised: the spec and board (WTH-232 to 240), `CreateRecord` v1 (WTH-233), the fixed-view fix, the A4 label (WTH-239), the WTH-234 design (no code). Four commits on `claude/create-record`.
- Verified: tsc, ESLint, the record, poster and map-view unit tests (94); e2e create, details, reading, timeline, week, activities, places, phone 24 of 24 (one flaky start seen earlier, 9 of 9 on rerun). Each code commit typechecked on its own.
- Not verified: the poster dialog with a Mapbox token, a real phone, the new A4 note's look.
- Fixed WTH-241 (the descent is measured on the screen, 1.5 screens, not on the page's height) and WTH-243 (Create's poster colours and layers are the canonical ones, not Explore's stored choices; the PNG is byte-identical with and without them). WTH-245 kept as it is. Checked with Mapbox: the dialog draws A4 and story, and Dettagli opens without moving the page at the same scroll.
- Not verified: the map's zoom and pitch by eye (the user's look), and a real phone.
- Next: the user's look, then the merge decision; then the validation of Create (WTH-227, WTH-167).

## 2026-10-12 (new direction, ADR-018)
- Worked on: the user pasted a startup-style assessment and asked to take it as the direction. Flagged four conflicts with ADR-013 and the roadmap (layout pause, past date as centre, print first, English tagline); the user accepted the recommendations. Wrote ROADMAP update, ADR-018, board Priority 0 (WTH-225 to WTH-231), WTH-169, 170, 173 and 214 adjusted, PROJECT_STATE.
- Not done: no code, no checkpoint started. The assessment's market claims are unverified (WTH-231).
- Then: WTH-231 done (docs/COMPETITORS.md); WTH-225 steps 1 to 3 done on `claude/explore-create-seam`, uncommitted, each reviewed (DetailsBand, `/crea`, the Dettagli disclosure, the tagline, the Crea link). Create's map view fixed to the base view (user's choice).
- Not verified: the real look, a real phone, the poster dialog on `/crea` with a Mapbox token.
- Next: the user's look and a commit; step 4 (WTH-226 events).

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
