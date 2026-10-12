"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import type { MapProfile } from "@/lib/profiles";
import { RADIUS_OPTIONS_KM } from "@/lib/rules";
import MapCanvas, { type MapEvent } from "./MapCanvas";
import PersonCard from "./PersonCard";
import { IconGlobe, IconHidden, IconSparkle, IconX } from "./Icons";

type MatchRef = { id: string; reason: string; twoWay: boolean };

/**
 * The open map at `/` — the third of the three surfaces, and the only one
 * nobody is invited to.
 *
 * It is a query, not a board: everyone whose visibility isn't off, inside a
 * radius. That means it has no host to vouch for anybody, so the whole
 * weight falls on the recommendation sentence, and the empty state has to
 * do real work — at launch this map is genuinely sparse, and pretending
 * otherwise with a spinner that resolves to nothing is how a first visit
 * becomes a last one.
 */
export default function OpenMap({
  center,
  initial,
  signedIn,
  onboarded,
  myVisibility,
}: {
  center: { lat: number; lng: number; label: string | null };
  /**
   * Server-rendered first view. The map arrives with people already on it
   * rather than popping them in a moment later — which also means this
   * component has no mount effect, only handlers for movement.
   */
  initial: { profiles: MapProfile[]; matches: MatchRef[]; events: MapEvent[]; radiusKm: number };
  signedIn: boolean;
  onboarded: boolean;
  myVisibility: "off" | "base" | "exact";
}) {
  const [people, setPeople] = useState<MapProfile[]>(initial.profiles);
  const [matches, setMatches] = useState<MatchRef[]>(initial.matches);
  const [events, setEvents] = useState<MapEvent[]>(initial.events);
  const [radiusKm, setRadiusKm] = useState<number>(initial.radiusKm);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<"forYou" | "everyone">("forYou");

  // Where the map currently is, so a radius change refetches around the
  // viewport the person is looking at rather than snapping back to where
  // they started.
  const at = useRef({ lat: center.lat, lng: center.lng });
  // Guards against a slow response for an old viewport landing after a fast
  // one for the new viewport — panning a map fires these in quick
  // succession and out-of-order arrival is the normal case, not the edge.
  const seq = useRef(0);

  const load = useCallback(async (lat: number, lng: number, radius: number) => {
    const mine = ++seq.current;
    setLoading(true);
    try {
      const res = await fetch(`/api/map?lat=${lat}&lng=${lng}&radiusKm=${radius}`);
      const data = await res.json();
      if (mine !== seq.current) return;
      setPeople(data.profiles ?? []);
      setMatches(data.matches ?? []);
      setEvents(data.events ?? []);
    } catch {
      if (mine === seq.current) setPeople([]);
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, []);

  const byId = new Map(people.map((p) => [p.id, p]));
  const matched = matches.map((m) => ({ match: m, person: byId.get(m.id) })).filter((x) => x.person);
  const selectedPerson = selected ? byId.get(selected) : null;

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <div className="absolute inset-0">
        <MapCanvas
          people={people}
          events={events}
          initialLat={center.lat}
          initialLng={center.lng}
          highlightIds={matches.map((m) => m.id)}
          onSelectPerson={(id) => setSelected(id)}
          onMoveEnd={(c) => {
            at.current = { lat: c.lat, lng: c.lng };
            void load(c.lat, c.lng, radiusKm);
          }}
        />
      </div>

      {/* --------------------------------------------- floating chrome */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 p-3">
        <div className="pointer-events-auto mx-auto flex max-w-2xl items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--card)]/95 px-3 py-2 backdrop-blur" style={{ boxShadow: "var(--shadow)" }}>
          <Link href="/" className="flex flex-none items-center gap-2 font-semibold">
            <span
              className="grid h-7 w-7 place-items-center rounded-full text-[13px] text-white"
              style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-deep))" }}
            >
              ✦
            </span>
          </Link>

          <span className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--ink-soft)]">
            {loading ? "Looking…" : `${people.length} ${people.length === 1 ? "person" : "people"} within ${radiusKm} km`}
          </span>

          <select
            value={radiusKm}
            onChange={(e) => {
              const r = Number(e.target.value);
              setRadiusKm(r);
              void load(at.current.lat, at.current.lng, r);
            }}
            aria-label="Search radius"
            className="input flex-none text-[12.5px]"
            style={{ width: "auto", padding: "5px 8px" }}
          >
            {RADIUS_OPTIONS_KM.map((r) => (
              <option key={r} value={r}>
                {r} km
              </option>
            ))}
          </select>

          {signedIn ? (
            <Link href="/you" className="btn btn-ghost btn-sm flex-none">
              You
            </Link>
          ) : (
            <Link href="/login" className="btn btn-primary btn-sm flex-none">
              Sign in
            </Link>
          )}
        </div>
      </header>

      {/* --------------------------------------------- the side panel */}
      <aside className="floating-panel absolute overflow-hidden bottom-0 left-0 right-0 z-20 max-h-[58dvh] md:bottom-3 md:left-3 md:right-auto md:top-[68px] md:max-h-none md:w-[360px]">
        {selectedPerson ? (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] p-3">
              <p className="label label-icon m-0">Profile</p>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelected(null)} aria-label="Close profile">
                <IconX size={13} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <PersonCard
                person={selectedPerson}
                reason={matches.find((m) => m.id === selectedPerson.id)?.reason}
                twoWay={matches.find((m) => m.id === selectedPerson.id)?.twoWay}
              />
              <ReachOut person={selectedPerson} signedIn={signedIn} />
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col">
            <div className="flex gap-1 border-b border-[var(--line)] p-2">
              <TabButton on={tab === "forYou"} onClick={() => setTab("forYou")}>
                <IconSparkle size={12} /> For you
              </TabButton>
              <TabButton on={tab === "everyone"} onClick={() => setTab("everyone")}>
                <IconGlobe size={12} /> Everyone
              </TabButton>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-3">
              {tab === "forYou" ? (
                <ForYou
                  matched={matched as Array<{ match: MatchRef; person: MapProfile }>}
                  loading={loading}
                  signedIn={signedIn}
                  onboarded={onboarded}
                  onOpen={setSelected}
                />
              ) : people.length === 0 ? (
                <EmptyMap loading={loading} />
              ) : (
                people.map((p) => <PersonCard key={p.id} person={p} compact onOpen={() => setSelected(p.id)} />)
              )}
            </div>
          </div>
        )}
      </aside>

      {signedIn && onboarded && myVisibility === "off" && <OffMapNudge />}
    </div>
  );
}

