import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { db, hasDb } from "./db";
import { memberships, pinJoins, pins, users } from "./db/schema";
import { distanceKm } from "./geo";

// Re-exported for server callers; the constants themselves live in rules.ts
// so client components can import them without pulling in the database.
export { PIN_DURATIONS, MAX_PIN_MESSAGE } from "./rules";

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

  const audienceOk = opts.viewerId
    ? or(
        eq(pins.audience, "open"),
        eq(pins.userId, opts.viewerId),
        sql`exists (
          select 1 from ${memberships} mine
          join ${memberships} theirs on theirs.board_id = mine.board_id
          where mine.user_id = ${opts.viewerId} and theirs.user_id = ${pins.userId}
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
      expiresAt: pins.expiresAt,
      userId: users.id,
      name: users.name,
      headline: users.headline,
      photoUrl: users.photoUrl,
    })
    .from(pins)
    .innerJoin(users, eq(users.id, pins.userId))
    .where(and(liveNow(), audienceOk))
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
        expiresAt: r.expiresAt.toISOString(),
        minutesLeft: Math.max(0, Math.round((r.expiresAt.getTime() - Date.now()) / 60_000)),
        person: { id: r.userId, name: r.name!, headline: r.headline, photoUrl: r.photoUrl },
        joined: mine.filter((j) => j.name).map((j) => ({ id: j.userId, name: j.name!, photoUrl: j.photoUrl })),
        mine: r.userId === opts.viewerId,
        joinedByMe: mine.some((j) => j.userId === opts.viewerId),
        distanceKm: centre ? distanceKm(centre.lat, centre.lng, r.lat, r.lng) : null,
      };
    })
    .filter((p) => opts.radiusKm == null || p.distanceKm == null || p.distanceKm <= opts.radiusKm);
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
