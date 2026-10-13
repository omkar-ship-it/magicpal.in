"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconPeople } from "./Icons";

/**
 * Create a community — the only kind of network there is.
 *
 * This used to offer a choice between an event and a community, which gave
 * a host two things to create when they only ever meant one. An event is
 * something that happens *inside* a community (see CreateEvent): the
 * community is the audience you keep, the event is the evening. A one-off
 * meetup host makes "Hyderabad Product Meetups" once and hangs every
 * evening off it, instead of starting from an empty room each time.
 */
export default function CreateBoard({
  onCreated,
}: {
  /**
   * Handed the new slug so the caller can stay put. Without it this
   * navigates, which is right for a standalone page and wrong inside the
   * profile window — the map is supposed to stay behind everything.
   */
  onCreated?: (slug: string) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [blurb, setBlurb] = useState("");
  const [placeText, setPlaceText] = useState("");
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
        body: JSON.stringify({ type: "community", name, blurb, place: placeText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't create that.");
      if (onCreated) {
        onCreated(data.slug);
        setBusy(false);
        setName("");
        setBlurb("");
        setPlaceText("");
        return;
      }
      router.push(`/?net=${data.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-3 p-4">
      <p className="flex items-center gap-1.5 text-[13.5px] font-semibold">
        <IconPeople size={14} /> New community
      </p>

      <div>
        <label className="label" htmlFor="board-name">
          Name
        </label>
        <input
          id="board-name"
          className="input"
          required
          placeholder="RGUKT Alumni, or Hyderabad Product Meetups"
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
          placeholder="Where our batch actually keeps in touch"
          value={blurb}
          onChange={(e) => setBlurb(e.target.value)}
        />
      </div>

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

      {error && <p className="text-[12.5px] font-medium text-[var(--warn)]">{error}</p>}

      <button type="submit" disabled={busy} className="btn btn-primary btn-sm">
        {busy ? "Creating…" : "Create and get the QR code"}
      </button>
    </form>
  );
}
