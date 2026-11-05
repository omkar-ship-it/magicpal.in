import "server-only";
import webpush from "web-push";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, hasDb } from "./db";
import { pushSubscriptions, users } from "./db/schema";
import { LEGAL } from "./legal";

/**
 * Getting an alert onto a lock screen.
 *
 * The alert engine in lib/alerts.ts decides *whether* somebody should be
 * told something, and writes a row. Everything here is about the last
 * hop — and the last hop is the one that can get this product deleted.
 *
 * Three rules, none optional:
 *
 * 1. **Push carries no new information.** The payload says what the inbox
 *    row already says, and the inbox row has already been through
 *    `place()`. There is no path from here to a coordinate.
 * 2. **Nothing is sent that the recipient did not ask for.** A browser
 *    permission grant is consent to be interrupted, not consent to any
 *    particular kind of alert — the per-kind preferences in lib/alerts
 *    still decide what gets written, and a muted or quiet-hours account
 *    gets nothing even when a row exists.
 * 3. **One interruption per scan.** Four alerts arriving as four buzzes
 *    is not four times the information. They collapse into one.
 */

// Either name works. The key is read on the server and served from
// /api/push, so the NEXT_PUBLIC_ prefix is no longer load-bearing — it is
// accepted only so an existing deployment keeps working.
const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";

/**
 * Whether push can work at all right now.
 *
 * Deliberately a runtime check rather than a build-time one: the keys are
 * environment config, a deploy without them is a perfectly valid deploy,
 * and the feature's job in that case is to be invisible rather than to
 * crash a page that has nothing to do with it.
 */
export const pushConfigured = Boolean(PUBLIC_KEY && PRIVATE_KEY);

/**
 * The server identity a subscription is bound to, handed to the browser.
 *
 * Served rather than inlined at build time. It is public by definition —
 * it ends up in every subscription the browser creates — so the only
 * thing `NEXT_PUBLIC_` bought was a build-time dependency on a variable
 * that Vercel now marks sensitive by default, which is exactly the kind
 * of coupling that fails silently in production and nowhere else.
 */
export const pushPublicKey = PUBLIC_KEY;

if (pushConfigured) {
  webpush.setVapidDetails(`mailto:${LEGAL.supportEmail}`, PUBLIC_KEY, PRIVATE_KEY);
}

export type PushSub = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

/**
 * Remember a device.
 *
 * Upsert on the endpoint, not on the user: a browser hands out the same
 * endpoint for the same installation, and re-subscribing after a key
 * rotation or a sign-out/sign-in should move the row rather than leave a
 * stale one pointing at the previous account.
 */
export async function savePushSubscription(
  userId: string,
  sub: PushSub,
  meta: { tzOffsetMinutes: number; userAgent: string | null }
): Promise<void> {
  if (!hasDb || !db) return;
  await db
    .insert(pushSubscriptions)
    .values({
      userId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      tzOffsetMinutes: meta.tzOffsetMinutes,
      userAgent: meta.userAgent?.slice(0, 300) ?? null,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        userId,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        tzOffsetMinutes: meta.tzOffsetMinutes,
        userAgent: meta.userAgent?.slice(0, 300) ?? null,
      },
    });
}

/** Forget one device, or all of this account's. */
export async function removePushSubscription(userId: string, endpoint?: string): Promise<void> {
  if (!hasDb || !db) return;
  await db
    .delete(pushSubscriptions)
    .where(
      endpoint
        ? and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint))
        : eq(pushSubscriptions.userId, userId)
    );
}

export async function pushDeviceCount(userId: string): Promise<number> {
  if (!hasDb || !db) return 0;
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
  return rows[0]?.n ?? 0;
}

/**
 * The window in which a phone is allowed to make a noise, in local hours.
 *
 * 08:00 to 22:00. Not configurable, deliberately: a time-range picker is
 * four taps and a decision nobody wants to make, and the honest default
 * covers almost everyone. The switch is on or off.
 */
const WAKE_HOUR = 8;
const SLEEP_HOUR = 22;

