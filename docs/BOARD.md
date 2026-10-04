# BOARD

The authoritative task list. Adding a task here does not start it. IDs are WTH-nnn, never reused.

Items marked (audit) were noticed while reading the code on 2026-10-01, not requested by the user: they are candidates, to be confirmed before work starts.

## NOW

- [ ] WTH-046 Weather Visual Engine. High-priority product/engineering epic after WTH-012: evolve the existing procedural visual engine into the shared visual language of Visual Weather Records, `PLACE + TIME + WEATHER -> VISUAL RECORD`. Active since 2026-10-04 after user sign-off of WTH-012. WTH-046A/B/C/D implemented; next checkpoint WTH-046E. V1 covers the static system; WTH-046M is PARKED.

#### WTH-046 direction and sequence

Translate weather into colour, hierarchy and atmosphere rather than choosing a palette that looks good with it. Meteorological and solar data must shape the whole composition: sky, atmosphere, contrast, map hierarchy, typography/accent relationships, UI surfaces, poster and future record outputs. The same place, time and relevant weather inputs must produce the same visual state. No random visual generation and no second independent palette system.

Conceptual pipeline: `WeatherData -> WeatherVisualInput -> normalization -> AtmosphereState -> solar base -> OKLCH weather transform -> WeatherVisualPalette -> UI / Mapbox / poster / future outputs`. AtmosphereAxes, AtmosphereState and VisualForce now exist for WTH-046A; WeatherVisualInput and computeAtmosphere exist for WTH-046B; the other pipeline names remain planned, not fixed API shapes. Continuous measurements increasingly drive the result; categorical weather retains semantic value.

Intended execution order for this product track:

```text
WTH-012 -> WTH-046A -> WTH-046B -> WTH-046C -> WTH-046D
        -> WTH-046E -> WTH-046F -> WTH-046K -> WTH-046G
        -> WTH-046H -> WTH-046I -> WTH-046J -> WTH-046L
        -> WTH-017 -> WTH-018 -> WTH-022
WTH-046M: PARKED, outside V1
```

WTH-012 was signed off by the user on 2026-10-04 and is DONE, including WTH-008. WTH-046 is now active. Other existing entries keep their status, text and placement; the sequence above governs this track, including the remaining work on WTH-022. Calibration deliberately precedes final map/system integration. The former follow-on list included WTH-010, already DONE; it is not reopened by this sequence.

Board tooling limitation: `scripts/board/board-md.mjs` recognizes numeric IDs only. WTH-046 is a browser board card; its letter-suffixed subtasks below remain Markdown planning entries preserved by the parser, not independently editable or draggable cards. The parser is unchanged; do not renumber these IDs to work around its limitation.

#### WTH-046 verified foundations and relationships

Planning baseline verified on 2026-10-04, before WTH-046A/B/C (the atmospheric data gap below is now addressed by C):

- `src/lib/weather/palette.ts` already provides `clearSky(light)`, categorical `WEATHER` grey/dim modifiers plus continuous cloud cover, daylight-gated UV vividness/glow, OKLCH operations, text/glass contrast protection, `SkyPalette`, generated map inks and `mapInksFor(sky, tune, active)`. Evolve these foundations, preserving active-layer separation and user tuning (ADR-011), including the documented limits of the separation target.
- `src/lib/weather/state.ts` supplies `WeatherState`; `frames.ts` builds `Sample` and `Frame`; `look.ts` derives `FrameLook` in the browser through `frameLook()`. Keep that client-side derivation and compact frame payload (ADR-007). Current `Frame.light` is a solar progression from -1 to 2, not normalized daylight brightness.
- `src/lib/weather/types.ts` has `CurrentWeather.humidity`, `visibility` (km) and `dewPoint` (degrees C). None is in `HourlyPoint`, `Sample` or `Frame`, so even the current sample drops them. `windGust` is available on current/hourly data but also omitted from samples/frames. `Frame.uv` comes from `uvIndex`; `frameLook()` currently accepts only light, phase, state, cloudCover and uv.
- `src/components/weather/map-style.ts` consumes map inks. `MapContext.tsx` shares place, timezone, Mapbox loading/token and cloud-grid data; it does not own palette generation. `src/components/time/TimeContext.tsx` derives the frame look. `src/components/poster/render-poster.ts` already consumes `SkyPalette` and shares the map style. Preserve this reuse.
- `src/lib/weather/temp-color.ts` supplies the absolute temperature scale (`tempColor`, `tempGradient`), deliberately comparable across places and weeks.

