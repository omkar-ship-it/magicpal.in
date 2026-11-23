import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, hasDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/session";
import { LINKEDIN_HELP, normalizeLinkedin } from "@/lib/linkedinProfile";

/**
 * Just the LinkedIn link — for the one-field prompt existing members get
 * on their next visit. The full profile form needs every field and would
 * be the wrong tool for one.
 */
export async function POST(req: Request) {
  if (!hasDb || !db) return NextResponse.json({ error: "Not available right now." }, { status: 503 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const linkedinUrl = normalizeLinkedin(body?.linkedinUrl);
  if (!linkedinUrl) return NextResponse.json({ error: LINKEDIN_HELP }, { status: 400 });
  await db.update(users).set({ linkedinUrl }).where(eq(users.id, user.id));
  return NextResponse.json({ ok: true, linkedinUrl });
}
