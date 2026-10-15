"use client";

import { useEffect, useState } from "react";
import type { EventRef } from "@/lib/shell";
import { whenLabel } from "@/lib/time";
import Avatar from "./Avatar";
import BoardQR from "./BoardQR";
import VerifiedBadge from "./VerifiedBadge";
import EventDiscussion from "./EventDiscussion";
import { IconBeacon, IconCalendar, IconCheck, IconClock, IconPeople, IconPin, IconSparkle } from "./Icons";

/**
 * One event, in full.
 *
 * The page answers three questions, in the order somebody actually asks
 * them. *Should I go* — what is it, when, where, who else is coming, who's
 * running it. *How do I get there* — the venue, the address, the pin on the
 * map behind this panel. *Who is here* — once it's running, the roster turns
 * into the thing that made you come: the faces actually in the room.
 *
 * Simple events stay simple. Every block below renders only if the host
 * filled it in, so a drop-in with a title and a time is four lines, and a
 * conference session with an agenda, a venue, a cap and a ticket link is a
 * full page. The host decides how much of it exists, not the layout.
 */
export default function EventPage({
  event,
  sharing,
  onShare,
  onShow,
  onEdit,
  onOpenPerson,
  onChanged,
}: {
  event: EventRef;
  sharing: boolean;
  onShare: () => void;
  onShow: () => void;
  onEdit: () => void;
  onOpenPerson: (id: string) => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState(event.myRsvp);
  const [error, setError] = useState("");
  const [extra, setExtra] = useState<{
    host: { id: string; name: string; headline: string | null; photoUrl: string | null } | null;
    parent: { slug: string; name: string } | null;
    attendees: Array<{
      id: string;
      name: string;
      headline: string | null;
      photoUrl: string | null;
      hereNow: boolean;
      verified: boolean;
      isHost: boolean;
    }>;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/boards/${event.slug}`)
      .then((r) => r.json())
      .then((d) => {
        if (alive && d.attendees) setExtra(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [event.slug]);

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

  const full = event.capacity != null && event.going >= event.capacity;
  const onMap = event.lat != null && event.lng != null;
  const hereNow = extra?.attendees.filter((a) => a.hereNow).length ?? 0;

  return (
    <div className="flex flex-col gap-4">
      {/* ------------------------------------------------------ the what */}
      <div>
        <div className="flex flex-wrap items-center gap-1.5">
          {event.live ? (
            <span
              className="pill"
              style={{ background: "color-mix(in srgb, var(--good) 14%, transparent)", color: "var(--good)" }}
            >
              <IconBeacon size={10} /> Happening now
            </span>
          ) : (
            <span className="pill" style={{ background: "var(--sunk)", color: "var(--layer-event)" }}>
              <IconCalendar size={10} /> Event
            </span>
          )}
          {extra?.parent && (
            <span className="pill" style={{ background: "var(--sunk)", color: "var(--ink-soft)" }}>
              <IconPeople size={10} /> {extra.parent.name}
            </span>
          )}
        </div>
        <h2 className="mt-1.5 text-[18px] font-semibold leading-tight">{event.name}</h2>
        {event.blurb && <p className="mt-1 text-[13px] leading-[1.5]">{event.blurb}</p>}
      </div>

      {/* ------------------------------------------------- when and where */}
      <div className="flex flex-col gap-2 rounded-xl p-3" style={{ background: "var(--sunk)" }}>
        {event.startsAt && (
          <Row icon={<IconClock size={13} />} label={whenLabel(event.startsAt)}>
            {event.endsAt && (
              <span className="text-[11.5px] text-[var(--ink-soft)]">
                until {new Date(event.endsAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
              </span>
            )}
          </Row>
        )}
        <Row icon={<IconPin size={13} />} label={event.place ?? "Venue to be announced"}>
          {event.address && <span className="text-[11.5px] text-[var(--ink-soft)]">{event.address}</span>}
          {!onMap && (
            <span className="text-[11.5px] font-semibold" style={{ color: "var(--warn)" }}>
              Not on the map{event.isHost ? " — add a venue so people can find it" : ""}
            </span>
          )}
        </Row>
        {onMap && (
          <button
            type="button"
            className="btn btn-ghost btn-sm self-start"
            onClick={onShow}
          >
            <IconPin size={12} /> Show it on the map
          </button>
        )}
      </div>

      {/* ------------------------------------------------------- the ask */}
      <div>
        <p className="label">Are you coming?</p>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["going", "I'm going"],
              ["maybe", "Maybe"],
              ["no", "Can't make it"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className="chip-toggle tap"
              data-on={mine === id ? "true" : "false"}
              aria-pressed={mine === id}
              disabled={busy || (full && id === "going" && mine !== "going")}
              onClick={() => answer(id)}
            >
              {mine === id && <IconCheck size={11} />}
              {label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[12px] text-[var(--ink-soft)]">
          {event.going} going
          {event.capacity != null ? ` of ${event.capacity}` : ""}
          {full && mine !== "going" ? " · full" : ""}
          {hereNow > 0 ? ` · ${hereNow} here now` : ""}
        </p>
        {error && <p className="mt-1.5 text-[12px] font-medium text-[var(--warn)]">{error}</p>}
      </div>

      {/* --------------------------------------------------------- host */}
      {extra?.host && (
        <div>
          <p className="label">Hosted by</p>
          <button
            type="button"
            onClick={() => onOpenPerson(extra.host!.id)}
            className="flex w-full items-center gap-2.5 rounded-xl p-2 text-left tap hover:bg-[var(--sunk)]"
          >
            <Avatar name={extra.host.name} photoUrl={extra.host.photoUrl} size={40} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold">{extra.host.name}</span>
              {extra.host.headline && (
                <span className="block truncate text-[11.5px] text-[var(--ink-soft)]">{extra.host.headline}</span>
              )}
            </span>
          </button>
        </div>
      )}

      {/* ------------------------------------------------ what to expect */}
      {event.details && (
        <div>
          <p className="label label-icon">
            <IconSparkle size={12} /> What to expect
          </p>
          <p className="whitespace-pre-line text-[12.5px] leading-[1.55]">{event.details}</p>
        </div>
      )}

      {event.url && (
        <a
          href={event.url}
          target="_blank"
          rel="noreferrer noopener"
          className="truncate text-[12.5px] font-semibold"
          style={{ color: "var(--brand)" }}
        >
          Tickets and more →
        </a>
      )}

      {/* ------------------------------------------------------- who else */}
      {extra && extra.attendees.length > 0 && (
        <div>
          <p className="label label-icon">
            <IconPeople size={12} /> Who&rsquo;s coming · {extra.attendees.length}
          </p>
          <ul className="flex flex-col">
            {extra.attendees.slice(0, 12).map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => onOpenPerson(a.id)}
                  className="flex w-full items-center gap-2.5 rounded-xl px-1.5 py-1.5 text-left tap hover:bg-[var(--sunk)]"
                >
                  <Avatar name={a.name} photoUrl={a.photoUrl} size={30} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="min-w-0 truncate text-[12.5px] font-semibold">{a.name}</span>
                      {a.verified && <VerifiedBadge size={12} label="Verified by a community you're both in" />}
                      {a.isHost && (
                        <span className="pill" style={{ background: "var(--sunk)", color: "var(--ink-soft)" }}>
                          Host
                        </span>
                      )}
                    </span>
                    {a.headline && (
                      <span className="block truncate text-[11px] text-[var(--ink-soft)]">{a.headline}</span>
                    )}
                  </span>
                  {a.hereNow && (
                    <span
                      className="pill flex-none"
                      style={{ background: "color-mix(in srgb, var(--good) 14%, transparent)", color: "var(--good)" }}
                    >
                      Here
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {extra.attendees.length > 12 && (
            <p className="mt-1 px-1.5 text-[11.5px] text-[var(--ink-soft)]">
              and {extra.attendees.length - 12} more
            </p>
          )}
        </div>
      )}

      {/* ----------------------------------------------------- discussion */}
      <EventDiscussion slug={event.slug} onOpenPerson={onOpenPerson} />

      {/* -------------------------------------------------------- share */}
      <div>
        <p className="label">Invite someone</p>
        {sharing ? (
          <BoardQR slug={event.slug} name={event.name} />
        ) : (
          <button type="button" className="btn btn-ghost btn-sm w-full" onClick={onShare}>
            <IconPeople size={13} /> Show the QR code and link
          </button>
        )}
      </div>

      {event.isHost && (
        <button type="button" className="btn btn-ghost btn-sm w-full" onClick={onEdit}>
          Edit this event
        </button>
      )}
    </div>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 flex-none text-[var(--ink-soft)]">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-semibold leading-[1.4]">{label}</p>
        {children && <div className="mt-0.5 flex flex-col">{children}</div>}
      </div>
    </div>
  );
}
