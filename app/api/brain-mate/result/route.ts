import { NextResponse } from "next/server";
import { db, hasDb } from "@/lib/db";
import { consents } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/session";
import { hasAcceptedTerms } from "@/lib/profiles";
import { LEGAL_VERSION, TERMS_CONSENT_KIND } from "@/lib/legal";
import { cleanAnswers, howDidItKnow } from "@/lib/brainMate/score";
import { claimLink, crowdStats, saveBrainMate } from "@/lib/brainMate/server";

/**
 * Save a finished game. The archetype is recomputed from the answers here —
 * the client's own reveal is only a preview of this — and a game that came
 * in through a Wavelength link completes that link in the same request, so
 * the friend never sees "played" without the pair also being "done".
 */
export async function POST(req: Request) {
  if (!hasDb || !db) return NextResponse.json({ error: "Not available right now." }, { status: 503 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to play." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim().replace(/\s+/g, " ").slice(0, 40) : "";
  if (name.length < 2) return NextResponse.json({ error: "What should your card call you?" }, { status: 400 });

  const answers = cleanAnswers(body?.answers);
  if (!answers) return NextResponse.json({ error: "Those answers don't add up — play it once more?" }, { status: 400 });

  // Same rule as the profile form: the consent is enforced here, and a row
  // records which wording was agreed to.
  if (!(await hasAcceptedTerms(user.id))) {
    if (body?.acceptTerms !== true)
      return NextResponse.json({ error: "Please accept the Terms and Privacy Policy to save your result." }, { status: 400 });
    await db.insert(consents).values({ userId: user.id, kind: TERMS_CONSENT_KIND, granted: true, copyVersion: LEGAL_VERSION });
  }

  const result = await saveBrainMate(user.id, name, answers);
  const stats = await crowdStats();

  let linkError: string | null = null;
  const slug = typeof body?.link === "string" ? body.link : null;
  if (slug) {
    const claimed = await claimLink(slug, user.id);
    if (!claimed.ok) linkError = claimed.error ?? null;
  }

  return NextResponse.json({
    ok: true,
    archetype: result.archetype,
    streak: result.streak,
    players: stats.n,
    rarity: stats.archetypes[result.archetype] ?? 0,
    know: howDidItKnow(answers, stats),
    linkError,
  });
}
