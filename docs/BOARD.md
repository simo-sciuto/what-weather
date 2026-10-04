# BOARD

The authoritative task list. Adding a task here does not start it. IDs are WTH-nnn, never reused.

Items marked (audit) were noticed while reading the code on 2026-10-01, not requested by the user: they are candidates, to be confirmed before work starts.

## NOW

- [ ] WTH-046 Weather Visual Engine. High-priority product/engineering epic after WTH-012: evolve the existing procedural visual engine into the shared visual language of Visual Weather Records, `PLACE + TIME + WEATHER -> VISUAL RECORD`. Active since 2026-10-04 after user sign-off of WTH-012. WTH-046A/B/C/D/E done (E signed off in the lab `/lab/atmosfera`); F committed (`d58c2ff`); K closed (`0177581`); G implemented and committed in the atmosphere path; next checkpoint WTH-046H. V1 covers the static system; WTH-046M is PARKED. Plan, foundations, overlapping tasks and acceptance principles: `docs/WEATHER_VISUAL_ENGINE.md` ("V1 plan").

```text
WTH-012 -> WTH-046A -> WTH-046B -> WTH-046C -> WTH-046D
        -> WTH-046E -> WTH-046F -> WTH-046K -> WTH-046G
        -> WTH-046H -> WTH-046I -> WTH-046J -> WTH-046L
        -> Records track (NEXT, see ROADMAP.md)
WTH-046M: PARKED, outside V1
```

Re-prioritized 2026-10-04 by the user's choice of direction (ROADMAP.md, ADR-013): the engine continues, then the Records track; layout work on the live app (WTH-017, WTH-018, WTH-022, WTH-009, WTH-015) is paused in LATER.

  - [x] WTH-046A Atmosphere model and visual grammar: normalized `AtmosphereState` axes and a deterministic signature of visual forces (`atmosphere.ts`). Done 2026-10-04.
  - [x] WTH-046B Weather input normalization: continuous curves from measurements to axes, per-input status and fallbacks (`visual-input.ts`). Done 2026-10-04.
  - [x] WTH-046C Carry atmospheric data through the timeline: humidity, visibility and dew point with their origin from every provider to `frameLook()`. Done 2026-10-04.
  - [x] WTH-046D Solar base palette: `solarPalette(light)` exposes the existing natural-light base, values unchanged. Done 2026-10-04.
  - [x] WTH-046E OKLCH atmosphere transform: `atmosphereSky`/`atmospherePalette` in `palette.ts` section 6, bounded and in a fixed order, sharing the live finish; live `skyPalette` byte-identical. Dev-only lab `/lab/atmosfera`. Done 2026-10-04, signed off by the user in the lab.
  - [x] WTH-046F Atmospheric depth: haze compresses depth instead of greying; visible in grayscale. Done 2026-10-04 (committed): `atmosphereDepth` and map planes in `palette.ts` (far ground fades, middle softens, foreground holds), live map byte-identical; visual judgement in the lab is the user's.
  - [x] WTH-046K Scenario calibration suite: critical gate before G/H/L; measurement-driven scenarios and invariants, never city presets. Started with E: 16 scenarios in `calibration.ts` and the lab. Rounds one to three done 2026-10-04 (signature by weights, visibility-led haze, snow on its own scale, precipitation never counted as haze, UV kept; invariants for grayscale, timeline and conflicting forces, with a timeline jitter found and fixed in the atmosphere path). Open for G: bright days share one sky grayscale (white-text cap), the map must separate clear, rain and snow. Closed 2026-10-04 after the user's look in the lab; the gate for G/H/L is open. See the engine doc.
  - [x] WTH-046G Meteorological map hierarchy: weather changes map hierarchy and depth, not just hue; separation and user tuning preserved. Done 2026-10-04 in the atmosphere path and the lab (`mapVisualState`, `MAP_WEATHER_LIMITS`); not yet on the live page (WTH-046L); visual judgement is the user's. Was, from K: clear, light rain and snow share one sky grayscale and one depth, so the map must separate them (brighter land and restrained infrastructure for snow, stronger water for rain); replace the tripwire test in `calibration-invariants.test.ts` when it does.
  - [ ] WTH-046H Unified visual palette contract: evolve `SkyPalette` into one whole-record palette for UI, Mapbox and poster.
  - [ ] WTH-046I Temperature colour integration: decide which `temp-color.ts` uses stay absolute and which follow the engine.
  - [ ] WTH-046J Weather Fingerprint: deterministic internal visual DNA of a record; no V1 UI.
  - [ ] WTH-046L Map / poster / UI integration: after calibration, one weather visual state on screen and in the exported poster. From K: the live page's stepped gamut reduction and text protection jitter (8/255 on a clear day) when the light moves; the atmosphere path has continuous versions (`fromOklchEdge`, `legibleUnderTextEdge`) to carry over. From F's review: `MapControls` recomputes inks with `mapInksFor` and must receive the atmosphere's depth (expose it on the palette or pass it), or map and poster diverge; quantize depth (e.g. 0.05) before it keys the 96-entry memo, since haze moves continuously along the timeline.
  - [ ] WTH-046M Future motion layer. PARKED, outside V1: wind reserved for motion, never colour.

