import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import {
  alertControls,
  pushConfigured,
  pushDeviceCount,
  removePushSubscription,
  savePushSubscription,
  setMutedUntil,
  setQuietHours,
} from "@/lib/push";

/**
 * The device's end of the permission grant.
 *
 * A subscription is a capability the browser's push service hands out, and
 * the only things this route does are remember it, forget it, and carry
 * the two controls that make it stop. Nothing here decides what gets sent
 * — that is lib/alerts, and it is on the other side of the scan.
 */

/** What the client needs to know before it offers the prompt. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const controls = await alertControls(user.id);
  return NextResponse.json({
    configured: pushConfigured,
    devices: await pushDeviceCount(user.id),
    ...controls,
  });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!pushConfigured) {
    return NextResponse.json({ error: "Push isn't set up on this deployment." }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const sub = body?.subscription;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return NextResponse.json({ error: "That isn't a push subscription." }, { status: 400 });
  }

  /**
   * The offset comes from the device, not from the server.
   *
   * Quiet hours have to be the local night of the phone that will ring,
   * and the server has no way to know that — an IP guess is wrong for
   * anybody travelling, which on a product about being somewhere is most
   * of the interesting cases.
   */
  const raw = Number(body?.tzOffsetMinutes);
  const tzOffsetMinutes = Number.isFinite(raw) && Math.abs(raw) <= 14 * 60 ? Math.round(raw) : 330;

  await savePushSubscription(
    user.id,
    { endpoint: String(sub.endpoint), keys: { p256dh: String(sub.keys.p256dh), auth: String(sub.keys.auth) } },
    { tzOffsetMinutes, userAgent: req.headers.get("user-agent") }
  );
  return NextResponse.json({ ok: true, devices: await pushDeviceCount(user.id) });
}

/**
 * Quiet hours, and "not now".
 *
 * Both live here rather than on /api/profile because neither is a profile
 * field — they are properties of how this account is being interrupted,
 * and they are the controls somebody reaches for while a notification is
 * still on their screen.
 */
export async function PATCH(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const body = await req.json().catch(() => null);

  if ("quietHours" in (body ?? {})) {
    await setQuietHours(user.id, Boolean(body.quietHours));
  }
  // Hours from now, or null to resume. Capped at a month: a pause nobody
  // can remember setting is an opt-out wearing a friendlier label.
  if ("muteHours" in (body ?? {})) {
    const h = Number(body.muteHours);
    const until = Number.isFinite(h) && h > 0 ? new Date(Date.now() + Math.min(h, 744) * 3600_000) : null;
    await setMutedUntil(user.id, until);
  }
  return NextResponse.json({ ok: true });
}

/** Forget this device — or, with no endpoint, every device on the account. */
export async function DELETE(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const body = await req.json().catch(() => null);
  await removePushSubscription(user.id, body?.endpoint ? String(body.endpoint) : undefined);
  return NextResponse.json({ ok: true, devices: await pushDeviceCount(user.id) });
}
