# PROJECT STATE

Last updated: 2026-10-04 (Weather Visual Engine calibration, first round)

## Project
what-weather, a calm weather web app styled as a Swiss poster. Next.js 16 / React 19 / Tailwind 4 / Mapbox. Live on Vercel. See PRODUCT.md and ARCHITECTURE.md.

## Phase
Feature-complete first version, shipped (13 commits, 2026-09-24 to 2026-10-01). Entering refinement.

## Active task
WTH-046 Weather Visual Engine, on branch `feature/visual-engine`. A-F are committed (F: `d58c2ff`); the user signed off E in the lab. WTH-046K, the calibration gate: round one committed (`45bfcfb`), round two (snow) implemented and uncommitted, see below. The live page still renders `skyPalette`; `atmospherePalette` and the map depth live only in the dev-only lab `/lab/atmosfera`. WTH-046M remains PARKED.

## Last checkpoint
WTH-046K round two, on the user's decision that rain is rain, snow is snow and fog is fog: snow has its own scale (`snowInfluence`, full at 2 mm/h of water equivalent), the view a fall takes away is the fall's and never haze (`hazeLoss = max(0, visibilityLoss - max(wetness, snow))`), heat and cold weigh 0.8 in the signature. All 16 scenarios now name their expected forces (gate test, no exceptions) and depth stays whole in every fall; only fog closes it. 90 tests pass across the five touched suites; tsc and ESLint clean; the live palette unchanged. Round one (`45bfcfb`): signature by weights (cloud 0.6, haze past the onset), visibility-led haze, UV kept. Earlier: F (depth), E (transform), A-D as in the engine doc; WTH-015 still unsolved.

## Known problems / open questions
For K: grayscale comparisons, timeline transitions and conflicting-force invariants are still to write, and the user's look at the lab after rounds one and two. Watch in the lab: a downpour or snowfall with poor visibility no longer flattens sky or map. For L: `MapControls` must receive the atmosphere's depth, and depth should be quantized before it keys the ink memo. WTH-165 (phone search bar) is on the board, not started.
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
The user looks at the lab (`npm run dev`, `/lab/atmosfera`); commit round two. Then finish K's invariants (grayscale, timeline transitions, conflicting forces), and only then G/H/L. Motion remains PARKED.
