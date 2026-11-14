import { and, eq, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { db, hasDb } from "./db";
import { connections, messages, users } from "./db/schema";
import { firstName, matchesFor } from "./matching";
import { getOpenMapProfiles } from "./profiles";

/**
 * The two emails that are about other people, rather than about you
 * having been away.
 *
 * Both are batched jobs rather than hooks in `sendMessage` and
 * `requestConnection`, and that is the main design decision here. Per
 * event, ten messages in a conversation produce ten emails and one
 * unsubscribe — the single most common way a product loses an inbox. A
 * job that asks "who has unanswered things waiting, and when did we last
 * say so" produces one email however many messages arrived, and the
 * debounce is structural rather than something every future caller has
 * to remember. It also keeps MSG91 off the request path, so nobody waits
 * on an email provider to watch their own message appear.
 *
 * The cost is honest and worth stating: these are not instant. An
 * activity email lands within the cron interval, not within the second.
 * For email that is the right trade; for "right now" there is push.
 */

/** Long enough that a back-and-forth is one email, short enough to be useful. */
export const ACTIVITY_GAP_MINUTES = 30;

/** One a day, and only when the matcher has something new to say. */
export const DIGEST_GAP_HOURS = 20;

/** How many people the daily email will name. More is a directory, not a nudge. */
const DIGEST_SHOWN = 3;

export type Notification = {
  userId: string;
  email: string;
  firstName: string;
  headline: string;
  lines: string[];
  ctaLabel: string;
  /** Where the button lands, relative to the site root. */
  ctaPath: string;
  unsubscribeToken: string;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/* ─────────────────────────────────────────────── somebody is waiting */

/**
 * Pending connection requests and unread messages, per person, in one
 * query each rather than per candidate.
 *
 * Counts threads rather than messages on purpose: "3 people are waiting"
 * is a sentence somebody acts on, "you have 47 unread messages" is one
 * they archive.
 */
export async function buildActivityEmails(
  opts: { gapMinutes?: number; limit?: number } = {}
): Promise<Notification[]> {
  if (!hasDb || !db) return [];
  const gap = new Date(Date.now() - (opts.gapMinutes ?? ACTIVITY_GAP_MINUTES) * 60_000);

  /**
   * Two grouped queries and a join in memory, rather than correlated
   * subqueries against the outer row.
   *
   * The subquery version read better and did not work: the generated SQL
   * left the outer `users.id` unqualified inside the subselect and
   * Postgres refused it as ambiguous. This shape is also cheaper — two
   * index scans instead of one per candidate — and each half can be read
   * on its own.
   */
  const pending = await db
    .select({ uid: sql<string>`u.id`, n: sql<number>`count(*)::int` })
    .from(sql`${users} u`)
    .innerJoin(
      sql`${connections} c`,
      sql`(c.user_a_id = u.id or c.user_b_id = u.id) and c.status = 'pending' and c.requester_id <> u.id`
    )
    .groupBy(sql`u.id`);

  /**
   * Unread threads that went quiet *before* the cutoff. Without that
   * condition a conversation in progress re-sends every interval while
   * two people are typing at each other, which is the other way this
   * becomes spam.
   */
  const unread = await db
    .select({ uid: sql<string>`u.id`, n: sql<number>`count(distinct m.connection_id)::int` })
    .from(sql`${users} u`)
    .innerJoin(
      sql`${connections} c`,
      sql`(c.user_a_id = u.id or c.user_b_id = u.id)`
    )
    .innerJoin(
      sql`${messages} m`,
      sql`m.connection_id = c.id and m.sender_id <> u.id and m.read_at is null and m.created_at < ${gap}`
    )
    .groupBy(sql`u.id`);

  const requestsBy = new Map(pending.map((r) => [r.uid, r.n]));
  const threadsBy = new Map(unread.map((r) => [r.uid, r.n]));

  const rows = (
    await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        unsubscribeToken: users.unsubscribeToken,
      })
      .from(users)
      .where(
        and(
          isNotNull(users.name),
          isNull(users.emailOptOutAt),
          or(isNull(users.activityEmailedAt), lt(users.activityEmailedAt, gap))
        )
      )
      .limit(opts.limit ?? 500)
  ).map((r) => ({ ...r, requests: requestsBy.get(r.id) ?? 0, threads: threadsBy.get(r.id) ?? 0 }));

  const out: Notification[] = [];
  for (const r of rows) {
    const lines: string[] = [];
    if (r.requests > 0) {
      lines.push(`${plural(r.requests, "person wants", "people want")} to connect with you.`);
    }
    if (r.threads > 0) {
      lines.push(`${plural(r.threads, "conversation is", "conversations are")} waiting on a reply.`);
    }
    if (lines.length === 0) continue;

    out.push({
      userId: r.id,
      email: r.email,
      firstName: firstName(r.name ?? "") || "there",
      headline: lines[0],
      lines: lines.slice(1),
      ctaLabel: r.requests > 0 ? "See who" : "Open the conversation",
      ctaPath: "/",
      unsubscribeToken: r.unsubscribeToken,
    });
  }
  return out;
}

