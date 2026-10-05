# ARCHITECTURE

Factual, from the code as of 2026-10-05. If code and this file disagree, the code wins: fix this file.

## Stack

Next.js 16.3.7 (App Router, `cacheComponents: true`), React 19.2, TypeScript 5, Tailwind CSS 4, Mapbox GL JS 3, Vitest 3 (unit), Playwright (e2e, drives the installed Chrome). Node >= 22. Deployed on Vercel. UI copy is Italian, code and comments are English.

Next.js here has breaking changes: read `node_modules/next/dist/docs/` before writing Next-specific code (see AGENTS.md).

## Data flow

```
URL (?lat&lon&name..), else a random city (src/lib/weather/random-places.ts); sample data: DEFAULT_PLACE (Milano)
  -> src/lib/weather-page.ts  loadWeatherPage()  -> weatherFor() -> load()   ["use cache", tag weather:lat,lon]
       -> getProvider()  (src/lib/api/providers/get-provider.ts)
            openweather | openweather-free | open-meteo | mock     (each implements WeatherProvider)
       -> provider.getByCoords()  ->  WeatherData  (src/types/weather.ts)
       + sinceYesterday()  (src/lib/api/sources/yesterday.ts: Open-Meteo, any provider)
       + lookupPollen()    (src/lib/api/sources/pollen.ts: Open-Meteo air-quality, any provider, Europe only)
       -> buildTimeline(data)  (frames.ts)  ->  Timeline / Frame[]
  -> src/app/page.tsx (server component) -> client providers -> UI
```

Rules that hold today:
- Raw provider payloads never leave their adapter. Components read `WeatherData` or `Frame`.
- Units are fixed in `src/types/weather.ts`: degC, km/h, hPa, km, mm/h, probabilities 0..1, times in Unix seconds UTC.
- Provider keys are server-only (`import "server-only"`, on every module under `src/lib/api/providers/` and `src/lib/api/sources/` that does I/O; `provider.ts` is types only). The only public env var is `NEXT_PUBLIC_MAPBOX_TOKEN`.

## Providers (`src/lib/api/providers/`)

| File | Source | Notes |
| --- | --- | --- |
| `openweather.ts` | One Call 4.0 (paid) + Air Pollution API | default when `OPENWEATHER_API_KEY` is set |
| `openweather-free.ts` | Current Weather + 5 day / 3 h forecast | coarser: 3-hourly points; daily is built from them, edge days flagged `partial` |
| `openmeteo.ts` | Open-Meteo forecast + air-quality | hourly, 8 days, UV, 15-minute precipitation; AQ index is computed here |
| `mock.ts` | deterministic scenarios | default with no key; `?mock=<scenario>&at=HH:MM`; also forced in dev when a valid scenario is in the URL |

`get-provider.ts` is the factory: `WEATHER_PROVIDER` picks explicitly. `provider.ts` is the `WeatherProvider` contract, `openweather-transformers.ts` holds the OpenWeather raw -> normalized mapping (private to the adapters, ADR-001). `openmeteo.ts` and `openweather-free.ts` reuse helpers of `openweather.ts` (`loadFresh`, `round`, `WeatherProviderError`) and `openmeteo.ts` its reverse geocoding (`lookupPlace`): see WTH-188.

## Sources and calls (`src/lib/api/`)

Three kinds of external call, kept apart (ADR-014):
- `providers/`: the `WeatherProvider` implementations above (server only).
- `sources/`: upstreams used regardless of provider, not behind `WeatherProvider` (server only, `import "server-only"`): Open-Meteo for yesterday's comparison (`yesterday.ts`), pollen (`pollen.ts`), nearby towns (`nearby.ts`), the map's cloud grid (`cloud-grid.ts`) and the random city (`random-city.ts`); Mapbox + Wikidata for the "Territorio" chapter (`city-facts.ts`). `yesterday.ts` and `random-city.ts` hold only the request: the pure logic (`changeSinceYesterday`, `yesterdayWords`, `pickCity`) stays in `src/lib/weather/` with its tests, without `server-only`, so the browser can import it (`WeatherHero` takes `yesterdayWords`).
- `places.ts`, `summary.ts`, `random-place.ts`, `clouds.ts` (directly in `src/lib/api/`): the browser's calls to our own `/api/*` routes, with the per-visit memo of the summary and cloud requests. No server code here: a client component must never import from `providers/` or `sources/` (the build fails on `server-only` if it does). No barrel files.

## Shared types (`src/types/`)

Types are declared with `type`, never `interface` (ESLint, ADR-014). A type lives in `src/types/` when two or more areas use it as a data model, one file per area, no values and no imports from logic modules (an ESLint rule enforces both):
- `weather.ts`: `WeatherData` and its parts (`Place`, `CurrentWeather`, `HourlyPoint`, `DailyPoint`, `AirQuality`, `Pollen`, `Condition`, ...). The units are in its header.
- `timeline.ts`: `Frame`, `Timeline`, `DayTimeline`, `DayLabel`, `BestWindow`.
- `sky.ts`: `WeatherState`, `DayPhase`, `SunEvent`.
- `palette.ts`: `SkyPalette`, `MapInk`, `MapLayer`, `MapVisualState`.
- `place.ts`: `PlaceRef`, `PlaceSummary`. `map.ts`: `CloudGrid`, `Mapbox`.
Stay beside their module: the result or contract of a single module that one other area reads (`FrameLook`, `ActivityOutlook`, `TempRange`, `WeatherProvider`), the atmosphere engine's contracts (`AtmosphereAxes`, `WeatherFingerprint`: they change with the calibration, ADR-012), types derived from a value (`MapOption`, `MockScenario`) and the raw OpenWeather payloads (private to the adapter, ADR-001). Component props stay in their component.

