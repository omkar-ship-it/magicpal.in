import { boardById, boardsForUser, childEvents, isLive, liveBoardBySlug, membershipOf, publicEvents, rsvpSummary, type Board } from "./boards";
import { isActive } from "./membership";
import { attachVouches } from "./vouch";
import { getBoardMembers, getOpenMapProfiles, getProfileById, touchActivity, type MapProfile } from "./profiles";
import { matchesFor, type Surface } from "./matching";
import { attachConnectionStatus } from "./connections";
import { waitingCount } from "./messages";
import { listAcceptedConnections } from "./connections";
import { livePinsFor, myLivePin, type PinRef } from "./pins";
import { DEFAULT_RADIUS_KM, MATCHES_SHOWN, MAX_PIN_REACH_KM } from "./rules";

/**
 * One scoped payload for the whole app shell.
 *
 * The network switcher is the reason this exists: every surface in the dock
 * — recommendations, people, events, the feed — answers the same question
 * about a different set of people, so they have to be assembled from one
 * resolved scope or they will disagree with each other and with the map.
 *
 * Chats are deliberately *not* scoped. A conversation belongs to the two
 * people in it, not to the board they happened to meet on, and hiding one
 * because you switched networks would lose messages people are waiting on.
 */

export type ScopeRef = { kind: "open" } | { kind: "board"; slug: string };

export type NetworkOption = {
  slug: string | null;
  name: string;
  type: "open" | "event" | "community";
  memberCount: number;
  live: boolean;
};

export type EventRef = {
  slug: string;
  name: string;
  blurb: string | null;
  details: string | null;
  place: string | null;
  address: string | null;
  url: string | null;
  capacity: number | null;
  lat: number | null;
  lng: number | null;
  startsAt: string | null;
  endsAt: string | null;
  live: boolean;
  memberCount: number;
  going: number;
  myRsvp: string | null;
  /** Only the host sees the edit affordance. */
  isHost: boolean;
};

/**
 * The viewer's own marker.
 *
 * Every map product shows you yourself, and this one has a specific reason
 * to: visibility is the product's central promise, and the only way to
 * check that your setting does what you think is to see where — and
 * whether — you appear. A map that hides you reads as broken even when it
 * is working.
 */
export type SelfMarker = {
  id: string;
  name: string;
  photoUrl: string | null;
  lat: number;
  lng: number;
  placed: "exact" | "base";
  /** `off` still draws, muted: it's your own screen, and it answers the question. */
  visibility: "off" | "base" | "exact" | "live";
};

/**
 * A person as the shell hands them out.
 *
 * `verified` is the community owner's vouch and only means anything inside
 * a community — on the open map nobody is in a position to make the claim,
 * so it is simply absent there rather than false.
 */
export type ShellPerson = MapProfile & {
  hereNow?: boolean;
  unplaced?: boolean;
  /**
   * A community you *both* belong to has vouched for them.
   *
   * Viewer-relative on purpose, and the same meaning on every surface: a
   * tick from a group you've never heard of would be an assertion from
   * nobody, and would make the badge farmable. See lib/vouch.
   */
  verified?: boolean;
  /** This board's own claim — what the owner manages, not what others see. */
  verifiedHere?: boolean;
  role?: string;
};

export type ShellPayload = {
  scope: {
    kind: "open" | "event" | "community";
    slug: string | null;
    name: string;
    blurb: string | null;
    /** Everything the community's own home needs. Null on the open map. */
    home: {
      place: string | null;
      hostName: string;
      memberCount: number;
      eventCount: number;
      createdAt: string;
      isHost: boolean;
      hereNow: number;
      /** What the community is for. */
      details: string | null;
      /** The terms of being in it. */
      guidelines: string | null;
      verifiedCount: number;
      /** The owner can't leave — there'd be nobody left to run it. */
      canLeave: boolean;
    } | null;
  };
  people: ShellPerson[];
  matches: Array<{ id: string; reason: string; twoWay: boolean }>;
  events: EventRef[];
  networks: NetworkOption[];
  waiting: number;
  radiusKm: number;
  centre: { lat: number; lng: number } | null;
  you: SelfMarker | null;
  /** Whether the viewer has given the matcher anything to work with. */
  hasSignals: boolean;
  /** Accepted connections — the product's one real conversion metric. */
  connections: number;
  /** Ad-hoc "here now" markers, visible in every scope. */
  pins: PinRef[];
  myPinId: string | null;
};