Relationships, without merging, deleting or reopening existing IDs: WTH-009 (tinta options) and completed WTH-010/WTH-150 (map tuning) must remain compatible; WTH-014/WTH-016 (map separation), WTH-019/WTH-021 (transit/road hierarchy), WTH-111/WTH-130/WTH-131/WTH-134 (sky, palette, map and UV) and WTH-142/WTH-154 (poster reuse) are foundations to evolve. WTH-002/WTH-003 concern measured/interpolated and partial-day semantics relevant to WTH-046C. WTH-004/WTH-005/WTH-006 remain separate accessibility, performance and map-coverage audits supporting calibration/integration. WTH-013 concerns phone poster delivery; WTH-017/WTH-018/WTH-022 follow the engine on this track. WTH-015's missing building tiles are a source/zoom issue, not something palette or hierarchy changes can solve.

#### WTH-046 subtasks

- [x] WTH-046A Atmosphere model and visual grammar. Define the canonical normalized `AtmosphereState`: daylight, cloudiness, haze, clarity, wetness, severity, snow and energy in 0..1; warmth in -1..1. Define each axis, its relationship to the others and deterministic conflict resolution through `signature: { dominant: VisualForce; secondary: VisualForce }`, with forces sun, heat, cold, cloud, haze, rain, snow and storm. Document precedence and tie-breaking: 90% clouds with fog must differ from 90% clouds with thunderstorm. Retain `WeatherState` for semantics, icons, narrative, exceptional phenomena and categorical interpretation, while removing its role as primary colour art director. Completed 2026-10-04: `src/lib/weather/atmosphere.ts` defines normalized axes, derived clarity and deterministic ranked forces with explicit ties and nullable absent forces; contract and grammar in `docs/WEATHER_VISUAL_ENGINE.md`, covered by colocated unit tests. Raw measurement normalization and replacement of the current palette use of WeatherState remain later checkpoints.

- [x] WTH-046B Weather input normalization. Specify deterministic continuous curves from normalized provider measurements to atmospheric axes, with units, clamping, missing-data rules and calibrated influence limits. Avoid arbitrary binary thresholds when a curve is appropriate. Completed 2026-10-04 in `src/lib/weather/visual-input.ts`: continuous bounded curves, per-input handling status and deterministic fallbacks, with 20 focused tests. Contract, coefficients, fallback precedence and precipitation-phase limitations documented in `docs/WEATHER_VISUAL_ENGINE.md`. The following remain initial calibration hypotheses, not final constants.

