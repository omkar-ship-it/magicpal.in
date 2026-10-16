"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useIsNarrow } from "@/lib/useIsNarrow";
import Link from "next/link";
import type { MapProfile } from "@/lib/profiles";
import type { FeedItem } from "@/lib/feed";
import type { EventRef, ShellPayload } from "@/lib/shell";
import { applyFacets, facetsActive, NO_FACETS, type Facets } from "@/lib/search";
import MapCanvas from "./MapCanvas";
import MapDock, { type DockTab } from "./MapDock";
import FloatWindow, { DEFAULT_WINDOW, type WindowState } from "./FloatWindow";
import LiveLocation from "./LiveLocation";
import MapTopBar from "./MapTopBar";
import PersonCard from "./PersonCard";
import PeoplePanel from "./PeoplePanel";
import AlertsPanel from "./AlertsPanel";
import MemberControls from "./MemberControls";
import PersonProfile from "./PersonProfile";
import PanelNote from "./PanelNote";
import FeedPanel from "./FeedPanel";
import EventsPanel from "./EventsPanel";
import ChatsPanel from "./ChatsPanel";
import CommunityHome from "./CommunityHome";
import PinsPanel from "./PinsPanel";
import SignInPanel from "./SignInPanel";
import ProfilePanel from "./ProfilePanel";
import PublicOptIn from "./PublicOptIn";
import { IconChat, IconHidden, IconSparkle } from "./Icons";

