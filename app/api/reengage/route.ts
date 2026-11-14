import { NextResponse } from "next/server";
import { BRAND_NAME } from "@/lib/brand";
import { sendNotifyEmail } from "@/lib/email";
import { buildReengagements, claimForSend, DEFAULT_COOLDOWN_DAYS, DEFAULT_IDLE_DAYS } from "@/lib/reengage";

export const maxDuration = 60;

/**
 * Run the re-engagement batch.
 *
 * **Dry run by default.** A GET with no `send=1` reports exactly who
 * would be mailed and what each would say, and touches nothing. That is
 * not a debugging convenience — it is the only way to read the copy that
 * is about to go to real people before it goes, and this job's failure
 * mode is not an exception, it is a tactless email that cannot be
 * recalled.
 *
 * Guarded by a shared secret rather than a session: a cron has no
 * session, and this must never be reachable by a signed-in curious user.
 * Vercel Cron sends its own bearer; a human runs it with the same header
 * by hand.
 */
function authorised(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  // Fails closed. With no secret configured nobody can fire this, which
  // is the right state for a deployment that has not thought about it.
  if (!expected) return false;
  const given = req.headers.get("authorization");
  return given === `Bearer ${expected}`;
}

export async function GET(req: Request) {
  if (!authorised(req)) return NextResponse.json({ error: "Not authorised." }, { status: 401 });

  const url = new URL(req.url);
  const send = url.searchParams.get("send") === "1";
  const idleDays = Number(url.searchParams.get("idleDays")) || DEFAULT_IDLE_DAYS;
  const limit = Math.min(Number(url.searchParams.get("limit")) || 100, 500);

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.opennetworks.in";
  const batch = await buildReengagements({ idleDays, limit });

  if (!send) {
    return NextResponse.json({
      dryRun: true,
      brand: BRAND_NAME,
      idleDays,
      cooldownDays: DEFAULT_COOLDOWN_DAYS,
      wouldSend: batch.length,
      preview: batch.map((r) => ({ to: r.email, headline: r.headline, lines: r.lines })),
    });
  }

  let sent = 0;
  const failed: string[] = [];
  const skipped: string[] = [];
  for (const r of batch) {
    // Claimed before the send, not after. A crash between the two costs
    // one person one email this month; the other order costs them two.
    if (!(await claimForSend(r.userId))) {
      skipped.push(r.email);
      continue;
    }
    const res = await sendNotifyEmail({
      to: r.email,
      firstName: r.firstName,
      headline: r.headline,
      lines: r.lines,
      ctaLabel: "Open the map",
      ctaUrl: base,
      unsubscribeUrl: `${base}/unsubscribe?t=${r.unsubscribeToken}`,
      logLabel: "reengage",
    });
    if (res.ok) sent++;
    else failed.push(r.email);
  }
  return NextResponse.json({ dryRun: false, considered: batch.length, sent, failed, skipped });
}
