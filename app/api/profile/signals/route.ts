import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, hasDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/session";
import { getProfileById } from "@/lib/profiles";
import { canEmbed, embed, signalText } from "@/lib/ai";
import { cleanCustom, validSectors, validTopics } from "@/lib/intents";
import { MAX_CUSTOM, MAX_CUSTOM_LENGTH, MAX_INTERESTS, MAX_TOPICS } from "@/lib/rules";

/**
 * One signal at a time, from the one-tap questions in For you: what you're
 * looking for, what you can help with, what you're into. Only the lists
 * sent are written — the rest of the profile is never touched — and the
 * meaning vector is refreshed the same way a full save refreshes it.
 */
export async function POST(req: Request) {
  if (!hasDb || !db) return NextResponse.json({ error: "Not available right now." }, { status: 503 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const body = (await req.json().catch(() => null)) ?? {};
  const patch: Partial<{ lookingFor: string[]; canHelpWith: string[]; interests: string[]; customLookingFor: string[] }> = {};
  if ("lookingFor" in body) patch.lookingFor = validTopics(body.lookingFor).slice(0, MAX_TOPICS);
  if ("canHelpWith" in body) patch.canHelpWith = validTopics(body.canHelpWith).slice(0, MAX_TOPICS);
  if ("interests" in body) patch.interests = validSectors(body.interests).slice(0, MAX_INTERESTS);
  if ("customLookingFor" in body) patch.customLookingFor = cleanCustom(body.customLookingFor, { max: MAX_CUSTOM, maxLength: MAX_CUSTOM_LENGTH });
  if (!Object.keys(patch).length) return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  await db.update(users).set(patch).where(eq(users.id, user.id));

  if (canEmbed) {
    const fresh = await getProfileById(user.id);
    const text = fresh ? signalText(fresh) : "";
    if (fresh && text && text !== fresh.embeddingOf) {
      const vector = await embed(text);
      if (vector) await db.update(users).set({ embedding: vector, embeddingOf: text }).where(eq(users.id, user.id));
    }
  }
  return NextResponse.json({ ok: true });
}
