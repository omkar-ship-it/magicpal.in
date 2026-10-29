"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconBeacon, IconCheck, IconPin, IconSearch, IconX } from "./Icons";

export type Place = {
  label: string;
  lat: number;
  lng: number;
  /** The two halves of the label, when the geocoder gave them. */
  name?: string;
  context?: string | null;
};

/**
 * Type a place, pick from results, done — held to the standard everybody
 * already has in their pocket.
 *
 * Coordinates only ever enter the app through a chosen result — never
 * typed, never inferred from the browser's geolocation without being shown
 * first. The person has to see the name of the place they are about to be
 * findable in, because "allow location access" is a prompt people accept
 * without reading and a pin is not something to set by accident.
 *
 * Everything else here is the difference between a search box that works
 * and one that feels like it works, and none of it is decoration:
 *
 *  · Results are cached and kept on screen while the next request is in
 *    flight, so backspacing is instant and the list never blinks empty
 *    between keystrokes.
 *  · In-flight requests are aborted rather than merely ignored, so a fast
 *    typist is not holding six sockets open and paying for six lookups.
 *  · Arrow keys move, Enter picks, Escape closes. Enter with the list open
 *    must also *not* submit the form it sits in — the profile form was one
 *    Enter away from a failed save every time somebody searched a city.
 *  · Results bias towards where the person already is. "Gachibowli" has an
 *    unambiguous answer if you know the asker is in Hyderabad and several
 *    if you don't.
 */

/** Short enough to feel immediate, long enough not to fire per keystroke. */
const DEBOUNCE_MS = 160;

/**
 * Shared across every instance and kept for the session.
 *
 * The same few places get searched over and over — a user corrects a typo,
 * switches between the city and exact fields, reopens the panel — and a
 * repeat lookup is latency nobody needs to pay twice.
 */
const cache = new Map<string, Place[]>();

/** Tall enough for six results and the location row, short enough to place. */
const MENU_MAX = 268;