function withinQuietHours(tzOffsetMinutes: number, now = new Date()): boolean {
  const localHour = (now.getUTCHours() + now.getUTCMinutes() / 60 + tzOffsetMinutes / 60 + 24) % 24;
  return localHour < WAKE_HOUR || localHour >= SLEEP_HOUR;
}

export type PushNote = {
  title: string;
  body: string;
  /** Where tapping it lands. Same-origin paths only — see the service worker. */
  url: string;
  /** Collapses older unread pushes from the same stream on the device. */
  tag?: string;
};

/**
 * Send one interruption to every device this person has, if they are
 * currently willing to be interrupted.
 *
 * Returns how many devices accepted it. Never throws: a push failing is
 * not a reason for the thing that triggered it to fail, and the caller
 * here is a proximity scan running off somebody else's location update.
 */
export async function sendPushToUser(userId: string, note: PushNote): Promise<number> {
  if (!pushConfigured || !hasDb || !db) return 0;

  const [who] = await db
    .select({ mutedUntil: users.alertsMutedUntil, quiet: users.pushQuietHours })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!who) return 0;
  if (who.mutedUntil && who.mutedUntil.getTime() > Date.now()) return 0;

  const devices = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
  if (devices.length === 0) return 0;

  const payload = JSON.stringify(note);
  const dead: string[] = [];
  let sent = 0;

  await Promise.all(
    devices.map(async (d) => {
      // Each device decides its own night. Somebody signed in from two
      // timezones should have each phone stay quiet on its own.
      if (who.quiet && withinQuietHours(d.tzOffsetMinutes)) return;
      try {
        await webpush.sendNotification(
          { endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } },
          payload,
          { TTL: 60 * 30, urgency: "normal" }
        );
        sent++;
      } catch (err) {
        /**
         * 404 and 410 are the push service telling us this endpoint is
         * gone for good — app uninstalled, permission revoked, browser
         * data cleared. Anything else (429, 5xx, a timeout) is this
         * attempt failing, not the subscription, and deleting on those
         * would quietly unsubscribe people during an outage.
         */
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) dead.push(d.endpoint);
      }
    })
  );

  if (dead.length > 0) {
    await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.endpoint, dead));
  }
  if (sent > 0) {
    await db
      .update(pushSubscriptions)
      .set({ lastOkAt: new Date() })
      .where(eq(pushSubscriptions.userId, userId));
  }
  return sent;
}

/** Whether anybody on this account could receive a push at all. */
export async function hasLivePushTarget(userId: string): Promise<boolean> {
  if (!pushConfigured || !hasDb || !db) return false;
  const rows = await db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId))
    .limit(1);
  return rows.length > 0;
}

/** Accounts among these that have at least one device. One query, not N. */
export async function usersWithPush(userIds: string[]): Promise<Set<string>> {
  if (!pushConfigured || !hasDb || !db || userIds.length === 0) return new Set();
  const rows = await db
    .selectDistinct({ userId: pushSubscriptions.userId })
    .from(pushSubscriptions)
    .where(inArray(pushSubscriptions.userId, userIds));
  return new Set(rows.map((r) => r.userId));
}

/** Null means "not paused"; everything else is a moment in the future. */
export async function setMutedUntil(userId: string, until: Date | null): Promise<void> {
  if (!hasDb || !db) return;
  await db.update(users).set({ alertsMutedUntil: until }).where(eq(users.id, userId));
}

/** The two controls that make it stop, as the panel needs to show them. */
export async function alertControls(
  userId: string
): Promise<{ mutedUntil: string | null; quietHours: boolean }> {
  if (!hasDb || !db) return { mutedUntil: null, quietHours: true };
  const [row] = await db
    .select({ mutedUntil: users.alertsMutedUntil, quiet: users.pushQuietHours })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return {
    mutedUntil: row?.mutedUntil ? row.mutedUntil.toISOString() : null,
    quietHours: row?.quiet ?? true,
  };
}

export async function setQuietHours(userId: string, on: boolean): Promise<void> {
  if (!hasDb || !db) return;
  await db.update(users).set({ pushQuietHours: on }).where(eq(users.id, userId));
}