Board tooling limitation: `scripts/board/board-md.mjs` recognizes numeric IDs only. WTH-046 is a browser board card; the letter-suffixed subtasks above are Markdown lines preserved by the parser, not independently editable or draggable cards, and do not follow the card if it is moved. Do not renumber them to work around this.

- [ ] WTH-166 Licences for selling records: check that the data and the map may be sold as digital files and prints. Open-Meteo's free API is non-commercial (a paid plan or another source is needed); Mapbox's terms for print and resale of map imagery (attribution, volumes, plan); OpenWeather's plan. Blocks any payment (WTH-172). Can run in parallel with WTH-046.

## NEXT

Records track, in order. WTH-167 is the gate: WTH-169 onwards are built only if validation says people want records.

- [ ] WTH-168 Historical weather provider: weather of a past place and hour (Open-Meteo archive, ERA5 reanalysis, hourly since 1940) behind the provider abstraction (ADR-001). Architect checkpoint first: `Frame` and the timeline assume present and future. Provenance shown as reconstruction, not measurement, with lower confidence for older dates (rule 7).
- [ ] WTH-167 Validation landing: a page with five or six records of famous or meaningful dates, the positioning line, and a "prenota il tuo" form; a small paid campaign. Measure sign-ups and pre-orders before building the purchase flow. Needs WTH-168 for the sample records.
- [ ] WTH-169 Records flow: choose a place and a past date and hour, get its poster; the poster becomes the way in, not one feature among many. Keeps the poster identity.
- [ ] WTH-170 Print-grade poster: print formats (A3, A2, 50x70), margins and paper, 300 dpi (about 5000x7000 px for A2), likely rendered on the server since phone canvases cannot hold it (see WTH-013).
- [ ] WTH-171 Dedication line on the poster: optional date, names or a short sentence.
- [ ] WTH-013 Poster on a phone: the actions are now docked to the foot of the screen (`HeroActionsDock`, always visible while scrolling). Still to decide and check on a real phone: the poster dialog on a small screen, how the file is delivered (share sheet or download, see `share()` in `PosterButton.tsx`), formats, canvas size limits and memory.
- [ ] WTH-173 English for the Records flow: the gift market is international; the daily app can stay Italian (ADR-010 to be revisited for this flow only).
- [ ] WTH-172 Payment and print on demand (e.g. Stripe, Gelato or Prodigi): new dependencies, justified when reached. Only after WTH-166 and a positive WTH-167.

Data trust (a record sold must be right):

- [ ] WTH-001 (audit) AQI provenance: OpenWeather gives its own 1-5 index, Open-Meteo's index is computed from concentrations (`airIndexOf`, `details.ts`). Decide whether the UI should say which, and whether the two scales are comparable.
- [ ] WTH-002 (audit) Surface `Frame.measured`: check where the UI shows an interpolated hour as if it were a reading.
- [ ] WTH-003 (audit) Validate min/max semantics: `DailyPoint.partial`, `tempRange` (`today.ts`), `days.ts` filtering of partial days, on 3-hourly providers.

