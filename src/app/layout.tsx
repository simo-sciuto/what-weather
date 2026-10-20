import type { Metadata, Viewport } from "next";
import { Inter_Tight } from "next/font/google";
import "./globals.css";

/** The one family of the page (DESIGN_SYSTEM.md; Inter Tight until the user chooses between it and Inter) */
const poster = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  // Share images need absolute URLs; set SITE_URL in production (on Vercel the deployment URL is used otherwise).
  metadataBase: process.env.SITE_URL ? new URL(process.env.SITE_URL) : undefined,
  title: { default: "what-weather", template: "%s · what-weather" },
  description: "Un atlante del Piemonte e delle Alpi occidentali colorato dal meteo.",
  applicationName: "what-weather",
  appleWebApp: { capable: true, title: "what-weather", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

/**
 * Static, so the shell can be prerendered: the browser chrome starts on the
 * night sky the page overscrolls into. Every sky is deep enough for white text, so dark-styled.
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
