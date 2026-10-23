import { and, desc, eq, gt, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { db, hasDb } from "./db";
import { notifications, users } from "./db/schema";
import { getProfileById, placeFor, type MapProfile } from "./profiles";
import { connectedIds } from "./connections";
import { matchesFor } from "./matching";
import { sharedCustomInterests, TOPIC_BY_ID } from "./intents";
import { distanceKm } from "./geo";
import {
  ALERT_CITY_RADIUS_KM,
  ALERT_CROWD_COOLDOWN_HOURS,
  ALERT_CROWD_THRESHOLD,
  ALERT_DAILY_CAP,
  ALERT_REPEAT_DAYS,
  ALERT_SCAN_EVERY_MINUTES,
  CROWD_CLUSTER_KM,
  type AlertKind,
} from "./rules";

/**
 * Proximity alerts — telling somebody that a person worth meeting is near
 * them *right now*.
 *
 * This is the feature the map exists for. Recommendations you have to open
 * the app to see arrive after the moment has passed; the whole premise of
 * putting people on a map is that proximity is perishable.
 *
 * It is also the most dangerous thing in this product, because it reads
 * everybody's position and tells other people about it. Three rules carry
 * that weight, and none of them is optional:
 *
 * 1. **Nothing escapes `place()`.** Alerts see exactly what the map would
 *    show the recipient — never the stored coordinates. Somebody publishing
 *    only their city can trigger "is in your city" and can never, at any
 *    distance, trigger "600 m away".
 * 2. **No alert is a new disclosure.** Every person named here is already
 *    visible to that recipient on the map. The alert changes *when* they
 *    find out, not *what* they are allowed to know.
 * 3. **Silence is the default for strangers.** Interests — the loosest
 *    signal — is opt-in, and everything is rate-limited hard. A feature
 *    that gets muted on day one was never built.
 */

/**
 * The only fields the engine needs about a person.
 *
 * Narrower than `MapProfile` on purpose: this code should not be able to
 * touch a coordinate by accident. Positions reach it only through
 * `placeFor` (what others may see) and `ownPosition` (your own, for
 * measuring from), and those are the two separate ideas the whole feature
 * turns on.
 */
type Intents = {
  id: string;
  name: string | null;
  lookingFor: string[] | null;
  canHelpWith: string[] | null;
  interests: string[] | null;
  /** Hand-typed phrases, matched word for word. See lib/intents. */
  customLookingFor: string[] | null;
  customCanHelpWith: string[] | null;
  customInterests: string[] | null;
};

type Candidate = Intents & { prefs: Prefs };

type Prefs = {
  notifyConnections: boolean;
  notifyMatches: boolean;
  notifyInterests: boolean;
  notifyRadiusKm: number;
};

/**
 * Evaluate the neighbourhood around one person who has just moved.
 *
 * Deliberately two-directional. If only the mover's arrival were announced,
 * somebody flying into a city where four of their connections already live
 * would be told nothing — nobody else moved. So the same scan answers both
 * questions: who should hear about this person, and who should this person
 * hear about.
 *
 * Returns how many notifications were written, which is mostly useful for
 * tests and for watching whether this is too loud in practice.
 */
export async function runProximityScan(moverId: string, opts: { force?: boolean } = {}): Promise<number> {
  if (!hasDb || !db) return 0;

  const mover = await getProfileById(moverId);
  if (!mover) return 0;

  // Live positions arrive every 90 seconds. Evaluating the whole
  // neighbourhood that often would be wasteful and would notify somebody
  // about the same café repeatedly as they drift around it.
  if (!opts.force && mover.alertsScanAt) {
    const since = Date.now() - new Date(mover.alertsScanAt).getTime();
    if (since < ALERT_SCAN_EVERY_MINUTES * 60_000) return 0;
  }
  await db.update(users).set({ alertsScanAt: new Date() }).where(eq(users.id, moverId));

  // Where the mover is, for distance purposes. Their own real position —
  // the gate below decides what *others* are allowed to learn from it.
  const here = mover.lat != null && mover.lng != null
    ? { lat: mover.lat, lng: mover.lng }
    : mover.baseLat != null && mover.baseLng != null
      ? { lat: mover.baseLat, lng: mover.baseLng }
      : null;
  if (!here) return 0;

  // Everyone who could plausibly be involved, bounded by the widest radius
  // anybody asks for. One query, not one per person.
  const box = boxAround(here, 30);
  const rows = await db
    .select()
    .from(users)
    .where(
      and(
        ne(users.id, moverId),
        isNotNull(users.name),
        // Parenthesised, and that is load-bearing: drizzle splices a raw
        // `sql` fragment in untouched, and OR binds looser than AND, so
        // without these brackets the whole clause re-associated into
        // `(id <> mover AND name AND lat…) OR (baseLat… AND lng…) OR
        // (baseLng…)` — two branches with no mover guard and no name check
        // at all. The visible symptom was somebody being notified about
        // their own arrival.
        sql`(${users.lat} between ${box.minLat} and ${box.maxLat} or ${users.baseLat} between ${box.minLat} and ${box.maxLat})`,
        sql`(${users.lng} between ${box.minLng} and ${box.maxLng} or ${users.baseLng} between ${box.minLng} and ${box.maxLng})`
      )
    )
    .limit(400);
  if (rows.length === 0) return 0;

  const connected = await connectedIds(moverId);

  // Everything the caps need, loaded once for the whole sweep.
  //
  // This used to be two queries per candidate pair, which in a 200-person
  // room was roughly sixteen hundred round trips for a single arrival. The
  // answers are the same for every pair, so they are fetched once.
  const budget = await loadBudgets([moverId, ...rows.map((r) => r.id)]);

  let written = 0;

  /**
   * Is this a venue rather than a street?
   *
   * Density is a property of the *place*, not of a pair, so it is decided
   * once from how many people are clustered around the mover and then
   * applies to everyone in that cluster.
   */
  const clustered = rows.filter((r) => {
    const p = ownPosition(r);
    return p != null && distanceKm(here.lat, here.lng, p.lat, p.lng) <= CROWD_CLUSTER_KM;
  }).length;
  const crowded = clustered >= ALERT_CROWD_THRESHOLD;

  // ---------------------------------------------------- outward direction
  const moverAsSeen = placeFor(mover);
  if (moverAsSeen) {
    for (const r of rows) {
      const recipient = toCandidate(r);
      if (!recipient) continue;
      const theirPos = ownPosition(r);
      if (!theirPos) continue;

      const km = distanceKm(theirPos.lat, theirPos.lng, moverAsSeen.lat, moverAsSeen.lng);
      const kind = pickKind(recipient, mover, connected.has(r.id));
      if (!kind) continue;
      if (!withinReach(km, recipient.prefs.notifyRadiusKm, moverAsSeen.placed)) continue;

      // A connection arriving keeps its own line even in a crowd: you know
      // them by name, and that is exactly what a count destroys.
      if (kind !== "connection_nearby" && crowded) {
        written += await noteCrowd(budget, r.id, moverAsSeen.label);
        continue;
      }

      if (!budget.mayWrite(r.id, moverId, kind)) continue;
      await insert(r.id, moverId, kind, reasonFor(recipient, mover), moverAsSeen, km, 1);
      budget.spend(r.id, moverId, kind);
      written++;
    }
  }

  // ----------------------------------------------------- inward direction
  const moverPrefs = toPrefs(mover);
  const me = selfCandidate(mover);
  if (moverPrefs.notifyConnections || moverPrefs.notifyMatches || moverPrefs.notifyInterests) {
    const hits: Array<{ row: (typeof rows)[number]; kind: AlertKind; km: number }> = [];
    for (const r of rows) {
      const subject = toCandidate(r);
      if (!subject) continue;
      const seen = placeFor(r);
      if (!seen) continue;

      const km = distanceKm(here.lat, here.lng, seen.lat, seen.lng);
      const kind = pickKind(me, r, connected.has(r.id));
      if (!kind) continue;
      if (!withinReach(km, moverPrefs.notifyRadiusKm, seen.placed)) continue;
      hits.push({ row: r, kind, km });
    }

    const personal = hits.filter((h) => h.kind === "connection_nearby");
    const strangers = hits.filter((h) => h.kind !== "connection_nearby");

    for (const h of personal) {
      if (!budget.mayWrite(moverId, h.row.id, h.kind)) continue;
      await insert(moverId, h.row.id, h.kind, reasonFor(me, h.row), placeFor(h.row)!, h.km, 1);
      budget.spend(moverId, h.row.id, h.kind);
      written++;
    }

    if (strangers.length > ALERT_CROWD_THRESHOLD) {
      // The point of the crowd case: no notification can carry twenty
      // people usefully, and picking "the best three" means a second ranker
      // that will drift from the one For You already uses. So this says how
      // many and what they're mostly good for, and the ranking stays in the
      // single place that does it properly.
      written += await noteCrowd(
        budget,
        moverId,
        null,
        strangers.length,
        topicOf(me, strangers.map((h) => h.row))
      );
    } else {
      // Few enough to name, so nothing is truncated and nothing needs
      // ranking — everybody who qualified gets their own line.
      for (const h of strangers) {
        if (!budget.mayWrite(moverId, h.row.id, h.kind)) continue;
        await insert(moverId, h.row.id, h.kind, reasonFor(me, h.row), placeFor(h.row)!, h.km, 1);
        budget.spend(moverId, h.row.id, h.kind);
        written++;
      }
    }
  }

  return written;
}

/**
 * One notice per person per place, counting up as the room fills.
 *
 * Carries no actor: it is about a room, not a person. Tapping it opens For
 * You, which already filters, ranks and explains — in a crowd a
 * notification is a doorway, not a container.
 */
async function noteCrowd(
  budget: Budget,
  userId: string,
  placeLabel: string | null,
  total = 1,
  topic: string | null = null
): Promise<number> {
  const open = budget.crowdFor(userId);
  if (open) {
    await bumpCrowd(open, total);
    return 0;
  }
  if (!budget.mayWriteCrowd(userId)) return 0;
  await insert(userId, null, "crowd_nearby", topic, { placed: "exact", label: placeLabel }, 0, total);
  budget.spendCrowd(userId);
  return 1;
}

/**
 * What this crowd is mostly good for, as one phrase.
 *
 * A tally, not a ranking — "6 of them can help with funding" is the bit
 * that decides whether somebody opens the list, and it costs one pass.
 */
function topicOf(me: Candidate, others: Intents[]): string | null {
  const wanted = new Set(me.lookingFor ?? []);
  const tally = new Map<string, number>();
  for (const o of others) {
    for (const t of o.canHelpWith ?? []) {
      if (wanted.has(t)) tally.set(t, (tally.get(t) ?? 0) + 1);
    }
  }
  let best: [string, number] | null = null;
  for (const e of tally) if (!best || e[1] > best[1]) best = e;
  if (!best) return null;
  const topic = TOPIC_BY_ID.get(best[0]);
  return topic ? `${best[1]} of them can help with ${topic.offer.toLowerCase()}` : null;
}

function reasonFor(me: Candidate, other: Intents): string | null {
  const [m] = matchesFor(
    {
      id: "me",
      lookingFor: me.lookingFor ?? [],
      canHelpWith: me.canHelpWith ?? [],
      interests: me.interests ?? [],
      customLookingFor: me.customLookingFor ?? [],
      customCanHelpWith: me.customCanHelpWith ?? [],
      customInterests: me.customInterests ?? [],
    },
    [asPoolEntry(other)],
    { surface: "open", limit: 1 }
  );
  return m?.reason ?? null;
}

/**
 * Which alert, if any, this pair justifies — strongest first.
 *
 * A connection outranks a match outranks a shared sector, and only one
 * fires: being told the same arrival three ways is three times the noise
 * for none of the information.
 */
function pickKind(recipient: Candidate, subject: Intents, isConnected: boolean): AlertKind | null {
  if (isConnected) return recipient.prefs.notifyConnections ? "connection_nearby" : null;

  if (recipient.prefs.notifyMatches) {
    const [m] = matchesFor(
      {
        id: "me",
        lookingFor: recipient.lookingFor ?? [],
        canHelpWith: recipient.canHelpWith ?? [],
        interests: recipient.interests ?? [],
        customLookingFor: recipient.customLookingFor ?? [],
        customCanHelpWith: recipient.customCanHelpWith ?? [],
        customInterests: recipient.customInterests ?? [],
      },
      [asPoolEntry(subject)],
      { surface: "open", limit: 1 }
    );
    if (m) return "match_nearby";
  }

  if (recipient.prefs.notifyInterests) {
    const mine = new Set(recipient.interests ?? []);
    if ((subject.interests ?? []).some((i) => mine.has(i))) return "interest_nearby";
    // A typed interest counts the same: somebody who wrote "carnatic music"
    // and is standing near the one other person who wrote it should hear
    // about it, and the sector list will never have that row.
    if (sharedCustomInterests(recipient.customInterests, subject.customInterests).length > 0) {
      return "interest_nearby";
    }
  }
  return null;
}

/**
 * City-level positions can't carry a street-level claim.
 *
 * Somebody publishing only their city is placed at the centroid, which can
 * be kilometres from where they actually are. Letting that satisfy a 1 km
 * radius would be inventing precision they never agreed to, so a coarse
 * position only ever fires at city scale.
 */
function withinReach(km: number, radiusKm: number, placed: "exact" | "base" | "live"): boolean {
  if (placed === "base") return km <= Math.max(radiusKm, ALERT_CITY_RADIUS_KM);
  return km <= radiusKm;
}

/* --------------------------------------------------- caps and writing */

type Budget = Awaited<ReturnType<typeof loadBudgets>>;

/**
 * The caps, resolved once per sweep instead of once per pair.
 *
 * This used to be two queries per candidate pair, which in a 200-person
 * room was roughly sixteen hundred round trips for a single arrival. The
 * answers are identical for every pair, so they are fetched once: how much
 * of today's budget each person has spent, which pairs already fired inside
 * the repeat window, and who already has a live crowd notice.
 */
async function loadBudgets(userIds: string[]) {
  const dayAgo = new Date(Date.now() - 86_400_000);
  const repeatSince = new Date(Date.now() - ALERT_REPEAT_DAYS * 86_400_000);
  const crowdSince = new Date(Date.now() - ALERT_CROWD_COOLDOWN_HOURS * 3_600_000);

  const [daily, pairs, crowds] = await Promise.all([
    db!
      .select({ userId: notifications.userId, n: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(inArray(notifications.userId, userIds), gt(notifications.createdAt, dayAgo)))
      .groupBy(notifications.userId),
    db!
      .select({ userId: notifications.userId, actorId: notifications.actorId, kind: notifications.kind })
      .from(notifications)
      .where(and(inArray(notifications.userId, userIds), gt(notifications.createdAt, repeatSince))),
    db!
      .select({ id: notifications.id, userId: notifications.userId, count: notifications.count })
      .from(notifications)
      .where(
        and(
          inArray(notifications.userId, userIds),
          eq(notifications.kind, "crowd_nearby"),
          gt(notifications.createdAt, crowdSince)
        )
      ),
  ]);

  const spent = new Map(daily.map((d) => [d.userId, d.n]));
  const seen = new Set(pairs.map((p) => `${p.userId}|${p.actorId}|${p.kind}`));
  const crowdBy = new Map(crowds.map((c) => [c.userId, { id: c.id, count: c.count }]));

  return {
    mayWrite(userId: string, actorId: string, kind: AlertKind) {
      if ((spent.get(userId) ?? 0) >= ALERT_DAILY_CAP) return false;
      return !seen.has(`${userId}|${actorId}|${kind}`);
    },
    spend(userId: string, actorId: string, kind: AlertKind) {
      spent.set(userId, (spent.get(userId) ?? 0) + 1);
      seen.add(`${userId}|${actorId}|${kind}`);
    },
    /** A crowd notice has no actor, so the pair check doesn't apply to it. */
    mayWriteCrowd(userId: string) {
      return (spent.get(userId) ?? 0) < ALERT_DAILY_CAP && !crowdBy.has(userId);
    },
    spendCrowd(userId: string) {
      spent.set(userId, (spent.get(userId) ?? 0) + 1);
      // Remembered for the rest of this sweep too, so the next arrival
      // bumps the count rather than writing a second notice.
      crowdBy.set(userId, { id: "", count: 1 });
    },
    crowdFor(userId: string) {
      return crowdBy.get(userId) ?? null;
    },
  };
}

/** More people turned up somewhere this person already knows is busy. */
async function bumpCrowd(row: { id: string; count: number }, to: number) {
  // A placeholder written during this same sweep has no row id yet; its
  // count is recomputed by the next scan anyway.
  if (!db || !row.id) return;
  const next = Math.max(row.count, to);
  if (next === row.count) return;
  await db.update(notifications).set({ count: next }).where(eq(notifications.id, row.id));
  row.count = next;
}

async function insert(
  recipientId: string,
  actorId: string | null,
  kind: AlertKind,
  reason: string | null,
  seen: { placed: "exact" | "base" | "live"; label: string | null },
  km: number,
  count: number
) {
  if (!db) return;
  await db.insert(notifications).values({
    userId: recipientId,
    actorId,
    kind,
    reason,
    placeLabel: seen.label,
    // Null for a city-level position, and for a crowd — in both cases a
    // number would imply a precision that was never published.
    distanceKm: seen.placed === "base" || kind === "crowd_nearby" ? null : Math.round(km * 10) / 10,
    count,
  });
}

/* ------------------------------------------------------------- helpers */

function toPrefs(r: {
  notifyConnections: boolean;
  notifyMatches: boolean;
  notifyInterests: boolean;
  notifyRadiusKm: number;
}): Prefs {
  return {
    notifyConnections: r.notifyConnections,
    notifyMatches: r.notifyMatches,
    notifyInterests: r.notifyInterests,
    notifyRadiusKm: r.notifyRadiusKm,
  };
}

function toCandidate(r: Intents & Prefs): Candidate | null {
  if (!r.name) return null;
  return {
    id: r.id,
    name: r.name,
    lookingFor: r.lookingFor,
    canHelpWith: r.canHelpWith,
    interests: r.interests,
    customLookingFor: r.customLookingFor,
    customCanHelpWith: r.customCanHelpWith,
    customInterests: r.customInterests,
    prefs: toPrefs(r),
  };
}

/** The mover, in the same shape, so both directions use one code path. */
function selfCandidate(m: Intents & Prefs): Candidate {
  return {
    id: m.id,
    name: m.name,
    lookingFor: m.lookingFor,
    canHelpWith: m.canHelpWith,
    interests: m.interests,
    customLookingFor: m.customLookingFor,
    customCanHelpWith: m.customCanHelpWith,
    customInterests: m.customInterests,
    prefs: toPrefs(m),
  };
}

/** Somebody's own position, for measuring from. Not what others may see. */
function ownPosition(r: {
  lat: number | null;
  lng: number | null;
  baseLat: number | null;
  baseLng: number | null;
}): { lat: number; lng: number } | null {
  if (r.lat != null && r.lng != null) return { lat: r.lat, lng: r.lng };
  if (r.baseLat != null && r.baseLng != null) return { lat: r.baseLat, lng: r.baseLng };
  return null;
}

function asPoolEntry(p: Intents): MapProfile {
  return {
    id: p.id,
    name: p.name ?? "",
    lookingFor: p.lookingFor ?? [],
    canHelpWith: p.canHelpWith ?? [],
    interests: p.interests ?? [],
    customLookingFor: p.customLookingFor ?? [],
    customCanHelpWith: p.customCanHelpWith ?? [],
    customInterests: p.customInterests ?? [],
  } as MapProfile;
}

function boxAround(c: { lat: number; lng: number }, km: number) {
  const dLat = km / 110.574;
  const shrink = Math.max(Math.cos((c.lat * Math.PI) / 180), 0.01);
  const dLng = km / (111.32 * shrink);
  return { minLat: c.lat - dLat, maxLat: c.lat + dLat, minLng: c.lng - dLng, maxLng: c.lng + dLng };
}

/* ----------------------------------------------------------- the inbox */

export type AlertRow = {
  id: string;
  kind: AlertKind;
  /** How many people a crowd notice stands for. 1 for everything else. */
  count: number;
  reason: string | null;
  placeLabel: string | null;
  distanceKm: number | null;
  at: string;
  read: boolean;
  person: { id: string; name: string; headline: string | null; photoUrl: string | null } | null;
};

export async function listAlerts(userId: string, limit: number): Promise<AlertRow[]> {
  if (!hasDb || !db) return [];
  const rows = await db
    .select({
      id: notifications.id,
      kind: notifications.kind,
      reason: notifications.reason,
      placeLabel: notifications.placeLabel,
      distanceKm: notifications.distanceKm,
      count: notifications.count,
      at: notifications.createdAt,
      readAt: notifications.readAt,
      actorId: users.id,
      name: users.name,
      headline: users.headline,
      photoUrl: users.photoUrl,
    })
    .from(notifications)
    .leftJoin(users, eq(users.id, notifications.actorId))
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind as AlertKind,
    count: r.count,
    reason: r.reason,
    placeLabel: r.placeLabel,
    distanceKm: r.distanceKm,
    at: r.at.toISOString(),
    read: r.readAt != null,
    person: r.actorId && r.name ? { id: r.actorId, name: r.name, headline: r.headline, photoUrl: r.photoUrl } : null,
  }));
}

export async function unreadAlerts(userId: string): Promise<number> {
  if (!hasDb || !db) return 0;
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), sql`${notifications.readAt} is null`));
  return row?.n ?? 0;
}

/** Opening the inbox is reading it. */
export async function markAlertsRead(userId: string): Promise<void> {
  if (!hasDb || !db) return;
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), sql`${notifications.readAt} is null`));
}
