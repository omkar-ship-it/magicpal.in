import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { linkFor } from "@/lib/brainMate/server";
import { siteOrigin } from "@/lib/brainMate/origin";

/** One Wavelength link as the viewer should see it — for the overlay on the map. */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const user = await getSessionUser();
  const link = await linkFor(slug, user?.id ?? null, await siteOrigin());
  if (!link) return NextResponse.json({ error: "That link doesn't exist." }, { status: 404 });
  return NextResponse.json(link, { headers: { "Cache-Control": "private, no-store" } });
}
