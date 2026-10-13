"use client";

import { useState } from "react";
import type { EventRef } from "@/lib/shell";
import PlaceSearch, { type Place } from "./PlaceSearch";
import { resolveTypedPlace } from "@/lib/resolvePlace";
import { IconPin } from "./Icons";

/** datetime-local wants "YYYY-MM-DDTHH:mm" in *local* time, not an ISO instant. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Change an event after it exists.
 *
 * The reason this had to be built: an event created without a venue has no
 * coordinates, so it draws nothing on the map and there was no way back —
 * the create form was the only chance anyone got. Rooms move, times shift,
 * agendas firm up, and a board you can't correct is one hosts stop
 * trusting.
 */
export default function EditEvent({
  event,
  onSaved,
  onCancel,
}: {
  event: EventRef;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(event.name);
  const [blurb, setBlurb] = useState(event.blurb ?? "");
  const [details, setDetails] = useState(event.details ?? "");
  const [startsAt, setStartsAt] = useState(toLocalInput(event.startsAt));
  const [endsAt, setEndsAt] = useState(toLocalInput(event.endsAt));
  const [place, setPlace] = useState<Place | null>(
    event.place && event.lat != null && event.lng != null
      ? { label: event.place, lat: event.lat, lng: event.lng }
      : null
  );
  const [address, setAddress] = useState(event.address ?? "");
  const [capacity, setCapacity] = useState(event.capacity != null ? String(event.capacity) : "");
  const [url, setUrl] = useState(event.url ?? "");
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
      const res = await fetch(`/api/boards/${event.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          blurb,
          details,
          address,
          url,
          capacity: capacity ? Number(capacity) : null,
          place: pin?.label ?? event.place ?? "",
          lat: pin?.lat,
          lng: pin?.lng,
          startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
          endsAt: endsAt ? new Date(endsAt).toISOString() : "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save that.");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const hasPin = place != null || (event.lat != null && event.lng != null);

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="text-[13.5px] font-semibold">Edit event</p>

      <div>
        <label className="label" htmlFor="ed-name">
          Name
        </label>
        <input id="ed-name" className="input" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div>
        <label className="label" htmlFor="ed-blurb">
          One line about it
        </label>
        <input id="ed-blurb" className="input" value={blurb} onChange={(e) => setBlurb(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label" htmlFor="ed-start">
            Starts
          </label>
          <input
            id="ed-start"
            type="datetime-local"
            className="input"
            required
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="ed-end">
            Ends
          </label>
          <input
            id="ed-end"
            type="datetime-local"
            className="input"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="ed-venue">
          Venue
        </label>
        <PlaceSearch
          id="ed-venue"
          value={place?.label ?? event.place ?? null}
          placeholder="T-Hub, Hyderabad"
          onPick={(pl) => {
            setPlace(pl);
            setTypedVenue("");
          }}
          onTyped={setTypedVenue}
        />
        {/* Said plainly, because an event with no pin simply isn't on the
            map and the host has no other way to find that out. */}
        <p
          className="mt-1.5 flex items-start gap-1.5 text-[12px] leading-[1.45]"
          style={{ color: hasPin ? "var(--ink-soft)" : "var(--warn)" }}
        >
          <IconPin size={12} className="mt-0.5 flex-none" />
          {hasPin
            ? "Pinned on the map so people can find the room."
            : "No venue picked yet — until you choose one from the list, this event isn't on the map."}
        </p>
      </div>

      <div>
        <label className="label" htmlFor="ed-address">
          Floor, door, how to get in
        </label>
        <input id="ed-address" className="input" value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>

      <div>
        <label className="label" htmlFor="ed-details">
          Details
        </label>
        <textarea
          id="ed-details"
          className="input"
          rows={3}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label" htmlFor="ed-cap">
            Capacity
          </label>
          <input
            id="ed-cap"
            type="number"
            min={1}
            className="input"
            placeholder="No limit"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="ed-url">
            Tickets or more info
          </label>
          <input id="ed-url" className="input" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
      </div>

      {error && <p className="text-[12.5px] font-medium text-[var(--warn)]">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="btn btn-primary btn-sm">
          {busy ? "Saving…" : "Save changes"}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
