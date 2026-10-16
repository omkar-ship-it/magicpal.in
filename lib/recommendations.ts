import { and, eq, sql } from "drizzle-orm";
import { db, hasDb } from "./db";
import { recommendationState } from "./db/schema";
import { boardBySlug, liveBoardBySlug, membershipOf } from "./boards";
import { isActive } from "./membership";
import { cityLabel } from "./cityLabel";
import { distanceKm } from "./geo";
import { matchesFor } from "./matching";
import { getBoardMembers, getOpenMapProfiles, getProfileById, type MapProfile } from "./profiles";
import {
  DECK_SIZE,
  REACH_BY_ID,
  defaultReach,
  reachLabel,
  REACHES_FOR,
  type Reach,
} from "./rules";

/**
 * "For you" as something you run, not something you're handed.
 *
 * The shape borrows from search — visible controls, a live count, a run
 * button, "nothing found, try loosening" — and rejects what makes search
 * the wrong tool here. Search filters on attributes and more results feel
 * better. This scores a *relationship*, every card carries the reason it
 * was chosen, and fewer is better. The moment the output is a list without
 * reasons it has collapsed back into the People directory.
 *
 * Three layers, and they never cross:
 *
 *   scope  → who is eligible at all: this event, this community, or the
 *            open network. Reach can never widen past it.
 *   reach  → how far *within* that scope. "Anywhere" inside a community
 *            means every member with no distance filter, not everyone.
 *   criteria → what you want today. Seeded from your profile and
 *            overridable for one run, because editing your profile to
 *            change your results would change how everybody else sees you,
 *            permanently, for a need you have this afternoon.
 */

export type Audience =
  | { kind: "open" }
  | { kind: "community"; slug: string }
  | { kind: "event"; slug: string };

export type Criteria = {
  reach: Reach;
  lookingFor: string[];
  canHelpWith: string[];
  /** The highest-converting cohort: the exchange works both ways. */
  twoWayOnly: boolean;
  /** Off means "show me everyone again", including people I passed over. */
  skipSeen: boolean;
};

export type RunCard = {
  id: string;
  name: string;
  headline: string | null;
  company: string | null;
  photoUrl: string | null;
  locationLabel: string | null;
  placed: string;
  distanceKm: number | null;
  hereNow: boolean;
  verified: boolean;
  reason: string;
  twoWay: boolean;
};

export type RunResult = {
  deck: RunCard[];
  /** How many cleared the criteria, so depth is felt without being dumped. */
  total: number;
  /** How many the scope admits at all, before reach or criteria. */
  eligible: number;
  /** The query, in words. If it can't be said, it shouldn't be a control. */
  sentence: string;
  reaches: Reach[];
  /**
   * What was actually run — not what was asked for.
   *
   * The criteria are seeded from the viewer's profile when the request
   * leaves them out, so the panel has no way to draw its own controls
   * honestly without being told what the server settled on. Sending them
   * back is what stops the chips from showing an empty selection while the
   * run behind them was scored against a full profile.
   */
  criteria: Criteria;
  reach: Reach;
  /** Whether distance steps can be answered from where the viewer is. */
  canUseDistance: boolean;
  /** Why nothing came back, and the nearest loosening. */
  blocked: { line: string; widenTo: Reach | null } | null;
  /** Shown before and still not acted on — "who did I miss", as a residue. */
  followUp: RunCard[];
};

/** `open` | `board:<slug>` | `event:<slug>` — memory is per board. */
export function scopeKeyOf(a: Audience): string {
  return a.kind === "open" ? "open" : `${a.kind === "event" ? "event" : "board"}:${a.slug}`;
}

function audienceKind(a: Audience): "event" | "community" | "open" {
  return a.kind;
}

