"use client";

import { useState } from "react";
import type { EventRef } from "@/lib/shell";
import { whenLabel } from "@/lib/time";
import PanelNote from "./PanelNote";
import BoardQR from "./BoardQR";
import CreateEvent from "./CreateEvent";
import { IconBeacon, IconCalendar, IconCheck, IconChevronLeft, IconClock, IconPeople, IconPin, IconPlus, IconX } from "./Icons";

/**
 * Events on this network, and everything you need to decide about one.
 *
 * On the open network these are public events anyone can join; inside a
 * community they're that community's own, which never surface publicly.
 * Live ones sort first — during the hours either side of a start time,
 * "is it happening now" is the only question anybody has.
 */
export default function EventsPanel({
  events,
  scopeName,
  scopeSlug,
  canCreate,
  onShow,
  onChanged,
}: {
  events: EventRef[];
  scopeName: string;
  scopeSlug: string | null;
  canCreate: boolean;
  /** Centre the map on it rather than navigating away from the map. */
  onShow: (e: EventRef) => void;
  onChanged: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [sharing, setSharing] = useState<string | null>(null);

  const sorted = [...events].sort((a, b) => {
    if (a.live !== b.live) return a.live ? -1 : 1;
    return (a.startsAt ?? "").localeCompare(b.startsAt ?? "");
  });
  const open = sorted.find((e) => e.slug === openSlug) ?? null;

  if (creating) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <CreateEvent
          parentSlug={scopeSlug}
          parentName={scopeSlug ? scopeName : null}
          onCancel={() => setCreating(false)}
          onCreated={(slug) => {
            setCreating(false);
            setSharing(slug);
            setOpenSlug(slug);
            onChanged();
          }}
        />
      </div>
    );
  }

  if (open) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <button type="button" className="btn btn-ghost btn-sm mb-2" onClick={() => setOpenSlug(null)}>
          <IconChevronLeft size={13} /> All events
        </button>
        <EventDetail
          event={open}
          sharing={sharing === open.slug}
          onShare={() => setSharing(sharing === open.slug ? null : open.slug)}
          onShow={() => onShow(open)}
          onChanged={onChanged}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto">
      {sorted.length === 0 ? (
        <PanelNote title={`No events on ${scopeName} yet`}>
          {canCreate
            ? "Create one and you'll get a QR code to share — people who scan it land straight on it."
            : "Public events show up here. Members of a community see that community's events instead."}
        </PanelNote>
      ) : (
        <ul className="stagger flex flex-col gap-2">
          {sorted.map((e) => (
            <li key={e.slug}>
              <button
                type="button"
                onClick={() => setOpenSlug(e.slug)}
                className="card flex w-full items-start gap-3 p-3 text-left tap"
              >
                <span
                  className="grid h-9 w-9 flex-none place-items-center rounded-xl"
                  style={{ background: "var(--sunk)", color: "var(--layer-event)" }}
                >
                  <IconCalendar size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="min-w-0 truncate text-[13.5px] font-semibold">{e.name}</span>
                    {e.live && (
                      <span
                        className="pill"
                        style={{ background: "color-mix(in srgb, var(--good) 14%, transparent)", color: "var(--good)" }}
                      >
                        <IconBeacon size={10} /> Live
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-[11.5px] text-[var(--ink-soft)]">
                    {e.place ? `${e.place} · ` : ""}
                    {e.startsAt ? whenLabel(e.startsAt) : ""}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--ink-soft)]">
                    <span>{e.going} going</span>
                    {e.myRsvp === "going" && (
                      <span className="pill" style={{ background: "var(--brand)", color: "#fff", fontSize: 10 }}>
                        You&rsquo;re in
                      </span>
                    )}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {canCreate && (
        <button type="button" className="btn btn-ghost btn-sm w-full" onClick={() => setCreating(true)}>
          <IconPlus size={13} /> {scopeSlug ? `New event in ${scopeName}` : "Create an event"}
        </button>
      )}
    </div>
  );
}

function EventDetail({
  event,
  sharing,
  onShare,
  onShow,
  onChanged,
}: {
  event: EventRef;
  sharing: boolean;
  onShare: () => void;
  onShow: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState(event.myRsvp);
  const [error, setError] = useState("");
  const full = event.capacity != null && event.going >= event.capacity;

  async function answer(rsvp: "going" | "maybe" | "no") {
    setBusy(true);
    setError("");
    const previous = mine;
    setMine(rsvp);
    try {
      const res = await fetch(`/api/boards/${event.slug}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rsvp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save that.");
      onChanged();
    } catch (err) {
      setMine(previous);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-[15px] font-semibold leading-tight">{event.name}</h3>
        {event.blurb && <p className="mt-1 text-[12.5px] leading-[1.5] text-[var(--ink-soft)]">{event.blurb}</p>}
      </div>

      <div className="flex flex-col gap-1.5 text-[12.5px]">
        {event.startsAt && (
          <p className="flex items-start gap-2">
            <IconClock size={13} className="mt-0.5 flex-none text-[var(--ink-soft)]" />
            <span>
              {whenLabel(event.startsAt)}
              {event.endsAt ? ` — ${whenLabel(event.endsAt)}` : ""}
            </span>
          </p>
        )}
        {event.place && (
          <p className="flex items-start gap-2">
            <IconPin size={13} className="mt-0.5 flex-none text-[var(--ink-soft)]" />
            <span>
              {event.place}
              {event.address && <span className="block text-[var(--ink-soft)]">{event.address}</span>}
            </span>
          </p>
        )}
        <p className="flex items-start gap-2">
          <IconPeople size={13} className="mt-0.5 flex-none text-[var(--ink-soft)]" />
          <span>
            {event.going} going
            {event.capacity != null ? ` of ${event.capacity}` : ""}
            {full && <span style={{ color: "var(--warn)" }}> · full</span>}
          </span>
        </p>
      </div>

      {event.details && (
        <p className="whitespace-pre-line rounded-xl p-2.5 text-[12.5px] leading-[1.55]" style={{ background: "var(--sunk)" }}>
          {event.details}
        </p>
      )}

      {event.url && (
        <a href={event.url} target="_blank" rel="noreferrer noopener" className="text-[12.5px] font-semibold" style={{ color: "var(--brand)" }}>
          Tickets and more info →
        </a>
      )}

      <div>
        <p className="label">Are you going?</p>
        <div className="flex gap-1.5">
          {([
            ["going", "Going"],
            ["maybe", "Maybe"],
            ["no", "Can’t"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className="chip-toggle tap"
              data-on={mine === id ? "true" : "false"}
              aria-pressed={mine === id}
              // A full event still takes a maybe or a no — the cap is on
              // attendance, not on answering the question.
              disabled={busy || (id === "going" && full && mine !== "going")}
              onClick={() => answer(id)}
            >
              {mine === id && <IconCheck size={11} />}
              {label}
            </button>
          ))}
        </div>
        {error && <p className="mt-1.5 text-[12px] font-medium text-[var(--warn)]">{error}</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        {event.lat != null && event.lng != null && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onShow}>
            <IconPin size={12} /> Show on map
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={onShare}>
          {sharing ? <IconX size={12} /> : <IconPlus size={12} />} {sharing ? "Hide code" : "Share"}
        </button>
      </div>

      {sharing && <BoardQR slug={event.slug} name={event.name} />}
    </div>
  );
}
