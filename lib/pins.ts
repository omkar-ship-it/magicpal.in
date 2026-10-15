import { and, desc, eq, gt, gte, isNull, lte, or, sql } from "drizzle-orm";
import { db, hasDb } from "./db";
import { memberships, pinJoins, pins, users } from "./db/schema";
import { distanceKm } from "./geo";

import { activeAliasSql } from "./membership";
import { LIVE_STALE_MINUTES, MAX_PIN_REACH_KM, reachNeedsPrecise } from "./rules";

// Re-exported for server callers; the constants themselves live in rules.ts
// so client components can import them without pulling in the database.
export { PIN_DURATIONS, MAX_PIN_MESSAGE, PIN_REACHES, DEFAULT_PIN_REACH_KM } from "./rules";

/**
 * Ad-hoc pins: somebody is somewhere now and would rather not be alone.
 *
 * Liveness is a read-time condition, never a stored flag — `expiresAt > now
 * and endedAt is null` is the only definition, applied in one place here so
 * no caller can accidentally surface a pin from last Tuesday. There is no
 * cron and nothing to sweep: an expired pin simply stops being returned.
 */

export type PinRef = {
  id: string;
  lat: number;
  lng: number;
  placeLabel: string | null;
  message: string;
  topic: string | null;
  audience: string;
  /** How far the dropper let this carry — see PIN_REACHES. */
  reachKm: number;
  expiresAt: string;
  minutesLeft: number;
  person: { id: string; name: string; headline: string | null; photoUrl: string | null };
  /** Faces of whoever said they're coming, plus whether you're one of them. */
  joined: Array<{ id: string; name: string; photoUrl: string | null }>;
  mine: boolean;
  joinedByMe: boolean;
  distanceKm: number | null;
};

/** The live condition, in one place so nothing can define it differently. */
const liveNow = () => and(gt(pins.expiresAt, new Date()), isNull(pins.endedAt));

/**
 * Where the *viewer* actually is, and how well we know it.
 *
 * Looked up here from the session id rather than accepted as an argument,
 * and deliberately so: a pin's reach is only meaningful if it's measured
 * from where the reader is standing. The map centre is a camera — it pans,
 * and the client chooses it — so enforcing reach against it would let
 * anyone see a 150 m pin by scrolling to the café. There is no parameter a
 * caller can pass to influence this.
 *
 * `precise` separates a coordinate that can answer "which building" from
 * one that can only answer "which city". A live position gone stale decays
 * to the city centroid, same rule as `place()` in lib/profiles — somebody
 * who closed the tab this morning is not in the room now.
 */
async function viewerPosition(
  viewerId: string
): Promise<{ lat: number; lng: number; precise: boolean } | null> {
  if (!hasDb || !db) return null;
  const [me] = await db
    .select({
      lat: users.lat,
      lng: users.lng,
      baseLat: users.baseLat,
      baseLng: users.baseLng,
      visibility: users.visibility,
      liveAt: users.liveAt,
    })
    .from(users)
    .where(eq(users.id, viewerId))
    .limit(1);
  if (!me) return null;

  const liveFresh =
    me.visibility === "live" &&
    me.liveAt != null &&
    Date.now() - new Date(me.liveAt).getTime() < LIVE_STALE_MINUTES * 60_000;

  // 'off' lands here too, on purpose. Turning yourself off hides you from
  // other people; it doesn't promise that a position you pinned at some
  // point is still where you are, so it buys the coarse treatment.
  if ((liveFresh || me.visibility === "exact") && me.lat != null && me.lng != null) {
    return { lat: me.lat, lng: me.lng, precise: true };
  }
  if (me.baseLat != null && me.baseLng != null) {
    return { lat: me.baseLat, lng: me.baseLng, precise: false };
  }
  if (me.lat != null && me.lng != null) return { lat: me.lat, lng: me.lng, precise: false };
  return null;
}

/**
 * Pins this viewer may see.
 *
 * An `open` pin is visible to anyone nearby. A `communities` pin only to
 * people who share a community with the dropper — checked in SQL rather
 * than filtered afterwards, because "who may see this" is exactly the sort
 * of thing that must not depend on a client remembering to ask.
 */
