import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { liveBoardBySlug, setMemberStatus } from "@/lib/boards";
import { MEMBER_LEFT } from "@/lib/membership";

/**
 * Leave a community.
 *
 * Marked `left` rather than deleted, so the same invite link lets you walk
 * straight back in — leaving is a decision about now, not a door locking
 * behind you. The owner is refused: a community with nobody who can verify
 * a member or take a post down is worse than one that's closed, and
 * handing ownership on isn't built yet.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const board = await liveBoardBySlug(slug);
  if (!board) return NextResponse.json({ error: "No such community." }, { status: 404 });

  if (board.hostUserId === user.id) {
    return NextResponse.json(
      { error: "You run this community — hand it to somebody else before leaving." },
      { status: 400 }
    );
  }

  const ok = await setMemberStatus(board.id, user.id, MEMBER_LEFT);
  if (!ok) return NextResponse.json({ error: "You're not in this community." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
