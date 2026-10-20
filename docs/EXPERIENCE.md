# EXPERIENCE

Status: proposal of 2026-10-20 (WTH-339, step 2), from the `ux-ui` agent. The first screen, the card, the time bar and the copy of the atmospheric atlas. Tokens and components: DESIGN_SYSTEM.md. Principles: PRINCIPLES.md.

Reference sizes: phone 360 x 760, desktop 1440 x 900. In the sketches `+` is the crosshair, `[Q]` search, `[o]` locate me.

## 1. First screen: three examples, one chosen

### Example 1, "Tutto in basso" (the instrument). Not chosen.

Borrows Windy: one layer, time bar across the foot, layer icons on the right.

```
PHONE
+----------------------------------+
| [Q Cerca luogo, cima, sentiero ] |
|                             [M]  |
|                             [T]  |
|                             [P]  |
|          +  Pinerolo 14°         |
|                             [o]  |
|----------------------------------|
| [Adesso] |--o-----|------|------ |
+----------------------------------+
```

- For: the most map; a pattern people know.
- Against: the reading is a small label lost over the map, with no contrast guarantee; icons on the side read as an instrument, not an atlas.
- Kept as the control case for a test with people (WTH-227).

### Example 2, "Lettura in alto, tempo in basso" (the calm atlas). Chosen.

Borrows Apple Weather (the slider as the only map control), earth.nullschool (one calm picture, settings hidden), Windy (one layer at a time).

```
PHONE                                   DESKTOP
+----------------------------------+    +------------------------------------------------------------------------+
| Pinerolo                [Q] [=]  |    | +---------------------------+                                   [Q]    |
| 14°  Sereno, vento debole        |    | | Pinerolo, 376 m           |                                          |
| Adesso, mar 20 ore 15            |    | | 14°  Sereno, vento debole |                                          |
|                                  |    | | Adesso, mar 20 ore 15     |               +                          |
|               +                  |    | | Meteo | Territorio | Perc.|                                          |
|                                  |    | | Qui intorno (12)       >  |                                   [o]    |
|                              [o] |    | +---------------------------+                                          |
| [ Meteo | Territorio | Percorsi ]|    |   +----------------------------------------------------------------+   |
| [Adesso] |-o----|-----|-----|... |    |   | [Adesso] oggi |--o------|---------|---------|.........  dom  |   |
+----------------------------------+    +------------------------------------------------------------------------+
```

- The centre's reading (place, weather, moment) is the only block of text. It exists today as `PointReading` (name by zoom, temperature, sky in words, provenance, loading, failure with "Riprova"). On the phone it sits over the map, protected by a gradient from `sky1` (about 85% to 0 over 140 px) measured against the field colours in view, because the field by day is bright (WTH-277).
- The layer switch shows its three labels: the budget of three is a visible rule.
- The card: on the phone a bottom sheet (peek, half, full) between map and time bar, with the time bar still visible, because the verdict depends on the hour; on desktop the card takes the reading's place in the left panel, so the eye does not jump.
- "Qui intorno", taken from Example 3, is the keyboard and screen reader path (PRINCIPLES 8).
- Why chosen: the only one where the map stays the page, the reading is still the first thing read on a phone, and the card replaces the reading instead of adding a second one.

### Example 3, "Pannello atlante" (the guide). Not chosen.

Borrows Mapy.com and Komoot (a persistent side panel), Google Maps (a phone sheet always present).

- For: the best for people who search before exploring; the list is always visible.
- Against: the map loses 30 to 40% of the screen, and it becomes the place guide (direction B), which the user called unconvincing.

## 2. The card

Shared structure: header (kind, name, a short fact line, close), the weather at the time bar's instant, one question or verdict (peaks and routes only), at most four facts, source and certainty, one secondary action. No cards inside cards.