Bugs:

- [ ] WTH-165 Phone, city search: while the page loads the full search bar shows, though on a phone only the search icon should; and on iPhone, after tapping the icon, the typed text is often not visible (the search itself works). Reported by the user 2026-10-04.
- [x] WTH-179 Poster: the sun's glow is still too sharp in the poster; it should be only a soft bloom. Reported by the user 2026-10-04. Done 2026-10-04: `paintSky` draws a Gaussian bloom (`lib/weather/bloom.ts`) with the page's reach, no hot spot and no edge; the user's look at an exported poster is pending. The page's `.sky-glow` is unchanged.
- [ ] WTH-180 Transit stops: the dot with an outline is not liked; give the stops (train, metro, tram, bus) a more graphically advanced representation, in the poster's Swiss language (`map-style.ts`, stop layers; relates to WTH-019/WTH-021). Reported by the user 2026-10-04.
- [ ] WTH-181 Poster, left column: remove the outlook sentences ("Previsione", `narrative.ts`) and put in their place one line with place, day and time; the block with the city name and the temperature goes to the top. Reported by the user 2026-10-04; continues WTH-017 and supersedes WTH-024 (the sentences are removed, not rewritten).

## LATER

Paused 2026-10-04 for the Records direction (layout of the live app):

- [ ] WTH-022 Phone: poster and map in view, data in sheets. Done so far (2026-10-02): a floating bar of clear glass (Meteo, Modifica mappa, Poster: solid icons, names, the page on show in the temperature's colour, a lens that slides stretching), hidden while a sheet is open; one Sheet component (`components/layout/PhoneNav.tsx`) for Meteo and Mappa that follows the finger; the map's panel as colour chips (also on a computer, in glass); the poster maker in the same glass; the page still, the finger moving the map (vertical: down into the city, a quarter of the screen for the whole way; sideways: turns it; "Ricentra"); the quick facts moved into the Meteo sheet. Next: the iPhone layout of the main page. Not checked: by day, a real finger, the poster drawn turned.
- [ ] WTH-017 Redefine the layout of the left column (the poster): head, name, temperature, low and high, glyph, outlook and the room left for the map, as one composition (continues WTH-012).
- [ ] WTH-018 Make the right column (the weather information) more Swiss editorial: the same font as the left, a more elegant arrangement on the page (timeline, quick facts, air, activities, week, details).
- [ ] WTH-009 More variety of colours in the "tinta" menu of the colour tuning.
- [ ] WTH-024 Review the outlook's sentences ("Previsione", narrative engine in `lib/weather/narrative.ts`): the user does not like how they read. Not now; to be planned with the user (tone, length, what to say first).
- [ ] WTH-015 Show the buildings from above too, the 3D ones included. Not solved: Mapbox Streets' tiles have buildings only from zoom 13 (and the trams and bus stops from 14), and the page's top is zoom 11. Starting the map closer when such a choice is on was tried and removed on the user's decision (2026-10-02); what is left is to decide how to have them from the top, if at all (a closer start for everyone, or a different source).

Records, later products (after the Records track proves itself):

- [ ] WTH-174 "Il tuo anno nel meteo": a yearly poster of a place's weather, a natural December product.
- [ ] WTH-175 Daily phone wallpaper generated from the real sky of a place; a light subscription.
- [ ] WTH-176 B2B records: hotels, tourism boards, wedding planners, estate agents.

Spin-off ideas (outside this product):

- [ ] WTH-177 Idea: the project board as the local home while developing (bare localhost shows the board with branch, git and project state, a button opens the app). Built and reviewed on 2026-10-04, then removed at the user's request: kept only as a good idea.
- [ ] WTH-178 Spin-off from WTH-177, a separate open-source project: a project dashboard any existing repo can install, showing where the work stands (board, project state) and git; it studies the repo it is installed in and rebuilds its look from the site's own style automatically. Idea of the user 2026-10-04, to develop some day; not started.

Audits:

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
