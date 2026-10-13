import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { deletePost } from "@/lib/posts";

/**
 * Remove a post — the author's own, or any on a board you host.
 *
 * One 403 for both "not yours" and "doesn't exist": distinguishing them
 * would confirm that a post exists on a board the caller can't see.
 */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const ok = await deletePost(id, user.id);
  if (!ok) return NextResponse.json({ error: "Can't remove that." }, { status: 403 });
  return NextResponse.json({ ok: true });
}
