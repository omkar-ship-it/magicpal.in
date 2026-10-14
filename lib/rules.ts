/**
 * The proximity scale, from a room to a city.
 *
 * This is what lets one product serve three situations that look different
 * and aren't: a conference hall, a co-working floor, and an IT corridor are
 * the same question — who near me is worth talking to — asked at 50 metres,
 * 150 metres and 10 kilometres. Giving the distance a name rather than a
 * number is what makes that obvious to the person choosing.
 *
 * The two tightest steps need `needsLive`: a city centroid or a pin typed
 * last week cannot answer "who is in this room", so offering them without
 * live location would be a promise the data can't keep.
 */
export const PROXIMITY_STEPS = [
  { km: 0.05, label: "This room", needsLive: true },
  { km: 0.15, label: "This building", needsLive: true },
  { km: 2, label: "2 km" },
  { km: 5, label: "5 km" },
  { km: 10, label: "10 km" },
  { km: 25, label: "25 km" },
  { km: 50, label: "50 km" },
] as const;

export const RADIUS_OPTIONS_KM = PROXIMITY_STEPS.map((s) => s.km);
export const DEFAULT_RADIUS_KM = 25;

export function proximityLabel(km: number): string {
  return PROXIMITY_STEPS.find((s) => s.km === km)?.label ?? `${km} km`;
}
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

/**
 * How long a live position stays live without a refresh.
 *
 * Short on purpose. Nobody taps "stop sharing" — they close the tab — so
 * this number, not a user action, is what stops live location becoming a
 * permanent broadcast.
 */
export const LIVE_STALE_MINUTES = 12;

/** How often the browser pushes a new live position while sharing. */
export const LIVE_PING_MS = 90_000;

/**
 * Ad-hoc pins: how long one can live, and how much it can say.
 *
 * Here rather than in lib/pins.ts because that module imports the database:
 * a client component importing a *value* from it drags the Postgres driver
 * into the browser bundle and fails the build. Types are erased and can
 * come from anywhere; constants cannot.
 */
export const PIN_DURATIONS = [
  { minutes: 60, label: "1 hour" },
  { minutes: 180, label: "3 hours" },
  { minutes: 480, label: "Until tonight" },
] as const;

export const MAX_PIN_MESSAGE = 200;

/**
 * How far a pin carries — chosen by whoever drops it, not by whoever reads.
 *
 * `PROXIMITY_STEPS` above is a *viewer's* filter: "don't show me things far
 * away." This is the opposite direction and the stronger claim: "don't show
 * me to people far away." A desk on the 3rd floor and a café open to the
 * neighbourhood are different invitations, and only the person sitting there
 * knows which one they're making.
 *
 * `needsPrecise` is the honest consequence of a tight reach. A city centroid
 * cannot answer "is this person in my building", so a 150 m pin can only
 * ever reach people whose own position is precise — which is far fewer
 * people. Said out loud at the moment of choosing in `PinsPanel`, because
 * otherwise a tight pin looks broken rather than contained.
 */
export const PIN_REACHES = [
  { km: 0.15, label: "This building", needsPrecise: true },
  { km: 0.5, label: "500 m", needsPrecise: true },
  { km: 1, label: "1 km" },
  { km: 3, label: "3 km" },
  { km: 5, label: "5 km" },
  { km: 10, label: "10 km" },
] as const;

/** Walking distance. The whole premise is that somebody can come over now. */
export const DEFAULT_PIN_REACH_KM = 1;

/** Nothing carries further, so nothing beyond this is worth even loading. */
export const MAX_PIN_REACH_KM = Math.max(...PIN_REACHES.map((r) => r.km));

/** Widened on purpose: this is for validating arbitrary request input. */
export const PIN_REACH_OPTIONS_KM: readonly number[] = PIN_REACHES.map((r) => r.km);

export function pinReachLabel(km: number): string {
  return PIN_REACHES.find((r) => r.km === km)?.label ?? `${km} km`;
}

/** Whether a reach is tight enough to demand a precise position to match. */
export function reachNeedsPrecise(km: number): boolean {
  return PIN_REACHES.some((r) => r.km === km && "needsPrecise" in r && r.needsPrecise);
}

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
