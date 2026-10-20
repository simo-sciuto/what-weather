# PRINCIPLES

Status: of 2026-10-20 (WTH-339), from the `ux-ui` agent and the market scan; in force as written, amended by the user's review. Replaces the identity and principles of the archived PRODUCT.md.

Each principle has an example and the reason. A design or code change that breaks one must say which and why.

1. **The map is the page. Panels borrow space and give it back.**
   Example: tapping the Rocciamelone opens the card at half height over the map; the camera does not move, so the point being read does not change, and closing the card gives the space back.
   Why: exploring is the product (VISION.md). A panel that stays open turns the atlas back into a page with a map as decoration.

2. **One layer, one question.**
   Example: with "Percorsi" on, only the trails are drawn; the weather stays as the map's colour.
   Why: Windy and Ventusky have 50 layers but draw one at a time (MARKET_SCAN.md). Three choices, one at a time, keeps three kinds of data calm.

3. **Time moves everything together.**
   Example: dragging the time bar to "gio 8:00" changes together the map's colour, the light on the relief, the reading and the verdict of the open card.
   Why: every weather map makes time its main control; seeing the whole territory change is the gap the scan found.

4. **Colour first, numbers to confirm, words to decide.**
   Example: a greyed, darker map says "rain" and a warm one says "mild" before any number; the card says "Meglio partire alle 6", then the three figures that explain it.
   Why: the colour engine is the one identity element kept, but colour alone is neither accessible nor a decision.

5. **Every value says where it comes from and how sure it is.**
   Example: "Vento in cresta 45 km/h, stimato in quota dal modello a 2 km".
   Why: in the mountains the difference between measured and estimated is the whole question (ADR-006, ADR-016).

6. **An answer, not a dashboard.**
   Example: a route card shows one verdict, one window and at most four reasons; the hour-by-hour detail sits behind one button.
   Why: AllTrails sells conditions along a route as a dense premium list; our edge is an answer read in three seconds.

7. **Calm by default.**
   Example: nothing moves unless the person moves it; no autoplay, no notifications, no alarm colours on the map (verdict marks in a card are not map colours); a red band only for an official warning, quoted with its source.
   Why: the tone of the product, and respect for reduced motion.

8. **Everything on the map can be reached without the map.**
   Example: the "Qui intorno" list gives the places, peaks, lakes and routes of the visible area, in reading order, to keyboard and screen reader users.
   Why: WebGL features cannot take focus; WCAG 2.2 (2.5.7) asks for an alternative to dragging.

## Constraints that do not move

- Weather data is product data: timezone, timestamps, units, provenance, measured vs interpolated, min/max, missing data (CLAUDE.md rule 7).
- The UI never reads raw provider payloads; no keys in the client (ADR-001, ADR-002).
- Non-commercial: free tiers within their limits, every source credited (VISION.md).
- Italian UI, English code and docs (ADR-010).
- Accessibility, responsive behaviour and performance are part of done.
