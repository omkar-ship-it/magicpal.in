"use client";

import dynamic from "next/dynamic";

/**
 * Client-only, for the same reason the open map is: Mapbox GL reaches for
 * `window` while the module is still being evaluated, so server-rendering
 * this throws rather than producing markup.
 */
const BoardView = dynamic(() => import("./BoardView"), {
  ssr: false,
  loading: () => (
    <div className="mx-auto max-w-5xl px-4 py-5">
      <div className="h-6 w-48 rounded-full" style={{ background: "var(--sunk)" }} />
      <div className="mt-4 h-64 rounded-2xl" style={{ background: "var(--sunk)" }} />
    </div>
  ),
});

export default BoardView;
