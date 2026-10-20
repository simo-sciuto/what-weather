# PROJECT STATE

Last updated: 2026-10-20 (the atlas built and served at `/` on `claude/atlas-foundation`; nothing on `main` since 2026-10-12)

## Project
what-weather, an atmospheric atlas of Piedmont and the western Alps: a full-screen map painted by the weather, a time bar, three layers (Meteo, Territorio, Percorsi), and, to come, cards for places, peaks, lakes and routes with "È un buon momento per andarci?". Next.js 16 / React 19 / Tailwind 4 / Mapbox. Non-commercial. See VISION.md.

## Direction
Reset by the user on 2026-10-20 (ADR-030): Visual Weather Records, Explore and Create, and Tavola unica are dropped. Kept: the weather data layer, the colour engine (the only identity), the map style, the Atlas (ADR-019 to ADR-026). Pre-reset state: `a08157c` (local tag `archive/v2-tavola`).

## Phase
The atlas's foundation is built and served at `/`; territory, routes and the verdict wait on data and on the user's decisions.

## Active task
WTH-339, the reset. Built on 2026-10-20, each step committed, pushed and tested (546 unit tests, 47 e2e with the container's Chromium, typecheck and lint clean), then reviewed by the `reviewer` and fixed:
- WTH-340 the Atlas decoupled from the old tree; WTH-342 UI tokens measured against the weather field; WTH-343 and WTH-344 time in the atlas and the time bar; WTH-345 the hourly field; WTH-346 the layer switch; WTH-347 `/` is the atlas (`/atlas` and `/crea` redirect); WTH-348 the old tree deleted; the review fixes (one address writer, Back, the wordmark, renders, honest time).
- Docs: VISION, PRINCIPLES, EXPERIENCE, DESIGN_SYSTEM, ARCHITECTURE, ROADMAP, VERDICT (spec), ADR-030; the design system "what-weather Atlante" in Claude Design (https://claude.ai/artifact/4ecgeDMLxKfXqHspB4nE7a, private).

## Last checkpoint
WTH-359, Adesso refreshed on a page left open (after `7364e8c`, the review fixes).

## Blocked, and on whom
- The user: a look at `/` on a computer and a 360 px phone (WTH-361); the docs and the design system; Inter Tight or Inter; the region box wording; colour worked out on the server (WTH-358); the verdict's thresholds and the new `RouteWeather` contract (docs/VERDICT.md, WTH-354); the map panel against the layers (WTH-357); whether and when this branch goes to `main` (the Vercel preview of the branch builds the atlas at `/`).
- Network: the data spike (WTH-341: Overpass, Wikidata, elevation, Tiling Service, Open-Meteo call counting) cannot run in this cloud environment; it needs access to those hosts or a local run. Territorio's data and cards (WTH-351), peaks and lakes (WTH-352) and Percorsi (WTH-353) wait on it.

## Known problems
- WTH-360 smaller follow-ups from the review. The field and point colour is still computed on the server (WTH-358).
- Not verified: the real Mapbox drawing with a token, Safari, a real phone, Open-Meteo's daily budget with the hourly field.

## Constraints to respect
- Provider abstraction and `WeatherData` (ADR-001); no keys in the client (ADR-002); one cached unit per place (ADR-003).
- The colour engine is the identity (ADR-012, ADR-026, ADR-030); PRINCIPLES.md.
- Italian copy, English code and docs.

## Next checkpoint
The user's look and decisions above; then WTH-341 (data spike, with network).