| Measurement | Initial curve / range | Intended behaviour |
| --- | --- | --- |
| Temperature (degrees C) -> warmth | Interpolate a restrained continuous curve through -15:-1.00, -5:-0.80, 5:-0.50, 12:-0.25, 18:0.00, 24:+0.25, 30:+0.60, 36:+0.90, 42:+1.00; clamp to -1..1. | Transform the solar palette rather than assigning blue to cold and orange to heat. Midday: cold slightly cyan, heat subtly warmer/clearer; horizon: cold lilac/pink, heat peach/amber; night: cold indigo, heat slightly violet/ink. A clear 38-degree day must still read as clear sky. |
| Cloud cover (%) -> cloudiness | Ease 0..100 into 0..1, e.g. `smoothstep(0, 1, cloudCover / 100)`. | More cloud reduces chroma, global contrast and solar glow continuously, without PARTLY_CLOUDY/CLOUDY jumps. Even overcast sunset retains underlying solar information. |
| Humidity (%), visibility (km), temperature/dew point (degrees C) -> haze | `humidityFactor = smoothstep(0.45, 0.98, humidity / 100)`; `visibilityLoss = 1 - smoothstep(1.5, 20, visibilityKm)`; `dewProximity = 1 - smoothstep(0, 8, temperature - dewPoint)`; `haze = clamp01(0.55 * visibilityLoss + 0.30 * dewProximity + 0.15 * humidityFactor)`. | Haze is not humidity alone; visibility initially has more weight. 95% humidity with 18 km visibility should yield moderate haze at most; 85% with 2 km should yield strong haze. Calibrate coefficients and dew-point assumptions through scenarios. |
| Precipitation (mm/h) -> wetness | `clamp01(log1p(precipitation) / log1p(12))`, with valid nonnegative input. | The 0-to-1 change matters more than 20-to-21. More wetness lowers lightness/chroma, increases atmospheric density and water prominence, and slightly raises road hierarchy. Graphic interpretation, not photorealistic wet roads. |
| UV -> energy | `daylight * smoothstep(0, 8, uv)` using normalized daylight, not raw `Frame.light`. | More energy increases chroma, glow and sky separation only with solar light. Preserve useful daylight-gated UV vividness and stable behaviour when UV is absent. |
| Condition/intensity and precipitation -> severity | Separate normalized 0..1 axis from wetness; document curve and bounds during calibration. | More severity lowers background lightness/glow and increases local hierarchy/infrastructure separation. Avoid theatrical storm themes. |
| Snow evidence -> snow | Independent normalized 0..1 force, with condition/intensity fallback when quantitative snow data is unavailable. | More snow raises lightness and land/map luminance, reduces chroma/warmth, and keeps water distinct. Rain is darker/denser/deeper; snow brighter/quieter/cooler. Snow must not become cold rain. |

Resolve the specification's wind/severity tension explicitly: gust severity is a possible future severity signal, but V1's rule is that wind must not modify colour, including indirectly through severity. Reserve normalized wind/motion for WTH-046M; do not expand the static V1 scope. Define daylight normalization separately from the existing solar phase coordinate, and define clarity consistently with haze/depth rather than allowing competing undocumented controls.

- [x] WTH-046C Carry atmospheric data through the timeline. Audit provider adapters and propagate humidity, visibility and dewPoint through `WeatherData.hourly` (`HourlyPoint`) -> `Sample` -> `Frame` -> `frameLook()` -> `computeAtmosphere()` (its `atmosphere` result) -> future visual palette, including the current sample. Preserve `WeatherProvider`/`WeatherData` abstraction (ADR-001); never read OpenWeather payloads in the engine. Inspect `transformers.ts`, `openweather.ts`, `openweather-free.ts`, `openmeteo.ts` and `mock.ts` for available values, estimates and defaults. Specify interpolation, units, timestamps, provenance and deterministic fallbacks for absent/invalid measurements and daily overview frames, without presenting estimates as observations or borrowing current atmosphere for every future hour. Retain measured/interpolated semantics (ADR-006); distinguish unavailable signals from measured zero and ensure graceful, stable degradation. Completed 2026-10-04: all four adapters carry atmospheric availability/origin into current and hourly data; Sample/Frame preserve units, missing endpoints and estimated origins; frameLook derives atmosphere for the selected frame. Daily overviews are explicitly synthetic. Existing palette rendering is preserved. Ten new pipeline tests plus model and narrative/activity/window regression suites pass (92 tests total); see `docs/WEATHER_VISUAL_ENGINE.md` for legacy current-detail fallback limits.

- [x] WTH-046D Solar base palette. Formalize `clearSky(light)` as the foundation for a conceptual `solarPalette(light)`: natural light, not weather. Preserve the successful progression night -> blue hour -> dawn -> morning -> solar noon -> afternoon -> golden hour -> sunset -> blue hour -> night, including polar fallbacks. Reuse current interpolation where appropriate; no rewrite solely for naming or architectural purity. Keep solar phase distinct from the normalized daylight axis. Completed 2026-10-04: `solarPalette(light): SolarPalette` now exposes the existing natural-light base in `palette.ts`, with `SOLAR_STOPS` and documented phase/channel contracts. Anchor values, interpolation, polar fallbacks and downstream transformations are preserved; compiled-code equivalence verified. See `docs/WEATHER_VISUAL_ENGINE.md`.

