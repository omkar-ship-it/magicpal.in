import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { nudge } from "@/lib/brainMate/server";

/** One reminder per link, recorded so the button can't be leaned on. */
export async function POST(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { slug } = await ctx.params;
  const ok = await nudge(slug, user.id);
  if (!ok) return NextResponse.json({ error: "You've already nudged this one." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
