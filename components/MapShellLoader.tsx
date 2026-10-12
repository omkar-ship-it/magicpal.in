"use client";

import dynamic from "next/dynamic";

/**
 * Client-only. Mapbox GL reaches for `window` while the module is still
 * being evaluated, so server-rendering this throws rather than producing
 * markup — and MapCanvas reads the theme off the DOM on first render.
 */
const MapShell = dynamic(() => import("./MapShell"), {
  ssr: false,
  loading: () => <div className="h-dvh w-full" style={{ background: "var(--sunk)" }} />,
});

export default MapShell;