export async function livePinsFor(opts: {
  viewerId?: string;
  centerLat?: number;
  centerLng?: number;
  radiusKm?: number;
}): Promise<PinRef[]> {
  if (!hasDb || !db) return [];

  // A pin is somebody's real-time physical location — the most sensitive
  // thing this product holds. Reach is measured from the reader's own
  // position, so a visitor with no position has nothing to be near and sees
  // nothing. That also means these never leak to an anonymous scraper.
  if (!opts.viewerId) return [];
  const here = await viewerPosition(opts.viewerId);

  // Nothing carries past the widest reach, so nothing further is worth
  // loading. A box, not a circle — it's a prefilter, and the exact distance
  // test below is what actually decides. Your own pin comes back regardless
  // of where you've wandered since dropping it.
  const box = here ? boxAround(here, MAX_PIN_REACH_KM) : null;
  const inRange = box
    ? or(
        eq(pins.userId, opts.viewerId),
        and(
          gte(pins.lat, box.minLat),
          lte(pins.lat, box.maxLat),
          gte(pins.lng, box.minLng),
          lte(pins.lng, box.maxLng)
        )
      )
    : eq(pins.userId, opts.viewerId);

  const audienceOk = opts.viewerId
    ? or(
        eq(pins.audience, "open"),
        eq(pins.userId, opts.viewerId),
        sql`exists (
          select 1 from ${memberships} mine
          join ${memberships} theirs on theirs.board_id = mine.board_id
          where mine.user_id = ${opts.viewerId} and theirs.user_id = ${pins.userId}
            and ${activeAliasSql("mine")} and ${activeAliasSql("theirs")}
        )`
      )
    : eq(pins.audience, "open");

  const rows = await db
    .select({
      id: pins.id,
      lat: pins.lat,
      lng: pins.lng,
      placeLabel: pins.placeLabel,
      message: pins.message,
      topic: pins.topic,
      audience: pins.audience,
      reachKm: pins.reachKm,
      expiresAt: pins.expiresAt,
      userId: users.id,
      name: users.name,
      headline: users.headline,
      photoUrl: users.photoUrl,
    })
    .from(pins)
    .innerJoin(users, eq(users.id, pins.userId))
    .where(and(liveNow(), audienceOk, inRange))
    .orderBy(desc(pins.createdAt))
    .limit(80);

  if (rows.length === 0) return [];

  const joins = await db
    .select({
      pinId: pinJoins.pinId,
      userId: users.id,
      name: users.name,
      photoUrl: users.photoUrl,
    })
    .from(pinJoins)
    .innerJoin(users, eq(users.id, pinJoins.userId))
    .where(sql`${pinJoins.pinId} in ${rows.map((r) => r.id)}`);

  const centre =
    opts.centerLat != null && opts.centerLng != null ? { lat: opts.centerLat, lng: opts.centerLng } : null;

  return rows
    .filter((r) => r.name)
    .map((r) => {
      const mine = joins.filter((j) => j.pinId === r.id);
      return {
        id: r.id,
        lat: r.lat,
        lng: r.lng,
        placeLabel: r.placeLabel,
        message: r.message,
        topic: r.topic,
        audience: r.audience,
        reachKm: r.reachKm,
        expiresAt: r.expiresAt.toISOString(),
        minutesLeft: Math.max(0, Math.round((r.expiresAt.getTime() - Date.now()) / 60_000)),
        person: { id: r.userId, name: r.name!, headline: r.headline, photoUrl: r.photoUrl },
        joined: mine.filter((j) => j.name).map((j) => ({ id: j.userId, name: j.name!, photoUrl: j.photoUrl })),
        mine: r.userId === opts.viewerId,
        joinedByMe: mine.some((j) => j.userId === opts.viewerId),
        distanceKm: centre ? distanceKm(centre.lat, centre.lng, r.lat, r.lng) : null,
      };
    })
    // Two independent limits, and the narrower always wins. The dropper's
    // reach is measured from where you are; your own radius filter is
    // measured from where you're looking.
    .filter((p) => p.mine || reaches(p, here))
    .filter((p) => opts.radiusKm == null || p.distanceKm == null || p.distanceKm <= opts.radiusKm);
}