function TabButton({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
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

/**
 * The recommendation list, and every reason it can legitimately be empty.
 *
 * Four distinct states, kept distinct on purpose: "no account", "no
 * intents", "nobody nearby yet" and "still loading" are four different
 * problems with four different next actions, and collapsing them into one
 * "No matches" is how a product teaches people that it doesn't work.
 */
function ForYou({
  matched,
  loading,
  signedIn,
  onboarded,
  onOpen,
}: {
  matched: Array<{ match: MatchRef; person: MapProfile }>;
  loading: boolean;
  signedIn: boolean;
  onboarded: boolean;
  onOpen: (id: string) => void;
}) {
  if (!signedIn) {
    return (
      <Note title="Sign in to get recommendations">
        The map is public. Who you should meet on it isn&rsquo;t — that needs to know what you&rsquo;re looking for.
        <Link href="/login" className="btn btn-primary btn-sm mt-3">
          Sign in
        </Link>
      </Note>
    );
  }
  if (!onboarded) {
    return (
      <Note title="Say what you&rsquo;re here for">
        Two questions — what you need and what you can offer. Every recommendation is built from those.
        <Link href="/you" className="btn btn-primary btn-sm mt-3">
          Finish your profile
        </Link>
      </Note>
    );
  }
  if (loading) return <Note title="Looking for people worth your time…" />;
  if (matched.length === 0) {
    return (
      <Note title="Nobody on the open map matches yet">
        This is the thin part of a new map. Boards are where it actually starts — an event or a community arrives with a
        room full of people already on it.
        <Link href="/boards" className="btn btn-primary btn-sm mt-3">
          Find a board
        </Link>
      </Note>
    );
  }
  return (
    <>
      {matched.map(({ match, person }) => (
        <PersonCard
          key={person.id}
          person={person}
          reason={match.reason}
          twoWay={match.twoWay}
          onOpen={() => onOpen(person.id)}
        />
      ))}
    </>
  );
}

function EmptyMap({ loading }: { loading: boolean }) {
  if (loading) return <Note title="Looking…" />;
  return (
    <Note title="Nobody here yet">
      Widen the radius, or move the map. Most people arrive here through a board first and opt into the public map
      afterwards.
      <Link href="/boards" className="btn btn-ghost btn-sm mt-3">
        Browse boards
      </Link>
    </Note>
  );
}

/**
 * Children land in a div rather than a paragraph: every caller passes a
 * trailing button or link, and a block-level control inside a <p> is
 * invalid markup that the browser reflows into overlapping text.
 */
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

/** You are invisible here, and you may not have realised. */
function OffMapNudge() {
  const [shown, setShown] = useState(true);
  if (!shown) return null;
  return (
    <div className="pointer-events-auto absolute bottom-3 right-3 z-20 hidden max-w-[300px] md:block">
      <div className="card p-3.5">
        <p className="label label-icon m-0">
          <IconHidden size={12} /> You&rsquo;re not on this map
        </p>
        <p className="mt-1 text-[12.5px] leading-[1.5] text-[var(--ink-soft)]">
          You can see everyone; nobody can see you. Showing your city is enough to be found without being locatable.
        </p>
        <div className="mt-2.5 flex gap-2">
          <Link href="/you" className="btn btn-primary btn-sm">
            Choose what to show
          </Link>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShown(false)}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The handoff.
 *
 * No in-app chat in this version: an empty inbox is worse than no inbox,
 * and a message nobody is notified about is worse than both. LinkedIn is
 * where these conversations already live, so the product's job is to end
 * at the right door rather than to own the whole corridor.
 */
function ReachOut({ person, signedIn }: { person: MapProfile; signedIn: boolean }) {
  if (!signedIn) {
    return (
      <Note title="Sign in to reach out">
        <Link href="/login" className="btn btn-primary btn-sm mt-3">
          Sign in
        </Link>
      </Note>
    );
  }
  return (
    <div className="card mt-2.5 p-3.5">
      <p className="label m-0">Say hello</p>
      {person.linkedinUrl ? (
        <a href={person.linkedinUrl} target="_blank" rel="noreferrer noopener" className="btn btn-primary btn-sm mt-2">
          Message on LinkedIn
        </a>
      ) : (
        <p className="mt-1 text-[12.5px] leading-[1.5] text-[var(--ink-soft)]">
          {person.name.split(" ")[0]} hasn&rsquo;t added a LinkedIn yet. If you&rsquo;re at the same board, find them in the room.
        </p>
      )}
    </div>
  );
}
