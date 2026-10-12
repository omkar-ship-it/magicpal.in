"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PlaceSearch, { type Place } from "./PlaceSearch";
import { IconCalendar, IconPeople } from "./Icons";

/**
 * Create a board.
 *
 * The type choice comes first and changes the form, because the two really
 * are different asks — an event needs a date and a venue, a community
 * needs neither and would be insulted by being asked. Everything else is
 * shared, which is the same observation the schema makes.
 */
export default function CreateBoard({ parentSlug, parentName }: { parentSlug?: string; parentName?: string }) {
  const router = useRouter();
  const [type, setType] = useState<"event" | "community">("event");
  const [name, setName] = useState("");
  const [blurb, setBlurb] = useState("");
  const [place, setPlace] = useState<Place | null>(null);
  const [placeText, setPlaceText] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          name,
          blurb,
          place: place?.label ?? placeText,
          lat: place?.lat,
          lng: place?.lng,
          // datetime-local gives a wall-clock string with no zone. Parsing
          // it as local time is what the host meant — they typed the time
          // on the invitation, not a UTC instant.
          startsAt: type === "event" && startsAt ? new Date(startsAt).toISOString() : undefined,
          parentSlug,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't create that.");
      router.push(`/b/${data.slug}?new=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-4 p-5">
      {parentName && (
        <p className="text-[12.5px] text-[var(--ink-soft)]">
          Inside <span className="font-semibold text-[var(--ink)]">{parentName}</span> — only its members will see it.
        </p>
      )}

      {!parentSlug && (
        <div className="grid grid-cols-2 gap-2">
          <TypeOption
            on={type === "event"}
            onClick={() => setType("event")}
            icon={<IconCalendar size={15} />}
            label="An event"
            detail="One room, one day"
          />
          <TypeOption
            on={type === "community"}
            onClick={() => setType("community")}
            icon={<IconPeople size={15} />}
            label="A community"
            detail="A group, ongoing"
          />
        </div>
      )}

      <div>
        <label className="label" htmlFor="board-name">
          Name
        </label>
        <input
          id="board-name"
          className="input"
          required
          placeholder={type === "event" ? "Hyderabad Product Meetup #12" : "ISB Alumni — Hyderabad"}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="board-blurb">
          One line about it
        </label>
        <input
          id="board-blurb"
          className="input"
          placeholder={type === "event" ? "Talks, then an hour of actual mingling" : "Where our batch actually keeps in touch"}
          value={blurb}
          onChange={(e) => setBlurb(e.target.value)}
        />
      </div>

      {type === "event" ? (
        <>
          <div>
            <label className="label" htmlFor="board-when">
              When
            </label>
            <input
              id="board-when"
              type="datetime-local"
              className="input"
              required
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="board-venue">
              Venue
            </label>
            <PlaceSearch
              id="board-venue"
              value={place?.label ?? null}
              placeholder="T-Hub, Hyderabad"
              onPick={setPlace}
            />
          </div>
        </>
      ) : (
        <div>
          <label className="label" htmlFor="board-where">
            Where it&rsquo;s based
          </label>
          <input
            id="board-where"
            className="input"
            placeholder="Everywhere, or a city"
            value={placeText}
            onChange={(e) => setPlaceText(e.target.value)}
          />
          {/* A community map is about spread, so it centres on its members
              rather than on one address. Nothing to geocode. */}
          <p className="mt-1.5 text-[12px] leading-[1.45] text-[var(--ink-soft)]">
            Free text — the map centres on wherever your members actually are.
          </p>
        </div>
      )}

      {error && <p className="text-[13px] font-medium text-[var(--warn)]">{error}</p>}

      <button type="submit" disabled={busy} className="btn btn-primary">
        {busy ? "Creating…" : "Create and get the QR code"}
      </button>
    </form>
  );
}

function TypeOption({
  on,
  onClick,
  icon,
  label,
  detail,
}: {
  on: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  detail: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="flex flex-col items-start gap-0.5 rounded-xl border p-3 text-left tap"
      style={{ borderColor: on ? "var(--brand)" : "var(--line)", background: on ? "var(--sunk)" : "var(--card)" }}
    >
      <span className="flex items-center gap-1.5 text-[13.5px] font-semibold">
        {icon}
        {label}
      </span>
      <span className="text-[11.5px] text-[var(--ink-soft)]">{detail}</span>
    </button>
  );
}
