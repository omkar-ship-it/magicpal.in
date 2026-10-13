import { boardBySlug, boardsForUser, childEvents, isLive, membershipOf, publicEvents } from "./boards";
import { getBoardMembers, getOpenMapProfiles, getProfileById, touchActivity, type MapProfile } from "./profiles";
import { matchesFor, type Surface } from "./matching";
import { attachConnectionStatus } from "./connections";
import { waitingCount } from "./messages";
import { DEFAULT_RADIUS_KM, MATCHES_SHOWN } from "./rules";

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
  place: string | null;
  lat: number | null;
  lng: number | null;
  startsAt: string | null;
  live: boolean;
  memberCount: number;
};

export type ShellPayload = {
  scope: { kind: "open" | "event" | "community"; slug: string | null; name: string; blurb: string | null };
  people: MapProfile[];
  matches: Array<{ id: string; reason: string; twoWay: boolean }>;
  events: EventRef[];
  networks: NetworkOption[];
  waiting: number;
  radiusKm: number;
  centre: { lat: number; lng: number } | null;
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
  const networks: NetworkOption[] = [
    OPEN_NETWORK,
    ...mine.map((b) => ({
      slug: b.slug,
      name: b.name,
      type: b.type as "event" | "community",
      memberCount: b.memberCount,
      live: isLive(b),
    })),
  ];

  const waiting = opts.userId ? await waitingCount(opts.userId) : 0;

  // ------------------------------------------------------------- board
  if (opts.scope.kind === "board") {
    const board = await boardBySlug(opts.scope.slug);
    const membership = board && opts.userId ? await membershipOf(board.id, opts.userId) : null;
    // Falling back rather than erroring: a stale `?net=` from a bookmark or
    // a board you left should land you on the open map, not a dead screen.
    if (board && membership) {
      const members = await getBoardMembers(board.id, {
        excludeUserId: opts.userId,
        centerLat: board.lat ?? undefined,
        centerLng: board.lng ?? undefined,
      });
      const surface = board.type as Surface;
      const matches =
        me?.name
          ? matchesFor({ id: me.id, lookingFor: me.lookingFor, canHelpWith: me.canHelpWith, interests: me.interests }, members, {
              surface,
              limit: MATCHES_SHOWN,
            }).map((m) => ({ id: m.other.id, reason: m.reason, twoWay: m.twoWay }))
          : [];

      const children = board.type === "community" ? await childEvents(board.id) : [];
      return {
        scope: {
          kind: board.type as "event" | "community",
          slug: board.slug,
          name: board.name,
          blurb: board.blurb,
        },
        people: members,
        matches,
        events: children.map((e) => ({
          slug: e.slug,
          name: e.name,
          place: e.place,
          lat: e.lat,
          lng: e.lng,
          startsAt: e.startsAt?.toISOString() ?? null,
          live: isLive(e),
          memberCount: 0,
        })),
        networks,
        waiting,
        radiusKm,
        centre: board.lat != null && board.lng != null ? { lat: board.lat, lng: board.lng } : null,
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

  const withStatus = (await attachConnectionStatus(people, opts.userId)) as MapProfile[];
  const events = await publicEvents();

  return {
    scope: { kind: "open", slug: null, name: "Open network", blurb: null },
    people: withStatus,
    matches,
    events: events.map((e) => ({
      slug: e.slug,
      name: e.name,
      place: e.place,
      lat: e.lat,
      lng: e.lng,
      startsAt: e.startsAt?.toISOString() ?? null,
      live: isLive(e),
      memberCount: 0,
    })),
    networks,
    waiting,
    radiusKm,
    centre,
  };
}

export function parseScope(net: string | null | undefined): ScopeRef {
  return net && net !== "open" ? { kind: "board", slug: net } : { kind: "open" };
}
