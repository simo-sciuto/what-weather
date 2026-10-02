import type { Metadata, Viewport } from "next";
import { Inter_Tight } from "next/font/google";
import "./globals.css";

/** The one family of the page, many weights: the place's name heavy and tight, the temperature light, the small print in between. */
const poster = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  // Share images need absolute URLs; set SITE_URL in production (on Vercel the deployment URL is used otherwise).
  metadataBase: process.env.SITE_URL ? new URL(process.env.SITE_URL) : undefined,
  title: { default: "what-weather", template: "%s · what-weather" },
  description: "Il meteo con calma: l’informazione giusta al momento giusto.",
  applicationName: "what-weather",
  appleWebApp: { capable: true, title: "what-weather", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

/**
 * Static, so the shell can be prerendered: the browser chrome starts on the
 * night sky the page overscrolls into, then AtmosphereMain tints it with the
 * sky of the moment. Every sky is deep enough for white text, so dark-styled.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0c0f25",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" className={`${poster.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
