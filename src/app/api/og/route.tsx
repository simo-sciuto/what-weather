import { parsePlaceRef } from "@/lib/place";
import { weatherFor } from "@/lib/weather-page";
import { DEFAULT_PLACE } from "@/lib/weather/constants";
import { conditionLabel, placeSubtitle, tempDigits } from "@/lib/weather/formatters";
import { frameLook } from "@/lib/weather/look";
import { buildNarrative } from "@/lib/weather/narrative";
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

const SIZE = { width: 1200, height: 630 };

/**
 * The picture shown when a link to a place is shared: the place's sky right
 * now (the same palette as the page), its name, the temperature, the sky in
 * words and the outlook. Reads the weather through the shared cache, so it
 * costs a render, not a forecast call.
 */
export async function GET(request: NextRequest) {
  const ref = parsePlaceRef(Object.fromEntries(request.nextUrl.searchParams)) ?? DEFAULT_PLACE;
  try {
    const { data, timeline } = await weatherFor(ref);
    const now = timeline.frames[0];
    const { palette: p, sky } = frameLook(now);
    const night = now.phase === "night";
    // The light source where it sits in the sky on the page.
    const glowX = night ? 76 : 12 + 76 * sky.progress;
    const glowY = night ? 16 : 66 - 56 * Math.max(sky.elevation, 0);
    const subtitle = placeSubtitle(data.place);

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "64px 72px",
            color: "white",
            backgroundColor: p.sky2,
            backgroundImage: `radial-gradient(circle at ${glowX}% ${glowY}%, ${p.glow} 0%, transparent 38%), linear-gradient(180deg, ${p.sky1} 0%, ${p.sky2} 55%, ${p.sky3} 100%)`,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 68, fontWeight: 700, letterSpacing: -1 }}>{data.place.name}</div>
            {subtitle && <div style={{ fontSize: 30, opacity: 0.86, marginTop: 6 }}>{subtitle}</div>}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
            <div style={{ display: "flex", fontSize: 220, lineHeight: 0.8, letterSpacing: -10 }}>
              {tempDigits(data.current.temp)}
              <span style={{ fontSize: 110, marginLeft: 6 }}>°</span>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 14,
                paddingLeft: 40,
                borderLeft: "2px solid rgba(255,255,255,0.25)",
                maxWidth: 560,
              }}
            >
              <div style={{ fontSize: 48, fontWeight: 600 }}>{conditionLabel(data.current)}</div>
              <div style={{ fontSize: 30, lineHeight: 1.3, opacity: 0.9 }}>{buildNarrative(data)}</div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 26, opacity: 0.8 }}>
            <div style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: p.sun }} />
            what-weather
          </div>
        </div>
      ),
      {
        ...SIZE,
        // The forecast refreshes every 10 minutes; so can the picture.
        headers: { "Cache-Control": "public, max-age=600, stale-while-revalidate=3600" },
      },
    );
  } catch {
    return new Response("Anteprima non disponibile", { status: 502 });
  }
}
