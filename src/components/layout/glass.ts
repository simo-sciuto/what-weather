/**
 * The glass the poster's maker and the map's panel are made of: the sky, half clear and blurred, no edge drawn, a soft
 * shadow under it. Not the bar's (that is `.dock-glass` in globals.css). ADR-029 makes these opaque panels later.
 */
export const GLASS =
  "bg-[color-mix(in_oklab,var(--sky-1)_44%,transparent)] shadow-[0_-18px_48px_rgb(0_0_0/0.32),inset_0_1px_0_rgb(255_255_255/0.12)] backdrop-blur-2xl backdrop-saturate-[1.8]";
