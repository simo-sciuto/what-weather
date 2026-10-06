# APP AREAS

Status: **proposal of 2026-10-06, not decided.** Written after the user's worry that the app, built on the weather, was getting confusing, and that adding routes and mountains would make it worse. The direction itself (ROADMAP.md, ADR-013) is the user's; this page only says how the surfaces could be split under it.

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

## What does not change

The poster identity, the provider abstraction, the data contracts, the search's role, the weather page's reading.

## To decide

- Territorio as a **page of its own** (recommended: its data is slow, routes will need their own map, a place can be shared by link) or a tab of the same page.
- The wording and place of the one-line link on the weather page.
- Whether saved places should remember the area last seen.
- How the weather page offers "Crea un record" (today "Crea poster") once the records flow exists.
