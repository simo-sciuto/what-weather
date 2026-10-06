/** The text with its first letter in capitals */
export const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Lower case letters and digits joined by single hyphens, no accents: "Reykjavík, Íslandi" is "reykjavik-islandi" */
export const slug = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
