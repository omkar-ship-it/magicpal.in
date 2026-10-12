"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { MapProfile } from "@/lib/profiles";
import type { FeedItem } from "@/lib/feed";
import type { EventRef, ShellPayload } from "@/lib/shell";
import { applyFacets, facetsActive, NO_FACETS, type Facets } from "@/lib/search";
import MapCanvas from "./MapCanvas";
import MapDock, { type DockTab } from "./MapDock";
import MapTopBar from "./MapTopBar";
import PersonCard from "./PersonCard";
import PanelNote from "./PanelNote";
import FeedPanel from "./FeedPanel";
import EventsPanel from "./EventsPanel";
import ChatsPanel from "./ChatsPanel";
import { IconHidden, IconX } from "./Icons";

/**
 * The whole app, on top of a map.
 *
 * Every dock panel answers the same question about a different set of
 * people, so they are all assembled from one resolved scope (see
 * lib/shell.ts) — switch networks and recommendations, people, events and
 * the feed move together, and the map moves with them. The alternative is
 * four surfaces that quietly disagree about who is in the room.
 *
 * Search and filters run through one shared matcher for the list *and* the
 * pins: the prototype had two and searching "fundraising" produced ten
 * results floating over an empty map.
 */
export default function MapShell({
  initial,
  signedIn,
  onboarded,
  myVisibility,
  me,
}: {
  initial: ShellPayload;
  signedIn: boolean;
  onboarded: boolean;
  myVisibility: "off" | "base" | "exact";
  me: { name: string; photoUrl: string | null } | null;
}) {
  const [data, setData] = useState<ShellPayload>(initial);
  const [radiusKm, setRadiusKm] = useState(initial.radiusKm);
  const [facets, setFacets] = useState<Facets>(NO_FACETS);
  const [tab, setTab] = useState<DockTab>("forYou");
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);

  const at = useRef(initial.centre ?? { lat: 17.4065, lng: 78.4772 });
  // Guards against a slow response for an old viewport or network landing
  // after a fast one for the new — panning fires these in quick succession
  // and out-of-order arrival is the normal case, not the edge.
  const seq = useRef(0);

  const load = useCallback(
    async (opts: { lat?: number; lng?: number; radius?: number; net?: string | null }) => {
      const mine = ++seq.current;
      setLoading(true);
      const params = new URLSearchParams();
      const slug = opts.net === undefined ? data.scope.slug : opts.net;
      if (slug) params.set("net", slug);
      params.set("lat", String(opts.lat ?? at.current.lat));
      params.set("lng", String(opts.lng ?? at.current.lng));
      params.set("radiusKm", String(opts.radius ?? radiusKm));
      try {
        const res = await fetch(`/api/map?${params}`);
        const next = (await res.json()) as ShellPayload;
        if (mine !== seq.current || !next.scope) return;
        setData(next);
        if (next.centre) at.current = next.centre;
      } finally {
        if (mine === seq.current) setLoading(false);
      }
    },
    [data.scope.slug, radiusKm]
  );

  const loadFeed = useCallback(async (slug: string | null) => {
    setFeedLoading(true);
    try {
      const res = await fetch(`/api/feed${slug ? `?net=${encodeURIComponent(slug)}` : ""}`);
      const json = await res.json();
      setFeed(json.items ?? []);
    } catch {
      setFeed([]);
    } finally {
      setFeedLoading(false);
    }
  }, []);

  function openTab(next: Exclude<DockTab, null>) {
    // Tapping the open slot lowers the panel — the only way back to a clean
    // map, and the gesture people try first.
    if (tab === next) {
      setTab(null);
      return;
    }
    setSelected(null);
    setTab(next);
    if (next === "feed") void loadFeed(data.scope.slug);
  }

  function switchNetwork(slug: string | null) {
    setFacets(NO_FACETS);
    setSelected(null);
    void load({ net: slug });
    if (tab === "feed") void loadFeed(slug);
  }

  const shown = useMemo(() => applyFacets(data.people, facets), [data.people, facets]);
  const byId = useMemo(() => new Map(data.people.map((p) => [p.id, p])), [data.people]);
  const selectedPerson = selected ? byId.get(selected) : null;
  const filtering = facetsActive(facets) > 0;

  // Recommendations are filtered by the same facets as everything else, so
  // a narrowed search can't surface someone the map is hiding.
  const matched = data.matches
    .map((m) => ({ match: m, person: byId.get(m.id) }))
    .filter((x): x is { match: (typeof data.matches)[number]; person: MapProfile } => {
      return Boolean(x.person) && shown.some((s) => s.id === x.person!.id);
    });

  const isOpenNet = data.scope.slug === null;

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <div className="absolute inset-0">
        <MapCanvas
          key={data.scope.slug ?? "open"}
          people={shown}
          events={data.events}
          initialLat={data.centre?.lat ?? initial.centre?.lat ?? 17.4065}
          initialLng={data.centre?.lng ?? initial.centre?.lng ?? 78.4772}
          initialZoom={isOpenNet ? 10 : data.scope.kind === "event" ? 12 : 3}
          fitToPeople={!isOpenNet && data.scope.kind === "community"}
          bottomInset={tab ? 360 : 120}
          showZoom
          highlightIds={data.matches.map((m) => m.id)}
          onSelectPerson={(id) => {
            setSelected(id);
            setTab("people");
          }}
          onSelectEvent={() => setTab("events")}
          onMoveEnd={(c) => {
            at.current = { lat: c.lat, lng: c.lng };
            // Only the open network is a radius query; a board's membership
            // doesn't change because you panned.
            if (isOpenNet) void load({ lat: c.lat, lng: c.lng });
          }}
        />
      </div>

      <MapTopBar
        networks={data.networks}
        activeSlug={data.scope.slug}
        facets={facets}
        onFacets={setFacets}
        radiusKm={radiusKm}
        onRadius={(km) => {
          setRadiusKm(km);
          void load({ radius: km });
        }}
        countLabel={`${shown.length} of ${data.people.length} shown`}
        onNetwork={switchNetwork}
      />

      {tab && (
        <aside
          className="floating-panel panel-enter absolute inset-x-2 bottom-[82px] z-30 flex max-h-[min(52dvh,460px)] flex-col overflow-hidden sm:left-1/2 sm:right-auto sm:w-[420px] sm:-translate-x-1/2"
          aria-label={tab}
        >
          <div className="flex min-h-0 flex-1 flex-col p-3">
            {selectedPerson ? (
              <Profile
                person={selectedPerson}
                reason={data.matches.find((m) => m.id === selectedPerson.id)?.reason}
                twoWay={data.matches.find((m) => m.id === selectedPerson.id)?.twoWay}
                signedIn={signedIn}
                onClose={() => setSelected(null)}
              />
            ) : tab === "forYou" ? (
              <ForYou
                matched={matched}
                loading={loading}
                signedIn={signedIn}
                onboarded={onboarded}
                filtering={filtering}
                scopeName={data.scope.name}
                onOpen={setSelected}
              />
            ) : tab === "feed" ? (
              <div className="min-h-0 flex-1 overflow-y-auto">
                <FeedPanel
                  items={feed}
                  loading={feedLoading}
                  signedIn={signedIn}
                  scopeName={data.scope.name}
                  onOpenPerson={(id) => {
                    if (byId.has(id)) {
                      setSelected(id);
                      setTab("people");
                    }
                  }}
                />
              </div>
            ) : tab === "people" ? (
              <div className="min-h-0 flex-1 overflow-y-auto">
                {shown.length === 0 ? (
                  <PanelNote title={filtering ? "Nothing matches that" : `Nobody on ${data.scope.name} yet`}>
                    {filtering
                      ? "Try fewer filters, or a wider radius."
                      : isOpenNet
                        ? "Most people arrive through a board first and opt into the public map afterwards."
                        : "Share the board's QR code and it fills as people scan it."}
                  </PanelNote>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {shown.map((p) => (
                      <PersonCard key={p.id} person={p} compact onOpen={() => setSelected(p.id)} />
                    ))}
                  </div>
                )}
              </div>
            ) : tab === "events" ? (
              <div className="min-h-0 flex-1 overflow-y-auto">
                <EventsPanel
                  events={data.events}
                  scopeName={data.scope.name}
                  scopeSlug={data.scope.slug}
                  canCreate={signedIn && onboarded}
                  onShow={(e: EventRef) => {
                    if (e.lat != null && e.lng != null) {
                      at.current = { lat: e.lat, lng: e.lng };
                      void load({ lat: e.lat, lng: e.lng });
                      setTab(null);
                    }
                  }}
                />
              </div>
            ) : (
              <ChatsPanel signedIn={signedIn} onChanged={() => void load({})} />
            )}
          </div>
        </aside>
      )}

      <MapDock
        active={tab}
        counts={{
          forYou: matched.length,
          people: shown.length,
          events: data.events.length,
          chats: data.waiting,
        }}
        signedIn={signedIn}
        me={me}
        onSelect={openTab}
      />

      {signedIn && onboarded && myVisibility === "off" && isOpenNet && <OffMapNudge />}
    </div>
  );
}

