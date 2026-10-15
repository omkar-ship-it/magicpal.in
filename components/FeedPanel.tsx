"use client";

import { useState } from "react";
import type { FeedItem } from "@/lib/feed";
import type { PinRef } from "@/lib/pins";
import type { EventRef } from "@/lib/shell";
import PostComposer from "./PostComposer";
import PostCard from "./PostCard";
import { IconBeacon, IconCalendar } from "./Icons";
import { sinceLabel, whenLabel } from "@/lib/time";
import Avatar from "./Avatar";
import PanelNote from "./PanelNote";

/**
 * What's happening in this network, and what people are saying about it.
 *
 * Two kinds of line share this surface and used to render identically,
 * which made a community that was talking look exactly like one that
 * wasn't. Now a post is a card and an arrival is a quiet one-liner, so the
 * shape of the feed answers "is anything going on here" before you read it.
 *
 * The strip at the top is the thing no other group chat can show: who is
 * out there *right now* and what is on this week. A feed of things that
 * already happened is a log; putting the live stuff above it is what makes
 * this worth opening rather than scrolling.
 */
export default function FeedPanel({
  items,
  loading,
  signedIn,
  scopeName,
  scopeSlug,
  events,
  pins,
  canPost,
  onOpenPerson,
  onOpenPins,
  onOpenEvents,
  onChanged,
  onSignIn,
}: {
  items: FeedItem[];
  loading: boolean;
  signedIn: boolean;
  scopeName: string;
  /** Null on the open network, which nobody owns and nobody posts to. */
  scopeSlug: string | null;
  events: EventRef[];
  pins: PinRef[];
  canPost: boolean;
  onOpenPerson: (id: string) => void;
  onOpenPins: () => void;
  onOpenEvents: () => void;
  onChanged: () => void;
  onSignIn: () => void;
}) {
  // Pinned above the early returns: hooks must run in the same order every
  // render, and Date.now() during render is impure — it also stops the
  // "right now" strip reshuffling while somebody is reading it.
  const [now] = useState(() => Date.now());

  if (loading) return <PanelNote title="Catching up…" />;

  if (!signedIn) {
    return (
      <PanelNote title="Sign in to see what's happening">
        The feed follows the networks you&rsquo;re part of.
        <button type="button" className="btn btn-primary btn-sm mt-3" onClick={onSignIn}>
          Sign in
        </button>
      </PanelNote>
    );
  }

  const soon = events
    .filter((e) => e.startsAt && (e.live || new Date(e.startsAt).getTime() > now))
    .sort((a, b) => (a.startsAt ?? "").localeCompare(b.startsAt ?? ""))
    .slice(0, 2);

  const live = (
    <LiveStrip pins={pins} events={soon} onOpenPins={onOpenPins} onOpenEvents={onOpenEvents} />
  );

  const composer =
    canPost && scopeSlug ? (
      <PostComposer boardSlug={scopeSlug} boardName={scopeName} events={events} onPosted={onChanged} />
    ) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto">
      {live}
      {composer}

      {items.length === 0 ? (
        <PanelNote title={`Nothing's been said in ${scopeName} yet`}>
          {canPost && scopeSlug
            ? "Be the first — a question people can answer gets further than an introduction. Arrivals and new events show up here too; nothing is invented to make it look busy."
            : "Arrivals, new events and what people post show up here. It fills as the network does."}
        </PanelNote>
      ) : (
        <ul className="stagger flex flex-col gap-2.5">
          {items.map((item) =>
            item.kind === "post" ? (
              <li key={item.id}>
                <PostCard item={item} signedIn={signedIn} onOpenPerson={onOpenPerson} onChanged={onChanged} />
              </li>
            ) : (
              <li key={item.id}>
                <Happening item={item} onOpenPerson={onOpenPerson} />
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}

/**
 * Live now, above everything that already happened.
 *
 * Only renders when there is something real to say — an empty strip
 * promising activity would be exactly the invented motion the rest of this
 * feed refuses.
 */
function LiveStrip({
  pins,
  events,
  onOpenPins,
  onOpenEvents,
}: {
  pins: PinRef[];
  events: EventRef[];
  onOpenPins: () => void;
  onOpenEvents: () => void;
}) {
  if (pins.length === 0 && events.length === 0) return null;

  return (
    <div className="rounded-xl p-2.5" style={{ background: "var(--sunk)" }}>
      <p className="label label-icon mb-1.5">
        <IconBeacon size={11} /> Right now
      </p>
      <div className="flex flex-col gap-1.5">
        {pins.slice(0, 2).map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={onOpenPins}
            className="flex w-full items-center gap-2 rounded-lg p-1 text-left tap hover:bg-[var(--card)]"
          >
            <Avatar name={p.person.name} photoUrl={p.person.photoUrl} size={26} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-semibold">
                {p.mine ? "You" : p.person.name} · {p.placeLabel ?? "nearby"}
              </span>
              <span className="block truncate text-[11.5px] text-[var(--ink-soft)]">{p.message}</span>
            </span>
            <span className="flex-none text-[11px] font-semibold" style={{ color: "var(--good)" }}>
              {p.minutesLeft > 60 ? `${Math.round(p.minutesLeft / 60)}h` : `${p.minutesLeft}m`}
            </span>
          </button>
        ))}

        {events.map((e) => (
          <button
            key={e.slug}
            type="button"
            onClick={onOpenEvents}
            className="flex w-full items-center gap-2 rounded-lg p-1 text-left tap hover:bg-[var(--card)]"
          >
            <span
              className="grid h-[26px] w-[26px] flex-none place-items-center rounded-lg"
              style={{ background: "var(--card)", color: "var(--layer-event)" }}
            >
              <IconCalendar size={12} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-semibold">{e.name}</span>
              <span className="block truncate text-[11.5px] text-[var(--ink-soft)]">
                {e.startsAt ? whenLabel(e.startsAt) : ""}
                {e.going > 0 ? ` · ${e.going} going` : ""}
              </span>
            </span>
            {e.live && (
              <span
                className="pill flex-none"
                style={{ background: "color-mix(in srgb, var(--good) 14%, transparent)", color: "var(--good)" }}
              >
                Live
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

/** A derived line — somebody joined, somebody started something. Quiet. */
function Happening({ item, onOpenPerson }: { item: FeedItem; onOpenPerson: (id: string) => void }) {
  return (
    <div className="flex items-center gap-2.5 px-1 py-0.5">
      {item.person ? (
        <button type="button" onClick={() => onOpenPerson(item.person!.id)} className="flex-none tap">
          <Avatar name={item.person.name} photoUrl={item.person.photoUrl} size={26} />
        </button>
      ) : (
        <span className="h-[26px] w-[26px] flex-none rounded-full" style={{ background: "var(--sunk)" }} />
      )}
      <p className="min-w-0 flex-1 truncate text-[12px] text-[var(--ink-soft)]">
        <button
          type="button"
          className="font-semibold text-[var(--ink)] hover:underline"
          onClick={() => item.person && onOpenPerson(item.person.id)}
        >
          {item.person?.name ?? "Someone"}
        </button>{" "}
        {item.line}
      </p>
      <span className="flex-none text-[11px] text-[var(--ink-soft)]">{sinceLabel(item.at)}</span>
    </div>
  );
}
