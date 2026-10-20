import type { Section } from "@/lib/sections";
import type { ReactNode } from "react";

/**
 * The three sections as the bar and the page's words show them: the name and the hairline icon (1.6 stroke, round
 * ends, as the rest of the page's glyphs). The ids and the addresses are `lib/sections`; this is only what is seen.
 */

const ICON = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: false,
} as const;

export const SECTION_DEFS: Record<Section, { label: string; icon: ReactNode }> = {
  meteo: {
    label: "Meteo",
    icon: (
      <svg {...ICON}>
        <path d="M7.5 18.5h9.2a3.8 3.8 0 0 0 .5-7.56 5.6 5.6 0 0 0-10.7 1.4A3.1 3.1 0 0 0 7.5 18.5Z" />
        <path d="M17.2 5.2 18 4M20 8l1.2-.4M13.6 4.4l-.2-1.2" />
      </svg>
    ),
  },
  esplora: {
    label: "Esplora",
    icon: (
      <svg {...ICON}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="m15.6 8.4-2 5.2-5.2 2 2-5.2 5.2-2Z" />
      </svg>
    ),
  },
  crea: {
    label: "Crea",
    icon: (
      <svg {...ICON}>
        <rect x="5" y="3.5" width="14" height="17" rx="1.5" />
        <path d="M8.5 15.5 11 12.5l2 2 2.5-3.5" />
        <path d="M8.5 7.5h4" />
      </svg>
    ),
  },
};
