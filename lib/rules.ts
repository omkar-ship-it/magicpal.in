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

/**
 * The four things you can say about a post without writing anything.
 *
 * Closed, and deliberately not a generic "like": each one says something
 * different about *why* a post mattered, which is information a founder
 * reading their own community's feed can actually act on. Free-form emoji
 * would be friendlier and would tell them nothing.
 */
export const REACTIONS = [
  { id: "clap", emoji: "👏", label: "Nice one" },
  { id: "useful", emoji: "💡", label: "Useful" },
  { id: "congrats", emoji: "🎉", label: "Congrats" },
  { id: "love", emoji: "❤️", label: "Love this" },
] as const;

export type ReactionId = (typeof REACTIONS)[number]["id"];

/** Widened for validating request input against the closed set. */
export const REACTION_IDS: readonly string[] = REACTIONS.map((r) => r.id);

export const MAX_COMMENT_LENGTH = 600;

/** Replies shown under a post before it asks you to open the rest. */
export const COMMENTS_PREVIEWED = 2;

/**
 * Proximity alerts: what you can ask to be told about.
 *
 * Three cases, because they are three different appetites. Somebody who
 * wants to know a friend is in town may well not want to hear about
 * strangers, and the reverse is just as common — collapsing them into one
 * switch makes the cautious answer to either one a no to both.
 */
export const ALERT_KINDS = [
  {
    id: "connection_nearby",
    pref: "notifyConnections",
    label: "People I'm connected to",
    detail: "When somebody you already know turns up near you.",
  },
  {
    id: "match_nearby",
    pref: "notifyMatches",
    label: "People who can help, or who I can help",
    detail: "When what they're offering meets what you're looking for — or the other way round.",
  },
  {
    id: "interest_nearby",
    pref: "notifyInterests",
    label: "People into the same things",
    detail: "Shared sectors only. The loosest signal, so the noisiest — off unless you ask for it.",
  },
] as const;

/**
 * `crowd_nearby` is not a preference — it is how a *match* alert is
 * delivered when the place is busy. Somebody who asked to hear about
 * people worth meeting has not asked a different question just because
 * twenty of them are in one room.
 */
export type AlertKind = (typeof ALERT_KINDS)[number]["id"] | "crowd_nearby";

/** How near counts as near. The default is a walk, not a drive. */
export const ALERT_RADII = [1, 2, 5, 10, 25] as const;
/** Widened, because this validates arbitrary request input. */
export const ALERT_RADIUS_OPTIONS_KM: readonly number[] = ALERT_RADII;
export const DEFAULT_ALERT_RADIUS_KM = 5;

/**
 * Noise control, and the whole feature lives or dies on it.
 *
 * A proximity alert that fires too often gets muted once and is never
 * unmuted, so these are deliberately conservative: the same person can't
 * resurface for a fortnight, and nobody gets more than a handful a day.
 */
export const ALERT_REPEAT_DAYS = 14;
export const ALERT_DAILY_CAP = 5;

/**
 * When a place stops being a list of people and becomes a crowd.
 *
 * Measured in a 200-person mixer: with per-person alerts, twenty-five
 * arrivals filled every single attendee's daily budget with five arbitrary
 * pings — whoever the scan happened to reach first, not whoever was worth
 * meeting — and the room's remaining one hundred and seventy-five arrivals
 * produced nothing but silence and wasted work.
 *
 * Above this many matches in one sweep, the right notification is about the
 * room rather than about each person in it.
 */
export const ALERT_CROWD_THRESHOLD = 3;

/**
 * How long one crowd notice stands for a place.
 *
 * People trickle into a venue over hours. Without this, every arrival would
 * be a fresh interruption about the same room. Inside the window the
 * existing notice's count climbs instead and nothing new is sent.
 */
export const ALERT_CROWD_COOLDOWN_HOURS = 3;

/**
 * How tight a cluster has to be to count as one place.
 *
 * 300 m is a venue and its pavement — a co-working floor, a conference
 * hall, a mixer and the bar next door. Wider than this and "everyone here"
 * stops meaning anything somebody could act on.
 */
export const CROWD_CLUSTER_KM = 0.3;

