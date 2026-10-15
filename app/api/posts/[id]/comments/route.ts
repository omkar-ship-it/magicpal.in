import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { addComment, boardIdOfPost, canPostTo } from "@/lib/posts";
import { MAX_COMMENT_LENGTH } from "@/lib/rules";

/** Reply under a post. Members only, same gate as posting. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const payload = await req.json().catch(() => null);
  const body = typeof payload?.body === "string" ? payload.body.trim().slice(0, MAX_COMMENT_LENGTH) : "";
  if (!body) return NextResponse.json({ error: "Say something." }, { status: 400 });

  const boardId = await boardIdOfPost(id);
  if (!boardId) return NextResponse.json({ error: "No such post." }, { status: 404 });
  if (!(await canPostTo(boardId, user.id))) {
    return NextResponse.json({ error: "You're not in this community." }, { status: 403 });
  }

  const commentId = await addComment(id, user.id, body);
  if (!commentId) return NextResponse.json({ error: "Couldn't post that." }, { status: 400 });
  return NextResponse.json({ ok: true, id: commentId });
}
