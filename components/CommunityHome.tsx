"use client";

import { useState } from "react";
import type { EventRef, ShellPayload, ShellPerson } from "@/lib/shell";
import { boardBanner } from "@/lib/avatar";
import { whenLabel } from "@/lib/time";
import Avatar from "./Avatar";
import BoardLogo from "./BoardLogo";
import BoardQR from "./BoardQR";
import InstallApp from "./InstallApp";
import LegalFooter from "./LegalFooter";
import PanelNote from "./PanelNote";
import { Page, Row, Section, Stat, Stats } from "./Panel";
import EditCommunity from "./EditCommunity";
import LeaveCommunity from "./LeaveCommunity";
import VerifiedBadge from "./VerifiedBadge";
import { IconBeacon, IconCalendar, IconCheck, IconPeople, IconPin, IconSparkle } from "./Icons";

/**
 * A community's own front page.
 *
 * Until now a community was only ever a filter on other windows — you could
 * see its people and its events but never the thing itself: who runs it,
 * how big it is, what's coming up, how to invite somebody. That's the page
 * a member sends to a friend, and the one a host checks to see whether
 * their group is alive.
 *
 * The masthead is bespoke rather than the shared `Hero`, and that is the
 * point of this page: an alumni association or a company arrives with an
 * identity already, and a page that renders it as another grey list reads
 * as somebody else's software. The logo, the group's own colour and the
 * faces of its members are what make it *theirs* — which is also what makes
 * the invite worth forwarding.
 */
export default function CommunityHome({
  scope,
  events,
  people,
  memberCount,
  onOpenEvents,
  onOpenPeople,
  onOpenPerson,
  onChanged,
}: {
  scope: ShellPayload["scope"];
  events: EventRef[];
  /** Already scoped to this board by the shell — for faces, not a roster. */
  people: ShellPerson[];
  memberCount: number;
  onOpenEvents: () => void;
  onOpenPeople: () => void;
  onOpenPerson: (id: string) => void;
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
          initial={{
            name: scope.name,
            blurb: scope.blurb,
            details: home.details,
            guidelines: home.guidelines,
            place: home.place,
            logoUrl: scope.logoUrl,
          }}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onChanged();
          }}
        />
      </div>
    );
  }

  // Verified faces first: the point of the row is "do I recognise anybody",
  // and a vouched member is the one most likely to be recognised.
  const faces = [...people]
    .sort((a, b) => Number(Boolean(b.verifiedHere)) - Number(Boolean(a.verifiedHere)))
    .slice(0, 7);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <Page>
        {/* ------------------------------------------------- the masthead */}
        <header className="reveal">
          <div
            className="rounded-2xl border p-4"
            style={{ borderColor: "var(--line)", background: boardBanner(scope.name) }}
          >
            {/* The band is the group's own colour, so the mark sits on it
                rather than above a white rectangle. In the flow rather than
                absolutely placed — overlapping its own eyebrow is exactly
                what absolute positioning did at the first width tried. */}
            <div className="mb-3 flex items-start justify-between gap-3">
              <BoardLogo name={scope.name} logoUrl={scope.logoUrl} size={60} ring />
              {home.isHost && (
                <button type="button" className="btn btn-ghost btn-sm flex-none" onClick={() => setEditing(true)}>
                  Edit
                </button>
              )}
            </div>

            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <span className="pill" style={{ background: "var(--card)", color: "var(--ink-soft)" }}>
                <IconPeople size={10} /> Community
              </span>
              {home.place && (
                <span className="pill" style={{ background: "var(--card)", color: "var(--ink-soft)" }}>
                  <IconPin size={10} /> {home.place}
                </span>
              )}
              {home.hereNow > 0 && (
                <span className="pill" style={{ background: "var(--card)", color: "var(--good)" }}>
                  <IconBeacon size={10} /> {home.hereNow} here now
                </span>
              )}
            </div>

            <h1 className="text-[22px] font-semibold leading-[1.15] tracking-[-0.02em] text-balance">
              {scope.name}
            </h1>
            {scope.blurb && (
              <p className="mt-1 max-w-[46ch] text-[13px] leading-[1.5] text-[var(--ink-soft)]">{scope.blurb}</p>
            )}
            <p className="mt-2 text-[11.5px] text-[var(--ink-soft)]">
              Run by <span className="font-semibold text-[var(--ink)]">{home.hostName}</span> · since{" "}
              {new Date(home.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </p>
          </div>

          {/* Faces, immediately under the name: a community page with no
              people on it reads as empty however large the headcount is. */}
          {faces.length > 0 && (
            <button
              type="button"
              onClick={onOpenPeople}
              className="lift mt-2 flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left tap"
              style={{ borderColor: "var(--line)", background: "var(--card)" }}
            >
              <span className="flex flex-none items-center">
                {faces.map((p, i) => (
                  <span key={p.id} style={{ marginLeft: i === 0 ? 0 : -10, zIndex: faces.length - i }}>
                    <Avatar name={p.name} photoUrl={p.photoUrl} size={30} ring={2} />
                  </span>
                ))}
              </span>
              <span className="min-w-0 flex-1 text-[12.5px] leading-[1.35]">
                <span className="font-semibold">{memberCount} members</span>
                {home.verifiedCount > 0 && (
                  <span className="text-[var(--ink-soft)]">
                    {" · "}
                    {home.verifiedCount} verified
                  </span>
                )}
                <span className="block text-[11.5px] text-[var(--ink-soft)]">See everyone →</span>
              </span>
            </button>
          )}
        </header>

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

        {home.details ? (
          <Section title="What this community is for" icon={<IconSparkle size={12} />}>
            <p className="max-w-[62ch] whitespace-pre-line text-[12.5px] leading-[1.6]">{home.details}</p>
          </Section>
        ) : home.isHost ? (
          <Prompt
            title="Say what this community is for →"
            body="Who it's for and what people get out of being here. It's the first thing somebody reads before joining."
            onClick={() => setEditing(true)}
          />
        ) : null}

        {/* House rules get a bordered block rather than another paragraph:
            they're the terms of being here, and the thing the owner points
            at when they remove somebody. */}
        {home.guidelines ? (
          <Section title="House rules" icon={<IconCheck size={12} />}>
            <div
              className="rounded-2xl border-l-[3px] py-1 pl-3.5 pr-1"
              style={{ borderColor: "var(--brand)", borderRadius: "4px 16px 16px 4px", background: "var(--sunk)" }}
            >
              <p className="max-w-[62ch] whitespace-pre-line py-2 text-[12.5px] leading-[1.6]">{home.guidelines}</p>
            </div>
          </Section>
        ) : home.isHost ? (
          <Prompt
            title="Add house rules →"
            body="What's welcome here and what isn't. Everyone sees them, and they're what you point at if you ever have to remove somebody."
            onClick={() => setEditing(true)}
          />
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
                    <DateTile iso={e.startsAt} live={e.live} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-semibold">{e.name}</span>
                      <span className="block truncate text-[11.5px] text-[var(--ink-soft)]">
                        {e.startsAt ? whenLabel(e.startsAt) : ""}
                        {e.going > 0 ? ` · ${e.going} going` : ""}
                        {e.place ? ` · ${e.place}` : ""}
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

        {/* Verified members, named. The badge means nothing unless somebody
            can see who it has been given to. */}
        {home.verifiedCount > 0 && (
          <Section
            title="Vouched for by this community"
            icon={<IconCheck size={12} />}
            aside={home.verifiedCount > 6 ? `${home.verifiedCount} in all` : undefined}
          >
            <ul className="flex flex-wrap gap-1.5">
              {people
                .filter((p) => p.verifiedHere)
                .slice(0, 6)
                .map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => onOpenPerson(p.id)}
                      className="lift flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 text-left tap"
                      style={{ borderColor: "var(--line)", background: "var(--card)" }}
                    >
                      <Avatar name={p.name} photoUrl={p.photoUrl} size={22} />
                      <span className="max-w-[14ch] truncate text-[11.5px] font-semibold">{p.name}</span>
                      <VerifiedBadge size={11} label="Verified by this community" />
                    </button>
                  </li>
                ))}
            </ul>
          </Section>
        )}

        <Section title="Invite someone" icon={<IconSparkle size={12} />}>
          <BoardQR slug={scope.slug} name={scope.name} />
        </Section>

        {home.canLeave && (
          <div className="reveal">
            <LeaveCommunity slug={scope.slug} name={scope.name} onLeft={onChanged} />
          </div>
        )}

        {/* The agreement, where somebody can actually find it again.
            A consent taken once at sign-up and then buried is a consent
            nobody can act on — withdrawing one starts with reading it. */}
        <InstallApp />
        <LegalFooter />
      </Page>
    </div>
  );
}

