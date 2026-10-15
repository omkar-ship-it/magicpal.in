"use client";

import { useState } from "react";
import type { EventRef, ShellPayload } from "@/lib/shell";
import { whenLabel } from "@/lib/time";
import BoardQR from "./BoardQR";
import PanelNote from "./PanelNote";
import { Hero, Page, Row, Section, Stat, Stats } from "./Panel";
import EditCommunity from "./EditCommunity";
import LeaveCommunity from "./LeaveCommunity";
import { IconBeacon, IconCalendar, IconCheck, IconPeople, IconPin, IconSparkle } from "./Icons";

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
  onChanged,
}: {
  scope: ShellPayload["scope"];
  events: EventRef[];
  memberCount: number;
  onOpenEvents: () => void;
  onOpenPeople: () => void;
  /** Reload the shell after an edit or a departure. */
  onChanged: () => void;
}) {
  // Above the early return: hooks must run in the same order every render.
  const [now] = useState(() => Date.now());
  const [editing, setEditing] = useState(false);

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

  if (editing) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <EditCommunity
          slug={scope.slug}
          initial={{ name: scope.name, blurb: scope.blurb, details: home.details, guidelines: home.guidelines, place: home.place }}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onChanged();
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <Page>
        <Hero
          eyebrow={
            <span className="pill" style={{ background: "var(--sunk)", color: "var(--ink-soft)" }}>
              <IconPeople size={10} /> Community
            </span>
          }
          title={scope.name}
          subtitle={scope.blurb}
          action={
            home.isHost ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
                Edit
              </button>
            ) : null
          }
          meta={
            <>
              <span className="text-[12px] text-[var(--ink-soft)]">
                Run by {home.hostName} · since{" "}
                {new Date(home.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
              </span>
              {home.place && (
                <span className="flex items-center gap-1 text-[12px] text-[var(--ink-soft)]">
                  <IconPin size={11} /> {home.place}
                </span>
              )}
            </>
          }
        />

        <div className="reveal">
          <Stats>
            <Stat icon={<IconPeople size={14} />} value={memberCount} label="members" onClick={onOpenPeople} />
            {/* The number that answers "do I know who these people are?" —
                the whole reason verification exists, so it sits beside the
                headcount rather than being something you'd go counting. */}
            <Stat
              icon={<IconCheck size={14} />}
              value={home.verifiedCount}
              label="verified"
              tone={home.verifiedCount > 0 ? "good" : undefined}
              onClick={onOpenPeople}
            />
            <Stat icon={<IconCalendar size={14} />} value={home.eventCount} label="events" onClick={onOpenEvents} />
            <Stat
              icon={<IconBeacon size={14} />}
              value={home.hereNow}
              label="here now"
              tone={home.hereNow > 0 ? "good" : undefined}
            />
          </Stats>
        </div>

        {home.details && (
          <Section title="What this community is for" icon={<IconSparkle size={12} />}>
            <p className="whitespace-pre-line text-[12.5px] leading-[1.55]">{home.details}</p>
          </Section>
        )}

        {/* House rules get a bordered block rather than another paragraph:
            they're the terms of being here, and the thing the owner points
            at when they remove somebody. */}
        {home.guidelines ? (
          <Section title="House rules" icon={<IconCheck size={12} />}>
            <div className="rounded-2xl border p-3.5" style={{ borderColor: "var(--line)", background: "var(--sunk)" }}>
              <p className="whitespace-pre-line text-[12.5px] leading-[1.55]">{home.guidelines}</p>
            </div>
          </Section>
        ) : home.isHost ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="reveal lift rounded-2xl border border-dashed p-3.5 text-left tap"
            style={{ borderColor: "var(--line)" }}
          >
            <p className="text-[12.5px] font-semibold">Add house rules →</p>
            <p className="mt-0.5 text-[11.5px] leading-[1.45] text-[var(--ink-soft)]">
              What&rsquo;s welcome here and what isn&rsquo;t. Everyone sees them, and they&rsquo;re what you point at
              if you ever have to remove somebody.
            </p>
          </button>
        ) : null}

        <Section
          title="Coming up"
          icon={<IconCalendar size={12} />}
          aside={home.eventCount > upcoming.length ? `${home.eventCount} in all` : undefined}
        >
          {upcoming.length === 0 ? (
            <p className="text-[12.5px] leading-[1.5] text-[var(--ink-soft)]">
              Nothing scheduled.{" "}
              {home.isHost ? "Create an event and everyone here sees it." : "The host hasn't posted one yet."}
            </p>
          ) : (
            <ul className="stagger flex flex-col">
              {upcoming.map((e) => (
                <li key={e.slug}>
                  <Row onClick={onOpenEvents}>
                    <span
                      className="grid h-9 w-9 flex-none place-items-center rounded-xl"
                      style={{ background: "var(--sunk)", color: "var(--layer-event)" }}
                    >
                      <IconCalendar size={15} />
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
                        <IconBeacon size={10} /> Live
                      </span>
                    )}
                  </Row>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Invite someone" icon={<IconSparkle size={12} />}>
          <BoardQR slug={scope.slug} name={scope.name} />
        </Section>

        {home.canLeave && (
          <div className="reveal">
            <LeaveCommunity slug={scope.slug} name={scope.name} onLeft={onChanged} />
          </div>
        )}
      </Page>
    </div>
  );
}
