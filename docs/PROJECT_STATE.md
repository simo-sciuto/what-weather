# PROJECT STATE

Last updated: 2026-10-02 (random city; poster top rework in progress)

## Project
what-weather, a calm weather web app styled as a Swiss poster. Next.js 16 / React 19 / Tailwind 4 / Mapbox. Live on Vercel. See PRODUCT.md and ARCHITECTURE.md.

## Phase
Feature-complete first version, shipped (13 commits, 2026-09-24 to 2026-10-01). Entering refinement.

## Active task
WTH-012 (with WTH-008): the poster's top. Implemented and looked at in screenshots, waiting for the user's sign-off. Then WTH-010 (the "La mappa" modal), WTH-009 (tinta colours), WTH-013 (poster on a phone).

## Last checkpoint
The commit that closes this session (random city, poster top). WTH-011 is done.

## Known problems / open questions
Candidates only, from the audit (BOARD WTH-001..003): AQI index is computed differently per provider; interpolated hours vs measured readings in the UI; min/max on partial days. None confirmed as bugs.

## Constraints to respect
- Keep the provider abstraction and `WeatherData` (ADR-001).
- No keys in the client (ADR-002).
- One cached unit per place (ADR-003).
- Preserve the poster identity and progressive disclosure (PRODUCT.md).
- Italian copy, English code.

## Relevant files
`src/app/page.tsx`, `src/lib/weather-page.ts`, `src/lib/weather/random-city.ts`, `src/lib/weather/{types,frames,provider}.ts`, `src/components/time/TimeContext.tsx`.

## Next checkpoint
Pick a task from NEXT, or add one with "aggiungi alla board".
