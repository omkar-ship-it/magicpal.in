import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { endPin } from "@/lib/pins";

/** Take your own pin down early. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  // One 403 whether it isn't yours or doesn't exist — distinguishing them
  // would confirm a pin exists that the caller can't see.
  const ok = await endPin(id, user.id);
  if (!ok) return NextResponse.json({ error: "Can't remove that." }, { status: 403 });
  return NextResponse.json({ ok: true });
}
