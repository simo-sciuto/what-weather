# CHANGELOG

Meaningful completed changes, newest first. Before 2026-10-01 this is rebuilt from git history; the same work is listed by theme in BOARD.md (DONE), with WTH ids.

## 2026-10-04
- WTH-181: the poster's left column sets no sentences. On a computer: the actions, then the place's name and the temperature at the top, the empty field for the map, and at the foot the Luogo, Giorno, Ora row (it was the head). On a phone: the name rises to the top with the temperature; the hour, day and place stay at the foot. The outlook (forecast, day summary, scrubbed hour) is read out to screen readers only; `HeroReading` is gone. WTH-024 is closed.
- WTH-180, second look: the stops lose their inner dot and are a plain circle in their line's colour (an open ring for train, metro and tram, the metro's heavier; a solid dot for the bus), each lifted by a hard black shadow of its own shape cast two pixels below it so it seems to float. The shadow is a layer under the stop (`<id>-shadow`), shown and hidden with it and as faint as the stop is; the metro's ring was brought under the old dots' size. Eight stop tests.
- WTH-180: the stops of the ways of getting about are drawn as forms, not outlined dots. The train's is a roundel (a ring round a solid core), the metro's a heavier roundel, the tram's an open ring, the bus's a small solid dot, all in the colour of their line, none with the old grey fill and black outline. A ring is a stroke with no fill and its core a layer above it (`train-stops-core`, `metro-stops-core`), shown and hidden with it; `syncMap` paints both from the stop's ink, so the page and the poster draw the same. Five tests. Sizes kept below the old dots after the user's first look (rings of 4.2 and 4.8 px at the closest zoom, the tram's 2.4, the bus's dot 1.6). No change to the palette or the ink contract.
- WTH-179: the poster's sun is a soft bloom. The old glow was two stops (full centre, transparent black at 0.21 of the height), so it read as a disc with a darkened rim; it is now a Gaussian taken to zero at the rim (`bloomStops`), the glow's own colour fading in alpha only, 80% of the glow's alpha at the centre, and reaching as far as the page's glow (42% of the way to the farthest corner, about twice as far). Six tests. The page's glow is unchanged.
- WTH-046G: the meteorological map hierarchy. `mapVisualState` turns the atmosphere into weights on the map's planes, chroma, ground lift and water deepening (rain firms and deepens the water and quiets the ground; snow brightens the ground, cools the lines and restrains the infrastructure; a storm compresses the background and sharpens the roads), applied in the atmosphere path and the lab. Clear, rain and snow are now different pictures in grayscale. Live page unchanged; connecting it is WTH-046L.
- WTH-046K, round three: invariants for grayscale, timeline and conflicting forces (11 tests). The timeline sweep exposed a jitter of up to 14/255 in a clear noon's sky between frames seven minutes apart (stepped gamut reduction and text protection); the atmosphere path now uses continuous versions, the live page is unchanged. Findings for G recorded: bright days share one sky grayscale; a full storm pins the sky so haze cannot compress it.
- WTH-046K, round two (user decision: rain is rain, snow is snow, fog is fog): snow on its own scale (full at 2 mm/h of water), the view a fall takes away is no longer counted as haze, heat and cold weigh 0.8 in the signature. Every calibration scenario now names its expected forces; depth closes only with fog. No change to the live page.
- WTH-046K, first round: the force signature ranks by weight (cloud 0.6, haze only past the transform's onset) so precipitation outranks a full overcast; haze is led by visibility (lost between 10 and 1 km, weights 0.65/0.25/0.10), so rain with a good view keeps its map depth while mist and fog close it; six scenario expectations corrected; two gate tests. Open: snow. No change to the live page.
- WTH-046F: atmospheric depth. `atmosphereDepth` follows the sky's veil curve; past the haze onset the map's far ground (meadows, relief, contours, shadows) fades most, the middle (water, streets, buildings) softens and the foreground (main roads, transit, traffic, lights) holds. Applied as a last opacity step after colours and separation, so haze never moves a hue or strengthens a layer, and it shows in grayscale. Live inks byte-identical (2,232 sets). Seven new tests (live fingerprint, separation floor under haze, visibility monotonic); lab shows the depth. Not on the live page yet.
- WTH-046E: the atmosphere transform. `atmosphereSky`/`atmospherePalette` turn the solar base with the normalized axes, in OKLCH, bounded and in a fixed order: temperature as white balance, haze as a depth veil, rain and storm darkening it, snow cooling it. Pulls on one property combine (strongest plus a quarter of the rest), floors bound the result, and no hue passes through green. The live `skyPalette` was split to share the finish and stays byte-identical (4,464 palettes). 16 calibration scenarios and a dev-only lab (`/lab/atmosfera`) compare both engines through a whole day, also in grayscale. 24 new tests; 135 passing across the touched suites. Not on the live page yet.
- WTH-046D: the existing natural-light base is now `solarPalette(light): SolarPalette`, with phase/channel contracts documented. All solar anchors, interpolation and downstream weather/contrast/map calculations preserved; no visual redesign.
- WTH-046C: humidity, visibility and dew point now reach the selected frame from all four adapters, with availability/origin metadata and interpolation only between available endpoints. Daily overviews marked synthetic; FrameLook derives atmosphere alongside the unchanged palette. Ten new pipeline tests, 92 passing checks across relevant suites.
- WTH-046B: provider-agnostic WeatherVisualInput -> computeAtmosphere, with continuous curves for temperature, clouds, haze, precipitation and UV; bounded severity/snow interpretation, explicit input statuses and missing-data fallbacks. Twenty new tests; still not connected to providers, frames or rendering.
- WTH-012 accepted by the user, including WTH-008; Weather Visual Engine (WTH-046) started.
- WTH-046A: normalized atmosphere model with derived clarity, bounded solar energy and deterministic dominant/secondary forces; absent forces remain null. Contract documented and covered by focused tests. Not yet connected to palette, timeline, UI, maps or poster.

## 2026-10-03
- A compass on the map and the poster, with the point the map faces; the map can be turned on a computer too; the poster's map credits under its wordmark; the page's footer set in rows on a phone (WTH-023).

## 2026-10-02
- The weather data as tiles (Weather app style) on phone and computer; Territorio with the country and the capitals as links with their weather; "Ricentra" no longer over the search button (WTH-025, WTH-026).
- Phone: the bar stays in view with a sheet open and marks the page on show; the sheets stop above it (WTH-022).
- Territorio moves right after the timeline and gains the capitals and the nearest towns (WTH-026); the poster's name and country take the temperature's colour, its coordinates and colour bar are set on a grid (WTH-027).
- Phone poster laid out as the user chose (temperature on top, the map between, the hour, the name and the outlook at the foot); the search as a round glass button, only "Città casuale" left outside; the poster maker a centred modal; "Condividi" sends the poster with the link and a message. Towns around keep their region and country (looked up by name when a link carries only it).
- Phone: a navigation bar of clear glass (Meteo, Modifica mappa, Poster) that hides while a sheet is open; one glass sheet for the weather and the map, the map's panel as colour chips; the page stays still and the finger moves and turns the map, with "Ricentra"; the quick facts move into the weather sheet (WTH-022).
- Phone: the data sheet follows the finger and settles on the nearest stop; the chapters' scroll-linked reveal is off on a phone (an empty sheet in Chrome on iPhone).
- Phone: the page no longer scrolls into the data; the poster and the map stay in view, the data rise in a glass sheet from a floating bar with Dati, Poster and Mappa (WTH-022, first checkpoint).
- The "La mappa" panel redesigned: sliders on one row on top, the layers as words with a colour bar, ruled groups (WTH-010).
- Poster top: the day's low and high with the sky's glyph over the name, the temperature (light, 1.9 times the name) at the right edge (WTH-012, WTH-017 in progress).
- A light shadow under each rank of road, going with its choice; the poster's colour bar without shadows and relief, in fine bars and small capitals (WTH-021).
- The choice "Nomi delle acque" is gone from the map panel (WTH-020): the map draws no words. A stored choice that had it loads as the page's own.
- Trains, metro, tram and bus replace "Ferrovie" in the map panel, each its own choice and colour, with plain lines and stops as dots (WTH-019). The buses have stops only.
- The colours of the map's layers are kept apart as a whole, among the layers on show, in order of weight (WTH-016, ADR-011).
- Buildings in 3D ("Edifici 3D") as a choice of the map panel, and water, roads and buildings kept apart in colour at every hour and tuning (WTH-014, ADR-011).
- Random city: a bare address draws a city at each visit, and a "Città casuale" button draws any populated place in the world (WTH-011, ADR-010). The last-place cookie is gone.
- The poster's top reworked (WTH-012 in progress, WTH-008): "Crea poster" and "Personalizza la mappa" as typographic text actions (docked to the foot of a phone's screen), head with labelled Luogo / Giorno / Ora and a running clock with seconds, one font (Inter Tight) across the site, the name tinted a touch off white, the temperature bold, under it the day's low and high with a mark for the hour on show and the sky's glyph, the country in bold capitals.
- Interactive board: `npm run board` serves docs/BOARD.md as columns in the browser and writes every change back (`scripts/board/`, WTH-164).
- BOARD DONE rebuilt by theme from git history (WTH-100..163).

