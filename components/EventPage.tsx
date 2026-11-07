"use client";

import { useEffect, useState } from "react";
import type { EventRef } from "@/lib/shell";
import { whenLabel } from "@/lib/time";
import { CHECKIN_OPENS_MINUTES, checkInState } from "@/lib/rules";
import Avatar from "./Avatar";
import BoardQR from "./BoardQR";
import VerifiedBadge from "./VerifiedBadge";
import EventDiscussion from "./EventDiscussion";
import DeleteEvent from "./DeleteEvent";
import EventMatches from "./EventMatches";
import { Fact, Facts, Hero, Page, Row, Section } from "./Panel";
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
  locked = false,
  signedIn,
  onboarded,
  hasSignals,
  onShare,
  onShow,
  onOpen,
  onEdit,
  onOpenPerson,
  onProfile,
  onSignIn,
  onDeleted,
  onChanged,
}: {
  event: EventRef;
  sharing: boolean;
  /**
   * The reader has stated nothing, so the room stays shut.
   *
   * The event itself — when, where, are you coming, check-in — is all
   * still theirs: that is the thing they scanned a code for. What is
   * withheld is everybody else, here as everywhere. See lib/shell
   * `anonymise`.
   */
  locked?: boolean;
  signedIn: boolean;
  onboarded: boolean;
  /** False when the viewer has stated no needs, offers or interests. */
  hasSignals: boolean;
  onShare: () => void;
  onShow: () => void;
  /**
   * Point the whole app at this event, rather than merely describing it.
   *
   * Absent when the event *is* the current scope — there is nowhere to
   * go — and absent for a child event, whose slug resolves to its parent
   * community and so has no board of its own to open.
   */
  onOpen?: () => void;
  onEdit: () => void;
  onOpenPerson: (id: string) => void;
  onProfile: () => void;
  onSignIn: () => void;
  /** Host deleted it — the panel has nothing left to show. */
  onDeleted: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState(event.myRsvp);
  /**
   * A clock, read once a minute.
   *
   * The check-in window opens on time, not on a reload — somebody with
   * the page already open at ten to seven should watch the button
   * become live rather than wonder why it is still greyed.
   */
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const [error, setError] = useState("");
  const [here, setHere] = useState(false);
  const [checkInBusy, setCheckInBusy] = useState(false);
  const [checkInError, setCheckInError] = useState("");
  const [extra, setExtra] = useState<{
    youAreHere?: boolean;
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
        if (!alive || !d.attendees) return;
        setExtra(d);
        setHere(Boolean(d.youAreHere));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [event.slug]);

  /**
   * "I'm here", and the reason it is its own act.
   *
   * Not an RSVP — that is a promise made last week — and not the location
   * setting, which is about a map rather than a room. The matcher weights
   * presence above any single shared interest, so this is the single most
   * valuable thing an attendee can tell it, and the only honest way to
   * know it is to be asked in the building.
   */
  async function setPresence(next: boolean) {
    setCheckInBusy(true);
    setCheckInError("");
    const previous = here;
    setHere(next);
    try {
      const res = await fetch(`/api/boards/${event.slug}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ here: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save that.");
      onChanged();
      const d = await fetch(`/api/boards/${event.slug}`).then((r) => r.json()).catch(() => null);
      if (d?.attendees) setExtra(d);
    } catch (err) {
      setHere(previous);
      setCheckInError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setCheckInBusy(false);
    }
  }

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
  /**
   * Whether the room exists yet.
   *
   * Computed on every render rather than held in state: it changes with
   * the clock and not with anything the reader does, and a stale "opens
   * in 15 minutes" on a page somebody left open is exactly the moment
   * this control matters most.
   */
  const checkIn = checkInState(
    { type: "event", startsAt: event.startsAt, endsAt: event.endsAt },
    nowTick
  );
  // The counts live on the section heading rather than under the chips, so
  // the answer and the tally aren't two separate things to read.
  const rsvpLine = locked
    ? ""
    : `${event.going} going${event.capacity != null ? ` of ${event.capacity}` : ""}${
        full && mine !== "going" ? " · full" : ""
      }`;

  return (
    <Page>
      <Hero
        eyebrow={
          <>
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
          </>
        }
        title={event.name}
        subtitle={event.blurb}
        action={
          event.isHost ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onEdit}>
              Edit
            </button>
          ) : null
        }
      />

      {/* ------------------------------------------------- when and where */}
      <div className="reveal">
        <Facts>
          {event.startsAt && (
            <Fact icon={<IconClock size={13} />} label={whenLabel(event.startsAt)}>
              {event.endsAt && (
                <span className="text-[11.5px] text-[var(--ink-soft)]">
                  until{" "}
                  {new Date(event.endsAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                </span>
              )}
            </Fact>
          )}
          <Fact icon={<IconPin size={13} />} label={event.place ?? "Venue to be announced"}>
            {event.address && <span className="text-[11.5px] text-[var(--ink-soft)]">{event.address}</span>}
            {!onMap && (
              <span className="text-[11.5px] font-semibold" style={{ color: "var(--warn)" }}>
                Not on the map{event.isHost ? " — add a venue so people can find it" : ""}
              </span>
            )}
          </Fact>
          {onMap && (
            <button type="button" className="btn btn-ghost btn-sm self-start" onClick={onShow}>
              <IconPin size={12} /> Show it on the map
            </button>
          )}
          {/* The way in, from a listing to the room itself.
              Reading an event on the open map tells you what it is; opening
              it points the whole app at it — the matcher starts asking
              "who here is worth meeting" instead of "who in this city". */}
          {onOpen && (
            <button type="button" className="btn btn-primary btn-sm self-start" onClick={onOpen}>
              <IconPeople size={12} /> {event.joined ? "Open the event" : "Join and open"}
            </button>
          )}
        </Facts>
      </div>

      {/* --------------------------------------------------------- the ask */}
      <Section title="Are you coming?" icon={<IconCheck size={12} />} aside={rsvpLine}>
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
        {error && <p className="mt-1.5 text-[12px] font-medium text-[var(--warn)]">{error}</p>}
      </Section>

      {/* Directly under the ask, and deliberately not inside any "is it
          live" branch: the run that matters most is the one before the
          event, when there is still time to plan who to find. */}
      <EventMatches
        slug={event.slug}
        signedIn={signedIn}
        onboarded={onboarded}
        hasSignals={hasSignals}
        onOpenPerson={onOpenPerson}
        onProfile={onProfile}
        onSignIn={onSignIn}
      />

      {extra?.host && (
        <Section title="Hosted by" icon={<IconSparkle size={12} />}>
          <Row onClick={() => onOpenPerson(extra.host!.id)}>
            <Avatar name={extra.host.name} photoUrl={extra.host.photoUrl} size={40} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold">{extra.host.name}</span>
              {extra.host.headline && (
                <span className="block truncate text-[11.5px] text-[var(--ink-soft)]">{extra.host.headline}</span>
              )}
            </span>
          </Row>
        </Section>
      )}

      {event.details && (
        <Section title="What to expect" icon={<IconSparkle size={12} />}>
          <p className="whitespace-pre-line text-[12.5px] leading-[1.55]">{event.details}</p>
        </Section>
      )}

      {event.url && (
        <a
          href={event.url}
          target="_blank"
          rel="noreferrer noopener"
          className="reveal truncate text-[12.5px] font-semibold"
          style={{ color: "var(--brand)" }}
        >
          Tickets and more →
        </a>
      )}

      {/* ── being in the room ──
          Above the roster, because somebody holding a phone in a venue is
          answering "I'm here" before they are browsing anybody. Absent
          entirely for a visitor who has not joined: there is nothing to
          be present at yet. */}
      {signedIn && checkIn && mine !== "no" && (
        <Section title="In the room" icon={<IconBeacon size={12} />}>
          {checkIn === "early" ? (
            <p className="text-[12.5px] leading-[1.5] text-[var(--ink-soft)]">
              Check in opens {CHECKIN_OPENS_MINUTES} minutes before the start. Saying you&rsquo;re here is
              what puts you in front of the people who are also here — it counts for more than anything
              else on your profile, so it only counts while it&rsquo;s true.
            </p>
          ) : checkIn === "over" ? (
            <p className="text-[12.5px] text-[var(--ink-soft)]">This one&rsquo;s over.</p>
          ) : here ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="flex-1 text-[12.5px] leading-[1.45]">
                <span className="font-semibold" style={{ color: "var(--good)" }}>
                  You&rsquo;re checked in.
                </span>{" "}
                {hereNow > 1 ? `${hereNow - 1} others are here too.` : "First one in."}
              </p>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={checkInBusy}
                onClick={() => void setPresence(false)}
              >
                I&rsquo;ve left
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                className="btn btn-primary btn-sm self-start"
                disabled={checkInBusy}
                onClick={() => void setPresence(true)}
              >
                {checkInBusy ? "One moment…" : "I'm here"}
              </button>
              <p className="text-[11.5px] leading-[1.45] text-[var(--ink-soft)]">
                {hereNow > 0 ? `${hereNow} already in the room. ` : ""}
                Being here is the strongest thing the matcher knows about you.
              </p>
            </div>
          )}
          {checkInError && (
            <p className="mt-1.5 text-[11.5px] font-medium" style={{ color: "var(--warn)" }}>
              {checkInError}
            </p>
          )}
        </Section>
      )}

      {!locked && extra && extra.attendees.length > 0 && (
        <Section
          title="Who's coming"
          icon={<IconPeople size={12} />}
          aside={`${extra.attendees.length}${hereNow > 0 ? ` · ${hereNow} here` : ""}`}
        >
          <ul className="stagger flex flex-col">
            {extra.attendees.slice(0, 12).map((a) => (
              <li key={a.id}>
                <Row onClick={() => onOpenPerson(a.id)}>
                  <Avatar name={a.name} photoUrl={a.photoUrl} size={32} />
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
                </Row>
              </li>
            ))}
          </ul>
          {extra.attendees.length > 12 && (
            <p className="mt-1 px-1.5 text-[11.5px] text-[var(--ink-soft)]">
              and {extra.attendees.length - 12} more
            </p>
          )}
        </Section>
      )}

      <div className="reveal">
        <EventDiscussion slug={event.slug} onOpenPerson={onOpenPerson} />
      </div>

      <Section title="Invite someone" icon={<IconPeople size={12} />}>
        {sharing ? (
          <BoardQR slug={event.slug} name={event.name} />
        ) : (
          <button type="button" className="btn btn-ghost btn-sm w-full" onClick={onShare}>
            Show the QR code and link
          </button>
        )}
      </Section>

      {event.isHost && (
        <DeleteEvent slug={event.slug} name={event.name} going={event.going} onDeleted={onDeleted} />
      )}
    </Page>
  );
}
