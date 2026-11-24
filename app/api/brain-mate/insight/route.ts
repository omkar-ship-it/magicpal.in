import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { saveInsight } from "@/lib/brainMate/server";
import { INSIGHT_VERDICTS, TENSIONS } from "@/lib/brainMate/insights";

/** "That's so me" / "Not quite" on the reveal's insight. Never scored — it tells us which lines land. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const known = TENSIONS.some((t) => t.id === id) || /^trait-[OIDSEACHV]-(hi|lo)$/.test(id);
  if (!known || !INSIGHT_VERDICTS.includes(body?.verdict)) return NextResponse.json({ error: "Unknown insight." }, { status: 400 });
  const ok = await saveInsight(user.id, id, body.verdict);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Play first." }, { status: 409 });
}