/** Don't re-scan the neighbourhood on every 90-second heartbeat. */
export const ALERT_SCAN_EVERY_MINUTES = 15;

/**
 * A city-level position can't support a street-level claim.
 *
 * Somebody publishing only their city may still trigger "is in your city",
 * but never "600 m away" — so their alerts are capped at a radius where
 * the coarse number is honest.
 */
export const ALERT_CITY_RADIUS_KM = 25;

/** How many alerts the inbox shows at once. */
export const ALERTS_SHOWN = 40;

/** How many recommendations a surface shows at once. */
export const MATCHES_SHOWN = 3;

/**
 * How far a recommendation run reaches — named steps, never a slider.
 *
 * A slider invites dragging with no feedback: nobody knows whether 3.4 km
 * is a better answer than 2.8 km, so they fiddle and learn nothing. Naming
 * the distances is what makes the choice decidable.
 *
 * Three different queries wear one label here, and the user should never
 * have to care which. `distance` is a radius. `city` is an administrative
 * question — 500 km from Hyderabad reaches Chennai and not Delhi, so a
 * radius is simply the wrong shape for it. `presence` is neither: at an
 * event, who is *in the room* is answered by checking in, not by GPS,
 * because indoor positioning cannot tell you which floor somebody is on.
 */
export const REACH_STEPS = [
  { id: "here", label: "Here right now", kind: "presence", km: null },
  { id: "roster", label: "Everyone attending", kind: "all", km: null },
  { id: "km1", label: "Within 1 km", kind: "distance", km: 1 },
  { id: "km2", label: "Within 2 km", kind: "distance", km: 2 },
  { id: "km5", label: "Within 5 km", kind: "distance", km: 5 },
  { id: "km10", label: "Within 10 km", kind: "distance", km: 10 },
  { id: "city", label: "My city", kind: "city", km: null },
  { id: "anywhere", label: "Anywhere", kind: "all", km: null },
] as const;

export type Reach = (typeof REACH_STEPS)[number]["id"];

export const REACH_BY_ID = new Map(REACH_STEPS.map((r) => [r.id as Reach, r]));

export function reachLabel(r: Reach): string {
  return REACH_BY_ID.get(r)?.label ?? String(r);
}

/** A distance step can't be answered from a city centroid — see `place()`. */
export function reachNeedsPosition(r: Reach): boolean {
  return REACH_BY_ID.get(r)?.kind === "distance";
}

/**
 * The ladder's length depends on the audience, because the value of a
 * match decays with distance at completely different rates.
 *
 * An event is one room, so it asks about presence rather than metres. A
 * community is bound by identity rather than proximity — a fellow alum in
 * Singapore is genuinely useful — so it runs all the way out. The open
 * network has no bond except stated intent, so proximity is the only thing
 * that makes a match actionable and it stops at the city.
 *
 * "My country" is missing on purpose: profiles store a place *label* and
 * no region, so the query can't be answered honestly yet.
 */
/**
 * Every ladder runs narrowest first, which is what lets a dead end offer
 * the next rung up without checking which direction it is going. An event's
 * two rungs look backwards next to the others — presence is tighter than
 * the roster, not looser — and reading them as a widening order is exactly
 * how "nobody is here yet" would offer to narrow further.
 */
export const REACHES_FOR: Record<"event" | "community" | "open", Reach[]> = {
  event: ["here", "roster"],
  community: ["km1", "km2", "km5", "km10", "city", "anywhere"],
  open: ["km1", "km2", "km5", "km10", "city"],
};

export function defaultReach(kind: "event" | "community" | "open"): Reach {
  // Not `here` for an event: before and after one nobody is checked in, so
  // defaulting to presence would open on an empty deck.
  if (kind === "event") return "roster";
  // A community opens at the bond, not at a radius. Every location filter
  // drops members who publish no location at all — exactly the people a
  // private board exists to serve — so starting at "my city" would quietly
  // hide half the roster from itself. Narrowing is a choice the reader
  // makes; it is not a default worth having.
  if (kind === "community") return "anywhere";
  return "km5";
}

/** Five at a time, however many qualified — a deck, not a directory. */
export const DECK_SIZE = 5;

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
