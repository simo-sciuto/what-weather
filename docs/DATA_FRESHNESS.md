# DATA FRESHNESS: THREE TIMES, ONE LABEL (WTH-252)

Status: PROPOSAL. No code, cache, TTL or protocol change is made by this document. Copy changes need the user's approval; the poster's copy changes its PNG and needs approval on its own.

## The problem, observed on 2026-10-13
- Pages showed "dati di 43 min fa" and "dati di 47 min fa" while the clock read about 15:30 and the footer read "Aggiornato alle 14:45". The data was up to an hour old: the cache keeps an entry up to `MAX_DATA_AGE_SECONDS` while it revalidates in the background (`src/constants/cache.ts`).
- The create page and the poster wrote "Adesso · Martedì 13 ottobre, 14:45" for that same reading. "Adesso" says the data is from the moment of reading; it is not.
- The age note appears only after 20 minutes (`STALE_SECONDS` in `LocalClock.tsx`), so a reading 15 minutes old carries no age at all.

## Three different times, which the product does not keep apart
1. **Validity of the weather (valid time).** The hour the figures describe: `current.time` for the reading, and each frame's `time` for a forecast hour. Today this is shown as "Aggiornato alle HH:MM" in the footer.
2. **Retrieval of the data.** The moment the app fetched the figures from the provider. **Not stored today.** `renderedAt` is the moment the page was served, not the moment the provider was asked, and it is not cached with the data. Adding a `fetchedAt` to the weather data is an architectural change to be proposed before it is made (rule 1 in CLAUDE.md).
3. **The user's current moment.** The clock on the page.

Only (1) is known for the figures. The label "Adesso" merges (1) with (3), and says nothing about (2).

## Nature of the figures
The figures come from a forecasting model (Open-Meteo, and OpenWeather where it is used). A reading is a model's value for that hour, not a station measurement. The copy must not say "osservato", "misurato" or "rilevato" for them (ADR-006 separates measured from interpolated; this is the same care applied to the source).

## Proposed microcopy
Each line is a proposal in Italian. The user chooses.

**Explore: the reading's time (header, under the clock)**
- Today: "ORA 15:32, ora locale" and, after 20 minutes, "dati di 47 min fa".
- Proposal: "Ore 15:32 · dati delle 14:45" always, and after 20 minutes "dati di 47 min fa" beside it. The data's hour is always named; the viewer's clock is always the clock.

**Explore: the footer**
- Today: "Aggiornato alle 14:45, ora locale".
- Proposal: "Dati del modello per le 14:45, ora locale." It names the hour the figures describe, not a moment of update the app does not know.

**Explore: the timeline's first frame**
- Today: the label "Adesso" (`src/constants/labels.ts`, `now`).
- Proposal: "Ultimo dato · 14:45" for the first frame, and "Previsione" for every later hour (the existing wording, unchanged).

**Create: the moment line**
- Today: "Adesso · Martedì 13 ottobre, 14:45".
- Proposal: "Dati delle 14:45 · Martedì 13 ottobre" for the current reading, and "Previsione per le 18:00 · Martedì 13 ottobre" for a chosen hour.

**Poster: the credits line (a change to the PNG; needs approval)**
- Today: "PREVISIONE" for a forecast, nothing for the current reading, then the credit and "© MAPBOX © OPENSTREETMAP".
- Proposal: "DATI DELLE 14:45" for the current reading, and "PREVISIONE PER LE 18:00" for a forecast, before the credit and the map's attribution. The hour is printed on the record so that a poster kept for a week still says which hour it describes.

## Decisions for the user
1. Accept the three-times model, and the wording above, or choose different words.
2. Whether the poster's credits line may name the hour of the data (a change to the PNG output).
3. Whether `fetchedAt` should be added to the weather data (an architectural proposal to be checked against ADR-001 and ADR-003 first).
4. Whether the 20-minute threshold for the age note should change. This document does not propose a value; the cache and TTL are not changed.

## Not in this proposal
- The cache, its lifetimes and `MAX_DATA_AGE_SECONDS` are not changed.
- The protocol v1.2 is not changed. The moderator records the age the page states, as the protocol already asks.
