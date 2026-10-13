import { describeOverlap, isTwoWay, overlaps, sharedInterests, type Overlap } from "./intents";
import type { MapProfile } from "./profiles";

/**
 * One matcher, three surfaces.
 *
 * The engine is the same function everywhere because the question is the
 * same everywhere — who here is worth your next twenty minutes. What
 * changes between an event, a community and the open map is only what
 * "here" means, and how much being physically close counts for:
 *
 *   event     — the pool is one room, and presence dominates. A perfect
 *               match who left an hour ago is worth less than a decent one
 *               standing by the coffee, because the entire value is that
 *               you can walk over right now.
 *   community — the pool is the membership, and proximity is a mild bonus.
 *               An alumni network's value is that the right person exists
 *               at all; which city they're in decides whether it's a coffee
 *               or a call, not whether it's worth doing.
 *   open      — the pool is a radius, and distance decays smoothly. Nothing
 *               vouches for anybody here, so overlap has to carry it.
 *
 * No score is ever rendered. A number invites arithmetic about strangers
 * and loses every argument with the reader's own judgement; the sentence
 * from describeOverlap() is what the UI shows, and it is checkable against
 * the profile right next to it.
 */

export type Surface = "event" | "community" | "open";

export type Match = {
  other: MapProfile;
  /** Internal only — ordering, never display. */
  score: number;
  overlaps: Overlap[];
  /** The fallback sentence. A cached model-written one supersedes it. */
  reason: string;
  /** Each has something the other asked for. Worth badging; it's rare. */
  twoWay: boolean;
};

/** A need met is worth more than a favour offered — it's the reason you'd go over. */
const DIRECTION_WEIGHT: Record<Overlap["direction"], number> = {
  "mine-wants-theirs": 3,
  mutual: 3,
  "theirs-wants-mine": 2,
};

/** Both directions present is a trade, not a coincidence. Worth more than its parts. */
const TWO_WAY_BONUS = 3;

/**
 * A shared sector, per sector, capped at two.
 *
 * Deliberately below a complementary need (3): wanting the same things is
 * weaker evidence than one person having what the other asked for. But it
 * is far from nothing, and it is the only signal that reaches the large
 * middle of any room — people whose needs simply don't interlock.
 */
const INTEREST_WEIGHT = 1.4;

/**
 * Diminishing returns past the first two overlaps.
 *
 * Someone who ticked nine boxes is not nine times more relevant — they are
 * usually just someone who ticked nine boxes. Without this, the ranking
 * rewards over-claiming, which is the one behaviour that would wreck the
 * matcher's credibility fastest.
 */
function overlapScore(list: Overlap[]): number {
  return list.reduce((sum, o, i) => sum + DIRECTION_WEIGHT[o.direction] / (1 + i * 0.6), 0);
}

function proximityScore(surface: Surface, other: MapProfile): number {
  if (surface === "event") {
    // Deliberately large enough to outrank a whole extra overlap. In a
    // venue, "is in the building" is not a tiebreaker, it's the premise.
    return other.hereNow ? 5 : 0;
  }
  const km = other.distanceKm;
  if (km == null) return 0;
  if (surface === "community") return km <= 25 ? 2 : km <= 150 ? 1 : 0;
  // Open map: smooth decay, ~2.0 next door easing to ~0 past 50km, so a
  // strong match two suburbs away still beats a weak one on the doorstep.
  return 2 / (1 + km / 12);
}

/**
 * Rank a pool against one person.
 *
 * Pure and synchronous: the whole computation is set intersections over
 * arrays that are already in memory, which is what lets it run on every
 * request rather than behind a job queue, and lets a board of 500 people
 * rank in well under a millisecond.
 */
export function matchesFor(
  me: { id: string; lookingFor: readonly string[]; canHelpWith: readonly string[]; interests?: readonly string[] },
  pool: readonly MapProfile[],
  opts: { surface: Surface; limit?: number; exclude?: readonly string[] } = { surface: "open" }
): Match[] {
  const limit = opts.limit ?? 3;
  const excluded = new Set([me.id, ...(opts.exclude ?? [])]);

  const scored: Match[] = [];
  for (const other of pool) {
    if (excluded.has(other.id)) continue;
    const list = overlaps(me, other);
    const base = overlapScore(list);
    const two = isTwoWay(list);
    const shared = sharedInterests(me.interests ?? [], other.interests);
    const affinity = Math.min(shared.length, 2) * INTEREST_WEIGHT;
    // Someone with nothing in common is not a match at any distance — the
    // open map would otherwise recommend the nearest stranger, which is
    // exactly the uselessness this product exists to replace. A shared
    // sector counts as something in common.
    if (base === 0 && affinity === 0 && opts.surface !== "event") continue;
    const score =
      base +
      affinity +
      (two ? TWO_WAY_BONUS : 0) +
      proximityScore(opts.surface, other) +
      (other.active ? 0.4 : 0);
    scored.push({
      other,
      score,
      overlaps: list,
      reason: describeOverlap(list, firstName(other.name), other, shared),
      twoWay: two,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return diversify(scored, limit);
}

/**
 * Take the best, then the best that isn't about the same thing.
 *
 * Straight top-N collapses: the moment someone ticks "raising", every
 * investor on the board outranks everyone else, and three near-identical
 * cards is a worse set of options than one investor plus two different
 * kinds of useful. Only once every topic is represented does it fall back
 * to filling by score.
 */
function diversify(ranked: Match[], limit: number): Match[] {
  const out: Match[] = [];
  const usedTopics = new Set<string>();

  for (const m of ranked) {
    if (out.length >= limit) break;
    const lead = m.overlaps[0]?.topic.id;
    if (lead && usedTopics.has(lead)) continue;
    out.push(m);
    if (lead) usedTopics.add(lead);
  }
  for (const m of ranked) {
    if (out.length >= limit) break;
    if (!out.includes(m)) out.push(m);
  }
  return out;
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/** Canonical pair order, matching the matches/connections unique indexes. */
export function pairKey(a: string, b: string): { userAId: string; userBId: string } {
  return a < b ? { userAId: a, userBId: b } : { userAId: b, userBId: a };
}