export default function PlaceSearch({
  value,
  onPick,
  onTyped,
  placeholder = "Search for a place",
  id,
  near = null,
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
  /** Somewhere the asker already is, used to rank results. */
  near?: { lat: number; lng: number } | null;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(-1);
  const [locating, setLocating] = useState(false);
  /**
   * Held apart from the search results, because it is an answer to a
   * different question. With the box empty there is no query to cache
   * against, so a located place put into `results` would be filtered
   * straight back out by the derivation below and the button would look
   * like it had done nothing.
   */
  const [located, setLocated] = useState<Place | null>(null);
  const [geoError, setGeoError] = useState("");
  const seq = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const input = useRef<HTMLInputElement>(null);
  /**
   * Where to draw the menu, in viewport coordinates.
   *
   * The menu is rendered into the body rather than next to the input,
   * because the input lives inside a floating panel that scrolls and clips
   * its own overflow — and an absolutely-positioned list inside a clipping
   * ancestor is cut off at the panel edge with nothing to say it was. The
   * result was a search that looked like it found four places when it had
   * found six, and hid "use my current location" entirely.
   *
   * Measured in event handlers, never in an effect body: the compiler
   * refuses a synchronous setState there, and every moment this needs
   * re-measuring is an event anyway — focus, typing, scroll, resize.
   */
  const [at, setAt] = useState<{ left: number; width: number; top?: number; bottom?: number } | null>(null);
  const listId = `${id ?? "place"}-list`;

  /** Below the field, or above it when the viewport has no room below. */
  function measure() {
    const r = input.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom;
    setAt(
      below < MENU_MAX + 16 && r.top > below
        ? { left: r.left, width: r.width, bottom: window.innerHeight - r.top + 6 }
        : { left: r.left, width: r.width, top: r.bottom + 6 }
    );
  }

  // Derived rather than cleared in the effect. Emptying `results` on a
  // short query would be a setState during an effect for something the
  // render can simply work out, and the two can disagree for a frame.
  const tooShort = q.trim().length < 2;
  const key = `${q.trim().toLowerCase()}|${near ? `${near.lat.toFixed(2)},${near.lng.toFixed(2)}` : ""}`;
  /**
   * A cache hit is answered during render, not by writing state inside an
   * effect — which is both a frame faster and the only version the compiler
   * accepts. Anything not cached falls through to the last fetched list, so
   * the menu holds its contents while the next request is in flight instead
   * of blinking empty between keystrokes.
   */
  const cached = tooShort ? undefined : cache.get(key);
  const visible = located ? [located] : (cached ?? (tooShort ? [] : results));

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;

    // Already answered above, during render.
    if (cache.has(key)) return;

    const mine = ++seq.current;
    const timer = setTimeout(async () => {
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;
      setBusy(true);
      try {
        const params = new URLSearchParams({ q: term });
        if (near) {
          params.set("nearLat", String(near.lat));
          params.set("nearLng", String(near.lng));
        }
        const res = await fetch(`/api/geocode?${params}`, { signal: controller.signal });
        const data = await res.json();
        if (mine !== seq.current) return;
        const list: Place[] = data.results ?? [];
        cache.set(key, list);
        setResults(list);
        setOpen(true);
      } catch {
        // An abort is the expected path, not a failure. Either way the
        // previous results stay on screen rather than blinking to empty.
        if (mine === seq.current) setOpen(true);
      } finally {
        if (mine === seq.current) setBusy(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [q, key, near]);

  /** Clicking anywhere else closes the list, the way every menu does. */
  useEffect(() => {
    if (!open) return;
    const t = (e: Event) => e.target as Node;
    const away = (e: PointerEvent) => {
      if (box.current?.contains(t(e)) || list.current?.contains(t(e))) return;
      setOpen(false);
    };
    // Capture, so a panel scrolling under the menu moves it rather than
    // leaving it hanging over the page where the field used to be.
    const follow = () => measure();
    document.addEventListener("pointerdown", away);
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    return () => {
      document.removeEventListener("pointerdown", away);
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
    };
  }, [open]);

  function choose(p: Place) {
    onPick(p);
    setLocated(null);
    setQ("");
    onTyped?.("");
    setOpen(false);
    setActive(-1);
    setGeoError("");
  }

  /**
   * "Here", resolved to a name before it is committed.
   *
   * The browser hands back a coordinate; the person is shown the place it
   * turned out to be and still has to pick it. Nobody can check that
   * 17.4435, 78.3772 is the right café.
   */
  function locateMe() {
    if (!navigator.geolocation) {
      setGeoError("This browser won't share a location.");
      return;
    }
    setLocating(true);
    setGeoError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `/api/geocode?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`
          );
          const data = await res.json();
          const first: Place | undefined = data.results?.[0];
          if (first) {
            setLocated(first);
            setOpen(true);
            setActive(0);
          }
        } catch {
          setGeoError("Couldn't look that up — try typing it.");
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        setGeoError("Location permission was declined. Type a place instead.");
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (visible.length === 0) return;
      e.preventDefault();
      setOpen(true);
      setActive((i) => {
        const next = e.key === "ArrowDown" ? i + 1 : i - 1;
        return next < 0 ? visible.length - 1 : next >= visible.length ? 0 : next;
      });
      return;
    }
    if (e.key === "Enter") {
      // Always swallowed while the list is open, picked or not. This input
      // lives inside forms with required fields, and an Enter that reaches
      // the form submits a half-filled profile instead of choosing a city.
      if (open && visible.length > 0) {
        e.preventDefault();
        choose(visible[active >= 0 ? active : 0]);
      }
      return;
    }
    if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  }

  return (
    <div className="relative" ref={box}>
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
          ref={input}
          className="input"
          style={{ paddingLeft: 32, paddingRight: 34 }}
          placeholder={value ? "Change it" : placeholder}
          value={q}
          autoComplete="off"
          role="combobox"
          aria-expanded={open && visible.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          onChange={(e) => {
            setQ(e.target.value);
            setLocated(null);
            setOpen(true);
            measure();
            setActive(-1);
            setGeoError("");
            onTyped?.(e.target.value);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => {
            setOpen(true);
            measure();
          }}
        />
        {q !== "" && (
          <button
            type="button"
            aria-label="Clear"
            className="absolute right-2 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full text-[var(--ink-soft)] hover:bg-[var(--sunk)]"
            onClick={() => {
              setQ("");
              onTyped?.("");
              setResults([]);
              setLocated(null);
              setActive(-1);
              input.current?.focus();
            }}
          >
            <IconX size={12} />
          </button>
        )}
      </div>

      {geoError && <p className="mt-1 text-[11.5px] text-[var(--warn)]">{geoError}</p>}

      {open &&
        at &&
        createPortal(
        <ul
          id={listId}
          ref={list}
          role="listbox"
          className="fixed overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--card)]"
          style={{
            left: at.left,
            width: at.width,
            top: at.top,
            bottom: at.bottom,
            maxHeight: MENU_MAX,
            // Above the floating panels, which sit at 30 + their stack index.
            zIndex: 3000,
            boxShadow: "var(--shadow-lift)",
          }}
        >
          {visible.map((r, i) => (
            <li key={`${r.label}-${r.lat}-${r.lng}`}>
              <button
                type="button"
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className="flex w-full items-start gap-2.5 px-3 py-2 text-left"
                style={{ background: i === active ? "var(--sunk)" : undefined }}
                // Pointer rather than mouse enter, so the highlight follows
                // a finger dragging down the list on a phone too.
                onPointerEnter={() => setActive(i)}
                // Fires before blur closes the list, which click does not.
                onPointerDown={(e) => {
                  e.preventDefault();
                  choose(r);
                }}
              >
                <IconPin size={13} className="mt-0.5 flex-none text-[var(--ink-soft)]" />
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] font-medium">
                    <Marked text={r.name ?? r.label} term={q} />
                  </span>
                  {r.context && (
                    <span className="block truncate text-[11.5px] text-[var(--ink-soft)]">{r.context}</span>
                  )}
                </span>
              </button>
            </li>
          ))}

          {/* Last, not first: it is the fallback for somebody who cannot
              name where they are, and putting it above the results would
              put the one irreversible-feeling option under the cursor. */}
          <li className="border-t border-[var(--line)]">
            <button
              type="button"
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-[var(--sunk)]"
              onPointerDown={(e) => {
                e.preventDefault();
                locateMe();
              }}
            >
              {locating ? (
                <IconCheck size={13} className="flex-none" style={{ color: "var(--brand)" }} />
              ) : (
                <IconBeacon size={13} className="flex-none" style={{ color: "var(--brand)" }} />
              )}
              <span className="text-[12.5px] font-medium" style={{ color: "var(--brand)" }}>
                {locating ? "Finding you…" : "Use my current location"}
              </span>
            </button>
          </li>

          {busy && visible.length === 0 && (
            <li className="px-3 py-2 text-[12px] text-[var(--ink-soft)]">Looking…</li>
          )}
          {!busy && !tooShort && visible.length === 0 && (
            <li className="px-3 py-2 text-[12px] text-[var(--ink-soft)]">
              Nothing found. Try a bigger place — a neighbourhood or a city.
            </li>
          )}
        </ul>,
        document.body
      )}
    </div>
  );
}

/**
 * The part you typed, in bold.
 *
 * Five results that each begin with the same six characters are hard to
 * tell apart; the same five with the match picked out resolve at a glance.
 */
function Marked({ text, term }: { text: string; term: string }) {
  const t = term.trim();
  if (t.length < 2) return <>{text}</>;
  const i = text.toLowerCase().indexOf(t.toLowerCase());
  if (i === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <span className="font-semibold" style={{ color: "var(--brand)" }}>
        {text.slice(i, i + t.length)}
      </span>
      {text.slice(i + t.length)}
    </>
  );
}
