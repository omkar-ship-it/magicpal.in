"use client";

import Link from "next/link";
import type { EventRef } from "@/lib/shell";
import PanelNote from "./PanelNote";
import { whenLabel } from "@/lib/time";
import { IconBeacon, IconCalendar, IconPin, IconPlus } from "./Icons";

/**
 * Events on this network.
 *
 * On the open network these are public events anyone can join; inside a
 * community they are that community's own, which never appear publicly.
 * Live ones sort first and say so — during the two hours either side of a
 * start time, "is it happening now" is the only thing anybody wants to know.
 */
export default function EventsPanel({
  events,
  scopeName,
  scopeSlug,
  canCreate,
  onShow,
}: {
  events: EventRef[];
  scopeName: string;
  scopeSlug: string | null;
  canCreate: boolean;
  /** Centre the map on it, rather than navigating away from the map. */
  onShow: (e: EventRef) => void;
}) {
  const sorted = [...events].sort((a, b) => {
    if (a.live !== b.live) return a.live ? -1 : 1;
    return (a.startsAt ?? "").localeCompare(b.startsAt ?? "");
  });

  return (
    <div className="flex flex-col gap-2.5">
      {sorted.length === 0 ? (
        <PanelNote title={`No events on ${scopeName} yet`}>
          {canCreate
            ? "Create one and you'll get a QR code to share — people who scan it land straight on the board."
            : "Public events show up here. Members of a community see that community's events instead."}
        </PanelNote>
      ) : (
        <ul className="stagger flex flex-col gap-2">
          {sorted.map((e) => (
            <li key={e.slug}>
              <div className="card p-3">
                <div className="flex items-start gap-3">
                  <span
                    className="grid h-9 w-9 flex-none place-items-center rounded-xl"
                    style={{ background: "var(--sunk)", color: "var(--layer-event)" }}
                  >
                    <IconCalendar size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5">
                      <span className="min-w-0 truncate text-[13.5px] font-semibold">{e.name}</span>
                      {e.live && (
                        <span
                          className="pill"
                          style={{ background: "color-mix(in srgb, var(--good) 14%, transparent)", color: "var(--good)" }}
                        >
                          <IconBeacon size={10} /> Live
                        </span>
                      )}
                    </p>
                    <p className="truncate text-[11.5px] text-[var(--ink-soft)]">
                      {e.place ? `${e.place} · ` : ""}
                      {e.startsAt ? whenLabel(e.startsAt) : ""}
                    </p>
                  </div>
                </div>
                <div className="mt-2.5 flex gap-2">
                  <Link href={`/b/${e.slug}`} className="btn btn-primary btn-sm">
                    Open board
                  </Link>
                  {e.lat != null && e.lng != null && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => onShow(e)}>
                      <IconPin size={12} /> Show on map
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {canCreate && (
        <Link
          href={scopeSlug ? `/boards/new?in=${scopeSlug}` : "/boards/new"}
          className="btn btn-ghost btn-sm w-full"
        >
          <IconPlus size={13} /> {scopeSlug ? `New event in ${scopeName}` : "Create an event"}
        </Link>
      )}
    </div>
  );
}
