import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { togglePinJoin } from "@/lib/pins";

/**
 * "I'm coming over" — or taking it back.
 *
 * One tap, no message. Answering somebody sitting in a café shouldn't
 * require composing anything; you can connect properly once you've met.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const result = await togglePinJoin(id, user.id);
  // Null means the pin has expired or been taken down — a join would be a
  // promise to somebody who has already left.
  if (!result) return NextResponse.json({ error: "That pin has ended." }, { status: 410 });
  return NextResponse.json({ ok: true, state: result });
}
