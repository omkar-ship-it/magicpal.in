"use client";

import { useSyncExternalStore } from "react";
import { whenLabel } from "@/lib/time";

/** Nothing to subscribe to — the value changes once, at hydration. */
const subscribe = () => () => {};

/**
 * An event's date, in the reader's timezone rather than the server's.
 *
 * `toLocaleString(undefined, …)` formats in whatever zone the process
 * happens to run in, which for a server component is UTC. So a 5pm event
 * in Hyderabad advertised itself as 11:30am on /b/<slug> — the one page a
 * stranger reads before deciding whether to come, and the page every
 * shared link and QR code lands on.
 *
 * `useSyncExternalStore` rather than a mounted flag: it takes a separate
 * server snapshot by design, so the markup React hydrates against is the
 * one the server actually sent, and the correction happens without a
 * mismatch warning or a setState in an effect body — which this repo's
 * compiler rejects outright.
 */
export default function WhenLabel({ iso, server }: { iso: string; server: string }) {
  return (
    <>
      {useSyncExternalStore(
        subscribe,
        () => whenLabel(iso),
        () => server
      )}
    </>
  );
}
