import { ImageResponse } from "next/og";
import { getSessionUser } from "@/lib/session";
import { crowdStats, getBrainMate } from "@/lib/brainMate/server";
import { IdentityCard, cardFonts, siteFrom } from "@/lib/brainMate/cards";
import { MIN_CROWD } from "@/lib/brainMate/score";

/**
 * Your own Brain-Mate card as a story-sized PNG, for download and for the
 * phone's share sheet. Only ever yours: there is no id parameter, because
 * the card is something you choose to post, not something anyone can pull.
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return new Response("Sign in first.", { status: 401 });
  const me = await getBrainMate(user.id);
  if (!me || !me.current) return new Response("Play first.", { status: 404 });
  const stats = await crowdStats();
  const colleague = new URL(req.url).searchParams.get("v") === "colleague";
  return new ImageResponse(
    (
      <IdentityCard
        name={me.displayName}
        archetype={me.archetype}
        streak={me.streak}
        answers={me.answers}
        rarity={stats.n >= MIN_CROWD ? (stats.archetypes[me.archetype] ?? null) : null}
        site={siteFrom(req)}
        colleague={colleague}
      />
    ),
    {
      width: 1080,
      height: 1920,
      fonts: await cardFonts(),
      headers: { "Cache-Control": "private, no-store" },
    }
  );
}
