# PROJECT STATE

Last updated: 2026-10-04 (Weather Visual Engine calibration, round three)

## Project
what-weather, a calm weather web app styled as a Swiss poster. Next.js 16 / React 19 / Tailwind 4 / Mapbox. Live on Vercel. See PRODUCT.md and ARCHITECTURE.md.

## Direction
Set by the user 2026-10-04 (ROADMAP.md, ADR-013): Visual Weather Records. Free daily app as shop window, records of meaningful moments as the paid product. Live-app layout work paused.

## Phase
Feature-complete first version, shipped (13 commits, 2026-09-24 to 2026-10-01). Entering refinement.

## Active task
WTH-046 Weather Visual Engine, on branch `feature/visual-engine`. A-F are committed (F: `d58c2ff`); the user signed off E in the lab. WTH-046K, the calibration gate: K is closed after the user's look in the lab (rounds committed: `45bfcfb`, `b30b48b`, round three). Next is WTH-046G. The live page still renders `skyPalette`; `atmospherePalette` and the map depth live only in the dev-only lab `/lab/atmosfera`. WTH-046M remains PARKED.

## Last checkpoint
WTH-046K round three (committed, K closed): `calibration-invariants.test.ts` (grayscale, timeline, conflicting forces; 11 tests). The timeline sweep found a real jitter: a clear noon's middle sky stop wandered by up to 14/255 between frames seven minutes apart, from the stepped gamut reduction and the 0.01-step text protection. The atmosphere path now uses continuous versions (`fromOklchEdge`, `legibleUnderTextEdge`, a `continuous` flag set by `atmospherePalette`); the live page is untouched (fingerprint test passes). Findings recorded for G: bright days share one sky grayscale (white-text cap); in a full storm the floors leave haze no sky to compress. Reviewed (no critical problems; four small fixes applied). 100 tests pass across six suites; tsc and ESLint clean. Rounds one (`45bfcfb`) and two (`b30b48b`) committed. Earlier: F (depth), E (transform), A-D as in the engine doc.

## Known problems / open questions
For G: clear, light rain and snow share one sky grayscale and depth. For L: the live page's own stepped gamut jitter (8/255 on a clear day) when it moves to the atmosphere path. Watch in the lab: a downpour or snowfall with poor visibility no longer flattens sky or map. For L: `MapControls` must receive the atmosphere's depth, and depth should be quantized before it keys the ink memo. WTH-165 (phone search bar) is on the board, not started.
Candidates only, from the audit (BOARD WTH-001..003): AQI index is computed differently per provider; interpolated hours vs measured readings in the UI; min/max on partial days. None confirmed as bugs.

## Constraints to respect
- Keep the provider abstraction and `WeatherData` (ADR-001).
- No keys in the client (ADR-002).
- One cached unit per place (ADR-003).
- Preserve the poster identity and progressive disclosure (PRODUCT.md).
- Italian copy, English code.

## Relevant files
`src/lib/weather/{atmosphere,atmospheric-data,visual-input,types,transformers,openmeteo,mock,frames,look,palette,state}.ts`, `src/lib/weather/{atmosphere,visual-input,atmospheric-pipeline,atmosphere-sky}.test.ts`, `src/lib/weather/calibration.ts`, `src/components/lab/AtmosphereLab.tsx`, `src/app/lab/atmosfera/page.tsx`, `docs/WEATHER_VISUAL_ENGINE.md`.

## Next checkpoint
WTH-046G, meteorological map hierarchy: propose the checkpoint first (it spans palette, map style and controls). Motion remains PARKED. After WTH-046L, the Records track (BOARD NEXT, ADR-013); WTH-166 (licences) can start in parallel.
