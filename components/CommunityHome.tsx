"use client";

import { useState } from "react";
import type { EventRef, ShellPayload } from "@/lib/shell";
import { whenLabel } from "@/lib/time";
import BoardQR from "./BoardQR";
import PanelNote from "./PanelNote";
import { IconBeacon, IconCalendar, IconPeople, IconPin, IconSparkle } from "./Icons";

/**
 * A community's own front page.
 *
 * Until now a community was only ever a filter on other windows — you could
 * see its people and its events but never the thing itself: who runs it,
 * how big it is, what's coming up, how to invite somebody. That's the page
 * a member sends to a friend, and the one a host checks to see whether
 * their group is alive.
 */
export default function CommunityHome({
  scope,
  events,
  memberCount,
  onOpenEvents,
  onOpenPeople,
}: {
  scope: ShellPayload["scope"];
  events: EventRef[];
  memberCount: number;
  onOpenEvents: () => void;
  onOpenPeople: () => void;
}) {
  // Above the early return: hooks must run in the same order every render.
  const [now] = useState(() => Date.now());

  const home = scope.home;
  if (!home || !scope.slug) {
    return (
      <PanelNote title="The open network has no home page">
        It isn&rsquo;t a group — it&rsquo;s everyone who opted into the public map. Communities have one; switch to
        yours in the picker above.
      </PanelNote>
    );
  }

  // `now` is pinned above: Date.now() during render is impure, and a fixed
  // value also stops the list reshuffling as somebody reads it.
  const upcoming = [...events]
    .filter((e) => e.startsAt && (e.live || new Date(e.startsAt).getTime() > now))
    .sort((a, b) => (a.startsAt ?? "").localeCompare(b.startsAt ?? ""))
    .slice(0, 3);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
      <div>
        <h2 className="text-[17px] font-semibold leading-tight">{scope.name}</h2>
        {scope.blurb && <p className="mt-1 text-[13px] leading-[1.5]">{scope.blurb}</p>}
        <p className="mt-1.5 text-[12px] text-[var(--ink-soft)]">
          Run by {home.hostName} · since {new Date(home.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat icon={<IconPeople size={14} />} value={memberCount} label="members" onClick={onOpenPeople} />
        <Stat icon={<IconCalendar size={14} />} value={home.eventCount} label="events" onClick={onOpenEvents} />
        <Stat
          icon={<IconBeacon size={14} />}
          value={home.hereNow}
          label="here now"
          tone={home.hereNow > 0 ? "good" : undefined}
        />
      </div>

      {home.place && (
        <p className="flex items-center gap-1.5 text-[12.5px] text-[var(--ink-soft)]">
          <IconPin size={12} /> {home.place}
        </p>
      )}

      <div>
        <p className="label label-icon">
          <IconCalendar size={12} /> Coming up
        </p>
        {upcoming.length === 0 ? (
          <p className="text-[12.5px] leading-[1.5] text-[var(--ink-soft)]">
            Nothing scheduled. {home.isHost ? "Create an event and everyone here sees it." : "The host hasn't posted one yet."}
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {upcoming.map((e) => (
              <li key={e.slug}>
                <button
                  type="button"
                  onClick={onOpenEvents}
                  className="flex w-full items-center gap-2.5 rounded-xl p-2 text-left tap hover:bg-[var(--sunk)]"
                >
                  <span
                    className="grid h-8 w-8 flex-none place-items-center rounded-xl"
                    style={{ background: "var(--sunk)", color: "var(--layer-event)" }}
                  >
                    <IconCalendar size={14} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-semibold">{e.name}</span>
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
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="label label-icon">
          <IconSparkle size={12} /> Invite someone
        </p>
        <BoardQR slug={scope.slug} name={scope.name} />
      </div>
    </div>
  );
}

function Stat({
  icon,
  value,
  label,
  tone,
  onClick,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  tone?: "good";
  onClick?: () => void;
}) {
  const color = tone === "good" ? "var(--good)" : "var(--ink)";
  const inner = (
    <>
      <span className="flex items-center justify-center gap-1" style={{ color }}>
        {icon}
        <span className="text-[16px] font-bold">{value}</span>
      </span>
      <span className="mt-0.5 block text-[11px] text-[var(--ink-soft)]">{label}</span>
    </>
  );
  const cls = "rounded-xl p-2.5 text-center";
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} tap`} style={{ background: "var(--sunk)" }}>
      {inner}
    </button>
  ) : (
    <div className={cls} style={{ background: "var(--sunk)" }}>
      {inner}
    </div>
  );
}
