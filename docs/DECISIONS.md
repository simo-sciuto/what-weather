# DECISIONS

Reconstructed from the code and commit history (2026-10-01). Status "Accepted" means the code currently relies on it. Do not reopen casually; if a task conflicts with one, flag it first.

## ADR-001: Providers are normalized before reaching the UI
- Decision: every provider implements `WeatherProvider` and returns `WeatherData`. Components never see raw payloads.
- Reason: swap or add sources (OpenWeather, Open-Meteo, mock) without touching the UI.
- Consequences: new data needs a field in `types.ts` plus a mapping in every adapter (null/optional when a provider lacks it).
- Status: Accepted. Evidence: `provider.ts`, `types.ts` header.

## ADR-002: Provider keys never reach the client
- Decision: provider calls are server-only (`import "server-only"`); search goes through `/api/places`.
- Consequences: the only public env var is `NEXT_PUBLIC_MAPBOX_TOKEN`, restricted by URL in Mapbox.
- Status: Accepted.

## ADR-003: One cached unit per place, shared by everything
- Decision: `load()` in `weather-page.ts` is `"use cache"`, keyed on coordinates rounded to ~1 km; page, metadata, OG image and summaries all call `weatherFor()`.
- Reason: one forecast call per place per refresh window, whoever asks.
- Consequences: revalidate 600 s, expire 1 h so old weather is never shown. Anything per-visitor must stay out of `load()`.
- Status: Accepted.

## ADR-004: Works with no keys (mock provider)
- Decision: default provider is `mock` when no OpenWeather key is set; deterministic scenarios selectable via `?mock=&at=`.
- Reason: design, test and e2e without external services.
- Consequences: e2e runs on `WEATHER_PROVIDER=mock`, with no Mapbox token.
- Status: Accepted.

## ADR-005: Some details come from Open-Meteo whatever the provider
- Decision: yesterday's comparison, pollen, nearby towns and the cloud grid always use Open-Meteo.
- Reason: comparing two services' readings would show their bias as weather change; also cost (one request for many towns).
- Consequences: footer must list sources actually in use. These are optional: slow or missing answers (4 s timeout) are dropped.
- Status: Accepted.

## ADR-006: Measured vs interpolated is explicit on frames
- Decision: `Frame.measured` is true only for provider points; interpolated hours are marked false. Daily `partial` flags min/max that cover only part of a day.
- Reason: do not present estimates as readings.
- Consequences: UI that shows a value as a reading should respect `measured`. Open: how consistently the UI surfaces it (see BOARD).
- Status: Accepted (model); UI coverage unverified.

## ADR-007: Palette and sun position are derived in the browser
- Decision: frames carry condition, phase, light, cloud cover; palettes and sun position are computed client-side (`look.ts`).
- Reason: 100+ frames; payload size.
- Status: Accepted.

## ADR-008: No state library; contexts split by pace of change
- Decision: Timeline / View / Moment contexts; localStorage as guarded external stores; last place in a cookie.
- Reason: scrubbing re-renders only what reads the moment.
- Status: Accepted.

## ADR-009: Maps are Mapbox's alone, and optional
- Decision: no token means no backdrop map, no map chapter, no Territorio chapter. The weather clouds are drawn from the Open-Meteo grid on top.
- Status: Accepted.

## ADR-010: Italian UI, English code
- Decision: all user-facing copy in Italian; code, comments and docs in English.
- Status: Accepted.
