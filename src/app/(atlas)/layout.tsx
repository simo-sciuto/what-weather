import type { Metadata } from "next";
import { AtlasShell } from "@/components/atlas/AtlasShell";

/**
 * The atmospheric atlas, the site itself (ADR-030): the map, free, painted by the weather. The shell with the map lives
 * here, in the layout of the route group, so it is made once and the content of the route comes and goes inside it
 * (ADR-021). `/` is this group's page; `/atlas` and `/crea` redirect here (next.config.ts).
 */
export const metadata: Metadata = {
  title: "Atlante del meteo",
  description: "Il Piemonte e le Alpi occidentali colorati dal meteo: esplora il territorio, scegli l'ora, guarda come cambia.",
};

export default function AtlasLayout({ children }: { children: React.ReactNode }) {
  return <AtlasShell>{children}</AtlasShell>;
}
