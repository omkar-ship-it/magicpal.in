import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { setPinned } from "@/lib/posts";

/**
 * Hold a post at the top of its community's feed, or let it go.
 *
 * Owner-only, and `setPinned` enforces that rather than this route, so the
 * rule lives with the thing it protects. One 403 for "not yours" and for
 * "not the owner" alike.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const pinned = body?.pinned !== false;

  const ok = await setPinned(id, user.id, pinned);
  if (!ok) return NextResponse.json({ error: "Only the owner can pin a post." }, { status: 403 });
  return NextResponse.json({ ok: true, pinned });
}
