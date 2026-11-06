import {
  customOverlaps,
  describeMatch,
  isTwoWay,
  overlaps,
  sharedCustomInterests,
  sharedInterests,
  type CustomOverlap,
  type Overlap,
} from "./intents";
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
  /** Hand-typed phrases that matched word for word. See lib/intents. */
  customOverlaps: CustomOverlap[];
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

/**
 * How close two people's own words have to be before it counts.
 *
 * Measured against the real corpus, and the first number was wrong.
 * Bare phrases separate cleanly — "warehouse automation" against
 * "factory robotics" is 0.61, against "wedding photography" 0.27 — so
 * 0.42 looked like a floor. Run over whole profiles it admitted half
 * the room: every one of them is a professional-networking profile, so
 * they start similar, and across sixteen real members the median pair
 * scores 0.47 against a maximum of 0.74.
 *
 * 0.60 is the top quartile of that distribution, which is the right
 * shape for a signal whose job is to add a few candidates the ticked
 * boxes missed. Anything looser is "both work in tech", which is the
 * uselessness this product exists to replace.
 *
 * It is a property of the corpus, not a constant of nature. Worth
 * re-measuring when the population changes character — a single
 * co-working floor will sit higher than an open map.
 */
export const SIMILAR_FLOOR = 0.6;

/**
 * Worth less than a real overlap, on purpose.
 *
 * Normalised across the range above the floor, so the strongest
 * semantic pair scores about one weak topic match and the weakest
 * scores nothing. A ticked box is a statement; a vector is an
 * inference, and it should never outrank the thing somebody actually
 * said about themselves.
 */
const SEMANTIC_WEIGHT = 3;

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
 * A hand-typed phrase that matched word for word, scored slightly *above*
 * its vocabulary equivalent.
 *
 * Two people who independently typed "warehouse automation" have told you
 * something far more specific than two people who both ticked "Technical
 * help", and the odds of it happening by accident are much lower. The same
 * reasoning raises a shared custom interest above a shared sector.
 */
const CUSTOM_DIRECTION_WEIGHT: Record<Overlap["direction"], number> = {
  "mine-wants-theirs": 3.5,
  mutual: 3.5,
  "theirs-wants-mine": 2.4,
};
const CUSTOM_INTEREST_WEIGHT = 1.8;

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

/**
 * Decayed on the same curve and over the *combined* count, so a person
 * with three ticked boxes and three typed phrases doesn't out-rank a good
 * match by sheer volume — the over-claiming this guards against doesn't
 * care which field it was typed into.
 */
function customOverlapScore(list: CustomOverlap[], startIndex: number): number {
  return list.reduce(
    (sum, o, i) => sum + CUSTOM_DIRECTION_WEIGHT[o.direction] / (1 + (startIndex + i) * 0.6),
    0
  );
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
  me: {
    id: string;
    lookingFor: readonly string[];
    canHelpWith: readonly string[];
    interests?: readonly string[];
    customLookingFor?: readonly string[];
    customCanHelpWith?: readonly string[];
    customInterests?: readonly string[];
  },
  pool: readonly MapProfile[],
  opts: {
    surface: Surface;
    limit?: number;
    exclude?: readonly string[];
    /**
     * Candidates whose free text means something close to the viewer's,
     * by id and similarity. From `similarCandidates`; absent is normal.
     */
    similar?: ReadonlyMap<string, number>;
  } = { surface: "open" }
): Match[] {
  const limit = opts.limit ?? 3;
  const excluded = new Set([me.id, ...(opts.exclude ?? [])]);

  const scored: Match[] = [];
  for (const other of pool) {
    if (excluded.has(other.id)) continue;
    const list = overlaps(me, other);
    const custom = customOverlaps(me, other);
    const base = overlapScore(list) + customOverlapScore(custom, list.length);
    // A trade counts as a trade whichever vocabulary it came from: needing
    // what they typed while they need what you ticked is still a trade.
    const two =
      isTwoWay(list) ||
      ([...list, ...custom].some((o) => o.direction === "mine-wants-theirs") &&
        [...list, ...custom].some((o) => o.direction === "theirs-wants-mine"));
    const shared = sharedInterests(me.interests ?? [], other.interests);
    const sharedCustom = sharedCustomInterests(me.customInterests, other.customInterests);
    const affinity =
      Math.min(shared.length, 2) * INTEREST_WEIGHT +
      Math.min(sharedCustom.length, 2) * CUSTOM_INTEREST_WEIGHT;
    /**
     * What the words mean, when the boxes don't line up.
     *
     * Exact matching cannot see that "warehouse automation" and "factory
     * robotics" are the same answer written twice, and free text is where
     * people put the specific things. This lets such a pair through — and
     * nothing else: a similarity below the floor contributes zero and
     * cannot rescue a stranger with nothing in common.
     */
    const near = opts.similar?.get(other.id) ?? 0;
    const semantic =
      near >= SIMILAR_FLOOR ? SEMANTIC_WEIGHT * ((near - SIMILAR_FLOOR) / (1 - SIMILAR_FLOOR)) : 0;

    // Someone with nothing in common is not a match at any distance — the
    // open map would otherwise recommend the nearest stranger, which is
    // exactly the uselessness this product exists to replace. A shared
    // sector counts as something in common, and so does meaning the same
    // thing in different words.
    if (base === 0 && affinity === 0 && semantic === 0 && opts.surface !== "event") continue;
    const score =
      base +
      affinity +
      semantic +
      (two ? TWO_WAY_BONUS : 0) +
      proximityScore(opts.surface, other) +
      (other.active ? 0.4 : 0);
    scored.push({
      other,
      score,
      overlaps: list,
      customOverlaps: custom,
      reason: describeMatch({
        list,
        custom,
        firstName: firstName(other.name),
        other,
        shared,
        sharedCustom,
      }),
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
    // A hand-typed phrase is its own subject, so five people who all wrote
    // the same thing don't fill the deck between them.
    const lead = m.overlaps[0]?.topic.id ?? m.customOverlaps[0]?.label.toLowerCase();
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