## 2026-10-01
- Map layers chosen from one panel; scrolling eases into the city and tilts the map; the poster follows what is on screen (`ccd4e85`, WTH-152..154).
- The reading is the phone's first screen (`82378ff`, WTH-151).
- Project memory system added: `docs/`, `.claude/agents/`, rules in CLAUDE.md.

## 2026-09-30
- End-to-end tests (`56e9a8b`, WTH-161).
- Best hours, activities, timeline metrics, yesterday comparison, towns around, pollen, recent places, UV-vivid sky, tunable map colours (`e2c12fe`, WTH-121, 122, 123, 134, 145..150).
- Next.js and ESLint config updated to 16.3.7 (`be88d43`, WTH-162).
- "Territorio" chapter; the week folded to three days (`6d49edf`, WTH-143, 144).
- Downloadable poster (`07410fb`, WTH-142).

## 2026-09-29
- Share previews of four places in the README (`32867f9`, WTH-163).
- Site named what-weather, search docked, every source credited, phone fixes (`c51da04`, WTH-132, 133, 140, 141).
- Palette, cards and map backdrop reworked (`cd1d06f`, WTH-130, 131).
- Air called poor from the third band (`54b055e`, WTH-120).
- README (`9a0f548`, WTH-163).
- The weather app with the Swiss-style poster reading: providers, timeline, week, details, map, places, share images, manifest (`1a90650`, WTH-100..119).

## 2026-09-24
- Initial commit from Create Next App (`862aa87`).