- [ ] WTH-046E OKLCH atmosphere transform. Evolve the existing categorical grey/dim transform into bounded continuous operations. Ownership: solar position sets base lightness/hue; temperature sets restrained warmth/hue shifts; cloud cover sets chroma/global contrast; humidity/visibility/dew point set haze/depth; precipitation sets wetness/luminance; snow sets luminance/cool shift; UV sets chroma/glow; severity sets luminance/local hierarchy. Keep OKLCH unless repository evidence supports another model. Document input range, normalized range, curve, maximum influence, deterministic composition order, gamut protection and accessibility protection for every transform. Resolve competing effects on the same property explicitly instead of stacking unrelated pushes; preserve the recognizability of the solar base.

- [ ] WTH-046F Atmospheric depth. Make fog/haze compress spatial depth rather than apply a grey overlay. A conceptual `depth = 1 - haze` brings sky stops closer, suppresses terrain and background-map contrast strongly, midground contrast moderately, and preserves readable foreground. A foggy city should feel spatially compressed without literal fog texture; the difference should remain visible in grayscale. Exact implementation follows the calibrated grammar.

- [ ] WTH-046G Meteorological map hierarchy. After initial scenario calibration, evolve sky-derived map inks into `sky + AtmosphereState + map semantics -> MapVisualState`. A conceptual contract includes waterWeight, roadWeight, buildingWeight, terrainWeight, depth, contrast and saturation; final shape must fit existing layer types. Preserve active-layer separation, road ranks, user tuning and ADR-011's documented constraints. Weather must change map hierarchy and depth, not just hue: the same city's weather should be distinguishable in grayscale.

| Atmosphere | Expected map behaviour |
| --- | --- |
| Clear | Richer terrain, normal depth, crisp hierarchy, balanced roads and water. |
| Fog | Strongly suppressed terrain/background, softer buildings, readable but restrained roads, compressed depth. |
| Rain | Stronger water, quieter terrain, slightly stronger roads, darker/denser atmosphere. |
| Snow | Brighter land, cooler/quieter chroma, restrained infrastructure, clearly separated water. |
| Storm | Compressed background, deeper overall scene, more graphic infrastructure and stronger local hierarchy, reduced glow. |

- [ ] WTH-046H Unified visual palette contract. Evaluate evolving `SkyPalette` into a whole-record `WeatherVisualPalette`, not adding a parallel grammar. Conceptually include sky (top/middle/horizon/glow), atmosphere (haze/brightness/contrast/chroma/warmth), surfaces (glass/text/mutedText/accent) and `map: Record<MapLayer, MapInk>`. Preserve or compatibly migrate existing sky1/sky2/sky3, sun/cloud markers and map ramps as required by real consumers; do not mandate the illustrative shape. One weather visual state must drive UI, Mapbox, poster and future outputs, with pure client-side derivation preserved.

- [ ] WTH-046I Temperature colour integration. Review `temp-color.ts` and its consumers, distinguishing absolute semantic/quantitative colour from atmospheric accents. Temperature charts and cross-city/time comparisons may retain a stable absolute scale; integrate appropriate decorative/accent uses with the engine. Preserve information design and quantitative comparability. Seek coherence, not forced sameness or a second independent visual grammar.

- [ ] WTH-046J Weather Fingerprint. Define a deterministic internal representation of a record's visual DNA, conceptually light, warmth, cloud, haze, wet, snow, severity and energy. Document normalization and precision so the same relevant place/time/weather inputs yield the same fingerprint. Keep its light coordinate unambiguous relative to solar phase and normalized daylight. No V1 UI required; allow later record/poster metadata, comparisons, archives, collections, fingerprint graphics and similarity between records without implementing those products now.

- [ ] WTH-046K Scenario calibration suite. Critical gate after WTH-046F and before WTH-046G/H/L. Specify fixtures and initial calibration before final map/system integration, then reuse and extend the suite as map hierarchy and shared consumers are connected. Do not tune arbitrary constants against one city's appearance. Each fixture records `WeatherVisualInput -> expected AtmosphereState -> dominant force -> secondary force -> expected visual behaviour`.