export const OPEN_NETWORK: NetworkOption = {
  slug: null,
  name: "Open network",
  type: "open",
  memberCount: 0,
  live: false,
};

export async function shellPayload(opts: {
  userId?: string;
  scope: ScopeRef;
  lat?: number;
  lng?: number;
  radiusKm?: number;
}): Promise<ShellPayload> {
  const radiusKm = opts.radiusKm ?? DEFAULT_RADIUS_KM;
  const me = opts.userId ? await getProfileById(opts.userId) : null;
  if (opts.userId) await touchActivity(opts.userId);

  // The switcher only ever lists boards you belong to, plus the open
  // network. It is a view switcher, not a directory of other people's
  // private groups.
  const mine = opts.userId ? await boardsForUser(opts.userId) : [];
  // Communities only. An event is something that happens *inside* a
  // community, not a network you belong to — listing both made the switcher
  // a pile of one-evening entries that never go away, and gave a host two
  // different things to create when they only ever meant one.
  const networks: NetworkOption[] = [
    OPEN_NETWORK,
    ...mine
      .filter((b) => b.type === "community")
      .map((b) => ({
        slug: b.slug,
        name: b.name,
        type: "community" as const,
        memberCount: b.memberCount,
        live: false,
      })),
  ];

  const waiting = opts.userId ? await waitingCount(opts.userId) : 0;
  const connections = opts.userId ? (await listAcceptedConnections(opts.userId)).length : 0;
  const mine_pin = opts.userId ? await myLivePin(opts.userId) : null;

  // Drawn from the row directly rather than through place(), which exists to
  // decide what *other* people may see. You always get your real position,
  // including when you're off the map — that's the point of showing it.
  const you: SelfMarker | null =
    me?.name && (me.lat != null || me.baseLat != null)
      ? {
          id: me.id,
          name: me.name,
          photoUrl: me.photoUrl,
          lat: me.visibility === "base" ? (me.baseLat ?? me.lat!) : (me.lat ?? me.baseLat!),
          lng: me.visibility === "base" ? (me.baseLng ?? me.lng!) : (me.lng ?? me.baseLng!),
          placed: me.visibility === "base" ? "base" : "exact",
          visibility: (me.visibility as SelfMarker["visibility"]) ?? "off",
        }
      : null;

  const hasSignals = Boolean(
    me && ((me.lookingFor?.length ?? 0) > 0 || (me.canHelpWith?.length ?? 0) > 0 || (me.interests?.length ?? 0) > 0)
  );

  // ------------------------------------------------------------- board
  if (opts.scope.kind === "board") {
    let board = await liveBoardBySlug(opts.scope.slug);
    // An event slug selects its community: the network is the community, and
    // the event itself is shown on the map and in the Events window.
    if (board?.type === "event" && board.parentBoardId) {
      board = (await boardById(board.parentBoardId)) ?? board;
    }
    const membership = board && opts.userId ? await membershipOf(board.id, opts.userId) : null;
    // Falling back rather than erroring: a stale `?net=` from a bookmark, a
    // board you left, or one you were removed from should land you on the
    // open map rather than a dead screen — and, for the removal case, must
    // not hand back the community's people either.
    if (board && isActive(membership)) {
      const rawMembers = await getBoardMembers(board.id, {
        excludeUserId: opts.userId,
        centerLat: board.lat ?? undefined,
        centerLng: board.lng ?? undefined,
      });
      // Attached here too, not only on the open map. Without it every face
      // inside a community offered "Ask to connect" however long ago you
      // actually connected — the request had already been sent and accepted
      // and the UI had no idea.
      const withStatusHere = (await attachConnectionStatus(rawMembers, opts.userId)) as typeof rawMembers;
      const members = await attachVouches(withStatusHere, opts.userId);
      const surface = board.type as Surface;
      const matches =
        me?.name
          ? matchesFor({ id: me.id, lookingFor: me.lookingFor, canHelpWith: me.canHelpWith, interests: me.interests }, members, {
              surface,
              limit: MATCHES_SHOWN,
            }).map((m) => ({ id: m.other.id, reason: m.reason, twoWay: m.twoWay }))
          : [];

      const children = board.type === "community" ? await childEvents(board.id) : [];
      const host = await getProfileById(board.hostUserId);
      return {
        scope: {
          kind: board.type as "event" | "community",
          slug: board.slug,
          name: board.name,
          blurb: board.blurb,
          home: {
            place: board.place,
            hostName: host?.name ?? "a member",
            memberCount: members.length + 1,
            eventCount: children.length,
            createdAt: board.createdAt.toISOString(),
            isHost: board.hostUserId === opts.userId,
            hereNow: members.filter((m) => m.hereNow).length,
            details: board.details,
            guidelines: board.guidelines,
            verifiedCount: members.filter((m) => m.verifiedHere).length,
            canLeave: Boolean(opts.userId) && board.hostUserId !== opts.userId,
          },
        },
        people: members,
        matches,
        events: await toEventRefs(children, opts.userId),
        networks,
        waiting,
        radiusKm,
        centre: board.lat != null && board.lng != null ? { lat: board.lat, lng: board.lng } : null,
        you,
        hasSignals,
        connections,
        // Pins aren't scoped to the network: somebody in a café two streets
        // away is worth knowing about whichever community you're looking at.
        pins: await livePinsFor({
          viewerId: opts.userId,
          centerLat: board.lat ?? undefined,
          centerLng: board.lng ?? undefined,
        }),
        myPinId: mine_pin?.id ?? null,
      };
    }
  }

  // -------------------------------------------------------- open network
  const centre =
    opts.lat != null && opts.lng != null
      ? { lat: opts.lat, lng: opts.lng }
      : me?.lat != null && me?.lng != null
        ? { lat: me.lat, lng: me.lng }
        : me?.baseLat != null && me?.baseLng != null
          ? { lat: me.baseLat, lng: me.baseLng }
          : { lat: 17.4065, lng: 78.4772 };

  const people = await getOpenMapProfiles({
    excludeUserId: opts.userId,
    centerLat: centre.lat,
    centerLng: centre.lng,
    radiusKm,
  });

  const matches = me?.name
    ? matchesFor({ id: me.id, lookingFor: me.lookingFor, canHelpWith: me.canHelpWith, interests: me.interests }, people, {
        surface: "open",
        limit: MATCHES_SHOWN,
      }).map((m) => ({ id: m.other.id, reason: m.reason, twoWay: m.twoWay }))
    : [];

  const withStatus = await attachVouches(
    (await attachConnectionStatus(people, opts.userId)) as MapProfile[],
    opts.userId
  );
  const events = await publicEvents();

  return {
    scope: { kind: "open", slug: null, name: "Open network", blurb: null, home: null },
    people: withStatus,
    matches,
    events: await toEventRefs(events, opts.userId),
    networks,
    waiting,
    radiusKm,
    centre,
    you,
    hasSignals,
    connections,
    // Deliberately not narrowed by the people-radius. Each pin already
    // carries its own reach, enforced in livePinsFor against where you
    // actually are, and that is the limit that matters — someone browsing
    // "this room" for people still wants to hear about a café two streets
    // away. The floor keeps the viewer's filter from double-counting.
    pins: await livePinsFor({
      viewerId: opts.userId,
      centerLat: centre.lat,
      centerLng: centre.lng,
      radiusKm: Math.max(radiusKm, MAX_PIN_REACH_KM),
    }),
    myPinId: mine_pin?.id ?? null,
  };
}

/**
 * Board rows → what the Events window needs, RSVP tallies included.
 *
 * Counted per event rather than in one grouped query: an event list is a
 * handful of rows, and a correct join here would be harder to read than the
 * loop it replaces. Worth revisiting if a community ever has hundreds.
 */
async function toEventRefs(rows: Board[], viewerId?: string): Promise<EventRef[]> {
  return Promise.all(
    rows.map(async (e) => {
      const rsvp = await rsvpSummary(e.id, viewerId);
      return {
        slug: e.slug,
        name: e.name,
        blurb: e.blurb,
        details: e.details,
        place: e.place,
        address: e.address,
        url: e.url,
        capacity: e.capacity,
        lat: e.lat,
        lng: e.lng,
        startsAt: e.startsAt?.toISOString() ?? null,
        endsAt: e.endsAt?.toISOString() ?? null,
        live: isLive(e),
        memberCount: 0,
        going: rsvp.going,
        myRsvp: rsvp.mine,
        isHost: Boolean(viewerId && e.hostUserId === viewerId),
      };
    })
  );
}

export function parseScope(net: string | null | undefined): ScopeRef {
  return net && net !== "open" ? { kind: "board", slug: net } : { kind: "open" };
}
