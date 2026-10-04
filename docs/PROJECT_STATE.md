# PROJECT STATE

Last updated: 2026-10-04 (Weather Visual Engine atmosphere-transform checkpoint)

## Project
what-weather, a calm weather web app styled as a Swiss poster. Next.js 16 / React 19 / Tailwind 4 / Mapbox. Live on Vercel. See PRODUCT.md and ARCHITECTURE.md.

## Phase
Feature-complete first version, shipped (13 commits, 2026-09-24 to 2026-10-01). Entering refinement.

## Active task
WTH-046 Weather Visual Engine, on branch `feature/visual-engine` (A-E committed; the user signed off E in the lab on 2026-10-04). WTH-046A-E are implemented and checked: model, normalization, atmospheric transport, solar base and the bounded OKLCH atmosphere transform. The live page still renders with `skyPalette`; the new `atmospherePalette` is compared with it in the dev-only lab `/lab/atmosfera` over 16 calibration scenarios (start of WTH-046K). WTH-046M remains PARKED.

## Last checkpoint
WTH-046E: `atmosphereSky`/`atmospherePalette` in `palette.ts` section 6. Fixed order (white balance and hue turns, chroma, depth veil, lightness, stop spread, floors, gamut), same-property pulls combined as strongest plus 25% of the rest, final floors, no hue through green, haze acting past the 0.45 saturated-air baseline, veil capped at 0.56 just above the white-text cap. `skyPalette` split into `stateSky` + shared `finishPalette`, byte-identical on 4,464 palettes. 135 tests pass across nine suites (24 new). A four-lens review confirmed 13 problems, all fixed. The user signed off the scenarios in the lab. Earlier: A-D as in the engine doc; WTH-015 still unsolved (building data from zoom 13).

## Known problems / open questions
Calibration findings (WTH-046K, see WEATHER_VISUAL_ENGINE.md): the force signature ranks `cloud` over rain and snow in most wet scenarios; saturated air alone gives 0.45 haze; the axes' UV curve and missing-UV value differ from the live page. Bright atmospheres can differ only by hue, chroma, gradient and glow under the white-text cap.
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
WTH-046F, atmospheric depth on the map side. Decide the open K findings before the signature or UV curve are relied on. Calibrate before map/UI/poster integration; motion remains PARKED.
