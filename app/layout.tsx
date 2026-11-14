import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import "./globals.css";
import PWA from "@/components/PWA";
import Analytics, { AnalyticsNoScript } from "@/components/Analytics";

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
      <head>
        {/*
         * Three handshakes started before anything asks for them.
         *
         * The map is the page, and the moment it mounts it fires a dozen
         * requests at api.mapbox.com — each of which otherwise waits on a
         * DNS lookup, a TCP connection and a TLS negotiation that could
         * have happened while the HTML was still arriving. On a phone on
         * mobile data that is the better part of a second of nothing
         * happening, and it is spent at exactly the moment somebody is
         * deciding whether this works.
         *
         * `preconnect` rather than `dns-prefetch`: the whole handshake, not
         * only the name lookup, and these are three hosts we know with
         * certainty will be used rather than a guess worth hedging.
         */}
        <link rel="preconnect" href="https://api.mapbox.com" crossOrigin="" />
        <link rel="preconnect" href="https://events.mapbox.com" crossOrigin="" />
        {/* Every face without an uploaded photo is drawn here. */}
        <link rel="preconnect" href="https://api.dicebear.com" crossOrigin="" />
        {/* Only worth a handshake when there is a container to load. */}
        {process.env.NEXT_PUBLIC_GTM_ID && (
          <link rel="preconnect" href="https://www.googletagmanager.com" crossOrigin="" />
        )}
      </head>
      <body>
        <AnalyticsNoScript />
        {children}
        <PWA />
        <Analytics />
      </body>
    </html>
  );
}
