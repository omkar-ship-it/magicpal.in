import { and, eq, gt, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { db, hasDb } from "./db";
import { users } from "./db/schema";
import { distanceKm } from "./geo";
import { jobsFor } from "./jobs";
import { waitingCount } from "./messages";
import { firstName } from "./matching";

/**
 * "Here is what you missed", for people who stopped coming back.
 *
 * The rule the whole module is built around: **send nothing unless there
 * is something true to say.** A map this young cannot afford the other
 * kind of re-engagement email. "Come back and check the app" is a
 * sentence with no information in it, and the cost of sending it is not
 * zero — it is the permission to ever land in that inbox again, spent on
 * a message that gave the reader nothing. So every line below is a fact
 * read out of the database at send time, and a candidate with no facts
 * is dropped rather than padded.
 *
 * Which also means the volume is self-limiting, and should be. If this
 * job finds two people worth emailing out of forty, two is the right
 * answer and the other thirty-eight were going to delete it.
 */

/** Idle this long before somebody is worth a nudge. */
export const DEFAULT_IDLE_DAYS = 14;

/**
 * And no more than one of these per person per month, whatever happens.
 *
 * Enforced by stamping `reengagedAt` in the same statement that selects
 * the row, so a job run twice — or two runs racing — cannot double-send.
 * A cap that lives only in the query is a cap that fails the first time
 * somebody retries a failed batch.
 */
export const DEFAULT_COOLDOWN_DAYS = 30;

/** How far away still counts as "near you" for a city-dweller. */
const NEAR_KM = 25;

export type Reengagement = {
  userId: string;
  email: string;
  firstName: string;
  /** The one reason this email exists, as a sentence. */
  headline: string;
  /** Up to three supporting facts. Never padded — see the note above. */
  lines: string[];
  unsubscribeToken: string;
};

type Candidate = {
  id: string;
  email: string;
  name: string | null;
  lat: number | null;
  lng: number | null;
  baseLat: number | null;
  baseLng: number | null;
  lastActiveAt: Date | null;
  unsubscribeToken: string;
};

/**
 * Who is eligible: onboarded, reachable, idle, opted in, and not mailed
 * recently.
 *
 * `emailOptOutAt is null` is the one condition with no override anywhere
 * in this file. There is no "important announcement" path that ignores
 * it, because the moment one exists the opt-out means nothing.
 */
async function candidates(opts: {
  idleDays: number;
  cooldownDays: number;
  limit: number;
}): Promise<Candidate[]> {
  if (!hasDb || !db) return [];
  const idleBefore = new Date(Date.now() - opts.idleDays * 86_400_000);
  const mailedBefore = new Date(Date.now() - opts.cooldownDays * 86_400_000);

  return db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      lat: users.lat,
      lng: users.lng,
      baseLat: users.baseLat,
      baseLng: users.baseLng,
      lastActiveAt: users.lastActiveAt,
      unsubscribeToken: users.unsubscribeToken,
    })
    .from(users)
    .where(
      and(
        isNotNull(users.name),
        isNull(users.emailOptOutAt),
        // Never seen counts as idle: somebody who finished a profile and
        // never returned is exactly who this is for.
        or(isNull(users.lastActiveAt), lt(users.lastActiveAt, idleBefore)),
        or(isNull(users.reengagedAt), lt(users.reengagedAt, mailedBefore))
      )
    )
    .limit(opts.limit);
}

const where = (c: Candidate) =>
  c.lat != null && c.lng != null
    ? { lat: c.lat, lng: c.lng }
    : c.baseLat != null && c.baseLng != null
      ? { lat: c.baseLat, lng: c.baseLng }
      : null;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Build the mail for everybody worth mailing.
 *
 * The two expensive questions — who has joined lately, and what roles are
 * open — are asked once for the whole batch and then measured against
 * each candidate's own position in memory. Per-user queries would be
 * simpler to read and would turn one job into a few hundred round trips
 * to another region the first time this list grows.
 */