export type Overlay = "signin" | "profile" | null;

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
  initialOverlay = null,
  pendingJoin = null,
  initialEvent = null,
  signedIn,
  onboarded,
  myVisibility,
  me,
}: {
  initial: ShellPayload;
  /** From ?panel= — lets /you, /login and friends stay real addresses. */
  initialOverlay?: Overlay;
  /**
   * A board slug carried through sign-in from a QR scan. Joined the moment
   * there's a session — the scanner's whole intent was to be in that room,
   * and making them find it again after signing in loses most of them.
   */
  pendingJoin?: string | null;
  /** From ?event= — a QR scan opens on the event it was printed for. */
  initialEvent?: string | null;
  signedIn: boolean;
  onboarded: boolean;
  myVisibility: "off" | "base" | "exact" | "live";
  me: { name: string; photoUrl: string | null } | null;
}) {
  const [data, setData] = useState<ShellPayload>(initial);
  const [radiusKm, setRadiusKm] = useState(initial.radiusKm);
  const [facets, setFacets] = useState<Facets>(NO_FACETS);
  /**
   * One window per panel, all independent. The dock opens them; it doesn't
   * own them, so several can be up at once and each remembers where it was
   * dragged to.
   */
  const [wins, setWins] = useState<Record<string, WindowState>>(() => ({
    // `?panel=` from /you or /login decides what's already up on arrival.
    home: { ...DEFAULT_WINDOW, x: 16, y: 72 },
    forYou: { ...DEFAULT_WINDOW, open: initialOverlay === null, x: 16, y: 72, z: 2 },
    feed: { ...DEFAULT_WINDOW, x: 56, y: 112 },
    people: { ...DEFAULT_WINDOW, x: 96, y: 152 },
    pins: { ...DEFAULT_WINDOW, x: 116, y: 172 },
    events: { ...DEFAULT_WINDOW, x: 136, y: 192 },
    chats: { ...DEFAULT_WINDOW, x: 176, y: 232 },
    alerts: { ...DEFAULT_WINDOW, x: 420, y: 96, w: 380 },
    person: { ...DEFAULT_WINDOW, x: 60, y: 120 },
    profile: { ...DEFAULT_WINDOW, open: initialOverlay === "profile", x: 216, y: 92, z: 3 },
    signin: { ...DEFAULT_WINDOW, open: initialOverlay === "signin", x: 240, y: 120, z: 3 },
  }));
  const topZ = useRef(3);
  const [selected, setSelected] = useState<string | null>(null);
  /** Whose thread Chats should land on, set when Message is tapped. */
  const [chatWith, setChatWith] = useState<string | null>(null);
  const [activeEvent, setActiveEvent] = useState<string | null>(initialEvent);
  const [loading, setLoading] = useState(false);
  /**
   * Overlays are the second layer of chrome: full surfaces (sign in, your
   * profile) rather than dock panels. They sit over the map like everything
   * else — the map is the app's background, not a component inside it, so
   * nothing in this product is ever shown without it.
   */
  const narrow = useIsNarrow();

  const win = useCallback(
    (id: string, next: Partial<WindowState>) => setWins((w) => ({ ...w, [id]: { ...w[id], ...next } })),
    []
  );
  const focus = useCallback(
    (id: string) => setWins((w) => ({ ...w, [id]: { ...w[id], z: ++topZ.current } })),
    []
  );
  const openWin = useCallback(
    (id: string) =>
      setWins((w) => ({ ...w, [id]: { ...w[id], open: true, min: false, z: ++topZ.current } })),
    []
  );

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
    const current = wins[next];
    // Tapping an already-focused window closes it; tapping a buried or
    // minimised one raises it instead of hiding it, which is what people
    // actually mean when they press a taskbar button.
    //
    // On a phone "focused" means *on screen*: only the front sheet is
    // visible, so a window that's open behind another has, as far as the
    // person tapping is concerned, never been opened. Closing it then would
    // answer a request to see something by hiding it.
    const onScreen = narrow ? frontId === next : current.open && !current.min;
    if (onScreen) {
      win(next, { open: false });
      return;
    }
    openWin(next);
    if (next === "feed") void loadFeed(data.scope.slug);
  }

  function switchNetwork(slug: string | null) {
    setFacets(NO_FACETS);
    setSelected(null);
    void load({ net: slug });
    if (wins.feed.open) void loadFeed(slug);
  }

  // Owner-only affordances key off the scope's own flag rather than
  // comparing ids in the client: the server already decided, and two places
  // deciding "am I the owner" is two places to get it wrong.
  const ownsScope = Boolean(data.scope.home?.isHost);
  const unverified = ownsScope ? data.people.filter((p) => !p.verifiedHere).length : 0;

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

  /**
   * On a phone, only the front window is on screen.
   *
   * Four sheets stacked on a 390px screen is four things covering each
   * other, and the one underneath can't be reached without closing the one
   * on top anyway. The others stay open in state — switching back to one
   * from the dock finds it where you left it.
   */
  // Computed plainly rather than memoised: it's a scan of seven entries,
  // and the hand-written useMemo was one the React Compiler refused to
  // preserve — which turns off its own optimisation for the whole component.
  const frontId = narrow
    ? (Object.entries(wins)
        .filter(([, w]) => w.open && !w.min)
        .sort((a, b) => b[1].z - a[1].z)[0]?.[0] ?? null)
    : null;
  const visible = (id: string) => !narrow || frontId === id;

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <div className="absolute inset-0">
        <MapCanvas
          key={data.scope.slug ?? "open"}
          people={shown}
          you={data.you}
          events={data.events}
          pins={data.pins}
          onSelectPin={() => openWin("pins")}
          // Opening Events turns the map into a map of events. Asking
          // "what's happening" and "who's nearby" at the same time answers
          // neither: the event pins vanish into the crowd.
          eventsOnly={wins.events.open && !wins.events.min}
          activeEventSlug={activeEvent}
          initialLat={data.centre?.lat ?? initial.centre?.lat ?? 17.4065}
          initialLng={data.centre?.lng ?? initial.centre?.lng ?? 78.4772}
          initialZoom={isOpenNet ? 10 : data.scope.kind === "event" ? 12 : 3}
          fitToPeople={!isOpenNet && data.scope.kind === "community"}
          // Just the dock: windows float and are moved out of the way by
          // hand, so reserving room for one would push the map around every
          // time somebody opened a panel.
          bottomInset={110}
          showZoom
          highlightIds={data.matches.map((m) => m.id)}
          onSelectPerson={(id) => {
            setSelected(id);
            openWin("person");
          }}
          onSelectEvent={(slug) => {
            setActiveEvent(slug);
            openWin("events");
          }}
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
        alerts={data.alerts}
        signedIn={signedIn}
        onAlerts={() => openWin("alerts")}
        onNetwork={switchNetwork}
        isLive={myVisibility === "live"}
        onGoLive={() => openWin("profile")}
        onHome={() => openWin("home")}
      />

      {myVisibility === "live" && <LiveLocation onChanged={() => void load({})} />}

      {/* ------------------------------------------------ the windows */}
      <FloatWindow
        title={data.scope.slug ? data.scope.name : "Open network"}
        state={visible("home") ? wins.home : { ...wins.home, open: false }}
        onChange={(n) => win("home", n)}
        onClose={() => win("home", { open: false })}
        onFocus={() => focus("home")}
        width={400}
      >
        <CommunityHome
          scope={data.scope}
          events={data.events}
          memberCount={data.people.length + 1}
          onOpenEvents={() => openWin("events")}
          onOpenPeople={() => openWin("people")}
          onChanged={() => void load({})}
        />
      </FloatWindow>

      <FloatWindow
        title="For you"
        state={visible("forYou") ? wins.forYou : { ...wins.forYou, open: false }}
        onChange={(n) => win("forYou", n)}
        onClose={() => win("forYou", { open: false })}
        onFocus={() => focus("forYou")}
      >
        <ForYou
          matched={matched}
          loading={loading}
          signedIn={signedIn}
          onboarded={onboarded}
          hasSignals={data.hasSignals}
          filtering={filtering}
          scopeName={data.scope.name}
          onOpen={(id) => {
            setSelected(id);
            openWin("person");
          }}
          onSignIn={() => openWin("signin")}
          onProfile={() => openWin("profile")}
        />
      </FloatWindow>

      <FloatWindow
        title={data.alerts > 0 ? `Alerts · ${data.alerts}` : "Alerts"}
        state={visible("alerts") ? wins.alerts : { ...wins.alerts, open: false }}
        onChange={(n) => win("alerts", n)}
        onClose={() => win("alerts", { open: false })}
        onFocus={() => focus("alerts")}
      >
        <AlertsPanel
          signedIn={signedIn}
          onOpenPerson={(id) => {
            setSelected(id);
            openWin("person");
          }}
          onOpenSettings={() => openWin("profile")}
          onRead={() => void load({})}
        />
      </FloatWindow>

      <FloatWindow
        title="Feed"
        state={visible("feed") ? wins.feed : { ...wins.feed, open: false }}
        onChange={(n) => win("feed", n)}
        onClose={() => win("feed", { open: false })}
        onFocus={() => focus("feed")}
      >
        <FeedPanel
          items={feed}
          loading={feedLoading}
          signedIn={signedIn}
          scopeName={data.scope.name}
          scopeSlug={data.scope.slug}
          events={data.events}
          pins={data.pins}
          canPost={signedIn && onboarded}
          onChanged={() => {
            void loadFeed(data.scope.slug);
            void load({});
          }}
          onOpenPins={() => openWin("pins")}
          onOpenEvents={() => openWin("events")}
          onSignIn={() => openWin("signin")}
          onOpenPerson={(id) => {
            if (byId.has(id)) {
              setSelected(id);
              openWin("person");
            }
          }}
        />
      </FloatWindow>

      <FloatWindow
        title={`People · ${shown.length}`}
        state={visible("people") ? wins.people : { ...wins.people, open: false }}
        onChange={(n) => win("people", n)}
        onClose={() => win("people", { open: false })}
        onFocus={() => focus("people")}
      >
        <PeoplePanel
          people={shown}
          scopeName={data.scope.name}
          isOpenNet={isOpenNet}
          filtering={filtering}
          unverifiedCount={unverified}
          showUnverified={ownsScope}
          onOpenPerson={(id) => {
            setSelected(id);
            openWin("person");
          }}
        />
      </FloatWindow>

      <FloatWindow
        title={data.pins.length > 0 ? `Now · ${data.pins.length}` : "Now"}
        state={visible("pins") ? wins.pins : { ...wins.pins, open: false }}
        onChange={(n) => win("pins", n)}
        onClose={() => win("pins", { open: false })}
        onFocus={() => focus("pins")}
      >
        <PinsPanel
          pins={data.pins}
          signedIn={signedIn}
          onboarded={onboarded}
          myPinId={data.myPinId}
          onChanged={() => void load({})}
          onShow={(pin) => {
            at.current = { lat: pin.lat, lng: pin.lng };
            void load({ lat: pin.lat, lng: pin.lng });
          }}
          onOpenPerson={(id) => {
            setSelected(id);
            openWin("person");
          }}
          onSignIn={() => openWin("signin")}
        />
      </FloatWindow>

      <FloatWindow
        title={`Events · ${data.events.length}`}
        state={visible("events") ? wins.events : { ...wins.events, open: false }}
        onChange={(n) => win("events", n)}
        onClose={() => win("events", { open: false })}
        onFocus={() => focus("events")}
        width={400}
      >
        <EventsPanel
          events={data.events}
          scopeName={data.scope.name}
          scopeSlug={data.scope.slug}
          canCreate={signedIn && onboarded}
          openSlug={activeEvent}
          onOpenSlug={setActiveEvent}
          onOpenPerson={(id) => {
            setSelected(id);
            openWin("person");
          }}
          onChanged={() => void load({})}
          onShow={(e: EventRef) => {
            if (e.lat != null && e.lng != null) {
              at.current = { lat: e.lat, lng: e.lng };
              void load({ lat: e.lat, lng: e.lng });
            }
          }}
        />
      </FloatWindow>

      <FloatWindow
        title={data.waiting > 0 ? `Chats · ${data.waiting} waiting` : "Chats"}
        state={visible("chats") ? wins.chats : { ...wins.chats, open: false }}
        onChange={(n) => win("chats", n)}
        onClose={() => win("chats", { open: false })}
        onFocus={() => focus("chats")}
      >
        <ChatsPanel
          signedIn={signedIn}
          openWith={chatWith}
          onOpened={() => setChatWith(null)}
          onChanged={() => void load({})}
        />
      </FloatWindow>

      {selectedPerson && (
        <FloatWindow
          title={selectedPerson.name}
          state={visible("person") ? wins.person : { ...wins.person, open: false }}
          onChange={(n) => win("person", n)}
          onClose={() => {
            win("person", { open: false });
            setSelected(null);
          }}
          onFocus={() => focus("person")}
        >
          <div className="min-h-0 flex-1 overflow-y-auto">
            <PersonProfile
              personId={selectedPerson.id}
              reason={data.matches.find((m) => m.id === selectedPerson.id)?.reason}
              twoWay={data.matches.find((m) => m.id === selectedPerson.id)?.twoWay}
            >
              <ReachOut
                key={selectedPerson.id}
                person={selectedPerson}
                signedIn={signedIn}
                onSignIn={() => openWin("signin")}
                onMessage={() => {
                  setChatWith(selectedPerson.id);
                  openWin("chats");
                }}
              />
              {ownsScope && data.scope.slug && (
                <MemberControls
                  key={`mc-${selectedPerson.id}`}
                  slug={data.scope.slug}
                  person={selectedPerson}
                  onChanged={(action) => {
                    void load({});
                    // A removed person has no profile left to look at; a
                    // newly verified one does, and closing it would hide
                    // the badge you just granted.
                    if (action === "remove") {
                      win("person", { open: false });
                      setSelected(null);
                    }
                  }}
                />
              )}
            </PersonProfile>
          </div>
        </FloatWindow>
      )}

      <FloatWindow
        title="Your profile"
        state={visible("profile") ? wins.profile : { ...wins.profile, open: false }}
        onChange={(n) => win("profile", n)}
        onClose={() => win("profile", { open: false })}
        onFocus={() => focus("profile")}
        width={440}
      >
        <ProfilePanel
          networks={data.networks}
          connections={data.connections}
          onSaved={() => void load({})}
          onOpenNetwork={(slug) => {
            win("profile", { open: false });
            switchNetwork(slug);
          }}
        />
      </FloatWindow>

      <FloatWindow
        title="Sign in"
        state={visible("signin") ? wins.signin : { ...wins.signin, open: false }}
        onChange={(n) => win("signin", n)}
        onClose={() => win("signin", { open: false })}
        onFocus={() => focus("signin")}
        width={340}
      >
        <SignInPanel
          onDone={async (wasOnboarded) => {
            if (pendingJoin) {
              // Best-effort: a failed join still leaves them signed in on
              // the map rather than stuck.
              await fetch(`/api/boards/${pendingJoin}/join`, { method: "POST" }).catch(() => {});
            }
            win("signin", { open: false });
            // Straight into the profile when there's nothing to match on
            // yet — the whole point of signing in.
            if (!wasOnboarded) openWin("profile");
            // Re-resolve the network from the URL. The first render happened
            // without a session, so `?net=` fell back to the open map —
            // membership couldn't be checked for somebody who wasn't signed
            // in yet. Signing in is exactly when that becomes answerable.
            const fromUrl = new URLSearchParams(window.location.search).get("net");
            void load({ net: pendingJoin ?? fromUrl ?? null });
          }}
        />
      </FloatWindow>

      <MapDock
        active={
          // On a phone only one sheet is on screen, so the dock should
          // highlight *that* one — or nothing, when the front sheet is the
          // profile. Otherwise it claims you're somewhere you aren't.
          narrow
            ? ((["home", "forYou", "feed", "people", "pins", "events", "chats"] as const).find((k) => k === frontId) ?? null)
            : ((["home", "forYou", "feed", "people", "pins", "events", "chats"] as const).find(
                (k) => wins[k].open && !wins[k].min
              ) ?? null)
        }
        counts={{
          forYou: matched.length,
          people: shown.length,
          pins: data.pins.length,
          events: data.events.length,
          chats: data.waiting,
        }}
        signedIn={signedIn}
        me={me}
        onSelect={openTab}
        onProfile={() => openWin(signedIn ? "profile" : "signin")}
      />

      {/* Members of a board who aren't on the public map get the one-tap
          way in, where the decision actually comes up. */}
      {signedIn && onboarded && !isOpenNet && myVisibility === "off" && (
        <PublicOptIn networkName={data.scope.name} onDone={() => void load({})} />
      )}

      {signedIn && onboarded && myVisibility === "off" && isOpenNet && <OffMapNudge />}
    </div>
  );
}

