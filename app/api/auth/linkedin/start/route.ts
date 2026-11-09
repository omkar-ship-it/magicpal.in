import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { authorizeUrl, linkedinEnabled, LINKEDIN_STATE_COOKIE } from "@/lib/linkedin";

/**
 * Off to LinkedIn.
 *
 * A GET that redirects, because it is reached by a link rather than a
 * form — there is nothing to submit, and an anchor keeps the browser's
 * own "open in new tab" working, which people do with sign-in buttons
 * more than you would think.
 *
 * The `state` is minted here and parked in a short, httpOnly cookie. It
 * is the only thing standing between us and somebody pasting a crafted
 * callback URL into a victim's browser to bind their session to an
 * attacker's LinkedIn account.
 */
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  if (!linkedinEnabled) {
    return NextResponse.redirect(`${origin}/?panel=signin&li=unavailable`);
  }

  const state = randomBytes(24).toString("base64url");
  const store = await cookies();
  store.set(LINKEDIN_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // Long enough to read a consent screen, short enough that a stale one
    // in a tab opened yesterday cannot be completed.
    maxAge: 600,
  });

  return NextResponse.redirect(authorizeUrl({ origin, state }));
}
