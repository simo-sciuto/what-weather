# MARKET SCAN

Date: 2026-10-20. Step 1 of the reset (see PROJECT_STATE.md). Written to choose a new direction for what-weather; nothing here is decided until the user picks.

## Method and limits

- Asked for by the user: sites and open-source projects close to what-weather (weather data on a map, a free map to explore, facts about places such as rivers, mountains and population, routes in the mountains and in cities, any data that can colour the map), then advice on how to set up our site.
- Sources: web search results only. This session's network policy refused direct page fetches (`en.wikipedia.org`, `ventusky.com`, `docs.mapbox.com` and others), so no product was opened and used. Facts come from the linked pages as summarized by search; prices and limits move and must be checked on the provider's own page before any decision that depends on them.
- Not covered for lack of results: Atlas Obscura's map, Google Earth Voyager, the MeteoSwiss app, Apple Weather's map design. Named in the plan, left out here rather than guessed.

## 1. The landscape

### Weather on a map

| Product | Core job | How map and data relate | Model | What to take | What to avoid |
| --- | --- | --- | --- | --- | --- |
| Windy | Forecast instrument for enthusiasts: 50+ layers, 10 models, webcams | The map is a canvas for one chosen layer at a time, animated particles, a time bar at the foot | Freemium; Premium adds hourly steps, 15 days, every model run ([Windy](https://www.windy.com/-why-upgrade-to-windy-premium-heres-the-full-breakdown/articles/43434), [community](https://community.windy.com/topic/23730/be-one-step-ahead-with-the-advanced-features-of-windy-premium-en/16)) | One layer at a time; the time bar as the main control; free pan everywhere | Layer menus as long as a dashboard; the free tier was cut from 10 to 6 days and users resented it |
| Ventusky | The same job as Windy, slightly simpler | Same canvas model; altitude levels for temperature and wind | Free core (temperature, precipitation, radar, satellite, air quality); Premium for clouds, pressure, sea, etc., about $20 a year in the US store ([App Store](https://apps.apple.com/us/app/-/id1280984498), [Premium](https://my.ventusky.com/premium/features)) | Clear split of free and paid layers | Reviewers call it "almost exactly Windy" with a more cluttered temperature display ([AlternativeTo](https://alternativeto.net/software/ventusky)) |
| Zoom Earth | Live satellite view and storm tracker | The Earth as it looks now (GOES, Himawari every 10 min), fires from NASA FIRMS, hurricane tracks ([App Store](https://apps.apple.com/us/app/-/id1531561063)) | Free with in-app subscriptions | The real look of the sky as the hook; events (storms, fires) as reasons to come back | Satellite imagery is heavy and not ours to restyle |
| earth.nullschool (`cambecc/earth`, MIT) | A visualization, not a forecast app | The whole globe is the data: animated wind, waves, particulates over a dark globe; settings hidden | Free, personal project ([README](https://cdn.jsdelivr.net/gh/cambecc/earth@master/README.md)) | Proof that one beautiful, calm, data-true picture is memorable on its own | No place knowledge, no reason to stay after the wow |
| Meteoblue | Serious forecast for people who plan (meteograms, climate diagrams) | Maps plus point products; climate diagrams from 30 years of model data, about 30 km resolution, stated on the page ([point+](https://content.meteoblue.com/en/private-customers/website-subscriptions/point/), [community](https://community.meteoblue.com/topic/52/point-premium-content-overview)) | Free with light ads; point+ subscription | Honest resolution notes next to the data; "what is usual here" as context | Dense, expert pages |
| Apple Weather | The default daily check | Map is a secondary view (precipitation, temperature, air quality, wind) with a 1 h / 12 h slider ([iGeeksBlog](https://www.igeeksblog.com/how-to-view-weather-maps-on-iphone)) | Bundled | The slider over time as the only control on the map | Nothing to explore beyond the weather |
| Carrot Weather | The daily check with a personality | The background colour is the weather report before any number ([design analysis](https://blakecrosley.com/guides/design/carrot-weather)) | Subscription; Apple Design Award 2021 | Competes on the experience of checking, not on accuracy | Its voice is a joke; ours would be calm |

### A map to explore, with knowledge of places and routes

| Product | Core job | How map and data relate | Model | What to take | What to avoid |
| --- | --- | --- | --- | --- | --- |
| Komoot | Plan and follow outdoor routes; "highlights" from users | Route-first planning on an OSM map; 2025 redesign toward discovery and photos ([BikeRadar](https://www.bikeradar.com/news/komoot-redesign-2025)) | Regions and Premium; after the Bending Spoons purchase (March 2025) device sync went behind a subscription and most staff left ([DC Rainmaker](https://dcrainmaker.com/2025/03/komoot-acquired-history-says-this-wont-end-well.html), [road.cc](https://road.cc/content/news/job-cuts-expected-komoot-after-tech-firm-purchase-313159)) | Discovery of what is worth seeing around a route | Competing on navigation and offline maps: a large, crowded market |
| AllTrails | Find a trail, check it, go | Trail list plus map; Peak tier (about $80 a year) adds AI custom routes, a community heatmap and "trail conditions" from 15 weather factors hourly along the whole trail ([TechCrunch](https://techcrunch.com/2025/05/12/alltrails-debuts-a-80-year-membership-that-includes-ai-powered-smart-routes), [Tom's Guide](https://www.tomsguide.com/wellness/fitness/i-tried-alltrails-new-custom-routes-tool-and-its-a-game-changer-for-hikers-bikers-and-runners)) | Plus and Peak subscriptions | Weather read along a route, not at a point: the closest thing to our idea, sold as a premium feature | User-generated content and safety liability |
| Mapy.com (Seznam) | Outdoor map of the whole world, offline | Marked hiking and cycle trails drawn on the base map, up to 1:5,000, 3D view, touchable objects with text and photos; OSM outside Czechia ([Seznam help](https://napoveda.seznam.cz/en/outdoor-map-type-hiking-trails-and-cycle-routes), [OSM wiki](https://wiki.openstreetmap.org/wiki/Mapy.com)) | Free, premium for offline extras | Trails as part of the cartography, not as pins; the map itself is the guide | A full navigation app is out of our scope |
| Waymarked Trails (GPL v3) | Show OSM route relations (hiking, cycling, MTB, riding, ski) over a base map with hillshade | A transparent overlay of routes; a route has its own page by relation id ([OSM wiki](https://wiki.openstreetmap.org/wiki/Waymarked_Trails)) | Free, volunteer | Routes come from OSM relations `route=hiking/foot`; the overlay model fits our map | Public tiles are a volunteer service, not for a commercial product |
| OpenTopoMap | Topographic map from OSM and elevation data | Contours and hillshade as the base | Free for non-commercial use, about 500k tiles a month as "low volume" on openmaps.fr ([policy](https://openmaps.fr/tile-usage-policy.html)) | Relief as identity | Not usable commercially at scale |
| WikiExplore, WikiMap, Wikimedia "nearby" | Wikipedia articles placed on a map | Pins around you or a random place; click for a preview ([WikiExplore](https://webcatalog.io/de/apps/wikiexplore), [Wikimedia nearby](https://meta.wikimedia.org/wiki/WMDE_Technical_Wishes/Geoinformation/Nearby_articles)) | Free | Opening at a random place is a hook (we already do it, ADR-017) | Pins with no hierarchy and no visual identity |
| Felt, HistoryMaps (Mapbox) | Maps that tell a story | Felt: one story, few colours, curated terrain or bathymetry layers ([Felt post](https://www.plushcap.com/content/felt/blog/felt-how-to-design-a-beautiful-map)); HistoryMaps: fog on zoom for a storybook feel ([Mapbox blog](https://www.mapbox.com/blog/historymaps-how-i-built-it)); research: the story should be carried by the map itself ([ETH Zurich](https://www.research-collection.ethz.ch/handle/20.500.11850/527262)) | Tooling / personal | The map is the narrative, not an illustration of a text | Scroll-driven stories are one-shot, not a daily tool |

## 2. Patterns worth taking

1. **One thing on the map at a time.** Windy and Ventusky have 50 layers but draw one; Apple Weather draws one with a time slider. A layer budget is a design decision, not a limit.
2. **Time is the main control.** Every weather map puts a time bar at the foot. We already have absolute time (ADR-019) and a scrubber.
3. **The colour is the reading.** Carrot's background and nullschool's globe are read before any number. Our colour engine (atmosphere as palette, ADR-012) is exactly this, and nobody applies it to a whole explorable map.
4. **Routes belong to the cartography.** Mapy.com and Waymarked Trails draw trails as part of the map, not as markers; AllTrails reads the weather along the route.
5. **Context next to the number.** Meteoblue's climate diagrams ("what is usual here") and its stated resolution: our honesty rules (measured vs interpolated, reanalysis) fit this.
6. **A reason to open it today.** Zoom Earth's storms and fires, Windy's webcams. A calm app still needs one daily hook.

## 3. The gap

- Weather maps are **instruments**: expert, dense, interchangeable (Windy vs Ventusky). They know nothing about the place.
- Outdoor apps are **guides**: they know places and routes, and treat weather as a widget or a premium add-on.
- Wikipedia maps are **pins**: knowledge with no picture.
- Nobody offers a **calm, beautiful map of a territory where the weather is the colour of everything**, and where places, waters, peaks and routes are part of the same picture. That is the intersection of what we already own: the colour engine, the Mapbox style tuned by weather (`map-style.ts`, `MapVisualState`), the explorable map foundation (Atlas M1 to M3), the place facts from Wikidata (`city-facts.ts`).

## 4. Data that can colour the map

| Source | What | Licence | Cost and limits | Effort with our stack |
| --- | --- | --- | --- | --- |
| Open-Meteo (in use) | Forecast, history (ERA5), air quality | Data CC BY 4.0, attribution and link where shown; code AGPL ([terms](https://open-meteo.com/en/terms)) | Free API only for non-commercial use, under 10,000 calls a day; commercial use needs the paid plan ([pricing](https://open-meteo.com/en/pricing)) | None, already integrated behind the provider abstraction |
| Mapbox (in use) | Base map, `mapbox-terrain-dem-v1` for 3D terrain, hillshade and slope ([docs](https://docs.mapbox.com/data/tilesets/reference/mapbox-terrain-dem-v1/)) | Mapbox terms (print and sale still open: WTH-219, WTH-220) | 50,000 web map loads a month free, then $5 per 1,000; one load covers 12 h of interaction ([pricing](https://www.mapbox.com/pricing)) | Low: terrain is a source and `setTerrain` on the map we have |
| Wikidata SPARQL (in use) | Population, elevation, rivers, lakes, peaks, protected areas | CC0 | 60 s per query, 60 s of processing per minute per client; the service is sometimes overloaded ([WDQS docs](https://www.icesi.edu.co/CRAN/web/packages/WikidataQueryServiceR/refman/WikidataQueryServiceR.html), [scaling update](https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service/WDQS_backend_update/October_2023_scaling_update)) | Medium: already used; needs a server cache per area and pre-built queries |
| Wikipedia GeoSearch | Articles near a point or in a box (radius up to 10 km, up to 500 results) | Text CC BY-SA (share-alike on adaptations) | Free API ([MediaWiki](https://www.mediawiki.org/wiki/Extension:Geodata)) | Low for titles and short extracts; long text stays out (archive/APP_AREAS.md) |
| OpenStreetMap via Overpass | Paths, peaks, springs, huts, viewpoints, water, parks; hiking route relations | ODbL: attribution, share-alike on derived databases | Public instance: under 10,000 queries and 1 GB a day for the whole app, "divide by 100" for regular use; commercial use should self-host or pay ([OSM wiki](https://wiki.openstreetmap.org/wiki/Overpass_API)) | Medium to high: a server route with cache, or a pre-built extract for a region |
| Waymarked Trails tiles | Ready-made route overlay | Software GPL v3; tile terms not found | Volunteer service | Low technically, but not a base for a product; better to build the same from OSM relations ourselves |
| OpenTopoMap tiles | Contours, relief | Non-commercial on openmaps.fr | About 500k tiles a month | Not needed: Mapbox terrain covers relief |
| Kontur Population (H3, 400 m) | Population density as hexagons, global | CC BY (check version) ([HDX](https://data.humdata.org/dataset/kontur-population-dataset)) | Free download, last HDX file October 2023 | Medium: one static vector tileset uploaded to Mapbox, coloured by the engine |
| GHSL GHS-POP | Official population grid 1975 to 2030 | Open (JRC) | Free download | Medium: alternative or cross-check for Kontur |
| NASA FIRMS | Active fires, daily | Open | Free | Medium; an "event" layer, like Zoom Earth |
| Protomaps (PMTiles) | Self-hosted OSM base map, no keys, unmetered | OSM ODbL; hosted API free only for non-commercial ([Protomaps](https://protomaps.com/api)) | Own storage and bandwidth | High: means leaving Mapbox. Listed only as the exit if Mapbox's terms or price block the product (WTH-219) |

No new dependency is needed for any of the "low" or "medium" rows: Mapbox GL JS, `fetch` on the server and the existing cache cover them.

## 5. Recommendations: three directions

### A. The atmospheric atlas (recommended frame)

- **Promise:** "Esplora il territorio, il meteo è il colore di tutto."
- **First screen:** the map, full screen, opened on the person's place or a random one (ADR-017), already painted by the weather of the moment. A time bar at the foot. Nothing else but the search and a discreet layer switch.
- **Core loop:** move the map, it settles, the weather of the centre loads and the colour follows (ADR-020); tap a place, a peak, a lake or a route and a card opens with its weather and a few facts; slide the time and the whole territory changes.
- **Layers (budget of three, one at a time):** Meteo (the default: sky colour, rain, cloud), Territorio (relief, waters, peaks, population), Percorsi (hiking and city routes from OSM).
- **Reuses:** Atlas M1 to M3, the colour engine, `map-style.ts`, the providers and `WeatherData`, `city-facts.ts`, `best-window.ts`.
- **Risks:** Mapbox loads and terms (WTH-219, 220); Wikidata and Overpass need a server cache per area; the first screen must stay calm with three kinds of data.

### B. The place guide

- **Promise:** "Tutto su un luogo: com'è il cielo, com'è fatto, dove andare."
- **First screen:** a place page (search first), weather on top, then territory and routes below, map as an illustration.
- **Reuses:** almost everything of today's home page.
- **Risk:** it is today's direction with more chapters; the user called it unconvincing, and it is a guide like many others.

### C. The right outing

- **Promise:** "Dove e quando andare."
- **First screen:** routes and spots around you ranked by the weather window (`best-window.ts`, `activities.ts`), AllTrails' "conditions along the route" as the core.
- **Risk:** competes head-on with Komoot and AllTrails, needs a lot of route data and carries safety expectations.

### Advice

Take **A as the frame** and borrow **C's question as the first feature on a selected route or peak** ("is it a good time to go?", answered from the weather along it, with its uncertainty stated). B's content becomes the card, not a page. Records and posters stay a secondary "keep this moment" action, not the product.

Principles this suggests for the new docs (to confirm in Step 2):

1. The map is the page. Panels are temporary and give the map back.
2. One layer on the map at a time; never more than three to choose from.
3. Time is the main control, and it moves the whole territory.
4. The colour is the first reading of the weather; numbers confirm it.
5. Every value says where it comes from and how sure it is.
6. Calm by default: no card walls, no alerts unless urgent.

## 6. Open points for the user (checkpoint 1)

1. Which direction: A, B, C or A with C (advised).
2. Money: Open-Meteo's free API and the public Overpass are non-commercial. If the product may earn (subscriptions, records), the commercial Open-Meteo plan and a self-hosted or paid Overpass enter the budget before launch.
3. Region first: start with one territory (for example Piedmont and the western Alps, the pilot's own examples in ADR-018) with rich routes and facts, or the whole world thin?
4. What stays of the poster identity in a map-first app: the type, the grid, the sky colours, or only the colour engine?
