import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { cleanView, saveView } from "@/lib/brainMate/server";

/** One player of a finished Wavelength shares how the other comes across. */
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { slug } = await ctx.params;
  const body = await req.json().catch(() => null);
  const view = cleanView(body?.view);
  if (!view) return NextResponse.json({ error: "Move each slider to where they sit." }, { status: 400 });
  const res = await saveView(slug, user.id, view);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 409 });
  return NextResponse.json({ ok: true });
}
