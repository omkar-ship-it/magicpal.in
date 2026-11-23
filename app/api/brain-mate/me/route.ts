import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser } from "@/lib/session";
import { hasAcceptedTerms } from "@/lib/profiles";
import { cardFor, crowdStats, getBrainMate } from "@/lib/brainMate/server";
import { siteOrigin } from "@/lib/brainMate/origin";
import type { MeState } from "@/lib/brainMate/payload";

/** What the Brain-Mate overlay needs when it opens: who you are, your card if you've played. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ signedIn: false } satisfies MeState);
  const tz = (await cookies()).get("bm_tz")?.value ?? "Asia/Kolkata";
  const origin = await siteOrigin();
  const [me, card, accepted, stats] = await Promise.all([getBrainMate(user.id), cardFor(user.id, tz, origin), hasAcceptedTerms(user.id), crowdStats()]);
  const body: MeState = {
    signedIn: true,
    card,
    previous: me && !me.current ? me.archetype : null,
    defaultName: me?.displayName ?? user.name?.split(" ")[0] ?? "",
    needsTerms: !accepted,
    stats: stats.n >= 20 ? stats : null,
  };
  return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });
}
