# Licences for selling records (WTH-166)

Research of 2026-10-04 on the providers' own pages, to see whether the weather data and the maps may be sold as digital files and prints (ADR-013, the Records track). Not legal advice: what each source says, quoted or reported as read, and what is left to confirm with the provider. Re-check before any payment is built (WTH-172): terms change (Mapbox's Product Terms are dated 21 July 2026).

## In one page

| Source | Today's use (free app) | Selling records (digital files and prints) |
| --- | --- | --- |
| Open-Meteo (forecast, air quality, archive) | free API, non-commercial | needs a paid plan; attribution CC BY 4.0 |
| Mapbox (the map in the poster) | the page's map, on a token | printed and static digital copies need print rights bought from Mapbox; **the free poster download is in the same clause** |
| OpenWeather (the other provider) | free tier or key | commercial use permitted; attribution "Weather data © OpenWeather" |
| ERA5 reanalysis (the historical data, via Open-Meteo) | not used yet | allowed with attribution "Generated using Copernicus Climate Change Service information" |

Verdict: **records cannot be sold yet.** Two things stand in the way, and the second also touches what the app does now.

## Open-Meteo

- Free API: "for non-commercial use, rate-limited to 10,000 calls/day and carries no uptime guarantee" (open-meteo.com/en/pricing). Terms (open-meteo.com/en/terms): non-commercial examples are private websites without ads, home automation, public research and education; commercial use includes "Operating websites or apps that have subscriptions or display advertisements" and "Integrating our service into commercial products or promotional activities". Commercial users must subscribe.
- Paid plans (Standard, Professional, Enterprise; 1M, 5M and 50M+ calls a month) each grant "a commercial use licence and an API key for the dedicated customer endpoint". The prices were not on the page as read: to look up.
- Attribution is mandatory: the data is CC BY 4.0, "giving appropriate credit and indicating any modifications made". The page already credits Open-Meteo in the footer.
- The terms say nothing on reselling a product that embeds the data (a printed poster, a file): CC BY 4.0 allows commercial use and distribution with credit; to confirm with Open-Meteo if there is doubt.
- **Consequence.** Selling records is commercial use. Under ADR-013 the free app is the shop window for the records ("promotional activities"), so the paid plan should cover the whole site, not only the records flow, from the day anything is sold. A paid plan also gives a dedicated endpoint (the free one has no uptime guarantee).

## Mapbox (Product Terms, 21 July 2026)

- 1.7 Print or Video Use: "Customer may not use any Licensed Map Content in any printed or video media except expressly as set forth in this Section. Printed media are limited to printed paper copies and static digital copies such as PDF, JPG, PNG and other similar non-extractable file formats." The rights in the section are: 1.7.1 no-charge promotional use, only to promote the application and "only incidentally"; 1.7.2 Studio, "up to an aggregate total of 100 high resolution static digital copies ... during the lifetime of Customer's account"; 1.7.3 limited to Mapbox Streets v8 or later, Japan excluded; 1.7.4 "Customer may purchase additional print or video rights ... in an applicable active Order".
- 2.8.1: "Customer shall not distribute Licensed Map Content, including from a cache, by proxying, or by using a screenshot or other static image instead of accessing Licensed Map Content directly from the Mapping APIs."
- 1.4.1 Mandatory attribution: the Mapbox logo, "© Mapbox" and "© OpenStreetMap" (with links; on print "except for the requirement to include the URL links where that is not feasible", per 1.7). The help pages say: on prints where links cannot be included, the logo and "© Mapbox, © OpenStreetMap"; for prints sold online, the attribution and live links on the product page.
- The help pages add that printing of static images is permitted only for personal non-commercial use, and that commercial print needs contacting Mapbox (sales).
- **Consequence.** A poster sold with the Mapbox map in it (a file or a print) needs print rights bought from Mapbox under an Order: contact Mapbox sales for the terms and the price. Without them, selling it breaks 1.7 and 2.8.1.
- **Also, today.** The app's own "Crea poster" gives the user a PNG of the poster with the map drawn in it, which is a static digital copy of Licensed Map Content. Whether that is covered by the terms today (1.7.1 only covers promoting the application, and only incidentally) is not something the text settles: to ask Mapbox, and to decide with the user whether to keep it as it is meanwhile (WTH-220).
- **Way out, if the price or the answer is no.** Draw the poster's map from OpenStreetMap data with our own style (ODbL: credit "© OpenStreetMap contributors", share-alike applies to the database, not to a rendering) from a tile source whose terms allow print and sale (self-hosted vector tiles, or a provider whose terms say so), keeping Mapbox for the live page only. That is an architect decision before WTH-170 (WTH-219); the poster's style is already generated from the palette, not taken from Mapbox's, which makes it feasible.

## OpenWeather

- Commercial use is permitted; data under ODbL, with "visible attribution": "Weather data © OpenWeather" (openweathermap.org/full-price).
- Plans: Free (1,000 calls a day, Air Pollution API included), Startup 35 euro a month, Developer 160, Professional 410, Expert 1,200. The page lists "Historical data with 1-hour step (47+ years back)" among the free plan's features and a History API only on paid plans (1 month back, or 1 year on Expert): what exactly the free historical access is, and whether it fits a record of an arbitrary past date, was not settled by the page: to check if OpenWeather is considered for WTH-168.
- Open-Meteo's archive is the planned source for WTH-168; OpenWeather is the fallback to look at.

## ERA5 (the historical weather, WTH-168)

- Open-Meteo's historical API: ERA5 (0.25 degrees, about 25 km, 1940 to now, 5 days' delay), ERA5-Land (0.1 degrees, about 11 km, 1950 to now), ECMWF IFS (9 km, 2017 to now), CERRA (5 km, Europe, 1985 to June 2021). Hourly variables listed: temperature, humidity, dew point, precipitation, cloud cover, wind; **visibility was not in the list as read**, so haze for a past record would rest on humidity and dew point alone (the engine copes with missing visibility: it adds none, WTH-046B), which is to be said in the record (rule 7).
- Attribution to carry: "Generated using Copernicus Climate Change Service information" for ERA5 (and the Open-Meteo credit). From 2017 the data is ECMWF's IFS as Open-Meteo assembles it "using simulation runs daily at 0z, 6z, 12z and 18z": archived operational forecast runs, not a reanalysis, and the page gives for it no credit of ECMWF's, only Open-Meteo's: to confirm with Open-Meteo (and ECMWF's open-data terms) before any record from 2017 on is sold. Reanalysis is a model's reconstruction, not a measurement, and "fills in gaps by using mathematical models": a record's provenance must say reanalysis, and the older the date the less sure (ADR-013).

## What this decides, and what it needs from the user

1. **Mapbox print rights or another map for the poster** (WTH-219): ask Mapbox sales what the rights cost for the volumes expected; decide against drawing the poster's map from open data. This is the blocking item.
2. **The present poster download** (WTH-220): ask Mapbox if "Crea poster" is covered; meanwhile the user decides whether it stays.
3. **An Open-Meteo paid plan** from the first sale: look up the price; treat the whole site as commercial.
4. **Credits** for ERA5 and Open-Meteo in the records flow and on the poster itself (the print carries attribution, not only the page's footer).
5. Nothing is to be built for payment (WTH-172) before 1 and 3 are answered, as ADR-013 says.
