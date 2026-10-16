import { and, desc, eq, gt, isNotNull, ne, sql } from "drizzle-orm";
import { db, hasDb } from "./db";
import { notifications, users } from "./db/schema";
import { getProfileById, placeFor, type MapProfile } from "./profiles";
import { connectedIds } from "./connections";
import { matchesFor } from "./matching";
import { distanceKm } from "./geo";
import {
  ALERT_CITY_RADIUS_KM,
  ALERT_DAILY_CAP,
  ALERT_REPEAT_DAYS,
  ALERT_SCAN_EVERY_MINUTES,
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
        sql`${users.lat} between ${box.minLat} and ${box.maxLat} or ${users.baseLat} between ${box.minLat} and ${box.maxLat}`,
        sql`${users.lng} between ${box.minLng} and ${box.maxLng} or ${users.baseLng} between ${box.minLng} and ${box.maxLng}`
      )
    )
    .limit(400);
  if (rows.length === 0) return 0;

  const connected = await connectedIds(moverId);
  let written = 0;

  // ---------------------------------------------------- outward direction
  // The mover arrived somewhere. Who nearby had asked to be told?
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

      if (await write(r.id, moverId, kind, recipient, mover, moverAsSeen, km)) written++;
    }
  }

  // ----------------------------------------------------- inward direction
  // The mover is now somewhere. Who is already here that they asked about?
  const moverPrefs = toPrefs(mover);
  if (moverPrefs.notifyConnections || moverPrefs.notifyMatches || moverPrefs.notifyInterests) {
    for (const r of rows) {
      const subject = toCandidate(r);
      if (!subject) continue;
      const seen = placeFor(r);
      if (!seen) continue;

      const km = distanceKm(here.lat, here.lng, seen.lat, seen.lng);
      const me = selfCandidate(mover);
      const kind = pickKind(me, r, connected.has(r.id));
      if (!kind) continue;
      if (!withinReach(km, moverPrefs.notifyRadiusKm, seen.placed)) continue;

      if (await write(moverId, r.id, kind, me, r, seen, km)) written++;
    }
  }

  return written;
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
      },
      [asPoolEntry(subject)],
      { surface: "open", limit: 1 }
    );
    if (m) return "match_nearby";
  }

  if (recipient.prefs.notifyInterests) {
    const mine = new Set(recipient.interests ?? []);
    if ((subject.interests ?? []).some((i) => mine.has(i))) return "interest_nearby";
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

/**
 * Write one, unless we've said it recently or said too much today.
 *
 * Both caps are per recipient, and both are checked here rather than in the
 * caller so there is no path that skips them.
 */
async function write(
  recipientId: string,
  actorId: string,
  kind: AlertKind,
  recipient: Candidate,
  subject: Intents,
  seen: { placed: "exact" | "base" | "live"; label: string | null },
  km: number
): Promise<boolean> {
  if (!db) return false;

  const since = new Date(Date.now() - ALERT_REPEAT_DAYS * 86_400_000);
  const [repeat] = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, recipientId),
        eq(notifications.actorId, actorId),
        eq(notifications.kind, kind),
        gt(notifications.createdAt, since)
      )
    )
    .limit(1);
  if (repeat) return false;

  const dayAgo = new Date(Date.now() - 86_400_000);
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, recipientId), gt(notifications.createdAt, dayAgo)));
  if (n >= ALERT_DAILY_CAP) return false;

  // The matcher's sentence, written once — recomputing it next week would
  // be answering a different question with today's profile.
  const [m] = matchesFor(
    {
      id: "me",
      lookingFor: recipient.lookingFor ?? [],
      canHelpWith: recipient.canHelpWith ?? [],
      interests: recipient.interests ?? [],
    },
    [asPoolEntry(subject)],
    { surface: "open", limit: 1 }
  );

  await db.insert(notifications).values({
    userId: recipientId,
    actorId,
    kind,
    reason: m?.reason ?? null,
    placeLabel: seen.label,
    // Null for a city-level position: the number would imply a precision
    // that person never published.
    distanceKm: seen.placed === "base" ? null : Math.round(km * 10) / 10,
  });
  return true;
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
