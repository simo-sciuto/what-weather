# LICENCES AND TERMS FOR SELLING RECORDS (WTH-166)

Research of 2026-10-06. Not legal advice: a lawyer or the provider's written answer settles what this page only reads.

**How it was checked.** The container's network blocks open-meteo.com, mapbox.com, openweathermap.org and the Mapbox terms PDFs, so the original pages could not be opened. Every finding below comes from web search summaries of the official pages (links at the end). Before any money is taken, read the originals once, and keep the Mapbox and OpenWeather answers in writing.

## Verdict

The records cannot be sold today. Three things stand in the way, in this order of weight:

1. **Mapbox: selling prints of its maps needs Mapbox's permission.** Open question, the biggest one.
2. **Open-Meteo's free API is non-commercial only.** A paid plan is needed, whichever weather provider the page uses.
3. **Hosting: Vercel's free Hobby plan forbids a site that takes payment.** Pro is needed.

Smaller gaps: the poster carries no credit for the weather data, and OpenWeather's share-alike wording needs a written answer.

## By source

### Open-Meteo (free API, no key)

- **Used for:** the weather itself with `WEATHER_PROVIDER=open-meteo`, and always, whatever the provider: the clouds and rain drawn on the maps, yesterday's comparison, pollen, the towns around (`src/lib/api/sources/`).
- **Rule:** the free API is for non-commercial use: private or non-profit sites and apps without subscriptions or advertising, research, education. Commercial examples: apps with subscriptions or ads, and "integrating the service into commercial products or promotional activities".
- **Consequence:** the free app with no ads is fine today. Once records are sold, the app is the shop window of a commercial product, so it needs a commercial plan, even while OpenWeather is the forecast provider, because the sources above stay on Open-Meteo.
- **Price (third-party summaries, check the pricing page):** Standard 29 USD per month, 1 million calls (forecast, marine, air quality, geocoding, elevation, flood); Professional 99 USD per month, 5 million calls, adds historical reanalysis, ensembles, climate and solar; Enterprise on request, above 50 million calls. A subscription gives a commercial licence and an API key on a dedicated endpoint, no per-call overage.
- **Attribution (CC BY 4.0), always, paid or not:** a link next to wherever Open-Meteo data is shown, like "Weather data by Open-Meteo.com". The site's footer does it (`SiteFooter.tsx`); **the poster does not** (its credits read only "© MAPBOX © OPENSTREETMAP", `compose.ts`).
- **Needed for the Historical records track (WTH-170):** archive data; check which plan includes it.

### Mapbox (map, terrain, geocoding)

- **Used for:** the poster's map is the site's style drawn off screen with Mapbox GL JS: `mapbox-streets-v8`, `mapbox-terrain-v2`, `mapbox-terrain-dem-v1`, `mapbox-traffic-v1` (`map-style.ts`); the region and country from the geocoding API; `city-facts.ts` tile queries.
- **Print rule (Product Terms, 2025-10 edition among the results):** Mapbox map content may not be used in printed or video media except as the agreement allows. "Printed media" means printed paper copies and static digital copies (PDF, JPG, PNG, similar non-extractable formats). The rights listed: promotional use for the licensed app, up to 100 high-resolution static copies in Mapbox Studio over the account's life, and additional print rights bought in an order.
- **Docs wording:** "printing of static images is only permitted for personal, non-commercial use"; to resell or use prints commercially, contact Mapbox. Print needs Mapbox attribution, like a photograph's credit near the image.
- **The clause that would fit us:** older editions of the terms let a customer "make and offer for sale to End Users custom depictions of the map features ... provided that for each depiction, an End User directs which map features are included ... using an interface that uses Mapbox APIs". That is close to our flow (the person picks the place and the moment, the map is drawn by the Mapbox API). The summaries show it only in older editions: **whether the current terms keep it is not confirmed.**
- **Consequence:** do not assume the "Crea poster" button may become a paid product. Ask Mapbox sales, in writing, with this exact case: poster drawn in the browser from Mapbox GL JS vector tiles and the DEM, exported as PNG or SVG with the map as a raster, sold as a digital file and as a print through a print-on-demand partner (the partner prints a file we send), expected volume per year. Ask what print rights cost, and whether the print-on-demand partner needs anything.
- **Geocoding storage:** temporary geocoding results may not be cached or stored; permanent geocoding may, costs more and needs a card on file. Today the region and country are looked up when the poster is drawn. If an order stores the place's names, use the permanent mode (WTH-172).
- **Attribution on the poster:** "© MAPBOX © OPENSTREETMAP" is printed. Mapbox's rule asks for the URL links except where not feasible, so the missing URLs are acceptable on a poster.