function ForYou({
  matched,
  loading,
  signedIn,
  onboarded,
  filtering,
  scopeName,
  onOpen,
}: {
  matched: Array<{ match: { id: string; reason: string; twoWay: boolean }; person: MapProfile }>;
  loading: boolean;
  signedIn: boolean;
  onboarded: boolean;
  filtering: boolean;
  scopeName: string;
  onOpen: (id: string) => void;
}) {
  if (!signedIn) {
    return (
      <PanelNote title="Sign in to get recommendations">
        The map is public. Who you should meet on it isn&rsquo;t — that needs to know what you&rsquo;re looking for.
        <Link href="/login" className="btn btn-primary btn-sm mt-3">
          Sign in
        </Link>
      </PanelNote>
    );
  }
  if (!onboarded) {
    return (
      <PanelNote title="Say what you're here for">
        Two questions — what you need, and what you can offer. Every recommendation is built from those.
        <Link href="/you" className="btn btn-primary btn-sm mt-3">
          Finish your profile
        </Link>
      </PanelNote>
    );
  }
  if (loading) return <PanelNote title="Looking for people worth your time…" />;
  if (matched.length === 0) {
    return (
      <PanelNote title={filtering ? "No matches inside those filters" : `No strong match on ${scopeName} yet`}>
        {filtering
          ? "Clear a filter or two — recommendations are narrowed by the same search as everything else."
          : "Nobody here has stated something that lines up with what you're after. The People tab is still worth a scroll."}
      </PanelNote>
    );
  }
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex flex-col gap-2.5">
        {matched.map(({ match, person }) => (
          <PersonCard
            key={person.id}
            person={person}
            reason={match.reason}
            twoWay={match.twoWay}
            onOpen={() => onOpen(person.id)}
          />
        ))}
      </div>
    </div>
  );
}

