export const RADIUS_OPTIONS_KM = [5, 10, 25, 50, 100] as const;
export const DEFAULT_RADIUS_KM = 25;
export const MAX_SKILLS = 8;
export const MAX_MAP_RESULTS = 200;

/**
 * How many topics one person may claim on each side.
 *
 * A cap, not a nicety: somebody who ticks every box is indistinguishable
 * from somebody who ticks none, and they crowd out people with a real
 * stated need. Four is enough to describe why you came and few enough that
 * choosing costs something.
 */
export const MAX_TOPICS = 4;

/**
 * Interests get a slightly looser cap than needs.
 *
 * Claiming four things you need is a stretch; being into five sectors is
 * ordinary, and over-claiming here costs much less because interests are a
 * symmetric signal rather than a promise to anybody.
 */
export const MAX_INTERESTS = 5;

/** How many recommendations a surface shows at once. */
export const MATCHES_SHOWN = 3;

/** How recently a heartbeat has to have landed to count as "active now" on the map. */
export const ACTIVE_WINDOW_MINUTES = 20;
/** How often the client pings the heartbeat endpoint while a page is open. */
export const HEARTBEAT_INTERVAL_MS = 60_000;

/**
 * Bumped whenever the words shown beside a location choice change, so a
 * consent row records which version of the explanation the person actually
 * agreed to. Never reuse a version after editing the copy.
 */
export const CONSENT_COPY_VERSION = "2026-10-12.1";

/** A connection has exactly one open request between two people at a time. */
export type ConnectionStatus = "pending" | "accepted" | "declined";

/** The pair in the fixed order the `connections` table's check constraint requires. */
export function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}
