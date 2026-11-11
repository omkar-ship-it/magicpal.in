import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { db, hasDb } from "./db";
import { jobs, users } from "./db/schema";
import { distanceKm } from "./geo";
import { viewerPosition } from "./pins";
import { DEFAULT_JOB_DAYS, jobIsPlaced } from "./rules";

// Re-exported for server callers; the constants live in rules.ts so client
// components can import them without pulling in the database driver.
export {
  JOB_DURATIONS,
  JOB_MODES,
  MAX_JOB_BLURB,
  MAX_JOB_COMPANY,
  MAX_JOB_TITLE,
  jobModeLabel,
} from "./rules";

/**
 * Roles people are hiring for, placed where the work actually happens.
 *
 * A job board is the easiest thing in the world to build badly: a list,
 * sorted by recency, which tells a reader everything about a role except
 * the thing most of them decide on first — whether they could get there
 * on a Tuesday. That is the one question this product is better placed
 * to answer than any job board, so distance is not a filter bolted on
 * the side here. It is the sort order.
 *
 * Which makes "where is the reader" the load-bearing question, and it has
 * three honest answers rather than one. See `originFor`.
 *
 * Unlike a pin, a job is not somebody's live whereabouts — it is an
 * advert, published deliberately, about an office. So there is no reach,
 * nothing is withheld from signed-out visitors, and the map centre is an
 * acceptable thing to measure from. None of that is true of pins, and
 * the difference is worth being explicit about: using the camera as the
 * reader's position would be a privacy hole there and is merely a
 * convenience here.
 */

export type JobRef = {
  id: string;
  title: string;
  company: string;
  blurb: string | null;
  workMode: string;
  lat: number | null;
  lng: number | null;
  placeLabel: string | null;
  applyUrl: string | null;
  postedAt: string;
  expiresAt: string;
  /** Whole days, floored at zero. Shown so a stale-looking board isn't. */
  daysLeft: number;
  person: { id: string; name: string; headline: string | null; photoUrl: string | null };
  mine: boolean;
  /** Null for remote roles, and for every role when we know of nowhere to
   *  measure from. Never a zero standing in for "unknown". */
  distanceKm: number | null;
};

/**
 * Where distances are being measured from, named so the panel can say it.
 *
 * `you` is the reader's own position, which is what they mean by "near
 * me". `map` is the camera, used only when we have nothing better —
 * honest, and genuinely useful for somebody looking at a city they are
 * thinking of moving to. `null` is a signed-out visitor who has not
 * moved the map yet, and the correct behaviour there is to stop claiming
 * distances rather than invent an origin: a list silently sorted by
 * proximity to the default viewport is worse than one openly sorted by
 * recency.
 */
export type JobOrigin = "you" | "map" | null;

export type JobsResult = { jobs: JobRef[]; origin: JobOrigin };

/** The live condition, in one place so nothing can define it differently. */
const liveNow = () => and(gt(jobs.expiresAt, new Date()), isNull(jobs.closedAt));

async function originFor(opts: {
  viewerId?: string;
  centerLat?: number;
  centerLng?: number;
}): Promise<{ at: { lat: number; lng: number } | null; kind: JobOrigin }> {
  if (opts.viewerId) {
    const here = await viewerPosition(opts.viewerId);
    // A city centroid is a perfectly good origin for a commute question —
    // unlike a pin's reach, which refuses to resolve against one. Nobody
    // picks a job by which end of the street the office is on.
    if (here) return { at: { lat: here.lat, lng: here.lng }, kind: "you" };
  }
  if (opts.centerLat != null && opts.centerLng != null) {
    return { at: { lat: opts.centerLat, lng: opts.centerLng }, kind: "map" };
  }
  return { at: null, kind: null };
}

/**
 * Every live role, nearest first.
 *
 * Not narrowed by a radius. A job is worth knowing about from further
 * away than a coffee is — people move cities for them — so the distance
 * is shown and sorted on rather than used to hide things. The cap is a
 * cap, not a filter: if it ever bites, what it drops is the furthest
 * away, which is the only defensible thing to drop.
 */
