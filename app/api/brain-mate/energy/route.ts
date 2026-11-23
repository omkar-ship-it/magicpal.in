import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { saveEnergy } from "@/lib/brainMate/server";
import { isEnergy } from "@/lib/brainMate/score";

/** The optional "what's taking your energy" answer. Never scored. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!isEnergy(body?.energy)) return NextResponse.json({ error: "Pick one." }, { status: 400 });
  const ok = await saveEnergy(user.id, body.energy);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Play first." }, { status: 409 });
}
