# SESSION LOG

Short diary of the last sessions, newest first. Keep to about five entries; consolidated state goes in PROJECT_STATE.md.

## 2026-10-13 (desktop pilot readiness, WTH-248 approved)
- Worked on: WTH-248 approved; the desktop pilot's readiness checked on commit `1ae9724` (application code of `05965b5`): live Explore, `/crea` at 200, the Mapbox preview drawn at 2480 × 3508 px, `/lab/atmosfera` at 404, no blocking error. The build was made from that tree and the server runs on localhost:3300 for the user's session. No participant, no simulation, no result.
- To confirm: the protocol file is v1.2, while the request named v1.1.
- Not done: no push, no deploy, no smartphone session, no change to Explore, Create or the poster system.

## 2026-10-13 (WTH-248 fixed, phone checklist, Mapbox token checked)
- Worked on: WTH-248: the cause is the prerendered static shell (cacheComponents), where the guard inside the page ran at build time and the shell was sent with status 200. Fixed with a proxy and one tested rule (`05965b5`, separate commit). The full e2e suite passed 26 of 26. The Mapbox token in the client was checked in code and in a build: only the public `pk.` token reaches the browser. The phone checklist is in the feasibility document, section 8, for the user to run on real devices.
- Not done: no push, no deploy, no participant, no UX session, no real phone. The pilot needs the user's confirmation of the new commit. WTH-227 stays open.

## 2026-10-13 (phone feasibility on the local network, WTH-248 found)
- Worked on: documented the feasibility of phone tests on the local Wi-Fi (`docs/PHONE_LOCAL_TEST.md`): the build served on the LAN with a command-line flag; plain HTTP limits (location and sharing differ, checked in an emulated Pixel 7, not a phone); provider calls stay on the server; the Mapbox token answered from every origin tested, to be checked in the account; the preview's risks on a phone. No project file changed, no push, no deploy, no participant. The server was stopped after the checks.
- Found: the development labs `/lab/atmosfera` and `/lab/record` answer 200 in production and locally (WTH-248).
- Not verified: any real phone. The physical checks are listed in the document.

## 2026-10-13 (WTH-227 pilot authorised, protocol v1.2)
- Worked on: the morning checks on the local build (commit served, Open-Meteo reading, Mapbox and its attributions on Explore and on the poster, /crea, the preview, no blocking error): all passed. Protocol v1.2 before the pilot: section 0.1 with the authorisations and their limits, the no-demo rules, the spontaneous reaction to the poster in the sheet. Board: WTH-227 authorised for one desktop pilot, not complete; WTH-220 stays open.
- No push, merge, deploy or recruitment by the assistant. The pilot's material is kept apart from the five.

## 2026-10-13 (WTH-227 environment check, protocol v1.1)
- Worked on: checked the version to validate. Production serves `4591712` (Create answers 404); the code to validate is `87b87ea` (= `de8f3f4`), built locally: Explore with live data, Create with Mapbox, and the provider-failure message. Protocol v1.1 before the pilot: section 0 (the check), the pilot kept apart, the «Riprova» rule, decisions 10 to 12. No deploy, no push, no recruitment.
- Blocked for the phone sessions: a reachable address (needs authorization); the preview and WTH-220; the free API's licence for research.
