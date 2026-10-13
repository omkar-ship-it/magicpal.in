import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, hasDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/session";

/**
 * A live position push from the browser.
 *
 * Only writes while the person's visibility is actually `live` — a stale
 * tab left open in another window must not be able to keep updating a
 * location for somebody who has since gone private. The check is here
 * rather than in the client for exactly that reason.
 */
export async function POST(req: Request) {
  if (!hasDb || !db) return NextResponse.json({ error: "Not available." }, { status: 503 });

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (user.visibility !== "live") {
    return NextResponse.json({ error: "Live sharing is off." }, { status: 409 });
  }

  const body = await req.json().catch(() => null);
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "Bad coordinates." }, { status: 400 });
  }

  await db.update(users).set({ lat, lng, liveAt: new Date() }).where(eq(users.id, user.id));
  return NextResponse.json({ ok: true });
}

/** Stop sharing without changing anything else about the profile. */
export async function DELETE() {
  if (!hasDb || !db) return NextResponse.json({ error: "Not available." }, { status: 503 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  // Drops to the city they already chose rather than off the map entirely:
  // ending a live session is not the same as going private, and silently
  // doing the stronger thing would be its own surprise.
  await db.update(users).set({ visibility: "base", liveAt: null }).where(eq(users.id, user.id));
  return NextResponse.json({ ok: true });
}
