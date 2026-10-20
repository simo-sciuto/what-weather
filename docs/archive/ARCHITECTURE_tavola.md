# ARCHITECTURE

Factual, from the code as of 2026-10-20 (WTH-310: rewritten for ADR-029, D3). If code and this file disagree, the code wins: fix this file.

## Stack

Next.js 16.3.7 (App Router, `cacheComponents: true`), React 19.2, TypeScript 5, Tailwind CSS 4, Mapbox GL JS 3, Vitest 3 (unit), Playwright (e2e, drives the installed Chrome). Node >= 22. Deployed on Vercel. UI copy is Italian, code and comments are English.

Next.js here has breaking changes: read `node_modules/next/dist/docs/` before writing Next-specific code (see AGENTS.md).

## Data flow

```
URL (?lat&lon&name..&t), else a random city on `/` (src/lib/weather/random-places.ts) or DEFAULT_PLACE on `/crea`; sample data: DEFAULT_PLACE (Milano)
  -> src/lib/weather-page.ts  loadWeatherPage()  -> weatherFor() -> load()   ["use cache", tag weather:lat,lon]
       -> getProvider()  (src/lib/api/providers/get-provider.ts)
            openweather | openweather-free | open-meteo | mock     (each implements WeatherProvider)
       -> provider.getByCoords()  ->  WeatherData  (src/types/weather.ts)
       + sinceYesterday()  (src/lib/api/sources/yesterday.ts: Open-Meteo, any provider)
       + lookupPollen()    (src/lib/api/sources/pollen.ts: Open-Meteo air-quality, any provider, Europe only)
          (a past moment, for the Records track: getHistoricalProvider().getAt() -> the same WeatherData
           with `reconstruction`, see "Historical weather" below)
       -> buildTimeline(data)  (frames.ts)  ->  Timeline / Frame[]
  -> src/components/tavola/TavolaPage.tsx (server component, used by app/page.tsx and app/crea/page.tsx) -> client providers -> UI
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
| `openmeteo-archive.ts` | Open-Meteo historical API (reanalysis: ECMWF IFS from 2017, ERA5 before) | the weather of a past moment, as a reconstruction (`HistoricalProvider`, `getHistoricalProvider()`); for the Records track, not the page |
| `mock.ts` | deterministic scenarios | default with no key; `?mock=<scenario>&at=HH:MM`; also forced in dev when a valid scenario is in the URL |

`get-provider.ts` is the factory: `WEATHER_PROVIDER` picks explicitly. `provider.ts` is the `WeatherProvider` contract, `openweather-transformers.ts` holds the OpenWeather raw -> normalized mapping (private to the adapters, ADR-001). `openmeteo.ts` and `openweather-free.ts` reuse helpers of `openweather.ts` (`loadFresh`, `WeatherProviderError`; the rounding is `roundCoord`, `coordinates.ts`) and `openmeteo.ts` its reverse geocoding (`lookupPlace`): see WTH-188.

### Historical weather (WTH-168)

`HistoricalProvider.getAt(lat, lon, at, place?)` (`provider.ts`), implemented by `openmeteo-archive.ts` over Open-Meteo's historical API, returns the same `WeatherData` the timeline takes: `current` is the hour asked for (the nearest whole hour), `hourly` the 48 hours after it, `daily` the days round it, with `sunrise`/`sunset` of the day that holds the hour. The timeline is anchored on `d.current.time`, not on the clock, so `buildTimeline`, `frameLook` and the fingerprint work on a record unchanged. What is new is `WeatherData.reconstruction` (`kind` `reanalysis` for ERA5 or `forecast-archive` for the IFS, the model, its resolution in km, a confidence by the date's age, the moment asked for and every quantity the model has no value for in the hours kept): a record's weather is a model's account of a grid cell, never a measurement of the place, and anything built on it says so (rule 7). The model is chosen by date and named, not left to the provider: ECMWF IFS (9 km, the operational model's own runs as Open-Meteo assembles them, 4 a day) from 2017, ERA5 (25 km, a reanalysis) before (ERA5-Land alone lacks cloud, rain and wind). An hour with no temperature or no weather code is left out and the timeline interpolates over it. Two faults of the archive are corrected here, both found on real answers for other dates than summer 2003: its days are cut at a fixed offset from UTC, the one in force today (`utc_offset_seconds` was 7200 for Berlin in November 1989, when it was 3600), so the days, minima, maxima and gusts are taken from the hours, cut by the clock the place kept (`localDayBounds`), with a day the hours do not cover whole marked `partial`; and its `is_day` can be wrong for a whole day (all 120 hours of Washington, 28 August 1963 were 0), so day and night come from the sun's own times, which are right. Moments less than 10 days old are refused (the data has not settled; the forecast has them). Cache: a year for dates older than 100 days, a day for the rest. No chance of rain (a reanalysis has none): 0 or 1 from the amount. No air quality, alerts, minutely or 15-minute data; visibility and UV come back empty from every model, so haze for a record rests on humidity and dew point alone. Free for non-commercial use only: see `docs/LICENCES.md`.

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

## Utils (`src/utils/`)

Generic helpers that know nothing of weather, one file per area (ADR-014), each with its test: `math.ts` (`clamp`, `clamp01`, `lerp`, `smoothstep`, `mod`, `toRadians`, `toDegrees`), `color.ts` (`hexToRgb`, `hexToRgba`), `string.ts` (`capitalize`, `slug`). Domain functions stay in their modules: `formatters.ts`, `palette.ts` (its own `rgba`, `mix`, `scale` work on colour tuples and keep their names), `fingerprint.ts`, `coordinates.ts` (`roundCoord`, the one rounding that the page's cache key and every provider share, ADR-003). A helper that takes the weather's meaning is not a util. No barrel files.

## WeatherData and the timeline

- `WeatherData`: place, timezone (IANA or fixed offset), current, minutely (nullable), quarterHourly (nullable), hourly, daily, airQuality (nullable), alerts, pollen.
- Current/hourly data now carry optional atmospheric humidity, visibility and dew point, with per-field origin metadata. Samples/frames preserve missingness and interpolate only between available atmospheric endpoints; current-detail legacy defaults are excluded. `Frame.overview` marks synthetic daily representatives with `measured: false` (WTH-046C, 2026-10-04).
- `frames.ts` (`buildTimeline`) turns it into a `Timeline` of 100+ `Frame`s sent to the browser. A frame has `measured: boolean`: true for a provider point, false for an hour interpolated between two. Atmosphere (`visual-input.ts`), palettes, sun position and condition labels are derived client-side (`look.ts`, `palette.ts`, `state.ts`) to keep the payload small.
- Pure logic with tests: `narrative.ts` (the outlook sentence), `activities.ts`, `best-window.ts`, `palette.ts`, `precipitation.ts`, `details.ts` (pollen levels), `sun-position.ts`, `formatters.ts`, `yesterday.ts`, `random-city.ts`, `map-style.ts`, `map-view.ts`, `map-options.ts`.

The palette now exposes `solarPalette(light): SolarPalette` (WTH-046D): the unchanged natural-light anchors/interpolation, before weather, UV, contrast protection and map inks. Its -1..2 phase input is distinct from 0..1 atmospheric daylight.

The palette has two ways of weathering that base, sharing one finish (`finishPalette`: text protection, glass, markers, map inks). The page's is `atmospherePalette` (WTH-046E, section 6) = `atmosphereSky` (bounded OKLCH transforms of the normalized `AtmosphereAxes`) + finish, called by `frameLook` for every frame since WTH-046L: it draws from the weather's continuous axes, with continuous gamut reduction and text protection, and carries `air` (the weather's say on the map: plane weights, saturation, ground lift, depth) so the page's map, the viewer's tuned map and the poster draw one weather. The other, `skyPalette` = `stateSky` (WeatherState grey/dim, UV vividness) + finish, is no longer used by the page: it stays as the dev-only lab's "Oggi" reference and in tests.

## Caching

- `load()` in `weather-page.ts` is the single cached unit per place: `"use cache"`, keyed on the coordinates, the scenario and the hour and nothing else (ADR-029, WTH-323: the place's name, region and country are put on after the cache, and the place search that completes them, `namesFor`, is cached on its own), coordinates rounded to 2 decimals (~1 km, `COORD_PRECISION`, through `roundCoord` in `lib/weather/coordinates.ts`), `cacheLife` revalidate 600 s, expire 3600 s, stale 300 s. Mock uses `cacheLife("seconds")`.
- The page, `generateMetadata`, `/api/og`, `/api/summary` all go through `weatherFor()` so they share one entry.
- Other cached units: place search (`/api/places`, 1 day revalidate), cloud grid (1 h), nearby towns, city facts.
- The cache's numbers, the `Cache-Control` of each route and the fetch timeouts are in `src/constants/` (see Constants).

## Constants (`src/constants/`)

Operational numbers and the words the interface says more than once, grouped by meaning (ADR-014):
- `time.ts`: `MINUTE_SECONDS`, `HOUR_SECONDS`, `DAY_SECONDS`, the units the code counts timestamps in.
- `cache.ts`: how long things are cached (`WEATHER_REVALIDATE_SECONDS`, `MAX_DATA_AGE_SECONDS`, `WEATHER_STALE_SECONDS`, the geocode, places, cloud grid and city facts lifetimes), `COORD_PRECISION`, the browser's cloud memo (`CLOUD_CLIENT_MEMO_MS`, the grid's own hour) and `CACHE_CONTROL`, the header of each route.
- `network.ts`: the fetch timeouts (`OPTIONAL_FETCH_TIMEOUT_MS`, `NEARBY_FETCH_TIMEOUT_MS`, `MAP_API_TIMEOUT_MS`, `WIKIDATA_TIMEOUT_MS`).
- `weather.ts`: `TYPICAL_CLOUD_COVER`, `DEFAULT_PLACE`, `THRESHOLDS` (the narrative's).
- `labels.ts`: `CONDITION_NAMES` (the name of each sky: `conditionLabel` adds intensity to it, the narrative, the moments and the metrics take the bare noun), `TIME_LABELS`, `ACTION_LABELS`, `PAGE_LABELS`, `WIND_LABELS`, `MOON_LABELS`, `HIGH_UV_LABEL`, `LEVEL_LABELS` (the scale the UV and the pollen share), `API_ERRORS`.

A word is a label here when two places say it; a choice made twice is one function (`precipNoun`, with `isWet`, in `lib/weather/conditions.ts`). A word used once, a sentence, the lab's strings and the poster's English readout stay where they are. The calibration constants (`palette.ts`, `map-style.ts`, `fingerprint.ts`: `ATMOSPHERE_LIMITS`, `MAP_WEATHER_LIMITS`, `AIR_STEP`...) stay beside their algorithm (ADR-011, ADR-012). The end-to-end specs read some labels as they stand ("Pioggia", "Sereno", "Adesso", "Meteo"): change one only on purpose.

## Routes

| Route | Purpose |
| --- | --- |
| `/` (`src/app/page.tsx`) | The home, one page of three sections (ADR-029): Meteo by default, Crea at `#crea`. Server component (`TavolaPage`), reads searchParams; a bare address draws a random city (ADR-017). `generateMetadata` is the place's reading |
| `/crea` (`src/app/crea/page.tsx`) | An entry address, not a page of its own: the same tree as `/` opened on Crea, on the place in the address or else the default place (never a random one). `noindex`, canonical `/`; not redirected and not rewritten (a switch writes only the hash: `/crea?...#meteo`) |
| `/atlas` (`src/app/atlas/`) | Esplora, the map (ADR-027), still its own route until D6: `layout.tsx` holds `AtlasShell` (the map, the crosshair, the point's reading, the weather field) and the page holds only the route's name and query for screen readers. It has the bar too (`AtlasDock`: Esplora current, Meteo and Crea as links to `/`). `noindex` |
| `/lab/atmosfera`, `/lab/record` | dev-only labs (the calibration of the Weather Visual Engine, the record); `notFound()` in production |
| `/api/places` | place search, runs server-side so keys stay hidden |
| `/api/summary` | small summary for a saved place's card |
| `/api/clouds` | cloud and precipitation grid for the map animation |
| `/api/random-place` | a city drawn at random from the whole world, never cached |
| `/api/og` | share image (ImageResponse) for a place |
| `/api/atlas/point` | the Atlas's weather of the cell the map rested on, through `weatherFor` (the same cache entry as the home) |
| `/api/atlas/field` | the weather field of a view: the colour of the weather of a fixed lattice of places (ADR-026) |
| `manifest.ts`, `error.tsx`, `loading.tsx` | PWA manifest, error and loading states (`loading.tsx` is the shell of every route) |

## Sections, the address and the bar (ADR-029)

One page, three sections: Meteo (the weather: Tempo and Territorio), Esplora (the map) and Crea (the poster and "I tuoi poster"). The sections are client state, not routes, and the address is their truth:
- `lib/sections.ts` is the one place that knows the shape: `sectionOf(pathname, hash)`, `sectionHref`, `entryOf` (what a route opens on: `/` Meteo, `/crea` Crea, `/atlas` Esplora), `journeyQuery` (`lat`, `lon`, the names and `t` at one precision) and `sharedHref` (`/?...#crea` for somebody else). The hash is `#crea` and `#esplora`; none is Meteo (on an entry route Meteo is written, `#meteo`).
- `components/tavola/section-store.ts` is the store (`useSyncExternalStore`): it reads route and hash, listens to `popstate` and `hashchange`, and after its own `history.pushState` (which fires nothing) notifies itself. A switch is one new step, so Back returns to the previous section; Next's router integrates the native `pushState` (`usePathname` and `useSearchParams` follow, no server render). `getServerSnapshot` is the route's own section (`initial`), so a shared `#crea` link shows Meteo for a moment before hydration.
- `components/tavola/Tavola.tsx` (client) holds the page: `AtmosphereMain`, `Sky`, `MapBackdropGL`, Meteo (the server's tree, `inert` and `aria-hidden` while Crea is on show; it is the document and keeps its scroll), Crea (a `fixed inset-0` opaque layer tinted by the sky with its own scroll, mounted on the first visit and afterwards hidden with React's `<Activity>`), the bar and a line that announces the section. After a change somebody made (a switch, Back, Forward) the focus goes to the new section's title (`data-section-title`, `tabIndex=-1`, no scroll), the line says `Meteo: Torino`, and `document.title` becomes `Meteo · Torino · what-weather`. The page opening on a section does none of these. No `ViewTransition` yet (D4).
- Meteo (`TavolaPage`): the search, the Testata (`WeatherHero`: place, temperature, the day's range, "Conserva" with `KeepButton`, one line of identity from `TerritoryLine`, the same `cityFacts` entry as Territorio), then the column: `PartsNav` (two large titles, Tempo and Territorio, a 3 px accent line under the one being read, sticky on a computer, in the small Testata `HeadlineBand` on a phone), `#parte-tempo` (`TimeScrubber`, `MomentFacts`, alerts and rain when urgent, "Prossime ore", `DetailsBand`) and `#parte-territorio` (`Territory` in `Suspense`; when it resolves to nothing the part and its title are gone, `MeteoParts.tsx`: IntersectionObserver spy, no write to the address). The ids are not `tempo` or `crea`: an id equal to a hash would be scrolled to by the router.
- Crea (`components/create/CreaSection.tsx`): the place and the moment of the page's providers (not loaded again), `PosterButton` (the dialog, with the poster as it was; the second click stays until D5), "I tuoi poster" (`keep/KeepPanel`), "Conserva". An address whose `t` the forecast does not hold is said, and no poster is offered for it.
- Esplora in D3 is a link to `/atlas?<journeyQuery of the place and t>` (a bridge until D6).
- The bar (`components/nav/Dock.tsx`, `nav` "Sezioni", three real links with `aria-current="page"`, not tabs): the only glass of the app. CSS in `globals.css` (`.dock*`): the glass is its own layer, a sibling of the drop and of the links (a filter, opacity or transform on a parent would break the blur), `backdrop-filter: blur(16px) saturate(1.8) brightness(1.04)` over a layer of the sky deepened to 58%, opaque fallbacks for no blur, `prefers-reduced-transparency`, `prefers-contrast: more` and forced colours; `--dock-room` is the room the page, the Atlas's readouts and Mapbox's controls leave at the foot; `view-transition-name: dock` is already on the capsule. `sections.tsx` holds the labels and the icons. On `/atlas`, `AtlasDock` builds the links from the point on show.
- Parked: `components/bar/MomentTrack.tsx` (the bar's moment track, taken out by ADR-029; the hour is chosen on the curve of the hours). `components/time/MomentAddress.tsx` keeps `t` in the address current (`replaceState` after 400 ms of quiet) from inside Meteo.

## Client state (`src/components/`)

No state library. React contexts and external stores, split by pace of change (ADR-008):
- `time/TimeContext.tsx`: three contexts at different paces (Timeline fixed per place, View = next 24 h or one picked day, Moment = hour on show). `TavolaPage` remounts the provider with `key={lat,lon}` on a new place. The page itself (`Tavola`) does not read the moment, so scrubbing re-renders only what reads it (`TavolaDock` for the `t` Esplora carries, `MomentAddress`, `CreaSection`).
- `location/PlaceContext.tsx`, `weather/MapContext.tsx` (Mapbox, the place, the cloud grid), `tavola/MeteoParts.tsx` (the part being read), `tavola/section-store.ts` (the section).
- localStorage (guarded, exposed as external stores): the kept records (`lib/keep`, `keep/useKept.ts`, key `weather:kept`, migrated once from the saved places of before), saved places (`lib/saved-places.ts`, still read by the search, WTH-313), recent places, map tuning (`lib/map-tuning.ts`, key `weather:map-hue`), map layer options (`lib/map-options.ts`).
- The Atlas has its own state, outside React: `lib/atlas/engine.ts` (the point the map rests on, with a settle controller and a point fetcher), the camera port (`mapbox-camera-port.ts`) the map's events go through without reaching React (ADR-020), and the weather field's loader (`field-loader.ts`).
- No place cookie: a bare address draws a random city (ADR-017); `/api/random-place` draws one from the whole world for the "Città casuale" button.

## UI structure

- `TavolaPage` composes (see "Sections"): `Sky` (palette background), `MapBackdropGL` (fixed Mapbox city behind the page), `WeatherHero` (the poster reading), the two parts, `SiteFooter` (lists sources actually in use, always in view) and the guide's text link (`Guide`). `DetailsBand`: `Activities`, week (`DailyForecast`), `DetailsDisclosure` (closed until asked for, its children not mounted while closed: the map `MapView`, only with a Mapbox token, and the details `Almanac`).
- Desktop: hero pinned left, the parts scroll right. Phone: the reading is the first screen.
- `lib/analytics/analytics.ts`: the measure points of ADR-018 (`explore`, `create_open`, `preview_done`), a placeholder with no service, cookie or identifier until `setAnalyticsSink` is called (WTH-226); `components/analytics/TrackOnMount`, now inside `CreaSection`. The event names still say Explore and Create of ADR-018 (the section called Explore then is Meteo now).
- `components/poster/`: the downloadable poster (canvas render, `PosterButton` in Crea only).
- `components/atlas/`: the Atlas (ADR-020 to ADR-026), as it was.
- Glass: only the bar (`.dock-glass`). `layout/glass.ts` (`GLASS`) is still what the poster's dialog, the Atlas's panel and the map's controls are made of; ADR-029 makes them opaque later.

## Tests

- Unit: `src/**/*.test.ts` (Vitest, node env, `server-only` stubbed).
- E2E: `e2e/*.spec.ts`, built with `WEATHER_PROVIDER=mock` and no Mapbox token, port 3100. Desktop and phone (Pixel 7) projects.
- Commands: `npm test`, `npm run test:e2e`, `npm run lint`, `npm run build`.