/**
 * Does this pin carry as far as the viewer?
 *
 * Fails closed in both directions: no position at all means nothing
 * reaches you, and a reach tight enough to mean "this building" is refused
 * to a city-centroid reader rather than guessed at. Showing a 150 m pin to
 * somebody who merely shares the city would break the one promise the
 * dropper made when they chose it.
 */
function reaches(
  pin: { lat: number; lng: number; reachKm: number },
  here: { lat: number; lng: number; precise: boolean } | null
): boolean {
  if (!here) return false;
  if (reachNeedsPrecise(pin.reachKm) && !here.precise) return false;
  return distanceKm(here.lat, here.lng, pin.lat, pin.lng) <= pin.reachKm;
}

/** A degree of latitude is ~111 km everywhere; longitude shrinks with it. */
function boxAround(c: { lat: number; lng: number }, km: number) {
  const dLat = km / 110.574;
  // Guard the pole case, where a kilometre of longitude stops being a
  // meaningful number of degrees at all.
  const shrink = Math.max(Math.cos((c.lat * Math.PI) / 180), 0.01);
  const dLng = km / (111.32 * shrink);
  return {
    minLat: c.lat - dLat,
    maxLat: c.lat + dLat,
    minLng: c.lng - dLng,
    maxLng: c.lng + dLng,
  };
}

/**
 * Drop one, replacing any you already had live.
 *
 * At most one per person on purpose: two pins from the same person in two
 * places is a question the map can't answer, and the second one is almost
 * always a correction rather than a second invitation.
 */
export async function dropPin(input: {
  userId: string;
  lat: number;
  lng: number;
  placeLabel?: string | null;
  message: string;
  topic?: string | null;
  audience: string;
  reachKm: number;
  minutes: number;
}): Promise<string | null> {
  if (!hasDb || !db) return null;

  await db
    .update(pins)
    .set({ endedAt: new Date() })
    .where(and(eq(pins.userId, input.userId), liveNow()));

  const [row] = await db
    .insert(pins)
    .values({
      userId: input.userId,
      lat: input.lat,
      lng: input.lng,
      placeLabel: input.placeLabel ?? null,
      message: input.message,
      topic: input.topic ?? null,
      audience: input.audience,
      reachKm: input.reachKm,
      expiresAt: new Date(Date.now() + input.minutes * 60_000),
    })
    .returning();
  return row?.id ?? null;
}

/** Take it down early — you left, or it's done. */
export async function endPin(pinId: string, userId: string): Promise<boolean> {
  if (!hasDb || !db) return false;
  const [row] = await db
    .select({ id: pins.id })
    .from(pins)
    .where(and(eq(pins.id, pinId), eq(pins.userId, userId)))
    .limit(1);
  if (!row) return false;
  await db.update(pins).set({ endedAt: new Date() }).where(eq(pins.id, pinId));
  return true;
}

/**
 * Say you're coming, or take it back.
 *
 * Deliberately not a connection request: answering "I'm in a café" should
 * cost one tap, and the two of you can connect properly once you've
 * actually met. Only works on a live pin — joining something that already
 * ended would just be a false promise to whoever dropped it.
 */
export async function togglePinJoin(pinId: string, userId: string): Promise<"joined" | "left" | null> {
  if (!hasDb || !db) return null;

  const [pin] = await db
    .select({ id: pins.id })
    .from(pins)
    .where(and(eq(pins.id, pinId), liveNow()))
    .limit(1);
  if (!pin) return null;

  const [existing] = await db
    .select({ id: pinJoins.id })
    .from(pinJoins)
    .where(and(eq(pinJoins.pinId, pinId), eq(pinJoins.userId, userId)))
    .limit(1);

  if (existing) {
    await db.delete(pinJoins).where(eq(pinJoins.id, existing.id));
    return "left";
  }
  await db.insert(pinJoins).values({ pinId, userId });
  return "joined";
}

/** The viewer's own live pin, if they have one. */
export async function myLivePin(userId: string): Promise<{ id: string; message: string; expiresAt: string } | null> {
  if (!hasDb || !db) return null;
  const [row] = await db
    .select({ id: pins.id, message: pins.message, expiresAt: pins.expiresAt })
    .from(pins)
    .where(and(eq(pins.userId, userId), liveNow()))
    .limit(1);
  return row ? { id: row.id, message: row.message, expiresAt: row.expiresAt.toISOString() } : null;
}
