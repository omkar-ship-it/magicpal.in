import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { liveBoardBySlug, setMemberStatus, setMemberVerified } from "@/lib/boards";
import { MEMBER_REMOVED } from "@/lib/membership";

/**
 * What the owner can do to one member: vouch for them, or remove them.
 *
 * Owner-only, and the check is `board.hostUserId` rather than a membership
 * role — one source of truth for who runs a community, so an edit here and
 * an edit in the board PATCH route can't drift apart into two different
 * answers. Appointing other admins isn't built yet, deliberately.
 *
 * Removal and un-verification are the same shape of action on purpose: both
 * are the owner withdrawing something they granted, and both should read in
 * the audit of the member list as a thing a person did.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ slug: string; userId: string }> }) {
  const { slug, userId } = await ctx.params;

  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const board = await liveBoardBySlug(slug);
  if (!board) return NextResponse.json({ error: "No such community." }, { status: 404 });
  if (board.hostUserId !== me.id) {
    return NextResponse.json({ error: "Only the owner can do that." }, { status: 403 });
  }
  if (userId === me.id) {
    return NextResponse.json({ error: "You can't do that to yourself." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const action = typeof body?.action === "string" ? body.action : "";

  if (action === "verify" || action === "unverify") {
    const ok = await setMemberVerified(board.id, userId, me.id, action === "verify");
    if (!ok) return NextResponse.json({ error: "They're not in this community." }, { status: 404 });
    return NextResponse.json({ ok: true, verified: action === "verify" });
  }

  if (action === "remove") {
    const ok = await setMemberStatus(board.id, userId, MEMBER_REMOVED);
    if (!ok) return NextResponse.json({ error: "Couldn't remove them." }, { status: 400 });
    return NextResponse.json({ ok: true, removed: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