export async function buildReengagements(
  opts: { idleDays?: number; cooldownDays?: number; limit?: number } = {}
): Promise<Reengagement[]> {
  if (!hasDb || !db) return [];
  const idleDays = opts.idleDays ?? DEFAULT_IDLE_DAYS;
  const pool = await candidates({
    idleDays,
    cooldownDays: opts.cooldownDays ?? DEFAULT_COOLDOWN_DAYS,
    limit: opts.limit ?? 200,
  });
  if (pool.length === 0) return [];

  // Everyone who became visible while the batch was away, asked once.
  const since = new Date(Date.now() - Math.max(idleDays, 30) * 86_400_000);
  const joiners = await db
    .select({ id: users.id, lat: users.lat, lng: users.lng, baseLat: users.baseLat, baseLng: users.baseLng })
    .from(users)
    .where(
      and(
        isNotNull(users.name),
        eq(users.publicOptIn, true),
        gt(users.createdAt, since),
        sql`${users.visibility} <> 'off'`
      )
    );

  // Live roles, once. No viewer and no centre: distance is measured per
  // candidate below, against their own position rather than a camera.
  const { jobs } = await jobsFor({});

  const out: Reengagement[] = [];
  for (const c of pool) {
    const here = where(c);
    const lines: string[] = [];

    /**
     * Ordered by how much it is about *them*. Somebody waiting on a reply
     * is a person who did something and heard nothing, which outranks any
     * number of strangers arriving.
     */
    const waiting = await waitingCount(c.id);
    if (waiting > 0) {
      lines.push(`${plural(waiting, "person is", "people are")} waiting on a reply from you.`);
    }

    const near = here
      ? joiners.filter((j) => {
          if (j.id === c.id) return false;
          const p = j.lat != null && j.lng != null ? { lat: j.lat, lng: j.lng } : j.baseLat != null && j.baseLng != null ? { lat: j.baseLat, lng: j.baseLng } : null;
          return p != null && distanceKm(here.lat, here.lng, p.lat, p.lng) <= NEAR_KM;
        }).length
      : 0;
    if (near > 0) lines.push(`${plural(near, "person", "people")} joined the map near you.`);

    const jobsNear = here
      ? jobs.filter((j) => j.lat != null && j.lng != null && distanceKm(here.lat, here.lng, j.lat, j.lng) <= NEAR_KM).length
      : 0;
    if (jobsNear > 0) lines.push(`${plural(jobsNear, "role is", "roles are")} open within ${NEAR_KM} km.`);

    // Nothing true to say. Skip rather than reach for a subject line.
    if (lines.length === 0) continue;

    out.push({
      userId: c.id,
      email: c.email,
      firstName: firstName(c.name ?? "") || "there",
      headline: lines[0],
      lines: lines.slice(1, 3),
      unsubscribeToken: c.unsubscribeToken,
    });
  }
  return out;
}

/**
 * Claim a person for this run, atomically.
 *
 * Returns false when somebody else got there first — another run, or the
 * same run retried. The `reengagedAt` condition is re-checked inside the
 * UPDATE rather than trusted from the SELECT, which is what makes the
 * cap hold under a double-fire.
 */
export async function claimForSend(userId: string, cooldownDays = DEFAULT_COOLDOWN_DAYS): Promise<boolean> {
  if (!hasDb || !db) return false;
  const mailedBefore = new Date(Date.now() - cooldownDays * 86_400_000);
  const rows = await db
    .update(users)
    .set({ reengagedAt: new Date() })
    .where(
      and(
        eq(users.id, userId),
        isNull(users.emailOptOutAt),
        or(isNull(users.reengagedAt), lt(users.reengagedAt, mailedBefore))
      )
    )
    .returning();
  return rows.length > 0;
}

/**
 * The shape Postgres will accept for a uuid column.
 *
 * Checked here rather than left to the database, because a malformed
 * token is not an exceptional case on this particular page — links get
 * truncated by mail clients, mangled by scanners, and retyped by hand —
 * and the query throws on bad syntax rather than returning no rows. An
 * unsubscribe page that 500s is the worst page in the product to break:
 * the reader already wants out, and a crash reads as refusal.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One click, no login. Idempotent — unsubscribing twice is not an error. */
export async function unsubscribeByToken(token: string): Promise<{ ok: boolean; email?: string }> {
  if (!hasDb || !db) return { ok: false };
  if (!UUID.test(token)) return { ok: false };
  const rows = await db
    .update(users)
    .set({ emailOptOutAt: new Date() })
    .where(eq(users.unsubscribeToken, token))
    .returning();
  const row = rows[0];
  return row ? { ok: true, email: row.email } : { ok: false };
}