function Profile({
  person,
  reason,
  twoWay,
  signedIn,
  onClose,
}: {
  person: MapProfile & { connectionStatus?: string | null; connectionId?: string | null };
  reason?: string;
  twoWay?: boolean;
  signedIn: boolean;
  onClose: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-2 flex flex-none items-center justify-between gap-2">
        <p className="label m-0">Profile</p>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close profile">
          <IconX size={12} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <PersonCard person={person} reason={reason} twoWay={twoWay} />
        <ReachOut person={person} signedIn={signedIn} />
      </div>
    </div>
  );
}

/**
 * The one way to reach a stranger.
 *
 * A request with an optional note, then a thread only if they accept. There
 * is deliberately no open inbox: a map that shows where people are, plus
 * the ability to message anyone on it, is a harassment vector with extra
 * steps.
 */
function ReachOut({
  person,
  signedIn,
}: {
  person: MapProfile & { connectionStatus?: string | null };
  signedIn: boolean;
}) {
  const [note, setNote] = useState("");
  const [state, setState] = useState<string | null>(person.connectionStatus ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!signedIn) {
    return (
      <div className="mt-2.5">
        <PanelNote title="Sign in to reach out">
          <Link href="/login" className="btn btn-primary btn-sm mt-3">
            Sign in
          </Link>
        </PanelNote>
      </div>
    );
  }

  async function ask() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId: person.id, note: note.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't send that.");
      setState("pending");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (state === "accepted") {
    return (
      <div className="card mt-2.5 p-3.5">
        <p className="text-[13px] font-semibold">You&rsquo;re connected</p>
        <p className="mt-1 text-[12.5px] text-[var(--ink-soft)]">Your conversation is in Chats.</p>
      </div>
    );
  }
  if (state === "pending") {
    return (
      <div className="card mt-2.5 p-3.5">
        <p className="text-[13px] font-semibold">Request sent</p>
        <p className="mt-1 text-[12.5px] text-[var(--ink-soft)]">
          It&rsquo;s in Chats. The thread opens when {person.name.split(" ")[0]} accepts.
        </p>
      </div>
    );
  }

  return (
    <div className="card mt-2.5 p-3.5">
      <p className="label m-0">Ask to connect</p>
      <input
        className="input mt-1.5"
        placeholder={`Why you'd like to meet ${person.name.split(" ")[0]}`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={280}
      />
      {/* Said plainly, because a note that reads as optional gets skipped and
          a bare request gets declined. */}
      <p className="mt-1.5 text-[11.5px] leading-[1.45] text-[var(--ink-soft)]">
        Optional, but a specific reason is accepted far more often than a bare request.
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={ask}>
          {busy ? "Sending…" : "Send request"}
        </button>
        {person.linkedinUrl && (
          <a href={person.linkedinUrl} target="_blank" rel="noreferrer noopener" className="btn btn-ghost btn-sm">
            LinkedIn
          </a>
        )}
      </div>
      {error && <p className="mt-2 text-[12.5px] font-medium text-[var(--warn)]">{error}</p>}
    </div>
  );
}

function OffMapNudge() {
  const [shown, setShown] = useState(true);
  if (!shown) return null;
  return (
    <div className="pointer-events-auto absolute bottom-[96px] right-3 z-20 hidden max-w-[280px] lg:block">
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
