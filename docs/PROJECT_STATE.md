# PROJECT STATE

Last updated: 2026-10-04 (Weather Visual Engine calibration, first round)

## Project
what-weather, a calm weather web app styled as a Swiss poster. Next.js 16 / React 19 / Tailwind 4 / Mapbox. Live on Vercel. See PRODUCT.md and ARCHITECTURE.md.

## Phase
Feature-complete first version, shipped (13 commits, 2026-09-24 to 2026-10-01). Entering refinement.

## Active task
WTH-046 Weather Visual Engine, on branch `feature/visual-engine`. A-F are committed (F: `d58c2ff`); the user signed off E in the lab. WTH-046K, the calibration gate, has had its first round (uncommitted): see below. The live page still renders `skyPalette`; `atmospherePalette` and the map depth live only in the dev-only lab `/lab/atmosfera`. WTH-046M remains PARKED.

## Last checkpoint
WTH-046K, first round, decided with the user: the force signature ranks by strength times weight (cloud 0.6, haze counted only past the 0.45 onset, now `HAZE_ONSET`); haze is led by visibility (0.65, lost between 10 and 1 km; dew 0.25, humidity 0.10), so rain with a good view keeps its depth; the UV curve is kept. Six scenario expectations corrected where the measurement is the better reading. Two new gate tests (expected forces but for the open snow scenarios; depth by scenario). 89 tests pass across the five touched suites; tsc and ESLint clean. The live palette is unchanged (fingerprint test). Earlier: F (depth), E (transform), A-D as in the engine doc; WTH-015 still unsolved.

## Known problems / open questions
Open for K: snow is weak (0.18 at 0.6 mm/h) and counted twice, as snow and as haze from the view the snowfall itself removes, so the three snow scenarios read haze/cold or cold/cloud. A data decision before fingerprint (J) or map hierarchy (G) rely on snow. For L: `MapControls` must receive the atmosphere's depth, and depth should be quantized before it keys the ink memo. WTH-165 (phone search bar) is on the board, not started.
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
The user looks at the lab (`npm run dev`, `/lab/atmosfera`) after F and K's first round; commit K. Then decide snow (axis strength and the double count with haze), finish K's invariants (grayscale, timeline transitions, conflicting forces), and only then G/H/L. Motion remains PARKED.
