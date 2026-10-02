# CHANGELOG

Meaningful completed changes, newest first. Before 2026-10-01 this is rebuilt from git history; the same work is listed by theme in BOARD.md (DONE), with WTH ids.

## 2026-10-02
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
