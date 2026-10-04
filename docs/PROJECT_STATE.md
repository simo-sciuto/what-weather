# PROJECT STATE

Last updated: 2026-10-04 (Weather Visual Engine solar-base checkpoint)

## Project
what-weather, a calm weather web app styled as a Swiss poster. Next.js 16 / React 19 / Tailwind 4 / Mapbox. Live on Vercel. See PRODUCT.md and ARCHITECTURE.md.

## Phase
Feature-complete first version, shipped (13 commits, 2026-09-24 to 2026-10-01). Entering refinement.

## Active task
WTH-046 Weather Visual Engine. WTH-046A/B/C/D (model, normalization, atmospheric timeline transport and solar base) are implemented and checked. FrameLook now derives atmosphere for the selected frame. The existing palette is still the sole renderer; atmospheric colour integration remains after calibration. Next checkpoint: WTH-046E, bounded OKLCH atmosphere transforms. WTH-046M remains PARKED.

## Last checkpoint
WTH-046D exposes the existing natural-light base as `solarPalette(light): SolarPalette`; anchor values and all calculations remain identical after the naming/export change. The user signed off WTH-012 on 2026-10-04, including WTH-008. Added WTH-046A/B/C: atmosphere model and normalization, provider current/hourly atmospheric fields and origins, missing-aware interpolation, synthetic daily overviews and client-side FrameLook derivation. Ninety-two tests pass across model, pipeline and narrative/activity/window regressions. The current precipitation contract combines rain/snow, so phase follows condition; no quantitative mixed-phase reconstruction is claimed. Current/hourly contracts and frames now carry humidity, visibility, dew point and source metadata. Existing palette, UI, maps and poster remain visually unchanged. Current-detail numeric fallbacks remain for compatibility but are excluded from the atmospheric timeline. WTH-015 (buildings from above) remains unsolved: the data starts at zoom 13.

## Known problems / open questions
Candidates only, from the audit (BOARD WTH-001..003): AQI index is computed differently per provider; interpolated hours vs measured readings in the UI; min/max on partial days. None confirmed as bugs.

## Constraints to respect
- Keep the provider abstraction and `WeatherData` (ADR-001).
- No keys in the client (ADR-002).
- One cached unit per place (ADR-003).
- Preserve the poster identity and progressive disclosure (PRODUCT.md).
- Italian copy, English code.

## Relevant files
`src/lib/weather/{atmosphere,atmospheric-data,visual-input,types,transformers,openmeteo,mock,frames,look,palette,state}.ts`, `src/lib/weather/{atmosphere,visual-input,atmospheric-pipeline}.test.ts`, `docs/WEATHER_VISUAL_ENGINE.md`.

## Next checkpoint
WTH-046E: implement bounded OKLCH atmosphere transforms over the shared solar base, with explicit composition order, gamut and accessibility protection. Preserve the existing rendering path until calibrated integration. Follow BOARD.md's execution order; calibrate before map/UI/poster integration. Motion remains PARKED.
