import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db, hasDb } from "./db";
import { sessions, users } from "./db/schema";

const SESSION_COOKIE = "mp_session";
const SESSION_DAYS = 30;

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  headline: string | null;
  photoUrl: string | null;
  /**
   * Carried on the session because nearly every screen needs to say whether
   * you're on the open map — and a person who can't tell at a glance
   * assumes the worst, which for a location product means assuming they're
   * exposed. See users.visibility for what the values mean.
   */
  visibility: "off" | "base" | "exact" | "live";
  /** True once name is set — onboarding is the gate for everything else. */
  onboarded: boolean;
};

/**
 * Session ids are uuids and the column is typed `uuid`, so anything else
 * makes Postgres throw rather than return no rows — a junk cookie value
 * would otherwise be a 500 on every page, including the one you'd go to in
 * order to sign out. A cookie we didn't issue just means "signed out".
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createSession(userId: string): Promise<string> {
  if (!hasDb || !db) throw new Error("Accounts require a database connection.");
  const [row] = await db
    .insert(sessions)
    .values({ userId, expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000) })
    .returning();
  return row.id;
}

export async function setSessionCookie(sessionId: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  if (!hasDb || !db) return null;
  const store = await cookies();
  const sid = store.get(SESSION_COOKIE)?.value;
  if (!sid || !UUID.test(sid)) return null;

  const [row] = await db
    .select({
      sessionExpiresAt: sessions.expiresAt,
      id: users.id,
      email: users.email,
      name: users.name,
      headline: users.headline,
      photoUrl: users.photoUrl,
      visibility: users.visibility,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, sid))
    .limit(1);

  if (!row || row.sessionExpiresAt.getTime() < Date.now()) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    headline: row.headline,
    photoUrl: row.photoUrl,
    visibility: row.visibility as SessionUser["visibility"],
    onboarded: Boolean(row.name),
  };
}
