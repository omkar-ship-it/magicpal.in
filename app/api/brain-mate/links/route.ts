import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { hasDb } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { createLink } from "@/lib/brainMate/server";

/** Spend today's one Wavelength link on one named person. */
export async function POST(req: Request) {
  if (!hasDb) return NextResponse.json({ error: "Not available right now." }, { status: 503 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const tz = typeof body?.tz === "string" ? body.tz : ((await cookies()).get("bm_tz")?.value ?? "Asia/Kolkata");
  const res = await createLink({
    senderId: user.id,
    recipientName: typeof body?.name === "string" ? body.name : "",
    relation: body?.relation === "colleague" ? "colleague" : "friend",
    tz,
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ ok: true, slug: res.slug });
}
