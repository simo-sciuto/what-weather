# PRODUCT

Source: README, code and commit history. Not an invented vision: if a principle is not visible in the app, it is not here.

## What it is

what-weather ("whatever"): "Weather, calmly: the right information at the right moment." A weather web app that reads like a Swiss typographic poster. Italian interface. Live at what-weather-theta.vercel.app.

Direction chosen on 2026-10-04, not built yet: Visual Weather Records, the daily app as a free shop window and records of meaningful moments as the paid product. See ROADMAP.md and ADR-013. This file still describes only what the app does today.

## Identity (preserve)

- The page is the sky: background colours follow the place's time of day and weather, and cross-fade while scrubbing.
- Swiss poster reading: six-column grid, flush left, the place's name large and heavy, the temperature beside it, a few facts in small print, hairlines for structure, three text sizes.
- The city's map sits behind the page and tilts into the streets as you scroll.
- Progressive disclosure: first screen is one reading (place and temperature at the top, the place, the day and the hour at the foot, the timeline); chapters follow; detail on demand.
- Urgent things (alerts, imminent rain, promoted details) move up right after the first screen.
- Outlook in words: a short plain sentence about what the weather will do next. Not set on the poster (removed 2026-10-04, WTH-181); read out to screen readers and used for the share image.

## Not this

Generic dashboard, card walls, information overload, decorative UI with no function, emoji-heavy weather UI, arbitrary redesigns.

## Principles

1. Weather data is product data, not decoration. Never hide uncertainty behind attractive UI (see measured vs interpolated in DECISIONS).
2. A visual change needs a functional reason.
3. Phone first screen is the reading; desktop pins the reading on the left.
4. Every source in use is credited in the footer.
5. Works with no keys (sample data), with real weather when keys are set.
6. Accessibility and performance are first-class.

## Features today

Poster hero, live sky, Mapbox backdrop, 24 h timeline (drag to explore, whole page follows), week with day picker, "what the weather is good for" (activities, best window), rain/cloud map animation, details (air quality, pollen, UV, wind, humidity, sun, moon, alerts), outlook sentence (read out and in the share image only), places (search, saved, recent, last place remembered), "Territorio" (a page of its own: what the place is, the towns around, its waters and peaks, linked from the weather page), share URL + generated preview image, downloadable poster, installable PWA, tunable map colours and layers.
