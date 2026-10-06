/** "#rrggbb" as [r, g, b], each 0 to 255 */
export const hexToRgb = (hex: string): [number, number, number] =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];

/** "#rrggbb" and an alpha as a colour a canvas or Mapbox reads: "rgba(12, 34, 56, 0.5)" */
export const hexToRgba = (hex: string, alpha: number) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
