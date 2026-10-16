"use client";

import { useState } from "react";
import type { EventRef } from "@/lib/shell";
import { whenLabel } from "@/lib/time";
import PanelNote from "./PanelNote";
import DirectoryPanel from "./DirectoryPanel";
import EventPage from "./EventPage";
import CreateEvent from "./CreateEvent";
import EditEvent from "./EditEvent";
import { IconBeacon, IconCalendar, IconChevronLeft, IconPlus } from "./Icons";

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
  openSlug,
  onOpenSlug,
  onShow,
  onOpenPerson,
  onChanged,
}: {
  events: EventRef[];
  scopeName: string;
  scopeSlug: string | null;
  canCreate: boolean;
  /** Controlled by the shell so a map click and this list agree. */
  openSlug: string | null;
  onOpenSlug: (slug: string | null) => void;
  /** Centre the map on it rather than navigating away from the map. */
  onShow: (e: EventRef) => void;
  /** Open somebody's profile from the host card or the attendee list. */
  onOpenPerson: (id: string) => void;
  onChanged: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [sharing, setSharing] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [when, setWhen] = useState<"all" | "upcoming" | "going">("upcoming");

  // Captured once rather than read during render: Date.now() is impure and
  // the compiler rejects it, and pinning it also stops the list quietly
  // reshuffling under somebody as an event slips into the past while they
  // are reading it.
  const [now] = useState(() => Date.now());
  const sorted = [...events]
    .filter((e) => {
      if (when === "upcoming" && e.startsAt && new Date(e.startsAt).getTime() < now && !e.live) return false;
      if (when === "going" && e.myRsvp !== "going") return false;
      const needle = q.trim().toLowerCase();
      if (!needle) return true;
      return [e.name, e.blurb, e.place, e.address, e.details]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    })
    .sort((a, b) => {
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
            onOpenSlug(slug);
            onChanged();
          }}
        />
      </div>
    );
  }

  if (open && editing === open.slug) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <EditEvent
          event={open}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
        />
      </div>
    );
  }

  if (open) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <button type="button" className="btn btn-ghost btn-sm mb-2" onClick={() => onOpenSlug(null)}>
          <IconChevronLeft size={13} /> All events
        </button>
        <EventPage
          event={open}
          sharing={sharing === open.slug}
          onShare={() => setSharing(sharing === open.slug ? null : open.slug)}
          onShow={() => onShow(open)}
          onEdit={() => setEditing(open.slug)}
          onOpenPerson={onOpenPerson}
          onDeleted={() => {
            // Back to the list first: the detail view is about to be looking
            // at a board the payload no longer contains.
            onOpenSlug(null);
            onChanged();
          }}
          onChanged={onChanged}
        />
      </div>
    );
  }

  const live = events.filter((e) => e.live).length;

  return (
    <DirectoryPanel
      query={q}
      onQuery={setQ}
      placeholder={`Search ${events.length} ${events.length === 1 ? "event" : "events"} by name or place…`}
      filters={[
        { id: "upcoming", label: "Upcoming" },
        { id: "going", label: "I’m going" },
        { id: "all", label: "All" },
      ]}
      activeFilter={when}
      onFilter={(id) => setWhen(id as typeof when)}
      note={
        live > 0 ? (
          <>
            <span className="font-semibold text-[var(--ink)]">{live}</span>{" "}
            {live === 1 ? "event is" : "events are"} happening right now.
          </>
        ) : null
      }
      footer={
        canCreate ? (
          <button type="button" className="btn btn-ghost btn-sm w-full" onClick={() => setCreating(true)}>
            <IconPlus size={13} /> {scopeSlug ? `New event in ${scopeName}` : "Create an event"}
          </button>
        ) : null
      }
    >
      {sorted.length === 0 ? (
        <PanelNote title={q || when !== "all" ? "Nothing matches that" : `No events in ${scopeName} yet`}>
          {q || when !== "all"
            ? "Try a different search, or show all events."
            : canCreate
              ? "Create one and you'll get a QR code to share — whoever scans it joins the event and the community."
              : "Events your communities are running show up here."}
        </PanelNote>
      ) : (
        <ul className="stagger flex flex-col gap-2">
          {sorted.map((e) => (
            <li key={e.slug}>
              <button
                type="button"
                onClick={() => onOpenSlug(e.slug)}
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
                  {e.lat == null && (
                    <span className="block text-[11px] font-semibold" style={{ color: "var(--warn)" }}>
                      Not on the map{e.isHost ? " — add a venue" : ""}
                    </span>
                  )}
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
    </DirectoryPanel>
  );
}
