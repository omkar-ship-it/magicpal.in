"use client";

import { useEffect, useState } from "react";
import { LIVE_PING_MS } from "@/lib/rules";
import { IconBeacon, IconX } from "./Icons";

/**
 * Pushes the device's position while live sharing is on.
 *
 * Mounted only when `users.visibility` is already `live`, so turning it on
 * is a deliberate profile choice rather than a side effect of the browser
 * permission prompt. Stopping is one tap, and the server drops you back to
 * your city rather than off the map — ending a live session is not the same
 * as going private.
 *
 * Nothing here can keep a position alive on its own: the server stamps
 * `liveAt` on every write and reads treat anything older than
 * LIVE_STALE_MINUTES as not live, so closing the tab is enough to stop
 * sharing even though the UI never hears about it.
 */
export default function LiveLocation({ onChanged }: { onChanged: () => void }) {
  const [error, setError] = useState("");
  const [sharing, setSharing] = useState(true);

  useEffect(() => {
    if (!sharing || typeof navigator === "undefined" || !navigator.geolocation) return;
    let alive = true;

    const push = (pos: GeolocationPosition) => {
      if (!alive) return;
      fetch("/api/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      })
        .then((r) => {
          // 409 means the profile is no longer set to live — another tab or
          // device turned it off. Stop rather than fight it.
          if (r.status === 409 && alive) setSharing(false);
        })
        .catch(() => {});
    };

    const fail = (e: GeolocationPositionError) => {
      if (alive) setError(e.code === e.PERMISSION_DENIED ? "Location permission denied." : "Couldn't read your location.");
    };

    navigator.geolocation.getCurrentPosition(push, fail, { enableHighAccuracy: true, timeout: 15_000 });
    const timer = setInterval(
      () => navigator.geolocation.getCurrentPosition(push, fail, { enableHighAccuracy: true, timeout: 15_000 }),
      LIVE_PING_MS
    );
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [sharing]);

  async function stop() {
    setSharing(false);
    await fetch("/api/live", { method: "DELETE" }).catch(() => {});
    onChanged();
  }

  if (!sharing) return null;

  return (
    <div className="pointer-events-auto absolute left-3 top-[68px] z-20">
      <div
        className="flex items-center gap-2 rounded-full border px-3 py-1.5"
        style={{
          background: "color-mix(in srgb, var(--chrome) 94%, transparent)",
          borderColor: "var(--chrome-line)",
          boxShadow: "var(--shadow)",
        }}
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full" style={{ background: "var(--good)", opacity: 0.6 }} />
          <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: "var(--good)" }} />
        </span>
        <span className="text-[12px] font-semibold" style={{ color: "var(--chrome-ink)" }}>
          <IconBeacon size={11} className="mr-1 inline" />
          {error || "Sharing live location"}
        </span>
        <button type="button" onClick={stop} aria-label="Stop sharing live location" style={{ color: "var(--chrome-soft)" }}>
          <IconX size={12} />
        </button>
      </div>
    </div>
  );
}
