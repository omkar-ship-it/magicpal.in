import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { listAlerts, markAlertsRead } from "@/lib/alerts";
import { ALERTS_SHOWN } from "@/lib/rules";

/** What you've been told lately. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  return NextResponse.json({ alerts: await listAlerts(user.id, ALERTS_SHOWN) });
}

/**
 * Opening the inbox is reading it.
 *
 * A separate call rather than a side effect of GET: the badge is fetched
 * with every shell payload, and marking read on a background refresh would
 * clear the dot for something nobody looked at.
 */
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  await markAlertsRead(user.id);
  return NextResponse.json({ ok: true });
}
