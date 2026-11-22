import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { claimLink } from "@/lib/brainMate/server";

/** A friend who has already played answers a link without replaying. */
export async function POST(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { slug } = await ctx.params;
  const res = await claimLink(slug, user.id);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 409 });
  return NextResponse.json({ ok: true });
}
