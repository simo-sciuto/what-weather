# PHONE TESTS ON THE LOCAL NETWORK: FEASIBILITY (WTH-227)

Status: feasibility only, checked on the test machine (macOS, the local production build of `main`, application code of `87b87ea`). No physical phone was used, so no mobile behaviour is declared verified here. No participant was involved. No project file was changed, nothing was pushed or deployed.

The phone sessions of WTH-227 stay not authorised until the physical checks in section 8 are done.

## 1. Serving the build on the local network

- The build is served with the Next.js command line flag, not with a project change: `npx next start -H 0.0.0.0 -p 3300`, from the existing build (`npm run build` is not needed for this).
- The test machine's address on the Wi-Fi was `192.168.1.41` on 2026-10-13. It is assigned by the router and can change: read it on the day (`ipconfig getifaddr en0`).
- The macOS firewall was off on the test machine. If it is switched on, it must allow incoming connections for Node.
- Verified from the same machine, through the local address: `/`, `/crea` and a static JavaScript asset all answer 200.
- Not verified, and to check physically: that a phone on the same Wi-Fi reaches the machine. Routers can isolate wireless clients (often called "AP isolation" or "client isolation"; guest networks usually have it on). If it is on, the phone cannot reach the machine.
- The server listens on every interface while it runs, so anyone on that network can open the site and its routes during the test. Stop the server when the test ends.

## 2. HTTPS and mobile browsers

- The local address is served over plain HTTP. In the emulated Pixel 7 (Chromium, Playwright), `window.isSecureContext` is `false` on the LAN address. This is an emulation, not a phone.
- Consequences found in the code and in the emulation:
  - **Location.** The "Trova la mia posizione" control is present (`navigator.geolocation` exists), but browsers refuse position data outside a secure context. The app handles the error and shows «Accesso alla posizione negato» or «Impossibile determinare la tua posizione. Cerca una località.». Desktop `localhost` is a secure context, so the same control may behave differently on the desktop pilot and on the phone. The protocol's tasks ask for a city search, not for the location, so this does not block the tasks; a participant who presses the control will see the message, and the moderator records it as an observation.
  - **Sharing.** `navigator.share` and `navigator.canShare` are `undefined` on the LAN address, so the «Condividi» control is not offered. This matches the rule of the protocol (no sharing), but it is not a choice of the app for that case, and on a secure origin the control would appear.
  - **Service worker.** The app registers none, so the HTTP limit on service workers does not apply.
  - **WebGL.** Available in the emulation. Not verified on a real GPU.
- Not verified: iOS Safari, which has its own secure-context rules and its own WebGL and memory limits. Also not verified: Android Chrome on a real device.
- Options for HTTPS, not implemented and not recommended for the pilot:
  - a local certificate, which the phone must trust (a profile to install on the device: an action on the phone, outside the project);
  - a tunnel to a public address, which sends the traffic through an external service and needs an explicit authorisation.
- Recommendation: accept plain HTTP on the local network for the phone sessions, and record the location difference in the sheet.

## 3. Mapbox token and the local origin

- The token in `.env.local` is a public token. It is shipped to the browser by design (`NEXT_PUBLIC_`).
- Tested with curl, sending an `Origin` and a `Referer` header: the style endpoint answered 200 for no origin, for `http://localhost:3300`, for `http://192.168.1.41:3300` and for the production origin. So no URL restriction was enforced for these origins by the API as tested.
- The tested requests are an approximation of the browser's: a browser sends the origin of the page. The authoritative check is in the Mapbox account: the list of URL restrictions of this token. **To check by the user:** whether restrictions exist, and whether they would reject `http://192.168.1.41:3300`. If they do, the map and the poster fail on the phone, and the restriction must be widened for the test only, which is a change to the account, not to the project.

## 4. Open-Meteo on the local network

- Every weather provider (Open-Meteo, OpenWeather, the Mapbox calls for city facts) lives in modules marked `server-only`. The browser never calls Open-Meteo directly.
- The phone therefore receives pages and data from the local server only. The server makes the Open-Meteo requests from the test machine's internet connection, so the local network does not change the provider's requests. The server needs internet access during the test.
- Checked: `/api/places` answers 200 on the LAN address; `/api/summary` answers 400 without its parameters, which is the expected answer.

## 5. Explore and `/crea` on the local network

- Explore (`/`) and `/crea` answer 200 on the LAN address.
- In the emulated Pixel 7 on the LAN address: the live reading of Open-Meteo appears on Explore, the phone bar shows the «Poster» tab, and `/crea` draws the preview (2480 × 3508 px) in about 7 s. No console error.
- This is an emulation on the test machine. It is not the behaviour of the participant's phone.

## 6. Risks of the preview on a phone

- The preview is an A4-size canvas of 2480 × 3508 px (about 8.7 million pixels), drawn in the browser. The map is drawn offscreen by Mapbox at that size, with several render passes, and the result is converted to images. The earlier analysis (CREATE_SPEC.md, WTH-234) estimated a peak of about 200 to 250 MB for one export. That estimate is not a measurement.
- Known risks on a phone:
  - iOS Safari can stop a tab that uses too much memory, which would show a blank or reloaded page;
  - the map's own timeout (25 s) can fire on a slow phone, and the poster then shows its error state with a retry;
  - low-end Android devices may be slow enough that the participant waits longer than the protocol expects.
- Not measured: time, memory and success on real phones. These are the checks of section 8.

## 7. What the desktop pilot showed that does not carry to the phone

- The desktop pilot runs on `localhost`, a secure origin. The phone runs on plain HTTP. The location control and the sharing control behave differently (section 2). The desktop session's notes do not describe the phone.

## 8. Physical checks to do (by the user, on real devices)

Do them on at least one iPhone with Safari and one Android with Chrome, on the same Wi-Fi as the test machine, with the server started as in section 1.

1. The phone reaches `http://<LAN address>:3300/` and the reading appears on Explore.
2. The phone bar's «Poster» tab opens `/crea`, and the preview is drawn: note the time and whether it succeeds.
3. The preview's attributions are visible: «© MAPBOX © OPENSTREETMAP» on the poster, and the Mapbox logo and the footer on Explore.
4. Open the preview several times in a row and watch for a blank page or a reload (memory).
5. Turn on the phone's battery saver and repeat step 2 (slower, and some devices limit background work).
6. Press «Trova la mia posizione» and record the message shown (section 2).
7. Confirm that no «Condividi» appears, and that no download starts.
8. Check the Mapbox token's URL restrictions in the account (section 3) before the session.
9. Stop the server after the test.

## 9. Decisions still needed from the user

- Authorise the phone sessions (not authorised today).
- Decide whether a phone session with the HTTP address is acceptable, given the location and sharing differences (section 2), or whether HTTPS is required first.
- Decide the Mapbox token's URL restrictions, after checking them in the account.
- Decide the fate of the development routes found reachable (section 10).

## 10. Finding outside the phone tests

- `/lab/atmosfera` and `/lab/record` answer 200 on the local production build, and also on the production site (`what-weather-theta.vercel.app`). The code says these pages are for development only (`notFound()` when `NODE_ENV` is `production`), but the check in the built app does not take effect. What they expose was not checked in detail (they appear to use calibration scenarios, not the live data); the pages are public and not meant to be. Tracked on the board as WTH-248. Not corrected here, since no code changes were authorised.
