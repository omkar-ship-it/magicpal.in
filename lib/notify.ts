import { and, eq, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { db, hasDb } from "./db";
import { connections, messages, users } from "./db/schema";
import { firstName, matchesFor } from "./matching";
import { getOpenMapProfiles } from "./profiles";

/**
 * One email, once a morning: what is waiting on you, and who is worth
 * meeting.
 *
 * It was two jobs — a fast "somebody is waiting" and a daily digest —
 * and collapsing them is the better product as well as the only shape
 * that fits a once-a-day cron. Somebody who has a connection request
 * *and* three matches does not want two emails about the same visit;
 * they want one, with the urgent thing at the top.
 *
 * Batched rather than hooked into `sendMessage` and `requestConnection`,
 * which is the decision that keeps this from becoming spam. Per event,
 * ten messages in a conversation produce ten emails and one unsubscribe.
 * A job that asks "who has unanswered things waiting" produces one email
 * however many messages arrived — the debounce is structural, not
 * something every future caller has to remember — and it keeps MSG91 off
 * the request path, so nobody waits on an email provider to watch their
 * own message appear.
 *
 * The honest cost: nothing here is instant. For "right now" there is
 * push; this is the morning paper.
 */

/** One a day, with slack so a cron that drifts an hour cannot skip a day. */
export const DIGEST_GAP_HOURS = 20;

/**
 * How long a message must have sat before it counts as waiting.
 *
 * Without it the digest can announce a message sent four minutes before
 * the cron fired, to somebody who is mid-conversation and has already
 * read it on their phone. An hour is long enough that anything still
 * unread is genuinely unanswered.
 */
const QUIET_MINUTES = 60;

/**
 * How many matches the matcher is asked for.
 *
 * Only ever used as "did it find any" — the number never reaches the
 * email. Capped anyway so a person on a busy map does not pay for a
 * ranking nobody reads.
 */
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

/**
 * Pending requests and unanswered threads for everybody at once.
 *
 * Two grouped queries rather than correlated subqueries against each
 * candidate: the subquery version read better and did not work, because
 * the generated SQL left the outer `users.id` unqualified inside the
 * subselect and Postgres refused it as ambiguous. This is also two index
 * scans instead of one per person.
 *
 * Threads, not messages — a conversation somebody has not answered is
 * one thing owed, however many lines arrived in it. The number itself
 * never leaves this file; it only decides which of the two messages a
 * person gets.
 */
async function waitingFor(quietBefore: Date) {
  const pending = await db!
    .select({ uid: sql<string>`u.id`, n: sql<number>`count(*)::int` })
    .from(sql`${users} u`)
    .innerJoin(
      sql`${connections} c`,
      sql`(c.user_a_id = u.id or c.user_b_id = u.id) and c.status = 'pending' and c.requester_id <> u.id`
    )
    .groupBy(sql`u.id`);

  const unread = await db!
    .select({ uid: sql<string>`u.id`, n: sql<number>`count(distinct m.connection_id)::int` })
    .from(sql`${users} u`)
    .innerJoin(sql`${connections} c`, sql`(c.user_a_id = u.id or c.user_b_id = u.id)`)
    .innerJoin(
      sql`${messages} m`,
      sql`m.connection_id = c.id and m.sender_id <> u.id and m.read_at is null and m.created_at < ${quietBefore}`
    )
    .groupBy(sql`u.id`);

  return {
    requests: new Map(pending.map((r) => [r.uid, r.n])),
    threads: new Map(unread.map((r) => [r.uid, r.n])),
  };
}

/**
 * How many people the matcher would put in front of them right now.
 *
 * Runs the same matcher the For You panel runs, over the same open-map
 * pool, so the number in the email is the number on the screen it opens.
 * A digest computed by its own slightly different rule is a digest that
 * sends people to a screen which disagrees with it.
 */
async function matchCount(me: typeof users.$inferSelect): Promise<number> {
  const stated =
    (me.lookingFor?.length ?? 0) +
    (me.canHelpWith?.length ?? 0) +
    (me.interests?.length ?? 0) +
    (me.customLookingFor?.length ?? 0) +
    (me.customCanHelpWith?.length ?? 0) +
    (me.customInterests?.length ?? 0);
  // Stated nothing, so nothing can interlock. Telling them so every
  // morning is not a nudge, it is nagging.
  if (stated === 0) return 0;

  const centre =
    me.lat != null && me.lng != null
      ? { lat: me.lat, lng: me.lng }
      : me.baseLat != null && me.baseLng != null
        ? { lat: me.baseLat, lng: me.baseLng }
        : null;
  if (!centre) return 0;

  const nearby = await getOpenMapProfiles({
    excludeUserId: me.id,
    centerLat: centre.lat,
    centerLng: centre.lng,
  });
  return matchesFor(
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
  ).length;
}

/**
 * Build the morning's mail.
 *
 * The copy carries no counts and no names. "2 people want to connect"
 * is a more persuasive sentence and a worse email: it publishes who is
 * interested in whom into an inbox that gets forwarded, auto-scanned and
 * breached, and it goes stale the moment either person acts. The numbers
 * live on the screen the button opens, behind a session, where they are
 * current and only the person they belong to can read them.
 *
 * Generic is not the same as vague, though, and that is the line worth
 * holding. "You have unread messages, connection requests or new
 * matches" tells the reader we do not know which — and an email that
 * does not know what it is about teaches people to ignore the next one.
 * So there are two messages, split on the only distinction that changes
 * what the reader should do:
 *
 *   someone is waiting   — a request or a message is unanswered. A
 *                          person did something and heard nothing, which
 *                          is owed a reply.
 *   worth meeting        — nobody is waiting; the matcher found people.
 *                          An invitation, not an obligation.
 *
 * Both are true of everybody who receives them, neither reveals a count,
 * and the split decides the button too: there is no point landing
 * somebody on recommendations when the reason they opened the mail is a
 * request sitting unanswered.
 *
 * Nobody with nothing to say gets an email. A morning digest that
 * arrives whether or not anything happened is a morning digest people
 * filter, and the volume is self-limiting by design.
 */
export async function buildMorningDigest(
  opts: { gapHours?: number; limit?: number } = {}
): Promise<Notification[]> {
  if (!hasDb || !db) return [];
  const gap = new Date(Date.now() - (opts.gapHours ?? DIGEST_GAP_HOURS) * 3_600_000);
  const quietBefore = new Date(Date.now() - QUIET_MINUTES * 60_000);

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
  if (pool.length === 0) return [];

  const { requests, threads } = await waitingFor(quietBefore);

  const out: Notification[] = [];
  for (const me of pool) {
    const r = requests.get(me.id) ?? 0;
    const t = threads.get(me.id) ?? 0;
    // The one part of this loop that costs a query per person.
    const m = await matchCount(me);
    if (r === 0 && t === 0 && m === 0) continue;

    const urgent = r > 0 || t > 0;
    out.push({
      userId: me.id,
      email: me.email,
      firstName: firstName(me.name ?? "") || "there",
      // Doubles as the subject line — see the template in docs/.
      headline: urgent
        ? "Someone's waiting to hear from you"
        : "There are people worth meeting near you",
      lines: [
        urgent
          ? "A connection request or a message is sitting unanswered on your map."
          : "New people match what you're looking for, and what you can help with.",
      ],
      ctaLabel: urgent ? "See who's waiting" : "See who",
      /* Straight to the thing the headline is about. `?panel=forYou` is a
         real address of the recommendations (see Overlay in MapShell); a
         request or an unread thread belongs on the map, where the dock
         carries both counts. */
      ctaPath: urgent ? "/" : "/?panel=forYou",
      unsubscribeToken: me.unsubscribeToken,
    });
  }
  return out;
}

/**
 * Claim somebody for this run, atomically.
 *
 * Stamped before the send, not after: a crash between the two costs this
 * person one morning's email rather than sending them two. The gap is
 * re-checked inside the UPDATE rather than trusted from the SELECT,
 * which is what holds under a double-fire or a retried batch.
 */
/**
 * Give the claim back when the send is known to have failed.
 *
 * Claiming before sending is right for a *crash* — an unknown outcome
 * should cost somebody one morning rather than risk two emails. It is
 * wrong for a failure we were told about, which is most of them: an
 * unapproved template, a provider outage, a bad address. Without this,
 * one bad morning marks the whole list as mailed, delivers nothing, and
 * locks everyone out for twenty hours.
 *
 * Only ever called with a definite failure in hand. Anything ambiguous
 * keeps the stamp.
 */
export async function releaseDigest(userId: string): Promise<void> {
  if (!hasDb || !db) return;
  await db.update(users).set({ digestEmailedAt: null }).where(eq(users.id, userId));
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
