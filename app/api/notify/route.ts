import { NextResponse } from "next/server";
import { sendNotifyEmail } from "@/lib/email";
import { DIGEST_GAP_HOURS, buildMorningDigest, claimDigest } from "@/lib/notify";

export const maxDuration = 60;

/**
 * The morning email, as one job.
 *
 * Scheduled in vercel.json at 03:30 UTC — 9am IST. Morning, local, well
 * clear of anybody's quiet hours, and once a day, which is also the most
 * a Hobby-plan cron will run.
 *
 * One job rather than two by choice as well as by constraint: somebody
 * with a connection request *and* three matches wants one email with the
 * urgent thing at the top, not two about the same visit. What goes in it
 * and who gets one is decided in lib/notify.
 *
 * **Dry run unless `send=1`.** Not a debugging convenience: the failure
 * mode of this route is not an exception, it is a tactless email to a
 * real person that cannot be recalled, and reading the copy beforehand
 * is the only thing that catches it.
 *
 * Guarded by a shared secret rather than a session, because a cron has
 * none. Fails closed when CRON_SECRET is unset — the correct resting
 * state for a deployment that has not thought about it. Vercel Cron
 * sends exactly this header once the variable exists.
 */
function authorised(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return req.headers.get("authorization") === `Bearer ${expected}`;
}

export async function GET(req: Request) {
  if (!authorised(req)) return NextResponse.json({ error: "Not authorised." }, { status: 401 });

  const url = new URL(req.url);
  const send = url.searchParams.get("send") === "1";
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.opennetworks.in";

  /**
   * Refuse to run a real send with no template configured.
   *
   * Without this the order of operations is a trap. Each person is
   * claimed — stamped with `digestEmailedAt` — *before* their email is
   * attempted, which is right, because a crash between the two should
   * cost somebody one morning rather than send them two. But with no
   * template every send fails after the claim, so a cron armed before
   * the template exists would mark all of them as mailed, deliver
   * nothing, and lock the whole list out for the next twenty hours.
   *
   * Dry runs stay allowed: reading the copy is exactly what somebody
   * should be doing while the template is still being built.
   */
  if (send && !process.env.MSG91_NOTIFY_TEMPLATE_ID) {
    return NextResponse.json(
      {
        error:
          "No MSG91_NOTIFY_TEMPLATE_ID configured — refusing to send. " +
          "Nobody was marked as emailed. Drop send=1 to preview the copy.",
      },
      { status: 503 }
    );
  }

  const batch = await buildMorningDigest();

  if (!send) {
    return NextResponse.json({
      dryRun: true,
      gapHours: DIGEST_GAP_HOURS,
      wouldSend: batch.length,
      preview: batch.map((n) => ({ to: n.email, headline: n.headline, lines: n.lines, cta: n.ctaPath })),
    });
  }

  let sent = 0;
  const failed: string[] = [];
  const skipped: string[] = [];
  for (const n of batch) {
    // Claimed before the send. A crash between the two costs this person
    // one morning; the other order costs them two emails.
    if (!(await claimDigest(n.userId))) {
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
      logLabel: "morning",
    });
    if (res.ok) sent++;
    else failed.push(n.email);
  }
  return NextResponse.json({ dryRun: false, considered: batch.length, sent, failed, skipped });
}