## WeatherData and the timeline

- `WeatherData`: place, timezone (IANA or fixed offset), current, minutely (nullable), quarterHourly (nullable), hourly, daily, airQuality (nullable), alerts, pollen.
- Current/hourly data now carry optional atmospheric humidity, visibility and dew point, with per-field origin metadata. Samples/frames preserve missingness and interpolate only between available atmospheric endpoints; current-detail legacy defaults are excluded. `Frame.overview` marks synthetic daily representatives with `measured: false` (WTH-046C, 2026-10-04).
- `frames.ts` (`buildTimeline`) turns it into a `Timeline` of 100+ `Frame`s sent to the browser. A frame has `measured: boolean`: true for a provider point, false for an hour interpolated between two. Atmosphere (`visual-input.ts`), palettes, sun position and condition labels are derived client-side (`look.ts`, `palette.ts`, `state.ts`) to keep the payload small.
- Pure logic with tests: `narrative.ts` (the outlook sentence), `activities.ts`, `best-window.ts`, `palette.ts`, `precipitation.ts`, `details.ts` (pollen levels), `sun-position.ts`, `formatters.ts`, `yesterday.ts`, `random-city.ts`, `map-style.ts`, `map-view.ts`, `map-options.ts`.

The palette now exposes `solarPalette(light): SolarPalette` (WTH-046D): the unchanged natural-light anchors/interpolation, before weather, UV, contrast protection and map inks. Its -1..2 phase input is distinct from 0..1 atmospheric daylight.

The palette has two ways of weathering that base, sharing one finish (`finishPalette`: text protection, glass, markers, map inks). The page's is `atmospherePalette` (WTH-046E, section 6) = `atmosphereSky` (bounded OKLCH transforms of the normalized `AtmosphereAxes`) + finish, called by `frameLook` for every frame since WTH-046L: it draws from the weather's continuous axes, with continuous gamut reduction and text protection, and carries `air` (the weather's say on the map: plane weights, saturation, ground lift, depth) so the page's map, the viewer's tuned map and the poster draw one weather. The other, `skyPalette` = `stateSky` (WeatherState grey/dim, UV vividness) + finish, is no longer used by the page: it stays as the dev-only lab's "Oggi" reference and in tests.

## Caching

- `load()` in `weather-page.ts` is the single cached unit per place: `"use cache"`, coordinates rounded to 2 decimals (~1 km, `COORD_PRECISION`), `cacheLife` revalidate 600 s, expire 3600 s, stale 300 s. Mock uses `cacheLife("seconds")`.
- The page, `generateMetadata`, `/api/og`, `/api/summary` all go through `weatherFor()` so they share one entry.
- Other cached units: place search (`/api/places`, 1 day revalidate), cloud grid (1 h), nearby towns, city facts.
- Constants live in `src/lib/weather/constants.ts`.

## Routes

| Route | Purpose |
| --- | --- |
| `/` (`src/app/page.tsx`) | the poster page; server component, reads searchParams |
| `/lab/atmosfera` | dev-only calibration lab for the Weather Visual Engine (both palette engines over the calibration scenarios); `notFound()` in production |
| `/api/places` | place search, runs server-side so keys stay hidden |
| `/api/summary` | small summary for a saved place's card |
| `/api/clouds` | cloud and precipitation grid for the map animation |
| `/api/random-place` | a city drawn at random from the whole world, never cached |
| `/api/og` | share image (ImageResponse) for a place |
| `manifest.ts`, `error.tsx`, `loading.tsx` | PWA manifest, error and loading states |

## Client state (`src/components/`)

No state library. React contexts and external stores:
- `time/TimeContext.tsx`: three contexts at different paces (Timeline fixed per place, View = next 24 h or one picked day, Moment = hour on show). The page remounts the provider with `key={lat,lon}` on a new place.
- `location/PlaceContext.tsx`, `weather/MapContext.tsx`.
- localStorage (guarded, exposed as external stores): saved places (`lib/saved-places.ts`), recent places, map tuning (`lib/map-tuning.ts`, key `weather:map-hue`), map layer options (`lib/map-options.ts`).
- No place cookie: a bare address draws a random city (ADR-010); `/api/random-place` draws one from the whole world for the "Città casuale" button.

## UI structure

- `app/page.tsx` composes: `Sky` (palette background), `MapBackdropGL` (fixed Mapbox city behind the page), `WeatherHero` (the poster reading), `TimeScrubber`, then chapters: urgent items (alerts, precipitation, promoted details), `Activities`, week (`DailyForecast`), map (`MapView`, only with a Mapbox token), details (`Almanac`), `Territory` (streamed in `Suspense`), `SiteFooter` (lists sources actually in use).
- Desktop: hero pinned left, chapters scroll right. Phone: the reading is the first screen.
- `components/poster/`: the downloadable poster (canvas render).

## Tests

- Unit: `src/**/*.test.ts` (Vitest, node env, `server-only` stubbed).
- E2E: `e2e/*.spec.ts`, built with `WEATHER_PROVIDER=mock` and no Mapbox token, port 3100. Desktop and phone (Pixel 7) projects.
- Commands: `npm test`, `npm run test:e2e`, `npm run lint`, `npm run build`.
