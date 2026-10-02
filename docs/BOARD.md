# BOARD

The authoritative task list. Adding a task here does not start it. IDs are WTH-nnn, never reused.

Items marked (audit) were noticed while reading the code on 2026-10-01, not requested by the user: they are candidates, to be confirmed before work starts.

## NOW

- [ ] WTH-012 Typographic poster pass on the reading's top (desktop and phone): the two actions on a top line, head set in the poster's own font with labelled facts, hour and date reworked, name tinted a touch off white, the block right of the temperature as a ruled table. Includes WTH-008 (buttons).

## NEXT

- [ ] WTH-001 (audit) AQI provenance: OpenWeather gives its own 1-5 index, Open-Meteo's index is computed from concentrations (`airIndexOf`, `details.ts`). Decide whether the UI should say which, and whether the two scales are comparable.
- [ ] WTH-002 (audit) Surface `Frame.measured`: check where the UI shows an interpolated hour as if it were a reading.
- [ ] WTH-003 (audit) Validate min/max semantics: `DailyPoint.partial`, `tempRange` (`today.ts`), `days.ts` filtering of partial days, on 3-hourly providers.

- [ ] WTH-009 More variety of colours in the "tinta" menu of the colour tuning.
- [ ] WTH-010 Rework the UI of the modal that opens from "La mappa".
- [ ] WTH-013 Poster on a phone: the actions are now docked to the foot of the screen (`HeroActionsDock`, always visible while scrolling). Still to decide and check on a real phone: the poster dialog on a small screen, how the file is delivered (share sheet or download, see `share()` in `PosterButton.tsx`), formats, canvas size limits and memory.
- [ ] WTH-008 Give character to the "Crea poster" and "La mappa" buttons: they should stand out and feel part of the poster identity.

## LATER

- [ ] WTH-004 (audit) Accessibility audit (timeline scrubber, map controls, contrast on every sky palette).
- [ ] WTH-005 (audit) Performance audit (frame payload size, Mapbox bundle, first paint on phone).
- [ ] WTH-006 (audit) E2E coverage of the map chapter: e2e builds without a Mapbox token, so the maps are untested.
- [ ] WTH-007 (audit) PWA: manifest exists; offline and install behaviour not verified.

## DONE

Rebuilt on 2026-10-02 from git history (13 commits, 2026-09-24 to 2026-10-01), grouped by theme and ordered by when each theme first appears. Each line says what was done and in which commit; "first build" is `1a90650`, which shipped the whole first version at once. The reasons behind choices are in DECISIONS.md where known; here only what the code and commit messages show.

### Recenti

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
