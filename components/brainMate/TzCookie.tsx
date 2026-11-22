"use client";

import { useEffect } from "react";

/**
 * The one-a-day rule counts in the sender's own calendar day, and server
 * pages need to know which day that is. The browser knows its time zone;
 * this hands it over once per visit.
 */
export default function TzCookie() {
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) document.cookie = `bm_tz=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`;
    } catch {
      /* no time zone, the server falls back to IST */
    }
  }, []);
  return null;
}