Required scenarios: clear summer noon; winter dawn; dense fog; light rain; heavy rain; thunderstorm; snow; clear sunset; overcast night; dry heat. Add geographically varied archetypes: humid/foggy Milan, intense Mediterranean sun, rainy maritime city, snowy northern city and humid subtropical night. These are measurement-driven scenarios, never city presets or city-name conditionals.

Test deterministic output, normalized ranges, monotonic relationships with other inputs held fixed, relative transformations, visual hierarchy, contrast/accessibility, map ordering/separation and graceful missing-data behaviour, not only exact hex snapshots. Invariants: more clouds cannot increase solar glow; lower visibility cannot increase atmospheric depth; heavier rain cannot look drier; higher haze cannot strengthen distant layers; snow cannot behave identically to rain. Include grayscale comparisons, timeline transitions and conflicting forces; preserve realistic separation guarantees instead of claiming an always-reached target.

- [ ] WTH-046L Map / poster / UI integration. Only after calibration, connect the shared state to live sky/background, UI surfaces, appropriate typography/accents, Mapbox, poster rendering and share/export outputs. Screen and exported poster must represent the same selected place and moment through the same weather visual state. Keep `automatic weather visual state -> user map tuning -> final map`: tuning adjusts rather than replaces weather-derived logic. Preserve layer choices, map view and existing poster reuse of shared inks; verify deterministic parity, contrast, timeline behaviour, missing-data fallbacks and operation without a Mapbox token. Do not couple visual generation to MapContext's provider/cloud-grid fetching.

- [ ] WTH-046M Future motion layer. PARKED, explicitly outside Weather Visual Engine V1 and its completion criteria. The normalized model may reserve `motion` from wind speed/gusts for future cloud motion, gradient movement, atmospheric grain, particles and subtle environmental/map animation. Static visual language comes first; no motion implementation or wind-driven colour changes in V1.

#### WTH-046 acceptance principles

1. **Data -> visual:** trace important visual decisions to meteorological or solar inputs.
2. **Deterministic:** the same relevant inputs produce the same state; no random palettes.
3. **Continuous:** prefer curves over categorical themes such as clear=blue, cloudy=grey, rain=dark blue, snow=white.
4. **Solar light is the canvas:** time and solar position establish the scene; weather transforms it.
5. **Map is weather:** change map hierarchy and depth, not merely colour, including in grayscale.
6. **One visual language:** sky, UI, Mapbox and poster derive from the existing system as it evolves.
7. **Weather state is semantic:** keep categories useful without making them the primary colour generator.
8. **Provider agnostic:** consume normalized project weather data, never raw provider payloads.
9. **Accessible:** preserve and extend existing contrast and legibility guarantees.
10. **Explainable:** explain each record's appearance through its meteorological and solar inputs.
11. **Information before decoration:** never distort quantitative information for attractive output.
12. **Weather Record first:** express this place, this moment and this atmosphere as a visual record, beyond themed weather-app colours.

## NEXT

- [ ] WTH-001 (audit) AQI provenance: OpenWeather gives its own 1-5 index, Open-Meteo's index is computed from concentrations (`airIndexOf`, `details.ts`). Decide whether the UI should say which, and whether the two scales are comparable.
- [ ] WTH-002 (audit) Surface `Frame.measured`: check where the UI shows an interpolated hour as if it were a reading.
- [ ] WTH-003 (audit) Validate min/max semantics: `DailyPoint.partial`, `tempRange` (`today.ts`), `days.ts` filtering of partial days, on 3-hourly providers.

