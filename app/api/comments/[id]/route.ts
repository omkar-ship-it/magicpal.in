import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { deleteComment } from "@/lib/posts";

/** Remove a reply — the author's own, or any on a board you own. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const ok = await deleteComment(id, user.id);
  if (!ok) return NextResponse.json({ error: "Can't remove that." }, { status: 403 });
  return NextResponse.json({ ok: true });
}
