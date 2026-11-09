import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db, hasDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { createSession, setSessionCookie } from "@/lib/session";
import { identityFromCode, linkedinEnabled, LINKEDIN_STATE_COOKIE } from "@/lib/linkedin";

/**
 * Back from LinkedIn, with a code or with an excuse.
 *
 * Every failure lands on the map with `?panel=signin&li=…` rather than
 * rendering an error page: somebody who just tried to sign in should be
 * looking at the thing they were trying to get into, with the other way
 * in — the email field — already in front of them.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const back = (why: string) => NextResponse.redirect(`${origin}/?panel=signin&li=${why}`);

  if (!hasDb || !db || !linkedinEnabled) return back("unavailable");

  // The member pressed cancel, or LinkedIn refused the app.
  if (url.searchParams.get("error")) return back("cancelled");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const store = await cookies();
  const expected = store.get(LINKEDIN_STATE_COOKIE)?.value;
  // Burned whatever happens: a state that survives one attempt is a state
  // that can be replayed.
  store.delete(LINKEDIN_STATE_COOKIE);

  if (!code || !state || !expected || state !== expected) return back("state");

  const who = await identityFromCode({ code, origin });
  if (!who) return back("failed");

  /**
   * Same person, one row.
   *
   * By LinkedIn's subject first, then by the verified email — which is
   * what links somebody who signed up with a code months ago to the
   * LinkedIn button they just pressed, instead of handing them a second,
   * empty account and a map that has forgotten them.
   */
  let [user] = await db.select().from(users).where(eq(users.linkedinSub, who.sub)).limit(1);
  if (!user) {
    [user] = await db.select().from(users).where(eq(users.email, who.email)).limit(1);
  }

  if (!user) {
    // New: take the name and picture, which is most of the first
    // onboarding step done before they have typed anything.
    [user] = await db
      .insert(users)
      .values({
        email: who.email,
        linkedinSub: who.sub,
        name: who.name,
        photoUrl: who.picture,
      })
      .returning();
  } else {
    /**
     * Only ever fills blanks.
     *
     * Somebody who set their own name or uploaded their own photo chose
     * those, and a later LinkedIn sign-in is not a reason to overwrite
     * them with whatever their employer's profile picture happens to be.
     */
    await db
      .update(users)
      .set({
        linkedinSub: who.sub,
        ...(user.name ? {} : { name: who.name }),
        ...(user.photoUrl ? {} : { photoUrl: who.picture }),
      })
      .where(eq(users.id, user.id));
    user = { ...user, name: user.name ?? who.name, photoUrl: user.photoUrl ?? who.picture };
  }

  await setSessionCookie(await createSession(user.id));

  // Straight on to the part LinkedIn cannot answer: what they're looking
  // for and what they can help with.
  return NextResponse.redirect(`${origin}/?panel=profile`);
}
