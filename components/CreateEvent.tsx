"use client";

import { useState } from "react";
import PlaceSearch, { type Place } from "./PlaceSearch";
import { resolveTypedPlace } from "@/lib/resolvePlace";
import { IconCalendar, IconPeople } from "./Icons";

/**
 * Everything an event actually needs, in one form that stays on the map.
 *
 * This used to be a link to /boards/new, which had become a redirect that
 * dropped its `?in=` parameter — so "New event in RGUKT Alumni" landed on
 * the profile with no form and no community. Creating something is a thing
 * you do *inside* the network you're looking at, so it happens here.
 *
 * The optional fields are genuinely optional and ordered by how often
 * they're filled: a meetup needs a name, a time and a room; a conference
 * also needs an agenda, a cap and a ticket link.
 */
export default function CreateEvent({
  parentSlug,
  parentName,
  onCreated,
  onCancel,
}: {
  /** Set when creating inside a community — only its members will see it. */
  parentSlug?: string | null;
  parentName?: string | null;
  onCreated: (slug: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [blurb, setBlurb] = useState("");
  const [details, setDetails] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [place, setPlace] = useState<Place | null>(null);
  const [address, setAddress] = useState("");
  const [capacity, setCapacity] = useState("");
  const [url, setUrl] = useState("");
  const [typedVenue, setTypedVenue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      // Rescue a venue that was typed but never picked from the list —
      // otherwise the form looks filled in and the event silently has no
      // coordinates, which is the single most common way one ends up
      // missing from the map.
      let pin = place;
      if (!pin && typedVenue.trim()) {
        pin = await resolveTypedPlace(typedVenue);
        if (!pin) {
          setError(`Couldn't find "${typedVenue.trim()}" — pick a venue from the list.`);
          setBusy(false);
          return;
        }
        setPlace(pin);
      }
      const res = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "event",
          name,
          blurb,
          details,
          address,
          url,
          capacity: capacity ? Number(capacity) : undefined,
          place: pin?.label ?? "",
          lat: pin?.lat,
          lng: pin?.lng,
          // datetime-local gives wall-clock text with no zone. Parsing it as
          // local time is what the host meant — they typed the time that
          // will be on the invitation, not a UTC instant.
          startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
          endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
          parentSlug: parentSlug ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't create that.");
      onCreated(data.slug);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="flex items-center gap-1.5 text-[13.5px] font-semibold">
        <IconCalendar size={14} />
        {parentName ? `New event in ${parentName}` : "New event"}
      </p>
      {parentName && (
        <p className="-mt-2 text-[12px] leading-[1.45] text-[var(--ink-soft)]">
          Only members of {parentName} will see it.
        </p>
      )}

      <div>
        <label className="label" htmlFor="ev-name">
          Name
        </label>
        <input
          id="ev-name"
          className="input"
          required
          autoFocus
          placeholder="Hyderabad Product Meetup #12"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="ev-blurb">
          One line about it
        </label>
        <input
          id="ev-blurb"
          className="input"
          placeholder="Two talks, then an hour of actual mingling"
          value={blurb}
          onChange={(e) => setBlurb(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label" htmlFor="ev-start">
            Starts
          </label>
          <input
            id="ev-start"
            type="datetime-local"
            className="input"
            required
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="ev-end">
            Ends
          </label>
          <input
            id="ev-end"
            type="datetime-local"
            className="input"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="ev-venue">
          Venue
        </label>
        <PlaceSearch
          id="ev-venue"
          value={place?.label ?? null}
          placeholder="T-Hub, Hyderabad"
          onPick={(pl) => {
            setPlace(pl);
            setTypedVenue("");
          }}
          onTyped={setTypedVenue}
        />
        <p className="mt-1.5 text-[12px] leading-[1.45] text-[var(--ink-soft)]">
          Puts the event on the map so people can find the room.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="ev-address">
          Floor, door, how to get in
        </label>
        <input
          id="ev-address"
          className="input"
          placeholder="3rd floor, use the rear entrance after 7pm"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="ev-details">
          Details
        </label>
        <textarea
          id="ev-details"
          className="input"
          rows={3}
          placeholder="Agenda, who it's for, what to bring"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label" htmlFor="ev-cap">
            Capacity
          </label>
          <input
            id="ev-cap"
            type="number"
            min={1}
            className="input"
            placeholder="No limit"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="ev-url">
            Tickets or more info
          </label>
          <input
            id="ev-url"
            className="input"
            placeholder="lu.ma/your-event"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
      </div>

      {error && <p className="text-[12.5px] font-medium text-[var(--warn)]">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="btn btn-primary btn-sm">
          <IconPeople size={13} /> {busy ? "Creating…" : "Create and get the QR"}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
