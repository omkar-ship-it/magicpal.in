"use client";

import { useEffect, useState } from "react";

/** Below this, floating windows stop making sense and become sheets. */
export const NARROW_PX = 640;

/**
 * Whether we're on a phone-shaped screen.
 *
 * A JS signal rather than a CSS breakpoint because the *behaviour* differs,
 * not only the styling: on a narrow screen one window is shown at a time
 * instead of several cascading, which is a render decision CSS can't make.
 *
 * Lazily initialised from the real width — every caller renders behind an
 * ssr:false loader, so the DOM is there on the first render and there's no
 * flash of the wrong layout.
 */
export function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && window.innerWidth < NARROW_PX
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${NARROW_PX - 1}px)`);
    const sync = () => setNarrow(mq.matches);
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return narrow;
}
