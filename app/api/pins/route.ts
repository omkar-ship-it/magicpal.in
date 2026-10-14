import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { dropPin, livePinsFor } from "@/lib/pins";
import { MAX_PIN_MESSAGE, PIN_DURATIONS } from "@/lib/rules";
import { TOPIC_BY_ID } from "@/lib/intents";

/** Live pins this viewer may see. Open to signed-out visitors, like the map. */
export async function GET(req: Request) {
  const user = await getSessionUser();
  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));

  return NextResponse.json({
    pins: await livePinsFor({
      viewerId: user?.id,
      centerLat: Number.isFinite(lat) ? lat : undefined,
      centerLng: Number.isFinite(lng) ? lng : undefined,
    }),
  });
}

/**
 * Drop a pin.
 *
 * Requires a finished profile: the whole value to whoever walks over is
 * knowing who they'd be meeting, and an anonymous "I'm in a café" is an
 * invitation nobody can evaluate.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!user.onboarded) {
    return NextResponse.json({ error: "Finish your profile first — people need to know who they'd be meeting." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim().slice(0, MAX_PIN_MESSAGE) : "";
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  const minutes = PIN_DURATIONS.find((d) => d.minutes === Number(body?.minutes))?.minutes ?? 180;
  const audience = body?.audience === "communities" ? "communities" : "open";
  const topic = TOPIC_BY_ID.has(body?.topic) ? (body.topic as string) : null;

  if (!message) return NextResponse.json({ error: "Say what you're up for." }, { status: 400 });
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "Where are you?" }, { status: 400 });
  }

  const id = await dropPin({
    userId: user.id,
    lat,
    lng,
    placeLabel: typeof body?.placeLabel === "string" ? body.placeLabel.slice(0, 160) : null,
    message,
    topic,
    audience,
    minutes,
  });
  if (!id) return NextResponse.json({ error: "Couldn't drop that." }, { status: 500 });
  return NextResponse.json({ ok: true, id });
}
