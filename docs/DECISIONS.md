# DECISIONS

Reconstructed from the code and commit history (2026-10-01). Status "Accepted" means the code currently relies on it. Do not reopen casually; if a task conflicts with one, flag it first.

## ADR-001: Providers are normalized before reaching the UI
- Decision: every provider implements `WeatherProvider` and returns `WeatherData`. Components never see raw payloads.
- Reason: swap or add sources (OpenWeather, Open-Meteo, mock) without touching the UI.
- Consequences: new data needs a field in `types.ts` plus a mapping in every adapter (null/optional when a provider lacks it).
- Status: Accepted. Evidence: `provider.ts`, `types.ts` header.

## ADR-002: Provider keys never reach the client
- Decision: provider calls are server-only (`import "server-only"`); search goes through `/api/places`.
- Consequences: the only public env var is `NEXT_PUBLIC_MAPBOX_TOKEN`, restricted by URL in Mapbox.
- Status: Accepted.

## ADR-003: One cached unit per place, shared by everything
- Decision: `load()` in `weather-page.ts` is `"use cache"`, keyed on coordinates rounded to ~1 km; page, metadata, OG image and summaries all call `weatherFor()`.
- Reason: one forecast call per place per refresh window, whoever asks.
- Consequences: revalidate 600 s, expire 1 h so old weather is never shown. Anything per-visitor must stay out of `load()`.
- Status: Accepted.

## ADR-004: Works with no keys (mock provider)
- Decision: default provider is `mock` when no OpenWeather key is set; deterministic scenarios selectable via `?mock=&at=`.
- Reason: design, test and e2e without external services.
- Consequences: e2e runs on `WEATHER_PROVIDER=mock`, with no Mapbox token.
- Status: Accepted.

## ADR-005: Some details come from Open-Meteo whatever the provider
- Decision: yesterday's comparison, pollen, nearby towns and the cloud grid always use Open-Meteo.
- Reason: comparing two services' readings would show their bias as weather change; also cost (one request for many towns).
- Consequences: footer must list sources actually in use. These are optional: slow or missing answers (4 s timeout) are dropped.
- Status: Accepted.

## ADR-006: Measured vs interpolated is explicit on frames
- Decision: `Frame.measured` is true only for provider points; interpolated hours are marked false. Daily `partial` flags min/max that cover only part of a day.
- Reason: do not present estimates as readings.
- Consequences: UI that shows a value as a reading should respect `measured`. Open: how consistently the UI surfaces it (see BOARD).
- Status: Accepted (model); UI coverage unverified.

## ADR-007: Palette and sun position are derived in the browser
- Decision: frames carry condition, phase, light, cloud cover; palettes and sun position are computed client-side (`look.ts`).
- Reason: 100+ frames; payload size.
- Status: Accepted.

## ADR-008: No state library; contexts split by pace of change
- Decision: Timeline / View / Moment contexts; localStorage as guarded external stores. (The last-place cookie was dropped on 2026-10-02, see ADR-010.)
- Reason: scrubbing re-renders only what reads the moment.
- Status: Accepted.

## ADR-009: Maps are Mapbox's alone, and optional
- Decision: no token means no backdrop map, no map chapter, no Territorio chapter. The weather clouds are drawn from the Open-Meteo grid on top.
- Status: Accepted.

## ADR-010: Italian UI, English code
- Decision: all user-facing copy in Italian; code, comments and docs in English.
- Status: Accepted.

## ADR-010: A bare address lands on a random city
- Decision: a visit to `/` with no place in the URL draws a city from a curated list (`lib/weather/random-places.ts`), one per request (React `cache`, so the page and its metadata agree). A place in the URL always wins. Sample data (`WEATHER_PROVIDER=mock`) always lands on the default place so tests stay deterministic. The cookie `weather-place` that remembered the last place is no longer written or read.
- Reason: every visit shows a different poster; the product's identity is the poster of a place, not a dashboard of a home city. Picking a place in search still navigates to its own URL, so reloading that page keeps it.
- The "Città casuale" button (first in the row under the search) draws without a list: `/api/random-place` asks Open-Meteo's geocoding about a batch of random GeoNames ids, keeps the populated places and picks one at random, hamlets included (`lib/weather/random-city.ts`). The landing draw still uses the curated list, for speed.
- Cost: a returning visitor no longer lands where they left. `AutoRefresh` on a drawn city goes to that city's own address (otherwise the 10 minute refresh would draw again).
- Status: Accepted (user request, 2026-10-02). Supersedes the "last place in a cookie" part of ADR-008.

