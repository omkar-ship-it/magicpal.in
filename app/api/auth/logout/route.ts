import { NextResponse } from "next/server";
import { destroySession } from "@/lib/session";

/**
 * Sign out.
 *
 * Answers with JSON rather than a redirect: the whole app is one shell on
 * top of a map, so the client reloads its own state instead of navigating.
 * `destroySession` revokes the row as well as the cookie — see lib/session
 * for why dropping the cookie alone isn't signing out.
 */
export async function POST() {
  await destroySession();
  return NextResponse.json({ ok: true });
}
