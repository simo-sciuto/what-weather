import type { Metadata } from "next";
import { AtlasShell } from "@/components/atlas/AtlasShell";

/**
 * The Atlas, an experiment on its own route (ADR-027, ADR-020): the map, free. The shell with the map lives here, in the
 * layout, so it is made once and the content of the route comes and goes inside it. The home page is not touched.
 */
export const metadata: Metadata = {
  title: "Esplora la mappa",
  description: "La mappa di what-weather, libera da esplorare.",
  // An experiment: not offered to search engines
  robots: { index: false, follow: false },
};

export default function AtlasLayout({ children }: { children: React.ReactNode }) {
  return <AtlasShell>{children}</AtlasShell>;
}
