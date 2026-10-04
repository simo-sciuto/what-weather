# ROADMAP

Direction, not tasks (tasks live in BOARD.md). Only the user sets this.

## Direction (set by the user, 2026-10-04)

what-weather becomes **Visual Weather Records**: the portrait of a place's sky at a moment that matters, set as a Swiss poster. `PLACE + TIME + WEATHER -> VISUAL RECORD`. The weather is the engine; the record is the product.

Positioning line (draft): "Che tempo faceva quel giorno. Il cielo dei vostri momenti, come un manifesto svizzero."

Two layers, each with one role:

1. **The daily weather app: free, the shop window.** It shows the engine at work every day, builds a habit and brings traffic. It stays calm and shareable; it does not try to compete with the system weather apps.
2. **Records: paid, the product.** A place and a date, past included (a wedding, a birth, a first meeting, a summit), become a poster with the real sky, map and data of that hour. Sold as a digital file and as a print.

The market is personalised posters as gifts (city maps, star maps of a night), not weather apps. The edge is real weather rendered by a deterministic visual language: the same place and moment always give the same poster.

What this means for the work:

- The Weather Visual Engine (WTH-046) continues: it is what makes a record true.
- Then the Records track (BOARD NEXT): historical data, a validation landing, the records flow, print-grade posters, dedication, English for the flow, payment last.
- Validate before building the purchase flow (WTH-167). Check licences before taking money (WTH-166).
- Layout work on the live app that does not serve records is paused (BOARD LATER).
- Data honesty stays a selling point: historical weather is a reanalysis and the poster says so (PRODUCT principle 1).

## Earlier phases (bootstrap audit)

- Phase 1: Foundation (done). Provider abstraction, normalized WeatherData, timeline, outlook sentence, caching, mock provider, unit and e2e tests.
- Phase 2: Product refinement. Trustworthy data semantics (air quality, measured vs interpolated, min/max): kept, now in service of records (BOARD "Data trust").
- Phase 3: Portfolio quality. Accessibility, performance, PWA, mobile: still part of done for each task; the audits stay in LATER.
- Phase 4: Polish. Motion (WTH-046M), micro-interactions: after the Records track.