/* ──────────────────────────────────────────────── who is worth meeting */

/**
 * The daily one: a count, and a link to For You.
 *
 * It names nobody, deliberately. An email that lists "Ananya Rao — she
 * does go-to-market, which is what you're after" is a more persuasive
 * email and a worse idea: it publishes a third party's name and stated
 * intent into an inbox that gets forwarded, auto-scanned and breached,
 * and none of those three people agreed to that. The count is the part
 * that is about *you*, and it is enough to earn a click.
 *
 * It also means the email cannot go stale against the app. A list in an
 * inbox is a snapshot of a matcher that has since re-run; a link is
 * always whatever For You currently says.
 *
 * Still runs the real matcher to decide *whether* to send, against the
 * same open-map pool the panel uses, so the number in the email is the
 * number on the screen it opens. And it sends nothing when the matcher
 * finds nothing — a daily email that arrives whether or not there is
 * anything in it is a daily email people filter.
 */
export async function buildDailyMatches(
  opts: { gapHours?: number; limit?: number } = {}
): Promise<Notification[]> {
  if (!hasDb || !db) return [];
  const gap = new Date(Date.now() - (opts.gapHours ?? DIGEST_GAP_HOURS) * 3_600_000);

  const pool = await db
    .select()
    .from(users)
    .where(
      and(
        isNotNull(users.name),
        isNull(users.emailOptOutAt),
        or(isNull(users.digestEmailedAt), lt(users.digestEmailedAt, gap))
      )
    )
    .limit(opts.limit ?? 300);

  const out: Notification[] = [];
  for (const me of pool) {
    // Somebody who has stated nothing cannot be matched on anything, and
    // telling them so daily is not a nudge, it is nagging.
    const stated =
      (me.lookingFor?.length ?? 0) +
      (me.canHelpWith?.length ?? 0) +
      (me.interests?.length ?? 0) +
      (me.customLookingFor?.length ?? 0) +
      (me.customCanHelpWith?.length ?? 0) +
      (me.customInterests?.length ?? 0);
    if (stated === 0) continue;

    const centre =
      me.lat != null && me.lng != null
        ? { lat: me.lat, lng: me.lng }
        : me.baseLat != null && me.baseLng != null
          ? { lat: me.baseLat, lng: me.baseLng }
          : null;
    if (!centre) continue;

    const nearby = await getOpenMapProfiles({
      excludeUserId: me.id,
      centerLat: centre.lat,
      centerLng: centre.lng,
    });
    const matches = matchesFor(
      {
        id: me.id,
        lookingFor: me.lookingFor ?? [],
        canHelpWith: me.canHelpWith ?? [],
        interests: me.interests ?? [],
        customLookingFor: me.customLookingFor ?? [],
        customCanHelpWith: me.customCanHelpWith ?? [],
        customInterests: me.customInterests ?? [],
      },
      nearby,
      { surface: "open", limit: DIGEST_SHOWN }
    );
    if (matches.length === 0) continue;

    out.push({
      userId: me.id,
      email: me.email,
      firstName: firstName(me.name ?? "") || "there",
      headline: `${plural(matches.length, "person", "people")} worth meeting near you today.`,
      lines: ["Based on what you said you're looking for, and what you can help with."],
      ctaLabel: "See who",
      // Straight into the recommendations rather than the bare map —
      // `?panel=forYou` is a real address of that panel (see Overlay in
      // MapShell), so the click lands on the thing the email is about.
      ctaPath: "/?panel=forYou",
      unsubscribeToken: me.unsubscribeToken,
    });
  }
  return out;
}

/* ───────────────────────────────────────────────────────────── claiming */

/**
 * Stamp the clock before sending, and only if nobody else already did.
 *
 * Same reasoning as the re-engagement job: claimed before the send, not
 * after, so a crash between the two costs one person one email rather
 * than sending them two. The gap is re-checked inside the UPDATE rather
 * than trusted from the SELECT, which is what holds under a double-fire.
 */
export async function claimActivity(userId: string, gapMinutes = ACTIVITY_GAP_MINUTES): Promise<boolean> {
  if (!hasDb || !db) return false;
  const gap = new Date(Date.now() - gapMinutes * 60_000);
  const rows = await db
    .update(users)
    .set({ activityEmailedAt: new Date() })
    .where(
      and(
        eq(users.id, userId),
        isNull(users.emailOptOutAt),
        or(isNull(users.activityEmailedAt), lt(users.activityEmailedAt, gap))
      )
    )
    .returning();
  return rows.length > 0;
}

export async function claimDigest(userId: string, gapHours = DIGEST_GAP_HOURS): Promise<boolean> {
  if (!hasDb || !db) return false;
  const gap = new Date(Date.now() - gapHours * 3_600_000);
  const rows = await db
    .update(users)
    .set({ digestEmailedAt: new Date() })
    .where(
      and(
        eq(users.id, userId),
        isNull(users.emailOptOutAt),
        or(isNull(users.digestEmailedAt), lt(users.digestEmailedAt, gap))
      )
    )
    .returning();
  return rows.length > 0;
}
