"use client";

import { useState } from "react";
import PlaceSearch, { type Place } from "./PlaceSearch";
import { IconBeacon, IconPin, IconSearch } from "./Icons";

/**
 * Where a thing is happening: here, or somewhere you name.
 *
 * Two genuinely different situations, so two ways in rather than one with a
 * detour. A meetup booked for next Thursday is typed — you aren't at the
 * venue. A drop-in started from a table in a library is *here*, and making
 * somebody search for the building they're sitting in is the kind of
 * friction that stops the thing being created at all.
 *
 * "Here" still resolves to a readable place name before it's accepted,
 * because nobody can check that 17.4435, 78.3772 is the right café.
 */
export default function VenuePicker({
  id,
  value,
  onPick,
  onTyped,
  placeholder = "T-Hub, Hyderabad",
}: {
  id?: string;
  value: string | null;
  onPick: (p: Place) => void;
  onTyped?: (text: string) => void;
  placeholder?: string;
}) {
  const [mode, setMode] = useState<"search" | "here">("search");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function useHere() {
    setError("");
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("This browser can't share a location.");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        try {
          const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
          const data = await res.json();
          const hit = data.results?.[0];
          onPick(hit ?? { label: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, lat, lng });
          onTyped?.("");
          setMode("here");
        } catch {
          // A named place is nicer, but a pin is the part that matters.
          onPick({ label: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, lat, lng });
          setMode("here");
        } finally {
          setBusy(false);
        }
      },
      (e) => {
        setBusy(false);
        setError(
          e.code === e.PERMISSION_DENIED
            ? "Location permission denied — search for the venue instead."
            : "Couldn't read your location — search for the venue instead."
        );
      },
      { enableHighAccuracy: true, timeout: 15_000 }
    );
  }

  return (
    <div>
      <div className="mb-2 flex gap-1.5">
        <button
          type="button"
          className="chip-toggle tap"
          data-on={mode === "search" ? "true" : "false"}
          aria-pressed={mode === "search"}
          onClick={() => setMode("search")}
        >
          <IconSearch size={11} /> Search a venue
        </button>
        <button
          type="button"
          className="chip-toggle tap"
          data-on={mode === "here" ? "true" : "false"}
          aria-pressed={mode === "here"}
          disabled={busy}
          onClick={useHere}
        >
          <IconBeacon size={11} /> {busy ? "Finding you…" : "I'm here now"}
        </button>
      </div>

      {mode === "here" && value ? (
        <div className="flex items-start gap-2 rounded-xl p-2.5" style={{ background: "var(--sunk)" }}>
          <IconPin size={13} className="mt-0.5 flex-none" style={{ color: "var(--brand)" }} />
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-semibold leading-[1.4]">{value}</p>
            <p className="mt-0.5 text-[11.5px] text-[var(--ink-soft)]">Your current location</p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm flex-none"
            onClick={() => setMode("search")}
          >
            Change
          </button>
        </div>
      ) : (
        <PlaceSearch id={id} value={value} placeholder={placeholder} onPick={onPick} onTyped={onTyped} />
      )}

      {error && <p className="mt-1.5 text-[12px] font-medium text-[var(--warn)]">{error}</p>}
    </div>
  );
}