### OpenStreetMap (inside Mapbox's tiles)

- **Licence:** ODbL. A printed map is a Produced Work: attribution is required, **no share-alike** unless the data itself is extracted and distributed.
- **Attribution:** "© OpenStreetMap contributors" with openstreetmap.org/copyright; on print the OSM Foundation asks for the URL to be printed where other credits stand. The poster prints "© OPENSTREETMAP" without it: fine under Mapbox's exception, tighter than OSM's own guideline. Decide with Mapbox's answer.
- Not a blocker: the poster already credits it.

### OpenWeather (default provider when a key is set)

- **Used for:** the forecast (One Call 4.0, `OPENWEATHER_API_KEY`), place names from coordinates, geocoding, the air quality.
- **Rule (the summaries cover One Call 3.0, the project uses 4.0: not verified for 4.0):** self-service plans are under ODbL for the data and CC BY-SA 4.0 for the API, with visible attribution to OpenWeather. They allow commercial use and building a commercial derivative product, **with a share-alike duty on how that product is then distributed.** A separate "OpenWeather for Business" licence builds a commercial derivative product with no such duty.
- **Consequence:** a poster is a product made from the weather data. Whether it is a "derivative product" that would have to be shared alike, or a Produced Work that needs only a credit, is for OpenWeather to say. Ask in writing; if the answer is not clear, either take the Business licence or sell on Open-Meteo's commercial plan (CC BY, no share-alike).
- **Attribution:** the poster has none for OpenWeather. Needed whichever provider the poster's numbers come from.

### Hosting (Vercel)

- The Hobby plan is for personal, non-commercial use. Commercial use (requesting or processing payment, advertising the sale of a product, ads) needs Pro (20 USD per user per month) or Enterprise. A free site with a "buy a record" button already counts as advertising a sale. Move to Pro before the first sale, or before the shop window opens.

### Already clear

- **Fonts:** Syne, Inter Tight, Schibsted Grotesk are SIL OFL 1.1, self-hosted with the licence text (WTH-197). Selling the poster that uses them is allowed; the font files themselves are not sold.
- **Wikidata** (the Territorio chapter): CC0, no duty.
- **Natural Earth** (candidate for WTH-194): public domain, no duty.

### Not covered here

Consumer law (right of withdrawal on custom goods, VAT, invoicing), privacy of orders, the print-on-demand partner's own terms (WTH-172), trademark of the name.

## What to do, in order

1. Write to Mapbox sales (the case above) and OpenWeather (share-alike on a poster); keep the answers. Nothing else is worth building before Mapbox answers: if Mapbox says no, the poster needs another map source (WTH-194 touches this).
2. Choose the weather source for sale: Open-Meteo Standard (29 USD per month) with CC BY credit, or OpenWeather Business. Open-Meteo is cheaper and simpler; the sources that stay on Open-Meteo need its plan anyway.
3. Add the weather data's credit to the poster (and the exports), next to the map's.
4. Vercel Pro before taking payment.

## Sources

- Open-Meteo terms: https://open-meteo.com/en/terms, pricing: https://open-meteo.com/en/pricing, licence: https://open-meteo.com/en/license
- Mapbox Product Terms (2025-10): https://cdn.prod.website-files.com/609ed46055e27a02ffc0749b/68dddd2815cb3d82685f0096_Mapbox%20Product%20Terms%20(October%201,%202025).pdf; earlier editions with the custom depictions clause, for example August 2023: https://uploads-ssl.webflow.com/5d4296d7a839ea49599adba1/64dcfbaf8b0b4e80b42d5c40_Mapbox%20Product%20Terms%20(August,%202023).pdf
- Mapbox static and print maps: https://docs.mapbox.com/help/dive-deeper/static-maps/; attribution: https://docs.mapbox.com/help/dive-deeper/attribution/; temporary and permanent geocoding: https://docs.mapbox.com/help/dive-deeper/understand-temporary-vs-permanent-geocoding/
- OpenStreetMap attribution: https://osmfoundation.org/wiki/Attribution; licence FAQ: https://osmfoundation.org/wiki/Licence_and_Legal_FAQ
- OpenWeather pricing: https://openweathermap.org/full-price; licence explainer: https://openweathermap.org/storage/app/media/documents/License_explainer_25%20Feb_25.pdf
- Vercel Hobby: https://vercel.com/docs/plans/hobby; fair use: https://vercel.com/docs/limits/fair-use-guidelines