- [ ] WTH-009 More variety of colours in the "tinta" menu of the colour tuning.
- [ ] WTH-022 Phone: poster and map in view, data in sheets. Done so far (2026-10-02): a floating bar of clear glass (Meteo, Modifica mappa, Poster: solid icons, names, the page on show in the temperature's colour, a lens that slides stretching), hidden while a sheet is open; one Sheet component (`components/layout/PhoneNav.tsx`) for Meteo and Mappa that follows the finger; the map's panel as colour chips (also on a computer, in glass); the poster maker in the same glass; the page still, the finger moving the map (vertical: down into the city, a quarter of the screen for the whole way; sideways: turns it; "Ricentra"); the quick facts moved into the Meteo sheet. Next: the iPhone layout of the main page. Not checked: by day, a real finger, the poster drawn turned.
- [ ] WTH-024 Review the outlook's sentences ("Previsione", narrative engine in `lib/weather/narrative.ts`): the user does not like how they read. Not now; to be planned with the user (tone, length, what to say first).
- [ ] WTH-013 Poster on a phone: the actions are now docked to the foot of the screen (`HeroActionsDock`, always visible while scrolling). Still to decide and check on a real phone: the poster dialog on a small screen, how the file is delivered (share sheet or download, see `share()` in `PosterButton.tsx`), formats, canvas size limits and memory.
- [ ] WTH-015 Show the buildings from above too, the 3D ones included. Not solved: Mapbox Streets' tiles have buildings only from zoom 13 (and the trams and bus stops from 14), and the page's top is zoom 11. Starting the map closer when such a choice is on was tried and removed on the user's decision (2026-10-02); what is left is to decide how to have them from the top, if at all (a closer start for everyone, or a different source).
- [ ] WTH-017 Redefine the layout of the left column (the poster): head, name, temperature, low and high, glyph, outlook and the room left for the map, as one composition (continues WTH-012).
- [ ] WTH-018 Make the right column (the weather information) more Swiss editorial: the same font as the left, a more elegant arrangement on the page (timeline, quick facts, air, activities, week, details).

## LATER

- [ ] WTH-004 (audit) Accessibility audit (timeline scrubber, map controls, contrast on every sky palette).
- [ ] WTH-005 (audit) Performance audit (frame payload size, Mapbox bundle, first paint on phone).
- [ ] WTH-006 (audit) E2E coverage of the map chapter: e2e builds without a Mapbox token, so the maps are untested.
- [ ] WTH-007 (audit) PWA: manifest exists; offline and install behaviour not verified.

## DONE

Rebuilt on 2026-10-02 from git history (13 commits, 2026-09-24 to 2026-10-01), grouped by theme and ordered by when each theme first appears. Each line says what was done and in which commit; "first build" is `1a90650`, which shipped the whole first version at once. The reasons behind choices are in DECISIONS.md where known; here only what the code and commit messages show.

### Recenti

- [x] WTH-012 Typographic poster pass on the reading's top (desktop and phone): the two actions on a top line, head set in the poster's own font with labelled facts, hour and date reworked, name tinted a touch off white, the block right of the temperature as a ruled table. Includes WTH-008 (buttons). User sign-off: 2026-10-04.
- [x] WTH-008 Give character to the "Crea poster" and "La mappa" buttons: they should stand out and feel part of the poster identity. Completed within WTH-012; user sign-off: 2026-10-04.
- [x] WTH-023 A compass (a hairline ring, a needle in the colour of the temperature, pointing at north as the map is turned) with the point the map faces beside it (N, NE, SO...): on a computer in the poster's head between the two actions, on a phone under the search button, and at the poster's foot with the same point. The turn is the viewer's on a computer too: drag sideways across the poster's field with the mouse, the arrow keys on the compass, a click on it for north. The poster follows. The page's footer set in rows; the poster's map credits under its wordmark. Not checked: by day, a real finger, the keys
- [x] WTH-025 The weather data as tiles, in the style of the system's Weather app (2026-10-02): hours, quick facts, Territorio's lists, activities, the week, the map, each detail (two to a row, three on a wide column) and the footer are tiles of faint light with rounded corners and a hairline of light on top, close together; same on a computer and in the phone's Meteo sheet. Territorio gains the country and the capitals (of the country and of the region) as links with their weather. "Ricentra" moved left of the search button. Not checked: by day, a real finger
- [x] WTH-027 Poster: name and country (bold capitals) in the colour of the temperature; latitude and longitude as two labelled columns; the colour bar on an even grid, the sky's row first
- [x] WTH-026 Territorio right after the timeline (in the Meteo sheet on a phone), with the capitals of the country and the region, the population with its year, and the towns around as the two best known then the nearest (`lib/city-facts.ts`). Checked on Milan only: Wikidata was rate-limiting during an outage
- [x] WTH-010 "La mappa" panel redesigned with the user from three prototypes (mix of A and B): the three colour sliders on one row at the top, then the layers as words (light when off, extra bold and in their colour when on, a bar of the exact colour under each), groups ruled with their counts, a line at the foot saying what the word touched does; text actions "Torna agli automatici" and "Chiudi" (`MapControls.tsx`)
- [x] WTH-021 A light shadow under each rank of road (follows its choice: off with the roads), stronger on the poster; the poster's colour bar drops the shadows and the relief and is set as fine bars with small capitals (`map-style.ts`, `render-poster.ts`)
- [x] WTH-020 The choice "Nomi delle acque" removed from the map panel, with its two label layers, their colours and the glyphs of the style: the map draws no words
- [x] WTH-016 Colours of the map's layers kept apart as a whole: the layers on show are placed in order of weight (roads fixed, then water, buildings, trains, metro, trams, buses, meadows), each looked for among variants of its colour until it clears a distance in OKLab from everything placed before it; only the layers on show count (`mapInksFor(sky, tune, active)`, ADR-011 extended). Median 4 to 8 ms; the distance wanted is not always reached (about 0.5 to 1.0 of it with every layer on)
- [x] WTH-019 "Ferrovie" replaced by trains, metro, tram and bus, each a choice with its own colour: plain lines, and stops as dots (stations of the trains and the metro, the trams' and the buses' stops). The buses have stops only, no routes: Mapbox Streets has none. Trams and bus stops are in the tiles only from zoom 14, so they show only when the page has come down. A stored "rail" choice becomes trains
- [x] WTH-014 Buildings in 3D as an option of "La mappa" ("Edifici 3D": extruded volumes as tall as they are, from zoom 13, seen when the map tilts), and the colours of water, roads and buildings kept apart by measuring their distance in OKLab as they show over the sky and searching a variant (darker, more opaque, turned hue) when too close (`palette.ts`, `map-style.ts`; ADR-011)
- [x] WTH-011 A bare address lands on a random city (a different one at each visit; a place in the URL wins; sample data keeps Milano), and a "Città casuale" button draws a populated place from the whole world through random GeoNames ids, hamlets included (`lib/weather/random-places.ts`, `random-city.ts`, `/api/random-place`; ADR-010)
- [x] WTH-164 Interactive board in the browser (`npm run board`): columns, drag and drop, edits written to docs/BOARD.md (`scripts/board/`)

### Foundation: data

- [x] WTH-100 Provider abstraction with four providers: OpenWeather One Call 4.0, OpenWeather free tier, Open-Meteo, and a mock with ten scenarios (first build, `1a90650`)
- [x] WTH-101 Normalized `WeatherData` model and the timeline of frames sent to the browser, with a `measured` flag per frame (first build)
- [x] WTH-102 One cached unit per place: `"use cache"` on rounded coordinates, 10 minute revalidation, auto refresh in the page (first build)
- [x] WTH-103 Server routes: place search, saved-place summary, cloud grid, share image; keys stay on the server (first build)

### Foundation: the page

- [x] WTH-110 The poster reading: place name large, temperature beside it, hairlines, desktop pinned left, chapters scrolling right (first build)
- [x] WTH-111 The sky: background palette following the time of day and weather, with the local clock (first build)
- [x] WTH-112 24 hour timeline you drag, with the whole page following the hour; day picker (first build)
- [x] WTH-113 The week: daily ranges on a temperature colour scale, pick a day to explore it (first build)
- [x] WTH-114 Outlook in words (narrative engine) and a sentence for each moment and day, covered by snapshot tests (first build)
- [x] WTH-115 Details almanac: air quality, UV, wind, humidity, sun and moon, official alerts; urgent ones promoted up the page (first build)
- [x] WTH-116 Precipitation timeline for the near term (first build)
- [x] WTH-117 Mapbox city map fixed behind the page, and a map chapter with clouds and rain animated from a grid (first build)
- [x] WTH-118 Places: search, saved places, last place remembered in a cookie, link per place (first build)
- [x] WTH-119 Share previews (generated image per place), web manifest and icons, error and loading states (first build)

### Data quality

- [x] WTH-120 Air called poor from the third band of the index (WHO guideline reasoning); scale relabelled; promoted as an alert and mentioned in the outlook (`54b055e`, 2026-09-29)
- [x] WTH-121 Today against yesterday at the same hour, from one source (Open-Meteo) whatever the provider (`e2c12fe`, 2026-09-30)
- [x] WTH-122 Pollen by family among the details, promoted when high; Europe only (`e2c12fe`)
- [x] WTH-123 Sample forecast runs 48 hours so a day picked in the week has hours of its own (`e2c12fe`)

### Visual identity

- [x] WTH-130 Palette rework: one family of pastels at a single OKLCH lightness for sky, temperature scale, UV and air bands, icons; cards become hairline editorial blocks; two fonts (`cd1d06f`, 2026-09-29)
- [x] WTH-131 Map behind the page in the colours opposite the sky, with a contrast target tested at every hour; veils behind reading and data (`cd1d06f`)
- [x] WTH-132 Wordmark, site named what-weather, search docked into a round button on scroll (`c51da04`, 2026-09-29)
- [x] WTH-133 Phone fixes: 16px search field against Safari zoom, no sideways panning, map that does not jump with the address bar, title sized to the temperature (`c51da04`)
- [x] WTH-134 Sky as vivid as the UV index is high, by day (`e2c12fe`)

### Features

- [x] WTH-140 Footer crediting each kind of data to the service that served it, Open-Meteo CC BY 4.0 (`c51da04`); later extended for Mapbox, Wikidata and Open-Meteo extras
- [x] WTH-141 Map clouds and rain cover the next 12 hours (`c51da04`)
- [x] WTH-142 Downloadable poster of the place in the colours of the moment, three formats (A-series, 9:16, square), PNG (`07410fb`, 2026-09-30)
- [x] WTH-143 "Territorio" chapter: rank, altitude, population, waters and peaks from Mapbox and Wikidata, cached per request, failures never cached (`6d49edf`, 2026-09-30)
- [x] WTH-144 Week folded to three days, the rest on request (`6d49edf`)
- [x] WTH-145 Best hours outdoors: each hour scored (feels-like, rain chance, wind, UV), best stretch marked on the timeline and per day (`e2c12fe`)
- [x] WTH-146 Activities chapter: walk, run, bike ride, trek with their own profiles, following the day picked in the week (`e2c12fe`)
- [x] WTH-147 Timeline curve can show rain chance, wind or UV instead of temperature (`e2c12fe`)
- [x] WTH-148 Towns around with their weather now, in Territorio, which moves below the details (`e2c12fe`)
- [x] WTH-149 Recently seen places in the search (`e2c12fe`)
- [x] WTH-150 Map colours tuned by the viewer: hue, intensity, contrast, remembered in the browser and carried onto the poster (`e2c12fe`)
- [x] WTH-151 Reading as the phone's first screen: hour, name and temperature centred over the city, outlook at the foot, title sized to its own width (`82378ff`, 2026-10-01)
- [x] WTH-152 Map layers chosen from one panel "La mappa" (water, names, roads, optional meadows, relief, contours, rails, buildings, traffic, night lights); extras cost no tiles until chosen (`ccd4e85`, 2026-10-01)
- [x] WTH-153 Scrolling eases into the city and tips the map as it arrives; the sun's real position drives shading, shadows and night lights (`ccd4e85`)
- [x] WTH-154 Poster made from the view on screen: same zoom, tilt and layers, with a colour bar naming each colour (`ccd4e85`)

### Quality and tooling

- [x] WTH-160 Unit tests (Vitest): formatters, narrative, palette, precipitation, best window, activities, pollen, yesterday, sun position, map style, map view, map options (across commits)
- [x] WTH-161 End-to-end tests (Playwright in installed Chrome, built with sample weather and no Mapbox token): reading, timeline by keyboard and click, week, activities, search, saved and recent places, pollen, two phone checks (`56e9a8b`, 2026-09-30)
- [x] WTH-162 Next.js and ESLint config updated to 16.3.7, the 30 September security release (`be88d43`)
- [x] WTH-163 README with live link and share previews of four places (`9a0f548`, `32867f9`, 2026-09-29)