function ForYou({
  matched,
  loading,
  signedIn,
  onboarded,
  hasSignals,
  filtering,
  scopeName,
  onOpen,
  onSignIn,
  onProfile,
}: {
  matched: Array<{ match: { id: string; reason: string; twoWay: boolean }; person: MapProfile }>;
  loading: boolean;
  signedIn: boolean;
  onboarded: boolean;
  /** False when the viewer has stated no needs, offers or interests. */
  hasSignals: boolean;
  filtering: boolean;
  scopeName: string;
  onOpen: (id: string) => void;
  onSignIn: () => void;
  onProfile: () => void;
}) {
  if (!signedIn) {
    return (
      <PanelNote title="Sign in to get recommendations">
        The map is public. Who you should meet on it isn&rsquo;t — that needs to know what you&rsquo;re looking for.
        <button type="button" className="btn btn-primary btn-sm mt-3" onClick={onSignIn}>
          Sign in
        </button>
      </PanelNote>
    );
  }
  if (!onboarded) {
    return (
      <PanelNote title="Say what you're here for">
        Two questions — what you need, and what you can offer. Every recommendation is built from those.
        <button type="button" className="btn btn-primary btn-sm mt-3" onClick={onProfile}>
          Finish your profile
        </button>
      </PanelNote>
    );
  }
  if (loading) return <PanelNote title="Looking for people worth your time…" />;
  // Checked before the empty-result case: with nothing stated, the matcher
  // has nothing to run on, and "nobody here lines up with what you're
  // after" blames the room for a blank in your own profile.
  if (!hasSignals) {
    return (
      <PanelNote title="Tell us what you're looking for">
        Recommendations are built from what you need, what you can offer and what you&rsquo;re into. Without any of
        those there&rsquo;s nothing to match on — the People tab still shows everyone.
        <button type="button" className="btn btn-primary btn-sm mt-3" onClick={onProfile}>
          Add your signals
        </button>
      </PanelNote>
    );
  }
  if (matched.length === 0) {
    return (
      <PanelNote title={filtering ? "No matches inside those filters" : `No strong match on ${scopeName} yet`}>
        {filtering
          ? "Clear a filter or two — recommendations are narrowed by the same search as everything else."
          : "Nobody here has stated something that lines up with what you're after. The People tab is still worth a scroll."}
      </PanelNote>
    );
  }
  // Somebody standing in the room right now outranks a better-stated match
  // three suburbs away — proximity is the only thing this product has that
  // a directory doesn't, and a recommendation you can act on in the next
  // ten minutes is worth more than one you'll forget by tomorrow.
  const ordered = [...matched].sort(
    (a, b) => Number(Boolean(b.person.hereNow)) - Number(Boolean(a.person.hereNow))
  );
  const hereCount = ordered.filter((m) => m.person.hereNow).length;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <p className="mb-2.5 text-[12px] leading-[1.45] text-[var(--ink-soft)]">
        {ordered.length} {ordered.length === 1 ? "person" : "people"} worth your time on{" "}
        <span className="font-semibold text-[var(--ink)]">{scopeName}</span>
        {hereCount > 0 ? ` · ${hereCount} here right now` : ""}.
      </p>
      <div className="stagger flex flex-col gap-2.5">
        {ordered.map(({ match, person }, i) => (
          <PersonCard
            key={person.id}
            person={person}
            reason={match.reason}
            twoWay={match.twoWay}
            badge={
              // A list with no point of view is a list. One label, on the
              // one the matcher actually ranked first.
              i === 0 ? (
                <span
                  className="pill"
                  style={{
                    background: "color-mix(in srgb, var(--brand) 13%, transparent)",
                    color: "var(--brand)",
                  }}
                >
                  <IconSparkle size={10} /> {person.hereNow ? "Here now — start with them" : "Start with them"}
                </span>
              ) : undefined
            }
            onOpen={() => onOpen(person.id)}
          />
        ))}
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
  onSignIn,
  onMessage,
}: {
  person: MapProfile & { connectionStatus?: string | null };
  signedIn: boolean;
  onSignIn: () => void;
  /** Open this person's thread in Chats. */
  onMessage: () => void;
}) {
  const [note, setNote] = useState("");
  /**
   * Only what *this* session just did. The truth lives on the person, which
   * the server resolves on every payload — reading it into state on mount
   * meant opening a second profile in the same window kept the first one's
   * answer, and nothing ever corrected it.
   */
  const [justSent, setJustSent] = useState(false);
  // `attachConnectionStatus` says "connected"; this read "accepted", which
  // it never emits — so an established connection fell through to the
  // request form and offered to connect you to somebody you already knew.
  const state = justSent ? "pending" : (person.connectionStatus ?? "none");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!signedIn) {
    return (
      <div className="mt-2.5">
        <PanelNote title="Sign in to reach out">
          <button type="button" className="btn btn-primary btn-sm mt-3" onClick={onSignIn}>
            Sign in
          </button>
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
      setJustSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (state === "connected") {
    return (
      <div className="card mt-2.5 p-3.5">
        <p className="text-[13px] font-semibold">You&rsquo;re connected</p>
        {/* The whole point of connecting, one tap from the profile. Telling
            somebody their conversation "is in Chats" and leaving them to go
            find it is a navigation puzzle where a button belongs. */}
        <button type="button" className="btn btn-primary btn-sm mt-2.5 w-full" onClick={onMessage}>
          <IconChat size={13} /> Message {person.name.split(" ")[0]}
        </button>
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
