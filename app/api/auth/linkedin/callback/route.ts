import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { hasDb } from "@/lib/db";
import { createSession, setSessionCookie } from "@/lib/session";
import {
  identityFromCode,
  linkedinEnabled,
  LINKEDIN_STATE_COOKIE,
  signInWithLinkedIn,
} from "@/lib/linkedin";

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

  if (!hasDb || !linkedinEnabled) return back("unavailable");

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

  const resolved = await signInWithLinkedIn(who);
  if (!resolved) return back("failed");

  await setSessionCookie(await createSession(resolved.userId));

  /**
   * Back to the map, and nothing more specific than that.
   *
   * This used to send everybody to `?panel=profile`, which is right on
   * the first visit and wrong on every one after it — a member who
   * finished weeks ago was dropped into the profile editor each time
   * they signed in, as though the product had forgotten them.
   *
   * The shell already knows the difference and knows it better: it has
   * the whole payload, and `midOnboarding` turns on for anybody with no
   * pin yet — which is exactly the state a brand-new LinkedIn member is
   * in, since the name and photo arrive filled but the location does
   * not. So saying nothing here opens the profile for the people who
   * need it and the recommendations for everybody else, without this
   * route guessing from two columns.
   */
  return NextResponse.redirect(`${origin}/`);
}
