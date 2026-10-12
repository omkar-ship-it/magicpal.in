"use client";

import dynamic from "next/dynamic";

/**
 * Client-only. Mapbox GL touches `window` at import time and the panel
 * reads state the server can't know, so rendering this on the server
 * produces a hydration mismatch rather than a faster first paint.
 */
const OpenMap = dynamic(() => import("./OpenMap"), {
  ssr: false,
  loading: () => <div className="h-dvh w-full" style={{ background: "var(--sunk)" }} />,
});

export default OpenMap;