export async function runRecommendations(opts: {
  viewerId: string;
  audience: Audience;
  criteria?: Partial<Criteria>;
}): Promise<RunResult | null> {
  if (!hasDb || !db) return null;

  const me = await getProfileById(opts.viewerId);
  if (!me) return null;

  const kind = audienceKind(opts.audience);
  const reaches = REACHES_FOR[kind];
  const criteria: Criteria = {
    reach: opts.criteria?.reach && reaches.includes(opts.criteria.reach)
      ? opts.criteria.reach
      : defaultReach(kind),
    lookingFor: opts.criteria?.lookingFor ?? me.lookingFor ?? [],
    canHelpWith: opts.criteria?.canHelpWith ?? me.canHelpWith ?? [],
    twoWayOnly: opts.criteria?.twoWayOnly ?? false,
    skipSeen: opts.criteria?.skipSeen ?? true,
  };

  const scoped = await poolFor(opts.audience, opts.viewerId);
  if (scoped === null) return null;
  const eligible = scoped.length;

  // Distance is measured from the viewer's own position, and only answered
  // when that position is precise. A city centroid is not an imprecise
  // distance, it is an unknown one — the same rule pin reach applies.
  const myPos = ownPosition(me);
  const canUseDistance = Boolean(myPos) && (me.visibility === "exact" || me.visibility === "live");
  const myCity = cityLabel(me.locationLabel ?? me.baseLabel);

  const reached = scoped.filter((p) => withinReach(p, criteria.reach, { myPos, canUseDistance, myCity }));

  const memory = await loadState(opts.viewerId, scopeKeyOf(opts.audience));
  const skip = criteria.skipSeen
    ? [...memory.shown, ...memory.connected, ...memory.dismissed]
    : memory.connected;

  const asked = {
    id: me.id,
    lookingFor: criteria.lookingFor,
    canHelpWith: criteria.canHelpWith,
    interests: me.interests ?? [],
  };
  let all = matchesFor(asked, reached, { surface: "open", limit: 500, exclude: skip });
  if (criteria.twoWayOnly) all = all.filter((m) => m.twoWay);

  const deck = all.slice(0, DECK_SIZE);

  // Shown before, never acted on. Scored separately because the run above
  // deliberately excludes them: they are who the deck has moved past.
  const acted = new Set([...memory.connected, ...memory.dismissed]);
  const pending = memory.shown.filter((id) => !acted.has(id));
  const deckIds = new Set(deck.map((d) => d.other.id));
  const followUp = matchesFor(asked, reached.filter((p) => pending.includes(p.id)), {
    surface: "open",
    limit: 20,
  }).filter((m) => !deckIds.has(m.other.id));

  return {
    deck: deck.map(toCard),
    total: all.length,
    eligible,
    sentence: await sentenceFor(opts.audience, criteria, myCity),
    reaches,
    criteria,
    reach: criteria.reach,
    canUseDistance,
    blocked:
      all.length > 0
        ? null
        : diagnose(criteria, reaches, scoped, { myPos, canUseDistance, myCity }),
    followUp: followUp.map(toCard),
  };
}

/** Everyone the scope admits, before reach or criteria. Null = no access. */
async function poolFor(a: Audience, viewerId: string): Promise<MapProfile[] | null> {
  if (a.kind === "open") {
    return getOpenMapProfiles({ excludeUserId: viewerId, radiusKm: undefined });
  }
  // An event is its own pool — the people attending it, not the community
  // it hangs off. That is the whole point of running against an event.
  const board = await liveBoardBySlug(a.slug);
  if (!board) return null;
  if (!isActive(await membershipOf(board.id, viewerId))) return null;
  return getBoardMembers(board.id, { excludeUserId: viewerId });
}

type Here = {
  myPos: { lat: number; lng: number } | null;
  canUseDistance: boolean;
  myCity: string;
};

function withinReach(p: MapProfile & { hereNow?: boolean }, reach: Reach, here: Here): boolean {
  const step = REACH_BY_ID.get(reach);
  if (!step) return true;

  if (step.kind === "all") return true;

  // Gap 2: at an event, "in the room" is answered by checking in, not by
  // GPS. Indoor positioning cannot tell you which floor somebody is on,
  // and a check-in is a deliberate act that says they are actually here.
  if (step.kind === "presence") return Boolean(p.hereNow);

  if (step.kind === "city") return cityLabel(p.locationLabel) === here.myCity && here.myCity !== "";

  if (!here.canUseDistance || !here.myPos) return false;
  // Their end has to be precise too — a centroid can be twenty kilometres
  // from where somebody actually is.
  if (p.placed === "base") return false;
  const km = step.km;
  if (km == null) return true;
  return distanceKm(here.myPos.lat, here.myPos.lng, p.lat, p.lng) <= km;
}

function ownPosition(me: {
  lat: number | null;
  lng: number | null;
  baseLat: number | null;
  baseLng: number | null;
}): { lat: number; lng: number } | null {
  if (me.lat != null && me.lng != null) return { lat: me.lat, lng: me.lng };
  if (me.baseLat != null && me.baseLng != null) return { lat: me.baseLat, lng: me.baseLng };
  return null;
}

function toCard(m: { other: MapProfile & { hereNow?: boolean; verified?: boolean }; reason: string; twoWay: boolean }): RunCard {
  return {
    id: m.other.id,
    name: m.other.name,
    headline: m.other.headline,
    company: m.other.company,
    photoUrl: m.other.photoUrl,
    locationLabel: m.other.locationLabel,
    placed: m.other.placed,
    distanceKm: m.other.distanceKm,
    hereNow: Boolean(m.other.hereNow),
    verified: Boolean(m.other.verified),
    reason: m.reason,
    twoWay: m.twoWay,
  };
}

