import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  // The name beside the favicon, which is the one piece of branding every
  // visitor sees whether or not they ever read a word of the page.
  title: `${BRAND_NAME} — ${BRAND_TAGLINE}`,
  description:
    "Boards for events and communities, and a map of the people on them. Scan a code, see the room, and get told who to talk to and why.",
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
      <body>{children}</body>
    </html>
  );
}
