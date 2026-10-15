import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { boardIdOfPost, canPostTo, toggleReaction } from "@/lib/posts";
import { REACTION_IDS } from "@/lib/rules";

/**
 * One tap on a post, on or off.
 *
 * Gated on membership rather than on merely being signed in: reacting is
 * writing to a private group's feed, and the fact that somebody knows a
 * post id must never be enough to leave a mark inside a board they left.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const kind = typeof body?.kind === "string" && REACTION_IDS.includes(body.kind) ? body.kind : null;
  if (!kind) return NextResponse.json({ error: "Unknown reaction." }, { status: 400 });

  const boardId = await boardIdOfPost(id);
  if (!boardId) return NextResponse.json({ error: "No such post." }, { status: 404 });
  if (!(await canPostTo(boardId, user.id))) {
    return NextResponse.json({ error: "You're not in this community." }, { status: 403 });
  }

  const result = await toggleReaction(id, user.id, kind);
  if (!result) return NextResponse.json({ error: "No such post." }, { status: 404 });
  return NextResponse.json({ ok: true, ...result });
}
