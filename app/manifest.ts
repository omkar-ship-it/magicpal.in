import type { MetadataRoute } from "next";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";

/**
 * What the phone needs to treat this as an app rather than a bookmark.
 *
 * The map is the whole product and it is already a full-bleed screen with
 * its own floating chrome, so `standalone` is not a cosmetic choice: it
 * reclaims the browser's address bar and toolbar, which on a phone is about
 * fifteen percent of the map.
 *
 * `start_url` is "/" — the map itself, not a landing page. Somebody who
 * pinned this to their home screen has already decided; opening them onto
 * a page explaining the product would be answering a question they stopped
 * asking when they installed it.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: `${BRAND_NAME} — ${BRAND_TAGLINE}`,
    short_name: BRAND_NAME,
    description:
      "A map of people who said they're open to meeting someone. See who's near, what they're after, and why it's worth walking over.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // The app's own ground, so the launch screen does not flash white and
    // then settle into something else.
    background_color: "#fdf1ec",
    theme_color: "#fdf1ec",
    categories: ["social", "business", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Square to the edges, mark pulled in: Android crops this to whatever
      // shape the launcher uses, and a rounded tile inside a circular mask
      // loses its own corners twice.
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Your boards", short_name: "Boards", url: "/boards" },
      { name: "Your profile", short_name: "Profile", url: "/?panel=profile" },
    ],
  };
}
