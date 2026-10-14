# Atlas M3: manual review sheet

Branch `claude/atlas-foundation`, local only (no push, no merge, no deploy). Approval criterion set by the user: continuity with the original What Weather design, not a new art direction.

## Run it with the real token
1. Put the Mapbox token in `.env.local` (git-ignored): `NEXT_PUBLIC_MAPBOX_TOKEN=...` (the same one the home page uses). Do not set `NEXT_PUBLIC_ATLAS_BLANK_MAP`.
2. `npm run dev`, then open `http://localhost:3000/atlas`. The home page is `http://localhost:3000/` for the side by side.

## Gestures to try
- Drag to move; mouse wheel and pinch to zoom; double click to zoom in.
- Rotate and tilt: Ctrl (or right button) and drag; two fingers on a phone.
- Keyboard: Tab to the map, then arrows to move, plus and minus to zoom, Shift and arrows to rotate and tilt. The focus ring must be visible.
- While the map flies (not wired to any control in M3), a drag cuts it short: only the automated test drives it.
- Watch: the crosshair stays at the centre and gets clearer while the map moves; the coordinates at the bottom left follow the map live; the Mapbox logo and attribution stay visible; the wordmark leads back to the home.
- Open the network panel: moving the map must produce Mapbox tile requests only, no weather request.

## What to compare with the home (continuity, no new graphics)
Same functions and tokens, checked by reading computed values (no screenshots): Inter Tight, ink `#fff`, accent `#f9e8a7`, the seven palette custom properties from `atmospherePalette`, the home's map style and layer tuning, the wordmark at the home's header size (1.375rem).
Known difference: the sky. The home at 12:00 with the sample clear weather computes `--sky-1/2/3` as `#085ec4 / #006baa / #3a7083`; the Atlas, with no weather, a bare clear sky at the middle of the day, gets `#245faf / #246ca4 / #476f83`, a little less saturated. It is the same engine with stand-in inputs; M5 (phase A) is where a point's weather colours it. Not tuned.

## Not verifiable here (declared BLOCKED)
- The real Mapbox drawing with the home's style: no token in this environment.
- Safari (desktop and iOS) and a real phone: touch inertia, pinch, rotation, address bar and safe areas, `h-dvh`; only Chromium with SwiftShader and an emulated phone were run.
- Real focus order with a screen reader (VoiceOver, TalkBack): only the Tab order and the ring were checked in Chromium.
- Performance on a real device while the map moves.
- Whether the map's density with the home's labels reads like the user's mockup (WTH-236).
- Visual approval: never given by automated tests.
