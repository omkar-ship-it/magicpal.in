"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MapProfile } from "@/lib/profiles";
import MapCanvas from "./MapCanvas";
import PersonCard from "./PersonCard";
import BoardQR from "./BoardQR";
import { IconBeacon, IconCalendar, IconGlobe, IconPeople, IconSparkle, IconX } from "./Icons";

export type BoardMember = MapProfile & { hereNow: boolean; role: string; unplaced: boolean };

export type BoardSummary = {
  slug: string;
  type: "event" | "community";
  name: string;
  blurb: string | null;
  place: string | null;
  lat: number | null;
  lng: number | null;
  startsAt: string | null;
  hostName: string;
  live: boolean;
};

/**
 * A board, as a member sees it.
 *
 * Recommendations come first and the full list second, which is the whole
 * bet of the product: in a room of three hundred, a directory is a worse
 * tool than three names with reasons attached. The list is still there,
 * because a recommendation you disagree with has to have somewhere to go.
 *
 * An event opens on the people, not the map — you are already in the
 * building, so "where" is answered and "who" isn't. A community opens the
 * same way but the map earns its place, because "who here is in Berlin" is
 * the question a community genuinely cannot answer about itself.
 */
export default function BoardView({
  board,
  members,
  matches,
  me,
  checkedIn,
  isHost,
  justCreated,
}: {
  board: BoardSummary;
  members: BoardMember[];
  matches: Array<{ id: string; reason: string; twoWay: boolean }>;
  me: { id: string; onboarded: boolean };
  checkedIn: boolean;
  isHost: boolean;
  /** Arrived straight from creating it — the QR is the only thing they need. */
  justCreated: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"forYou" | "everyone">("forYou");
  const [selected, setSelected] = useState<string | null>(null);
  const [here, setHere] = useState(checkedIn);
  const [busy, setBusy] = useState(false);

  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const matched = matches.map((m) => ({ match: m, person: byId.get(m.id) })).filter((x) => x.person);
  const placed = members.filter((m) => !m.unplaced);
  const selectedPerson = selected ? byId.get(selected) : null;
  const hereCount = members.filter((m) => m.hereNow).length;

  async function toggleHere() {
    setBusy(true);
    const next = !here;
    setHere(next);
    try {
      const res = await fetch(`/api/boards/${board.slug}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ here: next }),
      });
      if (!res.ok) setHere(!next);
      else router.refresh();
    } catch {
      setHere(!next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 md:px-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="label label-icon m-0">
            {board.type === "event" ? "Event board" : "Community board"}
          </p>
          <h1 className="text-[22px] font-bold leading-tight">{board.name}</h1>
          <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
            {board.place ? `${board.place} · ` : ""}
            {board.startsAt ? `${formatWhen(board.startsAt)} · ` : ""}
            Hosted by {board.hostName}
          </p>
          {board.blurb && <p className="mt-2 max-w-prose text-[13.5px] leading-[1.55]">{board.blurb}</p>}
        </div>

        <div className="flex flex-none items-center gap-2">
          <span className="pill" style={{ background: "var(--sunk)" }}>
            <IconPeople size={12} /> {members.length + 1}
          </span>
          {board.type === "event" && board.live && (
            <button
              type="button"
              onClick={toggleHere}
              disabled={busy}
              className={`btn btn-sm ${here ? "btn-ghost" : "btn-primary"}`}
            >
              <IconBeacon size={13} />
              {here ? "I've left" : "I'm here"}
            </button>
          )}
        </div>
      </header>

      {board.type === "event" && board.live && (
        <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-[var(--ink-soft)]">
          <IconBeacon size={12} style={{ color: "var(--good)" }} />
          {hereCount > 0
            ? `${hereCount} ${hereCount === 1 ? "person is" : "people are"} in the room right now.`
            : "Nobody's marked themselves here yet. Be first and you'll be easy to find."}
        </p>
      )}

      {/* A board nobody has joined yet is a QR code and nothing else. Showing
          the empty people tabs first would be showing a host the one view
          that can't help them. */}
      {isHost && (justCreated || members.length === 0) && (
        <div className="mt-5">
          <BoardQR slug={board.slug} name={board.name} />
          {justCreated && (
            <p className="mt-2 text-[12.5px] leading-[1.5] text-[var(--ink-soft)]">
              Put this on a slide, a poster, or into the group chat. People who scan it land straight on the board.
            </p>
          )}
        </div>
      )}

      <div className="mt-5 grid gap-5 md:grid-cols-[minmax(0,1fr)_340px]">
        {/* ------------------------------------------------- the people */}
        <section className="min-w-0 order-2 md:order-1">
          <div className="mb-3 flex gap-1 rounded-full border border-[var(--line)] p-1">
            <Tab on={tab === "forYou"} onClick={() => setTab("forYou")}>
              <IconSparkle size={12} /> For you
            </Tab>
            <Tab on={tab === "everyone"} onClick={() => setTab("everyone")}>
              <IconGlobe size={12} /> Everyone · {members.length}
            </Tab>
          </div>

          {tab === "forYou" ? (
            !me.onboarded ? (
              <Note title="Answer two questions first">
                What you&rsquo;re looking for, and what you can help with. That&rsquo;s what the recommendations are built
                from — without them this is just a list.
                <Link href={`/you?next=/b/${board.slug}`} className="btn btn-primary btn-sm mt-3">
                  Set that up
                </Link>
              </Note>
            ) : members.length === 0 ? (
              // Checked before the match test: on a board of one, "no strong
              // match" blames the matcher for an empty room and hides the
              // only action that helps.
              <Note title="Nobody's joined yet">
                Share the code above and recommendations start appearing as people scan it.
              </Note>
            ) : matched.length === 0 ? (
              <Note title="No strong match on this board yet">
                Nobody here has stated something that lines up with what you&rsquo;re after. More people join as the
                board fills — and the list beside this tab is still worth a scroll.
              </Note>
            ) : (
              <div className="flex flex-col gap-3">
                {matched.map(({ match, person }) => (
                  <PersonCard
                    key={person!.id}
                    person={person!}
                    reason={match.reason}
                    twoWay={match.twoWay}
                    onOpen={() => setSelected(person!.id)}
                  />
                ))}
              </div>
            )
          ) : members.length === 0 ? (
            <Note title="Just you so far">
              Share the board&rsquo;s QR code or link and it fills up as people scan it.
            </Note>
          ) : (
            <div className="flex flex-col gap-3">
              {members.map((m) => (
                <PersonCard key={m.id} person={m} compact onOpen={() => setSelected(m.id)} />
              ))}
            </div>
          )}
        </section>

        {/* ---------------------------------------------------- the map */}
        <aside className="order-1 md:order-2">
          <div className="card overflow-hidden" style={{ height: 300 }}>
            {placed.length > 0 ? (
              <MapCanvas
                people={placed}
                initialLat={board.lat ?? placed[0].lat}
                initialLng={board.lng ?? placed[0].lng}
                initialZoom={board.type === "event" ? 12 : 3}
                // An event frames its venue: you are in that building, and
                // zooming out to include the one member who dialled in from
                // Mumbai makes the room itself unreadable. A community has no
                // venue and its spread *is* the information, so it frames
                // whoever is on it.
                fitToPeople={board.type === "community"}
                highlightIds={matches.map((m) => m.id)}
                onSelectPerson={setSelected}
              />
            ) : (
              <div className="grid h-full place-items-center p-6 text-center">
                <p className="text-[12.5px] leading-[1.5] text-[var(--ink-soft)]">
                  Nobody on this board has put themselves on a map yet. It&rsquo;s optional — they&rsquo;re all still
                  listed and matchable.
                </p>
              </div>
            )}
          </div>
          {members.length > 0 && (
            <p className="mt-2 text-[11.5px] leading-[1.45] text-[var(--ink-soft)]">
              {placed.length} of {members.length} chose to show a location. A pin is street level; a circle is city only.
            </p>
          )}

          {isHost && members.length > 0 && !justCreated && (
            <details className="card mt-3 p-3.5">
              <summary className="cursor-pointer text-[13px] font-semibold">Share this board</summary>
              <div className="mt-3">
                <BoardQR slug={board.slug} name={board.name} />
              </div>
            </details>
          )}

          {board.type === "community" && (
            <Link href={`/boards/new?in=${board.slug}`} className="btn btn-ghost btn-sm mt-3 w-full">
              <IconCalendar size={13} /> Add an event for this community
            </Link>
          )}

          {selectedPerson && (
            <div className="card mt-3 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="label m-0">Profile</p>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelected(null)} aria-label="Close">
                  <IconX size={12} />
                </button>
              </div>
              <PersonCard
                person={selectedPerson}
                reason={matches.find((m) => m.id === selectedPerson.id)?.reason}
                twoWay={matches.find((m) => m.id === selectedPerson.id)?.twoWay}
              />
              {selectedPerson.linkedinUrl && (
                <a
                  href={selectedPerson.linkedinUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="btn btn-primary btn-sm mt-2.5 w-full"
                >
                  Message on LinkedIn
                </a>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Tab({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[12.5px] font-semibold tap"
      style={on ? { background: "var(--sunk)", color: "var(--brand-deep)" } : { color: "var(--ink-soft)" }}
    >
      {children}
    </button>
  );
}

/** Children land in a div, not a <p> — they include buttons and links. */
function Note({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="card p-4">
      <p className="text-[13.5px] font-semibold">{title}</p>
      {children && (
        <div className="mt-1 flex flex-col items-start text-[12.5px] leading-[1.5] text-[var(--ink-soft)]">
          {children}
        </div>
      )}
    </div>
  );
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