/**
 * A date as a tile rather than a calendar glyph.
 *
 * Three events in a row all showing the same icon tells you nothing; the
 * month and the number tell you which one is this weekend, which is the
 * only question anybody asks of a list like this.
 */
function DateTile({ iso, live }: { iso: string | null; live: boolean }) {
  if (!iso) {
    return (
      <span
        className="grid h-10 w-10 flex-none place-items-center rounded-xl"
        style={{ background: "var(--sunk)", color: "var(--ink-soft)" }}
      >
        <IconCalendar size={15} />
      </span>
    );
  }
  const d = new Date(iso);
  return (
    <span
      className="grid h-10 w-10 flex-none place-content-center justify-items-center rounded-xl leading-none"
      style={{
        background: live ? "color-mix(in srgb, var(--good) 14%, transparent)" : "var(--sunk)",
        color: live ? "var(--good)" : "var(--layer-event)",
      }}
    >
      <span className="text-[9px] font-semibold uppercase tracking-wide">
        {d.toLocaleDateString(undefined, { month: "short" })}
      </span>
      <span className="mt-0.5 text-[15px] font-semibold tabular-nums">{d.getDate()}</span>
    </span>
  );
}

/** A dashed invitation to fill something in. Host-only, by construction. */
function Prompt({ title, body, onClick }: { title: string; body: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="reveal lift rounded-2xl border border-dashed p-3.5 text-left tap"
      style={{ borderColor: "var(--line)" }}
    >
      <p className="text-[12.5px] font-semibold">{title}</p>
      <p className="mt-0.5 max-w-[56ch] text-[11.5px] leading-[1.45] text-[var(--ink-soft)]">{body}</p>
    </button>
  );
}
