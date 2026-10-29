import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import "./globals.css";
import PWA from "@/components/PWA";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

/**
 * The colour the phone paints its own chrome with — the status bar in a
 * standalone window, the tab strip in a browser. Follows the theme, because
 * a light bar above a dark app is the one combination that reads as broken
 * rather than merely unstyled.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdf1ec" },
    { media: "(prefers-color-scheme: dark)", color: "#1a110d" },
  ],
  // The map runs to the edges, so the window should too — on a notched
  // phone this is the difference between a full-bleed map and two grey bars.
  viewportFit: "cover",
};

export const metadata: Metadata = {
  // The name beside the favicon, which is the one piece of branding every
  // visitor sees whether or not they ever read a word of the page.
  title: `${BRAND_NAME} — ${BRAND_TAGLINE}`,
  description:
    "Boards for events and communities, and a map of the people on them. Scan a code, see the room, and get told who to talk to and why.",
  // iOS has no manifest support worth the name; these are what make an
  // added-to-home-screen icon open without Safari's chrome around it.
  appleWebApp: {
    capable: true,
    title: BRAND_NAME,
    statusBarStyle: "default",
  },
  other: {
    /**
     * Next emits only the modern `mobile-web-app-capable`. iOS 17 and later
     * take `display` from the manifest and need neither, but the phones
     * already in people's pockets read this one — and a home-screen icon
     * that opens inside Safari's chrome is the exact thing installing was
     * meant to avoid.
     */
    "apple-mobile-web-app-capable": "yes",
  },
};

/**
 * Deliberately bare — no header, no padded container. The map is a
 * full-bleed app screen with its own floating chrome, not a website page
 * with a map embedded in it; secondary screens get the traditional header
 * via the (app) route group's own layout.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        {children}
        <PWA />
      </body>
    </html>
  );
}
