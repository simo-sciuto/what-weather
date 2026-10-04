# PROJECT STATE

Last updated: 2026-10-04 (Weather Visual Engine map hierarchy)

## Project
what-weather, a calm weather web app styled as a Swiss poster. Next.js 16 / React 19 / Tailwind 4 / Mapbox. Live on Vercel. See PRODUCT.md and ARCHITECTURE.md.

## Direction
Set by the user 2026-10-04 (ROADMAP.md, ADR-013): Visual Weather Records. Free daily app as shop window, records of meaningful moments as the paid product. Live-app layout work paused.

## Phase
Feature-complete first version, shipped (13 commits, 2026-09-24 to 2026-10-01). Entering refinement.

## Active task
WTH-046 Weather Visual Engine, on branch `feature/visual-engine`. A-F are committed (F: `d58c2ff`); the user signed off E in the lab. WTH-046K, the calibration gate: K is closed (`0177581`); G is implemented and committed in the atmosphere path. Next is WTH-046H, or the user's new requests on the board (WTH-179, 180, 181). The live page still renders `skyPalette`; `atmospherePalette` and the map depth live only in the dev-only lab `/lab/atmosfera`. WTH-046M remains PARKED.

## Last checkpoint
WTH-046G, the meteorological map hierarchy: `mapVisualState(axes): MapVisualState` (depth, terrain, water, road and building weights, saturation, ground lift, water deepening; limits in `MAP_WEATHER_LIMITS`). Chroma and lightness enter before the layers are kept apart, opacity weights and depth act last. Clear, rain and snow are now three pictures in grayscale over sky and map (at least 0.069 from clear, rain at least 0.053 from snow); the declared separation floor under weather is 0.3 of `MAP_SEPARATION`. The live page is unchanged (fingerprint test). 107 tests across six suites; tsc and ESLint clean. Reviewed: no critical problems; a separation guard after the weights was added from it (rare mixes fell to 0.011 without it). Earlier: K closed (`0177581`), F (`d58c2ff`), E, A-D.

## Known problems / open questions
For L: the live page's own stepped gamut jitter (8/255 on a clear day) when it moves to the atmosphere path. Watch in the lab: a downpour or snowfall with poor visibility no longer flattens sky or map. For L: `MapControls` must receive the atmosphere's depth, and depth should be quantized before it keys the ink memo. WTH-165 (phone search bar) is on the board, not started.
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
The user's look at G in the lab; then WTH-046H (unified palette contract), or the three requests the user added on 2026-10-04: poster glow (WTH-179), transit stops (WTH-180), the poster's left column (WTH-181). Motion remains PARKED. After WTH-046L, the Records track (BOARD NEXT, ADR-013); WTH-166 (licences) can start in parallel.
