import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { closeJob } from "@/lib/jobs";

/** Close your own role — filled, or withdrawn. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  // One 403 whether it isn't yours or doesn't exist — distinguishing them
  // would confirm a job exists that the caller can't see.
  const ok = await closeJob(id, user.id);
  if (!ok) return NextResponse.json({ error: "Can't close that." }, { status: 403 });
  return NextResponse.json({ ok: true });
}
