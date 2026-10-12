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
- Layout work on the live app that does not serve records is paused (BOARD LATER), except the Explore and Create homepage (ADR-018).
- Data honesty stays a selling point: historical weather is a reanalysis and the poster says so (PRODUCT principle 1).

## Direction update (set by the user, 2026-10-12, ADR-018)

From a startup-style assessment of the product, the user took this as the direction from now on. One promise, two experiences, one centre of gravity:

- Tagline: **Weather, worth looking at**. Weather x place x design. The UI stays Italian.
- **Explore**: why people arrive. A place, its weather, how it changes, a map that follows the weather. Free, quick, readable. Three depths: first glance, exploration, details (progressive disclosure).
- **Create**: why people stay and may pay. A place, a moment and its conditions become a typographic and geographic composition. Free preview, paid export, print later.
- Explore and Create share data and visual identity, not interface complexity.
- First paid product: the digital record (experimental price 6,90 EUR); print second, through print on demand, only if demand shows. No weather subscription. Studio (9 EUR a month) is a later hypothesis.
- First audience: design-sensitive people; travellers and geography fans bring traffic; creatives and studios later.
- Past dates stay a hypothesis to validate, not an advantage proven. Provenance, source and confidence on every record (ADR-016).
- Postponed: community, feeds, profiles, native apps, subscriptions, ads, more features.
- Do not delete advanced features: radar, specialist data and the week move deeper in the hierarchy.
- Pivots, decided by evidence in the first 90 days, never built in parallel: A visual weather studio (first choice), B design-first daily app (people return but do not buy), C weather graphics for creators (professional demand).
- The guiding question: what can a person do with what-weather that they cannot do as well with the tools they already use? The hypothesis to test: turn the real conditions of a place and a moment into a unique composition, through a simple and pleasant experience.
- Conditions before taking money stay: licences (WTH-166, 211, 212), the poster's map rights (WTH-219, 220), validation (WTH-167, 227).

Tasks: BOARD "Priority 0" (WTH-225 to WTH-231). The 90-day plan: validate, redesign Explore and measure, Create MVP, distribution and first sales.

## Earlier phases (bootstrap audit)

- Phase 1: Foundation (done). Provider abstraction, normalized WeatherData, timeline, outlook sentence, caching, mock provider, unit and e2e tests.
- Phase 2: Product refinement. Trustworthy data semantics (air quality, measured vs interpolated, min/max): kept, now in service of records (BOARD "Data trust").
- Phase 3: Portfolio quality. Accessibility, performance, PWA, mobile: still part of done for each task; the audits stay in LATER.
- Phase 4: Polish. Motion (WTH-046M), micro-interactions: after the Records track.
