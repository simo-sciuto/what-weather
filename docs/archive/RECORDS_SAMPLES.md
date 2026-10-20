# Sample records for the validation page (WTH-167)

Five historical facts, each a place and a moment, chosen with the user on 2026-10-05 ("fatti storici", the Berlin Wall as the example). For each: the weather the archive reconstructs (ERA5, 25 km, read on 2026-10-05 with `HistoricalProvider`) set beside what is documented, because a record's weather is a model's account, not an observation, and a public page must not show a weather that contradicts the history without saying so (rule 7). Re-read the weather from the provider when the records are made: these figures are for choosing, not for printing.

All five fall before 2017, so the model is ERA5 (`reanalysis`); confidence by age: medium from 1979, low before.

| # | Fact | Place (lat, lon) | Moment | Confidence | Reconstructed | Documented | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Fall of the Berlin Wall, the border opens at Bornholmer Straße at 23:30 | Berlin (52.5547, 13.3969) | 9 Nov 1989, 23:00-24:00 CET (22:00 UTC) | medium | 4.1 C, humidity 88%, nearly clear (9%), calm; the day 4.4 to 8.9 C | day high 10.3 C and low 3.9 C, a grey sky, rain forecast ([Weather Spark](https://weatherspark.com/h/m/148296/1989/11/Historical-Weather-in-November-1989-at-Berlin-Tegel-Airport-Berlin-Germany)) | **Partly at odds**: the day is about 1.4 C colder than recorded and the night is clear where the accounts say grey. Use, labelled as a reconstruction |
| 2 | The Olympic Games open in Tokyo | Tokyo, National Stadium (35.6778, 139.7144) | 10 Oct 1964, 14:00 JST (05:00 UTC) | low | 19.0 C, humidity 51%, 16% cloud, a clear sky; the day 9.3 to 19.7 C | "a magnificent blue autumn sky", "beautiful sunshine", highs around 20 C ([nippon.com](https://www.nippon.com/en/japan-data/h00558/cool-running-the-pleasant-temperatures-of-japan%E2%80%99s-october-1964-olympics.html), [Olympics.com](https://www.olympics.com/en/news/tokyo-1964-welcomes-the-world-to-the-olympic-stadium)) | **Agrees** |
| 3 | Martin Luther King, "I Have a Dream" | Washington, Lincoln Memorial (38.8893, -77.0502) | 28 Aug 1963, about 15:00 EDT (19:00 UTC) | low | 27.2 C, humidity 44%, 95% cloud, a breeze with gusts of 35 km/h; the day 16.3 to 27.6 C | 83 to 84 F (28.3 to 28.9 C), hot and humid, a cool wind ([Washington Post](https://www.washingtonpost.com/blogs/capital-weather-gang/post/a-day-to-remember-august-28-1963/2011/08/24/gIQADeZZbJ_blog.html)) | **Partly at odds**: about 1.5 C under, and a humidity that does not read as humid. Use, labelled |
| 4 | The Beatles play on the roof of Apple | London, 3 Savile Row (51.5156, -0.1419) | 30 Jan 1969, about 12:30 GMT (12:00 UTC hour) | low | 8.2 C, humidity 81%, overcast (100%), wind 25 km/h with gusts of 50, no rain | cold, "a bitter wind", about 45 F (7 C), no rain ([The Beatles Bible](https://www.beatlesbible.com/1969/01/30/the-beatles-rooftop-concert-apple-building/)) | **Agrees** |
| 5 | Nelson Mandela walks free | Victor Verster Prison, Paarl (-33.7222, 18.9786) | 11 Feb 1990, 16:14 SAST (14:00 UTC hour) | medium | 32.5 C, humidity 32%, cloudless, a strong wind (gusts of 43 km/h) | no weather found in the sources read | **Not verified**: plausible for a Cape summer afternoon, to confirm against a source before use. (He spoke that evening from the Grand Parade in Cape Town: a candidate place and moment of its own.) |

## Chosen and left out

- Replaced after the first look: the launch of Apollo 11 (16 Jul 1969, 09:32 EDT) and the 1982 World Cup final in Madrid. The archive gives overcast with a drizzle for both (0.2 and 0.8 mm), against NASA's readings (29.4 C, 73%, high cloud, distant storms, the accounts say perfect weather) and Madrid's "hot and sunny" (high 33 C): a poster showing drizzle there would look wrong to anyone who knows the event.
- Other facts to hand if one of the five falls: the end of the war in Europe (London, 8 May 1945), the Italy-France final of the 2006 World Cup (Berlin, 9 Jul 2006). Sensitive events (9/11 and the like) are left out of a page that sells posters.

## Before they go on a page

1. Make each record with `getHistoricalProvider().getAt(lat, lon, at, place)` and read the numbers again (the provider has changed since these were read: it cuts days by the true local clock and takes day and night from the sun).
2. Rows 1, 3 and 5: look for a documented source of the weather at the hour (the figures above are the day's), or accept and state the difference.
3. The poster says what the weather is: a reconstruction by ERA5 (25 km, `confidence` low or medium), never a measurement of the place: the model's grid cell, not the point, is what the numbers describe.
4. Credit "Generated using Copernicus Climate Change Service information" and Open-Meteo, on the poster as well as on the page (docs/LICENCES.md).
5. Nothing is sold before the Mapbox question (WTH-219) and Open-Meteo's commercial plan are settled.