export async function jobsFor(opts: {
  viewerId?: string;
  centerLat?: number;
  centerLng?: number;
  limit?: number;
}): Promise<JobsResult> {
  if (!hasDb || !db) return { jobs: [], origin: null };

  const { at, kind } = await originFor(opts);

  const rows = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      company: jobs.company,
      blurb: jobs.blurb,
      workMode: jobs.workMode,
      lat: jobs.lat,
      lng: jobs.lng,
      placeLabel: jobs.placeLabel,
      applyUrl: jobs.applyUrl,
      createdAt: jobs.createdAt,
      expiresAt: jobs.expiresAt,
      userId: users.id,
      name: users.name,
      headline: users.headline,
      photoUrl: users.photoUrl,
    })
    .from(jobs)
    .innerJoin(users, eq(users.id, jobs.userId))
    .where(liveNow())
    .orderBy(desc(jobs.createdAt))
    .limit(opts.limit ?? 120);

  const out: JobRef[] = rows
    // A poster who never finished a profile has no name to put on the
    // advert, and an anonymous job post is the thing every scam board is
    // made of. Enforced at post time too; this is the belt.
    .filter((r) => r.name)
    .map((r) => ({
      id: r.id,
      title: r.title,
      company: r.company,
      blurb: r.blurb,
      workMode: r.workMode,
      lat: r.lat,
      lng: r.lng,
      placeLabel: r.placeLabel,
      applyUrl: r.applyUrl,
      postedAt: r.createdAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
      daysLeft: Math.max(0, Math.floor((r.expiresAt.getTime() - Date.now()) / 86_400_000)),
      person: { id: r.userId, name: r.name!, headline: r.headline, photoUrl: r.photoUrl },
      mine: r.userId === opts.viewerId,
      distanceKm: at && r.lat != null && r.lng != null ? distanceKm(at.lat, at.lng, r.lat, r.lng) : null,
    }));

  return { jobs: sortJobs(out, kind), origin: kind };
}

/**
 * Yours first, then near, then remote.
 *
 * Remote roles are the edge case worth naming. They have no distance, so
 * any sort that treats a missing number as zero floats every one of them
 * to the top, and any sort that treats it as infinity buries them under
 * a role on the far side of the city. Neither is what somebody means. So
 * they are their own group, ordered by recency, after the placed ones —
 * present, honest about having no commute, and never pretending to a
 * position they do not have.
 *
 * With no origin at all there is nothing to sort by but recency, and the
 * panel says so rather than implying an order it does not have.
 */
function sortJobs(list: JobRef[], origin: JobOrigin): JobRef[] {
  const recent = (a: JobRef, b: JobRef) => Date.parse(b.postedAt) - Date.parse(a.postedAt);
  return [...list].sort((a, b) => {
    if (a.mine !== b.mine) return a.mine ? -1 : 1;
    if (!origin) return recent(a, b);
    const aPlaced = a.distanceKm != null;
    const bPlaced = b.distanceKm != null;
    if (aPlaced !== bPlaced) return aPlaced ? -1 : 1;
    if (aPlaced && bPlaced) return a.distanceKm! - b.distanceKm!;
    return recent(a, b);
  });
}

/**
 * Post one.
 *
 * No "replace the previous" rule, unlike a pin: a person is in one café
 * at a time but a founder hiring three roles is hiring three roles, and
 * collapsing those to one would be the product arguing with the user.
 */
export async function postJob(input: {
  userId: string;
  title: string;
  company: string;
  blurb?: string | null;
  workMode: string;
  lat?: number | null;
  lng?: number | null;
  placeLabel?: string | null;
  applyUrl?: string | null;
  days?: number;
}): Promise<string | null> {
  if (!hasDb || !db) return null;

  // The database enforces this too (0009). Mirrored here so a bad call
  // fails as a null rather than as a constraint violation in a log.
  const placed = jobIsPlaced(input.workMode);
  const lat = placed ? input.lat ?? null : null;
  const lng = placed ? input.lng ?? null : null;
  if (placed && (lat == null || lng == null)) return null;

  const days = input.days ?? DEFAULT_JOB_DAYS;
  const [row] = await db
    .insert(jobs)
    .values({
      userId: input.userId,
      title: input.title,
      company: input.company,
      blurb: input.blurb ?? null,
      workMode: input.workMode,
      lat,
      lng,
      placeLabel: placed ? input.placeLabel ?? null : null,
      applyUrl: input.applyUrl ?? null,
      expiresAt: new Date(Date.now() + days * 86_400_000),
    })
    .returning();
  return row?.id ?? null;
}

/** Filled, or withdrawn. Closed rather than deleted — see the schema. */
export async function closeJob(jobId: string, userId: string): Promise<boolean> {
  if (!hasDb || !db) return false;
  const [row] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.userId, userId)))
    .limit(1);
  if (!row) return false;
  await db.update(jobs).set({ closedAt: new Date() }).where(eq(jobs.id, jobId));
  return true;
}

/** How many live roles this person has up, for the "Replace / Post another" copy. */
export async function myJobCount(userId: string): Promise<number> {
  if (!hasDb || !db) return 0;
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(jobs)
    .where(and(eq(jobs.userId, userId), liveNow()));
  return row?.n ?? 0;
}
