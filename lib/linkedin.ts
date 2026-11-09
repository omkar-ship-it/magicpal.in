/**
 * Sign in with LinkedIn, over OpenID Connect.
 *
 * Chosen over LinkedIn's older profile APIs because the OIDC product is
 * the one that self-approves: it returns a verified email, a name and a
 * picture, which is exactly the set that shortens onboarding, and asks
 * for nothing we would have to justify. It does *not* return a headline,
 * a company or a connection graph — people will still tell us what
 * they're after themselves, which was always the part that matters.
 *
 * Absent credentials the whole feature disappears rather than failing:
 * `linkedinEnabled` is false, the button is never drawn, and the routes
 * answer 503. A half-configured OAuth button that errors after the
 * redirect is worse than no button, because the failure happens on
 * somebody else's domain where we cannot explain it.
 */

import { eq } from "drizzle-orm";
import { db, hasDb } from "./db";
import { users } from "./db/schema";

const AUTHORIZE = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN = "https://www.linkedin.com/oauth/v2/accessToken";
const USERINFO = "https://api.linkedin.com/v2/userinfo";

/** Everything the OIDC product grants, and nothing beyond it. */
const SCOPE = "openid profile email";

export const LINKEDIN_STATE_COOKIE = "li_state";

export const linkedinEnabled = Boolean(
  process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET
);

/**
 * Where LinkedIn sends them back.
 *
 * Derived from the request rather than hard-coded so previews and local
 * development work without a second app — but it must match one of the
 * redirect URLs registered on the LinkedIn app exactly, including the
 * scheme and any trailing slash, or the authorize call fails before the
 * member ever sees a consent screen.
 */
export function redirectUri(origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/auth/linkedin/callback`;
}

export function authorizeUrl({ origin, state }: { origin: string; state: string }): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.LINKEDIN_CLIENT_ID ?? "",
    redirect_uri: redirectUri(origin),
    state,
    scope: SCOPE,
  });
  return `${AUTHORIZE}?${params}`;
}

export type LinkedInIdentity = {
  sub: string;
  email: string;
  name: string | null;
  picture: string | null;
};

/**
 * Code for token, token for identity.
 *
 * Returns null on anything unexpected rather than throwing: every caller
 * is a redirect handler whose only sensible reply is to send somebody
 * back to the map with a message, and a stack trace in a server log is
 * not a reply.
 */
export async function identityFromCode({
  code,
  origin,
}: {
  code: string;
  origin: string;
}): Promise<LinkedInIdentity | null> {
  if (!linkedinEnabled) return null;

  /**
   * Said out loud, because the alternative is guessing.
   *
   * This exchange is the one part of the flow nobody can rehearse: it
   * needs a real member consenting, so the first time it runs in anger
   * is in front of somebody we are trying to keep. If it fails we get
   * one word in a query string, which is the right amount for them and
   * useless for us — so the reason goes to the server log.
   *
   * Status codes and LinkedIn's own error strings only. No token, no
   * email, no name: a log is a place personal data goes to be forgotten
   * about, and the thing that would be most useful here is also the
   * thing we should least like to leave lying around.
   */
  const note = (what: string) => console.warn(`[linkedin] ${what}`);

  const tokenRes = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(origin),
      client_id: process.env.LINKEDIN_CLIENT_ID ?? "",
      client_secret: process.env.LINKEDIN_CLIENT_SECRET ?? "",
    }),
  }).catch(() => null);
  if (!tokenRes) {
    note("token exchange: request never completed");
    return null;
  }
  if (!tokenRes.ok) {
    // LinkedIn answers with JSON naming the cause — invalid_redirect_uri,
    // invalid_client, invalid_grant — which is exactly what we need.
    const why = await tokenRes.text().catch(() => "");
    note(`token exchange: ${tokenRes.status} ${why.slice(0, 300)}`);
    return null;
  }

  const token = (await tokenRes.json().catch(() => null)) as { access_token?: string } | null;
  if (!token?.access_token) {
    note("token exchange: 200 but no access_token in the body");
    return null;
  }

  const meRes = await fetch(USERINFO, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  }).catch(() => null);
  if (!meRes) {
    note("userinfo: request never completed");
    return null;
  }
  if (!meRes.ok) {
    const why = await meRes.text().catch(() => "");
    note(`userinfo: ${meRes.status} ${why.slice(0, 300)}`);
    return null;
  }

  const me = (await meRes.json().catch(() => null)) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  } | null;

  /**
   * An unverified address is not an identity.
   *
   * The account key here is the email: it is how an existing member who
   * signed up with a code gets linked to the same row rather than a
   * second one. Accepting an unverified address would make that link
   * forgeable — claim somebody's email on LinkedIn, sign in, inherit
   * their account.
   */
  if (!me?.sub || !me.email || me.email_verified === false) {
    // Which claim, never its value.
    note(
      `userinfo: unusable claims — sub=${me?.sub ? "yes" : "missing"} email=${
        me?.email ? "yes" : "missing"
      } email_verified=${String(me?.email_verified)}`
    );
    return null;
  }

  return {
    sub: me.sub,
    email: me.email.trim().toLowerCase(),
    name: me.name?.trim() || null,
    picture: me.picture?.trim() || null,
  };
}

/**
 * One LinkedIn member, resolved to one row.
 *
 * Separate from the route so the part with the decisions in it can be
 * driven directly in a test — the HTTP exchange above is thin and the
 * interesting behaviour is all here: does a second sign-in find the
 * same person, and where do they land afterwards.
 *
 * By subject first, then by verified email. The email arm is what links
 * somebody who joined with a one-time code months ago to the LinkedIn
 * button they just pressed, instead of handing them a second, empty
 * account and a map that has forgotten them.
 */
export async function signInWithLinkedIn(
  who: LinkedInIdentity
): Promise<{ userId: string; created: boolean } | null> {
  if (!hasDb || !db) return null;

  let [user] = await db.select().from(users).where(eq(users.linkedinSub, who.sub)).limit(1);
  if (!user) {
    [user] = await db.select().from(users).where(eq(users.email, who.email)).limit(1);
  }

  if (!user) {
    // New: take the name and picture, which is most of the first
    // onboarding step done before they have typed anything.
    const [made] = await db
      .insert(users)
      .values({ email: who.email, linkedinSub: who.sub, name: who.name, photoUrl: who.picture })
      .returning();
    return { userId: made.id, created: true };
  }

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

  return { userId: user.id, created: false };
}
