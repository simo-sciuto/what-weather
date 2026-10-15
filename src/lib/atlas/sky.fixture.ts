import type { PointSky } from "@/types/atlas";
import { CLEAR_MAP } from "@/lib/weather/palette";

/** A sky in the palette's own forms, for the tests that need a whole point and care nothing for its colours */
export const FIXTURE_SKY: PointSky = {
  sky1: "#245faf",
  sky2: "#246ca4",
  sky3: "#476f83",
  glass: "rgb(20 40 80 / 0.300)",
  glow: "rgb(249 232 167 / 0.380)",
  sun: "#f9e8a7",
  cloud: "rgb(255 255 255 / 0.500)",
  air: CLEAR_MAP,
};
