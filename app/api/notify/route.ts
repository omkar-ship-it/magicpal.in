import { NextResponse } from "next/server";
import { sendNotifyEmail } from "@/lib/email";
import {
  ACTIVITY_GAP_MINUTES,
  DIGEST_GAP_HOURS,
  buildActivityEmails,
  buildDailyMatches,
  claimActivity,
  claimDigest,
  type Notification,
} from "@/lib/notify";

export const maxDuration = 60;

/**
 * The two outbound jobs, behind one route.
 *
 * `?job=activity` — somebody is waiting on you. Run often; the gap in
 * lib/notify, not the cron interval, is what decides whether anybody
 * actually gets mail, so running it every ten minutes and every hour
 * produce the same emails at different latencies.
 *
 * `?job=daily` — who is worth meeting near you.
 *
 * **Dry run unless `send=1`.** This is not a debugging convenience: the
 * failure mode of this route is not an exception, it is a tactless email
 * to a real person that cannot be recalled, and the only way to catch
 * that is to read the copy before it goes.
 *
 * Guarded by a shared secret rather than a session, because a cron has
 * none. Fails closed when CRON_SECRET is unset, which is the correct
 * resting state for a deployment that has not thought about it — Vercel
 * Cron sends exactly this header when the variable exists.
 */
function authorised(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return req.headers.get("authorization") === `Bearer ${expected}`;
}

export async function GET(req: Request) {
  if (!authorised(req)) return NextResponse.json({ error: "Not authorised." }, { status: 401 });

  const url = new URL(req.url);
  const job = url.searchParams.get("job") === "daily" ? "daily" : "activity";
  const send = url.searchParams.get("send") === "1";
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.opennetworks.in";

  const batch: Notification[] =
    job === "daily" ? await buildDailyMatches() : await buildActivityEmails();

  if (!send) {
    return NextResponse.json({
      job,
      dryRun: true,
      gap: job === "daily" ? `${DIGEST_GAP_HOURS}h` : `${ACTIVITY_GAP_MINUTES}m`,
      wouldSend: batch.length,
      preview: batch.map((n) => ({ to: n.email, headline: n.headline, lines: n.lines })),
    });
  }

  let sent = 0;
  const failed: string[] = [];
  const skipped: string[] = [];
  for (const n of batch) {
    // Claimed before the send. A crash between the two costs this person
    // one email this cycle; the other order costs them two.
    const claimed = job === "daily" ? await claimDigest(n.userId) : await claimActivity(n.userId);
    if (!claimed) {
      skipped.push(n.email);
      continue;
    }
    const res = await sendNotifyEmail({
      to: n.email,
      firstName: n.firstName,
      headline: n.headline,
      lines: n.lines,
      ctaLabel: n.ctaLabel,
      ctaUrl: `${base}${n.ctaPath}`,
      unsubscribeUrl: `${base}/unsubscribe?t=${n.unsubscribeToken}`,
      logLabel: job,
    });
    if (res.ok) sent++;
    else failed.push(n.email);
  }
  return NextResponse.json({ job, dryRun: false, considered: batch.length, sent, failed, skipped });
}
