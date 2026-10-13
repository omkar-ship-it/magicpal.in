"use client";

import { useEffect, useRef, useState } from "react";
import { IconPin, IconSearch } from "./Icons";

export type Place = { label: string; lat: number; lng: number };

/**
 * Type a place, pick from results, done.
 *
 * Coordinates only ever enter the app through a chosen result — never
 * typed, never inferred from the browser's geolocation without being shown
 * first. The person has to see the name of the place they are about to be
 * findable in, because "allow location access" is a prompt people accept
 * without reading and a pin is not something to set by accident.
 */
export default function PlaceSearch({
  value,
  onPick,
  onTyped,
  placeholder = "Search for a place",
  id,
}: {
  value: string | null;
  onPick: (p: Place) => void;
  /**
   * The raw text, for callers that want to rescue an unpicked search.
   *
   * Typing a venue and never tapping a suggestion used to save nothing at
   * all — the form looked filled in and the event quietly had no
   * coordinates, so it never appeared on the map and the host had no way to
   * tell. Callers now resolve this text on submit.
   */
  onTyped?: (text: string) => void;
  placeholder?: string;
  id?: string;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  // Derived rather than cleared in the effect. Emptying `results` on a
  // short query would be a setState during an effect for something the
  // render can simply work out, and the two can disagree for a frame.
  const tooShort = q.trim().length < 2;
  const visible = tooShort ? [] : results;

  useEffect(() => {
    if (q.trim().length < 2) return;
    const mine = ++seq.current;
    // Debounced: a geocoder call per keystroke is both a rate limit and a
    // stream of results that flicker past faster than they can be read.
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (mine !== seq.current) return;
        setResults(data.results ?? []);
        setOpen(true);
      } catch {
        if (mine === seq.current) setResults([]);
      } finally {
        if (mine === seq.current) setBusy(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  return (
    <div className="relative">
      {value && (
        <p className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-medium">
          <IconPin size={12} style={{ color: "var(--brand)" }} />
          {value}
        </p>
      )}
      <div className="relative">
        <IconSearch
          size={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]"
        />
        <input
          id={id}
          className="input"
          style={{ paddingLeft: 32 }}
          placeholder={value ? "Change it" : placeholder}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            onTyped?.(e.target.value);
          }}
          onFocus={() => visible.length > 0 && setOpen(true)}
        />
      </div>

      {open && !tooShort && (busy || visible.length > 0) && (
        <ul
          className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--card)]"
          style={{ boxShadow: "var(--shadow)" }}
        >
          {busy && visible.length === 0 && (
            <li className="px-3 py-2.5 text-[12.5px] text-[var(--ink-soft)]">Looking…</li>
          )}
          {visible.map((r) => (
            <li key={`${r.label}-${r.lat}`}>
              <button
                type="button"
                className="block w-full px-3 py-2.5 text-left text-[12.5px] hover:bg-[var(--sunk)]"
                onClick={() => {
                  onPick(r);
                  setQ("");
                  onTyped?.("");
                  setOpen(false);
                }}
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
