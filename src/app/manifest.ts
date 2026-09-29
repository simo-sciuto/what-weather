import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Meteo",
    short_name: "Meteo",
    description: "Il meteo con calma: l’informazione giusta al momento giusto.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // The splash screen opens on the night sky the page overscrolls into, not a cream flash.
    background_color: "#0d0b24",
    theme_color: "#0d0b24",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // The orb sits well inside the maskable safe zone, so the same art works.
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
