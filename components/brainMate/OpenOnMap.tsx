"use client";

import { useEffect } from "react";

/**
 * Brain-Mate lives over the map. Old addresses (/brain-mate, a shared
 * Wavelength link) still exist so link previews keep their cards — a
 * crawler reads this page's metadata and never runs this — but a person is
 * sent straight to the map with the game window open.
 */
export default function OpenOnMap({ to }: { to: string }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);
  return (
    <main className="bm-shell items-center justify-center text-center">
      <p className="text-[15px] font-semibold text-[var(--bm-soft)]">
        Opening Brain-Mate… <a className="underline" href={to}>Tap here if nothing happens</a>.
      </p>
    </main>
  );
}
