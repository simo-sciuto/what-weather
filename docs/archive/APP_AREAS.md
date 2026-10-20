# APP AREAS

Status: **proposal of 2026-10-06; decided so far (user, 2026-10-06): Territorio is a page of its own, and it must become richer than today's four short lists.** Written after the user's worry that the app, built on the weather, was getting confusing, and that adding routes and mountains would make it worse. The direction itself (ROADMAP.md, ADR-013) is the user's; this page only says how the surfaces could be split under it.

## The problem

- The page answers several questions at once: what the weather is, what the place is (the "Territorio" chapter: what it is, its capitals, the towns around, its waters and peaks), and how to keep it (the poster buttons).
- The search says "Cerca una città", which is right: nobody can know a mountain or a lake can be searched. New things (peaks, lakes, routes) must not hide behind it, nor crowd the weather page.

## Three areas, one question each

| Area | Its question | What is in it | Role |
| --- | --- | --- | --- |
| **Meteo** | What is the sky doing? | The reading, the hours, the week, the details, the rain and cloud map | The free app, the shop window (ADR-013) |
| **Territorio** | What place is this? | What it is, its capitals, the towns around, waters, peaks; later routes | Where the places worth a record are found |
| **Record** | Keep this place at this moment | Choose a place and a date (past included), get the poster | The paid product (WTH-169) |

The place is the common thread: it already travels in the address (`?lat&lon&name`), so the three areas are views of one place, not three apps.

## Rules

1. The search stays city-first ("Cerca una città"). Peaks, lakes and routes are found from a place, in Territorio.
2. One primary question per area. A thing that answers another question goes to that area, with at most one line of link in this one.
3. Moving between areas is a light link, not a nest of tabs.
4. The weather page stays the calm poster reading (PRODUCT: progressive disclosure, no card walls).
5. The weather stays the engine: the provider abstraction and `WeatherData` do not change for any of this.

## What would change, in order

1. **Territorio on its own page**, with today's content, the place in the address, and on the weather page a single line pointing to it instead of the chapter. A layout change of the live app, which ADR-013 pauses: it needs the user's confirmation when reached (as WTH-181 had), and an `architect` check first (it touches the app's routes, the weather page and how the slow Wikidata data streams).
2. **Peaks and lakes touchable** in Territorio: each becomes a place with its own weather. Territorio already holds their names and points (Wikidata); the rivers' points are to check.
3. **Routes**, in Territorio and in the records (WTH-213): a line on the map and the poster. A record needs a past date, so records depend on the historical provider (WTH-168). The data is OpenStreetMap or CAI Infomont (ODbL, docs/LICENCES.md); selling a poster with Mapbox's map waits for Mapbox's answer (WTH-211).

## Territorio today, and what richer could be

Today (`CityFacts.tsx`, `city-facts.ts`) it is four short lists of names: the place (rank, altitude, population, capitals), the towns around, the waters (at most 4) and the peaks (at most 4, with height). No map, no distances, nothing to open.

Candidates, by what they add:

1. **A map of the land** as the page's first screen: relief and water around the place, peaks and lakes marked and touchable. Mapbox, already in use; a second map load per visit, to price.
2. **More of the land:** more peaks and lakes, rivers, parks and protected areas, each with its height and its distance and direction from the place. Wikidata (CC0) and the map's own OpenStreetMap tiles. Wikidata's queries are slow: cached, streamed.
3. **The place's character:** what the weather is usually like here at this time of year (typical temperatures, rainy days), and its records. It needs the historical data (WTH-168), a commercial Open-Meteo plan, and says "reanalysis, not measurement" (PRODUCT principle 1).
4. **Routes** (WTH-213), once the touchable peaks and lakes exist.
5. Left out on purpose: photographs (mixed licences, and not the poster's language) and long encyclopaedic text (Wikipedia is CC BY-SA, share-alike on adaptations).

The page keeps the poster's grammar: the place's name large, a few facts, hairlines, chapters, detail on demand.

## What does not change

The poster identity, the provider abstraction, the data contracts, the search's role, the weather page's reading.

## To decide

- ~~Page or tab~~: decided, a page of its own.
- What "richer" means (WTH-216): a map of the land, more of the land, the place's climate, routes. Not decided.
- The wording and place of the one-line link on the weather page.
- Whether saved places should remember the area last seen.
- How the weather page offers "Crea un record" (today "Crea poster") once the records flow exists.