## ADR-011: Map colours are kept apart by distance, not only by contrast with the sky
- Decision: after each layer is made to stand out from the sky, the water, then the buildings (outline and 3D), are compared with the roads (and the buildings with the water) by their distance in OKLab as they show over the sky (`MAP_SEPARATION` 0.1, scaled down when the viewer asked for a fainter map). If one is too close, a variant of its colour is searched, nearest to the intended one first (darker, more vivid or more opaque, a turn of the hue), and the first that clears the gap is taken, else the best found. The roads keep the viewer's hue and are never moved. Results are kept per sky and tuning (`mapInksFor`).
- Reason: buildings and streets came out almost the same colour (both a pale tint of the sky's hue); contrast against the sky alone says nothing about two layers against each other.
- Cost and limit: not always the full gap. Measured over 4 states of sky and many tunings: at the page's own contrast the worst case reaches about 0.72 of the wanted distance (median 0.84), at strong contrast all of it, at a faint one (30) 0.5 at worst. Before, the worst case was a distance of 0.012. The tests assert the minimums the search really gives (65% and 45%), not the target.
- Status: Accepted.

### ADR-011 update (2026-10-02): the whole map, and only what is on show
- The search now covers every group of layers, placed in order of weight after the roads (which never move): water, buildings (outline and 3D), trains, metro, trams, buses' stops, meadows; each gives way to everything placed before it. Only the layers on show are placed (`mapInksFor(sky, tune, active)`); the page's own drawing (the city layers) is what `skyPalette().map` holds, so the palette of every moment stays cheap.
- At most 14 variants that stand out from the sky are tried per group (a variant that does not is dropped without lightening it). Measured: median 4 to 8 ms with the trains, metro, trams and buses on; the distance wanted (0.1 OKLab) is reached in about half to all of the cases with every layer on, always for the water against the roads.
- Mapbox Streets' tiles have buildings from zoom 13, the metro's lines from 11, its stations from 13, the trams and the bus stops from 14. A map that starts closer when such a choice is on was built and removed on the user's decision: they show only as the page comes down.

## ADR-012: Normalized atmosphere precedes visual output
- Decision: WTH-046A introduces a pure `AtmosphereAxes` -> `AtmosphereState` boundary in `atmosphere.ts`. Clarity is derived as `1 - haze`; energy cannot exceed daylight. The constructor rejects invalid internal axes; provider missing-data fallbacks belong upstream in WTH-046B/C.
- Decision: rank positive visual force strengths, using explicit precedence only for exact ties. Absent dominant/secondary forces are null. The signature is explanatory, never a palette selector; continuous axes will drive future colour and hierarchy transforms. No wind-driven colour in V1.
- Reason: distinguish competing phenomena deterministically without a second palette grammar, contradictory haze/clarity controls or fabricated forces at night.
- Consequences: readonly, frozen state; no provider, clock, city or rendering dependency. `WeatherState` and the existing palette remain unchanged until later calibrated integration. See WEATHER_VISUAL_ENGINE.md for axis meanings, scores and tie rules.
- Status: Accepted for the model checkpoint (2026-10-04); numerical grammar remains subject to WTH-046K calibration. No changes to ADR-001/006/007/011.

### ADR-012 update (2026-10-04): measurement normalization
- `visual-input.ts` now owns `WeatherVisualInput` -> `computeAtmosphere()` -> `{ atmosphere, inputStatus }`. It keeps the existing solar phase/daylight gate and normalizes project-unit measurements through bounded curves, independent of providers and rendering.
- Missing/invalid numeric measurements use explicit fallbacks, recorded separately from supplied zero or clamped values. Status `supplied` does not assert that an upstream value was observed. Haze retains fixed contribution weights, so missing visibility cannot amplify humidity into dense fog.
- Combined precipitation is interpreted by the existing condition: snow feeds the snow axis, other/unknown conditions feed liquid wetness. The data cannot recover quantitative mixed-phase fractions or distinguish freezing rain already grouped under snow. This limitation is documented rather than guessed from temperature.
- Coefficients, semantic fallbacks and neutral missing-UV energy are initial calibration choices for WTH-046K. No provider or frame contract changes in WTH-046B; those belong to WTH-046C.

### ADR-012 update (2026-10-04): transport and provenance
- `AtmosphericMeasurements` is shared by current/hourly weather, samples and frames. Humidity, visibility and dew point have optional values and per-field origin; absence is distinct from zero. Existing numeric current-detail fallbacks remain for compatibility but are labelled unavailable and stripped before visual computation.
- Interpolate only when both atmospheric endpoints are available; exact endpoints survive independently. Origin tracks provider/estimated/mock/unknown/unavailable, while `Frame.measured` independently marks temporal interpolation. Free-tier dew-point estimates retain their estimated origin.
- Daily overview frames are explicitly synthetic (`overview: true`, `measured: false`); new normalization excludes daily maxima and placeholder quantities, retaining only semantic conditions and representative solar phase. Existing palette behaviour is unchanged.
- `frameLook()` now derives atmospheric state/input status alongside the existing palette. Generated state is not serialized per frame. Provider abstraction (ADR-001), temporal semantics (ADR-006) and client derivation (ADR-007) are preserved; no weather-driven colour integration until calibration.

### ADR-012 update (2026-10-04): solar base contract
- `solarPalette(light): SolarPalette` replaces the private `clearSky` name inside `palette.ts`; the shared natural-light base remains in the existing engine. `SOLAR_STOPS` retains every previous anchor and the same interpolation.
- The finite input is solar phase (-1..2), not normalized daylight brightness. Output is raw interpolated sRGB sky triples and RGBA glow; weather, UV, accessibility protection and map generation remain downstream in `skyPalette()`.
- No runtime calculation changes. Polar fallbacks remain in `frames.ts`; no new colour system, phase thresholds or astronomical model introduced. The bounded atmosphere transform is WTH-046E, with final visual integration after calibration.

### ADR-012 update (2026-10-04): calibration round one (WTH-046K)
- The signature ranks by strength times weight: cloud 0.6, haze counted only past the transform's onset (0.45, `HAZE_ONSET`), other forces 1. It remains an explanation, driving no colour. Precipitation now outranks a full overcast.
- Haze is led by visibility (0.65, lost between 10 and 1 km), then dew proximity (0.25) and humidity (0.10). Saturated air alone gives 0.35, below the onset. The UV curve is deliberately kept.
- User decision: rain, snow and fog are separate values. Snow has its own intensity scale (full at 2 mm/h of water, rain at 12), the view a fall takes away is the fall's and never haze (`hazeLoss = max(0, visibilityLoss - max(wetness, snow))`), and heat and cold weigh 0.8 in the signature as background. Depth now closes only with fog.

### ADR-013 update (2026-10-04): one layout change confirmed
- WTH-181 (the poster's left column without outlook sentences: name and temperature at the top, the Luogo, Giorno, Ora row at the foot) goes ahead although ADR-013 pauses layout work on the live app: the user confirmed it knowingly. The rest of the pause stands (WTH-017, 018, 022, 009, 015). The outlook stays as screen-reader text and in the share image; WTH-024 is closed.

### ADR-012 update (2026-10-04): map hierarchy (WTH-046G)
- `MapVisualState` (depth, plane weights, saturation, ground lift, water deepening) is computed from the atmosphere by `mapVisualState` and replaces the bare depth argument of `mapInks`/`mapInksFor`/`finishPalette`. Colour effects enter before the separation search; opacity weights and depth act last. Streets, 3D buildings, traffic and lights stay outside the weights. Default `CLEAR_MAP` leaves the live page unchanged. Connecting it to the page (and `MapControls`) is WTH-046L.

### ADR-012 update (2026-10-04): continuous gamut and legibility in the atmosphere path (WTH-046K)
- The atmosphere path uses `fromOklchEdge` and `legibleUnderTextEdge` (bisection) instead of the live page's stepped gamut reduction and 0.01-step darkening, which made a clear noon's sky jump by up to 14/255 between frames seven minutes apart. The live page is unchanged on purpose (its look is shipped); moving it is for WTH-046L.

### ADR-012 update (2026-10-04): atmosphere transform
- `atmosphereSky()` transforms the solar base with the normalized axes through bounded OKLCH operations in a fixed order (white balance and turns, chroma, depth veil, lightness, stop spread, floors, gamut). It shares `finishPalette()` (text protection, glass, markers, map inks) with the live `skyPalette()`, whose output is byte-identical after the split.
- Same-property pulls combine as the strongest in full plus 25% of each other, never as a product, and floors bound the final stops. Temperature is a white-balance offset, not a hue theme. Haze acts only past the 0.45 that saturated air alone gives.
- The white-text contract caps sky lightness near OKLCH 0.5: bright atmospheres (fog, snow) can differ there only by hue, chroma, gradient and glow. The veil stops just above the cap so rain and storm still darken visibly.
- Not on the live page. Calibrated first in the dev-only `/lab/atmosfera` over the shared scenarios in `calibration.ts` (WTH-046K), then integrated (WTH-046L). Constants are calibration values, not final.

## ADR-013: Direction, Visual Weather Records (2026-10-04)
- Decided by the user after a product and positioning review: the weather is the engine, the record is the product. The daily app stays free and is the shop window; records of a place at a meaningful moment, past dates included, are what is sold (digital file and print).
- Why: as a weather app the product enters a saturated, free market; as a poster maker of "now" it has no reason to be bought. Together, a record of a moment that matters, they fit the personalised-poster gift market with an edge no competitor has: real weather in a deterministic visual language.
- Consequences: WTH-046 continues unchanged; the Records track follows it (WTH-166 to WTH-173); layout work on the live app (WTH-017, WTH-018, WTH-022, WTH-009, WTH-015) is paused. Historical weather enters as a provider behind ADR-001 and is shown as reanalysis, not measurement. ADR-010 (Italian UI) is to be revisited for the records flow only (WTH-173). No payment before licences are checked (WTH-166) and demand is validated (WTH-167).