| Kind or state | Content |
| --- | --- |
| Place | Name, province, altitude, population (Wikidata, with year); temperature, sky, the day's min/max, wind; "Percorsi da qui" |
| Peak | Name, altitude, group; temperature at the summit ("stimata in quota"), wind, freezing level against the summit, visibility; "È un buon momento per salirci?" |
| Lake | Name, altitude, area; wind on the water, temperature, sky. No water temperature: we do not have it, so we do not show it |
| Route | Verdict, window, reasons, certainty (below) |
| Loading | Header at once (the name comes from the map feature), quiet empty lines, "Carico il meteo di questo punto", `aria-busy` |
| Partial | What is there, what is missing and what changes: "Il vento in quota non c'è: la risposta tiene conto solo di pioggia e zero termico." Certainty one step lower |
| Error | Header kept, one sentence, "Riprova" (the settle controller's `retry`, ADR-020) |
| Instant unavailable | The reason in words (ADR-019) and the nearest instant that works: "Oltre martedì 27 non ci sono previsioni." [Vai a martedì 27 ore 23]. With Open-Meteo (8 days, all hourly) the only case is beyond the horizon; a provider that gives some days as summaries only would add "Per quel giorno c'è solo il riepilogo, non le ore." |

### Route card, "È un buon momento per andarci?" (illustrative values)

```
+--------------------------------------------------+
| PERCORSO                                    [x]  |
| Rocciamelone da La Riposa                        |
| EE . 1330 m di salita . circa 4 h a salire       |
|--------------------------------------------------|
| È un buon momento per andarci?                   |
| Partenza: gio 22, ore 8   (dalla barra del tempo)|
|  (~)  Con riserva.                               |
|       Meglio partire alle 6: in vetta prima del  |
|       vento delle 12.                            |
| Cosa decide, in vetta verso le 12                |
|  Vento in cresta   50 km/h a raffiche   (x) alto |
|                    stimato in quota              |
|  Pioggia           10%                  (=) ok   |
|  Zero termico      3200 m, sotto la vetta (~)    |
|  Visibilità        nubi in arrivo dalle 13 (~)   |
| Giovedì, ora per ora alla partenza               |
|  06 07 08 09 10 11 12 13 14                      |
|   =  =  =  =  =  ~  ~  x  x                      |
| Certezza: media. Mancano 2 giorni e il modello   |
| vede la montagna a maglie di 2 km.               |
| Fonte: Open-Meteo, aggiornato alle 14:00.        |
| Non sostituisce il bollettino di ARPA Piemonte   |
| né le notizie sul sentiero.                      |
| [ Vedi la finestra ora per ora ]                 |
+--------------------------------------------------+
```

Rules:
- Four verdicts, each with its own shape and word, colour only reinforcing: `(=)` "Buon momento", `(~)` "Con riserva", `(x)` "Non ora", `(?)` "Non si può ancora dire".
- The time bar's instant is the departure; each section of the route is read at the hour one would reach it.
- At most four reasons, by weight, each with its provenance when it is not a direct model value.
- Horizon (ARCHITECTURE.md section 5): a verdict only within 48 hours, indicative to 72, "Non si può ancora dire" beyond.
- Thresholds, sampling along the route and certainty levels belong to the `weather-data` agent, not to design.

## 3. The time bar

- One instant (`TimeSelection`, ADR-019): "Adesso" follows the clock, or an absolute instant; labels at the clock of the centre's place.
- Left to right: the "Adesso" chip, a track with day ticks, a thumb labelled "sab 24, 8:00".
- Hourly as far as the provider gives hours; beyond, days only (hatched track, a day's summary, never an hour). After day 3 the track fades: uncertainty made visible.
- The interaction exists in the parked `MomentTrack` and `moment-keys.ts` (slider role, keys, 44 px); missing are day ticks, the days-only range, the fade after day 3 and End.
- Input: drag snaps to the hour; tap jumps; arrows 1 hour, PageUp/PageDown 1 day, Home "Adesso", End the last hour. Role `slider` with `aria-valuetext` ("sabato 24 ottobre, ore 8, a Pinerolo"); 44 px target; tapping is enough.
- Moves with time: the map's colour (once the field is hourly, WTH-345), the light on the relief, the reading, the open card and its verdict. Does not move: camera, layer, selection, search.
- While dragging only the label and reading update; the map repaints when the thumb rests 150 ms. No colour cross-fade under reduced motion; no autoplay.
- Examples: "Giovedì mattina sul Monviso" (drag to "gio 8", the card says "Con riserva", the map turns cold and grey; "Adesso" brings it back). At "dom 7", panning to Valle Stura loads the new centre at "dom 7", not now. If the instant is missing at the new place, the map goes neutral with "Colori non disponibili per quest'ora": never another moment's colours without saying so.

## 4. What the colours of the map are

Two layers of colour, both from the colour engine (verified at `a08157c`):

- The weather field (ADR-026): a lattice of up to 48 places in view, each coloured on its own by `fieldColor`: the temperature scale made richer, greyed by cloud, darkened and cooled by rain, dimmed by that place's own night. Blended between places and drawn under the map's lines (0.9) and over them (0.38). One map can show day in one valley and night beyond the mountains.
- The page sky behind it (ADR-023): the atmosphere palette of the point the map rested on, weighted by zoom, also setting the map's own inks.

So the legend says what the colour is, not whose sky it is: "Colori: la temperatura dei luoghi, adesso; nuvole e pioggia li spengono, la notte li scurisce. Modello, sfumato tra punti a circa N km" (N from the lattice step, as the field note does today), with a swatch of the temperature scale (`tempGradient`).

Today the field and the point are "now" only. Until the hourly field (WTH-345) and the point's frames (WTH-343) exist, a chosen instant shows the field labelled "adesso", never silently as if it were that hour.

## 5. Copy (Italian)

- Reading: "Adesso, mar 20 ore 15"; "Vicino a Bobbio Pellice" (a free point, named by zoom, ADR-024); "Fermati un attimo per leggere il meteo di questo punto."; "Carico il meteo di questo punto."
- Layers: "Meteo", "Territorio", "Percorsi"; "I percorsi si vedono da più vicino. Avvicinati per vederli."
- Time: "Adesso", "Torna ad adesso", "oggi", "domani", "sab 24"; "Più avanti la previsione è meno sicura."; "Oltre martedì 27 non ci sono previsioni."
- Search: "Cerca un luogo, una cima, un sentiero"; "Nessun risultato per «Rocciamelon». Prova con un altro nome."
- Verdict: "È un buon momento per andarci?", "È un buon momento per salirci?", "Buon momento.", "Con riserva.", "Non ora.", "Non si può ancora dire.", "Meglio partire alle 6: in vetta prima del vento delle 12."
- Provenance: "stimato in quota", "dal modello" ("misurato" only for a real observation, never from `Frame.measured`, which means "a provider's own point", WTH-221); "Certezza: media. Mancano 2 giorni e il modello vede la montagna a maglie di 2 km."
- Safety: "Non sostituisce il bollettino di ARPA Piemonte né le notizie sul sentiero."
- States: "Il meteo non è arrivato. Riprova."; "Qui intorno non ci sono percorsi segnati."; "12 luoghi qui intorno".
