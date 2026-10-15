import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { boardBySlug, membershipOf, setCheckedIn } from "@/lib/boards";
import { isActive } from "@/lib/membership";

/**
 * "I'm here" / "I've left" at an event.
 *
 * Separate from joining, and separate from location visibility, because
 * they are three different promises: joining says you're in this group,
 * visibility says where you may be drawn, and this says you're in the
 * building for the next few hours. Collapsing presence into the location
 * setting would mean checking in at a conference silently opted you onto
 * the public map.
 */
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const board = await boardBySlug(slug);
  if (!board) return NextResponse.json({ error: "That board doesn't exist." }, { status: 404 });
  if (board.type !== "event") {
    return NextResponse.json({ error: "Only events have a here-now." }, { status: 400 });
  }
  if (!isActive(await membershipOf(board.id, user.id))) {
    return NextResponse.json({ error: "Join the event first." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  await setCheckedIn(board.id, user.id, body?.here !== false);
  return NextResponse.json({ ok: true });
}
