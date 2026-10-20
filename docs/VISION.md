# VISION

Decided by the user on 2026-10-20 (WTH-339, ADR-030), after the market scan (research/MARKET_SCAN.md).

## The promise

"Esplora il territorio: il meteo è il colore di tutto."

what-weather is an atmospheric atlas. You open it and the map is already painted by the weather: each place in the colour of its own temperature, greyed by cloud, darkened by rain and dimmed by night (the weather field, ADR-026). You move freely across Piedmont and the western Alps, from Torino to the valleys, the lakes, the peaks and the paths, and the colours, the light and the conditions follow. You slide time and the whole territory changes with it. You tap a place, a peak, a lake or a route and learn what it is and what its weather is doing; on a route or a peak you get a direct answer: is it a good time to go?

## Why this, and not another weather app

- Weather maps (Windy, Ventusky) are instruments for experts, dense and interchangeable, and know nothing about places.
- Outdoor apps (Komoot, AllTrails, Mapy.com) know places and routes, and treat weather as a widget or a premium add-on.
- Nobody offers a calm, beautiful map of a territory where the weather is the colour of everything. We already own the pieces, most of them built and tested: the colour engine and the weather field, a map style tuned by weather, the explorable map with its point reading, place names and search, the place facts.

## Who it is for

People who live in or love this territory and decide where to go: a walk on Sunday, a ridge on Saturday, a lake after work. Curious people who like to look at their land changing with the sky.

## The core loop

1. The map opens on the region (or on the person's place), coloured by the weather field now.
2. Move; the map settles; the weather of the centre loads, the field of the view refreshes.
3. Slide the time bar; the whole territory takes that hour's weather.
4. Tap a feature; a card says what it is, its weather at that hour, and for routes and peaks whether it is a good time to go, how sure we are, and why.

## Scope

- Region first: Piedmont and the western Alps (box 5.8 to 9.6 E, 43.7 to 46.6 N). Elsewhere the weather works; Territorio and Percorsi say they are not there yet.
- Three layers, one at a time: Meteo, Territorio (relief, waters, peaks, population), Percorsi (hiking and city routes).
- Non-commercial. The site makes no money: free tiers within their limits, every source credited, our OpenStreetMap extract published under ODbL.

## Not this

- Not a forecast instrument with fifty layers.
- Not a navigation app: no turn-by-turn, no offline maps, no GPS tracks.
- Not a safety service: the verdict never says "sicuro" and always points to the official bulletins.
- Not a shop: posters and records are no longer the product.
- Not a dashboard or a wall of cards.

## What stays from before

Only the colour engine as identity (the atmosphere palette, the temperature scale and the field colour), plus the weather data layer, the map style tuned by weather and the Atlas (ARCHITECTURE.md section 1). The Swiss poster identity, Explore and Create, and Tavola unica are archived (archive/PRODUCT_v1.md, archive/ARCHITECTURE_tavola.md).