/** The query, said out loud above the results. */
async function sentenceFor(a: Audience, c: Criteria, myCity: string): Promise<string> {
  let who = "The open network";
  if (a.kind !== "open") {
    const board = await boardBySlug(a.slug);
    who = board?.name ?? "This board";
  }
  const step = REACH_BY_ID.get(c.reach);
  const where =
    step?.kind === "presence"
      ? "here right now"
      : c.reach === "roster"
        ? "everyone attending"
        : c.reach === "anywhere"
          ? "anywhere"
          : c.reach === "city"
            ? `in ${myCity || "my city"}`
            : `within ${step?.km} km`;
  const two = c.twoWayOnly ? ", both ways only" : "";
  return `${who} · ${where}${two}`;
}

/**
 * Name what's blocking, and offer the nearest loosening.
 *
 * With six controls people will filter to nothing and blame the product.
 * Turning the dead end into the next run is the whole loop.
 */
function diagnose(
  c: Criteria,
  reaches: Reach[],
  scoped: Array<MapProfile & { hereNow?: boolean }>,
  here: Here
): RunResult["blocked"] {
  // The ladder is narrowest-first, so the next rung is always the loosening.
  const at = reaches.indexOf(c.reach);
  const wider = at >= 0 && at < reaches.length - 1 ? reaches[at + 1] : null;

  // Said before anything about criteria: an empty board is not a failed
  // query, and telling somebody to ask for less when there is nobody to
  // ask is the product blaming them for being early.
  if (scoped.length === 0) {
    return { line: "Nobody else is on this board yet.", widenTo: null };
  }
  if (REACH_BY_ID.get(c.reach)?.kind === "distance" && !here.canUseDistance) {
    return { line: "Share your location to search by distance.", widenTo: "city" };
  }
  // Presence has its own answer, because the fix isn't a wider radius — it
  // is that nobody has walked in yet, and naming the mechanism is what
  // makes the room fill.
  if (REACH_BY_ID.get(c.reach)?.kind === "presence" && !scoped.some((p) => p.hereNow)) {
    return {
      line: "Nobody has checked in yet. Checking in is what says you're actually in the room.",
      widenTo: reaches.includes("roster") ? "roster" : wider,
    };
  }
  if (wider) {
    const n = scoped.filter((p) => withinReach(p, wider, here)).length;
    if (n > 0) {
      return { line: `Nobody matches. ${n} more if you widen to “${reachLabel(wider)}”.`, widenTo: wider };
    }
  }
  if (c.twoWayOnly) return { line: "No two-way matches at this reach. Try allowing one-way help.", widenTo: null };
  if (c.lookingFor.length > 0) {
    return { line: "Nothing matches what you asked for. Try fewer things, or a wider reach.", widenTo: wider };
  }
  return { line: "Nobody here yet. This gets better as the board fills.", widenTo: wider };
}

/* ------------------------------------------------------------- memory */

type Memory = { shown: string[]; connected: string[]; dismissed: string[] };

export async function loadState(userId: string, scopeKey: string): Promise<Memory> {
  if (!hasDb || !db) return { shown: [], connected: [], dismissed: [] };
  const rows = await db
    .select({ subjectId: recommendationState.subjectId, state: recommendationState.state })
    .from(recommendationState)
    .where(and(eq(recommendationState.userId, userId), eq(recommendationState.scopeKey, scopeKey)));

  const out: Memory = { shown: [], connected: [], dismissed: [] };
  for (const r of rows) {
    if (r.state === "connected") out.connected.push(r.subjectId);
    else if (r.state === "dismissed") out.dismissed.push(r.subjectId);
    else out.shown.push(r.subjectId);
  }
  return out;
}

/**
 * Record what happened to somebody in this scope.
 *
 * `shown` never overwrites a decision: being re-rendered after you
 * dismissed somebody must not quietly un-dismiss them.
 */
export async function markState(
  userId: string,
  scopeKey: string,
  subjectIds: string[],
  state: "shown" | "connected" | "dismissed"
): Promise<void> {
  if (!hasDb || !db || subjectIds.length === 0) return;
  await db
    .insert(recommendationState)
    .values(subjectIds.map((subjectId) => ({ userId, scopeKey, subjectId, state })))
    .onConflictDoUpdate({
      target: [recommendationState.userId, recommendationState.scopeKey, recommendationState.subjectId],
      set: { state, updatedAt: new Date() },
      where:
        state === "shown"
          ? sql`${recommendationState.state} = 'shown'`
          : undefined,
    });
}

/** Start a board over — the only way back to people you dismissed. */
export async function forgetScope(userId: string, scopeKey: string): Promise<void> {
  if (!hasDb || !db) return;
  await db
    .delete(recommendationState)
    .where(and(eq(recommendationState.userId, userId), eq(recommendationState.scopeKey, scopeKey)));
}
