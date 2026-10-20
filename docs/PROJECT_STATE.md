# PROJECT STATE

Last updated: 2026-10-20 (the atlas built and served at `/` on `claude/atlas-foundation`; nothing on `main` since 2026-10-12)

## Project
what-weather, an atmospheric atlas of Piedmont and the western Alps: a full-screen map painted by the weather, a time bar, three layers (Meteo, Territorio, Percorsi), cards for summits with "È un buon momento per salirci?" (places, lakes and routes to come). Next.js 16 / React 19 / Tailwind 4 / Mapbox. Non-commercial. See VISION.md.

## Direction
Reset by the user on 2026-10-20 (ADR-030): Visual Weather Records, Explore and Create, and Tavola unica are dropped. Kept: the weather data layer, the colour engine (the only identity), the map style, the Atlas (ADR-019 to ADR-026). Pre-reset state: `a08157c` (local tag `archive/v2-tavola`).

## Phase
The atlas is built and served at `/`, with summits and their verdict; places, lakes and routes wait on the regional extract.

## Active task
WTH-339, the reset. Built on 2026-10-20, each step committed, pushed and tested (577 unit tests, 48 e2e with the container's Chromium, typecheck and lint clean), then reviewed by the `reviewer` and fixed:
- WTH-340 the Atlas decoupled from the old tree; WTH-342 UI tokens measured against the weather field; WTH-343 and WTH-344 time in the atlas and the time bar; WTH-345 the hourly field; WTH-346 the layer switch; WTH-347 `/` is the atlas (`/atlas` and `/crea` redirect); WTH-348 the old tree deleted; the review fixes (one address writer, Back, the wordmark, renders, honest time).
- Docs: VISION, PRINCIPLES, EXPERIENCE, DESIGN_SYSTEM, ARCHITECTURE, ROADMAP, VERDICT (spec), ADR-030; the design system "what-weather Atlante" in Claude Design (https://claude.ai/artifact/4ecgeDMLxKfXqHspB4nE7a, private).

## Last checkpoint
Summits: the peaks layer, the summit card and its verdict (ADR-031), with the second review's fixes (a summit without height, the summit's own height, rain and snow over the way down, calendar-day paging, a missing rain hour is no verdict).

## Blocked, and on whom
- The user: a look at `/` on a computer and a 360 px phone (WTH-361); the docs and the design system; Inter Tight or Inter; the region box wording; colour worked out on the server (WTH-358); the verdict's thresholds (one `THRESHOLDS` object, docs/VERDICT.md, ADR-031); the map panel against the layers (WTH-357); whether a failed refresh may be retried alone (WTH-363, ADR-020); whether and when this branch goes to `main` (the Vercel preview of the branch builds the atlas at `/`).
- Network: the data spike (WTH-341: Overpass, Wikidata, elevation, Tiling Service, Open-Meteo call counting) cannot run in this cloud environment; it needs access to those hosts or a local run. Places and lakes (WTH-351, WTH-352) and Percorsi with route verdicts (WTH-353, WTH-354) wait on it.

## Known problems
- WTH-360 smaller follow-ups from the review; WTH-362 summit follow-ups (keyboard access to summits, touch targets, heat and daylight, the model run, one e2e that failed once under load). The field and point colour is still computed on the server (WTH-358).
- Not verified: the real Mapbox drawing with a token, Safari, a real phone, Open-Meteo's daily budget with the hourly field.

## Constraints to respect
- Provider abstraction and `WeatherData` (ADR-001); no keys in the client (ADR-002); one cached unit per place (ADR-003).
- The colour engine is the identity (ADR-012, ADR-026, ADR-030); PRINCIPLES.md.
- Italian copy, English code and docs.

## Next checkpoint
The user's look and decisions above; then WTH-341 (data spike, with network).
